"""
File: views.py
App: kra_cycle
Purpose:
    Handles the HTTP request/response lifecycle for KRA Cycle API endpoints.

Includes:
    - Authentication (Login/Logout)
    - KRA Cycle List & Create
    - KRA Cycle Update (Status & Details)
    - KRA Cycle Cloning
    - KRA Cycle Stage Advancement and Employee Overrides
    - Reference Data lookup
    - KRA Library lookup
    - Employee Stage Override Dates

Responsibilities:
    - Handle the HTTP request/response lifecycle for API endpoints.

Notes:
    - Keeps views thin, delegates calculations to utils.py and serialization to serializers.py.
    - Identity source is Employee, using session-based authentication.
"""

from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.request import Request

import threading

from .models import (
    Employee,
    KRACycle,
    KRACycleStage,
    EmployeeKRACycle,
    EmployeeKRACycleStage,
    KRALevel,
    KRA,
    KRACategory,
    Stage,
    Level,
    Rating,
    AuditLog,
)

from utils import (
    _get_caller,
    _is_hr,
    _is_lead,
    _caller_can_act_on,
    _audit,
    _clone_assignments,
    _parse_date,
    send_stage_override_email,
    send_employee_stage_override_email,
)

from .serializers import (
    KRACycleSerializer,
    ReferenceStageSerializer,
    ReferenceLevelSerializer,
    ReferenceRatingSerializer,
    ReferenceCategorySerializer,
    KRALibrarySerializer,
)


# 1. Authentication

