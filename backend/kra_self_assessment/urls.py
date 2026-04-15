from django.urls import path
from .views import (
    SelfAssessmentView,
    SelfAssessmentSubmitView
)

urlpatterns = [
    path('kra/cycles/<int:cycle_id>/self-assessment',SelfAssessmentView.as_view()),
    path('kra/assessments/<int:employee_kra_level_id>/self',SelfAssessmentSubmitView.as_view()),
]