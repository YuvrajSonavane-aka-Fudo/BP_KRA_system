from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


class SessionEmployeeAuthentication(BaseAuthentication):

    def authenticate(self, request):
        employee_id = request.session.get("employee_id")
        if not employee_id:
            return None

        from kra_cycle.models import Employee
        try:
            employee = (
                Employee.objects.select_related("department", "role", "level")
                .prefetch_related("employee_roles__role")
                .get(id=employee_id, active=True)
            )
            return (employee, None)  # ← THIS WAS MISSING
        except Employee.DoesNotExist:
            raise AuthenticationFailed("No active employee found for this session")

    def authenticate_header(self, request):
        return "Session"