"""
apps/export/tasks.py

Celery task that executes the full FFmpeg export pipeline.

Responsibilities:
    1. Fetch ExportJob + Project.timeline_state from DB
    2. Build FFmpeg command via FFmpegCommandBuilder
    3. Execute FFmpeg subprocess, parse progress from stderr
    4. Stream progress updates to client via WebSocket channel group
    5. On completion: update job, send download URL
    6. On failure: log stderr, update job, send error message
"""

import logging
import re
import subprocess
from pathlib import Path

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.conf import settings

from .models import ExportJob
from .ffmpeg import FFmpegCommandBuilder

logger = logging.getLogger("auracut")

# Regex to parse FFmpeg progress output: "out_time_ms=123456789"
_PROGRESS_RE = re.compile(r"out_time_ms=(\d+)")
_DURATION_RE = re.compile(r"Duration:\s*(\d+):(\d+):([\d.]+)")


# ---------------------------------------------------------------------------
# WebSocket notification helpers
# ---------------------------------------------------------------------------

def _send_ws_message(job_id: str, message: dict) -> None:
    """Sends a message to the export job's WebSocket channel group."""
    channel_layer = get_channel_layer()
    if channel_layer is None:
        logger.warning("Channel layer unavailable — skipping WebSocket notification.")
        return
    async_to_sync(channel_layer.group_send)(
        f"export_{job_id}",
        {"type": "export.message", **message},
    )


def _send_progress(job_id: str, progress: int) -> None:
    _send_ws_message(job_id, {"event": "progress", "value": progress})


def _send_completed(job_id: str, download_url: str) -> None:
    _send_ws_message(job_id, {"event": "completed", "download_url": download_url})


def _send_failed(job_id: str, error: str) -> None:
    _send_ws_message(job_id, {"event": "failed", "error": error})


# ---------------------------------------------------------------------------
# Progress parsing
# ---------------------------------------------------------------------------

def _parse_duration_seconds(stderr_line: str) -> float | None:
    """Extracts total duration in seconds from FFmpeg's Duration line."""
    match = _DURATION_RE.search(stderr_line)
    if match:
        h, m, s = match.groups()
        return int(h) * 3600 + int(m) * 60 + float(s)
    return None


def _parse_progress_seconds(line: str) -> float | None:
    """Extracts current position in seconds from FFmpeg progress output."""
    match = _PROGRESS_RE.search(line)
    if match:
        return int(match.group(1)) / 1_000_000
    return None


# ---------------------------------------------------------------------------
# Main Celery task
# ---------------------------------------------------------------------------

@shared_task(bind=True, max_retries=0)
def export_task(self, job_id: str) -> None:
    """
    Executes the full FFmpeg export for an ExportJob.

    No automatic retries — export failures are surfaced to the user
    who can choose to retry manually. Retrying a failed export
    automatically could waste significant CPU time on bad timeline states.
    """
    try:
        job = ExportJob.objects.select_related("project", "user").get(id=job_id)
    except ExportJob.DoesNotExist:
        logger.error("export_task: ExportJob '%s' not found.", job_id)
        return

    job.mark_processing()
    logger.info("Export started: job=%s project=%s user=%s", job_id, job.project_id, job.user_id)

    media_root = settings.MEDIA_ROOT
    timeline_state = job.project.timeline_state

    if not timeline_state:
        error = "Project has no timeline state to export."
        job.mark_failed(error)
        _send_failed(job_id, error)
        return

    # --- Prepare output path ---
    export_dir = Path(media_root) / "exports" / str(job.user_id)
    export_dir.mkdir(parents=True, exist_ok=True)

    codec_cfg = {"mp4": "mp4", "webm": "webm"}
    ext = codec_cfg.get(job.format, "mp4")
    output_path = str(export_dir / f"{job_id}.{ext}")

    # --- Build FFmpeg command ---
    try:
        cmd = FFmpegCommandBuilder.build_export_command(
            timeline_state=timeline_state,
            job=job,
            output_path=output_path,
            media_root=media_root,
        )
    except (ValueError, Exception) as exc:
        error = f"Failed to build export command: {exc}"
        logger.exception("export_task: command build failed for job '%s'.", job_id)
        job.mark_failed(error)
        _send_failed(job_id, error)
        return

    # --- Execute FFmpeg ---
    total_duration: float | None = None
    last_progress = -1

    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )

        # Read stderr line by line for progress parsing
        for line in process.stderr:
            line = line.strip()

            # Extract total duration from the first few lines
            if total_duration is None:
                total_duration = _parse_duration_seconds(line)

            # Parse current position and calculate progress percentage
            current_seconds = _parse_progress_seconds(line)
            if current_seconds is not None and total_duration and total_duration > 0:
                progress = min(99, int((current_seconds / total_duration) * 100))
                if progress != last_progress:
                    job.update_progress(progress)
                    _send_progress(job_id, progress)
                    last_progress = progress

        process.wait()

        if process.returncode != 0:
            # Capture remaining stderr for error message
            stderr_output = process.stderr.read() if process.stderr else ""
            error = f"FFmpeg exited with code {process.returncode}. {stderr_output[-500:]}"
            raise subprocess.CalledProcessError(process.returncode, cmd, stderr=error)

    except subprocess.CalledProcessError as exc:
        error_msg = str(exc.stderr)[-500:] if exc.stderr else str(exc)
        logger.error("export_task: FFmpeg failed for job '%s': %s", job_id, error_msg)
        job.mark_failed(error_msg)
        _send_failed(job_id, "Export failed. Please check your timeline and try again.")
        return
    except Exception as exc:
        logger.exception("export_task: unexpected error for job '%s'.", job_id)
        job.mark_failed(str(exc))
        _send_failed(job_id, "An unexpected error occurred during export.")
        return

    # --- Success ---
    relative_path = str(Path(output_path).relative_to(Path(media_root)))
    job.mark_completed(relative_path)

    download_url = f"/media/{relative_path}"
    _send_completed(job_id, download_url)
    logger.info("Export completed: job=%s output=%s", job_id, output_path)
