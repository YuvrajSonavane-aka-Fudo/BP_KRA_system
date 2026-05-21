from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from datetime import datetime, date, time
from django.utils.timezone import make_aware
import threading
from django.conf import settings
from django.core.mail import send_mail

from .models import (
    Employee,
    KRACycle,
    KRACycleStage,
    EmployeeKRACycle,
    EmployeeKRACycleStage,
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


def _clone_assignments(source_cycle, new_cycle, caller):
    """
    Clones all EmployeeKRACycle rows (+ their categories and KRA level rows)
    from source_cycle into new_cycle.

    Returns a dict with enrolled / skipped / needs_review lists and a summary.
    """

    #  Fetch all source enrolments with related data in as few queries as possible
    source_ekcs = list(
        EmployeeKRACycle.objects.filter(kra_cycle=source_cycle).select_related(
            "employee__manager", "employee__level", "employee__role"
        )
    )

    if not source_ekcs:
        return {
            "enrolled": [],
            "skipped": [],
            "needs_review": [],
            "summary": {"total": 0, "enrolled": 0, "skipped": 0, "needs_review": 0},
        }

    source_ekc_ids = [ekc.id for ekc in source_ekcs]
    source_emp_ids = [ekc.employee_id for ekc in source_ekcs]

    # Pre-flight: fetch all categories and KRA levels in bulk

    # All category rows across all source enrolments
    all_source_cats = list(
        EmployeeKRACycleCategory.objects.filter(
            employee_kra_cycle_id__in=source_ekc_ids
        )
    )
    # Group by ekc_id for fast lookup
    cats_by_ekc = {}
    for cat in all_source_cats:
        cats_by_ekc.setdefault(cat.employee_kra_cycle_id, []).append(cat)

    # All KRA level rows across all source enrolments
    all_source_kra_rows = list(
        EmployeeKRALevel.objects.filter(employee_kra_cycle_id__in=source_ekc_ids)
    )
    kra_rows_by_ekc = {}
    for row in all_source_kra_rows:
        kra_rows_by_ekc.setdefault(row.employee_kra_cycle_id, []).append(row)

    #  Validate which category_ids and kra_level_ids still exist in DB

    all_cat_ids = {cat.category_id for cat in all_source_cats}
    all_kra_level_ids = {row.kra_level_id for row in all_source_kra_rows}

    valid_cat_ids = set(
        KRACategory.objects.filter(id__in=all_cat_ids).values_list("id", flat=True)
    )
    valid_kra_level_ids = set(
        KRALevel.objects.filter(id__in=all_kra_level_ids).values_list("id", flat=True)
    )

    # Find employees already enrolled in the NEW cycle
    already_in_new_cycle = set(
        EmployeeKRACycle.objects.filter(
            kra_cycle=new_cycle,
            employee_id__in=source_emp_ids,
        ).values_list("employee_id", flat=True)
    )

    #  Process each source enrolment
    enrolled = []
    skipped = []
    needs_review = []

    # Track role changes for informational purposes
    def _current_roles(emp):
        return list(emp.employee_roles.values_list("name", flat=True))

    with transaction.atomic():
        for src_ekc in source_ekcs:
            emp = src_ekc.employee
            eid = src_ekc.employee_id

            # Case: employee deleted
            if emp is None:
                skipped.append(
                    {
                        "employee_id": eid,
                        "reason": "Employee record no longer exists",
                    }
                )
                continue

            #  Case: employee inactive
            if not emp.active:
                skipped.append(
                    {
                        "employee_id": eid,
                        "full_name": f"{emp.first_name} {emp.last_name}",
                        "reason": "Employee is no longer active",
                    }
                )
                continue

            # Case: already enrolled in new cycle
            if eid in already_in_new_cycle:
                skipped.append(
                    {
                        "employee_id": eid,
                        "full_name": f"{emp.first_name} {emp.last_name}",
                        "reason": "Already enrolled in the new cycle (manually added)",
                    }
                )
                continue

            # Case: caller is Lead — only clone their direct reports
            if not _is_hr(caller):
                if emp.manager_id != caller.id:
                    skipped.append(
                        {
                            "employee_id": eid,
                            "full_name": f"{emp.first_name} {emp.last_name}",
                            "reason": "Not your direct report",
                        }
                    )
                    continue

            #  Case: manager changed — use current manager
            current_manager_id = emp.manager_id  # always use fresh value
            manager_changed = current_manager_id != src_ekc.employee_manager_id

            #  Case: level changed — use current level
            current_level_id = emp.level_id  # always use fresh value
            level_changed = current_level_id != src_ekc.employee_level_id

            #  Case: role changed — note it but don't block
            current_roles = _current_roles(emp)
            role_changed = False
            # (informational only — we still enrol)

            #  Resolve categories for this employee
            source_cats = cats_by_ekc.get(src_ekc.id, [])
            valid_cats = [c for c in source_cats if c.category_id in valid_cat_ids]
            invalid_cats = [
                c.category_id for c in source_cats if c.category_id not in valid_cat_ids
            ]

            # Recalculate weightage after dropping invalid categories
            try:
                remaining_weight = sum(int(c.weightage or 0) for c in valid_cats)
            except (ValueError, TypeError):
                remaining_weight = 0

            # Case: dropped categories broke weightage
            if invalid_cats and remaining_weight != 100:
                needs_review.append(
                    {
                        "employee_id": eid,
                        "full_name": f"{emp.first_name} {emp.last_name}",
                        "reason": "Category weightage no longer sums to 100 after removing deleted categories",
                        "invalid_category_ids": invalid_cats,
                        "remaining_weightage": remaining_weight,
                        "action": "Please manually re-assign this employee with corrected weightages",
                    }
                )
                continue

            #  Resolve KRA level rows for this employee
            source_kra_rows = kra_rows_by_ekc.get(src_ekc.id, [])
            valid_kra_rows = [
                r for r in source_kra_rows if r.kra_level_id in valid_kra_level_ids
            ]
            dropped_kra_ids = [
                r.kra_level_id
                for r in source_kra_rows
                if r.kra_level_id not in valid_kra_level_ids
            ]

            # Create the new EmployeeKRACycle
            new_ekc = EmployeeKRACycle.objects.create(
                employee_id=eid,
                kra_cycle=new_cycle,
                status="Draft",
                stage_id=1,
                is_date_based=src_ekc.is_date_based,
                employee_manager_id=current_manager_id,  # ← always fresh
                employee_level_id=current_level_id,  # ← always fresh
            )

            # Clone category weightages
            EmployeeKRACycleCategory.objects.bulk_create(
                [
                    EmployeeKRACycleCategory(
                        employee_kra_cycle=new_ekc,
                        category_id=cat.category_id,
                        weightage=cat.weightage,
                    )
                    for cat in valid_cats
                ]
            )

            # Clone KRA level rows (ratings always nulled)
            EmployeeKRALevel.objects.bulk_create(
                [
                    EmployeeKRALevel(
                        employee_id=eid,
                        kra_level_id=row.kra_level_id,
                        employee_kra_cycle=new_ekc,
                        # All assessment fields intentionally null on clone
                    )
                    for row in valid_kra_rows
                ]
            )

            enrolled.append(
                {
                    "employee_id": eid,
                    "full_name": f"{emp.first_name} {emp.last_name}",
                    "employee_kra_cycle_id": new_ekc.id,
                    "kras_cloned": len(valid_kra_rows),
                    "kras_dropped": dropped_kra_ids,  # kra_levels that no longer exist
                    "categories_dropped": invalid_cats,  # categories that no longer exist
                    "manager_updated": manager_changed,
                    "level_updated": level_changed,
                }
            )

    return {
        "enrolled": enrolled,
        "skipped": skipped,
        "needs_review": needs_review,
        "summary": {
            "total": len(source_ekcs),
            "enrolled": len(enrolled),
            "skipped": len(skipped),
            "needs_review": len(needs_review),
        },
    }


def _parse_date(value):
    """Accepts '2026-05-13' or '2026-05-13T00:00:00', always returns aware datetime."""
    try:
        d = date.fromisoformat(value)  # handles date-only strings
        return make_aware(datetime.combine(d, time.min))
    except ValueError:
        return make_aware(datetime.fromisoformat(value.replace("Z", "")))


def send_stage_override_email(employee, cycle, stage_data):
    """
    Sends email for single stage override update.
    Shows only Stage ID (no stage name lookup).
    """

    try:

        if not employee.email:
            return

        subject = f"KRA Stage Dates Updated - {cycle.name}"

        message = f"""
                Hi {employee.first_name},

                The dates for a KRA stage have been updated for the cycle:

                {cycle.name}

                Your stage has been changed

                Please login to the KRA portal to review the updated schedule.

                Regards,
                HR Team
                """

        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[employee.email],
            fail_silently=False,  # set True only after debugging
        )

    except Exception as e:
        print(f"Failed to send stage override email: {str(e)}")


