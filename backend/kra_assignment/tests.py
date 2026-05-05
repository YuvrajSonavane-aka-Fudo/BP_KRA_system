"""
tests.py — KRA Assignment Views
Covers:
    EmployeeListView
    KRABulkAssignmentEnrolView
    KRAAssignmentUpdateDeleteView  (PUT + DELETE)
    KRAAssignmentCloneView

Run:
    py manage.py test kra_assignment.tests --verbosity=2
"""

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from kra_cycle.models import (
    Employee,
    EmployeeKRACycle,
    EmployeeKRACycleCategory,
    EmployeeKRALevel,
    KRA,
    KRACategory,
    KRACycle,
    KRALevel,
    Level,
    Role,
    Stage,
    AuditLog,
)


# ─────────────────────────────────────────────────────────────────────────────
#  Shared fixture helpers
# ─────────────────────────────────────────────────────────────────────────────

class BaseTestCase(TestCase):
    """
    Creates the minimum set of DB objects needed by every test.
    Each test class that inherits from this gets a fresh DB (Django rolls
    back after each test method via TestCase).
    """

    def setUp(self):
        self.client = APIClient()

        # ── Roles ─────────────────────────────────────────────────────────────
        self.role_hr       = Role.objects.create(name='HR')
        self.role_lead     = Role.objects.create(name='Manager')
        self.role_employee = Role.objects.create(name='Employee')

        # ── Levels ────────────────────────────────────────────────────────────
        self.level_junior = Level.objects.create(name='Dev-01', min_experience=0, max_experience=2)
        self.level_mid    = Level.objects.create(name='Dev-02', min_experience=2, max_experience=5)

        # ── Stages ────────────────────────────────────────────────────────────
        self.stage_1 = Stage.objects.create(id=1, name='KRA Assignment')
        self.stage_2 = Stage.objects.create(id=2, name='KRA Tracking')

        # ── KRA library ───────────────────────────────────────────────────────
        self.category_1 = KRACategory.objects.create(name='Core Development', is_standard=True)
        self.category_2 = KRACategory.objects.create(name='Behavioural',      is_standard=True)
        self.kra        = KRA.objects.create(name='Own a feature', category=self.category_1)
        self.kra_level_1 = KRALevel.objects.create(kra=self.kra, level=self.level_junior, name='Dev-01 variant', category=self.category_1)
        self.kra_level_2 = KRALevel.objects.create(kra=self.kra, level=self.level_mid,    name='Dev-02 variant', category=self.category_1)

        # ── Employees ─────────────────────────────────────────────────────────
        self.hr = Employee.objects.create(
            id=1, email='hr@test.com', first_name='HR', last_name='User',
            active=True, role=self.role_hr,
        )
        self.lead = Employee.objects.create(
            id=2, email='lead@test.com', first_name='Lead', last_name='User',
            active=True, role=self.role_lead,
        )
        self.emp1 = Employee.objects.create(
            id=3, email='emp1@test.com', first_name='Alice', last_name='A',
            active=True, role=self.role_employee, manager=self.lead,
            level=self.level_junior,
        )
        self.emp2 = Employee.objects.create(
            id=4, email='emp2@test.com', first_name='Bob', last_name='B',
            active=True, role=self.role_employee, manager=self.lead,
            level=self.level_mid,
        )
        self.emp_inactive = Employee.objects.create(
            id=5, email='inactive@test.com', first_name='Gone', last_name='G',
            active=False, role=self.role_employee, manager=self.lead,
        )
        self.emp_other = Employee.objects.create(
            id=6, email='other@test.com', first_name='Other', last_name='O',
            active=True, role=self.role_employee, manager=self.hr,  # reports to HR, not lead
        )

        # ── KRA Cycle ─────────────────────────────────────────────────────────
        self.cycle = KRACycle.objects.create(
            name='Q3 2026', status='ACTIVE', is_deleted=False,
        )

    def _auth(self, employee):
        """Force-authenticate as the given employee."""
        self.client.force_authenticate(user=employee)

    def _enrol(self, employee, cycle=None, stage=None):
        """Helper: create a minimal EmployeeKRACycle for the given employee."""
        cycle = cycle or self.cycle
        stage = stage or self.stage_1
        ekc = EmployeeKRACycle.objects.create(
            employee=employee,
            kra_cycle=cycle,
            status='Draft',
            stage=stage,
            employee_manager_id=employee.manager_id,
            employee_level_id=employee.level_id,
        )
        return ekc

    def _add_categories(self, ekc):
        """Helper: add two categories summing to 100 on an ekc."""
        EmployeeKRACycleCategory.objects.create(
            employee_kra_cycle=ekc, category=self.category_1, weightage='60'
        )
        EmployeeKRACycleCategory.objects.create(
            employee_kra_cycle=ekc, category=self.category_2, weightage='40'
        )

    def _add_kra_rows(self, ekc, employee=None):
        """Helper: add two KRALevel rows to an ekc."""
        employee = employee or ekc.employee
        EmployeeKRALevel.objects.create(
            employee=employee, kra_level=self.kra_level_1, employee_kra_cycle=ekc
        )
        EmployeeKRALevel.objects.create(
            employee=employee, kra_level=self.kra_level_2, employee_kra_cycle=ekc
        )


