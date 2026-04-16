from django.urls import path
from .views import (
    ReportView,
    ReportExportView,
)

urlpatterns = [
    path('kra/cycles/<int:cycle_id>/export',ReportExportView.as_view()), 
    path('kra/cycles/<int:cycle_id>/report',ReportView.as_view()),
     
]