# 1. Authentication


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        email = request.data.get("email", "").strip()
        password = request.data.get("password", "")

        if not email or not password:
            return Response(
                {"error": "Please provide both email and password"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            employee = Employee.objects.select_related("department", "role").get(
                email=email
            )
        except Employee.DoesNotExist:
            return Response(
                {"error": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if employee.password != password:
            return Response(
                {"error": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not employee.active:
            return Response(
                {"error": "Account is inactive"},
                status=status.HTTP_403_FORBIDDEN,
            )

        request.session["employee_id"] = employee.id
        request.session.save()

        # Audit — use employee directly since request.user is not set yet at login
        AuditLog.objects.create(
            employee=employee,
            action="LOGIN",
            entity="Employee",
            entity_id=employee.id,
            old_data=None,
            new_data={"email": employee.email},
            ip_address=request.META.get("REMOTE_ADDR"),
        )

        return Response(
            {
                "session_id": request.session.session_key,
                "employee_id": employee.id,
                "roles": [employee.role.name] if employee.role else [],
                "full_name": f"{employee.first_name} {employee.last_name}",
                "department": (
                    employee.department.department_name if employee.department else None
                ),
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        employee_id = request.session.get("employee_id")

        # Audit before flushing session
        if employee_id:
            AuditLog.objects.create(
                employee_id=employee_id,
                action="LOGOUT",
                entity="Employee",
                entity_id=employee_id,
                old_data=None,
                new_data=None,
                ip_address=request.META.get("REMOTE_ADDR"),
            )

        request.session.flush()
        return Response(
            {"message": "Logged out successfully"},
            status=status.HTTP_200_OK,
        )


# 2 & 3. KRA Cycle — List & Create


class KRACycleListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        caller = _get_caller(request)
        status_filter = request.query_params.get("status")

        if _is_hr(caller):
            qs = (
                KRACycle.objects.filter(is_deleted=False)
                .select_related("stage")
                .prefetch_related("cycle_stages__stage")
            )
        else:
            qs = (
                KRACycle.objects.filter(
                    is_deleted=False,
                    status="ACTIVE",
                    employee_cycles__employee=caller,
                )
                .select_related("stage")
                .prefetch_related("cycle_stages__stage")
                .distinct()
            )

        if status_filter:
            qs = qs.filter(status=status_filter)

        cycles = [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "start_date": c.start_date,
                "end_date": c.end_date,
                "status": c.status,
                "current_stage": (
                    {"id": c.stage.id, "name": c.stage.name} if c.stage else None
                ),
                "cycle_stages": [
                    {
                        "stage_id": cs.stage.id,
                        "start_date": cs.start_date,
                        "end_date": cs.end_date,
                    }
                    for cs in c.cycle_stages.filter(is_deleted=False).order_by("id")
                ],
            }
            for c in qs
        ]
        return Response({"cycles": cycles}, status=status.HTTP_200_OK)

    def post(self, request):
        caller = _get_caller(request)
        data = request.data

        for field in ("name", "start_date", "end_date", "stages"):
            if field not in data:
                return Response(
                    {"error": f"Missing required field: {field}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        stages_data = data["stages"]

        if not stages_data:
            return Response(
                {"error": "stages cannot be empty"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stage_ids = [s["stage_id"] for s in stages_data]
        existing_stages = Stage.objects.filter(id__in=stage_ids)

        if existing_stages.count() != len(stage_ids):
            found_ids = set(existing_stages.values_list("id", flat=True))
            missing_ids = set(stage_ids) - found_ids
            return Response(
                {"error": f"Invalid stage_id(s): {list(missing_ids)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stage_map = {s.id: s for s in existing_stages}

        try:
            cycle_start = _parse_date(data["start_date"])
            cycle_end = _parse_date(data["end_date"])
        except (ValueError, AttributeError):
            return Response(
                {"error": "Invalid date format. Use YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            first_stage = stage_map[stages_data[0]["stage_id"]]

            cycle = KRACycle.objects.create(
                name=data["name"],
                description=data.get("description", ""),
                start_date=cycle_start,
                end_date=cycle_end,
                status="DRAFT",
                stage=first_stage,
                is_deleted=False,
            )

            for s in stages_data:
                for field in ("stage_id", "start_date", "end_date"):
                    if field not in s:
                        raise ValueError(f"Missing {field} in stages entry")

                try:
                    stage_start = _parse_date(s["start_date"])
                    stage_end = _parse_date(s["end_date"])
                except (ValueError, AttributeError):
                    raise ValueError(f"Invalid date format in stage {s['stage_id']}")

                KRACycleStage.objects.create(
                    kra_cycle=cycle,
                    stage=stage_map[s["stage_id"]],
                    start_date=stage_start,
                    end_date=stage_end,
                    is_deleted=False,
                )

        _audit(
            request,
            "CYCLE_CREATED",
            "KRACycle",
            cycle.id,
            old_data=None,
            new_data={
                "name": cycle.name,
                "start_date": str(cycle.start_date),
                "end_date": str(cycle.end_date),
                "status": cycle.status,
                "stages": stage_ids,
                "created_by": caller.email,
            },
        )

        return Response(
            {
                "id": cycle.id,
                "name": cycle.name,
                "status": cycle.status,
                "stage": {"id": first_stage.id, "name": first_stage.name},
                "stages_count": len(stages_data),
            },
            status=status.HTTP_201_CREATED,
        )


# 4. KRA Cycle — Update Status / Soft Delete


class KRACycleUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    VALID_TRANSITIONS = {
        "DRAFT": ["ACTIVE"],
        "ACTIVE": ["ON_HOLD", "CLOSED", "CANCELLED"],
        "ON_HOLD": ["ACTIVE", "CANCELLED"],
        "INACTIVE": ["ACTIVE", "CANCELLED"],
        "CLOSED": [],
        "CANCELLED": [],
    }

    def get(self, request, cycle_id):
        cycle = get_object_or_404(KRACycle, id=cycle_id, is_deleted=False)
        return Response(
            {
                "id": cycle.id,
                "name": cycle.name,
                "description": cycle.description,
                "start_date": cycle.start_date,
                "end_date": cycle.end_date,
                "status": cycle.status,
                "current_stage": (
                    {"id": cycle.stage.id, "name": cycle.stage.name}
                    if cycle.stage
                    else None
                ),
                "cycle_stages": [
                    {
                        "stage_id": cs.stage.id,
                        "start_date": cs.start_date,
                        "end_date": cs.end_date,
                    }
                    for cs in cycle.cycle_stages.filter(is_deleted=False)
                    .select_related("stage")
                    .order_by("id")
                ],
            },
            status=status.HTTP_200_OK,
        )

    def patch(self, request, cycle_id):
        caller = _get_caller(request)

        if not _is_hr(caller):
            return Response(
                {"error": "Only HR can update cycles"},
                status=status.HTTP_403_FORBIDDEN,
            )

        cycle = get_object_or_404(KRACycle, id=cycle_id, is_deleted=False)

        old_status = cycle.status
        old_is_deleted = cycle.is_deleted

        new_status = request.data.get("status")
        is_deleted = request.data.get("is_deleted")

        if new_status:
            allowed = self.VALID_TRANSITIONS.get(cycle.status, [])
            if new_status not in allowed:
                return Response(
                    {
                        "error": f"Invalid status transition: {cycle.status} → {new_status}"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            cycle.status = new_status

            if new_status == "ACTIVE":
                first_cycle_stage = (
                    cycle.cycle_stages.filter(is_deleted=False)
                    .select_related("stage")
                    .order_by("id")
                    .first()
                )
                if first_cycle_stage:
                    cycle.stage = first_cycle_stage.stage

        if is_deleted is not None:
            cycle.is_deleted = is_deleted

        #  Save name / description if provided 
        if "name" in request.data:
            cycle.name = request.data["name"]
        if "description" in request.data:
            cycle.description = request.data.get("description") or ""

        #  Save stage dates if provided 
        stages_data = request.data.get("stages")
        if stages_data:
            for s in stages_data:
                stage_id = s.get("stage_id")
                start_date = s.get("start_date")
                end_date = s.get("end_date")
                if stage_id and start_date and end_date:
                    KRACycleStage.objects.update_or_create(
                        kra_cycle=cycle,
                        stage_id=stage_id,
                        defaults={
                            "start_date": _parse_date(start_date),
                            "end_date": _parse_date(end_date),
                            "is_deleted": False,
                        },
                    )

        cycle.save()

        _audit(
            request,
            "CYCLE_UPDATED",
            "KRACycle",
            cycle.id,
            old_data={
                "status": old_status,
                "is_deleted": old_is_deleted,
            },
            new_data={
                "status": cycle.status,
                "is_deleted": cycle.is_deleted,
                "updated_by": caller.email,
            },
        )

        message = "Cycle updated successfully."
        if new_status == "ACTIVE":
            message = "Cycle activated. Email notifications sent to enrolled employees."
        elif is_deleted:
            message = "Cycle soft-deleted successfully."

        return Response(
            {
                "id": cycle.id,
                "status": cycle.status,
                "stage": (
                    {"id": cycle.stage.id, "name": cycle.stage.name}
                    if cycle.stage
                    else None
                ),
                "message": message,
            },
            status=status.HTTP_200_OK,
        )


# 5. KRA Cycle — Clone


# class KRACycleCloneView(APIView):
#     permission_classes = [IsAuthenticated]

#     def post(self, request, cycle_id):
#         caller = _get_caller(request)

#         if not _is_hr(caller):
#             return Response(
#                 {"error": "Only HR can clone cycles"},
#                 status=status.HTTP_403_FORBIDDEN,
#             )

#         source = get_object_or_404(KRACycle, id=cycle_id, is_deleted=False)
#         data   = request.data

#         for field in ("name", "start_date", "end_date"):
#             if field not in data:
#                 return Response(
#                     {"error": f"Missing required field: {field}"},
#                     status=status.HTTP_400_BAD_REQUEST,
#                 )

#         with transaction.atomic():
#             source_stages = (
#                 source.cycle_stages.filter(is_deleted=False)
#                 .select_related("stage")
#                 .order_by("id")
#             )

#             if not source_stages.exists():
#                 return Response(
#                     {"error": "Source cycle has no stages to clone"},
#                     status=status.HTTP_400_BAD_REQUEST,
#                 )

#             first_stage = source_stages.first().stage

#             new_cycle = KRACycle.objects.create(
#                 name        = data["name"],
#                 description = data.get("description", source.description),
#                 start_date  = data["start_date"],
#                 end_date    = data["end_date"],
#                 status      = "DRAFT",
#                 stage       = first_stage,
#                 is_deleted  = False,
#             )

#             for cs in source_stages:
#                 KRACycleStage.objects.create(
#                     kra_cycle  = new_cycle,
#                     stage      = cs.stage,
#                     start_date = cs.start_date,
#                     end_date   = cs.end_date,
#                     is_deleted = False,
#                 )

#         _audit(request, "CYCLE_CLONED", "KRACycle", new_cycle.id,
#             old_data = {
#                 "source_id":   source.id,
#                 "source_name": source.name,
#             },
#             new_data = {
#                 "name":       new_cycle.name,
#                 "start_date": str(new_cycle.start_date),
#                 "end_date":   str(new_cycle.end_date),
#                 "cloned_by":  caller.email,
#             }
#         )

#         return Response(
#             {
#                 "id":           new_cycle.id,
#                 "name":         new_cycle.name,
#                 "status":       new_cycle.status,
#                 "stage":        {"id": first_stage.id, "name": first_stage.name},
#                 "cloned_from":  source.id,
#                 "stages_count": source_stages.count(),
#             },
#             status=status.HTTP_201_CREATED,
#         )


class KRACycleCloneView(APIView):
    """
    POST /api/v1/kra/cycles/{cycle_id}/clone

    Body:
        {
            "name":               "Cycle Q4 2026",
            "start_date":         "2026-10-01T00:00:00",
            "end_date":           "2026-12-31T00:00:00",
            "clone_assignments":  true     ← optional, default true
        }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, cycle_id):
        caller = _get_caller(request)
        source = get_object_or_404(KRACycle, id=cycle_id, is_deleted=False)
        data = request.data

        for field in ("name", "start_date", "end_date"):
            if field not in data:
                return Response(
                    {"error": f"Missing required field: {field}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        clone_assignments = data.get("clone_assignments", True)

        try:
            clone_start = _parse_date(data["start_date"])
            clone_end = _parse_date(data["end_date"])
        except (ValueError, AttributeError):
            return Response(
                {"error": "Invalid date format. Use YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Step 1: Clone the cycle shell + stage windows 
        with transaction.atomic():
            new_cycle = KRACycle.objects.create(
                name=data["name"],
                description=source.description,
                start_date=clone_start,
                end_date=clone_end,
                status="DRAFT",
                is_deleted=False,
            )

            for cs in source.cycle_stages.filter(is_deleted=False):
                KRACycleStage.objects.create(
                    kra_cycle=new_cycle,
                    stage=cs.stage,
                    start_date=cs.start_date,
                    end_date=cs.end_date,
                    is_deleted=False,
                )

        assignment_result = None

        #  Step 2: Clone assignments if requested 
        if clone_assignments:
            assignment_result = _clone_assignments(
                source_cycle=source,
                new_cycle=new_cycle,
                caller=caller,
            )

        _audit(
            request,
            "CYCLE_CLONED",
            "KRACycle",
            new_cycle.id,
            new_data={
                "cloned_from": source.id,
                "clone_assignments": clone_assignments,
                "assignment_summary": (
                    assignment_result.get("summary") if assignment_result else None
                ),
            },
        )

        return Response(
            {
                "id": new_cycle.id,
                "name": new_cycle.name,
                "status": new_cycle.status,
                "cloned_from": source.id,
                "assignments": assignment_result,
            },
            status=status.HTTP_201_CREATED,
        )


# 6. KRA Cycle - Stage advancement


class KRACycleAdvanceStageView(APIView):
    """
    POST /api/v1/kra/cycles/{cycle_id}/advance-stage

    Two modes:

    1. CYCLE-LEVEL advance (no body or empty body)
       - Moves the cycle forward by 1 stage
       - Syncs ALL enrolled employees to the new stage
       - HR only

    2. EMPLOYEE-LEVEL override (provide target_stage_id + optional employee_ids)
       - HR can set ANY stage (forward or backward) for:
           a) ALL employees in the cycle  →  omit employee_ids or pass []
           b) Specific employees only     →  pass employee_ids: [1001, 1002]
       - Does NOT change the cycle's own stage_id

    Request body examples:

        {}                                          # advance cycle by 1, sync all employees

        { "target_stage_id": 3 }                   # set ALL employees back to stage 3

        { "target_stage_id": 3,
          "employee_ids": [1001, 1002] }            # set only those two employees to stage 3
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, cycle_id):
        caller = _get_caller(request)

        if not _is_hr(caller):
            return Response(
                "Only HR can advance or override cycle stages",
                status=status.HTTP_403_FORBIDDEN,
            )

        cycle = get_object_or_404(KRACycle, id=cycle_id, is_deleted=False)

        target_stage_id = request.data.get("target_stage_id")  # optional
        employee_ids = request.data.get("employee_ids", [])  # optional list

        #  Mode 2: explicit stage override for employees
        if target_stage_id is not None:
            return self._override_employee_stages(cycle, target_stage_id, employee_ids)

        #  Mode 1: advance the cycle by one stage
        return self._advance_cycle(cycle)

    #  Mode 1 helper
    def _advance_cycle(self, cycle):
        if not cycle.stage_id:
            return Response(
                "Cycle has no current stage assigned",
                status=status.HTTP_400_BAD_REQUEST,
            )
        ordered_stages = list(Stage.objects.order_by("id"))
        stage_ids = [s.id for s in ordered_stages]

        if cycle.stage_id not in stage_ids:
            return Response(
                "Current stage not found in DB", status=status.HTTP_400_BAD_REQUEST
            )

        current_index = stage_ids.index(cycle.stage_id)

        if current_index >= len(stage_ids) - 1:
            return Response(
                "Cycle is already at the final stage",
                status=status.HTTP_400_BAD_REQUEST,
            )

        previous_stage = cycle.stage
        new_stage = ordered_stages[current_index + 1]
        new_stage_id = new_stage.id

        with transaction.atomic():
            cycle.stage = new_stage
            cycle.save()
            affected = EmployeeKRACycle.objects.filter(
                kra_cycle_id=cycle.id, is_stage_overridden=False
            ).update(stage_id=new_stage_id)

        # AUDIT LOG
        _audit(
            self.request,
            "CYCLE_STAGE_ADVANCED",
            "KRACycle",
            cycle.id,
            old_data={
                "previous_stage_id": previous_stage.id,
                "previous_stage_name": previous_stage.name,
            },
            new_data={
                "new_stage_id": new_stage.id,
                "new_stage_name": new_stage.name,
                "employees_synced": affected,
            },
        )

        return Response(
            {
                "mode": "cycle_advance",
                "cycle_id": cycle.id,
                "previous_stage": {
                    "id": previous_stage.id,
                    "name": previous_stage.name,
                },
                "current_stage": {"id": new_stage.id, "name": new_stage.name},
                "employees_synced": affected,
                "message": f"Cycle advanced to {new_stage.name}",
            },
            status=status.HTTP_200_OK,
        )

    # Mode 2 helper
    def _override_employee_stages(self, cycle, target_stage_id, employee_ids):
        try:
            target_stage = Stage.objects.get(id=target_stage_id)
        except Stage.DoesNotExist:
            return Response(
                f"Stage {target_stage_id} does not exist",
                status=status.HTTP_400_BAD_REQUEST,
            )

        ekc_qs = EmployeeKRACycle.objects.filter(kra_cycle_id=cycle.id)

        if employee_ids:
            enrolled_ids = set(ekc_qs.values_list("employee_id", flat=True))
            invalid = set(employee_ids) - enrolled_ids
            if invalid:
                return Response(
                    f"These employee IDs are not enrolled in this cycle: {sorted(invalid)}",
                    status=status.HTTP_400_BAD_REQUEST,
                )
            ekc_qs = ekc_qs.filter(employee_id__in=employee_ids)

        old_cycle_stage_id = cycle.stage_id
        old_cycle_stage_name = cycle.stage.name if cycle.stage else None

        with transaction.atomic():
            if employee_ids:
                # Specific employee(s) manually moved → protect from bulk advance/rollback
                affected = ekc_qs.update(
                    stage_id=target_stage_id, is_stage_overridden=True
                )
            else:
                # Bulk advance/rollback from dashboard → skip overridden employees
                affected = ekc_qs.filter(is_stage_overridden=False).update(
                    stage_id=target_stage_id
                )
                cycle.stage = target_stage
                cycle.save(update_fields=["stage"])

            # When rolling back ALL employees (no specific employee_ids),
            # also move the cycle's own current_stage pointer so the
            # stepper and "Current Stage" chip reflect the rollback.
            if not employee_ids:
                cycle.stage = target_stage
                cycle.save(update_fields=["stage"])

        scope = f"employees {employee_ids}" if employee_ids else "all employees"
        


        def send_employee_stage_override_email(employee, cycle, target_stage):
            """
            Email for individual employee stage override.
            """

            try:

                if not employee.email:
                    return

                subject = f"KRA Stage Updated - {cycle.name}"

                message = f"""
        Hi {employee.first_name},

        Your KRA stage has been updated.

        Cycle: {cycle.name}

        New Stage:
        - Stage ID: {target_stage.id}
        - Stage Name: {target_stage.name}

        Please login to the KRA portal for details.

        Regards,
        HR Team
        """

                send_mail(
                    subject=subject,
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[employee.email],
                    fail_silently=True,
                )

            except Exception as e:
                print(f"Stage override email failed: {str(e)}")

        def trigger_emails():
            for ekc in ekc_qs.select_related("employee", "kra_cycle"):
                employee = ekc.employee
                send_employee_stage_override_email(employee, cycle, target_stage)

        transaction.on_commit(
            lambda: threading.Thread(target=trigger_emails, daemon=True).start()
        )

        #  AUDIT LOG
        _audit(
            self.request,
            "EMPLOYEE_STAGE_OVERRIDE",
            "KRACycle",
            cycle.id,
            old_data={
                "cycle_stage_id": old_cycle_stage_id,
                "cycle_stage_name": old_cycle_stage_name,
            },
            new_data={
                "target_stage_id": target_stage.id,
                "target_stage_name": target_stage.name,
                "cycle_stage_updated": not bool(employee_ids),
                "scope": scope,
                "employees_updated": affected,
            },
        )

        return Response(
            {
                "mode": "employee_override",
                "cycle_id": cycle.id,
                "target_stage": {"id": target_stage.id, "name": target_stage.name},
                "cycle_stage": {
                    "id": cycle.stage_id,
                    "name": cycle.stage.name if cycle.stage else None,
                },
                "scope": scope,
                "employees_updated": affected,
                "message": (f"{affected} employee(s) moved to {target_stage.name}"),
            },
            status=status.HTTP_200_OK,
        )


class ReferenceDataView(APIView):
    """
    GET /api/v1/kra/reference-data
    Returns stages, levels, ratings, and categories. Called once on app load.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        stages = list(Stage.objects.values("id", "name"))
        levels = list(
            Level.objects.values("id", "name", "min_experience", "max_experience")
        )
        ratings = list(Rating.objects.values("id", "rating", "description"))
        categories = list(KRACategory.objects.values("id", "name", "is_standard"))

        return Response(
            {
                "stages": stages,
                "levels": levels,
                "ratings": ratings,
                "categories": categories,
            },
            status=status.HTTP_200_OK,
        )


class KRALibraryView(APIView):
    """
    GET /api/v1/kra/library?category_id=&level_id=
    Returns all KRAs with their level variants; optionally filtered.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        category_id = request.query_params.get("category_id")
        level_id = request.query_params.get("level_id")

        qs = KRA.objects.select_related("category").prefetch_related(
            "kra_levels__level",  # related_name 'kra_levels' on KRALevel.kra
            "kra_levels__category",  # requires 'category' field on KRALevel
        )

        if category_id:
            qs = qs.filter(category_id=category_id)
        if level_id:
            qs = qs.filter(kra_levels__level_id=level_id).distinct()

        kras = []
        for k in qs:
            levels_data = []
            for kl in k.kra_levels.all():
                entry = {
                    "kra_level_id": kl.id,
                    "level_id": kl.level_id,
                    "level_name": kl.level.name if kl.level else None,
                    # 'name' and 'category' exist in DB but may be absent from
                    # the model — add them to KRALevel (see NOTE at top of file)
                    "description": getattr(kl, "name", None),
                }
                if level_id and str(kl.level_id) != str(level_id):
                    continue
                levels_data.append(entry)

            kras.append(
                {
                    "id": k.id,
                    "name": k.name,
                    "description": k.description,
                    "category_id": k.category_id,
                    "category_name": k.category.name if k.category else None,
                    "levels": levels_data,
                }
            )

        return Response({"kras": kras}, status=status.HTTP_200_OK)


class EmployeeStageOverrideDatesView(APIView):
    """
    POST /api/v1/kra/employee-cycles/:ekc_id/stage-dates
    Save per-employee stage date overrides.
    Body: { stages: [{ stage_id, start_date, end_date }] }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, ekc_id):
        caller = _get_caller(request)
        if not _is_hr(caller):
            return Response(
                {"error": "Only HR/Admin can set stage overrides"},
                status=status.HTTP_403_FORBIDDEN,
            )

        ekc = get_object_or_404(EmployeeKRACycle, id=ekc_id)
        stages_data = request.data.get("stages", [])

        with transaction.atomic():
            for s in stages_data:
                EmployeeKRACycleStage.objects.update_or_create(
                    employee_kra_cycle=ekc,
                    stage_id=s["stage_id"],
                    defaults={
                        "start_date": s["start_date"],
                        "end_date": s["end_date"],
                    },
                )

                threading.Thread(
                    target=send_stage_override_email,
                    args=(ekc.employee, ekc.kra_cycle, stages_data[0]),
                    daemon=True,
                ).start()

        return Response({"message": "Stage dates saved"}, status=status.HTTP_200_OK)
