from django.db.models import Prefetch
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from kra_cycle.models import (
    Employee,
    KRACycle,
    EmployeeKRACycle,
    EmployeeKRALevel,
)

HR_ROLES   = {"Admin", "HR", "Vertical Lead"}
LEAD_ROLES = {"Manager", "Team Lead"}


def _get_caller(request):
    return request.user


def _is_hr(employee):
    if employee.employee_roles.filter(role__name__in=HR_ROLES).exists():
        return True
    return bool(employee.role and employee.role.name in HR_ROLES)


def _is_lead(employee):
    if employee.employee_roles.filter(role__name__in=LEAD_ROLES).exists():
        return True
    return bool(employee.role and employee.role.name in LEAD_ROLES)


def _base_ekc_qs(caller, cycle_ids):
    """
    Returns EmployeeKRACycle queryset filtered by cycle_ids and caller permissions.
    HR sees all. Managers see only direct reports.
    """
    qs = EmployeeKRACycle.objects.filter(
        kra_cycle_id__in=cycle_ids,
    ).select_related(
        'employee',
        'employee__manager',
        'employee__previous_manager',
        'employee__department',
        'employee__level',
        'kra_cycle',
    ).prefetch_related(
        Prefetch(
            'kra_level_rows',
            queryset=EmployeeKRALevel.objects.select_related(
                'kra_level',
                'kra_level__category',
                'self_rating',
                'lead_rating',
            )
        )
    )

    if not _is_hr(caller):
        qs = qs.filter(employee__manager_id=caller.id)

    return qs


def _build_row(emp, ekc, kra_row, columns):
    """Build a single report row dict from an EmployeeKRALevel row."""
    row = {}
    if 'employee_id' in columns:
        row['employee_id'] = emp.id
    if 'employee_name' in columns:
        row['employee_name'] = f'{emp.first_name} {emp.last_name}'
    if 'department' in columns:
        row['department'] = emp.department.department_name if emp.department else None
    if 'level' in columns:
        row['level'] = emp.level.name if emp.level else None
    if 'manager' in columns:
        row['manager'] = f'{emp.manager.first_name} {emp.manager.last_name}' if emp.manager else None
    if 'previous_manager' in columns:
        row['previous_manager'] = f'{emp.previous_manager.first_name} {emp.previous_manager.last_name}' if emp.previous_manager else None
    if 'kra_name' in columns:
        row['kra_name'] = getattr(kra_row.kra_level, 'name', None)
    if 'category' in columns:
        row['category'] = getattr(kra_row.kra_level.category, 'name', None) if kra_row.kra_level else None
    if 'self_rating' in columns:
        row['self_rating'] = kra_row.self_rating.rating if kra_row.self_rating else None
    if 'self_comment' in columns:
        row['self_comment'] = kra_row.self_comment
    if 'lead_rating' in columns:
        row['lead_rating'] = kra_row.lead_rating.rating if kra_row.lead_rating else None
    if 'lead_comment' in columns:
        row['lead_comment'] = kra_row.lead_comment
    if 'progress_notes' in columns:
        row['progress_notes'] = kra_row.progress_notes
    if 'lead_progress_notes' in columns:
        row['lead_progress_notes'] = kra_row.lead_progress_notes
    if 'description_by_lead' in columns:
        row['description_by_lead'] = kra_row.description_by_lead
    return row