# ═════════════════════════════════════════════════════════════════════════════
#  1. EmployeeListView
# ═════════════════════════════════════════════════════════════════════════════

class EmployeeListViewTests(BaseTestCase):

    URL = '/api/v1/employees'

    # ── Auth ─────────────────────────────────────────────────────────────────

    def test_unauthenticated_returns_401(self):
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    # ── HR sees everyone ─────────────────────────────────────────────────────

    def test_hr_sees_all_active_employees(self):
        self._auth(self.hr)
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [e['employee_id'] for e in res.data['employees']]
        # HR, lead, emp1, emp2, emp_other are all active
        self.assertIn(self.emp1.id, ids)
        self.assertIn(self.emp2.id, ids)
        self.assertIn(self.emp_other.id, ids)

    def test_inactive_employees_excluded(self):
        self._auth(self.hr)
        res = self.client.get(self.URL)
        ids = [e['employee_id'] for e in res.data['employees']]
        self.assertNotIn(self.emp_inactive.id, ids)

    # ── Lead sees only direct reports ────────────────────────────────────────

    def test_lead_sees_only_direct_reports(self):
        self._auth(self.lead)
        res = self.client.get(self.URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [e['employee_id'] for e in res.data['employees']]
        self.assertIn(self.emp1.id, ids)
        self.assertIn(self.emp2.id, ids)
        # emp_other reports to hr, not to lead
        self.assertNotIn(self.emp_other.id, ids)

    # ── cycle_id flag ────────────────────────────────────────────────────────

    def test_cycle_id_flag_shows_assigned_status(self):
        self._auth(self.hr)
        ekc = self._enrol(self.emp1)
        res = self.client.get(self.URL, {'cycle_id': self.cycle.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        emp1_data = next(e for e in res.data['employees'] if e['employee_id'] == self.emp1.id)
        emp2_data = next(e for e in res.data['employees'] if e['employee_id'] == self.emp2.id)

        self.assertTrue(emp1_data['assigned_to_cycle'])
        self.assertEqual(emp1_data['employee_kra_cycle_id'], ekc.id)
        self.assertFalse(emp2_data['assigned_to_cycle'])
        self.assertIsNone(emp2_data['employee_kra_cycle_id'])

    # ── Response shape ───────────────────────────────────────────────────────

    def test_response_contains_expected_fields(self):
        self._auth(self.hr)
        res = self.client.get(self.URL)
        emp = res.data['employees'][0]
        for field in ('employee_id', 'full_name', 'email', 'title',
                      'department', 'level', 'manager_id', 'roles',
                      'assigned_to_cycle', 'employee_kra_cycle_id'):
            self.assertIn(field, emp, f"Missing field: {field}")


# ═════════════════════════════════════════════════════════════════════════════
#  2. KRABulkAssignmentEnrolView
# ═════════════════════════════════════════════════════════════════════════════

class KRABulkAssignmentEnrolViewTests(BaseTestCase):

    def _url(self, cycle_id=None):
        cid = cycle_id or self.cycle.id
        return f'/api/v1/kra/cycles/{cid}/assignments/bulk'

    def _shared_payload(self, employee_ids):
        return {
            'assignments': [{'employee_id': eid} for eid in employee_ids],
            'shared': {
                'categories': [
                    {'category_id': self.category_1.id, 'weightage': '60'},
                    {'category_id': self.category_2.id, 'weightage': '40'},
                ],
                'kra_level_ids': [self.kra_level_1.id, self.kra_level_2.id],
                'is_date_based': False,
            },
        }

    # ── Auth ─────────────────────────────────────────────────────────────────

    def test_unauthenticated_returns_401(self):
        res = self.client.post(self._url(), {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    # ── Input validation ─────────────────────────────────────────────────────

    def test_empty_assignments_returns_400(self):
        self._auth(self.hr)
        res = self.client.post(self._url(), {'assignments': []}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', res.data)

    def test_missing_employee_id_in_assignment_returns_400(self):
        self._auth(self.hr)
        payload = {
            'assignments': [{'employee_level_id': 1}],  # no employee_id
            'shared': {
                'categories': [{'category_id': self.category_1.id, 'weightage': '100'}],
                'kra_level_ids': [self.kra_level_1.id],
            },
        }
        res = self.client.post(self._url(), payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('missing employee_id', res.data['error'])

    def test_cycle_not_found_returns_404(self):
        self._auth(self.hr)
        res = self.client.post(
            '/api/v1/kra/cycles/99999/assignments/bulk',
            self._shared_payload([self.emp1.id]),
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # ── Authorization ────────────────────────────────────────────────────────

    def test_lead_cannot_enrol_other_managers_report(self):
        self._auth(self.lead)
        # emp_other reports to hr, not lead
        payload = self._shared_payload([self.emp_other.id])
        res = self.client.post(self._url(), payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('unauthorized_employee_ids', res.data)
        self.assertIn(self.emp_other.id, res.data['unauthorized_employee_ids'])

    def test_hr_can_enrol_any_employee(self):
        self._auth(self.hr)
        payload = self._shared_payload([self.emp1.id, self.emp_other.id])
        res = self.client.post(self._url(), payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['summary']['enrolled_count'], 2)

    # ── Weightage validation ──────────────────────────────────────────────────

    def test_shared_weightage_not_100_returns_400(self):
        self._auth(self.hr)
        payload = {
            'assignments': [{'employee_id': self.emp1.id}],
            'shared': {
                'categories': [{'category_id': self.category_1.id, 'weightage': '50'}],
                'kra_level_ids': [self.kra_level_1.id],
            },
        }
        res = self.client.post(self._url(), payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('100', res.data['error'])

    def test_per_employee_weightage_not_100_goes_to_failed(self):
        self._auth(self.hr)
        payload = {
            'assignments': [{
                'employee_id': self.emp1.id,
                'categories': [{'category_id': self.category_1.id, 'weightage': '70'}],
                'kra_level_ids': [self.kra_level_1.id],
            }],
        }
        res = self.client.post(self._url(), payload, format='json')
        # Only one employee and it failed → 400
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data['summary']['failed_count'], 1)

    # ── Mode A: shared ────────────────────────────────────────────────────────

    def test_mode_a_shared_enrols_all_employees(self):
        self._auth(self.hr)
        payload = self._shared_payload([self.emp1.id, self.emp2.id])
        res = self.client.post(self._url(), payload, format='json')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['summary']['enrolled_count'], 2)
        self.assertEqual(res.data['summary']['skipped_count'], 0)
        self.assertEqual(res.data['summary']['failed_count'], 0)

    def test_mode_a_creates_correct_db_rows(self):
        self._auth(self.hr)
        payload = self._shared_payload([self.emp1.id])
        self.client.post(self._url(), payload, format='json')

        ekc = EmployeeKRACycle.objects.get(employee=self.emp1, kra_cycle=self.cycle)
        self.assertEqual(ekc.status, 'Draft')
        self.assertEqual(ekc.stage_id, 1)
        self.assertEqual(ekc.categories.count(), 2)
        self.assertEqual(ekc.kra_level_rows.count(), 2)

    def test_mode_a_sets_manager_id_from_employee(self):
        self._auth(self.hr)
        payload = self._shared_payload([self.emp1.id])
        self.client.post(self._url(), payload, format='json')

        ekc = EmployeeKRACycle.objects.get(employee=self.emp1, kra_cycle=self.cycle)
        self.assertEqual(ekc.employee_manager_id, self.emp1.manager_id)

    # ── Mode B: per-employee ──────────────────────────────────────────────────

    def test_mode_b_per_employee_different_kras(self):
        self._auth(self.hr)
        payload = {
            'assignments': [
                {
                    'employee_id': self.emp1.id,
                    'categories': [
                        {'category_id': self.category_1.id, 'weightage': '100'},
                    ],
                    'kra_level_ids': [self.kra_level_1.id],
                },
                {
                    'employee_id': self.emp2.id,
                    'categories': [
                        {'category_id': self.category_1.id, 'weightage': '60'},
                        {'category_id': self.category_2.id, 'weightage': '40'},
                    ],
                    'kra_level_ids': [self.kra_level_1.id, self.kra_level_2.id],
                },
            ],
        }
        res = self.client.post(self._url(), payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        ekc1 = EmployeeKRACycle.objects.get(employee=self.emp1, kra_cycle=self.cycle)
        ekc2 = EmployeeKRACycle.objects.get(employee=self.emp2, kra_cycle=self.cycle)

        self.assertEqual(ekc1.kra_level_rows.count(), 1)
        self.assertEqual(ekc2.kra_level_rows.count(), 2)
        self.assertEqual(ekc1.categories.count(), 1)
        self.assertEqual(ekc2.categories.count(), 2)

    # ── Already enrolled ─────────────────────────────────────────────────────

    def test_already_enrolled_employee_is_skipped(self):
        self._enrol(self.emp1)
        self._auth(self.hr)
        payload = self._shared_payload([self.emp1.id, self.emp2.id])
        res = self.client.post(self._url(), payload, format='json')

        self.assertEqual(res.status_code, status.HTTP_207_MULTI_STATUS)
        self.assertEqual(res.data['summary']['enrolled_count'], 1)
        self.assertEqual(res.data['summary']['skipped_count'], 1)
        skipped_ids = [s['employee_id'] for s in res.data['skipped']]
        self.assertIn(self.emp1.id, skipped_ids)

    def test_already_enrolled_not_duplicated_in_db(self):
        self._enrol(self.emp1)
        self._auth(self.hr)
        payload = self._shared_payload([self.emp1.id])
        self.client.post(self._url(), payload, format='json')

        count = EmployeeKRACycle.objects.filter(
            employee=self.emp1, kra_cycle=self.cycle
        ).count()
        self.assertEqual(count, 1)

    # ── HTTP status codes ────────────────────────────────────────────────────

    def test_all_enrolled_returns_201(self):
        self._auth(self.hr)
        res = self.client.post(
            self._url(), self._shared_payload([self.emp1.id]), format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_mixed_results_returns_207(self):
        self._enrol(self.emp1)
        self._auth(self.hr)
        res = self.client.post(
            self._url(), self._shared_payload([self.emp1.id, self.emp2.id]), format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_207_MULTI_STATUS)

    # ── Audit log ────────────────────────────────────────────────────────────

    def test_audit_log_created(self):
        self._auth(self.hr)
        before = AuditLog.objects.count()
        self.client.post(
            self._url(), self._shared_payload([self.emp1.id]), format='json'
        )
        self.assertEqual(AuditLog.objects.count(), before + 1)
        log = AuditLog.objects.latest('id')
        self.assertEqual(log.action, 'KRA_BULK_ASSIGNED')


# ═════════════════════════════════════════════════════════════════════════════
#  3. KRAAssignmentUpdateDeleteView
# ═════════════════════════════════════════════════════════════════════════════

class KRAAssignmentUpdateDeleteViewTests(BaseTestCase):

    def _url(self, ekc_id):
        return f'/api/v1/kra/assignments/{ekc_id}'

    def _update_payload(self):
        return {
            'categories': [
                {'category_id': self.category_1.id, 'weightage': '70'},
                {'category_id': self.category_2.id, 'weightage': '30'},
            ],
            'kra_level_ids': [self.kra_level_1.id],
        }

    def setUp(self):
        super().setUp()
        # emp1 is enrolled and in stage 1
        self.ekc = self._enrol(self.emp1, stage=self.stage_1)
        self._add_categories(self.ekc)
        self._add_kra_rows(self.ekc)

    # ── PUT auth ─────────────────────────────────────────────────────────────

    def test_put_unauthenticated_returns_401(self):
        res = self.client.put(self._url(self.ekc.id), self._update_payload(), format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_put_forbidden_if_not_manager(self):
        # emp_other is not under lead's management
        other_ekc = self._enrol(self.emp_other)
        self._auth(self.lead)
        res = self.client.put(self._url(other_ekc.id), self._update_payload(), format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # ── PUT stage enforcement ────────────────────────────────────────────────

    def test_put_blocked_after_stage_1(self):
        self.ekc.stage = self.stage_2
        self.ekc.save()
        self._auth(self.hr)
        res = self.client.put(self._url(self.ekc.id), self._update_payload(), format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Stage 1', res.data)

    def test_put_allowed_in_stage_1(self):
        self._auth(self.hr)
        res = self.client.put(self._url(self.ekc.id), self._update_payload(), format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    # ── PUT weightage validation ──────────────────────────────────────────────

    def test_put_invalid_weightage_returns_400(self):
        self._auth(self.hr)
        payload = {
            'categories': [{'category_id': self.category_1.id, 'weightage': '50'}],
            'kra_level_ids': [self.kra_level_1.id],
        }
        res = self.client.put(self._url(self.ekc.id), payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # ── PUT DB state ─────────────────────────────────────────────────────────

    def test_put_replaces_categories_and_kra_rows(self):
        self._auth(self.hr)
        self.client.put(self._url(self.ekc.id), self._update_payload(), format='json')

        self.ekc.refresh_from_db()
        # Categories replaced: now only 2 (70+30)
        self.assertEqual(self.ekc.categories.count(), 2)
        # KRA rows replaced: now only 1
        self.assertEqual(self.ekc.kra_level_rows.count(), 1)
        self.assertEqual(
            self.ekc.kra_level_rows.first().kra_level_id,
            self.kra_level_1.id,
        )

    def test_put_updates_employee_level_id(self):
        self._auth(self.hr)
        payload = {**self._update_payload(), 'employee_level_id': self.level_mid.id}
        self.client.put(self._url(self.ekc.id), payload, format='json')
        self.ekc.refresh_from_db()
        self.assertEqual(self.ekc.employee_level_id, self.level_mid.id)

    def test_put_creates_audit_log(self):
        self._auth(self.hr)
        before = AuditLog.objects.count()
        self.client.put(self._url(self.ekc.id), self._update_payload(), format='json')
        self.assertEqual(AuditLog.objects.count(), before + 1)
        self.assertEqual(AuditLog.objects.latest('id').action, 'KRA_ASSIGNMENT_UPDATED')

    # ── DELETE auth ──────────────────────────────────────────────────────────

    def test_delete_unauthenticated_returns_401(self):
        res = self.client.delete(self._url(self.ekc.id))
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_delete_forbidden_if_not_manager(self):
        other_ekc = self._enrol(self.emp_other)
        self._auth(self.lead)
        res = self.client.delete(self._url(other_ekc.id))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # ── DELETE stage enforcement ──────────────────────────────────────────────

    def test_delete_blocked_after_stage_1(self):
        self.ekc.stage = self.stage_2
        self.ekc.save()
        self._auth(self.hr)
        res = self.client.delete(self._url(self.ekc.id))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Stage 1', res.data)

    def test_delete_allowed_in_stage_1(self):
        self._auth(self.hr)
        res = self.client.delete(self._url(self.ekc.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    # ── DELETE DB state ───────────────────────────────────────────────────────

    def test_delete_removes_ekc_and_children(self):
        self._auth(self.hr)
        ekc_id = self.ekc.id
        self.client.delete(self._url(ekc_id))

        self.assertFalse(EmployeeKRACycle.objects.filter(id=ekc_id).exists())
        self.assertFalse(EmployeeKRACycleCategory.objects.filter(employee_kra_cycle_id=ekc_id).exists())
        self.assertFalse(EmployeeKRALevel.objects.filter(employee_kra_cycle_id=ekc_id).exists())

    def test_delete_creates_audit_log(self):
        self._auth(self.hr)
        before = AuditLog.objects.count()
        self.client.delete(self._url(self.ekc.id))
        self.assertEqual(AuditLog.objects.count(), before + 1)
        self.assertEqual(AuditLog.objects.latest('id').action, 'KRA_ASSIGNMENT_DELETED')

    def test_delete_nonexistent_returns_404(self):
        self._auth(self.hr)
        res = self.client.delete(self._url(99999))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)


# ═════════════════════════════════════════════════════════════════════════════
#  4. KRAAssignmentCloneView
# ═════════════════════════════════════════════════════════════════════════════

class KRAAssignmentCloneViewTests(BaseTestCase):

    URL = '/api/v1/kra/assignments/clone-from'

    def setUp(self):
        super().setUp()

        # Source enrolment with 2 KRA rows
        self.source_ekc = self._enrol(self.emp1)
        self._add_kra_rows(self.source_ekc, employee=self.emp1)

        # Target enrolment — empty
        self.target_ekc = self._enrol(self.emp2)

    # ── Input validation ─────────────────────────────────────────────────────

    def test_missing_source_returns_400(self):
        self._auth(self.hr)
        res = self.client.post(self.URL, {
            'target_employee_kra_cycle_ids': [self.target_ekc.id],
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('source_employee_kra_cycle_id', res.data['error'])

    def test_missing_targets_returns_400(self):
        self._auth(self.hr)
        res = self.client.post(self.URL, {
            'source_employee_kra_cycle_id': self.source_ekc.id,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_empty_targets_returns_400(self):
        self._auth(self.hr)
        res = self.client.post(self.URL, {
            'source_employee_kra_cycle_id': self.source_ekc.id,
            'target_employee_kra_cycle_ids': [],
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_source_in_targets_returns_400(self):
        self._auth(self.hr)
        res = self.client.post(self.URL, {
            'source_employee_kra_cycle_id': self.source_ekc.id,
            'target_employee_kra_cycle_ids': [self.source_ekc.id],
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('source cannot also be a target', res.data['error'])

    def test_invalid_mode_returns_400(self):
        self._auth(self.hr)
        res = self.client.post(self.URL, {
            'source_employee_kra_cycle_id': self.source_ekc.id,
            'target_employee_kra_cycle_ids': [self.target_ekc.id],
            'mode': 'magic',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('mode must be one of', res.data['error'])

    def test_source_with_no_kra_rows_returns_404(self):
        self._auth(self.hr)
        empty_ekc = self._enrol(self.emp_other)  # no KRA rows
        res = self.client.post(self.URL, {
            'source_employee_kra_cycle_id': empty_ekc.id,
            'target_employee_kra_cycle_ids': [self.target_ekc.id],
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_missing_target_ids_returns_400(self):
        self._auth(self.hr)
        res = self.client.post(self.URL, {
            'source_employee_kra_cycle_id': self.source_ekc.id,
            'target_employee_kra_cycle_ids': [99999],
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('missing_target_ids', res.data)
        self.assertIn(99999, res.data['missing_target_ids'])

    # ── mode=skip (default) ───────────────────────────────────────────────────

    def test_skip_mode_clones_empty_target(self):
        self._auth(self.hr)
        res = self.client.post(self.URL, {
            'source_employee_kra_cycle_id': self.source_ekc.id,
            'target_employee_kra_cycle_ids': [self.target_ekc.id],
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['summary']['cloned_count'], 1)
        self.assertEqual(self.target_ekc.kra_level_rows.count(), 2)

    def test_skip_mode_skips_target_with_existing_rows(self):
        self._add_kra_rows(self.target_ekc, employee=self.emp2)
        self._auth(self.hr)
        res = self.client.post(self.URL, {
            'source_employee_kra_cycle_id': self.source_ekc.id,
            'target_employee_kra_cycle_ids': [self.target_ekc.id],
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['summary']['skipped_count'], 1)
        # Existing rows untouched — still 2 (not 4)
        self.assertEqual(self.target_ekc.kra_level_rows.count(), 2)

    # ── mode=overwrite ────────────────────────────────────────────────────────

    def test_overwrite_mode_replaces_existing_rows(self):
        self._add_kra_rows(self.target_ekc, employee=self.emp2)
        self.assertEqual(self.target_ekc.kra_level_rows.count(), 2)

        self._auth(self.hr)
        res = self.client.post(self.URL, {
            'source_employee_kra_cycle_id': self.source_ekc.id,
            'target_employee_kra_cycle_ids': [self.target_ekc.id],
            'mode': 'overwrite',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['summary']['cloned_count'], 1)
        # Still 2 rows but they are fresh clones (old ones deleted)
        self.assertEqual(self.target_ekc.kra_level_rows.count(), 2)

    def test_overwrite_nulls_ratings(self):
        # Give the target existing rows with ratings
        ekl = EmployeeKRALevel.objects.create(
            employee=self.emp2,
            kra_level=self.kra_level_1,
            employee_kra_cycle=self.target_ekc,
            self_rating_id=None,
            lead_rating_id=None,
        )
        self._auth(self.hr)
        self.client.post(self.URL, {
            'source_employee_kra_cycle_id': self.source_ekc.id,
            'target_employee_kra_cycle_ids': [self.target_ekc.id],
            'mode': 'overwrite',
        }, format='json')

        for row in self.target_ekc.kra_level_rows.all():
            self.assertIsNone(row.self_rating_id)
            self.assertIsNone(row.lead_rating_id)
            self.assertIsNone(row.self_comment)
            self.assertIsNone(row.lead_comment)
            self.assertIsNone(row.progress_notes)

    # ── mode=append ───────────────────────────────────────────────────────────

    def test_append_mode_adds_only_missing_rows(self):
        # Target already has kra_level_1 but not kra_level_2
        EmployeeKRALevel.objects.create(
            employee=self.emp2,
            kra_level=self.kra_level_1,
            employee_kra_cycle=self.target_ekc,
        )
        self._auth(self.hr)
        res = self.client.post(self.URL, {
            'source_employee_kra_cycle_id': self.source_ekc.id,
            'target_employee_kra_cycle_ids': [self.target_ekc.id],
            'mode': 'append',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        # Should now have 2 rows: the original 1 + 1 newly appended
        self.assertEqual(self.target_ekc.kra_level_rows.count(), 2)
        self.assertEqual(res.data['cloned'][0]['kras_copied'], 1)

    def test_append_mode_skips_when_all_rows_exist(self):
        # Target already has both KRA rows
        self._add_kra_rows(self.target_ekc, employee=self.emp2)
        self._auth(self.hr)
        res = self.client.post(self.URL, {
            'source_employee_kra_cycle_id': self.source_ekc.id,
            'target_employee_kra_cycle_ids': [self.target_ekc.id],
            'mode': 'append',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['summary']['skipped_count'], 1)
        self.assertIn('nothing to append', res.data['skipped'][0]['reason'])

    # ── Multi-target ──────────────────────────────────────────────────────────

    def test_multiple_targets_mixed_results_returns_207(self):
        # Create a third enrolment with existing rows (will be skipped in skip mode)
        third_ekc = self._enrol(self.emp_other)
        self._add_kra_rows(third_ekc, employee=self.emp_other)

        self._auth(self.hr)
        res = self.client.post(self.URL, {
            'source_employee_kra_cycle_id': self.source_ekc.id,
            'target_employee_kra_cycle_ids': [self.target_ekc.id, third_ekc.id],
            'mode': 'skip',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_207_MULTI_STATUS)
        self.assertEqual(res.data['summary']['cloned_count'],  1)
        self.assertEqual(res.data['summary']['skipped_count'], 1)

    def test_multiple_targets_all_cloned_returns_201(self):
        # Create another empty target
        another_ekc = self._enrol(self.emp_other)
        self._auth(self.hr)
        res = self.client.post(self.URL, {
            'source_employee_kra_cycle_id': self.source_ekc.id,
            'target_employee_kra_cycle_ids': [self.target_ekc.id, another_ekc.id],
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['summary']['cloned_count'], 2)

    # ── DB correctness ────────────────────────────────────────────────────────

    def test_clone_uses_target_employee_id_not_source(self):
        self._auth(self.hr)
        self.client.post(self.URL, {
            'source_employee_kra_cycle_id': self.source_ekc.id,
            'target_employee_kra_cycle_ids': [self.target_ekc.id],
        }, format='json')

        for row in self.target_ekc.kra_level_rows.all():
            self.assertEqual(row.employee_id, self.emp2.id)

    def test_response_contains_expected_fields(self):
        self._auth(self.hr)
        res = self.client.post(self.URL, {
            'source_employee_kra_cycle_id': self.source_ekc.id,
            'target_employee_kra_cycle_ids': [self.target_ekc.id],
        }, format='json')
        for field in ('source_employee_kra_cycle_id', 'kras_in_source',
                      'cloned', 'skipped', 'failed', 'summary'):
            self.assertIn(field, res.data, f"Missing field: {field}")

    # ── Audit ────────────────────────────────────────────────────────────────

    def test_audit_log_created(self):
        self._auth(self.hr)
        before = AuditLog.objects.count()
        self.client.post(self.URL, {
            'source_employee_kra_cycle_id': self.source_ekc.id,
            'target_employee_kra_cycle_ids': [self.target_ekc.id],
        }, format='json')
        self.assertEqual(AuditLog.objects.count(), before + 1)
        self.assertEqual(AuditLog.objects.latest('id').action, 'KRA_ASSIGNMENT_BULK_CLONED')