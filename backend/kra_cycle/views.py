from django.contrib.auth import authenticate
from django.db import transaction
from django.http import HttpResponse

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    Employee, KRACycle, KRACycleStage, EmployeeKRACycle,
    EmployeeKRACycleCategory, EmployeeKRALevel, KRALevel, KRA,
    KRACategory, Stage, Level, Rating
)

# 1 . Authentication API

class LoginView(APIView):
    '''
        POST /api/v1/auth/login
        Accepts email + password , returns JWT access / refresh tokens.
    '''
    
    permission_classes = [AllowAny]
    
    def post(self , request):
        email = request.data.get('email')
        password = request.data.get('password')
        
        if not email or not password:
            return Response(
                {'error' : 'Please provide both email and password'}, status = status.HTTP_400_BAD_REQUEST
            )
        try:
            employee = Employee.objects.get(email = email)
            if employee.password != password:
                return Response({'error': 'Account is inactive'},status = status.HTTP_403_FORBIDDEN)
            
            refresh = RefreshToken.for_user(employee)
            
            user_roles = [employee.role.name]
            
            return Response({
                'access_token' : str(refresh.access_token),
                'refresh' : str(refresh),
                'employee_id' : employee.id,
                'roles':user_roles,
                'full_name': f'{employee.first_name} {employee.last_name}',
                'department': employee.department.department_name if employee.department else None
            }, status = status.HTTP_200_OK)
            
        except Employee.DoesNotExist:
            return Response({'error': 'Invalid credentials'},status = status.HTTP_401_UNAUTHORIZED)