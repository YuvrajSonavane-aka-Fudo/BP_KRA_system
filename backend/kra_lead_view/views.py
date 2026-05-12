from django.shortcuts import render

# Create your views here.
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
        employee = _get_caller(request),
        action = action,
        entity = entity,
        entity_id = entity_id,
        old_data = old_data,
        new_data = new_data,
        ip_address = request.META.get("REMOTE_ADDR"),
    )
    
class AssessmentProgressView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, cycle_id):
        caller             = _get_caller(request)
        employee_id_filter = request.query_params.get('employee_id')

        ekc_qs = EmployeeKRACycle.objects.filter(
            kra_cycle_id=cycle_id
        ).select_related(
            'employee',
            'employee__manager',       # ← for manager_name
            'employee__department',    # ← for department
            'employee__level',         # ← for level
            'stage',
        )

        if not _is_hr(caller):
            ekc_qs = ekc_qs.filter(employee__manager_id=caller.id)

        if employee_id_filter:
            ekc_qs = ekc_qs.filter(employee_id=employee_id_filter)
            if not ekc_qs.exists():
                return Response(
                    'Employee not found in this cycle',
                    status=status.HTTP_404_NOT_FOUND,
                )

        # Pre-fetch category weightages for all ekc ids in one query
        ekc_ids = [ekc.id for ekc in ekc_qs]
        category_map = {}  # ekc_id → { category_id: weightage }
        for cat in EmployeeKRACycleCategory.objects.filter(
            employee_kra_cycle_id__in=ekc_ids
        ).select_related('category'):
            category_map.setdefault(cat.employee_kra_cycle_id, {})[cat.category_id] = {
                'name':      cat.category.name if cat.category else None,
                'weightage': cat.weightage,
            }

        employees = []
        for ekc in ekc_qs:
            cats = category_map.get(ekc.id, {})

            kra_rows = ekc.kra_level_rows.select_related(
                'kra_level',
                'kra_level__category',  # ← for category_name per KRA
                'self_rating',
                'lead_rating',
            )

            kras = [
                {
                    'employee_kra_level_id':      r.id,
                    'kra_level_id':               r.kra_level_id,
                    'kra_name':                   getattr(r.kra_level, 'name', None),
                    'category_name':              getattr(r.kra_level.category, 'name', None) if r.kra_level else None,
                    'weightage':                  cats.get(r.kra_level.category_id, {}).get('weightage') if r.kra_level else None,
                    'self_rating_id':             r.self_rating_id,
                    'self_rating':                r.self_rating.rating if r.self_rating else None,
                    'self_comment':               r.self_comment,
                    'lead_rating_id':             r.lead_rating_id,
                    'lead_rating':                r.lead_rating.rating if r.lead_rating else None,
                    'lead_comment':               r.lead_comment,
                    'progress_notes':             r.progress_notes,
                    'lead_progress_notes':        r.lead_progress_notes,
                    'description_by_lead':        r.description_by_lead,
                    'help_and_assistance_required': r.help_and_assistance_required,
                }
                for r in kra_rows
            ]

            emp = ekc.employee
            employees.append({
                'employee_id':           ekc.employee_id,
                'full_name':             f'{emp.first_name} {emp.last_name}',
                'employee_kra_cycle_id': ekc.id,
                'status':                ekc.status,
                'current_stage_id':      ekc.stage_id,
                'current_stage_name':    ekc.stage.name if ekc.stage else None,
                'department':            emp.department.department_name if emp.department else None,
                'level':                 emp.level.name if emp.level else None,
                'manager_name':          f'{emp.manager.first_name} {emp.manager.last_name}' if emp.manager else None,
                'kras':                  kras,
            })

        _audit(
            request,
            "ASSESSMENT_PROGRESS_VIEWED",
            "KRACycle",
            cycle_id,
            new_data={
                "employee_filter":  employee_id_filter,
                "records_returned": len(employees),
                "viewer_role":      caller.role.name if getattr(caller, "role", None) else None,
            }
        )

        return Response({'cycle_id': cycle_id, 'employees': employees}, status=status.HTTP_200_OK)
    
class LeadReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, employee_kra_level_id):
        row = get_object_or_404(
            EmployeeKRALevel.objects.select_related('employee_kra_cycle'),
            id=employee_kra_level_id,
        )

        if not row.employee_kra_cycle:
            return Response('Invalid data: missing cycle', status=status.HTTP_400_BAD_REQUEST)

        if row.employee_kra_cycle.stage_id not in (3, 4):
            return Response(
                'Reviews can only be submitted during Assessment or HR Validation stage',
                status=status.HTTP_400_BAD_REQUEST,
            )

        caller = _get_caller(request)
        if not _caller_can_act_on(caller, row.employee_id):
            return Response('Forbidden', status=status.HTTP_403_FORBIDDEN)

        #  OLD DATA
        old_data = {
            "lead_rating_id": row.lead_rating_id,
            "lead_comment": row.lead_comment,
            "lead_progress_notes": row.lead_progress_notes,
        }

        updated_fields = {}

        lead_rating_id      = request.data.get('lead_rating_id')
        lead_comment        = request.data.get('lead_comment')
        lead_progress_notes = request.data.get('lead_progress_notes')

        if lead_rating_id is not None:
            if not Rating.objects.filter(id=lead_rating_id).exists():
                return Response('Invalid lead_rating_id', status=status.HTTP_400_BAD_REQUEST)
            row.lead_rating_id = lead_rating_id
            updated_fields["lead_rating_id"] = lead_rating_id

        if lead_comment is not None:
            row.lead_comment = lead_comment
            updated_fields["lead_comment"] = lead_comment

        if lead_progress_notes is not None:
            row.lead_progress_notes = lead_progress_notes
            updated_fields["lead_progress_notes"] = lead_progress_notes

        row.save()

        #  AUDIT
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
                }
            }
        )

        return Response({
            'employee_kra_level_id': row.id,
            'lead_rating_id': row.lead_rating_id,
            'lead_comment': row.lead_comment,
            'message': 'Lead review saved',
        }, status=status.HTTP_200_OK)
    
class LeadDescriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, employee_kra_level_id):
        description = request.data.get('description_by_lead')
        if description is None:
            return Response(
                'description_by_lead is required',
                status=status.HTTP_400_BAD_REQUEST,
            )

        caller = _get_caller(request)
        row = get_object_or_404(
            EmployeeKRALevel.objects.select_related('employee_kra_cycle'),
            id=employee_kra_level_id,
        )

        if not row.employee_kra_cycle:
            return Response('Invalid data: missing cycle', status=status.HTTP_400_BAD_REQUEST)

        if not _caller_can_act_on(caller, row.employee_id):
            return Response('Forbidden', status=status.HTTP_403_FORBIDDEN)

        if row.employee_kra_cycle.stage_id not in (1, 2):
            return Response(
                'Description can only be set in Stage 1 or Stage 2',
                status=status.HTTP_403_FORBIDDEN,
            )

        # OLD DATA
        old_data = {
            "description_by_lead": row.description_by_lead
        }

        row.description_by_lead = description
        row.save()

        #  AUDIT
        _audit(
            request,
            "LEAD_DESCRIPTION_UPDATED",
            "EmployeeKRALevel",
            row.id,
            old_data=old_data,
            new_data={
                "description_by_lead": description
            }
        )

        return Response({
            'employee_kra_level_id': row.id,
            'message': 'Description updated',
        }, status=status.HTTP_200_OK)