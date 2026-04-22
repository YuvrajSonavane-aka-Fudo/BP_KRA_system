from django.urls import path
from .views import MicrosoftLoginView, MicrosoftCallbackView, MicrosoftLogoutView , MeView

urlpatterns = [
    path('auth/microsoft/login',    MicrosoftLoginView.as_view()),
    path('auth/microsoft/callback', MicrosoftCallbackView.as_view()),
    path('auth/microsoft/logout',   MicrosoftLogoutView.as_view()),
    path('auth/me', MeView.as_view()),
]