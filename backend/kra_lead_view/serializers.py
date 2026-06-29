"""
File: serializers.py
App: kra_lead_view

Purpose:
    Defines request validation and deserialization for the KRA Lead View API.

Includes:
    - Request serializers for lead review submission and KRA description updates

Responsibilities:
    - Validate and deserialize incoming PATCH request data
    - Enforce field-level constraints
    - Provide clean validated_data to views

Notes:
    - No business logic lives here
    - Serializers do NOT touch the database directly
    - All field constraints mirror the original inline validation in views
"""

from rest_framework import serializers


class LeadReviewSerializer(serializers.Serializer):
    """
    Validates the request body for PATCH /kra/assessments/<id>/lead-review.

    All fields are optional — a PATCH may update any subset of the lead review fields.
    The view applies only the fields that are present in the request.

    Fields:
        lead_rating_id (int, optional): FK to a Rating record.
        lead_comment (str, optional): Free-text comment from the lead.
        lead_progress_notes (str, optional): Progress notes written by the lead.
    """

    lead_rating_id = serializers.IntegerField(required=False, allow_null=True)
    lead_comment = serializers.CharField(
        required=False, allow_null=True, allow_blank=True
    )
    lead_progress_notes = serializers.CharField(
        required=False, allow_null=True, allow_blank=True
    )


class LeadDescriptionSerializer(serializers.Serializer):
    """
    Validates the request body for PATCH /kra/assessments/<id>/description.

    Fields:
        description_by_lead (str): Required. The KRA description text set by the lead.
    """

    description_by_lead = serializers.CharField()
