"""
apps/assets/models.py

MediaAsset represents a single uploaded file (video, audio, or image)
belonging to a project. Tracks processing status and stores paths to
the original file, proxy, and thumbnail.
"""

import logging

from django.db import models

from core.models import BaseModel
from apps.projects.models import Project

logger = logging.getLogger("auracut")


class MediaAsset(BaseModel):
    """
    A single media file uploaded to a project.

    Lifecycle:
        uploading  → file received, saved to disk, Celery task queued
        processing → Celery worker extracting metadata + generating proxy
        ready      → all processing complete, asset usable in timeline
        error      → processing failed, error_message populated

    Fields:
        project        — owning project (cascade delete)
        filename       — original filename as uploaded
        asset_type     — video / audio / image
        file_path      — path to original file relative to MEDIA_ROOT
        proxy_path     — path to low-res proxy (video only)
        thumbnail_path — path to thumbnail JPEG (video/image only)
        duration       — duration in seconds (video/audio only)
        resolution     — WxH string e.g. "1920x1080" (video/image only)
        fps            — frames per second (video only)
        codec          — codec name from ffprobe (video/audio only)
        file_size      — size in bytes
        status         — current processing status
        error_message  — populated on status=error
    """

    class AssetType(models.TextChoices):
        VIDEO = "video", "Video"
        AUDIO = "audio", "Audio"
        IMAGE = "image", "Image"

    class Status(models.TextChoices):
        UPLOADING = "uploading", "Uploading"
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        ERROR = "error", "Error"

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="assets",
    )
    filename = models.CharField(max_length=255)
    asset_type = models.CharField(max_length=10, choices=AssetType.choices)

    # File paths stored relative to MEDIA_ROOT
    file_path = models.CharField(max_length=512)
    proxy_path = models.CharField(max_length=512, blank=True, default="")
    thumbnail_path = models.CharField(max_length=512, blank=True, default="")

    # Metadata extracted by ffprobe after upload
    duration = models.FloatField(null=True, blank=True)
    resolution = models.CharField(max_length=20, blank=True, default="")
    fps = models.FloatField(null=True, blank=True)
    codec = models.CharField(max_length=50, blank=True, default="")
    file_size = models.BigIntegerField(default=0)

    status = models.CharField(
        max_length=15,
        choices=Status.choices,
        default=Status.UPLOADING,
    )
    error_message = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Media Asset"
        verbose_name_plural = "Media Assets"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"MediaAsset({self.filename}, {self.asset_type}, {self.status})"

    def mark_processing(self) -> None:
        self.status = self.Status.PROCESSING
        self.save(update_fields=["status", "updated_at"])

    def mark_ready(
        self,
        *,
        proxy_path: str = "",
        thumbnail_path: str = "",
        duration: float | None = None,
        resolution: str = "",
        fps: float | None = None,
        codec: str = "",
    ) -> None:
        self.status = self.Status.READY
        self.proxy_path = proxy_path
        self.thumbnail_path = thumbnail_path
        self.duration = duration
        self.resolution = resolution
        self.fps = fps
        self.codec = codec
        self.save(update_fields=[
            "status", "proxy_path", "thumbnail_path",
            "duration", "resolution", "fps", "codec", "updated_at",
        ])
        logger.info("Asset '%s' marked ready.", self.id)

    def mark_error(self, message: str) -> None:
        self.status = self.Status.ERROR
        self.error_message = message
        self.save(update_fields=["status", "error_message", "updated_at"])
        logger.error("Asset '%s' processing failed: %s", self.id, message)
