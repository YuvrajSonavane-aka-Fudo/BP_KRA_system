"""
File: views.py
App: kra_assignment

Purpose:
    Handles HTTP request/response lifecycle for KRA assignment API endpoints.

Includes:
    - API views for employee listing, bulk KRA enrolment, assignment update/delete,
      and KRA cloning across enrolments

Responsibilities:
    - Orchestrate request flow
    - Delegate validation to serializers
    - Delegate business logic to ORM / transaction blocks
    - Handle errors gracefully and return consistent responses

Notes:
    - Keep views thin — no heavy business logic here
    - Identity source is Employee (hrflow_employee), not User (hrflow_users)
    - Permission checks use helper utilities from utils.py (_is_hr, _caller_can_act_on)
    - Audit logging is performed via _audit() for all mutating operations
"""

from collections import defaultdict
from typing import Any

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import F, Q
from django.shortcuts import get_object_or_404
import threading

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from kra_cycle.models import (
    Employee,
    KRACycle,
    KRACycleStage,
    EmployeeKRACycle,
    EmployeeKRACycleCategory,
    EmployeeKRALevel,
    KRALevel,
    KRA,
    KRACategory,
    Stage,
    Level,
    Rating,
    AuditLog,
)

from utils import _get_caller, _is_hr, _is_lead, _caller_can_act_on, _audit
from .serializers import (
    BulkAssignmentEnrolSerializer,
    AssignmentUpdateSerializer,
    CloneAssignmentSerializer,
)


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------

def send_bulk_kra_emails(
    enrolled: list[dict[str, Any]],
    employee_map: dict[int, Employee],
    cycle: KRACycle,
) -> None:
    """
    Sends KRA assignment notification emails to all successfully enrolled employees.

    Fetches KRA names from DB in one query using prefetch_related, then iterates
    over enrolled entries to build and dispatch individual emails.

    Args:
        enrolled: List of enrolment result dicts (each contains employee_id and
                  employee_kra_cycle_id).
        employee_map: Mapping of employee_id → Employee instance (pre-fetched).
        cycle: The KRACycle that was assigned.
    """
    ekc_ids = [e["employee_kra_cycle_id"] for e in enrolled]

    ekcs = (
        EmployeeKRACycle.objects
        .filter(id__in=ekc_ids)
        .prefetch_related(
            "kra_level_rows__kra_level__kra"
        )
    )

    ekc_map = {e.id: e for e in ekcs}

    for enrol in enrolled:
        employee_id = enrol["employee_id"]

        emp = employee_map.get(employee_id)
        if not emp or not emp.email:
            continue

        ekc = ekc_map.get(enrol["employee_kra_cycle_id"])
        if not ekc:
            continue

        kra_names = [
            row.kra_level.kra.name
            for row in ekc.kra_level_rows.all()
            if row.kra_level and row.kra_level.kra
        ]

        kras_text = "\n".join(f"- {k}" for k in kra_names)

        subject = f"KRA Assignment - {cycle.name}"

        message = f"""
Hi {emp.first_name},

You have been assigned KRAs for cycle:
{cycle.name}

Assigned KRAs:
{kras_text}

Please login to the portal.

Regards,
HR Team
"""

        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [emp.email],
                fail_silently=True,
            )
        except Exception as e:
            print(e)


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------

