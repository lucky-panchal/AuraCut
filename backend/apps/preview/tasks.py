"""
apps/preview/tasks.py

Celery task that renders a single preview frame using FFmpeg.
Called by PreviewConsumer when the client requests a server-side preview.

The rendered frame is sent back to the specific consumer channel
(not a group) so only the requesting client receives it.
"""

import base64
import logging
import subprocess
import tempfile
from pathlib import Path

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.conf import settings

from apps.export.ffmpeg import FFmpegCommandBuilder

logger = logging.getLogger("auracut")


@shared_task(bind=True, max_retries=2, default_retry_delay=2)
def preview_render_task(
    self,
    channel_name: str,
    segment: dict,
    effects: list,
) -> None:
    """
    Renders a single preview frame for a timeline segment.

    Args:
        channel_name: The specific consumer channel to send the result to.
                      Uses channel_layer.send (not group_send) — only the
                      requesting client receives the frame.
        segment:      {asset_id, source_in, source_out, timeline_start}
        effects:      List of Effect dicts to apply to the frame
    """
    channel_layer = get_channel_layer()
    if channel_layer is None:
        logger.warning("preview_render_task: channel layer unavailable.")
        return

    media_root = settings.MEDIA_ROOT

    try:
        # Write output to a temp file — cleaned up automatically
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            output_path = tmp.name

        cmd = FFmpegCommandBuilder.build_preview_command(
            segment=segment,
            effects=effects,
            output_path=output_path,
            media_root=media_root,
        )

        result = subprocess.run(cmd, capture_output=True, timeout=30)

        if result.returncode != 0:
            logger.warning(
                "preview_render_task: FFmpeg failed — %s",
                result.stderr[-300:].decode(errors="replace"),
            )
            async_to_sync(channel_layer.send)(
                channel_name,
                {"type": "preview.error", "message": "Preview render failed."},
            )
            return

        # Read rendered frame and encode as base64 for WebSocket transport
        frame_bytes = Path(output_path).read_bytes()
        frame_b64 = base64.b64encode(frame_bytes).decode("utf-8")

        async_to_sync(channel_layer.send)(
            channel_name,
            {
                "type": "preview.frame",
                "data": frame_b64,
                "mime": "image/jpeg",
            },
        )
        logger.debug("preview_render_task: frame sent to channel '%s'.", channel_name)

    except subprocess.TimeoutExpired:
        logger.warning("preview_render_task: FFmpeg timed out for channel '%s'.", channel_name)
        async_to_sync(channel_layer.send)(
            channel_name,
            {"type": "preview.error", "message": "Preview timed out."},
        )
    except Exception as exc:
        logger.exception("preview_render_task: unexpected error — %s", exc)
        async_to_sync(channel_layer.send)(
            channel_name,
            {"type": "preview.error", "message": "Preview unavailable."},
        )
    finally:
        # Clean up temp file
        try:
            Path(output_path).unlink(missing_ok=True)
        except Exception:
            pass
