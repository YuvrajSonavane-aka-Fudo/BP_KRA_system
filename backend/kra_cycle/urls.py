from django.urls import path
from .views import LoginView, LogoutView, KRACycleListCreateView

urlpatterns = [
    path('auth/login',  LoginView.as_view()),
    path('auth/logout', LogoutView.as_view()),
    path('kra/cycles',  KRACycleListCreateView.as_view()),
]