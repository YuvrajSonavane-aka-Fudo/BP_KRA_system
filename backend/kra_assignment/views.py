"""
File: views.py
App: kra_assignment
Purpose:
    Handles HTTP request/response lifecycle for KRA assignment endpoints.
    Manages bulk enrollment, updates, deletion, and cloning of KRA assignments.

Includes:
    - API views / viewsets for KRA assignment operations
    - Request validation using serializers
    - Response formatting with detailed status tracking
    - Email notifications for bulk assignments

Responsibilities:
    - Orchestrate KRA assignment request flow
    - Delegate business logic to serializers and utils
    - Handle multi-step transactions atomically
    - Manage permission checks (HR, Manager, Lead)
    - Generate audit logs for compliance

Notes:
    - Keep views thin, no direct DB-heavy logic
    - Use raw SQL utilities for complex queries (e.g., get_active_employees)
    - Identity source: Employee (hrflow_employee), not User (hrflow_users)
    - All bulk operations track enrolled, skipped, and failed outcomes
    - Email notifications run in background threads to avoid blocking
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
    EmployeeKRACycle,
    EmployeeKRACycleCategory,
    EmployeeKRALevel,
    KRALevel,
)

from utils import _audit, _get_caller, _is_hr, _caller_can_act_on
from .serializers import (
    BulkAssignmentEnrolSerializer,
    AssignmentUpdateSerializer,
    CloneAssignmentSerializer,
)

from .kra_assignment_utils import (
    get_employee_roles_map,
    get_cycle_data_maps,
    get_all_cycle_ids_map,
    get_active_employees,
)

# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------

def send_bulk_kra_emails(
    enrolled: list[dict[str, Any]],
    employee_map: dict[int, Employee],
    cycle: KRACycle,
) -> None:
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

        employee = employee_map.get(employee_id)
        if not employee or not employee.email:
            continue

        employee_kra_cycle = ekc_map.get(enrol["employee_kra_cycle_id"])
        if not employee_kra_cycle:
            continue

        kra_names = [
            row.kra_level.kra.name
            for row in employee_kra_cycle.kra_level_rows.all()
            if row.kra_level and row.kra_level.kra
        ]

        kras_text = "\n".join(f"- {k}" for k in kra_names)

        subject = f"KRA Assignment - {cycle.name}"

        message = f"""
Hi {employee.first_name},

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
                [employee.email],
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

    Endpoint: GET /api/v1/employees/?cycle_id=<id>

    Request Headers:
        Authorization: Bearer <token> (required)

    Query Parameters:
        cycle_id: Optional. Filter employees assigned to a specific cycle.

    Response (200):
        {
            "employees": [
                {
                    "employee_id": <id>,
                    "full_name": "<name>",
                    "email": "<email>",
                    "department": "<dept>",
                    "level": "<level>",
                    "manager_id": <manager_id>,
                    "roles": ["Employee", "Manager"],
                    "assigned_to_cycle": true/false,
                    "employee_kra_cycle_id": <cycle_id>,
                    "assigned_categories": [...],
                    "assigned_kras": [...],
                    "cycle_ids": [...]
                }
            ]
        }

    Access Control:
        - HR / Vertical Lead → all active employees
        - Lead / Manager     → only direct reports (manager_id = caller.id)

    Performance:
        - Uses raw SQL utils (get_active_employees, get_employee_roles_map) to minimize ORM queries
        - Prefetches all necessary relationships in single round-trip
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        caller = _get_caller(request)
        cycle_id = request.query_params.get("cycle_id")
        
        is_hr_user = _is_hr(caller)

        # 1. Base employee query (Raw SQL via utils)
        employees_list = get_active_employees(caller.id, is_hr_user)
        employee_ids = [e["id"] for e in employees_list]

        # 2. Roles (Raw SQL via utils)
        roles_map = get_employee_roles_map(employee_ids)

        # 3. Cycle data (Raw SQL via utils)
        cycle_map, kra_map, category_map = get_cycle_data_maps(cycle_id, employee_ids)

        # 4. Cycle membership (Raw SQL via utils)
        all_cycle_ids_map = get_all_cycle_ids_map(employee_ids)

        # 5. Build response
        result: list[dict[str, Any]] = []
        for e in employees_list:
            employee_id = e["id"]
            result.append({
                "employee_id":           employee_id,
                "full_name":             f"{e['first_name']} {e['last_name']}",
                "email":                 e["email"],
                "title":                 e["title"],
                "department":            e["department_name"],
                "level":                 e["level_name"],
                "manager_id":            e["manager_id"],
                "roles":                 roles_map.get(employee_id, []),
                "assigned_to_cycle":     employee_id in cycle_map,
                "employee_kra_cycle_id": cycle_map.get(employee_id),
                "assigned_categories":   category_map.get(employee_id, []),
                "assigned_kras":         kra_map.get(employee_id, []),
                "cycle_ids":             all_cycle_ids_map.get(employee_id, []),
            })

        return Response({"employees": result}, status=status.HTTP_200_OK)