class EmployeeListView(APIView):
    """
    Returns a list of employees with their KRA assignment status for a given cycle.

    GET /api/v1/employees?cycle_id=<id>

    Access:
        - HR / Vertical Lead → all active employees
        - Lead / Manager     → only direct reports (manager_id = caller.id)

    Query Parameters:
        cycle_id (int, optional): When supplied, enriches each employee record with
            their enrolment status, assigned KRA levels, and category weightages
            for that specific cycle.

    Performance Notes:
        - employee_roles prefetched with role names in one query via values()
        - cycle_map, kra_map, category_map built in bulk queries before the
          Python loop — no per-employee DB hits inside the loop
        - _is_hr check on caller done once outside the loop
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        caller = _get_caller(request)
        cycle_id = request.query_params.get("cycle_id")

        #  1. Base employee queryset
        qs = (
            Employee.objects
            .filter(active=True)
            .select_related("department", "level", "role")
            .only(
                "id", "first_name", "last_name", "email", "title",
                "manager_id", "department__department_name",
                "level__name", "role__name",
            )
        )

        if not _is_hr(caller):
            qs = qs.filter(manager_id=caller.id)

        # Evaluate queryset once
        employees_list = list(qs)
        employee_ids = [e.id for e in employees_list]

        # 2. Roles — one query for all employees, no per-row hit
        roles_qs = (
            Employee.objects
            .filter(id__in=employee_ids)
            .values("id")
            .annotate(role_name=F("employee_roles__role__name"))
            .values_list("id", "role_name")
        )
        roles_map: dict[int, list[str]] = defaultdict(list)  # employee_id → [role_name, ...]
        for emp_id, role_name in roles_qs:
            if role_name:
                roles_map[emp_id].append(role_name)

        #  3. Cycle data — all in bulk if cycle_id provided
        cycle_map: dict[int, int] = {}     # employee_id → employee_kra_cycle_id
        kra_map: dict[int, list[dict[str, Any]]] = {}       # employee_id → [{kra_level_id, kra_id, name}, ...]
        category_map: dict[int, list[dict[str, Any]]] = {}  # employee_id → [{category_id, weightage}, ...]

        if cycle_id:
            # 3a. Enrolled employees
            for ekc in EmployeeKRACycle.objects.filter(
                kra_cycle_id=cycle_id,
                employee_id__in=employee_ids,
            ).values("employee_id", "id"):
                cycle_map[ekc["employee_id"]] = ekc["id"]

            if cycle_map:
                ekc_ids = list(cycle_map.values())
                ekc_to_emp = {v: k for k, v in cycle_map.items()}

                # 3b. KRA levels — one query
                for ekl in EmployeeKRALevel.objects.filter(
                    employee_kra_cycle_id__in=ekc_ids
                ).values(
                    "employee_kra_cycle_id",
                    "kra_level_id",
                    "kra_level__kra_id",
                    "kra_level__kra__name",
                    "assigned_by_role",
                ).distinct():
                    emp_id = ekc_to_emp.get(ekl["employee_kra_cycle_id"])
                    if emp_id is None:
                        continue
                    kra_map.setdefault(emp_id, []).append({
                        "kra_level_id":     ekl["kra_level_id"],
                        "kra_id":           ekl["kra_level__kra_id"],
                        "name":             ekl["kra_level__kra__name"],
                        "assigned_by_role": ekl["assigned_by_role"],
                    })

                # 3c. Category weightages — one query
                for ekc_cat in EmployeeKRACycleCategory.objects.filter(
                    employee_kra_cycle_id__in=ekc_ids
                ).values("employee_kra_cycle_id", "category_id", "weightage", "assigned_by_role"):
                    emp_id = ekc_to_emp.get(ekc_cat["employee_kra_cycle_id"])
                    if emp_id is None:
                        continue
                    category_map.setdefault(emp_id, []).append({
                        "category_id":      ekc_cat["category_id"],
                        "weightage":        ekc_cat["weightage"],
                        "assigned_by_role": ekc_cat["assigned_by_role"],
                    })

        # 4. Cycle membership — one bulk query across ALL cycles for this employee set
        #    Returns cycle_ids list on every employee so the frontend can filter
        #    the employee dropdown to only those enrolled in selected cycles.
        all_cycle_ids_map: dict[int, list[int]] = defaultdict(list)  # employee_id → [cycle_id, ...]
        for row in EmployeeKRACycle.objects.filter(
            employee_id__in=employee_ids
        ).values("employee_id", "kra_cycle_id"):
            all_cycle_ids_map[row["employee_id"]].append(row["kra_cycle_id"])

        #  5. Build response — pure Python, zero DB hits
        result: list[dict[str, Any]] = []
        for e in employees_list:
            result.append({
                "employee_id":           e.id,
                "full_name":             f"{e.first_name} {e.last_name}",
                "email":                 e.email,
                "title":                 e.title,
                "department":            e.department.department_name if e.department else None,
                "level":                 e.level.name if e.level else None,
                "manager_id":            e.manager_id,
                "roles":                 roles_map.get(e.id, []),
                "assigned_to_cycle":     e.id in cycle_map,
                "employee_kra_cycle_id": cycle_map.get(e.id),
                "assigned_categories":   category_map.get(e.id, []),
                "assigned_kras":         kra_map.get(e.id, []),
                # all cycles this employee is enrolled in — used by frontend
                # to filter the employee dropdown to selected cycles (superset)
                "cycle_ids":             all_cycle_ids_map.get(e.id, []),
            })

        return Response({"employees": result}, status=status.HTTP_200_OK)


class KRABulkAssignmentEnrolView(APIView):
    """
    Bulk-enrolls one or more employees into a KRA cycle and assigns KRAs.

    POST /api/v1/kra/cycles/<cycle_id>/assignments/bulk

    Supports two assignment modes:
        - Mode A (shared): All employees receive the same KRAs and categories
          (when the 'shared' key is present in the request body).
        - Mode B (per-employee): Each assignment entry carries its own
          categories and kra_level_ids.

    Enrolment behaviour is controlled by 'enrol_mode':
        - 'skip'      — skip employees already enrolled (default)
        - 'overwrite' — replace existing KRAs and categories
        - 'append'    — add new KRAs/categories without removing existing ones

    Returns:
        207 Multi-Status when some records enrolled and some were skipped/failed.
        400 Bad Request when all records failed.
        201 Created when all records were successfully enrolled.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, cycle_id: int) -> Response:
        caller = _get_caller(request)
        caller_role = caller.role.name if caller.role else "Unknown"

        # Validate top-level request body
        serializer = BulkAssignmentEnrolSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        assignments: list[dict[str, Any]] = validated["assignments"]
        shared: dict[str, Any] | None = validated.get("shared")
        enrol_mode: str = validated["enrol_mode"]

        cycle = get_object_or_404(KRACycle, id=cycle_id, is_deleted=False)

        # 1. Collect all employee IDs
        employee_ids: list[int] = [a["employee_id"] for a in assignments]

        # 2. Verify caller permissions — bulk check instead of per-employee query
        if not _is_hr(caller):
            # One query: which of these employees report to caller?
            authorized_ids = set(
                Employee.objects.filter(
                    id__in=employee_ids,
                    manager_id=caller.id,
                ).values_list("id", flat=True)
            )
            unauthorized = [eid for eid in employee_ids if eid not in authorized_ids]
            if unauthorized:
                return Response(
                    {
                        "error": "You do not have permission to assign KRAs to these employees",
                        "unauthorized_employee_ids": unauthorized,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        # 3. Find already enrolled employees — one query
        already_enrolled: dict[int, EmployeeKRACycle] = {
            ekc.employee_id: ekc
            for ekc in EmployeeKRACycle.objects.filter(
                kra_cycle_id=cycle_id,
                employee_id__in=employee_ids,
            )
        }

        # 4. Bulk-fetch employee records — one query
        employee_map: dict[int, Employee] = {
            e.id: e
            for e in Employee.objects.filter(id__in=employee_ids).select_related("manager")
        }

        # 5. Validate shared weightage once if Mode A
        shared_categories: list[dict[str, Any]] = []
        shared_kra_level_ids: list[int] = []
        shared_kra_selections: list[dict[str, Any]] = []
        shared_is_date_based: bool = False
        shared_weight: int = 0
        kra_level_lookup: dict[tuple[int, int], int] = {}

        if shared:
            shared_categories = shared.get("categories", [])
            shared_kra_level_ids = shared.get("kra_level_ids", [])
            shared_kra_selections = shared.get("kra_selections", [])
            shared_is_date_based = shared.get("is_date_based", False)

            try:
                shared_weight = sum(int(c.get("weightage", 0)) for c in shared_categories)
            except (ValueError, TypeError):
                return Response(
                    {"error": "shared.categories contains an invalid weightage value"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            #  Pre-resolve ALL KRALevel lookups in one query
            # Previously this was one query per selection per employee (N*M queries).
            # Now: collect all (kra_id, level_id) pairs, fetch in bulk, build a map.
            if shared_kra_selections:
                lookup_pairs = [
                    (sel.get("kra_id"), sel.get("kra_level_id"))
                    for sel in shared_kra_selections
                ]
                q = Q()
                for kra_id, level_id in lookup_pairs:
                    q |= Q(kra_id=kra_id, level_id=level_id)
                for kl in KRALevel.objects.filter(q).values("id", "kra_id", "level_id"):
                    kra_level_lookup[(kl["kra_id"], kl["level_id"])] = kl["id"]

        # Process each assignment
        enrolled: list[dict[str, Any]] = []
        skipped: list[dict[str, Any]] = []
        failed: list[dict[str, Any]] = []

        with transaction.atomic():
            for a in assignments:
                eid: int = a["employee_id"]

                emp = employee_map.get(eid)
                if not emp:
                    failed.append({"employee_id": eid, "reason": "Employee not found or inactive"})
                    continue

                # Resolve categories + KRAs for this employee
                if shared:
                    categories = shared_categories
                    is_date_based = shared_is_date_based
                    total_weight = shared_weight

                    if shared_kra_selections:
                        kra_level_ids: list[int] = []
                        for sel in shared_kra_selections:
                            kra_id = sel.get("kra_id")
                            level_id = sel.get("kra_level_id")
                            # Use pre-built map — no DB hit
                            match = kra_level_lookup.get((kra_id, level_id))
                            if match:
                                kra_level_ids.append(match)
                            else:
                                failed.append({
                                    "employee_id": eid,
                                    "reason": f"No KRALevel found for kra_id={kra_id} at level_id={level_id}",
                                })
                    else:
                        kra_level_ids = shared_kra_level_ids

                else:
                    # Mode B — per-employee config
                    categories = a.get("categories", [])
                    kra_level_ids = a.get("kra_level_ids", [])
                    is_date_based = a.get("is_date_based", False)
                    try:
                        total_weight = sum(int(c.get("weightage", 0)) for c in categories)
                    except (ValueError, TypeError):
                        failed.append({"employee_id": eid, "reason": "Invalid weightage value in categories"})
                        continue

                existing_ekc = already_enrolled.get(eid)

                if existing_ekc:
                    if enrol_mode == "skip":
                        skipped.append({
                            "employee_id": eid,
                            "employee_kra_cycle_id": existing_ekc.id,
                            "reason": "Already enrolled in this cycle. Use enrol_mode=overwrite or enrol_mode=append to modify.",
                        })
                        continue

                    ekc = existing_ekc

                    update_fields = ["is_date_based"]
                    ekc.is_date_based = is_date_based
                    new_level_id = a.get("employee_level_id")
                    if new_level_id is not None:
                        ekc.employee_level_id = new_level_id
                        update_fields.append("employee_level_id")
                    ekc.save(update_fields=update_fields)

                    skipped_cats: list[dict[str, Any]] = []
                    kras_added: int = 0

                    if enrol_mode == "overwrite":
                        ekc.categories.all().delete()
                        EmployeeKRACycleCategory.objects.bulk_create([
                            EmployeeKRACycleCategory(
                                employee_kra_cycle=ekc,
                                category_id=cat["category_id"],
                                weightage=str(cat["weightage"]),
                                assigned_by_role=caller_role,
                            )
                            for cat in categories
                        ])
                        ekc.kra_level_rows.all().delete()
                        new_kra_rows = EmployeeKRALevel.objects.bulk_create([
                            EmployeeKRALevel(
                                employee_id=eid,
                                kra_level_id=kl_id,
                                employee_kra_cycle=ekc,
                                assigned_by_role=caller_role,
                            )
                            for kl_id in kra_level_ids
                        ])
                        kras_added = len(new_kra_rows)

                    else:  # append
                        existing_cats = {c.category_id: c for c in ekc.categories.all()}
                        current_total = sum(int(c.weightage) for c in existing_cats.values())
                        remaining = 100 - current_total
                        new_cat_rows: list[EmployeeKRACycleCategory] = []
                        skipped_cats = []
                        for cat in categories:
                            cid = cat["category_id"]
                            cat_weight = int(cat["weightage"])
                            if cid in existing_cats:
                                freed = int(existing_cats[cid].weightage)
                                effective_remaining = remaining + freed
                                if cat_weight > effective_remaining:
                                    skipped_cats.append({
                                        "category_id": cid,
                                        "reason": f"weightage {cat_weight}% exceeds remaining {effective_remaining}%",
                                    })
                                    continue
                                existing_cats[cid].weightage = str(cat_weight)
                                existing_cats[cid].save(update_fields=["weightage"])
                                remaining = effective_remaining - cat_weight
                            else:
                                if cat_weight > remaining:
                                    skipped_cats.append({
                                        "category_id": cid,
                                        "reason": f"weightage {cat_weight}% exceeds remaining {remaining}%",
                                    })
                                    continue
                                new_cat_rows.append(
                                    EmployeeKRACycleCategory(
                                        employee_kra_cycle=ekc,
                                        category_id=cid,
                                        weightage=str(cat_weight),
                                        assigned_by_role=caller_role,
                                    )
                                )
                                remaining -= cat_weight
                        if new_cat_rows:
                            EmployeeKRACycleCategory.objects.bulk_create(new_cat_rows)

                        existing_kra_level_ids = set(
                            ekc.kra_level_rows.values_list("kra_level_id", flat=True)
                        )
                        to_add = [kl_id for kl_id in kra_level_ids if kl_id not in existing_kra_level_ids]
                        if not to_add:
                            skipped.append({
                                "employee_id": eid,
                                "employee_kra_cycle_id": ekc.id,
                                "reason": "append: all submitted KRA levels already exist on this employee — nothing added.",
                            })
                            continue
                        new_kra_rows = EmployeeKRALevel.objects.bulk_create([
                            EmployeeKRALevel(
                                employee_id=eid,
                                kra_level_id=kl_id,
                                employee_kra_cycle=ekc,
                                assigned_by_role=caller_role,
                            )
                            for kl_id in to_add
                        ])
                        kras_added = len(new_kra_rows)

                    enrolled.append({
                        "employee_id": eid,
                        "employee_kra_cycle_id": ekc.id,
                        "kras_added": kras_added,
                        "enrol_mode": enrol_mode,
                        "assigned_categories": [
                            {"category_id": c.category_id, "weightage": c.weightage}
                            for c in ekc.categories.all()
                        ],
                        "total_weightage": sum(int(c.weightage) for c in ekc.categories.all()),
                        "skipped_categories": skipped_cats,
                    })

                else:
                    # New enrolment
                    ekc = EmployeeKRACycle.objects.create(
                        employee_id=eid,
                        kra_cycle=cycle,
                        status="Draft",
                        stage_id=1,
                        is_date_based=is_date_based,
                        employee_manager_id=emp.manager_id,
                        employee_level_id=a.get("employee_level_id") or None,
                    )

                    EmployeeKRACycleCategory.objects.bulk_create([
                        EmployeeKRACycleCategory(
                            employee_kra_cycle=ekc,
                            category_id=cat["category_id"],
                            weightage=str(cat["weightage"]),
                            assigned_by_role=caller_role,
                        )
                        for cat in categories
                    ])

                    EmployeeKRALevel.objects.bulk_create([
                        EmployeeKRALevel(
                            employee_id=eid,
                            kra_level_id=kl_id,
                            employee_kra_cycle=ekc,
                            assigned_by_role=caller_role,
                        )
                        for kl_id in kra_level_ids
                    ])

                    enrolled.append({
                        "employee_id": eid,
                        "employee_kra_cycle_id": ekc.id,
                        "kras_added": len(kra_level_ids),
                        "enrol_mode": "new",
                        "assigned_categories": [
                            {"category_id": cat["category_id"], "weightage": str(cat["weightage"])}
                            for cat in categories
                        ],
                        "total_weightage": sum(int(cat["weightage"]) for cat in categories),
                    })

        _audit(
            request,
            "KRA_BULK_ASSIGNED",
            "EmployeeKRACycle",
            cycle_id,
            new_data={
                "cycle_id": cycle_id,
                "assigned_by": caller.id,
                "mode": "shared" if shared else "per_employee",
                "enrol_mode": enrol_mode,
                "total_submitted": len(assignments),
                "enrolled_count": len(enrolled),
                "skipped_count": len(skipped),
                "failed_count": len(failed),
                "enrolled_ids": [e["employee_id"] for e in enrolled],
                "skipped_ids": [s["employee_id"] for s in skipped],
                "failed_ids": [f["employee_id"] for f in failed],
            },
        )

        # if enrolled:
        #     threading.Thread(
        #         target=send_bulk_kra_emails,
        #         args=(enrolled, employee_map, cycle),
        #         daemon=True,
        #     ).start()

        if enrolled and (skipped or failed):
            http_status = status.HTTP_207_MULTI_STATUS

        elif not enrolled and failed:
            http_status = status.HTTP_400_BAD_REQUEST

        else:
            http_status = status.HTTP_201_CREATED

        return Response(
            {
                "cycle_id": cycle_id,
                "enrolled": enrolled,
                "skipped": skipped,
                "failed": failed,
                "summary": {
                    "total_submitted": len(assignments),
                    "enrolled_count": len(enrolled),
                    "skipped_count": len(skipped),
                    "failed_count": len(failed),
                },
            },
            status=http_status,
        )


class KRAAssignmentUpdateDeleteView(APIView):
    """
    Updates or removes a single KRA enrolment record.

    PUT    /api/v1/kra/assignments/<employee_kra_cycle_id>  — replace categories and KRA levels
    DELETE /api/v1/kra/assignments/<employee_kra_cycle_id>  — remove the enrolment entirely

    Access:
        - HR / Vertical Lead → any employee
        - Lead / Manager     → only their direct reports

    Notes:
        - PUT replaces all categories and KRA level rows atomically (delete-then-insert)
        - DELETE cascades to kra_level_rows and categories before removing the record
    """

    permission_classes = [IsAuthenticated]

    def put(self, request: Request, employee_kra_cycle_id: int) -> Response:
        caller = _get_caller(request)
        caller_role = caller.role.name if caller.role else "Unknown"
        ekc = get_object_or_404(EmployeeKRACycle, id=employee_kra_cycle_id)

        # Validate request body
        serializer = AssignmentUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        categories: list[dict[str, Any]] = validated["categories"]
        kra_level_ids: list[int] = validated["kra_level_ids"]

        old_data = {
            "employee_level_id": ekc.employee_level_id,
            "is_date_based": ekc.is_date_based,
            "categories_count": ekc.categories.count(),
            "kras_count": ekc.kra_level_rows.count(),
        }

        if not _caller_can_act_on(caller, ekc.employee_id):
            return Response("Forbidden", status=status.HTTP_403_FORBIDDEN)

        try:
            total_weight = sum(int(c.get("weightage", 0)) for c in categories)
        except (ValueError, TypeError):
            return Response("Invalid weightage value", status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            new_level_id = validated.get("employee_level_id")
            if new_level_id is not None:
                ekc.employee_level_id = new_level_id
            if "is_date_based" in request.data:
                ekc.is_date_based = validated["is_date_based"]
            ekc.save()

            existing_cats = {
                c.category_id: c
                for c in ekc.categories.all()
            }
            ekc.categories.all().delete()
            EmployeeKRACycleCategory.objects.bulk_create([
                EmployeeKRACycleCategory(
                    employee_kra_cycle=ekc,
                    category_id=cat["category_id"],
                    weightage=str(cat["weightage"]),
                    assigned_by_role=(
                        caller_role
                        if cat["category_id"] not in existing_cats
                        or str(existing_cats[cat["category_id"]].weightage) != str(cat["weightage"])
                        else existing_cats[cat["category_id"]].assigned_by_role
                    ),
                )
                for cat in categories
            ])

            existing_kra_roles: dict[int, str] = {
                row.kra_level_id: row.assigned_by_role
                for row in ekc.kra_level_rows.all()
            }
            ekc.kra_level_rows.all().delete()
            EmployeeKRALevel.objects.bulk_create([
                EmployeeKRALevel(
                    employee_id=ekc.employee_id,
                    kra_level_id=kl_id,
                    employee_kra_cycle=ekc,
                    assigned_by_role=existing_kra_roles.get(kl_id, caller_role),
                )
                for kl_id in kra_level_ids
            ])

        _audit(
            request,
            "KRA_ASSIGNMENT_UPDATED",
            "EmployeeKRACycle",
            ekc.id,
            old_data=old_data,
            new_data={
                "employee_level_id": ekc.employee_level_id,
                "is_date_based": ekc.is_date_based,
                "categories_count": len(categories),
                "kras_count": len(kra_level_ids),
            },
        )

        return Response(
            {
                "employee_kra_cycle_id": ekc.id,
                "kras_assigned": len(kra_level_ids),
                "message": "Assignment updated successfully",
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request: Request, employee_kra_cycle_id: int) -> Response:
        caller = _get_caller(request)
        ekc = get_object_or_404(EmployeeKRACycle, id=employee_kra_cycle_id)

        if not _caller_can_act_on(caller, ekc.employee_id):
            return Response("Forbidden", status=status.HTTP_403_FORBIDDEN)

        old_data = {
            "employee_id": ekc.employee_id,
            "cycle_id": ekc.kra_cycle_id,
            "kras_count": ekc.kra_level_rows.count(),
            "categories_count": ekc.categories.count(),
        }

        with transaction.atomic():
            ekc.kra_level_rows.all().delete()
            ekc.categories.all().delete()
            ekc.delete()

        _audit(
            request,
            "KRA_ASSIGNMENT_DELETED",
            "EmployeeKRACycle",
            employee_kra_cycle_id,
            old_data=old_data,
        )

        return Response(
            {"message": "Employee removed from cycle successfully"},
            status=status.HTTP_200_OK,
        )


class KRAAssignmentCloneView(APIView):
    """
    Clones KRA level rows from one source enrolment into one or more target enrolments.

    POST /api/v1/kra/assignments/clone-from

    Ratings and comments are intentionally nulled on every clone — only the
    KRA level assignments themselves are copied.

    Request Body:
        source_employee_kra_cycle_id (int): The enrolment to clone from.
        target_employee_kra_cycle_ids (list[int]): Enrolments to clone into.
        mode (str, optional): Clone behaviour — 'skip' (default), 'append', or 'overwrite'.

    Mode Options:
        'skip'      — skip targets that already have KRA rows
        'append'    — add only the KRA rows not already present on the target
        'overwrite' — delete all existing KRA rows on target, then clone fresh

    Returns:
        207 Multi-Status when some targets cloned and some were skipped/failed.
        400 Bad Request when all targets failed.
        201 Created when all targets were successfully cloned.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        serializer = CloneAssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        source_id: int = validated["source_employee_kra_cycle_id"]
        target_ids: list[int] = validated["target_employee_kra_cycle_ids"]
        mode: str = validated["mode"]

        source_levels = list(
            EmployeeKRALevel.objects.filter(employee_kra_cycle_id=source_id)
        )
        if not source_levels:
            return Response(
                {"error": f"Source assignment {source_id} not found or has no KRA rows"},
                status=status.HTTP_404_NOT_FOUND,
            )

        existing_targets: dict[int, EmployeeKRACycle] = {
            ekc.id: ekc for ekc in EmployeeKRACycle.objects.filter(id__in=target_ids)
        }
        missing = set(target_ids) - set(existing_targets.keys())
        if missing:
            return Response(
                {
                    "error": "Some target IDs do not exist",
                    "missing_target_ids": sorted(missing),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        cloned: list[dict[str, Any]] = []
        skipped: list[dict[str, Any]] = []
        failed: list[dict[str, Any]] = []

        for target_id in target_ids:
            target = existing_targets[target_id]
            existing_rows = target.kra_level_rows.count()

            if existing_rows and mode == "skip":
                skipped.append({
                    "target_employee_kra_cycle_id": target_id,
                    "reason": f"Already has {existing_rows} KRA row(s). Use mode=overwrite or mode=append.",
                })
                continue

            try:
                with transaction.atomic():
                    if mode == "overwrite" and existing_rows:
                        target.kra_level_rows.all().delete()
                        rows_to_clone = source_levels

                    elif mode == "append" and existing_rows:
                        existing_kra_level_ids = set(
                            target.kra_level_rows.values_list("kra_level_id", flat=True)
                        )
                        rows_to_clone = [
                            sl for sl in source_levels
                            if sl.kra_level_id not in existing_kra_level_ids
                        ]
                        if not rows_to_clone:
                            skipped.append({
                                "target_employee_kra_cycle_id": target_id,
                                "reason": "All source KRA rows already exist on this target — nothing to append.",
                            })
                            continue

                    else:
                        rows_to_clone = source_levels

                    new_rows = EmployeeKRALevel.objects.bulk_create([
                        EmployeeKRALevel(
                            employee_id=target.employee_id,
                            kra_level_id=sl.kra_level_id,
                            employee_kra_cycle=target,
                        )
                        for sl in rows_to_clone
                    ])

                cloned.append({
                    "target_employee_kra_cycle_id": target_id,
                    "employee_id": target.employee_id,
                    "kras_copied": len(new_rows),
                    "mode_applied": mode,
                })

            except Exception as exc:
                failed.append({
                    "target_employee_kra_cycle_id": target_id,
                    "reason": str(exc),
                })

        _audit(
            request,
            "KRA_ASSIGNMENT_BULK_CLONED",
            "EmployeeKRACycle",
            source_id,
            new_data={
                "source_employee_kra_cycle_id": source_id,
                "kras_in_source": len(source_levels),
                "total_targets": len(target_ids),
                "cloned_count": len(cloned),
                "skipped_count": len(skipped),
                "failed_count": len(failed),
                "mode": mode,
                "cloned_target_ids": [c["target_employee_kra_cycle_id"] for c in cloned],
                "skipped_target_ids": [s["target_employee_kra_cycle_id"] for s in skipped],
                "failed_target_ids": [f["target_employee_kra_cycle_id"] for f in failed],
            },
        )

        if cloned and (skipped or failed):
            http_status = status.HTTP_207_MULTI_STATUS
        elif not cloned and failed:
            http_status = status.HTTP_400_BAD_REQUEST
        else:
            http_status = status.HTTP_201_CREATED

        return Response(
            {
                "source_employee_kra_cycle_id": source_id,
                "kras_in_source": len(source_levels),
                "cloned": cloned,
                "skipped": skipped,
                "failed": failed,
                "summary": {
                    "total_targets": len(target_ids),
                    "cloned_count": len(cloned),
                    "skipped_count": len(skipped),
                    "failed_count": len(failed),
                },
            },
            status=http_status,
        )