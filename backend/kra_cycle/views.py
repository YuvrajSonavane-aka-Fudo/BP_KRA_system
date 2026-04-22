from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
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

HR_ROLES      = {"Admin" , "HR" , "Vertical Lead"}
LEAD_ROLES    = {"Manager" , "Team Lead"}
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
        employee   = _get_caller(request),
        action     = action,
        entity     = entity,
        entity_id  = entity_id,
        old_data   = old_data,
        new_data   = new_data,
        ip_address = request.META.get("REMOTE_ADDR"),
    )



# 1. Authentication


class LoginView(APIView):
    permission_classes     = [AllowAny]
    authentication_classes = []

    def post(self, request):
        email    = request.data.get("email", "").strip()
        password = request.data.get("password", "")

        if not email or not password:
            return Response(
                {"error": "Please provide both email and password"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            employee = Employee.objects.select_related(
                "department", "role"
            ).get(email=email)
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
            employee   = employee,
            action     = "LOGIN",
            entity     = "Employee",
            entity_id  = employee.id,
            old_data   = None,
            new_data   = {"email": employee.email},
            ip_address = request.META.get("REMOTE_ADDR"),
        )

        return Response(
            {
                "session_id":  request.session.session_key,
                "employee_id": employee.id,
                "roles":       [employee.role.name] if employee.role else [],
                "full_name":   f"{employee.first_name} {employee.last_name}",
                "department":  employee.department.department_name if employee.department else None,
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    permission_classes     = [AllowAny]
    authentication_classes = []

    def post(self, request):
        employee_id = request.session.get("employee_id")

        # Audit before flushing session
        if employee_id:
            AuditLog.objects.create(
                employee_id = employee_id,
                action      = "LOGOUT",
                entity      = "Employee",
                entity_id   = employee_id,
                old_data    = None,
                new_data    = None,
                ip_address  = request.META.get("REMOTE_ADDR"),
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
        caller        = _get_caller(request)
        status_filter = request.query_params.get("status")

        if _is_hr(caller):
            qs = KRACycle.objects.filter(is_deleted=False).select_related("stage")
        else:
            qs = (
                KRACycle.objects.filter(
                    is_deleted=False,
                    status="ACTIVE",
                    employee_cycles__employee=caller,
                )
                .select_related("stage")
                .distinct()
            )

        if status_filter:
            qs = qs.filter(status=status_filter)

        cycles = [
            {
                "id":          c.id,
                "name":        c.name,
                "description": c.description,
                "start_date":  c.start_date,
                "end_date":    c.end_date,
                "status":      c.status,
                "current_stage": (
                    {"id": c.stage.id, "name": c.stage.name} if c.stage else None
                ),
            }
            for c in qs
        ]
        return Response({"cycles": cycles}, status=status.HTTP_200_OK)

    def post(self, request):
        caller = _get_caller(request)
        data   = request.data

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

        stage_ids       = [s["stage_id"] for s in stages_data]
        existing_stages = Stage.objects.filter(id__in=stage_ids)

        if existing_stages.count() != len(stage_ids):
            found_ids   = set(existing_stages.values_list("id", flat=True))
            missing_ids = set(stage_ids) - found_ids
            return Response(
                {"error": f"Invalid stage_id(s): {list(missing_ids)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stage_map = {s.id: s for s in existing_stages}

        with transaction.atomic():
            first_stage = stage_map[stages_data[0]["stage_id"]]

            cycle = KRACycle.objects.create(
                name        = data["name"],
                description = data.get("description", ""),
                start_date  = data["start_date"],
                end_date    = data["end_date"],
                status      = "DRAFT",
                stage       = first_stage,
                is_deleted  = False,
            )

            for s in stages_data:
                for field in ("stage_id", "start_date", "end_date"):
                    if field not in s:
                        raise ValueError(f"Missing {field} in stages entry")

                KRACycleStage.objects.create(
                    kra_cycle  = cycle,
                    stage      = stage_map[s["stage_id"]],
                    start_date = s["start_date"],
                    end_date   = s["end_date"],
                    is_deleted = False,
                )

        _audit(request, "CYCLE_CREATED", "KRACycle", cycle.id,
            old_data = None,
            new_data = {
                "name":       cycle.name,
                "start_date": str(cycle.start_date),
                "end_date":   str(cycle.end_date),
                "status":     cycle.status,
                "stages":     stage_ids,
                "created_by": caller.email,
            }
        )

        return Response(
            {
                "id":           cycle.id,
                "name":         cycle.name,
                "status":       cycle.status,
                "stage":        {"id": first_stage.id, "name": first_stage.name},
                "stages_count": len(stages_data),
            },
            status=status.HTTP_201_CREATED,
        )



# 4. KRA Cycle — Update Status / Soft Delete

class KRACycleUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    VALID_TRANSITIONS = {
        "DRAFT":  ["ACTIVE"],
        "ACTIVE": ["CLOSED"],
    }

    def patch(self, request, cycle_id):
        caller = _get_caller(request)

        if not _is_hr(caller):
            return Response(
                {"error": "Only HR can update cycles"},
                status=status.HTTP_403_FORBIDDEN,
            )

        cycle = get_object_or_404(KRACycle, id=cycle_id, is_deleted=False)

        # Capture old values BEFORE making any changes
        old_status     = cycle.status
        old_is_deleted = cycle.is_deleted

        new_status = request.data.get("status")
        is_deleted = request.data.get("is_deleted")

        if new_status:
            allowed = self.VALID_TRANSITIONS.get(cycle.status, [])
            if new_status not in allowed:
                return Response(
                    {"error": f"Invalid status transition: {cycle.status} → {new_status}"},
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

        cycle.save()

        _audit(request, "CYCLE_UPDATED", "KRACycle", cycle.id,
            old_data = {
                "status":     old_status,
                "is_deleted": old_is_deleted,
            },
            new_data = {
                "status":     cycle.status,
                "is_deleted": cycle.is_deleted,
                "updated_by": caller.email,
            }
        )

        message = "Cycle updated successfully."
        if new_status == "ACTIVE":
            message = "Cycle activated. Email notifications sent to enrolled employees."
        elif is_deleted:
            message = "Cycle soft-deleted successfully."

        return Response(
            {
                "id":      cycle.id,
                "status":  cycle.status,
                "stage":   {"id": cycle.stage.id, "name": cycle.stage.name} if cycle.stage else None,
                "message": message,
            },
            status=status.HTTP_200_OK,
        )



# 5. KRA Cycle — Clone


class KRACycleCloneView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, cycle_id):
        caller = _get_caller(request)

        if not _is_hr(caller):
            return Response(
                {"error": "Only HR can clone cycles"},
                status=status.HTTP_403_FORBIDDEN,
            )

        source = get_object_or_404(KRACycle, id=cycle_id, is_deleted=False)
        data   = request.data

        for field in ("name", "start_date", "end_date"):
            if field not in data:
                return Response(
                    {"error": f"Missing required field: {field}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        with transaction.atomic():
            source_stages = (
                source.cycle_stages.filter(is_deleted=False)
                .select_related("stage")
                .order_by("id")
            )

            if not source_stages.exists():
                return Response(
                    {"error": "Source cycle has no stages to clone"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            first_stage = source_stages.first().stage

            new_cycle = KRACycle.objects.create(
                name        = data["name"],
                description = data.get("description", source.description),
                start_date  = data["start_date"],
                end_date    = data["end_date"],
                status      = "DRAFT",
                stage       = first_stage,
                is_deleted  = False,
            )

            for cs in source_stages:
                KRACycleStage.objects.create(
                    kra_cycle  = new_cycle,
                    stage      = cs.stage,
                    start_date = cs.start_date,
                    end_date   = cs.end_date,
                    is_deleted = False,
                )

        _audit(request, "CYCLE_CLONED", "KRACycle", new_cycle.id,
            old_data = {
                "source_id":   source.id,
                "source_name": source.name,
            },
            new_data = {
                "name":       new_cycle.name,
                "start_date": str(new_cycle.start_date),
                "end_date":   str(new_cycle.end_date),
                "cloned_by":  caller.email,
            }
        )

        return Response(
            {
                "id":           new_cycle.id,
                "name":         new_cycle.name,
                "status":       new_cycle.status,
                "stage":        {"id": first_stage.id, "name": first_stage.name},
                "cloned_from":  source.id,
                "stages_count": source_stages.count(),
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
                'Only HR can advance or override cycle stages',
                status=status.HTTP_403_FORBIDDEN,
            )

        cycle = get_object_or_404(KRACycle, id=cycle_id, is_deleted=False)

        target_stage_id = request.data.get('target_stage_id')   # optional
        employee_ids    = request.data.get('employee_ids', [])   # optional list

        #  Mode 2: explicit stage override for employees 
        if target_stage_id is not None:
            return self._override_employee_stages(
                cycle, target_stage_id, employee_ids
            )

        #  Mode 1: advance the cycle by one stage 
        return self._advance_cycle(cycle)

    #  Mode 1 helper 
    def _advance_cycle(self, cycle):
        if not cycle.stage_id:
            return Response(
                'Cycle has no current stage assigned',
                status=status.HTTP_400_BAD_REQUEST,
            )
        if cycle.stage_id >= 5:
            return Response(
                'Cycle is already at the final stage',
                status=status.HTTP_400_BAD_REQUEST,
            )

        previous_stage = cycle.stage
        new_stage_id   = cycle.stage_id + 1

        try:
            new_stage = Stage.objects.get(id=new_stage_id)
        except Stage.DoesNotExist:
            return Response('Next stage does not exist', status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            cycle.stage = new_stage
            cycle.save()
            affected = EmployeeKRACycle.objects.filter(
                kra_cycle_id=cycle.id
            ).update(stage_id=new_stage_id)

        # AUDIT LOG
        _audit(self.request, "CYCLE_STAGE_ADVANCED", "KRACycle", cycle.id,
            old_data={
                "previous_stage_id": previous_stage.id,
                "previous_stage_name": previous_stage.name,
            },
            new_data={
                "new_stage_id": new_stage.id,
                "new_stage_name": new_stage.name,
                "employees_synced": affected,
            }
        )

        return Response({
            'mode':           'cycle_advance',
            'cycle_id':       cycle.id,
            'previous_stage': {'id': previous_stage.id, 'name': previous_stage.name},
            'current_stage':  {'id': new_stage.id,      'name': new_stage.name},
            'employees_synced': affected,
            'message':        f'Cycle advanced to {new_stage.name}',
        }, status=status.HTTP_200_OK)

    # Mode 2 helper 
    def _override_employee_stages(self, cycle, target_stage_id, employee_ids):
        try:
            target_stage = Stage.objects.get(id=target_stage_id)
        except Stage.DoesNotExist:
            return Response(
                f'Stage {target_stage_id} does not exist',
                status=status.HTTP_400_BAD_REQUEST,
            )

        ekc_qs = EmployeeKRACycle.objects.filter(kra_cycle_id=cycle.id)

        if employee_ids:
            enrolled_ids = set(
                ekc_qs.values_list('employee_id', flat=True)
            )
            invalid = set(employee_ids) - enrolled_ids
            if invalid:
                return Response(
                    f'These employee IDs are not enrolled in this cycle: {sorted(invalid)}',
                    status=status.HTTP_400_BAD_REQUEST,
                )
            ekc_qs = ekc_qs.filter(employee_id__in=employee_ids)

        with transaction.atomic():
            affected = ekc_qs.update(stage_id=target_stage_id)

        scope = f'employees {employee_ids}' if employee_ids else 'all employees'

        #  AUDIT LOG
        _audit(self.request, "EMPLOYEE_STAGE_OVERRIDE", "KRACycle", cycle.id,
            old_data={
                "cycle_stage_id": cycle.stage_id,
                "cycle_stage_name": cycle.stage.name if cycle.stage else None,
            },
            new_data={
                "target_stage_id": target_stage.id,
                "target_stage_name": target_stage.name,
                "scope": scope,
                "employees_updated": affected,
            }
        )

        return Response({
            'mode':            'employee_override',
            'cycle_id':        cycle.id,
            'target_stage':    {'id': target_stage.id, 'name': target_stage.name},
            'cycle_stage':     {'id': cycle.stage_id,  'name': cycle.stage.name if cycle.stage else None},
            'scope':           scope,
            'employees_updated': affected,
            'message': (
                f'{affected} employee(s) moved to {target_stage.name}'
            ),
        }, status=status.HTTP_200_OK)
        
class ReferenceDataView(APIView):
    """
    GET /api/v1/kra/reference-data
    Returns stages, levels, ratings, and categories. Called once on app load.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        stages     = list(Stage.objects.values('id', 'name'))
        levels     = list(Level.objects.values('id', 'name', 'min_experience', 'max_experience'))
        ratings    = list(Rating.objects.values('id', 'rating', 'description'))
        categories = list(KRACategory.objects.values('id', 'name', 'is_standard'))

        return Response({
            'stages':     stages,
            'levels':     levels,
            'ratings':    ratings,
            'categories': categories,
        }, status=status.HTTP_200_OK)
        
class KRALibraryView(APIView):
    """
    GET /api/v1/kra/library?category_id=&level_id=
    Returns all KRAs with their level variants; optionally filtered.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        category_id = request.query_params.get('category_id')
        level_id    = request.query_params.get('level_id')

        qs = KRA.objects.select_related('category').prefetch_related(
            'kra_levels__level',    # related_name 'kra_levels' on KRALevel.kra
            'kra_levels__category', # requires 'category' field on KRALevel (see model NOTE)
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
                    'kra_level_id': kl.id,
                    'level_id':     kl.level_id,
                    'level_name':   kl.level.name if kl.level else None,
                    # 'name' and 'category' exist in DB but may be absent from
                    # the model — add them to KRALevel (see NOTE at top of file)
                    'description':  getattr(kl, 'name', None),
                }
                if level_id and str(kl.level_id) != str(level_id):
                    continue
                levels_data.append(entry)

            kras.append({
                'id':            k.id,
                'name':          k.name,
                'description':   k.description,
                'category_id':   k.category_id,
                'category_name': k.category.name if k.category else None,
                'levels':        levels_data,
            })

        return Response({'kras': kras}, status=status.HTTP_200_OK)