"""
File: serializers.py
App: kra_assignment

Purpose:
    Defines request validation and deserialization for the KRA Assignment API.

Includes:
    - Request serializers for bulk enrolment, update, and clone operations
    - Nested serializers for category weightages and KRA selections

Responsibilities:
    - Validate and deserialize incoming request data
    - Enforce field-level and object-level constraints
    - Provide clean validated_data to views

Notes:
    - No business logic lives here
    - Serializers do NOT touch the database directly
    - Views remain responsible for all ORM operations and response formatting
"""

from rest_framework import serializers


class CategoryWeightageSerializer(serializers.Serializer):
    """
    Validates a single category-weightage entry.

    Fields:
        category_id (int): The ID of the KRA category.
        weightage (int): The percentage weight assigned to this category.
    """

    category_id = serializers.IntegerField()
    weightage = serializers.IntegerField()


class KRASelectionSerializer(serializers.Serializer):
    """
    Validates a single KRA selection entry that maps a KRA to a level.

    Fields:
        kra_id (int): The ID of the KRA.
        kra_level_id (int): The ID of the level to apply for this KRA.
    """

    kra_id = serializers.IntegerField()
    kra_level_id = serializers.IntegerField()


class SharedKRAConfigSerializer(serializers.Serializer):
    """
    Validates the shared KRA configuration block used in Mode A (shared)
    bulk assignment — where all employees receive the same KRAs and categories.

    Fields:
        categories (list): List of category-weightage entries.
        kra_level_ids (list[int]): Direct KRA level IDs (used when kra_selections is absent).
        kra_selections (list): KRA+level pairs for pre-resolved lookup.
        is_date_based (bool): Whether the assignment is date-based.
    """

    categories = CategoryWeightageSerializer(many=True, required=False, default=list)
    kra_level_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
    )
    kra_selections = KRASelectionSerializer(many=True, required=False, default=list)
    is_date_based = serializers.BooleanField(required=False, default=False)


class AssignmentItemSerializer(serializers.Serializer):
    """
    Validates a single per-employee assignment entry inside the assignments list
    used in Mode B (per-employee) bulk assignment.

    Fields:
        employee_id (int): Required. The ID of the employee to assign KRAs to.
        categories (list): Category-weightage entries for this employee.
        kra_level_ids (list[int]): KRA level IDs assigned to this employee.
        is_date_based (bool): Whether the assignment is date-based.
        employee_level_id (int, optional): Override for the employee's level.
    """

    employee_id = serializers.IntegerField()
    categories = CategoryWeightageSerializer(many=True, required=False, default=list)
    kra_level_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
    )
    is_date_based = serializers.BooleanField(required=False, default=False)
    employee_level_id = serializers.IntegerField(required=False, allow_null=True, default=None)


class BulkAssignmentEnrolSerializer(serializers.Serializer):
    """
    Validates the top-level request body for POST /kra/cycles/<cycle_id>/assignments/bulk.

    Fields:
        assignments (list): Required, non-empty list of per-employee assignment entries.
        enrol_mode (str): One of 'skip', 'overwrite', 'append'. Defaults to 'skip'.
        shared (dict, optional): Shared KRA configuration block (Mode A). When present,
            all employees in the assignments list receive the same KRAs and categories.
    """

    ENROL_MODE_CHOICES = ["skip", "overwrite", "append"]

    assignments = AssignmentItemSerializer(many=True)
    enrol_mode = serializers.ChoiceField(
        choices=ENROL_MODE_CHOICES,
        default="skip",
    )
    shared = SharedKRAConfigSerializer(required=False, allow_null=True, default=None)

    def validate_assignments(self, value: list) -> list:
        """Ensure at least one assignment is provided."""
        if not value:
            raise serializers.ValidationError(
                "assignments list is required and cannot be empty"
            )
        return value


class AssignmentUpdateSerializer(serializers.Serializer):
    """
    Validates the request body for PUT /kra/assignments/<employee_kra_cycle_id>.

    Fields:
        categories (list): Updated category-weightage entries.
        kra_level_ids (list[int]): Updated KRA level IDs.
        employee_level_id (int, optional): New level override for the employee.
        is_date_based (bool, optional): Updated date-based flag.
    """

    categories = CategoryWeightageSerializer(many=True, required=False, default=list)
    kra_level_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
    )
    employee_level_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    is_date_based = serializers.BooleanField(required=False, default=False)


class CloneAssignmentSerializer(serializers.Serializer):
    """
    Validates the request body for POST /kra/assignments/clone-from.

    Fields:
        source_employee_kra_cycle_id (int): Required. The enrolment to clone from.
        target_employee_kra_cycle_ids (list[int]): Required, non-empty list of
            enrolment IDs to clone into.
        mode (str): One of 'skip', 'overwrite', 'append'. Defaults to 'skip'.
    """

    MODE_CHOICES = ["skip", "overwrite", "append"]

    source_employee_kra_cycle_id = serializers.IntegerField()
    target_employee_kra_cycle_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
    )
    mode = serializers.ChoiceField(choices=MODE_CHOICES, default="skip")

    def validate(self, data: dict) -> dict:
        """Ensure the source is not also listed as a target."""
        source_id = data.get("source_employee_kra_cycle_id")
        target_ids = data.get("target_employee_kra_cycle_ids", [])
        if source_id in target_ids:
            raise serializers.ValidationError(
                {"source_employee_kra_cycle_id": "source cannot also be a target"}
            )
        return data
