"""
File: views.py
App: kra_lead_view
Purpose:
    Handles HTTP request/response lifecycle for KRA lead review and assessment endpoints.
    Manages lead ratings, comments, progress tracking, and descriptive assessments.

Includes:
    - API views for lead review operations
    - Pagination support for large datasets
    - Request validation using serializers
    - Response formatting with assessment progress data

Responsibilities:
    - Orchestrate assessment and review request flow
    - Delegate complex data queries to utils (raw SQL)
    - Enforce role-based access control (HR, Manager, Lead)
    - Validate stage-specific operations (can only review during Assessment/HR Validation)
    - Generate audit logs for review changes

Notes:
    - Keep views thin, no direct DB-heavy logic
    - Use raw SQL utility (get_assessment_progress_data) for nested aggregations
    - Identity source: Employee (hrflow_employee), not User (hrflow_users)
    - Assessment progress requires caller authorization check
    - Reviews can only be submitted during specific cycle stages
"""

from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.paginator import Paginator

from typing import Any

from kra_cycle.models import (
    Employee,
    KRACycle,
    KRACycleStage,
    EmployeeKRACycle,
    EmployeeKRACycleCategory,
    EmployeeKRALevel,
    Rating,
)

from utils import _get_caller, _is_hr, _caller_can_act_on, _audit
from .serializers import LeadReviewSerializer, LeadDescriptionSerializer
from .utils import get_assessment_progress_data