class MultiCycleReportView(APIView):
    """
    GET /api/v1/reports/multi-cycle

    Unified report view. Works for single or multiple cycles.

    Query params:
        cycle_ids    – comma-separated list of cycle IDs (required, min 1)
        columns      – comma-separated list of per-cycle columns to include
                       (self_rating, self_comment, lead_rating, lead_comment,
                        progress_notes, lead_progress_notes, description_by_lead)
        employee_ids – optional comma-separated list of employee IDs to filter
        search       – optional search string (matches employee name or KRA name)

    Response structure:
        {
          cycles: [ { id, name } ],
          per_cycle_columns,
          total_rows,
          rows: [
            {
              employee_id, employee_name, department, level,
              manager, previous_manager, kra_name, category,
              cycles: {
                <cycle_id>: { self_rating, lead_rating, self_comment,
                               lead_comment, progress_notes,
                               lead_progress_notes, description_by_lead }
              }
            }
          ]
        }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        caller = _get_caller(request)

        if not (_is_hr(caller) or _is_lead(caller)):
            return Response('Forbidden', status=status.HTTP_403_FORBIDDEN)

        # Parse params
        cycle_ids_param = request.query_params.get('cycle_ids', '')
        cycle_ids = [int(c) for c in cycle_ids_param.split(',') if c.strip().isdigit()]
        if not cycle_ids:
            return Response(
                {'error': 'cycle_ids is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        columns_param = request.query_params.get('columns', '')
        per_cycle_columns = [c.strip() for c in columns_param.split(',') if c.strip()] or [
            'self_rating', 'self_comment', 'lead_rating', 'lead_comment',
        ]

        employee_ids_param = request.query_params.get('employee_ids', '')
        employee_ids = [int(e) for e in employee_ids_param.split(',') if e.strip().isdigit()]
        search = request.query_params.get('search', '').strip().lower()

        cycles = KRACycle.objects.filter(id__in=cycle_ids)
        cycle_map = {c.id: c.name for c in cycles}

        ekc_qs = _base_ekc_qs(caller, cycle_ids)
        if employee_ids:
            ekc_qs = ekc_qs.filter(employee_id__in=employee_ids)

        # Build: { (employee_id, kra_level_id) → row_dict }
        # Each row has base fields + a `cycles` dict keyed by cycle_id
        aggregated = {}  # key: (employee_id, kra_level_id)

        for ekc in ekc_qs:
            emp = ekc.employee
            cid = ekc.kra_cycle_id

            for kra_row in ekc.kra_level_rows.all():
                key = (emp.id, kra_row.kra_level_id)

                if key not in aggregated:
                    aggregated[key] = {
                        'employee_id':      emp.id,
                        'employee_name':    f'{emp.first_name} {emp.last_name}',
                        'department':       emp.department.department_name if emp.department else None,
                        'level':            emp.level.name if emp.level else None,
                        'manager':          f'{emp.manager.first_name} {emp.manager.last_name}' if emp.manager else None,
                        'previous_manager': f'{emp.previous_manager.first_name} {emp.previous_manager.last_name}' if emp.previous_manager else None,
                        'kra_name':         getattr(kra_row.kra_level, 'name', None),
                        'category':         getattr(kra_row.kra_level.category, 'name', None) if kra_row.kra_level else None,
                        'cycles':           {str(c): None for c in cycle_ids},
                    }

                cycle_data = {}
                if 'self_rating' in per_cycle_columns:
                    cycle_data['self_rating'] = kra_row.self_rating.rating if kra_row.self_rating else None
                if 'self_comment' in per_cycle_columns:
                    cycle_data['self_comment'] = kra_row.self_comment
                if 'lead_rating' in per_cycle_columns:
                    cycle_data['lead_rating'] = kra_row.lead_rating.rating if kra_row.lead_rating else None
                if 'lead_comment' in per_cycle_columns:
                    cycle_data['lead_comment'] = kra_row.lead_comment
                if 'progress_notes' in per_cycle_columns:
                    cycle_data['progress_notes'] = kra_row.progress_notes
                if 'lead_progress_notes' in per_cycle_columns:
                    cycle_data['lead_progress_notes'] = kra_row.lead_progress_notes
                if 'description_by_lead' in per_cycle_columns:
                    cycle_data['description_by_lead'] = kra_row.description_by_lead

                aggregated[key]['cycles'][str(cid)] = cycle_data

        rows = list(aggregated.values())

        # Apply search
        if search:
            rows = [
                r for r in rows
                if search in r['employee_name'].lower()
                or search in (r['kra_name'] or '').lower()
            ]

        # Sort by employee name then KRA name
        rows.sort(key=lambda r: (r['employee_name'], r['kra_name'] or ''))

        return Response({
            'cycles':          [{'id': cid, 'name': cycle_map.get(cid, str(cid))} for cid in cycle_ids],
            'per_cycle_columns': per_cycle_columns,
            'total_rows':      len(rows),
            'rows':            rows,
        }, status=status.HTTP_200_OK)