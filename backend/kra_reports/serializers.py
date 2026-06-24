"""
File: serializers.py
App: kra_reports
Purpose:
    Defines DRF Serializers for reporting KRA data.

Includes:
    - EmployeeKRALevelReportSerializer

Responsibilities:
    - Serialize Employee KRA Level data into Python dictionaries for reports.
    - Support dynamic field filtering based on context.

Notes:
    - Use DRF Serializers to replace manual serialization dictionary helpers.
"""

from rest_framework import serializers
from kra_cycle.models import EmployeeKRALevel

class EmployeeKRALevelReportSerializer(serializers.ModelSerializer):
    employee_id = serializers.IntegerField(source='employee.id', read_only=True)
    employee_name = serializers.SerializerMethodField()
    department = serializers.CharField(source='employee.department.department_name', read_only=True, default=None)
    level = serializers.CharField(source='employee.level.name', read_only=True, default=None)
    manager = serializers.SerializerMethodField()
    previous_manager = serializers.SerializerMethodField()
    kra_name = serializers.CharField(source='kra_level.kra.name', read_only=True, default=None)
    category = serializers.CharField(source='kra_level.kra.category.name', read_only=True, default=None)
    self_rating = serializers.IntegerField(source='self_rating.rating', read_only=True, default=None)
    lead_rating = serializers.IntegerField(source='lead_rating.rating', read_only=True, default=None)

    class Meta:
        model = EmployeeKRALevel
        fields = [
            'employee_id',
            'employee_name',
            'department',
            'level',
            'manager',
            'previous_manager',
            'kra_name',
            'category',
            'self_rating',
            'self_comment',
            'lead_rating',
            'lead_comment',
            'progress_notes',
            'lead_progress_notes',
            'description_by_lead',
        ]

    def get_employee_name(self, obj) -> str:
        emp = obj.employee
        return f'{emp.first_name} {emp.last_name}' if emp else ''

    def get_manager(self, obj) -> str | None:
        emp = obj.employee
        if emp and emp.manager:
            return f'{emp.manager.first_name} {emp.manager.last_name}'
        return None

    def get_previous_manager(self, obj) -> str | None:
        emp = obj.employee
        if emp and emp.previous_manager:
            return f'{emp.previous_manager.first_name} {emp.previous_manager.last_name}'
        return None

    def to_representation(self, instance):
        # We can dynamically filter fields based on the columns requested (passed in context)
        data = super().to_representation(instance)
        columns = self.context.get('columns')
        if columns is not None:
            # Drop fields not specified in columns
            for field in list(data.keys()):
                if field not in columns:
                    data.pop(field)
        return data
