"""
apps/accounts/views.py

Auth endpoints for Auracut.
Login and token refresh are handled directly by SimpleJWT views.
This file covers: register, logout, and profile management.
"""

import logging

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import UserProfile
from .serializers import RegisterSerializer, UserProfileSerializer, UserSummarySerializer

logger = logging.getLogger("auracut")


class RegisterView(APIView):
    """
    POST /api/auth/register/

    Creates a new user account. Returns JWT pair + user summary on success.
    Open endpoint — no authentication required.
    """

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user: User = serializer.save()

        refresh = RefreshToken.for_user(user)
        user_data = UserSummarySerializer(user, context={"request": request}).data

        logger.info("User registered: '%s'.", user.username)

        return Response(
            {
                "user": user_data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class LogoutView(APIView):
    """
    POST /api/auth/logout/

    Blacklists the provided refresh token, invalidating the session.
    Requires authentication.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        refresh_token = request.data.get("refresh")

        if not refresh_token:
            return Response(
                {"detail": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            logger.info("User '%s' logged out.", request.user.username)
        except TokenError as exc:
            logger.warning("Logout failed for user '%s': %s", request.user.username, exc)
            return Response(
                {"detail": "Invalid or expired token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class ProfileView(APIView):
    """
    GET  /api/auth/profile/  — returns current user's profile
    PATCH /api/auth/profile/ — updates display_name and/or avatar
    """

    permission_classes = [IsAuthenticated]

    def _get_profile(self, user: User) -> UserProfile:
        profile, _ = UserProfile.objects.get_or_create(user=user)
        return profile

    def get(self, request: Request) -> Response:
        profile = self._get_profile(request.user)
        serializer = UserProfileSerializer(profile, context={"request": request})
        return Response(serializer.data)

    def patch(self, request: Request) -> Response:
        profile = self._get_profile(request.user)
        serializer = UserProfileSerializer(
            profile,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        logger.info("Profile updated for user '%s'.", request.user.username)
        return Response(serializer.data)
