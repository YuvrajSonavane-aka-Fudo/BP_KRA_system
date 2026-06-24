"""
File: serializers.py
App: kra_self_assessment
Purpose:
    Defines DRF Serializers for KRA Self Assessment models.

Includes:
    - SelfAssessmentKRARowSerializer
    - SelfAssessmentSerializer
    - SelfAssessmentUpdateSerializer

Responsibilities:
    - Serialize self-assessment data into standard Python dictionary structures.
    - Validate patch data inputs for self assessment submission.
"""

from rest_framework import serializers
from kra_cycle.models import (
    EmployeeKRACycle,
    EmployeeKRALevel,
    Rating,
)


class SelfAssessmentKRARowSerializer(serializers.ModelSerializer):
    employee_kra_level_id = serializers.IntegerField(source='id')
    kra_name = serializers.SerializerMethodField()
    category_name = serializers.SerializerMethodField()
    self_rating = serializers.SerializerMethodField()
    lead_rating = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeKRALevel
        fields = [
            'employee_kra_level_id',
            'kra_level_id',
            'kra_name',
            'category_name',
            'description_by_lead',
            'help_and_assistance_required',
            'self_rating_id',
            'self_rating',
            'self_comment',
            'progress_notes',
            'lead_rating_id',
            'lead_rating',
            'lead_comment',
            'lead_progress_notes',
        ]

    def get_kra_name(self, obj) -> str | None:
        return obj.kra_level.kra.name if obj.kra_level and obj.kra_level.kra else None

    def get_category_name(self, obj) -> str | None:
        return obj.kra_level.category.name if obj.kra_level and obj.kra_level.category else None

    def get_self_rating(self, obj) -> int | None:
        return obj.self_rating.rating if obj.self_rating else None

    def get_lead_rating(self, obj) -> int | None:
        return obj.lead_rating.rating if obj.lead_rating else None


class SelfAssessmentSerializer(serializers.ModelSerializer):
    cycle_id = serializers.IntegerField(source='kra_cycle_id')
    employee_kra_cycle_id = serializers.IntegerField(source='id')
    employee_stage_id = serializers.IntegerField(source='stage_id')
    current_stage = serializers.SerializerMethodField()
    stage_end_date = serializers.SerializerMethodField()
    kras = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeKRACycle
        fields = [
            'cycle_id',
            'employee_kra_cycle_id',
            'status',
            'employee_stage_id',
            'stage_end_date',
            'current_stage',
            'kras',
        ]

    def get_current_stage(self, obj) -> dict | None:
        return {'id': obj.stage.id, 'name': obj.stage.name} if obj.stage else None

    def get_stage_end_date(self, obj) -> str | None:
        return self.context.get('stage_end_date')

    def get_kras(self, obj) -> list:
        kra_rows = self.context.get('kra_rows', [])
        return SelfAssessmentKRARowSerializer(kra_rows, many=True).data


class SelfAssessmentUpdateSerializer(serializers.ModelSerializer):
    self_rating_id = serializers.PrimaryKeyRelatedField(
        queryset=Rating.objects.all(),
        required=False,
        allow_null=True,
        source='self_rating'
    )

    class Meta:
        model = EmployeeKRALevel
        fields = [
            'self_rating_id',
            'self_comment',
            'progress_notes',
            'help_and_assistance_required',
        ]