class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request: Request) -> Response:
        """
        API view to log in an employee and create a session.

        Endpoint: POST /api/v1/auth/login

        Request Headers:
            None

        Request Body:
            {
                "email": "<employee_email>",
                "password": "<employee_password>"
            }

        Response (200):
            {
                "session_id": "<session_key>",
                "employee_id": 1,
                "roles": ["HR"],
                "full_name": "John Doe",
                "department": "Engineering"
            }

        Error Responses:
            400: Please provide both email and password
            401: Invalid credentials
            403: Account is inactive
        """
        email = request.data.get("email", "").strip()
        password = request.data.get("password", "")

        if not email or not password:
            return Response(
                {"error": "Please provide both email and password"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            raw_sql = """
                SELECT e.*, 
                       d.department_name AS dept_name, 
                       r.name AS role_name
                FROM employee e
                LEFT OUTER JOIN department d ON e.department_id = d.id
                LEFT OUTER JOIN role r ON e.role = r.id
                WHERE e.email = %s
            """
            employees = list(Employee.objects.raw(raw_sql, [email]))
            if not employees:
                raise Employee.DoesNotExist
            employee = employees[0]
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
                "roles": [employee.role_name] if employee.role_name else [],
                "full_name": f"{employee.first_name} {employee.last_name}",
                "department": employee.dept_name,
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request: Request) -> Response:
        """
        API view to log out the current employee and flush session.

        Endpoint: POST /api/v1/auth/logout

        Request Headers:
            None

        Request Body:
            None

        Response (200):
            {
                "message": "Logged out successfully"
            }

        Error Responses:
            None
        """
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

    def get(self, request: Request) -> Response:
        """
        API view to list all KRA cycles.

        Endpoint: GET /api/v1/kra/cycles
        Query Parameters:
            status (optional): filter by status (e.g. DRAFT, ACTIVE)

        Request Headers:
            Authorization: Required

        Request Body:
            None

        Response (200):
            {
                "cycles": [
                    {
                        "id": 1,
                        "name": "Cycle Q1 2026",
                        "description": "First quarter KRA cycle",
                        "start_date": "2026-01-01T00:00:00Z",
                        "end_date": "2026-03-31T00:00:00Z",
                        "status": "ACTIVE",
                        "current_stage": {
                            "id": 1,
                            "name": "Self Assessment"
                        },
                        "cycle_stages": [
                            {
                                "stage_id": 1,
                                "start_date": "2026-01-01T00:00:00Z",
                                "end_date": "2026-01-15T00:00:00Z"
                            }
                        ]
                    }
                ]
            }

        Error Responses:
            401: Unauthorized
        """
        caller = _get_caller(request)
        status_filter = request.query_params.get("status")

        if _is_hr(caller):
            qs = (
                KRACycle.objects.filter(is_deleted=False)
                .select_related("stage")
                .prefetch_related("cycle_stages__stage")
            )
            if status_filter:
                qs = qs.filter(status=status_filter)
            cycles_data = KRACycleSerializer(qs, many=True).data
        else:
            raw_sql = """
                SELECT DISTINCT c.*
                FROM kra_cycle c
                LEFT OUTER JOIN employee_kra_cycle ekc ON c.id = ekc.kra_cycle_id
                WHERE c.is_deleted = FALSE
                  AND (
                    c.status = 'ACTIVE'
                    OR (c.status IN ('DRAFT', 'CLOSED') AND ekc.employee_id = %s)
                  )
            """
            params = [caller.id]
            if status_filter:
                raw_sql += " AND c.status = %s"
                params.append(status_filter)

            cycles_list = list(KRACycle.objects.raw(raw_sql, params))

            # Pre-populate Stage relation to avoid N+1 queries during serialization
            stage_ids = {c.stage_id for c in cycles_list if c.stage_id is not None}
            stages = {s.id: s for s in Stage.objects.filter(id__in=stage_ids)}
            for c in cycles_list:
                if c.stage_id in stages:
                    c.stage = stages[c.stage_id]

            cycles_data = KRACycleSerializer(cycles_list, many=True).data

        return Response(
            {"cycles": cycles_data},
            status=status.HTTP_200_OK
        )

    def post(self, request: Request) -> Response:
        """
        API view to create a new KRA cycle with stages.

        Endpoint: POST /api/v1/kra/cycles

        Request Headers:
            Authorization: Required

        Request Body:
            {
                "name": "Cycle Q3 2026",
                "description": "KRA Cycle for Q3",
                "start_date": "2026-07-01T00:00:00",
                "end_date": "2026-09-30T00:00:00",
                "stages": [
                    {
                        "stage_id": 1,
                        "start_date": "2026-07-01T00:00:00",
                        "end_date": "2026-07-15T00:00:00"
                    }
                ]
            }

        Response (201):
            {
                "id": 1,
                "name": "Cycle Q3 2026",
                "status": "DRAFT",
                "stage": null,
                "stages_count": 1
            }

        Error Responses:
            400: Missing required field, invalid date format, or invalid stage_id(s)
            401: Unauthorized
        """
        caller = _get_caller(request)
        data = request.data

        for field in ("name", "start_date", "end_date"):
            if field not in data:
                return Response(
                    {"error": f"Missing required field: {field}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        stages_data = data.get("stages", [])

        try:
            cycle_start = _parse_date(data["start_date"])
            cycle_end = _parse_date(data["end_date"])
        except (ValueError, AttributeError):
            return Response(
                {"error": "Invalid date format. Use YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stage_map = {}
        if stages_data:
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

        with transaction.atomic():
            cycle = KRACycle.objects.create(
                name=data["name"],
                description=data.get("description", ""),
                start_date=cycle_start,
                end_date=cycle_end,
                status="DRAFT",
                stage=None,
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
                "stages": [s["stage_id"] for s in stages_data],
                "created_by": caller.email,
            },
        )

        return Response(
            {
                "id": cycle.id,
                "name": cycle.name,
                "status": cycle.status,
                "stage": None,
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

    def get(self, request: Request, cycle_id: int) -> Response:
        """
        API view to retrieve details of a specific KRA cycle.

        Endpoint: GET /api/v1/kra/cycles/<cycle_id>

        Request Headers:
            Authorization: Required

        Request Body:
            None

        Response (200):
            {
                "id": 1,
                "name": "Cycle Q1 2026",
                "description": "First quarter KRA cycle",
                "start_date": "2026-01-01T00:00:00Z",
                "end_date": "2026-03-31T00:00:00Z",
                "status": "ACTIVE",
                "current_stage": {
                    "id": 1,
                    "name": "Self Assessment"
                },
                "cycle_stages": [
                    {
                        "stage_id": 1,
                        "start_date": "2026-01-01T00:00:00Z",
                        "end_date": "2026-01-15T00:00:00Z"
                    }
                ]
            }

        Error Responses:
            404: Cycle not found
            401: Unauthorized
        """
        cycle = get_object_or_404(KRACycle, id=cycle_id, is_deleted=False)
        return Response(KRACycleSerializer(cycle).data, status=status.HTTP_200_OK)

    def patch(self, request: Request, cycle_id: int) -> Response:
        """
        API view to patch/update a KRA cycle's status, dates, stages, or name.

        Endpoint: PATCH /api/v1/kra/cycles/<cycle_id>

        Request Headers:
            Authorization: Required

        Request Body:
            {
                "status": "ACTIVE",
                "is_deleted": false,
                "name": "Updated name",
                "description": "Updated desc",
                "start_date": "2026-07-01",
                "end_date": "2026-09-30",
                "stages": [
                    {
                        "stage_id": 1,
                        "start_date": "2026-07-01",
                        "end_date": "2026-07-15"
                    }
                ]
            }

        Response (200):
            {
                "id": 1,
                "status": "ACTIVE",
                "stage": {
                    "id": 1,
                    "name": "Self Assessment"
                },
                "message": "Cycle activated. Email notifications sent to enrolled employees."
            }

        Error Responses:
            400: Invalid status transition
            403: Only HR can update cycles
            404: Cycle not found
            401: Unauthorized
        """
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
                # Only set first stage when activating a DRAFT cycle
                if old_status == "DRAFT":
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

        # Save name / description if provided
        if "name" in request.data:
            cycle.name = request.data["name"]
        if "description" in request.data:
            cycle.description = request.data.get("description") or ""
        if "start_date" in request.data:
            try:
                cycle.start_date = _parse_date(request.data["start_date"])
            except (ValueError, AttributeError):
                pass
        if "end_date" in request.data:
            try:
                cycle.end_date = _parse_date(request.data["end_date"])
            except (ValueError, AttributeError):
                pass

        # Save stage dates if provided
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

class KRACycleCloneView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, cycle_id: int) -> Response:
        """
        API view to clone an existing cycle shell along with its stages and assignments.

        Endpoint: POST /api/v1/kra/cycles/<cycle_id>/clone

        Request Headers:
            Authorization: Required

        Request Body:
            {
                "name": "Cloned Cycle Q4 2026",
                "start_date": "2026-10-01T00:00:00",
                "end_date": "2026-12-31T00:00:00",
                "clone_assignments": true
            }

        Response (201):
            {
                "id": 2,
                "name": "Cloned Cycle Q4 2026",
                "status": "DRAFT",
                "cloned_from": 1,
                "assignments": {
                    "enrolled": [...],
                    "skipped": [...],
                    "needs_review": [...],
                    "summary": { ... }
                }
            }

        Error Responses:
            400: Missing required fields or invalid date formats
            401: Unauthorized
            404: Source cycle not found
        """
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

        # Step 2: Clone assignments if requested
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
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, cycle_id: int) -> Response:
        """
        API view to advance a KRA cycle stage or override stage values for specific employees.

        Endpoint: POST /api/v1/kra/cycles/<cycle_id>/advance-stage

        Request Headers:
            Authorization: Required

        Request Body (Cycle Advance Mode):
            None or {}

        Request Body (Employee Override Mode):
            {
                "target_stage_id": 3,
                "employee_ids": [1001, 1002]
            }

        Response (200):
            {
                "mode": "cycle_advance",
                "cycle_id": 1,
                "previous_stage": { "id": 1, "name": "Self Assessment" },
                "current_stage": { "id": 2, "name": "Lead Assessment" },
                "employees_synced": 15,
                "message": "Cycle advanced to Lead Assessment"
            }

        Error Responses:
            400: Bad parameters or stage configuration missing
            403: Only HR can advance stages
            404: Cycle not found
            401: Unauthorized
        """
        caller = _get_caller(request)

        if not _is_hr(caller):
            return Response(
                "Only HR can advance or override cycle stages",
                status=status.HTTP_403_FORBIDDEN,
            )

        cycle = get_object_or_404(KRACycle, id=cycle_id, is_deleted=False)

        target_stage_id = request.data.get("target_stage_id")  # optional
        employee_ids = request.data.get("employee_ids", [])  # optional list

        # Mode 2: explicit stage override for employees
        if target_stage_id is not None:
            return self._override_employee_stages(cycle, target_stage_id, employee_ids)

        # Mode 1: advance the cycle by one stage
        return self._advance_cycle(cycle)

    # Mode 1 helper
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

        def trigger_emails():
            for ekc in ekc_qs.select_related("employee", "kra_cycle"):
                employee = ekc.employee
                send_employee_stage_override_email(employee, cycle, target_stage)

        transaction.on_commit(
            lambda: threading.Thread(target=trigger_emails, daemon=True).start()
        )

        # AUDIT LOG
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


# 7. Reference Data

class ReferenceDataView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        """
        API view to fetch master reference records for stages, levels, ratings, and categories.

        Endpoint: GET /api/v1/kra/reference-data

        Request Headers:
            Authorization: Required

        Request Body:
            None

        Response (200):
            {
                "stages": [ { "id": 1, "name": "Self Assessment" } ],
                "levels": [ { "id": 1, "name": "Dev-01", "min_experience": 0, "max_experience": 2 } ],
                "ratings": [ { "id": 1, "rating": 5, "description": "Outstanding" } ],
                "categories": [ { "id": 1, "name": "Core Development", "is_standard": true } ]
            }

        Error Responses:
            401: Unauthorized
        """
        return Response(
            {
                "stages": ReferenceStageSerializer(Stage.objects.all(), many=True).data,
                "levels": ReferenceLevelSerializer(Level.objects.all(), many=True).data,
                "ratings": ReferenceRatingSerializer(Rating.objects.all(), many=True).data,
                "categories": ReferenceCategorySerializer(KRACategory.objects.all(), many=True).data,
            },
            status=status.HTTP_200_OK,
        )


# 8. KRA Library

class KRALibraryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        """
        API view to retrieve KRAs from the library, optionally filtered by category and level.

        Endpoint: GET /api/v1/kra/library
        Query Parameters:
            category_id (optional): category PK
            level_id (optional): seniority level PK

        Request Headers:
            Authorization: Required

        Request Body:
            None

        Response (200):
            {
                "kras": [
                    {
                        "id": 1,
                        "name": "Coding Speed",
                        "description": "Measure coding throughput",
                        "category_id": 1,
                        "category_name": "Core Development",
                        "levels": [
                            {
                                "kra_level_id": 10,
                                "level_id": 1,
                                "level_name": "Dev-01",
                                "description": "Meets core sprint goals"
                            }
                        ]
                    }
                ]
            }

        Error Responses:
            401: Unauthorized
        """
        category_id = request.query_params.get("category_id")
        level_id = request.query_params.get("level_id")

        if level_id:
            # Joins: kra (base), kra_category (LEFT JOIN), kra_level (INNER JOIN). (3 tables).
            raw_sql = """
                SELECT DISTINCT k.*
                FROM kra k
                LEFT OUTER JOIN category c ON k.category_id = c.id
                INNER JOIN kra_level kl ON k.id = kl.kra_id
                WHERE kl.level_id = %s
            """
            params = [level_id]
            if category_id:
                raw_sql += " AND k.category_id = %s"
                params.append(category_id)

            kras_list = list(KRA.objects.raw(raw_sql, params))

            # Pre-populate category mapping to prevent lazy loading
            category_ids = {k.category_id for k in kras_list if k.category_id is not None}
            categories = {cat.id: cat for cat in KRACategory.objects.filter(id__in=category_ids)}

            # Pre-populate levels cache manually to prevent N+1 queries
            kra_ids = [k.id for k in kras_list]
            kra_levels = KRALevel.objects.filter(kra_id__in=kra_ids).select_related('level', 'category')
            levels_by_kra = {}
            for kl in kra_levels:
                levels_by_kra.setdefault(kl.kra_id, []).append(kl)

            for k in kras_list:
                if k.category_id in categories:
                    k.category = categories[k.category_id]
                k._prefetched_objects_cache = {'kra_levels': levels_by_kra.get(k.id, [])}

            serializer = KRALibrarySerializer(kras_list, many=True, context={"level_id": level_id})
        else:
            qs = KRA.objects.select_related("category").prefetch_related(
                "kra_levels__level",
                "kra_levels__category",
            )
            if category_id:
                qs = qs.filter(category_id=category_id)

            serializer = KRALibrarySerializer(qs, many=True, context={"level_id": level_id})

        return Response({"kras": serializer.data}, status=status.HTTP_200_OK)


# 9. Employee Stage Overrides

class EmployeeStageOverrideDatesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, ekc_id: int) -> Response:
        """
        API view to set customized start/end dates for cycle stages for a single employee.

        Endpoint: POST /api/v1/kra/employee-cycles/<ekc_id>/stage-dates

        Request Headers:
            Authorization: Required

        Request Body:
            {
                "stages": [
                    {
                        "stage_id": 1,
                        "start_date": "2026-07-01T00:00:00",
                        "end_date": "2026-07-20T00:00:00"
                    }
                ]
            }

        Response (200):
            {
                "message": "Stage dates saved"
            }

        Error Responses:
            403: Only HR can set stage overrides
            404: Employee cycle not found
            401: Unauthorized
        """
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
