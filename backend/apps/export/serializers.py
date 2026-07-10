"""
apps/export/serializers.py

Serializers for ExportJob creation and status responses.
"""

from rest_framework import serializers

from .models import ExportJob


class ExportJobCreateSerializer(serializers.Serializer):
    """Validates export settings submitted by the client."""

    resolution = serializers.ChoiceField(choices=ExportJob.Resolution.choices)
    format = serializers.ChoiceField(choices=ExportJob.Format.choices)
    bitrate = serializers.ChoiceField(choices=ExportJob.Bitrate.choices)
    fps = serializers.ChoiceField(choices=[24, 30, 60])
    subtitle_burn_in = serializers.BooleanField(default=False)


class ExportJobSerializer(serializers.ModelSerializer):
    """Full export job representation returned to the client."""

    download_url = serializers.SerializerMethodField()

    class Meta:
        model = ExportJob
        fields = (
            "id",
            "project",
            "status",
            "progress",
            "resolution",
            "format",
            "bitrate",
            "fps",
            "subtitle_burn_in",
            "download_url",
            "error_message",
            "created_at",
            "completed_at",
        )
        read_only_fields = fields

    def get_download_url(self, obj: ExportJob) -> str | None:
        if not obj.output_path:
            return None
        request = self.context.get("request")
        url = f"/media/{obj.output_path}"
        return request.build_absolute_uri(url) if request else url
