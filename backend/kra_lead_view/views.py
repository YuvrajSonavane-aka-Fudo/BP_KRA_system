"""
File: views.py
App: kra_lead_view

Purpose:
    Handles HTTP request/response lifecycle for lead-facing KRA assessment endpoints.

Includes:
    - API views for viewing employee KRA progress, submitting lead reviews,
      and updating KRA descriptions

Responsibilities:
    - Orchestrate request flow
    - Delegate validation to serializers
    - Handle errors gracefully and return consistent responses

Notes:
    - Keep views thin — no heavy business logic here
    - Identity source is Employee (hrflow_employee), not User (hrflow_users)
    - HR users can view all employees; Leads see only their direct reports
    - Audit logging is performed via _audit() for all mutating operations
"""

from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Prefetch
from django.core.paginator import Paginator

from typing import Any

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
from .serializers import LeadReviewSerializer, LeadDescriptionSerializer


class AssessmentProgressView(APIView):
    """
    Returns paginated KRA assessment progress for all employees in a given cycle.

    GET /api/v1/kra/cycles/<cycle_id>/progress

    Access:
        - HR / Vertical Lead → all enrolled employees in the cycle
        - Lead / Manager     → only employees whose manager_id = caller.id

    Query Parameters:
        employee_id (int, optional): Filter to a single employee's record.
        page (int, optional): Page number for pagination. Defaults to 1.
        per_page (int, optional): Records per page. Defaults to 20.

    Returns:
        Paginated list of employees with their KRA rows, ratings, comments,
        category weightages, and cycle-level stage dates.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, cycle_id: int) -> Response:
        caller = _get_caller(request)
        employee_id_filter = request.query_params.get("employee_id")

        ekc_qs = (
            EmployeeKRACycle.objects.filter(kra_cycle_id=cycle_id)
            .select_related(
                "employee",
                "employee__manager",
                "employee__department",
                "employee__level",
                "stage",
            )
            .prefetch_related(
                Prefetch(
                    "kra_level_rows",
                    queryset=EmployeeKRALevel.objects.select_related(
                        "kra_level",
                        "kra_level__kra",
                        "kra_level__kra__category",
                        "kra_level__category",
                        "self_rating",
                        "lead_rating",
                    ),
                )
            )
        )

        if not _is_hr(caller):
            ekc_qs = ekc_qs.filter(employee__manager_id=caller.id)

        if employee_id_filter:
            ekc_qs = ekc_qs.filter(employee_id=employee_id_filter)
            if not ekc_qs.exists():
                return Response(
                    "Employee not found in this cycle",
                    status=status.HTTP_404_NOT_FOUND,
                )

        # Pre-fetch category weightages for all ekc ids in one query
        ekc_ids: list[int] = [ekc.id for ekc in ekc_qs]
        category_map: dict[int, dict[int, dict[str, Any]]] = {}  # ekc_id → { category_id: {name, weightage} }
        for cat in EmployeeKRACycleCategory.objects.filter(
            employee_kra_cycle_id__in=ekc_ids
        ).select_related("category"):
            category_map.setdefault(cat.employee_kra_cycle_id, {})[cat.category_id] = {
                "name": cat.category.name if cat.category else None,
                "weightage": cat.weightage,
            }

        employees: list[dict[str, Any]] = []
        for ekc in ekc_qs:
            cats = category_map.get(ekc.id, {})
            kra_rows = ekc.kra_level_rows.all()

            kras = [
                {
                    "employee_kra_level_id": r.id,
                    "kra_id": r.kra_level.kra_id if r.kra_level else None,
                    "kra_name": (
                        r.kra_level.kra.name
                        if r.kra_level and r.kra_level.kra
                        else None
                    ),
                    "category_name": (
                        r.kra_level.kra.category.name
                        if r.kra_level and r.kra_level.kra and r.kra_level.kra.category
                        else None
                    ),
                    "weightage": (
                        cats.get(r.kra_level.kra.category_id, {}).get("weightage")
                        if r.kra_level and r.kra_level.kra
                        else None
                    ),
                    "self_rating_id": r.self_rating_id,
                    "self_rating": r.self_rating.rating if r.self_rating else None,
                    "self_comment": r.self_comment,
                    "lead_rating_id": r.lead_rating_id,
                    "lead_rating": r.lead_rating.rating if r.lead_rating else None,
                    "lead_comment": r.lead_comment,
                    "progress_notes": r.progress_notes,
                    "lead_progress_notes": r.lead_progress_notes,
                    "description_by_lead": r.description_by_lead,
                    "help_and_assistance_required": r.help_and_assistance_required,
                }
                for r in kra_rows
            ]

            emp = ekc.employee
            employees.append(
                {
                    "employee_id": ekc.employee_id,
                    "full_name": f"{emp.first_name} {emp.last_name}",
                    "employee_kra_cycle_id": ekc.id,
                    "status": ekc.status,
                    "current_stage_id": ekc.stage_id,
                    "current_stage_name": ekc.stage.name if ekc.stage else None,
                    "department": (
                        emp.department.department_name if emp.department else None
                    ),
                    "level": emp.level.name if emp.level else None,
                    "manager_name": (
                        f"{emp.manager.first_name} {emp.manager.last_name}"
                        if emp.manager
                        else None
                    ),
                    "kras": kras,
                }
            )

        page = int(request.query_params.get("page", 1))
        per_page = int(request.query_params.get("per_page", 20))
        paginator = Paginator(employees, per_page)
        page_obj = paginator.get_page(page)

        # Fetch cycle-level stage dates to send to frontend
        cycle_stages = [
            {
                "stage_id": cs.stage_id,
                "start_date": cs.start_date.isoformat() if cs.start_date else None,
                "end_date": cs.end_date.isoformat() if cs.end_date else None,
            }
            for cs in KRACycleStage.objects.filter(
                kra_cycle_id=cycle_id, is_deleted=False
            ).order_by("id")
        ]

        _audit(
            request,
            "ASSESSMENT_PROGRESS_VIEWED",
            "KRACycle",
            cycle_id,
            new_data={
                "employee_filter": employee_id_filter,
                "records_returned": len(employees),
                "viewer_role": (
                    caller.role.name if getattr(caller, "role", None) else None
                ),
            },
        )

        return Response(
            {
                "cycle_id": cycle_id,
                "cycle_stages": cycle_stages,
                "employees": list(page_obj),
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": paginator.count,
                    "total_pages": paginator.num_pages,
                    "has_next": page_obj.has_next(),
                    "has_prev": page_obj.has_previous(),
                },
            },
            status=status.HTTP_200_OK,
        )


class LeadReviewView(APIView):
    """
    Allows a lead or HR to submit or update their review on a specific KRA row.

    PATCH /api/v1/kra/assessments/<employee_kra_level_id>/lead-review

    All fields are optional in the PATCH — only supplied fields are updated.
    The endpoint validates that the enrolment is in Stage 3 (Self Assessment)
    or Stage 4 (Lead / HR Assessment) before accepting the update.

    Access:
        - Caller must manage the employee associated with this KRA row,
          or must be HR / Vertical Lead.
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request: Request, employee_kra_level_id: int) -> Response:
        row = get_object_or_404(
            EmployeeKRALevel.objects.select_related("employee_kra_cycle"),
            id=employee_kra_level_id,
        )

        if not row.employee_kra_cycle:
            return Response(
                "Invalid data: missing cycle", status=status.HTTP_400_BAD_REQUEST
            )

        if row.employee_kra_cycle.stage_id not in (3, 4):
            return Response(
                "Reviews can only be submitted during Assessment or HR Validation stage",
                status=status.HTTP_400_BAD_REQUEST,
            )

        caller = _get_caller(request)
        if not _caller_can_act_on(caller, row.employee_id):
            return Response("Forbidden", status=status.HTTP_403_FORBIDDEN)

        # Validate request body
        serializer = LeadReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        # OLD DATA
        old_data = {
            "lead_rating_id": row.lead_rating_id,
            "lead_comment": row.lead_comment,
            "lead_progress_notes": row.lead_progress_notes,
        }

        updated_fields: dict[str, Any] = {}

        lead_rating_id = validated.get("lead_rating_id")
        lead_comment = validated.get("lead_comment")
        lead_progress_notes = validated.get("lead_progress_notes")

        if lead_rating_id is not None:
            if not Rating.objects.filter(id=lead_rating_id).exists():
                return Response(
                    "Invalid lead_rating_id", status=status.HTTP_400_BAD_REQUEST
                )
            row.lead_rating_id = lead_rating_id
            updated_fields["lead_rating_id"] = lead_rating_id

        if lead_comment is not None:
            row.lead_comment = lead_comment
            updated_fields["lead_comment"] = lead_comment

        if lead_progress_notes is not None:
            row.lead_progress_notes = lead_progress_notes
            updated_fields["lead_progress_notes"] = lead_progress_notes

        row.save()

        # AUDIT
        _audit(
            request,
            "LEAD_REVIEW_UPDATED",
            "EmployeeKRALevel",
            row.id,
            old_data=old_data,
            new_data={
                "updated_fields": updated_fields,
                "final_state": {
                    "lead_rating_id": row.lead_rating_id,
                    "lead_comment": row.lead_comment,
                    "lead_progress_notes": row.lead_progress_notes,
                },
            },
        )

        return Response(
            {
                "employee_kra_level_id": row.id,
                "lead_rating_id": row.lead_rating_id,
                "lead_comment": row.lead_comment,
                "message": "Lead review saved",
            },
            status=status.HTTP_200_OK,
        )


