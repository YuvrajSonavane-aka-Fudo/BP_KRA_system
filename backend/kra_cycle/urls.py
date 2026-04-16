from django.urls import path
from .views import (
    LoginView,
    LogoutView,
    KRACycleListCreateView,
    KRACycleUpdateView,
    KRACycleCloneView,
    KRACycleAdvanceStageView,
)

urlpatterns = [
    path('auth/login',LoginView.as_view()),
    path('auth/logout',LogoutView.as_view()),
    path('kra/cycles', KRACycleListCreateView.as_view()),
    path('kra/cycles/<int:cycle_id>', KRACycleUpdateView.as_view()),
    path('kra/cycles/<int:cycle_id>/clone',KRACycleCloneView.as_view()),
    path('kra/cycles/<int:cycle_id>/advance-stage' , KRACycleAdvanceStageView.as_view()),
]