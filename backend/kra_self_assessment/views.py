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
    EmployeeKRACycleStage,
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

class SelfAssessmentView(APIView):
    """
    GET /api/v1/kra/cycles/{cycle_id}/self-assessment
    Returns the logged-in employee's KRAs for the given cycle.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, cycle_id):
        caller = _get_caller(request)

        ekc = EmployeeKRACycle.objects.select_related('stage').filter(
            employee=caller, kra_cycle_id=cycle_id
        ).first()

        if not ekc:
            return Response('Forbidden', status=status.HTTP_403_FORBIDDEN)

        kra_rows = ekc.kra_level_rows.select_related(
            'kra_level', 'self_rating', 'lead_rating'
        )

        kras = [
            {
                'employee_kra_level_id':       r.id,
                'kra_level_id':                r.kra_level_id,
                'kra_name':                    getattr(r.kra_level, 'name', None),
                'description_by_lead':         r.description_by_lead,
                'help_and_assistance_required': r.help_and_assistance_required,
                'self_rating_id':              r.self_rating_id,
                'self_rating':                 r.self_rating.rating if r.self_rating else None,
                'self_comment':                r.self_comment,
                'progress_notes':              r.progress_notes,
                'lead_rating_id':              r.lead_rating_id,
                'lead_rating':                 r.lead_rating.rating if r.lead_rating else None,
                'lead_comment':                r.lead_comment,
                'lead_progress_notes':         r.lead_progress_notes,
            }
            for r in kra_rows
        ]

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

        return Response({
            'cycle_id':              cycle_id,
            'employee_kra_cycle_id': ekc.id,
            'status':                ekc.status,
            # employee_stage_id: the employee's personal stage (may differ from cycle stage if sent back)
            'employee_stage_id':     employee_stage_id,
            # stage_end_date: personal deadline for current stage (from override or cycle-level)
            'stage_end_date':        stage_end_date,
            'current_stage':         (
                {'id': ekc.stage.id, 'name': ekc.stage.name}
                if ekc.stage else None
            ),
            'kras': kras,
        }, status=status.HTTP_200_OK)
        

class SelfAssessmentSubmitView(APIView):
    """
    PATCH /api/v1/kra/assessments/{employee_kra_level_id}/self
    Employee saves self_rating, self_comment, progress_notes.
    Allowed in Stage 2 (KRA Tracking) or Stage 3 (Assessment).
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, employee_kra_level_id):
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

        data = request.data

        # Capture OLD DATA for audit 
        old_data = {
            "self_rating_id": row.self_rating_id,
            "self_comment": row.self_comment,
            "progress_notes": row.progress_notes,
            "help_and_assistance_required": row.help_and_assistance_required,
        }

        updated_fields = {}

        #  Apply updates 
        self_rating_id = data.get('self_rating_id')
        if self_rating_id is not None:
            if not Rating.objects.filter(id=self_rating_id).exists():
                return Response('Invalid self_rating_id', status=status.HTTP_400_BAD_REQUEST)
            row.self_rating_id = self_rating_id
            updated_fields["self_rating_id"] = self_rating_id

        if 'self_comment' in data:
            row.self_comment = data['self_comment']
            updated_fields["self_comment"] = data['self_comment']

        if 'progress_notes' in data:
            row.progress_notes = data['progress_notes']
            updated_fields["progress_notes"] = data['progress_notes']

        if 'help_and_assistance_required' in data:
            row.help_and_assistance_required = data['help_and_assistance_required']
            updated_fields["help_and_assistance_required"] = data['help_and_assistance_required']

        row.save()

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