import msal
from django.conf import settings
from django.shortcuts import redirect
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from kra_cycle.models import Employee, AuditLog


def _build_msal_app():
    return msal.ConfidentialClientApplication(
        settings.AZURE_AD['CLIENT_ID'],
        authority=f"https://login.microsoftonline.com/{settings.AZURE_AD['TENANT_ID']}",
        client_credential=settings.AZURE_AD['CLIENT_SECRET'],
    )


class MicrosoftLoginView(APIView):
    """
    Step 1: redirect the browser to Microsoft's login page.
    GET /api/v1/auth/microsoft/login
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        # Ensure a session exists so we can store state
        if not request.session.session_key:
            request.session.create()

        msal_app = _build_msal_app()
        auth_url = msal_app.get_authorization_request_url(
            scopes=settings.AZURE_AD['SCOPE'],
            redirect_uri=settings.AZURE_AD['REDIRECT_URI'],
            state=request.session.session_key,   # CSRF protection
        )
        return redirect(auth_url)


class MicrosoftCallbackView(APIView):
    """
    Step 2: Microsoft redirects here with ?code=...
    Exchange code → token → find Employee → create session.
    GET /api/v1/auth/microsoft/callback
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        code  = request.GET.get('code')
        error = request.GET.get('error')

        if error:
            desc = request.GET.get('error_description', 'Microsoft login failed')
            AuditLog.objects.create(
                action='LOGIN_FAILED',
                entity='Employee',
                ip_address=request.META.get('REMOTE_ADDR'),
                new_data={'reason': 'microsoft_oauth_error', 'error': error, 'description': desc},
            )
            return redirect(f"{settings.FRONTEND_URL}/login?error={desc}")

        if not code:
            AuditLog.objects.create(
                action='LOGIN_FAILED',
                entity='Employee',
                ip_address=request.META.get('REMOTE_ADDR'),
                new_data={'reason': 'missing_code'},
            )
            return redirect(f"{settings.FRONTEND_URL}/login?error=missing_code")

        # Exchange the auth code for an access token
        msal_app = _build_msal_app()
        result = msal_app.acquire_token_by_authorization_code(
            code,
            scopes=settings.AZURE_AD['SCOPE'],
            redirect_uri=settings.AZURE_AD['REDIRECT_URI'],
        )

        if 'error' in result:
            desc = result.get('error_description', 'Token exchange failed')
            AuditLog.objects.create(
                action='LOGIN_FAILED',
                entity='Employee',
                ip_address=request.META.get('REMOTE_ADDR'),
                new_data={'reason': 'token_exchange_failed', 'description': desc},
            )
            return redirect(f"{settings.FRONTEND_URL}/login?error={desc}")

        # Microsoft puts the user's email in 'preferred_username' (UPN)
        claims = result.get('id_token_claims', {})
        email  = claims.get('preferred_username') or claims.get('email', '')

        if not email:
            AuditLog.objects.create(
                action='LOGIN_FAILED',
                entity='Employee',
                ip_address=request.META.get('REMOTE_ADDR'),
                new_data={'reason': 'no_email_in_token'},
            )
            return redirect(f"{settings.FRONTEND_URL}/login?error=no_email_in_token")

        # Match against your Employee table
        try:
            employee = (
                Employee.objects
                .select_related('department', 'role', 'level')
                .prefetch_related('employee_roles__role')
                .get(email__iexact=email, active=True)
            )
        except Employee.DoesNotExist:
            AuditLog.objects.create(
                action='LOGIN_FAILED',
                entity='Employee',
                ip_address=request.META.get('REMOTE_ADDR'),
                new_data={'reason': 'employee_not_found', 'email': email},
            )
            return redirect(f"{settings.FRONTEND_URL}/login?error=employee_not_found")

        # Write the same session key your existing auth reads
        request.session['employee_id'] = employee.id
        request.session.save()

        AuditLog.objects.create(
            employee=employee,
            action='LOGIN_SUCCESS',
            entity='Employee',
            entity_id=employee.id,
            ip_address=request.META.get('REMOTE_ADDR'),
            new_data={'email': employee.email, 'method': 'microsoft_oauth'},
        )

        return redirect(f"{settings.FRONTEND_URL}/dashboard")


class MicrosoftLogoutView(APIView):
    """
    Clears the local session and optionally signs out from Microsoft.
    POST /api/v1/auth/microsoft/logout
    """
    permission_classes = [AllowAny]

    def post(self, request):
        employee_id = request.session.get('employee_id')
        request.session.flush()

        AuditLog.objects.create(
            employee_id=employee_id,
            action='LOGOUT',
            entity='Employee',
            entity_id=employee_id,
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        ms_logout = (
            f"https://login.microsoftonline.com/{settings.AZURE_AD['TENANT_ID']}"
            f"/oauth2/v2.0/logout"
            f"?post_logout_redirect_uri={settings.FRONTEND_URL}/login"
        )
        return Response({'logout_url': ms_logout})
    
class MeView(APIView):
    def get(self, request):
        emp = request.user

        return Response({
            'id':         emp.id,
            'email':      emp.email,
            'first_name': emp.first_name,
            'last_name':  emp.last_name,
            'full_name':  f"{emp.first_name or ''} {emp.last_name or ''}".strip(),
            'roles':      [emp.role.name] if emp.role else [],  # ← ["Admin"]
            'department': emp.department.department_name if emp.department else None,
        })