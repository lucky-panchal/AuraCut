"""
apps/projects/serializers.py

Serializers for Project CRUD and timeline state persistence.
"""

from rest_framework import serializers

from .models import Project


class ProjectSerializer(serializers.ModelSerializer):
    """
    Full project representation — used for list, create, and retrieve.
    owner is read-only, set from request.user in the view.
    """

    owner = serializers.StringRelatedField(read_only=True)
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            "id",
            "name",
            "owner",
            "thumbnail_url",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "owner", "created_at", "updated_at")

    def get_thumbnail_url(self, obj: Project) -> str | None:
        if obj.thumbnail:
            request = self.context.get("request")
            return request.build_absolute_uri(obj.thumbnail.url) if request else obj.thumbnail.url
        return None


class ProjectUpdateSerializer(serializers.ModelSerializer):
    """Used for PATCH — only name is updatable via this endpoint."""

    class Meta:
        model = Project
        fields = ("name",)


class TimelineStateSerializer(serializers.ModelSerializer):
    """
    Used for GET and PATCH /api/projects/<id>/timeline/.
    Exposes only the timeline_state JSON field.
    """

    class Meta:
        model = Project
        fields = ("id", "timeline_state", "updated_at")
        read_only_fields = ("id", "updated_at")
