"""
apps/assets/tasks.py

Celery task that runs after a file is uploaded.
Responsibilities:
    1. Extract metadata via ffprobe
    2. Generate a low-res proxy file via ffmpeg (video only)
    3. Extract a thumbnail frame via ffmpeg (video/image)
    4. Update MediaAsset record with results
    5. Notify the project's WebSocket group that the asset is ready
"""

import json
import logging
import os
import subprocess
from pathlib import Path

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.conf import settings

from .models import MediaAsset

logger = logging.getLogger("auracut")


# ---------------------------------------------------------------------------
# FFprobe helpers
# ---------------------------------------------------------------------------

def _run_ffprobe(file_path: str) -> dict:
    """
    Runs ffprobe on the given file and returns parsed JSON metadata.
    Raises RuntimeError if ffprobe fails.
    """
    cmd = [
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_streams",
        "-show_format",
        file_path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            raise RuntimeError(f"ffprobe error: {result.stderr}")
        return json.loads(result.stdout)
    except FileNotFoundError:
        raise RuntimeError("ffprobe not found. Ensure FFmpeg is installed.")
    except subprocess.TimeoutExpired:
        raise RuntimeError("ffprobe timed out.")


def _extract_video_metadata(probe_data: dict) -> dict:
    """Parses ffprobe output and returns a clean metadata dict."""
    metadata = {
        "duration": None,
        "resolution": "",
        "fps": None,
        "codec": "",
    }

    streams = probe_data.get("streams", [])
    fmt = probe_data.get("format", {})

    # Duration from format section (most reliable)
    if "duration" in fmt:
        metadata["duration"] = float(fmt["duration"])

    for stream in streams:
        codec_type = stream.get("codec_type")

        if codec_type == "video":
            metadata["codec"] = stream.get("codec_name", "")
            width = stream.get("width")
            height = stream.get("height")
            if width and height:
                metadata["resolution"] = f"{width}x{height}"

            # FPS stored as fraction string e.g. "30000/1001"
            r_frame_rate = stream.get("r_frame_rate", "")
            if "/" in r_frame_rate:
                num, den = r_frame_rate.split("/")
                if int(den) > 0:
                    metadata["fps"] = round(int(num) / int(den), 3)

        elif codec_type == "audio" and not metadata["codec"]:
            metadata["codec"] = stream.get("codec_name", "")

    return metadata


def _extract_audio_metadata(probe_data: dict) -> dict:
    """Parses ffprobe output for audio files."""
    fmt = probe_data.get("format", {})
    streams = probe_data.get("streams", [])
    codec = ""
    for stream in streams:
        if stream.get("codec_type") == "audio":
            codec = stream.get("codec_name", "")
            break
    return {
        "duration": float(fmt["duration"]) if "duration" in fmt else None,
        "resolution": "",
        "fps": None,
        "codec": codec,
    }


# ---------------------------------------------------------------------------
# FFmpeg helpers
# ---------------------------------------------------------------------------

def _generate_proxy(input_path: str, output_path: str) -> None:
    """
    Generates a 480p low-bitrate proxy video for timeline preview.
    Raises RuntimeError on failure.
    """
    cmd = [
        "ffmpeg",
        "-i", input_path,
        "-vf", "scale=-2:480",
        "-c:v", "libx264",
        "-crf", "28",
        "-preset", "fast",
        "-c:a", "aac",
        "-b:a", "96k",
        "-movflags", "+faststart",
        "-y",
        output_path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg proxy error: {result.stderr[-500:]}")
    except FileNotFoundError:
        raise RuntimeError("ffmpeg not found. Ensure FFmpeg is installed.")
    except subprocess.TimeoutExpired:
        raise RuntimeError("ffmpeg proxy generation timed out.")


def _extract_thumbnail(input_path: str, output_path: str, asset_type: str) -> None:
    """
    Extracts a thumbnail:
    - Video: frame at 1 second mark
    - Image: resizes to max 320px wide JPEG
    Raises RuntimeError on failure.
    """
    if asset_type == MediaAsset.AssetType.VIDEO:
        cmd = [
            "ffmpeg",
            "-ss", "00:00:01",
            "-i", input_path,
            "-frames:v", "1",
            "-vf", "scale=-2:180",
            "-y",
            output_path,
        ]
    else:
        # Image thumbnail
        cmd = [
            "ffmpeg",
            "-i", input_path,
            "-vf", "scale=320:-2",
            "-y",
            output_path,
        ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg thumbnail error: {result.stderr[-500:]}")
    except FileNotFoundError:
        raise RuntimeError("ffmpeg not found.")
    except subprocess.TimeoutExpired:
        raise RuntimeError("ffmpeg thumbnail extraction timed out.")


# ---------------------------------------------------------------------------
# WebSocket notification helper
# ---------------------------------------------------------------------------

def _notify_asset_ready(project_id: str, asset_data: dict) -> None:
    """Sends asset_ready event to the project's WebSocket channel group."""
    channel_layer = get_channel_layer()
    if channel_layer is None:
        logger.warning("Channel layer not available — skipping WebSocket notification.")
        return

    async_to_sync(channel_layer.group_send)(
        f"project_{project_id}",
        {
            "type": "asset.ready",
            "asset": asset_data,
        },
    )


# ---------------------------------------------------------------------------
# Main Celery task
# ---------------------------------------------------------------------------

@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=10,
    autoretry_for=(OSError,),
)
def process_asset_task(self, asset_id: str) -> None:
    """
    Processes a newly uploaded MediaAsset.

    Steps:
        1. Mark asset as processing
        2. Extract metadata via ffprobe
        3. Generate proxy (video only)
        4. Extract thumbnail (video + image)
        5. Mark asset as ready and notify client
    """
    try:
        asset = MediaAsset.objects.select_related("project").get(id=asset_id)
    except MediaAsset.DoesNotExist:
        logger.error("process_asset_task: asset %s not found.", asset_id)
        return

    asset.mark_processing()
    logger.info("Processing asset '%s' (%s).", asset.filename, asset.asset_type)

    media_root = Path(settings.MEDIA_ROOT)
    input_path = str(media_root / asset.file_path)

    proxy_path = ""
    thumbnail_path = ""
    metadata = {"duration": None, "resolution": "", "fps": None, "codec": ""}

    try:
        # --- Step 1: Extract metadata ---
        if asset.asset_type in (MediaAsset.AssetType.VIDEO, MediaAsset.AssetType.AUDIO):
            probe_data = _run_ffprobe(input_path)
            if asset.asset_type == MediaAsset.AssetType.VIDEO:
                metadata = _extract_video_metadata(probe_data)
            else:
                metadata = _extract_audio_metadata(probe_data)

        # --- Step 2: Generate proxy (video only) ---
        if asset.asset_type == MediaAsset.AssetType.VIDEO:
            proxy_dir = media_root / "proxies" / str(asset.project_id)
            proxy_dir.mkdir(parents=True, exist_ok=True)
            proxy_file = proxy_dir / f"{asset.id}_proxy.mp4"
            _generate_proxy(input_path, str(proxy_file))
            proxy_path = str(proxy_file.relative_to(media_root))
            logger.debug("Proxy generated: %s", proxy_path)

        # --- Step 3: Extract thumbnail (video + image) ---
        if asset.asset_type in (MediaAsset.AssetType.VIDEO, MediaAsset.AssetType.IMAGE):
            thumb_dir = media_root / "thumbnails" / "assets" / str(asset.project_id)
            thumb_dir.mkdir(parents=True, exist_ok=True)
            thumb_file = thumb_dir / f"{asset.id}_thumb.jpg"
            _extract_thumbnail(input_path, str(thumb_file), asset.asset_type)
            thumbnail_path = str(thumb_file.relative_to(media_root))
            logger.debug("Thumbnail generated: %s", thumbnail_path)

        # --- Step 4: Mark ready and persist ---
        asset.mark_ready(
            proxy_path=proxy_path,
            thumbnail_path=thumbnail_path,
            duration=metadata["duration"],
            resolution=metadata["resolution"],
            fps=metadata["fps"],
            codec=metadata["codec"],
        )

        # --- Step 5: Notify client via WebSocket ---
        from apps.assets.serializers import MediaAssetSerializer
        asset_data = MediaAssetSerializer(asset).data
        # Convert UUID to string for JSON serialisation
        asset_data["id"] = str(asset_data["id"])
        _notify_asset_ready(str(asset.project_id), asset_data)

    except Exception as exc:
        logger.exception("Asset processing failed for '%s': %s", asset_id, exc)
        asset.mark_error(str(exc))
        # Do not retry on processing errors — bad files won't fix themselves
