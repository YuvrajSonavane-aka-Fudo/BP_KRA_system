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
    Department,
    Level,
    Rating,
    KRA,
    KRACategory,
    KRALevel,
)

from kra_reports.serializers import EmployeeKRALevelReportSerializer
from utils import _get_caller, _is_hr, _is_lead


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
        cycle_ids = [int(cid_str) for cid_str in cycle_ids_param.split(',') if cid_str.strip().isdigit()]
        if not cycle_ids:
            return Response(
                {'error': 'cycle_ids is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        columns_param = request.query_params.get('columns', '')
        per_cycle_columns = [col.strip() for col in columns_param.split(',') if col.strip()] or [
            'self_rating', 'self_comment', 'lead_rating', 'lead_comment',
        ]

        employee_ids_param = request.query_params.get('employee_ids', '')
        employee_ids = [int(emp_id) for emp_id in employee_ids_param.split(',') if emp_id.strip().isdigit()]
        search = request.query_params.get('search', '').strip().lower()

        cycles = KRACycle.objects.filter(id__in=cycle_ids)
        cycle_map = {cycle.id: cycle.name for cycle in cycles}

        # Build Raw SQL Query to fetch EmployeeKRALevel records directly with JOINS
        sql = """
            SELECT ekl.id, ekl.employee_id, ekl.kra_level_id, ekl.description_by_lead, ekl.help_and_assistance_required,
                   ekl.self_rating_id, ekl.self_comment, ekl.lead_rating_id, ekl.lead_comment, ekl.progress_notes,
                   ekl.employee_kra_cycle_id, ekl.lead_progress_notes, ekl.assigned_by_role,
                   
                   -- employee details
                   e.first_name AS emp_first_name, e.last_name AS emp_last_name, e.manager_id AS emp_manager_id,
                   e.previous_manager_id AS emp_prev_manager_id, e.department_id AS emp_dept_id, e.level_id AS emp_lvl_id,
                   
                   -- manager details
                   mgr.first_name AS mgr_first_name, mgr.last_name AS mgr_last_name,
                   
                   -- previous manager details
                   pmgr.first_name AS pmgr_first_name, pmgr.last_name AS pmgr_last_name,
                   
                   -- department details
                   dept.department_name AS dept_name,
                   
                   -- level details
                   lvl.name AS lvl_name,
                   
                   -- kra_level, kra, and kra_category details
                   kl.kra_id AS kl_kra_id, kl.level_id AS kl_lvl_id, kl.name AS kl_name, kl.category_id AS kl_cat_id,
                   k.name AS kra_name, k.description AS kra_desc, k.is_standard AS kra_std, k.category_id AS kra_cat_id,
                   cat.name AS cat_name, cat.description AS cat_desc, cat.is_standard AS cat_std,
                   
                   -- self_rating rating
                   sr.rating AS self_rating_val,
                   
                   -- lead_rating rating
                   lr.rating AS lead_rating_val,
                   
                   -- cycle_id
                   ekc.kra_cycle_id AS cycle_id
                   
            FROM employee_kra_level ekl
            INNER JOIN employee_kra_cycle ekc ON ekl.employee_kra_cycle_id = ekc.id
            INNER JOIN employee e ON ekl.employee_id = e.id
            LEFT JOIN employee mgr ON e.manager_id = mgr.id
            LEFT JOIN employee pmgr ON e.previous_manager_id = pmgr.id
            LEFT JOIN department dept ON e.department_id = dept.id
            LEFT JOIN level lvl ON e.level_id = lvl.id
            INNER JOIN kra_level kl ON ekl.kra_level_id = kl.id
            INNER JOIN kra k ON kl.kra_id = k.id
            LEFT JOIN category cat ON k.category_id = cat.id
            LEFT JOIN rating sr ON ekl.self_rating_id = sr.id
            LEFT JOIN rating lr ON ekl.lead_rating_id = lr.id
        """
        params = []
        conditions = ["ekc.kra_cycle_id IN %s"]
        params.append(tuple(cycle_ids))

        if employee_ids:
            conditions.append("ekl.employee_id IN %s")
            params.append(tuple(employee_ids))

        if not _is_hr(caller):
            conditions.append("e.manager_id = %s")
            params.append(caller.id)

        sql += " WHERE " + " AND ".join(conditions)

        raw_qs = EmployeeKRALevel.objects.raw(sql, params)

        # Build: { (employee_id, kra_level_id) → row_dict }
        # Each row has base fields + a `cycles` dict keyed by cycle_id
        aggregated = {}  # key: (employee_id, kra_level_id)

        for ekl in raw_qs:
            # Instantiate Employee
            employee_obj = Employee(
                id=ekl.employee_id,
                first_name=getattr(ekl, 'emp_first_name', ''),
                last_name=getattr(ekl, 'emp_last_name', ''),
            )
            
            # Department
            if getattr(ekl, 'emp_dept_id', None):
                employee_obj.department = Department(
                    id=ekl.emp_dept_id,
                    department_name=getattr(ekl, 'dept_name', '')
                )
            else:
                employee_obj.department = None
                
            # Level
            if getattr(ekl, 'emp_lvl_id', None):
                employee_obj.level = Level(
                    id=ekl.emp_lvl_id,
                    name=getattr(ekl, 'lvl_name', '')
                )
            else:
                employee_obj.level = None
                
            # Manager
            if getattr(ekl, 'emp_manager_id', None):
                employee_obj.manager = Employee(
                    id=ekl.emp_manager_id,
                    first_name=getattr(ekl, 'mgr_first_name', ''),
                    last_name=getattr(ekl, 'mgr_last_name', '')
                )
            else:
                employee_obj.manager = None
                
            # Previous Manager
            if getattr(ekl, 'emp_prev_manager_id', None):
                employee_obj.previous_manager = Employee(
                    id=ekl.emp_prev_manager_id,
                    first_name=getattr(ekl, 'pmgr_first_name', ''),
                    last_name=getattr(ekl, 'pmgr_last_name', '')
                )
            else:
                employee_obj.previous_manager = None
                
            # Instantiate KRACategory
            if getattr(ekl, 'kra_cat_id', None):
                category_obj = KRACategory(
                    id=ekl.kra_cat_id,
                    name=getattr(ekl, 'cat_name', ''),
                    description=getattr(ekl, 'cat_desc', ''),
                    is_standard=getattr(ekl, 'cat_std', False)
                )
            else:
                category_obj = None
                
            # Instantiate KRA
            kra_obj = KRA(
                id=ekl.kl_kra_id,
                name=getattr(ekl, 'kra_name', ''),
                description=getattr(ekl, 'kra_desc', ''),
                is_standard=getattr(ekl, 'kra_std', True),
                category=category_obj
            )
            
            # Instantiate KRALevel
            kra_level_obj = KRALevel(
                id=ekl.kra_level_id,
                kra=kra_obj,
                level_id=getattr(ekl, 'kl_lvl_id', None),
                name=getattr(ekl, 'kl_name', ''),
                category=category_obj
            )
            
            # Self rating
            if ekl.self_rating_id:
                self_rating_obj = Rating(
                    id=ekl.self_rating_id,
                    rating=getattr(ekl, 'self_rating_val', None)
                )
            else:
                self_rating_obj = None
                
            # Lead rating
            if ekl.lead_rating_id:
                lead_rating_obj = Rating(
                    id=ekl.lead_rating_id,
                    rating=getattr(ekl, 'lead_rating_val', None)
                )
            else:
                lead_rating_obj = None
                
            # Instantiate EmployeeKRALevel
            kra_row = EmployeeKRALevel(
                id=ekl.id,
                employee=employee_obj,
                kra_level=kra_level_obj,
                description_by_lead=ekl.description_by_lead,
                help_and_assistance_required=ekl.help_and_assistance_required,
                self_rating=self_rating_obj,
                self_comment=ekl.self_comment,
                lead_rating=lead_rating_obj,
                lead_comment=ekl.lead_comment,
                progress_notes=ekl.progress_notes,
                employee_kra_cycle_id=ekl.employee_kra_cycle_id,
                lead_progress_notes=ekl.lead_progress_notes,
                assigned_by_role=ekl.assigned_by_role
            )

            emp_id = ekl.employee_id
            cycle_id = getattr(ekl, 'cycle_id')
            key = (emp_id, ekl.kra_level_id)

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
                    'cycles': {str(cid): None for cid in cycle_ids},
                }

            cycle_serializer = EmployeeKRALevelReportSerializer(
                kra_row,
                context={'columns': per_cycle_columns}
            )
            aggregated[key]['cycles'][str(cycle_id)] = cycle_serializer.data

        rows = list(aggregated.values())

        # Apply search
        if search:
            rows = [
                row for row in rows
                if search in row['employee_name'].lower()
                or search in (row['kra_name'] or '').lower()
            ]

        # Sort by employee name then KRA name
        rows.sort(key=lambda row: (row['employee_name'], row['kra_name'] or ''))

        return Response({
            'cycles':          [{'id': cid, 'name': cycle_map.get(cid, str(cid))} for cid in cycle_ids],
            'per_cycle_columns': per_cycle_columns,
            'total_rows':      len(rows),
            'rows':            rows,
        }, status=status.HTTP_200_OK)
