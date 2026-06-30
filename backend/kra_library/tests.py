from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from kra_cycle.models import KRACategory, KRA, Role, Employee

class LibraryTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.role_hr = Role.objects.create(name='HR')
        self.hr = Employee.objects.create(
            id=1, email='hr@test.com', first_name='HR', last_name='User',
            active=True, role=self.role_hr,
        )
        self.category = KRACategory.objects.create(name='Core Development', is_standard=True)
        self.kra = KRA.objects.create(name='Own a feature', category=self.category)

    def test_list_library_kras(self):
        """Asserts that GET /api/v1/kra/library_kra returns HTTP 200 OK."""
        self.client.force_authenticate(user=self.hr)
        response = self.client.get('/api/v1/kra/library_kra')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
