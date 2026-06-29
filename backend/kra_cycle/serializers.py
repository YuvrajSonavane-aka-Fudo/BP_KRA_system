"""
File: serializers.py
App: kra_cycle
Purpose:
    Defines DRF Serializers for KRA cycle models.

Includes:
    - StageSerializer
    - KRACycleStageSerializer
    - KRACycleSerializer
    - ReferenceStageSerializer
    - ReferenceLevelSerializer
    - ReferenceRatingSerializer
    - ReferenceCategorySerializer
    - KRALibraryLevelSerializer
    - KRALibrarySerializer

Responsibilities:
    - Serialize model instances into Python dictionaries.
"""

from rest_framework import serializers
from .models import (
    Stage,
    Level,
    Rating,
    KRACategory,
    KRACycle,
    KRACycleStage,
    KRALevel,
    KRA,
)


class StageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stage
        fields = ['id', 'name', 'description']


class KRACycleStageSerializer(serializers.ModelSerializer):
    stage_id = serializers.PrimaryKeyRelatedField(source='stage', read_only=True)

    class Meta:
        model = KRACycleStage
        fields = ['stage_id', 'start_date', 'end_date']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Handle cases where stage might be None gracefully
        ret['stage_id'] = instance.stage.id if instance.stage else None
        return ret


class KRACycleSerializer(serializers.ModelSerializer):
    current_stage = StageSerializer(source='stage', read_only=True)
    cycle_stages = serializers.SerializerMethodField()

    class Meta:
        model = KRACycle
        fields = [
            'id',
            'name',
            'description',
            'start_date',
            'end_date',
            'status',
            'current_stage',
            'cycle_stages',
        ]

    def get_cycle_stages(self, obj):
        stages = obj.cycle_stages.filter(is_deleted=False).order_by("id")
        return KRACycleStageSerializer(stages, many=True).data


# Reference Data Serializers

class ReferenceStageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stage
        fields = ['id', 'name']


class ReferenceLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Level
        fields = ['id', 'name', 'min_experience', 'max_experience']


class ReferenceRatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rating
        fields = ['id', 'rating', 'description']


class ReferenceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = KRACategory
        fields = ['id', 'name', 'is_standard']


# KRA Library Serializers

class KRALibraryLevelSerializer(serializers.ModelSerializer):
    kra_level_id = serializers.IntegerField(source='id')
    level_id = serializers.IntegerField()
    level_name = serializers.CharField(source='level.name', allow_null=True)
    description = serializers.CharField(source='name', allow_null=True)

    class Meta:
        model = KRALevel
        fields = ['kra_level_id', 'level_id', 'level_name', 'description']


class KRALibrarySerializer(serializers.ModelSerializer):
    category_id = serializers.IntegerField()
    category_name = serializers.CharField(source='category.name', allow_null=True)
    levels = serializers.SerializerMethodField()

    class Meta:
        model = KRA
        fields = ['id', 'name', 'description', 'category_id', 'category_name', 'levels']

    def get_levels(self, obj):
        level_id = self.context.get('level_id')
        qs = obj.kra_levels.all()
        if level_id:
            # Safely handle level_id comparison string/int
            qs = [kl for kl in qs if str(kl.level_id) == str(level_id)]
        return KRALibraryLevelSerializer(qs, many=True).data
