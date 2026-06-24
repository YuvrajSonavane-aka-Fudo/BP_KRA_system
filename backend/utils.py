from django.db import transaction
from django.utils.timezone import make_aware
from datetime import datetime, date, time
from django.conf import settings
from django.core.mail import send_mail

from kra_cycle.models import (
    Employee,
    AuditLog,
    EmployeeKRACycle,
    EmployeeKRACycleCategory,
    EmployeeKRALevel,
    KRACategory,
    KRALevel,
)

HR_ROLES      = {"Admin", "HR", "Vertical Lead"}
LEAD_ROLES    = {"Manager", "Team Lead"}
EMPLOYEE_ROLE = "Employee"


def _get_caller(request):
    return request.user


def _is_hr(employee):
    return employee.employee_roles.filter(role__name__in=HR_ROLES).exists()


def _is_lead(employee):
    return employee.employee_roles.filter(role__name__in=LEAD_ROLES).exists()


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


def _clone_assignments(source_cycle, new_cycle, caller):
    """
    Clones all EmployeeKRACycle rows (+ their categories and KRA level rows)
    from source_cycle into new_cycle.

    Returns a dict with enrolled / skipped / needs_review lists and a summary.
    """

    # Fetch all source enrolments with related data in as few queries as possible
    source_ekcs = list(
        EmployeeKRACycle.objects.filter(kra_cycle=source_cycle).select_related(
            "employee__manager", "employee__level", "employee__role"
        )
    )

    if not source_ekcs:
        return {
            "enrolled": [],
            "skipped": [],
            "needs_review": [],
            "summary": {"total": 0, "enrolled": 0, "skipped": 0, "needs_review": 0},
        }

    source_ekc_ids = [ekc.id for ekc in source_ekcs]
    source_emp_ids = [ekc.employee_id for ekc in source_ekcs]

    # Pre-flight: fetch all categories and KRA levels in bulk

    # All category rows across all source enrolments
    all_source_cats = list(
        EmployeeKRACycleCategory.objects.filter(
            employee_kra_cycle_id__in=source_ekc_ids
        )
    )
    # Group by ekc_id for fast lookup
    cats_by_ekc = {}
    for cat in all_source_cats:
        cats_by_ekc.setdefault(cat.employee_kra_cycle_id, []).append(cat)

    # All KRA level rows across all source enrolments
    all_source_kra_rows = list(
        EmployeeKRALevel.objects.filter(employee_kra_cycle_id__in=source_ekc_ids)
    )
    kra_rows_by_ekc = {}
    for row in all_source_kra_rows:
        kra_rows_by_ekc.setdefault(row.employee_kra_cycle_id, []).append(row)

    # Validate which category_ids and kra_level_ids still exist in DB

    all_cat_ids = {cat.category_id for cat in all_source_cats}
    all_kra_level_ids = {row.kra_level_id for row in all_source_kra_rows}

    valid_cat_ids = set(
        KRACategory.objects.filter(id__in=all_cat_ids).values_list("id", flat=True)
    )
    valid_kra_level_ids = set(
        KRALevel.objects.filter(id__in=all_kra_level_ids).values_list("id", flat=True)
    )

    # Find employees already enrolled in the NEW cycle
    already_in_new_cycle = set(
        EmployeeKRACycle.objects.filter(
            kra_cycle=new_cycle,
            employee_id__in=source_emp_ids,
        ).values_list("employee_id", flat=True)
    )

    # Process each source enrolment
    enrolled = []
    skipped = []
    needs_review = []

    # Track role changes for informational purposes
    def _current_roles(emp):
        return list(emp.employee_roles.values_list("name", flat=True))

    with transaction.atomic():
        for src_ekc in source_ekcs:
            emp = src_ekc.employee
            eid = src_ekc.employee_id

            # Case: employee deleted
            if emp is None:
                skipped.append(
                    {
                        "employee_id": eid,
                        "reason": "Employee record no longer exists",
                    }
                )
                continue

            # Case: employee inactive
            if not emp.active:
                skipped.append(
                    {
                        "employee_id": eid,
                        "full_name": f"{emp.first_name} {emp.last_name}",
                        "reason": "Employee is no longer active",
                    }
                )
                continue

            # Case: already enrolled in new cycle
            if eid in already_in_new_cycle:
                skipped.append(
                    {
                        "employee_id": eid,
                        "full_name": f"{emp.first_name} {emp.last_name}",
                        "reason": "Already enrolled in the new cycle (manually added)",
                    }
                )
                continue

            # Case: caller is Lead — only clone their direct reports
            if not _is_hr(caller):
                if emp.manager_id != caller.id:
                    skipped.append(
                        {
                            "employee_id": eid,
                            "full_name": f"{emp.first_name} {emp.last_name}",
                            "reason": "Not your direct report",
                        }
                    )
                    continue

            # Case: manager changed — use current manager
            current_manager_id = emp.manager_id  # always use fresh value
            manager_changed = current_manager_id != src_ekc.employee_manager_id

            # Case: level changed — use current level
            current_level_id = emp.level_id  # always use fresh value
            level_changed = current_level_id != src_ekc.employee_level_id

            # Case: role changed — note it but don't block
            current_roles = _current_roles(emp)
            role_changed = False
            # (informational only — we still enrol)

            # Resolve categories for this employee
            source_cats = cats_by_ekc.get(src_ekc.id, [])
            valid_cats = [c for c in source_cats if c.category_id in valid_cat_ids]
            invalid_cats = [
                c.category_id for c in source_cats if c.category_id not in valid_cat_ids
            ]

            # Recalculate weightage after dropping invalid categories
            try:
                remaining_weight = sum(int(c.weightage or 0) for c in valid_cats)
            except (ValueError, TypeError):
                remaining_weight = 0

            # Case: dropped categories broke weightage
            if invalid_cats and remaining_weight != 100:
                needs_review.append(
                    {
                        "employee_id": eid,
                        "full_name": f"{emp.first_name} {emp.last_name}",
                        "reason": "Category weightage no longer sums to 100 after removing deleted categories",
                        "invalid_category_ids": invalid_cats,
                        "remaining_weightage": remaining_weight,
                        "action": "Please manually re-assign this employee with corrected weightages",
                    }
                )
                continue

            # Resolve KRA level rows for this employee
            source_kra_rows = kra_rows_by_ekc.get(src_ekc.id, [])
            valid_kra_rows = [
                r for r in source_kra_rows if r.kra_level_id in valid_kra_level_ids
            ]
            dropped_kra_ids = [
                r.kra_level_id
                for r in source_kra_rows
                if r.kra_level_id not in valid_kra_level_ids
            ]

            # Create the new EmployeeKRACycle
            new_ekc = EmployeeKRACycle.objects.create(
                employee_id=eid,
                kra_cycle=new_cycle,
                status="Draft",
                stage_id=1,
                is_date_based=src_ekc.is_date_based,
                employee_manager_id=current_manager_id,  # ← always fresh
                employee_level_id=current_level_id,  # ← always fresh
            )

            # Clone category weightages
            EmployeeKRACycleCategory.objects.bulk_create(
                [
                    EmployeeKRACycleCategory(
                        employee_kra_cycle=new_ekc,
                        category_id=cat.category_id,
                        weightage=cat.weightage,
                    )
                    for cat in valid_cats
                ]
            )

            # Clone KRA level rows (ratings always nulled)
            EmployeeKRALevel.objects.bulk_create(
                [
                    EmployeeKRALevel(
                        employee_id=eid,
                        kra_level_id=row.kra_level_id,
                        employee_kra_cycle=new_ekc,
                        # All assessment fields intentionally null on clone
                    )
                    for row in valid_kra_rows
                ]
            )

            enrolled.append(
                {
                    "employee_id": eid,
                    "full_name": f"{emp.first_name} {emp.last_name}",
                    "employee_kra_cycle_id": new_ekc.id,
                    "kras_cloned": len(valid_kra_rows),
                    "kras_dropped": dropped_kra_ids,  # kra_levels that no longer exist
                    "categories_dropped": invalid_cats,  # categories that no longer exist
                    "manager_updated": manager_changed,
                    "level_updated": level_changed,
                }
            )

    return {
        "enrolled": enrolled,
        "skipped": skipped,
        "needs_review": needs_review,
        "summary": {
            "total": len(source_ekcs),
            "enrolled": len(enrolled),
            "skipped": len(skipped),
            "needs_review": len(needs_review),
        },
    }


