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
        employee   = _get_caller(request),
        action     = action,
        entity     = entity,
        entity_id  = entity_id,
        old_data   = old_data,
        new_data   = new_data,
        ip_address = request.META.get("REMOTE_ADDR"),
    )

class EmployeeListView(APIView):
    """
    GET /api/v1/employees?cycle_id=
    HR / VL → all active employees.
    Lead / Manager → only direct reports (manager_id = caller.id).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        caller   = _get_caller(request)
        cycle_id = request.query_params.get('cycle_id')

        qs = Employee.objects.filter(active=True).select_related('department', 'level')

        if not _is_hr(caller):
            # Only direct reports
            qs = qs.filter(manager_id=caller.id)

        # Pre-fetch cycle assignments in one query if cycle_id provided
        cycle_map = {}
        if cycle_id:
            for ekc in EmployeeKRACycle.objects.filter(kra_cycle_id=cycle_id):
                cycle_map[ekc.employee_id] = ekc.id

        employees = []
        for e in qs:
            employees.append({
                'employee_id':           e.id,
                'full_name':             f'{e.first_name} {e.last_name}',
                'email':                 e.email,
                'title':                 e.title,
                'department':            e.department.department_name if e.department else None,
                'level':                 e.level.name if e.level else None,
                'manager_id':            e.manager_id,
                'roles':                 list(e.employee_roles.values_list('name', flat=True)),
                'assigned_to_cycle':     e.id in cycle_map,
                'employee_kra_cycle_id': cycle_map.get(e.id),
            })

        return Response({'employees': employees}, status=status.HTTP_200_OK)

class KRABulkAssignmentEnrolView(APIView):
    """
    POST /api/v1/kra/cycles/{cycle_id}/assignments/bulk

    Enrols multiple employees into a cycle in one request.

    Two modes depending on the request body shape:

    ── Mode A: Shared KRAs (same kra_level_ids for everyone) ──────────────────
    Use this when all employees in the batch get the same KRA set.

        {
            "assignments": [
                { "employee_id": 1001, "employee_level_id": 2 },
                { "employee_id": 1002, "employee_level_id": 1 },
                { "employee_id": 1003, "employee_level_id": 2 }
            ],
            "shared": {
                "categories":    [
                    { "category_id": 1,  "weightage": "40" },
                    { "category_id": 2,  "weightage": "30" },
                    { "category_id": 15, "weightage": "30" }
                ],
                "kra_level_ids": [10, 11, 7, 8],
                "is_date_based": true
            }
        }

    ── Mode B: Per-employee KRAs (each employee gets their own set) ────────────
    Use this when different employees need different KRAs / weightages.

        {
            "assignments": [
                {
                    "employee_id":      1001,
                    "employee_level_id": 2,
                    "is_date_based":    true,
                    "categories":       [
                        { "category_id": 1,  "weightage": "50" },
                        { "category_id": 15, "weightage": "50" }
                    ],
                    "kra_level_ids":    [10, 11]
                },
                {
                    "employee_id":      1002,
                    "employee_level_id": 1,
                    "is_date_based":    false,
                    "categories":       [
                        { "category_id": 2,  "weightage": "60" },
                        { "category_id": 15, "weightage": "40" }
                    ],
                    "kra_level_ids":    [7, 8, 9]
                }
            ]
        }

    Response always includes three lists:
        enrolled  – successfully created
        skipped   – already enrolled (not re-created)
        failed    – validation errors per employee
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, cycle_id):
        caller = _get_caller(request)
        data   = request.data

        assignments = data.get('assignments', [])
        shared      = data.get('shared')          # present only in Mode A

        if not assignments:
            return Response(
                {'error': 'assignments list is required and cannot be empty'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cycle = get_object_or_404(KRACycle, id=cycle_id, is_deleted=False)

        #  Pre-flight checks (done outside the transaction so we fail fast) 

        # 1. Collect all employee IDs being submitted
        employee_ids = []
        for idx, a in enumerate(assignments):
            eid = a.get('employee_id')
            if not eid:
                return Response(
                    {'error': f'assignments[{idx}] is missing employee_id'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            employee_ids.append(eid)

        # 2. Verify caller can act on every employee before touching the DB
        unauthorized = [
            eid for eid in employee_ids
            if not _caller_can_act_on(caller, eid)
        ]
        if unauthorized:
            return Response(
                {
                    'error': 'You do not have permission to assign KRAs to these employees',
                    'unauthorized_employee_ids': unauthorized,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # 3. Find which employees are already enrolled (skip them, don't error)
        already_enrolled = set(
            EmployeeKRACycle.objects.filter(
                kra_cycle_id=cycle_id,
                employee_id__in=employee_ids,
            ).values_list('employee_id', flat=True)
        )

        # 4. Bulk-fetch employee records (for manager lookup)
        employee_map = {
            e.id: e
            for e in Employee.objects.filter(id__in=employee_ids).select_related('manager')
        }

        # 5. Validate shared weightage once if Mode A
        if shared:
            shared_categories    = shared.get('categories', [])
            shared_kra_level_ids = shared.get('kra_level_ids', [])
            shared_is_date_based = shared.get('is_date_based', False)
            try:
                shared_weight = sum(int(c.get('weightage', 0)) for c in shared_categories)
            except (ValueError, TypeError):
                return Response(
                    {'error': 'shared.categories contains an invalid weightage value'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if shared_weight != 100:
                return Response(
                    {'error': f'shared.categories weightage must sum to 100, got {shared_weight}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Process each assignment 
        enrolled = []
        skipped  = []
        failed   = []

        with transaction.atomic():
            for a in assignments:
                eid = a['employee_id']

                # Already enrolled — skip silently
                if eid in already_enrolled:
                    skipped.append({
                        'employee_id': eid,
                        'reason':      'Already enrolled in this cycle',
                    })
                    continue

                emp = employee_map.get(eid)
                if not emp:
                    failed.append({
                        'employee_id': eid,
                        'reason':      'Employee not found or inactive',
                    })
                    continue

                # Resolve categories + KRAs for this employee
                if shared:
                    # Mode A — everyone shares the same KRA set
                    categories    = shared_categories
                    kra_level_ids = shared_kra_level_ids
                    is_date_based = shared_is_date_based
                    total_weight  = shared_weight
                else:
                    # Mode B — per-employee config
                    categories    = a.get('categories', [])
                    kra_level_ids = a.get('kra_level_ids', [])
                    is_date_based = a.get('is_date_based', False)
                    try:
                        total_weight = sum(int(c.get('weightage', 0)) for c in categories)
                    except (ValueError, TypeError):
                        failed.append({
                            'employee_id': eid,
                            'reason':      'Invalid weightage value in categories',
                        })
                        continue
                    if total_weight != 100:
                        failed.append({
                            'employee_id': eid,
                            'reason':      f'Category weightage must sum to 100, got {total_weight}',
                        })
                        continue

                # Create the pivot record
                ekc = EmployeeKRACycle.objects.create(
                    employee_id=eid,
                    kra_cycle=cycle,
                    status='Draft',
                    stage_id=1,
                    is_date_based=is_date_based,
                    employee_manager_id=emp.manager_id,
                    employee_level_id=a.get('employee_level_id'),
                )

                # Categories
                EmployeeKRACycleCategory.objects.bulk_create([
                    EmployeeKRACycleCategory(
                        employee_kra_cycle=ekc,
                        category_id=cat['category_id'],
                        weightage=str(cat['weightage']),
                    )
                    for cat in categories
                ])

                # KRA level rows
                EmployeeKRALevel.objects.bulk_create([
                    EmployeeKRALevel(
                        employee_id=eid,
                        kra_level_id=kl_id,
                        employee_kra_cycle=ekc,
                    )
                    for kl_id in kra_level_ids
                ])

                enrolled.append({
                    'employee_id':           eid,
                    'employee_kra_cycle_id': ekc.id,
                    'kras_assigned':         len(kra_level_ids),
                })

        # Audit (one entry covering the whole bulk operation) 
        _audit(
            request,
            'KRA_BULK_ASSIGNED',
            'EmployeeKRACycle',
            cycle_id,
            new_data={
                'cycle_id':        cycle_id,
                'assigned_by':     caller.id,
                'mode':            'shared' if shared else 'per_employee',
                'total_submitted': len(assignments),
                'enrolled_count':  len(enrolled),
                'skipped_count':   len(skipped),
                'failed_count':    len(failed),
                'enrolled_ids':    [e['employee_id'] for e in enrolled],
                'skipped_ids':     [s['employee_id'] for s in skipped],
                'failed_ids':      [f['employee_id'] for f in failed],
            },
        )

        # Use 207 Multi-Status when there's a mix of outcomes,
        # 201 when everything enrolled cleanly, 400 if everything failed.
        if enrolled and (skipped or failed):
            http_status = status.HTTP_207_MULTI_STATUS
        elif not enrolled and failed:
            http_status = status.HTTP_400_BAD_REQUEST
        else:
            http_status = status.HTTP_201_CREATED

        return Response(
            {
                'cycle_id':  cycle_id,
                'enrolled':  enrolled,
                'skipped':   skipped,
                'failed':    failed,
                'summary': {
                    'total_submitted': len(assignments),
                    'enrolled_count':  len(enrolled),
                    'skipped_count':   len(skipped),
                    'failed_count':    len(failed),
                },
            },
            status=http_status,
        )

class KRAAssignmentUpdateDeleteView(APIView):
    """
    PUT    /api/v1/kra/assignments/{employee_kra_cycle_id}  – update (Stage 1 only)
    DELETE /api/v1/kra/assignments/{employee_kra_cycle_id}  – remove (Stage 1 only)
    """
    permission_classes = [IsAuthenticated]
    

    #  10. Update 
    def put(self, request, employee_kra_cycle_id):
        caller        = _get_caller(request)
        ekc           = get_object_or_404(EmployeeKRACycle, id=employee_kra_cycle_id)
        data          = request.data
        categories    = data.get('categories', [])
        kra_level_ids = data.get('kra_level_ids', [])
        
        old_data = {
        "employee_level_id": ekc.employee_level_id,
        "is_date_based": ekc.is_date_based,
        "categories_count": ekc.categories.count(),
        "kras_count": ekc.kra_level_rows.count(),
        }

        if not _caller_can_act_on(caller, ekc.employee_id):
            return Response('Forbidden', status=status.HTTP_403_FORBIDDEN)

        if ekc.stage_id != 1:
            return Response(
                'Assignments cannot be modified after Stage 1',
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            total_weight = sum(int(c.get('weightage', 0)) for c in categories)
        except (ValueError, TypeError):
            return Response('Invalid weightage value', status=status.HTTP_400_BAD_REQUEST)

        if total_weight != 100:
            return Response('Category weightage must sum to 100', status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if 'employee_level_id' in data:
                ekc.employee_level_id = data['employee_level_id']
            if 'is_date_based' in data:
                ekc.is_date_based = data['is_date_based']
            ekc.save()

            # Replace categories
            ekc.categories.all().delete()        # related_name on EmployeeKRACycleCategory
            EmployeeKRACycleCategory.objects.bulk_create([
                EmployeeKRACycleCategory(
                    employee_kra_cycle=ekc,
                    category_id=cat['category_id'],
                    weightage=str(cat['weightage']),
                )
                for cat in categories
            ])

            # Replace KRA level rows
            ekc.kra_level_rows.all().delete()    # related_name on EmployeeKRALevel
            EmployeeKRALevel.objects.bulk_create([
                EmployeeKRALevel(
                    employee_id=ekc.employee_id,
                    kra_level_id=kl_id,
                    employee_kra_cycle=ekc,
                )
                for kl_id in kra_level_ids
            ])
        _audit(
                request,
                "KRA_ASSIGNMENT_UPDATED",
                "EmployeeKRACycle",
                ekc.id,
                old_data=old_data,
                new_data={
                    "employee_level_id": ekc.employee_level_id,
                    "is_date_based": ekc.is_date_based,
                    "categories_count": len(categories),
                    "kras_count": len(kra_level_ids),
                }
            )
            

        return Response({
            'employee_kra_cycle_id': ekc.id,
            'kras_assigned':         len(kra_level_ids),
            'message':               'Assignment updated successfully',
        }, status=status.HTTP_200_OK)

    # ── 12. Remove ───────────────────────────────────────────────────────────
    def delete(self, request, employee_kra_cycle_id):
        caller = _get_caller(request)
        ekc    = get_object_or_404(EmployeeKRACycle, id=employee_kra_cycle_id)

        if not _caller_can_act_on(caller, ekc.employee_id):
            return Response('Forbidden', status=status.HTTP_403_FORBIDDEN)

        if ekc.stage_id != 1:
            return Response('Cannot remove after Stage 1', status=status.HTTP_400_BAD_REQUEST)
        
        old_data = {
            "employee_id": ekc.employee_id,
            "cycle_id": ekc.kra_cycle_id,
            "kras_count": ekc.kra_level_rows.count(),
            "categories_count": ekc.categories.count(),
        }
                

        with transaction.atomic():
            ekc.kra_level_rows.all().delete()
            ekc.categories.all().delete()
            ekc.delete()
        
        _audit(
            request,
            "KRA_ASSIGNMENT_DELETED",
            "EmployeeKRACycle",
            employee_kra_cycle_id,
            old_data=old_data
        )

        return Response(
            {'message': 'Employee removed from cycle successfully'},
            status=status.HTTP_200_OK,
        )

class KRAAssignmentCloneView(APIView):
    """
    POST /api/v1/kra/assignments/{employee_kra_cycle_id}/clone-from
    Copies kra_level rows (nulling ratings/comments) from a source enrolment.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, employee_kra_cycle_id):
        source_id = request.data.get('source_employee_kra_cycle_id')
        if not source_id:
            return Response(
                'source_employee_kra_cycle_id is required',
                status=status.HTTP_400_BAD_REQUEST,
            )

        target       = get_object_or_404(EmployeeKRACycle, id=employee_kra_cycle_id)
        source_levels = EmployeeKRALevel.objects.filter(
            employee_kra_cycle_id=source_id
        )

        if not source_levels.exists():
            return Response('Source assignment not found', status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            # Remove existing kra rows on target first
            target.kra_level_rows.all().delete()

            new_rows = EmployeeKRALevel.objects.bulk_create([
                EmployeeKRALevel(
                    employee_id=target.employee_id,
                    kra_level_id=sl.kra_level_id,
                    employee_kra_cycle=target,
                    # Ratings and notes are intentionally left null on clone
                )
                for sl in source_levels
            ])
            _audit(
                request,
                "KRA_ASSIGNMENT_CLONED",
                "EmployeeKRACycle",
                target.id,
                new_data={
                    "source_employee_kra_cycle_id": source_id,
                    "target_employee_kra_cycle_id": target.id,
                    "kras_copied": len(new_rows),
                }
            )

        return Response({
            'employee_kra_cycle_id': target.id,
            'cloned_from':           source_id,
            'kras_copied':           len(new_rows),
            'message':               'KRAs cloned successfully',
        }, status=status.HTTP_201_CREATED)