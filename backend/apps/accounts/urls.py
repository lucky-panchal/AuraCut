"""
apps/accounts/urls.py

All auth endpoints live under /api/auth/.
Login and token refresh are provided by SimpleJWT views directly.
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import RegisterView, LogoutView, ProfileView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", TokenObtainPairView.as_view(), name="auth-login"),
    path("refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("profile/", ProfileView.as_view(), name="auth-profile"),
]
