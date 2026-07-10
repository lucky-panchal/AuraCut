"""
apps/export/models.py

ExportJob tracks a single server-side video export request.
One project can have multiple export jobs over its lifetime.
"""

import logging

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone

from core.models import BaseModel
from apps.projects.models import Project

logger = logging.getLogger("auracut")


class ExportJob(BaseModel):
    """
    Represents a single export job for a project.

    Lifecycle:
        queued     → job created, Celery task queued
        processing → Celery worker running FFmpeg
        completed  → output file written, download URL available
        failed     → FFmpeg error, error_message populated

    Export settings are stored on the job so the exact configuration
    used for each export is always auditable.
    """

    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    class Resolution(models.TextChoices):
        P480 = "480p", "480p"
        P720 = "720p", "720p"
        P1080 = "1080p", "1080p"

    class Format(models.TextChoices):
        MP4 = "mp4", "MP4"
        WEBM = "webm", "WebM"

    class Bitrate(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    class FPS(models.IntegerChoices):
        FPS_24 = 24, "24 fps"
        FPS_30 = 30, "30 fps"
        FPS_60 = 60, "60 fps"

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="export_jobs",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="export_jobs",
    )

    # Export configuration
    resolution = models.CharField(
        max_length=10,
        choices=Resolution.choices,
        default=Resolution.P1080,
    )
    format = models.CharField(
        max_length=10,
        choices=Format.choices,
        default=Format.MP4,
    )
    bitrate = models.CharField(
        max_length=10,
        choices=Bitrate.choices,
        default=Bitrate.MEDIUM,
    )
    fps = models.IntegerField(
        choices=FPS.choices,
        default=FPS.FPS_30,
    )
    subtitle_burn_in = models.BooleanField(default=False)

    # Status tracking
    status = models.CharField(
        max_length=15,
        choices=Status.choices,
        default=Status.QUEUED,
    )
    progress = models.IntegerField(default=0)
    output_path = models.CharField(max_length=512, blank=True, default="")
    error_message = models.TextField(blank=True, default="")
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Export Job"
        verbose_name_plural = "Export Jobs"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"ExportJob({self.project.name}, {self.status}, {self.resolution})"

    def mark_processing(self) -> None:
        self.status = self.Status.PROCESSING
        self.progress = 0
        self.save(update_fields=["status", "progress", "updated_at"])

    def update_progress(self, progress: int) -> None:
        self.progress = max(0, min(100, progress))
        self.save(update_fields=["progress", "updated_at"])

    def mark_completed(self, output_path: str) -> None:
        self.status = self.Status.COMPLETED
        self.progress = 100
        self.output_path = output_path
        self.completed_at = timezone.now()
        self.save(update_fields=[
            "status", "progress", "output_path", "completed_at", "updated_at",
        ])
        logger.info("ExportJob '%s' completed: %s", self.id, output_path)

    def mark_failed(self, message: str) -> None:
        self.status = self.Status.FAILED
        self.error_message = message
        self.save(update_fields=["status", "error_message", "updated_at"])
        logger.error("ExportJob '%s' failed: %s", self.id, message)
