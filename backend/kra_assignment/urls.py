from django.urls import path
from .views import (
    EmployeeListView,
    KRABulkAssignmentEnrolView,
    KRAAssignmentUpdateDeleteView,
    KRAAssignmentCloneView,
)

urlpatterns = [
    path('employees/',EmployeeListView.as_view()),
    path('kra/cycles/<int:cycle_id>/assignments/bulk',KRABulkAssignmentEnrolView.as_view()),
    path('kra/assignments/<int:employee_kra_cycle_id>',KRAAssignmentUpdateDeleteView.as_view()),
    path('kra/assignments/clone-from',KRAAssignmentCloneView.as_view()),
    
    
    
]