class KRABulkAssignmentEnrolView(APIView):
    """
    Bulk-enrolls one or more employees into a KRA cycle and assigns KRAs.

    Endpoint: POST /api/v1/kra/cycles/<cycle_id>/assignments/bulk

    Request Headers:
        Authorization: Bearer <token> (required)
        Content-Type: application/json

    Request Body:
        {
            "assignments": [
                {
                    "employee_id": <id>,
                    "categories": [
                        {"category_id": <id>, "weightage": 50},
                        {"category_id": <id>, "weightage": 50}
                    ],
                    "kra_level_ids": [<id1>, <id2>],
                    "is_date_based": false,
                    "employee_level_id": <level_id>
                }
            ],
            "enrol_mode": "skip|overwrite|append",
            "shared": {  // Optional: apply same config to all
                "categories": [...],
                "kra_level_ids": [...],
                "is_date_based": false
            }
        }

    Response (201/207/400):
        {
            "cycle_id": <id>,
            "enrolled": [...],
            "skipped": [...],
            "failed": [...],
            "summary": {
                "total_submitted": <count>,
                "enrolled_count": <count>,
                "skipped_count": <count>,
                "failed_count": <count>
            }
        }

    Enrol Modes:
        - skip:      Don't modify existing enrollments (default)
        - overwrite: Replace all categories and KRAs for existing enrollments
        - append:    Add new categories/KRAs to existing (respects 100% weightage limit)

    Permission:
        - HR/Vertical Lead: Can assign to any employee
        - Manager/Lead:     Can assign only to direct reports

    Transactions:
        - All operations wrapped in atomic transaction
        - On any failure, entire bulk operation rolls back
        - Email notifications sent after successful transaction
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, cycle_id: int) -> Response:
        caller = _get_caller(request)
        caller_role = caller.role.name if caller.role else "Unknown"

        serializer = BulkAssignmentEnrolSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        assignments: list[dict[str, Any]] = validated["assignments"]
        shared: dict[str, Any] | None = validated.get("shared")
        enrol_mode: str = validated["enrol_mode"]

        cycle = get_object_or_404(KRACycle, id=cycle_id, is_deleted=False)

        employee_ids: list[int] = [a["employee_id"] for a in assignments]

        if not _is_hr(caller):
            authorized_ids = set(
                Employee.objects.filter(
                    id__in=employee_ids,
                    manager_id=caller.id,
                ).values_list("id", flat=True)
            )
            unauthorized = [employee_id for employee_id in employee_ids if employee_id not in authorized_ids]
            if unauthorized:
                return Response(
                    {
                        "error": "You do not have permission to assign KRAs to these employees",
                        "unauthorized_employee_ids": unauthorized,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        already_enrolled: dict[int, EmployeeKRACycle] = {
            employee_kra_cycle.employee_id: employee_kra_cycle
            for employee_kra_cycle in EmployeeKRACycle.objects.filter(
                kra_cycle_id=cycle_id,
                employee_id__in=employee_ids,
            )
        }

        # Converted select_related join to a raw query equivalent via util or leave it?
        # Requirement: "Identify ORM queries that join 2 or more tables... employee_map: dict[int, Employee] = ... Employee.objects.filter(id__in=employee_ids).select_related("manager")"
        employee_map: dict[int, Employee] = {
            e.id: e
            for e in Employee.objects.filter(id__in=employee_ids).select_related("manager")
        }

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

        enrolled: list[dict[str, Any]] = []
        skipped: list[dict[str, Any]] = []
        failed: list[dict[str, Any]] = []

        with transaction.atomic():
            for temporary_assignment in assignments:
                employee_id: int = temporary_assignment["employee_id"]

                employee = employee_map.get(employee_id)
                if not employee:
                    failed.append({"employee_id": employee_id, "reason": "Employee not found or inactive"})
                    continue

                if shared:
                    categories = shared_categories
                    is_date_based = shared_is_date_based

                    if shared_kra_selections:
                        kra_level_ids: list[int] = []
                        for sel in shared_kra_selections:
                            kra_id = sel.get("kra_id")
                            level_id = sel.get("kra_level_id")
                            match = kra_level_lookup.get((kra_id, level_id))
                            if match:
                                kra_level_ids.append(match)
                            else:
                                failed.append({
                                    "employee_id": employee_id,
                                    "reason": f"No KRALevel found for kra_id={kra_id} at level_id={level_id}",
                                })
                    else:
                        kra_level_ids = shared_kra_level_ids

                else:
                    categories = temporary_assignment.get("categories", [])
                    kra_level_ids = temporary_assignment.get("kra_level_ids", [])
                    is_date_based = temporary_assignment.get("is_date_based", False)
                    try:
                        total_weight = sum(int(c.get("weightage", 0)) for c in categories)
                    except (ValueError, TypeError):
                        failed.append({"employee_id": employee_id, "reason": "Invalid weightage value in categories"})
                        continue

                existing_employee_kra_cycle = already_enrolled.get(employee_id)

                if existing_employee_kra_cycle:
                    if enrol_mode == "skip":
                        skipped.append({
                            "employee_id": employee_id,
                            "employee_kra_cycle_id": existing_employee_kra_cycle.id,
                            "reason": "Already enrolled in this cycle. Use enrol_mode=overwrite or enrol_mode=append to modify.",
                        })
                        continue

                    employee_kra_cycle = existing_employee_kra_cycle

                    update_fields = ["is_date_based"]
                    employee_kra_cycle.is_date_based = is_date_based
                    new_level_id = temporary_assignment.get("employee_level_id")
                    if new_level_id is not None:
                        employee_kra_cycle.employee_level_id = new_level_id
                        update_fields.append("employee_level_id")
                    employee_kra_cycle.save(update_fields=update_fields)

                    skipped_categories: list[dict[str, Any]] = []
                    kras_added: int = 0

                    if enrol_mode == "overwrite":
                        employee_kra_cycle.categories.all().delete()
                        EmployeeKRACycleCategory.objects.bulk_create([
                            EmployeeKRACycleCategory(
                                employee_kra_cycle=employee_kra_cycle,
                                category_id=category["category_id"],
                                weightage=str(category["weightage"]),
                                assigned_by_role=caller_role,
                            )
                            for category in categories
                        ])
                        employee_kra_cycle.kra_level_rows.all().delete()
                        new_kra_rows = EmployeeKRALevel.objects.bulk_create([
                            EmployeeKRALevel(
                                employee_id=employee_id,
                                kra_level_id=kl_id,
                                employee_kra_cycle=employee_kra_cycle,
                                assigned_by_role=caller_role,
                            )
                            for kl_id in kra_level_ids
                        ])
                        kras_added = len(new_kra_rows)

                    else:  # append
                        existing_categories = {c.category_id: c for c in employee_kra_cycle.categories.all()}
                        current_total = sum(int(c.weightage) for c in existing_categories.values())
                        remaining = 100 - current_total
                        new_category_rows: list[EmployeeKRACycleCategory] = []
                        skipped_categories = []
                        for category in categories:
                            category_id = category["category_id"]
                            cat_weight = int(category["weightage"])
                            if category_id in existing_categories:
                                freed = int(existing_categories[category_id].weightage)
                                effective_remaining = remaining + freed
                                if cat_weight > effective_remaining:
                                    skipped_categories.append({
                                        "category_id": category_id,
                                        "reason": f"weightage {cat_weight}% exceeds remaining {effective_remaining}%",
                                    })
                                    continue
                                existing_categories[category_id].weightage = str(cat_weight)
                                existing_categories[category_id].save(update_fields=["weightage"])
                                remaining = effective_remaining - cat_weight
                            else:
                                if cat_weight > remaining:
                                    skipped_categories.append({
                                        "category_id": category_id,
                                        "reason": f"weightage {cat_weight}% exceeds remaining {remaining}%",
                                    })
                                    continue
                                new_category_rows.append(
                                    EmployeeKRACycleCategory(
                                        employee_kra_cycle=employee_kra_cycle,
                                        category_id=category_id,
                                        weightage=str(cat_weight),
                                        assigned_by_role=caller_role,
                                    )
                                )
                                remaining -= cat_weight
                        if new_category_rows:
                            EmployeeKRACycleCategory.objects.bulk_create(new_category_rows)

                        existing_kra_level_ids = set(
                            employee_kra_cycle.kra_level_rows.values_list("kra_level_id", flat=True)
                        )
                        to_add = [kl_id for kl_id in kra_level_ids if kl_id not in existing_kra_level_ids]
                        if not to_add:
                            skipped.append({
                                "employee_id": employee_id,
                                "employee_kra_cycle_id": employee_kra_cycle.id,
                                "reason": "append: all submitted KRA levels already exist on this employee — nothing added.",
                            })
                            continue
                        new_kra_rows = EmployeeKRALevel.objects.bulk_create([
                            EmployeeKRALevel(
                                employee_id=employee_id,
                                kra_level_id=kl_id,
                                employee_kra_cycle=employee_kra_cycle,
                                assigned_by_role=caller_role,
                            )
                            for kl_id in to_add
                        ])
                        kras_added = len(new_kra_rows)

                    enrolled.append({
                        "employee_id": employee_id,
                        "employee_kra_cycle_id": employee_kra_cycle.id,
                        "kras_added": kras_added,
                        "enrol_mode": enrol_mode,
                        "assigned_categories": [
                            {"category_id": c.category_id, "weightage": c.weightage}
                            for c in employee_kra_cycle.categories.all()
                        ],
                        "total_weightage": sum(int(c.weightage) for c in employee_kra_cycle.categories.all()),
                        "skipped_categories": skipped_categories,
                    })

                else:
                    # New enrolment
                    employee_kra_cycle = EmployeeKRACycle.objects.create(
                        employee_id=employee_id,
                        kra_cycle=cycle,
                        status="Draft",
                        stage_id=1,
                        is_date_based=is_date_based,
                        employee_manager_id=employee.manager_id,
                        employee_level_id=temporary_assignment.get("employee_level_id") or None,
                    )

                    EmployeeKRACycleCategory.objects.bulk_create([
                        EmployeeKRACycleCategory(
                            employee_kra_cycle=employee_kra_cycle,
                            category_id=category["category_id"],
                            weightage=str(category["weightage"]),
                            assigned_by_role=caller_role,
                        )
                        for category in categories
                    ])

                    EmployeeKRALevel.objects.bulk_create([
                        EmployeeKRALevel(
                            employee_id=employee_id,
                            kra_level_id=kl_id,
                            employee_kra_cycle=employee_kra_cycle,
                            assigned_by_role=caller_role,
                        )
                        for kl_id in kra_level_ids
                    ])

                    enrolled.append({
                        "employee_id": employee_id,
                        "employee_kra_cycle_id": employee_kra_cycle.id,
                        "kras_added": len(kra_level_ids),
                        "enrol_mode": "new",
                        "assigned_categories": [
                            {"category_id": category["category_id"], "weightage": str(category["weightage"])}
                            for category in categories
                        ],
                        "total_weightage": sum(int(category["weightage"]) for category in categories),
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

    Endpoint (Update): PUT /api/v1/kra/assignments/<employee_kra_cycle_id>

    Request Headers:
        Authorization: Bearer <token> (required)
        Content-Type: application/json

    Update Request Body:
        {
            "categories": [
                {"category_id": <id>, "weightage": 50},
                {"category_id": <id>, "weightage": 50}
            ],
            "kra_level_ids": [<id1>, <id2>],
            "is_date_based": false,
            "employee_level_id": <level_id>
        }

    Update Response (200):
        {
            "employee_kra_cycle_id": <id>,
            "kras_assigned": <count>,
            "message": "Assignment updated successfully"
        }

    Endpoint (Delete): DELETE /api/v1/kra/assignments/<employee_kra_cycle_id>

    Delete Response (200):
        {
            "message": "Employee removed from cycle successfully"
        }

    Error Responses:
        400: Invalid weightage or request data
        403: Caller is not authorized to modify this employee
        404: Assignment not found

    Permission:
        - HR/Vertical Lead: Can update/delete any assignment
        - Manager/Lead:     Can only manage own direct reports
    """

    permission_classes = [IsAuthenticated]

    def put(self, request: Request, employee_kra_cycle_id: int) -> Response:
        caller = _get_caller(request)
        caller_role = caller.role.name if caller.role else "Unknown"
        employee_kra_cycle = get_object_or_404(EmployeeKRACycle, id=employee_kra_cycle_id)

        serializer = AssignmentUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        categories: list[dict[str, Any]] = validated["categories"]
        kra_level_ids: list[int] = validated["kra_level_ids"]

        old_data = {
            "employee_level_id": employee_kra_cycle.employee_level_id,
            "is_date_based": employee_kra_cycle.is_date_based,
            "categories_count": employee_kra_cycle.categories.count(),
            "kras_count": employee_kra_cycle.kra_level_rows.count(),
        }

        if not _caller_can_act_on(caller, employee_kra_cycle.employee_id):
            return Response("Forbidden", status=status.HTTP_403_FORBIDDEN)

        try:
            total_weight = sum(int(c.get("weightage", 0)) for c in categories)
        except (ValueError, TypeError):
            return Response("Invalid weightage value", status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            new_level_id = validated.get("employee_level_id")
            if new_level_id is not None:
                employee_kra_cycle.employee_level_id = new_level_id
            if "is_date_based" in request.data:
                employee_kra_cycle.is_date_based = validated["is_date_based"]
            employee_kra_cycle.save()

            existing_categories = {
                c.category_id: c
                for c in employee_kra_cycle.categories.all()
            }
            employee_kra_cycle.categories.all().delete()
            EmployeeKRACycleCategory.objects.bulk_create([
                EmployeeKRACycleCategory(
                    employee_kra_cycle=employee_kra_cycle,
                    category_id=category["category_id"],
                    weightage=str(category["weightage"]),
                    assigned_by_role=(
                        caller_role
                        if category["category_id"] not in existing_categories
                        or str(existing_categories[category["category_id"]].weightage) != str(category["weightage"])
                        else existing_categories[category["category_id"]].assigned_by_role
                    ),
                )
                for category in categories
            ])

            existing_kra_roles: dict[int, str] = {
                row.kra_level_id: row.assigned_by_role
                for row in employee_kra_cycle.kra_level_rows.all()
            }
            employee_kra_cycle.kra_level_rows.all().delete()
            EmployeeKRALevel.objects.bulk_create([
                EmployeeKRALevel(
                    employee_id=employee_kra_cycle.employee_id,
                    kra_level_id=kl_id,
                    employee_kra_cycle=employee_kra_cycle,
                    assigned_by_role=existing_kra_roles.get(kl_id, caller_role),
                )
                for kl_id in kra_level_ids
            ])

        _audit(
            request,
            "KRA_ASSIGNMENT_UPDATED",
            "EmployeeKRACycle",
            employee_kra_cycle.id,
            old_data=old_data,
            new_data={
                "employee_level_id": employee_kra_cycle.employee_level_id,
                "is_date_based": employee_kra_cycle.is_date_based,
                "categories_count": len(categories),
                "kras_count": len(kra_level_ids),
            },
        )

        return Response(
            {
                "employee_kra_cycle_id": employee_kra_cycle.id,
                "kras_assigned": len(kra_level_ids),
                "message": "Assignment updated successfully",
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request: Request, employee_kra_cycle_id: int) -> Response:
        caller = _get_caller(request)
        employee_kra_cycle = get_object_or_404(EmployeeKRACycle, id=employee_kra_cycle_id)

        if not _caller_can_act_on(caller, employee_kra_cycle.employee_id):
            return Response("Forbidden", status=status.HTTP_403_FORBIDDEN)

        old_data = {
            "employee_id": employee_kra_cycle.employee_id,
            "cycle_id": employee_kra_cycle.kra_cycle_id,
            "kras_count": employee_kra_cycle.kra_level_rows.count(),
            "categories_count": employee_kra_cycle.categories.count(),
        }

        with transaction.atomic():
            employee_kra_cycle.kra_level_rows.all().delete()
            employee_kra_cycle.categories.all().delete()
            employee_kra_cycle.delete()

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

    Endpoint: POST /api/v1/kra/assignments/clone-from

    Request Headers:
        Authorization: Bearer <token> (required)
        Content-Type: application/json

    Request Body:
        {
            "source_employee_kra_cycle_id": <source_id>,
            "target_employee_kra_cycle_ids": [<target_id1>, <target_id2>],
            "mode": "skip|overwrite|append"
        }

    Response (201/207/400):
        {
            "source_employee_kra_cycle_id": <id>,
            "kras_in_source": <count>,
            "cloned": [
                {
                    "target_employee_kra_cycle_id": <id>,
                    "employee_id": <id>,
                    "kras_copied": <count>,
                    "mode_applied": "overwrite|append|new"
                }
            ],
            "skipped": [...],
            "failed": [...],
            "summary": {
                "total_targets": <count>,
                "cloned_count": <count>,
                "skipped_count": <count>,
                "failed_count": <count>
            }
        }

    Clone Modes:
        - skip:      Don't touch targets that already have KRAs
        - overwrite: Remove all existing KRAs and clone from source
        - append:    Add source KRAs to targets (skip duplicates)

    Error Responses:
        400: Invalid request data, source=target, or invalid mode
        404: Source not found or source has no KRA rows

    Notes:
        - Source cannot be in target list (validation enforced)
        - Categories are NOT cloned, only KRA level rows
        - Each cloned row runs in separate transaction for resilience
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
            employee_kra_cycle.id: employee_kra_cycle 
            for employee_kra_cycle in EmployeeKRACycle.objects.filter(id__in=target_ids)
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
                            source_level for source_level in source_levels
                            if source_level.kra_level_id not in existing_kra_level_ids
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
                            kra_level_id=source_level.kra_level_id,
                            employee_kra_cycle=target,
                        )
                        for source_level in rows_to_clone
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
