"""
apps/accounts/serializers.py

Serializers for user registration, login, and profile management.
"""

import logging

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import UserProfile

logger = logging.getLogger("auracut")


class RegisterSerializer(serializers.ModelSerializer):
    """
    Handles new user registration.
    Validates unique email and password strength via Django's validators.
    """

    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True)
    password_confirm = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ("username", "email", "password", "password_confirm")

    def validate_email(self, value: str) -> str:
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def validate(self, attrs: dict) -> dict:
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        validate_password(attrs["password"])
        return attrs

    def create(self, validated_data: dict) -> User:
        validated_data.pop("password_confirm")
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
        )
        logger.debug("New user registered: '%s'.", user.username)
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializes UserProfile fields alongside core User fields.
    Used for GET and PATCH /api/auth/profile/.
    """

    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ("id", "username", "email", "display_name", "avatar", "avatar_url")
        extra_kwargs = {
            "avatar": {"write_only": True},
        }

    def get_avatar_url(self, obj: UserProfile) -> str | None:
        if obj.avatar:
            request = self.context.get("request")
            return request.build_absolute_uri(obj.avatar.url) if request else obj.avatar.url
        return None


class UserSummarySerializer(serializers.ModelSerializer):
    """
    Lightweight read-only user representation returned after login/register.
    """

    display_name = serializers.CharField(source="profile.name", read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "email", "display_name", "avatar_url")

    def get_avatar_url(self, obj: User) -> str | None:
        profile = getattr(obj, "profile", None)
        if profile and profile.avatar:
            request = self.context.get("request")
            return request.build_absolute_uri(profile.avatar.url) if request else profile.avatar.url
        return None
