"""
File: views.py
App: kra_self_assessment
Purpose:
    Handles HTTP requests/responses for KRA Self Assessment API endpoints.

Includes:
    - SelfAssessmentView: Retrieve KRA self assessment details for a cycle.
    - SelfAssessmentSubmitView: Save/update individual self assessment entries.

Responsibilities:
    - Process KRA self assessment queries and validation for employees.

Notes:
    - Keeps views thin, delegates data validation and structure formatting to serializers.py.
    - Identity source is Employee, using session-based authentication.
"""

from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.request import Request

from kra_cycle.models import (
    EmployeeKRACycle,
    EmployeeKRACycleStage,
    EmployeeKRALevel,
    KRACycleStage,
    Stage,
    Rating,
    KRALevel,
)

from utils import _get_caller, _audit

from .serializers import (
    SelfAssessmentSerializer,
    SelfAssessmentUpdateSerializer,
)


class SelfAssessmentView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, cycle_id: int) -> Response:
        """
        API view to list all self assessments for the authenticated caller under a specific cycle.

        Endpoint: GET /api/v1/kra/cycles/<cycle_id>/self-assessment

        Request Headers:
            Authorization: Required

        Request Body:
            None

        Response (200):
            {
                "cycle_id": 1,
                "employee_kra_cycle_id": 12,
                "status": "Draft",
                "employee_stage_id": 2,
                "stage_end_date": "2026-07-20T00:00:00",
                "current_stage": {
                    "id": 2,
                    "name": "KRA Tracking"
                },
                "kras": [
                    {
                        "employee_kra_level_id": 15,
                        "kra_level_id": 10,
                        "kra_name": "Coding Speed",
                        "category_name": "Core Development",
                        "description_by_lead": "Requires high output",
                        "help_and_assistance_required": "None",
                        "self_rating_id": 3,
                        "self_rating": 3,
                        "self_comment": "Met expectations",
                        "progress_notes": "None",
                        "lead_rating_id": null,
                        "lead_rating": null,
                        "lead_comment": null,
                        "lead_progress_notes": null
                    }
                ]
            }

        Error Responses:
            403: Forbidden (Employee not enrolled in cycle)
            401: Unauthorized
        """
        caller = _get_caller(request)

        ekc = EmployeeKRACycle.objects.select_related('stage').filter(
            employee=caller, kra_cycle_id=cycle_id
        ).first()

        if not ekc:
            return Response('Forbidden', status=status.HTTP_403_FORBIDDEN)

        raw_sql = """
            SELECT ekl.*
            FROM employee_kra_level ekl
            WHERE ekl.employee_id = %s AND ekl.employee_kra_cycle_id = %s
        """
        kra_rows = list(EmployeeKRALevel.objects.raw(raw_sql, [caller.id, ekc.id]))

        # Pre-populate the related models in Python to prevent N+1 lazy queries during serialization
        kra_level_ids = {r.kra_level_id for r in kra_rows if r.kra_level_id is not None}
        kra_levels = {
            kl.id: kl for kl in KRALevel.objects.filter(id__in=kra_level_ids).select_related('kra', 'category')
        }

        rating_ids = {r.self_rating_id for r in kra_rows if r.self_rating_id is not None} | \
                     {r.lead_rating_id for r in kra_rows if r.lead_rating_id is not None}
        ratings = {rt.id: rt for rt in Rating.objects.filter(id__in=rating_ids)}

        for r in kra_rows:
            if r.kra_level_id in kra_levels:
                r.kra_level = kra_levels[r.kra_level_id]
            if r.self_rating_id in ratings:
                r.self_rating = ratings[r.self_rating_id]
            if r.lead_rating_id in ratings:
                r.lead_rating = ratings[r.lead_rating_id]

        # Resolve the employee's effective current stage (personal override takes priority)
        employee_stage_id = ekc.stage_id

        # Look up personal stage date override for the current stage (if any)
        stage_end_date = None
        if employee_stage_id:
            override = EmployeeKRACycleStage.objects.filter(
                employee_kra_cycle=ekc,
                stage_id=employee_stage_id,
            ).first()
            if override:
                stage_end_date = override.end_date.isoformat() if override.end_date else None
            else:
                # Fall back to cycle-level stage date
                cycle_stage = KRACycleStage.objects.filter(
                    kra_cycle_id=cycle_id,
                    stage_id=employee_stage_id,
                ).first()
                if cycle_stage and cycle_stage.end_date:
                    stage_end_date = cycle_stage.end_date.isoformat()

        serializer = SelfAssessmentSerializer(ekc, context={
            'stage_end_date': stage_end_date,
            'kra_rows': kra_rows,
        })
        return Response(serializer.data, status=status.HTTP_200_OK)


class SelfAssessmentSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request, employee_kra_level_id: int) -> Response:
        """
        API view to save or update individual self assessment details (rating, comments, progress notes).

        Endpoint: PATCH /api/v1/kra/assessments/<employee_kra_level_id>/self

        Request Headers:
            Authorization: Required

        Request Body:
            {
                "self_rating_id": 3,
                "self_comment": "Successfully finished task",
                "progress_notes": "Sprint 3 goals achieved",
                "help_and_assistance_required": "None"
            }

        Response (200):
            {
                "employee_kra_level_id": 15,
                "self_rating_id": 3,
                "message": "Self assessment saved"
            }

        Error Responses:
            400: Self assessment only allowed during KRA Tracking or Assessment stage, or invalid self_rating_id
            404: Employee KRA level not found
            401: Unauthorized
        """
        caller = _get_caller(request)

        row = get_object_or_404(
            EmployeeKRALevel.objects.select_related('employee_kra_cycle'),
            id=employee_kra_level_id,
            employee=caller,
        )

        if row.employee_kra_cycle.stage_id not in (2, 3):
            return Response(
                'Self assessment only allowed during KRA Tracking or Assessment stage',
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Capture OLD DATA for audit
        old_data = {
            "self_rating_id": row.self_rating_id,
            "self_comment": row.self_comment,
            "progress_notes": row.progress_notes,
            "help_and_assistance_required": row.help_and_assistance_required,
        }

        serializer = SelfAssessmentUpdateSerializer(row, data=request.data, partial=True)
        if not serializer.is_valid():
            if 'self_rating' in serializer.errors:
                return Response('Invalid self_rating_id', status=status.HTTP_400_BAD_REQUEST)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Track what fields are being updated for audit logs
        updated_fields = {}
        for field in ['self_comment', 'progress_notes', 'help_and_assistance_required']:
            if field in request.data:
                updated_fields[field] = request.data[field]
        if 'self_rating_id' in request.data:
            updated_fields['self_rating_id'] = request.data['self_rating_id']

        serializer.save()

        # AUDIT LOG
        _audit(
            request,
            "SELF_ASSESSMENT_UPDATED",
            "EmployeeKRALevel",
            row.id,
            old_data=old_data,
            new_data={
                "updated_fields": updated_fields,
                "final_state": {
                    "self_rating_id": row.self_rating_id,
                    "self_comment": row.self_comment,
                    "progress_notes": row.progress_notes,
                    "help_and_assistance_required": row.help_and_assistance_required,
                }
            }
        )

        return Response({
            'employee_kra_level_id': row.id,
            'self_rating_id': row.self_rating_id,
            'message': 'Self assessment saved',
        }, status=status.HTTP_200_OK)