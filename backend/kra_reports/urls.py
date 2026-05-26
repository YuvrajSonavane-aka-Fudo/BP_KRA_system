from django.urls import path
from .views import MultiCycleReportView

urlpatterns = [
    
    path('reports/multi-cycle',          MultiCycleReportView.as_view()),
]