from django.urls import path
from .views import (
    AssessmentProgressView,
    LeadReviewView,
    LeadDescriptionView
)

urlpatterns = [
    path('kra/cycles/<int:cycle_id>/progress',AssessmentProgressView.as_view()),
    path('kra/assessments/<int:employee_kra_level_id>/lead-review',LeadReviewView.as_view()),
    path('kra/assessments/<int:employee_kra_level_id>/description',LeadDescriptionView.as_view()),
    
]