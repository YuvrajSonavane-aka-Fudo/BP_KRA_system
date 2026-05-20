from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings

from kra_cycle.models import (
    KRACycle,
    KRACycleStage,
    EmployeeKRACycle,
)


class Command(BaseCommand):

    help = "Automatically advance KRA cycles"

    def handle(self, *args, **kwargs):

        self.stdout.write("AUTO ADVANCE COMMAND STARTED")

        now = timezone.now()

        cycles = KRACycle.objects.filter(
            is_deleted=False
        )

        synced_count = 0

        for cycle in cycles:

            # Find currently active stage based on datetime
            active_cycle_stage = (
                KRACycleStage.objects
                .filter(
                    kra_cycle=cycle,
                    is_deleted=False,
                    start_date__lte=now,
                    end_date__gte=now,
                )
                .select_related("stage")
                .first()
            )

            # No active stage currently
            if not active_cycle_stage:
                self.stdout.write(
                    f"Cycle {cycle.id}: no active stage found"
                )
                continue

            target_stage = active_cycle_stage.stage

            # Already synced
            if cycle.stage_id == target_stage.id:
                self.stdout.write(
                    f"Cycle {cycle.id} already synced to {target_stage.name}"
                )
                continue

            previous_stage = cycle.stage

            with transaction.atomic():

                # Update cycle stage
                cycle.stage = target_stage
                cycle.save(update_fields=["stage"])

                # Sync employee stages
                affected = (
                    EmployeeKRACycle.objects
                    .filter(
                        kra_cycle=cycle,
                        is_stage_overridden=False,
                    )
                    .update(stage_id=target_stage.id)
                )

            synced_count += 1

            self.stdout.write(
                self.style.SUCCESS(
                    f"Cycle {cycle.id}: "
                    f"{previous_stage} -> {target_stage.name} "
                    f"({affected} employees synced)"
                )
            )

            # Send emails to synced employees
            employee_cycles = (
                EmployeeKRACycle.objects
                .filter(
                    kra_cycle=cycle,
                    is_stage_overridden=False,
                )
                .select_related("employee")
            )

            for ekc in employee_cycles:

                employee = ekc.employee

                if not employee or not employee.email:
                    continue

                subject = f"KRA Cycle Stage Updated - {cycle.name}"

                message = f"""
Hi {employee.first_name},

The KRA cycle "{cycle.name}" has advanced to the next stage.

Previous Stage:
{previous_stage.name if previous_stage else "N/A"}

Current Stage:
{target_stage.name}

Please login to the KRA portal and complete the required actions for this stage.

Regards,
HR Team
"""

                try:
                    send_mail(
                        subject=subject,
                        message=message,
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[employee.email],
                        fail_silently=False,
                    )

                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Email sent to {employee.email}"
                        )
                    )

                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(
                            f"Failed to send email to {employee.email}: {str(e)}"
                        )
                    )

        self.stdout.write(
            self.style.SUCCESS(
                f"AUTO ADVANCE COMPLETED | {synced_count} cycle(s) updated"
            )
        )