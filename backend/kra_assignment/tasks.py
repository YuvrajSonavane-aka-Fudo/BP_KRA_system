import logging
from datetime import date

from celery import shared_task
from django.core.mail import send_mass_mail
from django.db import transaction
from django.utils import timezone

from kra_cycle.models import Employee, EmployeeKRACycle, KRACycle, KRACycleStage, Stage

logger = logging.getLogger(__name__)

STAGE_DESCRIPTIONS = {
    1: "KRA Assignment",   2: "KRA Tracking",
    3: "Self Assessment",  4: "Lead / HR Assessment",  5: "Cycle Closure",
}
STAGE_INSTRUCTIONS = {
    1: "Your lead will now assign KRAs to you.",
    2: "Your KRAs are active. Log in to track your progress and update notes.",
    3: "Self-assessment is open. Submit your ratings before the deadline.",
    4: "Your lead is reviewing assessments. Ratings are now locked for editing.",
    5: "The review cycle is closing. Final ratings have been recorded. Thank you.",
}


def _build_stage_email(employee, cycle, stage):
    stage_name = stage.name or STAGE_DESCRIPTIONS.get(stage.id, f"Stage {stage.id}")
    full_name  = f"{employee.first_name} {employee.last_name}".strip() or employee.email
    subject    = f"[KRA] {cycle.name} has entered {stage_name}"
    body = (
        f"Hi {full_name},\n\n"
        f"The KRA cycle \"{cycle.name}\" has automatically advanced to a new stage.\n\n"
        f"  Stage : {stage_name}\n"
        f"  Date  : {date.today().strftime('%d %B %Y')}\n\n"
        f"{STAGE_INSTRUCTIONS.get(stage.id, '')}\n\n"
        f"Log in to the KRA portal to take any required action.\n\n"
        f"This is an automated message. Do not reply.\n"
    )
    return (subject, body, None, [employee.email])


def _build_activation_email(employee, cycle, stage):
    full_name  = f"{employee.first_name} {employee.last_name}".strip() or employee.email
    stage_name = stage.name or STAGE_DESCRIPTIONS.get(stage.id, f"Stage {stage.id}")
    subject    = f"[KRA] You have been enrolled in: {cycle.name}"
    body = (
        f"Hi {full_name},\n\n"
        f"You have been enrolled in the KRA cycle:\n\n"
        f"  Cycle : {cycle.name}\n"
        f"  Start : {cycle.start_date.strftime('%d %B %Y') if cycle.start_date else 'N/A'}\n"
        f"  End   : {cycle.end_date.strftime('%d %B %Y') if cycle.end_date else 'N/A'}\n\n"
        f"The cycle has started and is in the \"{stage_name}\" stage.\n\n"
        f"{STAGE_INSTRUCTIONS.get(stage.id, '')}\n\n"
        f"This is an automated message. Do not reply.\n"
    )
    return (subject, body, None, [employee.email])


def _get_enrolled_employees(cycle_id):
    ids = EmployeeKRACycle.objects.filter(
        kra_cycle_id=cycle_id
    ).values_list("employee_id", flat=True)
    return list(
        Employee.objects.filter(id__in=ids, active=True)
        .exclude(email__isnull=True).exclude(email="")
    )


def _send_emails(email_tuples, cycle_id, stage_id):
    if not email_tuples:
        return
    try:
        sent = send_mass_mail(email_tuples, fail_silently=False)
        logger.info("[AutoAdvance] Sent %d emails for cycle %s stage %s", sent, cycle_id, stage_id)
    except Exception as exc:
        # Email failure must NEVER roll back stage advancement
        logger.error("[AutoAdvance] Email failed for cycle %s stage %s: %s", cycle_id, stage_id, exc)


def _activate_cycle(cycle, result_list):
    try:
        stage_1 = Stage.objects.get(id=1)
    except Stage.DoesNotExist:
        logger.error("[AutoAdvance] Stage 1 missing — cannot activate cycle %s", cycle.id)
        return
    employees = _get_enrolled_employees(cycle.id)
    with transaction.atomic():
        cycle.status   = "ACTIVE"
        cycle.stage_id = stage_1.id
        cycle.save(update_fields=["status", "stage_id"])
        EmployeeKRACycle.objects.filter(kra_cycle_id=cycle.id).update(stage_id=stage_1.id)
    if employees:
        _send_emails([_build_activation_email(e, cycle, stage_1) for e in employees], cycle.id, stage_1.id)
    result_list.append({"cycle_id": cycle.id, "cycle_name": cycle.name, "stage_id": 1, "emails_sent": len(employees)})
    logger.info("[AutoAdvance] Activated cycle %s '%s', emailed %d", cycle.id, cycle.name, len(employees))


def _advance_cycle_to_stage(cycle, new_stage, result_list):
    prev      = cycle.stage_id
    employees = _get_enrolled_employees(cycle.id)
    with transaction.atomic():
        cycle.stage_id = new_stage.id
        cycle.save(update_fields=["stage_id"])
        EmployeeKRACycle.objects.filter(kra_cycle_id=cycle.id).update(stage_id=new_stage.id)
    if employees:
        _send_emails([_build_stage_email(e, cycle, new_stage) for e in employees], cycle.id, new_stage.id)
    result_list.append({"cycle_id": cycle.id, "from_stage_id": prev, "to_stage_id": new_stage.id, "emails_sent": len(employees)})
    logger.info("[AutoAdvance] Cycle %s: Stage %s -> %s '%s', emailed %d", cycle.id, prev, new_stage.id, new_stage.name, len(employees))


@shared_task(name="kra_assignment.tasks.auto_advance_cycle_stages", bind=True, max_retries=3, default_retry_delay=300)
def auto_advance_cycle_stages(self):
    today     = timezone.now().date()
    activated, advanced, errors = [], [], []

    # Step 1 — activate DRAFT cycles starting today
    for cycle in KRACycle.objects.filter(status="DRAFT", is_deleted=False, start_date__date=today).select_related("stage"):
        try:
            _activate_cycle(cycle, activated)
        except Exception as exc:
            errors.append({"cycle_id": cycle.id, "error": str(exc)})

    # Step 2 — advance ACTIVE cycles with a stage starting today
    transitions = (
        KRACycleStage.objects
        .filter(start_date__date=today, is_deleted=False, kra_cycle__status="ACTIVE", kra_cycle__is_deleted=False)
        .select_related("kra_cycle__stage", "stage")
        .order_by("stage__id")
    )
    cycle_to_stage = {cs.kra_cycle_id: cs for cs in transitions}  # highest stage wins per cycle

    for cs in cycle_to_stage.values():
        cycle, new_stage = cs.kra_cycle, cs.stage
        if cycle.stage_id == new_stage.id:
            continue
        try:
            _advance_cycle_to_stage(cycle, new_stage, advanced)
        except Exception as exc:
            errors.append({"cycle_id": cycle.id, "stage_id": new_stage.id, "error": str(exc)})

    logger.info("[AutoAdvance] Done. Activated: %d  Advanced: %d  Errors: %d", len(activated), len(advanced), len(errors))
    return {"date": str(today), "activated_cycles": activated, "advanced_cycles": advanced, "errors": errors}