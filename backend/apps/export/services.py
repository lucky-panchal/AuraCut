"""
apps/export/services.py

ExportService handles export job creation and queue management.
"""

import logging

from django.contrib.auth.models import User

from apps.projects.models import Project
from .models import ExportJob
from .tasks import export_task

logger = logging.getLogger("auracut")


class ExportService:
    """Handles export job lifecycle — creation, queuing, and status retrieval."""

    @staticmethod
    def create_export_job(
        user: User,
        project: Project,
        resolution: str,
        format: str,
        bitrate: str,
        fps: int,
        subtitle_burn_in: bool,
    ) -> ExportJob:
        """
        Creates an ExportJob record and queues the Celery export task.
        Returns the job immediately (202 pattern — processing is async).
        """
        job = ExportJob.objects.create(
            project=project,
            user=user,
            resolution=resolution,
            format=format,
            bitrate=bitrate,
            fps=fps,
            subtitle_burn_in=subtitle_burn_in,
        )

        export_task.delay(str(job.id))
        logger.info(
            "ExportJob queued: id=%s project=%s user=%s settings=%s/%s/%s/%sfps",
            job.id, project.id, user.username,
            resolution, format, bitrate, fps,
        )
        return job

    @staticmethod
    def get_job(user: User, job_id: str) -> ExportJob | None:
        """Returns an export job owned by the user, or None."""
        return ExportJob.objects.filter(id=job_id, user=user).first()

    @staticmethod
    def get_queue_position(job: ExportJob) -> int:
        """
        Returns the number of jobs ahead of this one in the queue.
        Only counts queued jobs for the same user (per-user FIFO).
        """
        return ExportJob.objects.filter(
            user=job.user,
            status=ExportJob.Status.QUEUED,
            created_at__lt=job.created_at,
        ).count()