class AssessmentProgressView(APIView):
    """
    Returns paginated KRA assessment progress for all employees in a given cycle.

    Endpoint: GET /api/v1/kra/cycles/<cycle_id>/progress

    Request Headers:
        Authorization: Bearer <token> (required)

    Query Parameters:
        employee_id:  Optional. Filter to specific employee in cycle.
        page:         Optional. Page number (default: 1).
        per_page:     Optional. Results per page (default: 20).

    Response (200):
        {
            "cycle_id": <id>,
            "cycle_stages": [
                {
                    "stage_id": <id>,
                    "start_date": "2026-06-24T00:00:00",
                    "end_date": "2026-07-07T00:00:00"
                }
            ],
            "employees": [
                {
                    "employee_id": <id>,
                    "full_name": "<name>",
                    "progress": {
                        "total_kras": <count>,
                        "completed": <count>,
                        "pending": <count>,
                        "progress_percentage": <float>
                    }
                }
            ],
            "pagination": {
                "page": 1,
                "per_page": 20,
                "total": <count>,
                "total_pages": <count>,
                "has_next": true/false,
                "has_prev": true/false
            }
        }

    Error Responses:
        404: Specific employee_id provided but not found in cycle

    Access Control:
        - HR: Views all employees in cycle
        - Manager/Lead: Views only own direct reports

    Performance:
        - Uses raw SQL (get_assessment_progress_data) for nested aggregations
        - Paginated to handle large employee lists efficiently
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, cycle_id: int) -> Response:
        caller = _get_caller(request)
        employee_id_filter = request.query_params.get("employee_id")
        
        is_hr_user = _is_hr(caller)

        # 1. Fetch aggregated nested data via Raw SQL util
        employees = get_assessment_progress_data(
            cycle_id=cycle_id, 
            caller_id=caller.id, 
            is_hr=is_hr_user, 
            employee_id_filter=employee_id_filter
        )

        if employee_id_filter and not employees:
            return Response(
                "Employee not found in this cycle",
                status=status.HTTP_404_NOT_FOUND,
            )

        page = int(request.query_params.get("page", 1))
        per_page = int(request.query_params.get("per_page", 20))
        paginator = Paginator(employees, per_page)
        page_obj = paginator.get_page(page)

        cycle_stages = [
            {
                "stage_id": cycle_stage.stage_id,
                "start_date": cycle_stage.start_date.isoformat() if cycle_stage.start_date else None,
                "end_date": cycle_stage.end_date.isoformat() if cycle_stage.end_date else None,
            }
            for cycle_stage in KRACycleStage.objects.filter(
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

    Endpoint: PATCH /api/v1/kra/kra-levels/<employee_kra_level_id>/review

    Request Headers:
        Authorization: Bearer <token> (required)
        Content-Type: application/json

    Request Body:
        {
            "lead_rating_id": <rating_id>,          // Optional
            "lead_comment": "Review comment text",  // Optional
            "lead_progress_notes": "Notes..."       // Optional
        }

    Response (200):
        {
            "employee_kra_level_id": <id>,
            "lead_rating_id": <rating_id>,
            "lead_comment": "Review comment text",
            "message": "Lead review saved"
        }

    Error Responses:
        400: Invalid rating_id or missing cycle data
        403: Caller cannot act on this employee (not manager/lead)
        404: KRA row not found

    Restrictions:
        - Reviews only allowed during stage 3 (Assessment) or stage 4 (HR Validation)
        - Caller must be the lead/manager of the employee

    Validation:
        - lead_rating_id must exist in Rating table
        - lead_comment: max 1000 chars (enforced by serializer)
        - lead_progress_notes: max 2000 chars (enforced by serializer)
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request: Request, employee_kra_level_id: int) -> Response:
        kra_row = get_object_or_404(
            EmployeeKRALevel.objects.select_related("employee_kra_cycle"),
            id=employee_kra_level_id,
        )

        if not kra_row.employee_kra_cycle:
            return Response(
                "Invalid data: missing cycle", status=status.HTTP_400_BAD_REQUEST
            )

        if kra_row.employee_kra_cycle.stage_id not in (3, 4):
            return Response(
                "Reviews can only be submitted during Assessment or HR Validation stage",
                status=status.HTTP_400_BAD_REQUEST,
            )

        caller = _get_caller(request)
        if not _caller_can_act_on(caller, kra_row.employee_id):
            return Response("Forbidden", status=status.HTTP_403_FORBIDDEN)

        serializer = LeadReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        old_data = {
            "lead_rating_id": kra_row.lead_rating_id,
            "lead_comment": kra_row.lead_comment,
            "lead_progress_notes": kra_row.lead_progress_notes,
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
            kra_row.lead_rating_id = lead_rating_id
            updated_fields["lead_rating_id"] = lead_rating_id

        if lead_comment is not None:
            kra_row.lead_comment = lead_comment
            updated_fields["lead_comment"] = lead_comment

        if lead_progress_notes is not None:
            kra_row.lead_progress_notes = lead_progress_notes
            updated_fields["lead_progress_notes"] = lead_progress_notes

        kra_row.save()

        _audit(
            request,
            "LEAD_REVIEW_UPDATED",
            "EmployeeKRALevel",
            kra_row.id,
            old_data=old_data,
            new_data={
                "updated_fields": updated_fields,
                "final_state": {
                    "lead_rating_id": kra_row.lead_rating_id,
                    "lead_comment": kra_row.lead_comment,
                    "lead_progress_notes": kra_row.lead_progress_notes,
                },
            },
        )

        return Response(
            {
                "employee_kra_level_id": kra_row.id,
                "lead_rating_id": kra_row.lead_rating_id,
                "lead_comment": kra_row.lead_comment,
                "message": "Lead review saved",
            },
            status=status.HTTP_200_OK,
        )


class LeadDescriptionView(APIView):
    """
    Allows a lead to set the descriptive text for a specific KRA row.

    Endpoint: PATCH /api/v1/kra/kra-levels/<employee_kra_level_id>/description

    Request Headers:
        Authorization: Bearer <token> (required)
        Content-Type: application/json

    Request Body:
        {
            "description_by_lead": "Detailed KRA description and expectations..."
        }

    Response (200):
        {
            "employee_kra_level_id": <id>,
            "message": "Description updated"
        }

    Error Responses:
        400: Missing required field or invalid cycle data
        403: Caller cannot act on this employee (not manager/lead)
        404: KRA row not found

    Permissions:
        - Caller must be the lead/manager of the employee
        - Can be set at any time during the cycle (no stage restriction)

    Notes:
        - Description captures lead's expectations and context for the KRA
        - Field: description_by_lead (up to 5000 chars)
        - All updates are audit-logged for compliance
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request: Request, employee_kra_level_id: int) -> Response:
        serializer = LeadDescriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        description: str = validated["description_by_lead"]

        caller = _get_caller(request)
        kra_row = get_object_or_404(
            EmployeeKRALevel.objects.select_related("employee_kra_cycle"),
            id=employee_kra_level_id,
        )

        if not kra_row.employee_kra_cycle:
            return Response(
                "Invalid data: missing cycle", status=status.HTTP_400_BAD_REQUEST
            )

        if not _caller_can_act_on(caller, kra_row.employee_id):
            return Response("Forbidden", status=status.HTTP_403_FORBIDDEN)

        old_data = {"description_by_lead": kra_row.description_by_lead}

        kra_row.description_by_lead = description
        kra_row.save()

        _audit(
            request,
            "LEAD_DESCRIPTION_UPDATED",
            "EmployeeKRALevel",
            kra_row.id,
            old_data=old_data,
            new_data={"description_by_lead": description},
        )

        return Response(
            {
                "employee_kra_level_id": kra_row.id,
                "message": "Description updated",
            },
            status=status.HTTP_200_OK,
        )
