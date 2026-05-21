from django.urls import path
from .views import CycleReportView, MultiCycleReportView

urlpatterns = [
    path('reports/cycle/<int:cycle_id>', CycleReportView.as_view()),
    path('reports/multi-cycle',          MultiCycleReportView.as_view()),
]