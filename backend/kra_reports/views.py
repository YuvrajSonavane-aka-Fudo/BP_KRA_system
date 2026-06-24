"""
File: views.py
App: kra_reports
Purpose:
    - Defines API views for generating KRA reports.

Includes:
    - MultiCycleReportView

Responsibilities:
    - Fetches all relevant KRA data for multiple cycles.
    - Filters data based on user permissions (HR sees all, Managers see direct reports).
    - Uses serializers to format data for frontend consumption.
    - Handles dynamic column selection for flexibility.

Notes:
    - Created to support flexible reporting across multiple cycles.
    - Optimized to minimize database queries.
    - Provides consistent data structure for frontend charts and tables.
"""

from django.db.models import Prefetch
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.request import Request

from kra_cycle.models import (
    Employee,
    KRACycle,
    EmployeeKRACycle,
    EmployeeKRALevel,
)

from utils import _get_caller, _is_hr, _is_lead
from .serializers import EmployeeKRALevelReportSerializer


def _base_ekc_qs(caller: Employee, cycle_ids: list[int]):
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
                'kra_level__kra__category',  # real name + real category in one join
                'self_rating',
                'lead_rating',
            )
        )
    )

    if not _is_hr(caller):
        qs = qs.filter(employee__manager_id=caller.id)

    return qs


class MultiCycleReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        """
        API view to generate a report showing employee assessment data across one or more KRA cycles.

        Endpoint: GET /api/v1/reports/multi-cycle

        Request Headers:
            Authorization: Required

        Request Body:
            None

        Response (200):
            {
                "cycles": [
                    {
                        "id": 1,
                        "name": "Cycle 1"
                    }
                ],
                "per_cycle_columns": [
                    "self_rating",
                    "self_comment",
                    "lead_rating",
                    "lead_comment"
                ],
                "total_rows": 1,
                "rows": [
                    {
                        "employee_id": 1,
                        "employee_name": "John Doe",
                        "department": "Engineering",
                        "level": "Dev-01",
                        "manager": "Manager Name",
                        "previous_manager": null,
                        "kra_name": "Deliver features",
                        "category": "Core Development",
                        "cycles": {
                            "1": {
                                "self_rating": 4,
                                "self_comment": "Good progress",
                                "lead_rating": 4,
                                "lead_comment": "Agreed"
                            }
                        }
                    }
                ]
            }

        Error Responses:
            400: cycle_ids is required
            403: Forbidden for non-HR and non-Leads
            401: Unauthorized
        """
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
                    base_serializer = EmployeeKRALevelReportSerializer(
                        kra_row,
                        context={'columns': [
                            'employee_id', 'employee_name', 'department', 'level',
                            'manager', 'previous_manager', 'kra_name', 'category'
                        ]}
                    )
                    aggregated[key] = {
                        **base_serializer.data,
                        'cycles': {str(c): None for c in cycle_ids},
                    }

                cycle_serializer = EmployeeKRALevelReportSerializer(
                    kra_row,
                    context={'columns': per_cycle_columns}
                )
                aggregated[key]['cycles'][str(cid)] = cycle_serializer.data

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