def _parse_date(value):
    """Accepts '2026-05-13' or '2026-05-13T00:00:00', always returns aware datetime."""
    try:
        d = date.fromisoformat(value)  # handles date-only strings
        return make_aware(datetime.combine(d, time.min))
    except ValueError:
        return make_aware(datetime.fromisoformat(value.replace("Z", "")))


def send_stage_override_email(employee, cycle, stage_data):
    """
    Sends email for single stage override update.
    Shows only Stage ID (no stage name lookup).
    """
    try:
        if not employee.email:
            return

        subject = f"KRA Stage Dates Updated - {cycle.name}"
        message = f"""
                Hi {employee.first_name},

                The dates for a KRA stage have been updated for the cycle:

                {cycle.name}

                Your stage has been changed

                Please login to the KRA portal to review the updated schedule.

                Regards,
                HR Team
                """

        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[employee.email],
            fail_silently=False,
        )
    except Exception as e:
        print(f"Failed to send stage override email: {str(e)}")


def send_employee_stage_override_email(employee, cycle, target_stage):
    """
    Email for individual employee stage override.
    """
    try:
        if not employee.email:
            return

        subject = f"KRA Stage Updated - {cycle.name}"
        message = f"""
        Hi {employee.first_name},

        Your KRA stage has been updated.

        Cycle: {cycle.name}

        New Stage:
        - Stage ID: {target_stage.id}
        - Stage Name: {target_stage.name}

        Please login to the KRA portal for details.

        Regards,
        HR Team
        """

        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[employee.email],
            fail_silently=True,
        )
    except Exception as e:
        print(f"Stage override email failed: {str(e)}")