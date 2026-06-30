from django.test import TestCase
from django.db import models
from kra_cycle.models import (
    Role, Employee, EmployeeRole, Stage, Level, Rating, KRACategory, KRACycle, EmployeeKRACycle
)

class RoleSchemaTestCase(TestCase):
    def test_role_id_is_integer(self):
        """Asserts that Role primary key 'id' is an integer-based AutoField or BigAutoField."""
        id_field = Role._meta.get_field('id')
        self.assertTrue(
            isinstance(id_field, (models.AutoField, models.BigAutoField, models.IntegerField)),
            f"Role primary key 'id' should be an integer type field to match the original Bluewater schema, but got {type(id_field)}"
        )

    def test_stage_name_max_length(self):
        """Asserts stage.name max_length matches clean schema (100)."""
        name_field = Stage._meta.get_field('name')
        self.assertEqual(name_field.max_length, 100)

    def test_level_name_and_description_max_length(self):
        """Asserts level.name and level.description max_length matches clean schema (45)."""
        name_field = Level._meta.get_field('name')
        description_field = Level._meta.get_field('description')
        self.assertEqual(name_field.max_length, 45)
        self.assertEqual(description_field.max_length, 45)

    def test_rating_description_max_length(self):
        """Asserts rating.description max_length matches clean schema (500)."""
        description_field = Rating._meta.get_field('description')
        self.assertEqual(description_field.max_length, 500)

    def test_kra_category_db_table_and_max_lengths(self):
        """Asserts KRACategory db_table is 'category' and name/description max_length is 45."""
        self.assertEqual(KRACategory._meta.db_table, 'category')
        name_field = KRACategory._meta.get_field('name')
        description_field = KRACategory._meta.get_field('description')
        self.assertEqual(name_field.max_length, 45)
        self.assertEqual(description_field.max_length, 45)

    def test_kra_cycle_status_max_length(self):
        """Asserts kra_cycle.status max_length matches clean schema (100)."""
        status_field = KRACycle._meta.get_field('status')
        self.assertEqual(status_field.max_length, 100)

    def test_employee_kra_cycle_status_max_length(self):
        """Asserts employee_kra_cycle.status max_length matches clean schema (45)."""
        status_field = EmployeeKRACycle._meta.get_field('status')
        self.assertEqual(status_field.max_length, 45)
