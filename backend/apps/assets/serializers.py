"""
apps/assets/serializers.py

Serializer for MediaAsset — used in API responses and WebSocket notifications.
"""

from rest_framework import serializers

from .models import MediaAsset


class MediaAssetSerializer(serializers.ModelSerializer):
    """
    Full asset representation returned to the client.
    file_url, proxy_url, thumbnail_url are built as absolute URLs.
    """

    file_url = serializers.SerializerMethodField()
    proxy_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = MediaAsset
        fields = (
            "id",
            "project",
            "filename",
            "asset_type",
            "file_url",
            "proxy_url",
            "thumbnail_url",
            "duration",
            "resolution",
            "fps",
            "codec",
            "file_size",
            "status",
            "error_message",
            "created_at",
        )
        read_only_fields = fields

    def _build_url(self, path: str) -> str | None:
        if not path:
            return None
        request = self.context.get("request")
        url = f"/media/{path}"
        return request.build_absolute_uri(url) if request else url

    def get_file_url(self, obj: MediaAsset) -> str | None:
        return self._build_url(obj.file_path)

    def get_proxy_url(self, obj: MediaAsset) -> str | None:
        return self._build_url(obj.proxy_path)

    def get_thumbnail_url(self, obj: MediaAsset) -> str | None:
        return self._build_url(obj.thumbnail_path)