class LeadDescriptionView(APIView):
    """
    Allows a lead to set the descriptive text for a specific KRA row.

    PATCH /api/v1/kra/assessments/<employee_kra_level_id>/description

    The description_by_lead field is required. The caller must manage
    the employee associated with this KRA row, or must be HR / Vertical Lead.
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request: Request, employee_kra_level_id: int) -> Response:
        # Validate request body
        serializer = LeadDescriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        description: str = validated["description_by_lead"]

        caller = _get_caller(request)
        row = get_object_or_404(
            EmployeeKRALevel.objects.select_related("employee_kra_cycle"),
            id=employee_kra_level_id,
        )

        if not row.employee_kra_cycle:
            return Response(
                "Invalid data: missing cycle", status=status.HTTP_400_BAD_REQUEST
            )

        if not _caller_can_act_on(caller, row.employee_id):
            return Response("Forbidden", status=status.HTTP_403_FORBIDDEN)

        # if row.employee_kra_cycle.stage_id not in (1, 2):
        #     return Response(
        #         'Description can only be set in Stage 1 or Stage 2',
        #         status=status.HTTP_403_FORBIDDEN,
        #     )

        # OLD DATA
        old_data = {"description_by_lead": row.description_by_lead}

        row.description_by_lead = description
        row.save()

        # AUDIT
        _audit(
            request,
            "LEAD_DESCRIPTION_UPDATED",
            "EmployeeKRALevel",
            row.id,
            old_data=old_data,
            new_data={"description_by_lead": description},
        )

        return Response(
            {
                "employee_kra_level_id": row.id,
                "message": "Description updated",
            },
            status=status.HTTP_200_OK,
        )
