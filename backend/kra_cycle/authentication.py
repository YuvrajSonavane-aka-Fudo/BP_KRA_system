from rest_framework.authentication import BaseAuthentication, SessionAuthentication
from rest_framework.exceptions import AuthenticationFailed


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """Disable CSRF checks for API session auth — safe for Postman/API clients."""
    def enforce_csrf(self, request):
        return  # skip CSRF check


class SessionEmployeeAuthentication(BaseAuthentication):

    def authenticate(self, request):
        employee_id = request.session.get('employee_id')
        if not employee_id:
            return None

        from kra_cycle.models import Employee
        try:
            employee = Employee.objects.select_related(
                'department', 'role', 'level'
            ).get(id=employee_id, active=True)
            return (employee, None)
        except Employee.DoesNotExist:
            raise AuthenticationFailed('No active employee found for this session')

    def authenticate_header(self, request):
        return 'Session'