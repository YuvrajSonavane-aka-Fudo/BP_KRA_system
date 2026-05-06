from collections import defaultdict
from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
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

HR_ROLES = {"Admin", "HR", "Vertical Lead"}
LEAD_ROLES = {"Manager", "Team Lead"}
EMPLOYEE_ROLE = "Employee"


def _get_caller(request):
    return request.user


def _is_hr(employee):
    # Check bridge table first, fall back to direct role FK
    if employee.employee_roles.filter(role__name__in=HR_ROLES).exists():
        return True
    return bool(employee.role and employee.role.name in HR_ROLES)


def _is_lead(employee):
    # Check bridge table first, fall back to direct role FK
    if employee.employee_roles.filter(role__name__in=LEAD_ROLES).exists():
        return True
    return bool(employee.role and employee.role.name in LEAD_ROLES)


def _caller_can_act_on(caller, target_employee_id):
    if _is_hr(caller):
        return True
    return Employee.objects.filter(id=target_employee_id, manager_id=caller.id).exists()


def _audit(request, action, entity, entity_id, old_data=None, new_data=None):
    AuditLog.objects.create(
        employee=_get_caller(request),
        action=action,
        entity=entity,
        entity_id=entity_id,
        old_data=old_data,
        new_data=new_data,
        ip_address=request.META.get("REMOTE_ADDR"),
    )


