"""
File: serializers.py
App: kra_library
Purpose:
    Defines DRF Serializers for KRA library models.

Includes:
    - KRACategorySerializer
    - LevelSerializer
    - KRALevelSerializer
    - KRASerializer

Responsibilities:
    - Validate input data for KRA categories, levels, KRAs, and KRALevels.
    - Serialize model instances into Python dictionaries.

Notes:
    - Use DRF Serializers to replace manual serialization dictionary helpers.
"""

from rest_framework import serializers
from kra_cycle.models import (
    KRACategory,
    Level,
    KRALevel,
    KRA,
)

class KRACategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = KRACategory
        fields = ['id', 'name', 'description', 'is_standard']


class LevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Level
        fields = ['id', 'name', 'description', 'min_experience', 'max_experience']


class KRALevelSerializer(serializers.ModelSerializer):
    level_name = serializers.SerializerMethodField()
    category_name = serializers.SerializerMethodField()
    
    level_id = serializers.PrimaryKeyRelatedField(
        queryset=Level.objects.all(), source='level', required=False, allow_null=True
    )
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=KRACategory.objects.all(), source='category', required=False, allow_null=True
    )
    kra_id = serializers.PrimaryKeyRelatedField(read_only=True, source='kra')

    class Meta:
        model = KRALevel
        fields = [
            'id',
            'kra_id',
            'level_id',
            'level_name',
            'name',
            'category_id',
            'category_name',
        ]

    def get_level_name(self, obj) -> str | None:
        return obj.level.name if obj.level else None

    def get_category_name(self, obj) -> str | None:
        return obj.category.name if obj.category else None


class KRASerializer(serializers.ModelSerializer):
    category_name = serializers.SerializerMethodField()
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=KRACategory.objects.all(), source='category', required=False, allow_null=True
    )
    levels = KRALevelSerializer(many=True, read_only=True, source='kra_levels')

    class Meta:
        model = KRA
        fields = [
            'id',
            'name',
            'description',
            'is_standard',
            'category_id',
            'category_name',
            'levels',
        ]

    def get_category_name(self, obj) -> str | None:
        return obj.category.name if obj.category else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if self.context.get('include_levels') is False:
            data.pop('levels', None)
        return data
