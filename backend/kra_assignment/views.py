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

    Mode A: Shared KRAs (same kra_level_ids for everyone) 
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

    Mode B: Per-employee KRAs (each employee gets their own set) 
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
        enrolled  – successfully created or reassigned
        skipped   – already enrolled and reassign=false (default)
        failed    – validation errors per employee

    Optional top-level flag:
        "reassign": true   ← if an employee is already enrolled, replace their
                             categories and KRA level rows in-place (preserving
                             the EmployeeKRACycle record and any cycle-level data).
                             Each reassigned entry in `enrolled` will have
                             "reassigned": true.
                             Default is false (already-enrolled employees are skipped).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, cycle_id):
        caller = _get_caller(request)
        data   = request.data

        assignments = data.get('assignments', [])
        shared      = data.get('shared')          # present only in Mode A
        reassign    = data.get('reassign', False)  # if True, re-assign KRAs for already-enrolled employees

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

        # 3. Find which employees are already enrolled
        # Map employee_id → EmployeeKRACycle so we can reassign if requested
        already_enrolled = {
            ekc.employee_id: ekc
            for ekc in EmployeeKRACycle.objects.filter(
                kra_cycle_id=cycle_id,
                employee_id__in=employee_ids,
            )
        }

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

                existing_ekc = already_enrolled.get(eid)

                if existing_ekc:
                    if not reassign:
                        # Default behaviour: skip silently
                        skipped.append({
                            'employee_id':           eid,
                            'employee_kra_cycle_id': existing_ekc.id,
                            'reason':                'Already enrolled in this cycle. Pass reassign=true to override.',
                        })
                        continue

                    # reassign=true: replace categories & KRA rows on the existing record,
                    # preserving any ratings / progress stored on the EmployeeKRACycle itself.
                    ekc = existing_ekc

                    # Update scalar fields that may have changed
                    if 'employee_level_id' in a:
                        ekc.employee_level_id = a['employee_level_id']
                    ekc.is_date_based = is_date_based
                    ekc.save(update_fields=['employee_level_id', 'is_date_based'])

                    # Replace categories
                    ekc.categories.all().delete()
                    EmployeeKRACycleCategory.objects.bulk_create([
                        EmployeeKRACycleCategory(
                            employee_kra_cycle=ekc,
                            category_id=cat['category_id'],
                            weightage=str(cat['weightage']),
                        )
                        for cat in categories
                    ])

                    # Replace KRA level rows (clears old assignments including any done ones)
                    ekc.kra_level_rows.all().delete()
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
                        'reassigned':            True,
                    })

                else:
                    # New enrolment — create the pivot record
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
                        'reassigned':            False,
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
                'reassign':        reassign,
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

    # 12. Remove 
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
    POST /api/v1/kra/assignments/clone-from

    Clones KRA level rows from one source enrolment into one or more targets.
    Ratings and comments are intentionally nulled on every clone.

    Request body:
        {
            "source_employee_kra_cycle_id": 8,
            "target_employee_kra_cycle_ids": [12, 15, 19],
            "mode": "append"        ← optional, default is "skip"
        }

    mode options:
        "skip"      – (default) skip targets that already have KRA rows
        "append"    – add only the KRA rows not already present on the target
        "overwrite" – delete all existing KRA rows on target then clone fresh
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        source_id  = request.data.get('source_employee_kra_cycle_id')
        target_ids = request.data.get('target_employee_kra_cycle_ids', [])
        mode       = request.data.get('mode', 'skip')

        # Validate inputs 
        if not source_id:
            return Response(
                {'error': 'source_employee_kra_cycle_id is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not target_ids:
            return Response(
                {'error': 'target_employee_kra_cycle_ids is required and cannot be empty'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(target_ids, list):
            return Response(
                {'error': 'target_employee_kra_cycle_ids must be a list'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if mode not in ('skip', 'overwrite', 'append'):
            return Response(
                {'error': "mode must be one of: 'skip', 'overwrite', 'append'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if source_id in target_ids:
            return Response(
                {'error': 'source cannot also be a target'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Fetch source KRA rows 
        source_levels = list(
            EmployeeKRALevel.objects.filter(employee_kra_cycle_id=source_id)
        )
        if not source_levels:
            return Response(
                {'error': f'Source assignment {source_id} not found or has no KRA rows'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Validate all target IDs exist up front 
        existing_targets = {
            ekc.id: ekc
            for ekc in EmployeeKRACycle.objects.filter(id__in=target_ids)
        }
        missing = set(target_ids) - set(existing_targets.keys())
        if missing:
            return Response(
                {
                    'error': 'Some target IDs do not exist',
                    'missing_target_ids': sorted(missing),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        #  Process each target independently 
        cloned  = []
        skipped = []
        failed  = []

        for target_id in target_ids:
            target        = existing_targets[target_id]
            existing_rows = target.kra_level_rows.count()

            # mode=skip: protect targets that already have rows
            if existing_rows and mode == 'skip':
                skipped.append({
                    'target_employee_kra_cycle_id': target_id,
                    'reason': f'Already has {existing_rows} KRA row(s). Use mode=overwrite or mode=append.',
                })
                continue

            try:
                with transaction.atomic():

                    if mode == 'overwrite' and existing_rows:
                        # Wipe everything and start fresh
                        target.kra_level_rows.all().delete()
                        rows_to_clone = source_levels

                    elif mode == 'append' and existing_rows:
                        # Only clone KRA levels not already present on the target
                        existing_kra_level_ids = set(
                            target.kra_level_rows.values_list('kra_level_id', flat=True)
                        )
                        rows_to_clone = [
                            sl for sl in source_levels
                            if sl.kra_level_id not in existing_kra_level_ids
                        ]
                        if not rows_to_clone:
                            skipped.append({
                                'target_employee_kra_cycle_id': target_id,
                                'reason': 'All source KRA rows already exist on this target — nothing to append.',
                            })
                            continue

                    else:
                        # mode=overwrite with no existing rows,
                        # mode=append with no existing rows,
                        # mode=skip with no existing rows — just clone everything
                        rows_to_clone = source_levels

                    new_rows = EmployeeKRALevel.objects.bulk_create([
                        EmployeeKRALevel(
                            employee_id=target.employee_id,
                            kra_level_id=sl.kra_level_id,
                            employee_kra_cycle=target,
                            # Ratings and notes intentionally left null on clone
                        )
                        for sl in rows_to_clone
                    ])

                cloned.append({
                    'target_employee_kra_cycle_id': target_id,
                    'employee_id':                  target.employee_id,
                    'kras_copied':                  len(new_rows),
                    'mode_applied':                 mode,
                })

            except Exception as exc:
                failed.append({
                    'target_employee_kra_cycle_id': target_id,
                    'reason': str(exc),
                })

        # Single audit entry covering the whole operation 
        _audit(
            request,
            'KRA_ASSIGNMENT_BULK_CLONED',
            'EmployeeKRACycle',
            source_id,
            new_data={
                'source_employee_kra_cycle_id': source_id,
                'kras_in_source':               len(source_levels),
                'total_targets':                len(target_ids),
                'cloned_count':                 len(cloned),
                'skipped_count':                len(skipped),
                'failed_count':                 len(failed),
                'mode':                         mode,
                'cloned_target_ids':            [c['target_employee_kra_cycle_id'] for c in cloned],
                'skipped_target_ids':           [s['target_employee_kra_cycle_id'] for s in skipped],
                'failed_target_ids':            [f['target_employee_kra_cycle_id'] for f in failed],
            },
        )

        # Pick the right HTTP status 
        if cloned and (skipped or failed):
            http_status = status.HTTP_207_MULTI_STATUS
        elif not cloned and failed:
            http_status = status.HTTP_400_BAD_REQUEST
        else:
            http_status = status.HTTP_201_CREATED

        return Response(
            {
                'source_employee_kra_cycle_id': source_id,
                'kras_in_source':len(source_levels),
                'cloned': cloned,
                'skipped': skipped,
                'failed': failed,
                'summary': {
                    'total_targets':  len(target_ids),
                    'cloned_count':   len(cloned),
                    'skipped_count':  len(skipped),
                    'failed_count':   len(failed),
                },
            },
            status=http_status,
        )