class EmployeeListView(APIView):
    """
    GET /api/v1/employees?cycle_id=
    HR / VL → all active employees.
    Lead / Manager → only direct reports (manager_id = caller.id).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        caller = _get_caller(request)
        cycle_id = request.query_params.get("cycle_id")

        qs = Employee.objects.filter(active=True).select_related("department", "level").prefetch_related("employee_roles")

        if not _is_hr(caller):
            # Only direct reports
            qs = qs.filter(manager_id=caller.id)

        # Pre-fetch cycle assignments in one query if cycle_id provided


        # cycle_map = {}
        # kra_map = {}  # employee_id → [kra_level_id, ...]
        # if cycle_id:
        #     for ekc in EmployeeKRACycle.objects.filter(kra_cycle_id=cycle_id).values('employee_id', 'id'):
        #         cycle_map[ekc['employee_id']] = ekc['id']

        #     for ekl in EmployeeKRALevel.objects.filter(
        #         employee_kra_cycle_id__in=cycle_map.values()
        #     ).values('employee_id', 'kra_level_id', 'kra_level__kra_id','kra_level__name'):
        #         kra_map.setdefault(ekl['employee_id'], []).append({
        #             'kra_level_id': ekl['kra_level_id'],
        #             'kra_id' : ekl['kra_level__kra_id'],
        #             'name':         ekl['kra_level__name'],
        #         })
        cycle_map = {}   # employee_id → employee_kra_cycle_id
        kra_map   = {}   # employee_id → [...]
        category_map = {} 

        if cycle_id:
            for ekc in EmployeeKRACycle.objects.filter(
                kra_cycle_id=cycle_id
            ).values('employee_id', 'id'):
                cycle_map[ekc['employee_id']] = ekc['id']

            # Invert cycle_map so we can look up employee_id from ekc_id
            ekc_to_emp = {v: k for k, v in cycle_map.items()}

            for ekl in EmployeeKRALevel.objects.filter(
                employee_kra_cycle_id__in=cycle_map.values()
            ).values('employee_kra_cycle_id', 'kra_level_id', 'kra_level__kra_id', 'kra_level__kra__name').distinct():
                emp_id = ekc_to_emp.get(ekl['employee_kra_cycle_id'])
                if emp_id is None:
                    continue
                kra_map.setdefault(emp_id, []).append({
                    'kra_level_id': ekl['kra_level_id'],
                    'kra_id':       ekl['kra_level__kra_id'],
                    'name':         ekl['kra_level__kra__name'],
                })
        for ekc_cat in EmployeeKRACycleCategory.objects.filter(
                employee_kra_cycle_id__in=cycle_map.values()
            ).values('employee_kra_cycle_id', 'category_id', 'weightage'):
                emp_id = ekc_to_emp.get(ekc_cat['employee_kra_cycle_id'])
                if emp_id is None:
                    continue
                category_map.setdefault(emp_id, []).append({
                    'category_id': ekc_cat['category_id'],
                    'weightage':   ekc_cat['weightage'],
                })
        employees = []
        for e in qs:
            employees.append(
                {
                    "employee_id": e.id,
                    "full_name": f"{e.first_name} {e.last_name}",
                    "email": e.email,
                    "title": e.title,
                    "department": (
                        e.department.department_name if e.department else None
                    ),
                    "level": e.level.name if e.level else None,
                    "manager_id": e.manager_id,
                    "roles": list(e.employee_roles.values_list("name", flat=True)),
                    "assigned_to_cycle": e.id in cycle_map,
                    "employee_kra_cycle_id": cycle_map.get(e.id),
                    'assigned_categories': category_map.get(e.id, []),  # ← add this
                    'assigned_kras': kra_map.get(e.id, []),
                }
            )

        return Response({"employees": employees}, status=status.HTTP_200_OK)


class KRABulkAssignmentEnrolView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, cycle_id):
        caller = _get_caller(request)
        data = request.data

        assignments = data.get("assignments", [])
        shared = data.get("shared")
        enrol_mode = data.get("enrol_mode", "skip")

        if enrol_mode not in ("skip", "overwrite", "append"):
            return Response(
                {"error": "enrol_mode must be one of: 'skip', 'overwrite', 'append'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not assignments:
            return Response(
                {"error": "assignments list is required and cannot be empty"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cycle = get_object_or_404(KRACycle, id=cycle_id, is_deleted=False)

        # 1. Collect all employee IDs
        employee_ids = []
        for idx, a in enumerate(assignments):
            eid = a.get("employee_id")
            if not eid:
                return Response(
                    {"error": f"assignments[{idx}] is missing employee_id"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            employee_ids.append(eid)

        # 2. Verify caller permissions
        unauthorized = [
            eid for eid in employee_ids if not _caller_can_act_on(caller, eid)
        ]
        if unauthorized:
            return Response(
                {
                    "error": "You do not have permission to assign KRAs to these employees",
                    "unauthorized_employee_ids": unauthorized,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # 3. Find already enrolled employees
        already_enrolled = {
            ekc.employee_id: ekc
            for ekc in EmployeeKRACycle.objects.filter(
                kra_cycle_id=cycle_id,
                employee_id__in=employee_ids,
            )
        }

        # 4. Bulk-fetch employee records
        employee_map = {
            e.id: e
            for e in Employee.objects.filter(id__in=employee_ids).select_related("manager")
        }

        # 5. Validate shared weightage once if Mode A
        if shared:
            shared_categories = shared.get("categories", [])
            shared_kra_level_ids = shared.get("kra_level_ids", [])       # legacy / test format
            shared_kra_selections = shared.get("kra_selections", [])      # new frontend format
            shared_is_date_based = shared.get("is_date_based", False)
    

            try:
                shared_weight = sum(
                    int(c.get("weightage", 0)) for c in shared_categories
                )
            except (ValueError, TypeError):
                return Response(
                    {"error": "shared.categories contains an invalid weightage value"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            

        # Process each assignment
        enrolled = []
        skipped = []
        failed = []

        with transaction.atomic():
            for a in assignments:
                eid = a["employee_id"]

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
                        employee_level_id = a.get("employee_level_id")
                        kra_level_ids = []
                        for sel in shared_kra_selections:
                            kra_id = sel.get("kra_id")
                            level_id = sel.get("kra_level_id")  # this is actually seniority level_id

                            # Look up the correct KRALevel row using kra_id + seniority level_id
                            match = KRALevel.objects.filter(
                                kra_id=kra_id,
                                level_id=level_id,
                            ).values_list("id", flat=True).first()

                            if match:
                                kra_level_ids.append(match)
                            else:
                                # No exact match — skip this selection and log it
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
                        total_weight = sum(
                            int(c.get("weightage", 0)) for c in categories
                        )
                    except (ValueError, TypeError):
                        failed.append({"employee_id": eid, "reason": "Invalid weightage value in categories"})
                        continue
                    

                existing_ekc = already_enrolled.get(eid)

                if existing_ekc:
                    if enrol_mode == "skip":
                        skipped.append(
                            {
                                "employee_id": eid,
                                "employee_kra_cycle_id": existing_ekc.id,
                                "reason": "Already enrolled in this cycle. Use enrol_mode=overwrite or enrol_mode=append to modify.",
                            }
                        )
                        continue

                    ekc = existing_ekc

                    # Update scalar fields
                    update_fields = ["is_date_based"]
                    ekc.is_date_based = is_date_based
                    new_level_id = a.get("employee_level_id")
                    if new_level_id is not None:
                        ekc.employee_level_id = new_level_id
                        update_fields.append("employee_level_id")
                    ekc.save(update_fields=update_fields)

                    skipped_cats = []
                    kras_added = 0  
                    if enrol_mode == "overwrite":
                        ekc.categories.all().delete()
                        EmployeeKRACycleCategory.objects.bulk_create(
                            [
                                EmployeeKRACycleCategory(
                                    employee_kra_cycle=ekc,
                                    category_id=cat["category_id"],
                                    weightage=str(cat["weightage"]),
                                )
                                for cat in categories
                            ]
                        )

                        ekc.kra_level_rows.all().delete()
                        new_kra_rows = EmployeeKRALevel.objects.bulk_create(
                            [
                                EmployeeKRALevel(
                                    employee_id=eid,
                                    kra_level_id=kl_id,
                                    employee_kra_cycle=ekc,
                                )
                                for kl_id in kra_level_ids
                            ]
                        )
                        kras_added = len(new_kra_rows)

                    else:  # append
                        existing_cats = {c.category_id: c for c in ekc.categories.all()}
                        current_total = sum(int(c.weightage) for c in existing_cats.values())
                        remaining = 100 - current_total
                        new_cat_rows = []
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
                                    )
                                )
                                remaining -= cat_weight
                        if new_cat_rows:
                            EmployeeKRACycleCategory.objects.bulk_create(new_cat_rows)

                        # KRA levels: add only those not already present
                        existing_kra_level_ids = set(
                            ekc.kra_level_rows.values_list("kra_level_id", flat=True)
                        )
                        to_add = [
                            kl_id for kl_id in kra_level_ids
                            if kl_id not in existing_kra_level_ids
                        ]
                        if not to_add:
                            skipped.append(
                                {
                                    "employee_id": eid,
                                    "employee_kra_cycle_id": ekc.id,
                                    "reason": "append: all submitted KRA levels already exist on this employee — nothing added.",
                                }
                            )
                            continue
                        new_kra_rows = EmployeeKRALevel.objects.bulk_create(
                            [
                                EmployeeKRALevel(
                                    employee_id=eid,
                                    kra_level_id=kl_id,
                                    employee_kra_cycle=ekc,
                                )
                                for kl_id in to_add
                            ]
                        )
                        kras_added = len(new_kra_rows)

                    enrolled.append(
                        {
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
                        }
                    )

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

                    EmployeeKRACycleCategory.objects.bulk_create(
                        [
                            EmployeeKRACycleCategory(
                                employee_kra_cycle=ekc,
                                category_id=cat["category_id"],
                                weightage=str(cat["weightage"]),
                            )
                            for cat in categories
                        ]
                    )

                    EmployeeKRALevel.objects.bulk_create(
                        [
                            EmployeeKRALevel(
                                employee_id=eid,
                                kra_level_id=kl_id,
                                employee_kra_cycle=ekc,
                            )
                            for kl_id in kra_level_ids
                        ]
                    )

                    enrolled.append(
                    {
                        "employee_id": eid,
                        "employee_kra_cycle_id": ekc.id,
                        "kras_added": len(kra_level_ids),
                        "enrol_mode": "new",
                        "assigned_categories": [
                            {"category_id": cat["category_id"], "weightage": str(cat["weightage"])}
                            for cat in categories
                        ],
                        "total_weightage": sum(int(cat["weightage"]) for cat in categories),
                    }
                )

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
    PUT    /api/v1/kra/assignments/{employee_kra_cycle_id}  – update (Stage 1 only)
    DELETE /api/v1/kra/assignments/{employee_kra_cycle_id}  – remove (Stage 1 only)
    """

    permission_classes = [IsAuthenticated]

    #  10. Update
    def put(self, request, employee_kra_cycle_id):
        caller = _get_caller(request)
        ekc = get_object_or_404(EmployeeKRACycle, id=employee_kra_cycle_id)
        data = request.data
        categories = data.get("categories", [])
        kra_level_ids = data.get("kra_level_ids", [])

        old_data = {
            "employee_level_id": ekc.employee_level_id,
            "is_date_based": ekc.is_date_based,
            "categories_count": ekc.categories.count(),
            "kras_count": ekc.kra_level_rows.count(),
        }

        if not _caller_can_act_on(caller, ekc.employee_id):
            return Response("Forbidden", status=status.HTTP_403_FORBIDDEN)

        if ekc.stage_id != 1:
            return Response(
                "Assignments cannot be modified after Stage 1",
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            total_weight = sum(int(c.get("weightage", 0)) for c in categories)
        except (ValueError, TypeError):
            return Response(
                "Invalid weightage value", status=status.HTTP_400_BAD_REQUEST
            )

        

        with transaction.atomic():
            new_level_id = data.get("employee_level_id")
            if new_level_id is not None:
                ekc.employee_level_id = new_level_id
            if "is_date_based" in data:
                ekc.is_date_based = data["is_date_based"]
            ekc.save()

            # Replace categories
            ekc.categories.all().delete()  # related_name on EmployeeKRACycleCategory
            EmployeeKRACycleCategory.objects.bulk_create(
                [
                    EmployeeKRACycleCategory(
                        employee_kra_cycle=ekc,
                        category_id=cat["category_id"],
                        weightage=str(cat["weightage"]),
                    )
                    for cat in categories
                ]
            )

            # Replace KRA level rows
            ekc.kra_level_rows.all().delete()  # related_name on EmployeeKRALevel
            EmployeeKRALevel.objects.bulk_create(
                [
                    EmployeeKRALevel(
                        employee_id=ekc.employee_id,
                        kra_level_id=kl_id,
                        employee_kra_cycle=ekc,
                    )
                    for kl_id in kra_level_ids
                ]
            )
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

    # 12. Remove
    def delete(self, request, employee_kra_cycle_id):
        caller = _get_caller(request)
        ekc = get_object_or_404(EmployeeKRACycle, id=employee_kra_cycle_id)

        if not _caller_can_act_on(caller, ekc.employee_id):
            return Response("Forbidden", status=status.HTTP_403_FORBIDDEN)

        if ekc.stage_id != 1:
            return Response(
                "Cannot remove after Stage 1", status=status.HTTP_400_BAD_REQUEST
            )

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
    POST /api/v1/kra/assignments/clone-from

    Clones KRA level rows from one source enrolment into one or more targets.
    Ratings and comments are intentionally nulled on every clone.

    Request body:
        {
            "source_employee_kra_cycle_id": 8,
            "target_employee_kra_cycle_ids": [12, 15, 19],
            "mode": "append"        ← optional, default is "skip"
        }

    mode options:
        "skip"      – (default) skip targets that already have KRA rows
        "append"    – add only the KRA rows not already present on the target
        "overwrite" – delete all existing KRA rows on target then clone fresh
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        source_id = request.data.get("source_employee_kra_cycle_id")
        target_ids = request.data.get("target_employee_kra_cycle_ids", [])
        mode = request.data.get("mode", "skip")

        # Validate inputs
        if not source_id:
            return Response(
                {"error": "source_employee_kra_cycle_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not target_ids:
            return Response(
                {
                    "error": "target_employee_kra_cycle_ids is required and cannot be empty"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(target_ids, list):
            return Response(
                {"error": "target_employee_kra_cycle_ids must be a list"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if mode not in ("skip", "overwrite", "append"):
            return Response(
                {"error": "mode must be one of: 'skip', 'overwrite', 'append'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if source_id in target_ids:
            return Response(
                {"error": "source cannot also be a target"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Fetch source KRA rows
        source_levels = list(
            EmployeeKRALevel.objects.filter(employee_kra_cycle_id=source_id)
        )
        if not source_levels:
            return Response(
                {
                    "error": f"Source assignment {source_id} not found or has no KRA rows"
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # Validate all target IDs exist up front
        existing_targets = {
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

        #  Process each target independently
        cloned = []
        skipped = []
        failed = []

        for target_id in target_ids:
            target = existing_targets[target_id]
            existing_rows = target.kra_level_rows.count()

            # mode=skip: protect targets that already have rows
            if existing_rows and mode == "skip":
                skipped.append(
                    {
                        "target_employee_kra_cycle_id": target_id,
                        "reason": f"Already has {existing_rows} KRA row(s). Use mode=overwrite or mode=append.",
                    }
                )
                continue

            try:
                with transaction.atomic():

                    if mode == "overwrite" and existing_rows:
                        # Wipe everything and start fresh
                        target.kra_level_rows.all().delete()
                        rows_to_clone = source_levels

                    elif mode == "append" and existing_rows:
                        # Only clone KRA levels not already present on the target
                        existing_kra_level_ids = set(
                            target.kra_level_rows.values_list("kra_level_id", flat=True)
                        )
                        rows_to_clone = [
                            sl
                            for sl in source_levels
                            if sl.kra_level_id not in existing_kra_level_ids
                        ]
                        if not rows_to_clone:
                            skipped.append(
                                {
                                    "target_employee_kra_cycle_id": target_id,
                                    "reason": "All source KRA rows already exist on this target — nothing to append.",
                                }
                            )
                            continue

                    else:
                        # mode=overwrite with no existing rows,
                        # mode=append with no existing rows,
                        # mode=skip with no existing rows — just clone everything
                        rows_to_clone = source_levels

                    new_rows = EmployeeKRALevel.objects.bulk_create(
                        [
                            EmployeeKRALevel(
                                employee_id=target.employee_id,
                                kra_level_id=sl.kra_level_id,
                                employee_kra_cycle=target,
                                # Ratings and notes intentionally left null on clone
                            )
                            for sl in rows_to_clone
                        ]
                    )

                cloned.append(
                    {
                        "target_employee_kra_cycle_id": target_id,
                        "employee_id": target.employee_id,
                        "kras_copied": len(new_rows),
                        "mode_applied": mode,
                    }
                )

            except Exception as exc:
                failed.append(
                    {
                        "target_employee_kra_cycle_id": target_id,
                        "reason": str(exc),
                    }
                )

        # Single audit entry covering the whole operation
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
                "cloned_target_ids": [
                    c["target_employee_kra_cycle_id"] for c in cloned
                ],
                "skipped_target_ids": [
                    s["target_employee_kra_cycle_id"] for s in skipped
                ],
                "failed_target_ids": [
                    f["target_employee_kra_cycle_id"] for f in failed
                ],
            },
        )

        # Pick the right HTTP status
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
