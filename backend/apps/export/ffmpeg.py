"""
apps/export/ffmpeg.py

FFmpegCommandBuilder constructs FFmpeg CLI commands from a timeline state.

Two command types:
    build_export_command  — full multi-track render for final export
    build_preview_command — single frame/short segment for preview

Design notes:
    - All methods are static — no state, pure functions of their inputs
    - FFmpeg availability is checked at import time via _check_ffmpeg()
    - filter_complex is built programmatically from the timeline JSON
    - Progress is parsed from FFmpeg stderr "out_time_ms=" lines

FFmpeg filter_complex structure for a typical export:
    [0:v]trim,setpts → [v0]
    [1:v]trim,setpts → [v1]
    [v0][v1]concat   → [vout]
    [vout]drawtext   → [vout_text]
    [0:a]atrim,asetpts → [a0]
    [a0]aconcat      → [aout]
"""

import logging
import shutil
import subprocess
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

logger = logging.getLogger("auracut")

# ---------------------------------------------------------------------------
# Bitrate maps
# ---------------------------------------------------------------------------

_VIDEO_BITRATE_MAP = {
    "low":    {"480p": "800k",  "720p": "1500k", "1080p": "3000k"},
    "medium": {"480p": "1500k", "720p": "3000k", "1080p": "6000k"},
    "high":   {"480p": "2500k", "720p": "5000k", "1080p": "10000k"},
}

_RESOLUTION_MAP = {
    "480p":  (854,  480),
    "720p":  (1280, 720),
    "1080p": (1920, 1080),
}

_FORMAT_CODEC_MAP = {
    "mp4":  {"vcodec": "libx264",  "acodec": "aac",       "ext": "mp4"},
    "webm": {"vcodec": "libvpx-vp9", "acodec": "libopus", "ext": "webm"},
}


# ---------------------------------------------------------------------------
# FFmpeg availability check
# ---------------------------------------------------------------------------

def _check_ffmpeg() -> None:
    """
    Verifies FFmpeg and FFprobe are available on PATH.
    Called at module import — fails fast at startup, not at runtime.
    Raises ImproperlyConfigured if not found.
    """
    for binary in ("ffmpeg", "ffprobe"):
        if shutil.which(binary) is None:
            raise ImproperlyConfigured(
                f"'{binary}' not found on PATH. "
                "Install FFmpeg and ensure it is accessible from the system PATH. "
                "In Docker, add 'ffmpeg' to the Dockerfile apt-get install list."
            )


_check_ffmpeg()


# ---------------------------------------------------------------------------
# FFmpegCommandBuilder
# ---------------------------------------------------------------------------

class FFmpegCommandBuilder:
    """
    Builds FFmpeg CLI commands from Auracut timeline state JSON.

    Timeline state structure (from design.md):
    {
        "tracks": [
            {
                "id": "...",
                "type": "video" | "audio" | "subtitle",
                "clips": [
                    {
                        "id": "...",
                        "asset_id": "...",
                        "timeline_start": 0.0,
                        "timeline_end": 10.0,
                        "source_in": 0.0,
                        "source_out": 10.0,
                        "effects": [...],
                        "transition_in": null,
                        "transition_out": null
                    }
                ]
            }
        ]
    }
    """

    @staticmethod
    def build_export_command(
        timeline_state: dict,
        job: Any,
        output_path: str,
        media_root: str,
    ) -> list[str]:
        """
        Builds the full FFmpeg command for a final export.

        Args:
            timeline_state: Project.timeline_state JSON dict
            job:            ExportJob instance with resolution/format/bitrate/fps settings
            output_path:    Absolute path for the output file
            media_root:     Absolute path to MEDIA_ROOT

        Returns:
            List of strings forming the complete FFmpeg command.
        """
        tracks = timeline_state.get("tracks", [])
        video_tracks = [t for t in tracks if t["type"] == "video"]
        audio_tracks = [t for t in tracks if t["type"] == "audio"]
        subtitle_tracks = [t for t in tracks if t["type"] == "subtitle"]

        codec_cfg = _FORMAT_CODEC_MAP[job.format]
        width, height = _RESOLUTION_MAP[job.resolution]
        vbitrate = _VIDEO_BITRATE_MAP[job.bitrate][job.resolution]

        cmd = ["ffmpeg", "-y"]
        filter_parts = []
        input_index = 0
        input_map: dict[str, int] = {}  # asset_id → ffmpeg input index

        # --- Collect all unique asset file paths as inputs ---
        all_clips = [
            clip
            for track in (video_tracks + audio_tracks)
            for clip in track.get("clips", [])
        ]

        for clip in all_clips:
            asset_id = clip["asset_id"]
            if asset_id not in input_map:
                file_path = FFmpegCommandBuilder._resolve_asset_path(
                    asset_id, media_root
                )
                if file_path:
                    cmd += ["-i", file_path]
                    input_map[asset_id] = input_index
                    input_index += 1

        if not input_map:
            raise ValueError("Timeline has no valid media assets to export.")

        # --- Build video filter_complex ---
        video_segments = []
        for track_idx, track in enumerate(video_tracks):
            for clip in track.get("clips", []):
                asset_id = clip["asset_id"]
                if asset_id not in input_map:
                    continue
                idx = input_map[asset_id]
                seg_label = f"[v{track_idx}_{clip['id'][:8]}]"

                trim_filter = (
                    f"[{idx}:v]"
                    f"trim=start={clip['source_in']}:end={clip['source_out']},"
                    f"setpts=PTS-STARTPTS,"
                    f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
                    f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2"
                )

                # Apply color filters if present
                color_filter = FFmpegCommandBuilder._build_color_filter(clip)
                if color_filter:
                    trim_filter += f",{color_filter}"

                trim_filter += seg_label
                filter_parts.append(trim_filter)
                video_segments.append(seg_label)

        # Concatenate all video segments
        if video_segments:
            concat_input = "".join(video_segments)
            filter_parts.append(
                f"{concat_input}concat=n={len(video_segments)}:v=1:a=0[vconcat]"
            )
            current_video = "[vconcat]"
        else:
            # No video — generate black frames for the duration
            duration = timeline_state.get("duration", 10)
            filter_parts.append(
                f"color=black:size={width}x{height}:duration={duration}:rate={job.fps}[vconcat]"
            )
            current_video = "[vconcat]"

        # Apply text overlays
        text_video = FFmpegCommandBuilder._build_text_overlays(
            video_tracks, current_video, filter_parts
        )

        # --- Build audio filter_complex ---
        audio_segments = []
        for track_idx, track in enumerate(audio_tracks):
            for clip in track.get("clips", []):
                asset_id = clip["asset_id"]
                if asset_id not in input_map:
                    continue
                idx = input_map[asset_id]
                seg_label = f"[a{track_idx}_{clip['id'][:8]}]"
                filter_parts.append(
                    f"[{idx}:a]"
                    f"atrim=start={clip['source_in']}:end={clip['source_out']},"
                    f"asetpts=PTS-STARTPTS"
                    f"{seg_label}"
                )
                audio_segments.append(seg_label)

        if audio_segments:
            concat_input = "".join(audio_segments)
            filter_parts.append(
                f"{concat_input}concat=n={len(audio_segments)}:v=0:a=1[aout]"
            )
            audio_map = "[aout]"
        else:
            audio_map = None

        # --- Assemble final command ---
        cmd += ["-filter_complex", ";".join(filter_parts)]
        cmd += ["-map", text_video]

        if audio_map:
            cmd += ["-map", audio_map]

        cmd += [
            "-c:v", codec_cfg["vcodec"],
            "-b:v", vbitrate,
            "-r", str(job.fps),
            "-c:a", codec_cfg["acodec"],
            "-b:a", "192k",
        ]

        if job.format == "mp4":
            cmd += ["-movflags", "+faststart"]

        # Subtitle burn-in
        if job.subtitle_burn_in and subtitle_tracks:
            srt_path = FFmpegCommandBuilder._write_subtitle_file(
                subtitle_tracks, output_path
            )
            if srt_path:
                cmd += ["-vf", f"subtitles={srt_path}"]

        # Progress reporting via stderr
        cmd += ["-progress", "pipe:2", "-nostats"]
        cmd.append(output_path)

        logger.debug("FFmpeg export command: %s", " ".join(cmd))
        return cmd

    @staticmethod
    def build_preview_command(
        segment: dict,
        effects: list[dict],
        output_path: str,
        media_root: str,
    ) -> list[str]:
        """
        Builds an FFmpeg command to render a single preview frame or short segment.

        Args:
            segment:     {asset_id, source_in, source_out, timeline_start}
            effects:     list of Effect dicts to apply
            output_path: path for the output JPEG or short MP4
            media_root:  absolute path to MEDIA_ROOT

        Returns:
            FFmpeg command as list of strings.
        """
        asset_id = segment.get("asset_id", "")
        source_in = segment.get("source_in", 0)

        file_path = FFmpegCommandBuilder._resolve_asset_path(asset_id, media_root)
        if not file_path:
            raise ValueError(f"Asset '{asset_id}' file not found for preview.")

        cmd = [
            "ffmpeg", "-y",
            "-ss", str(source_in),
            "-i", file_path,
            "-frames:v", "1",
            "-vf", "scale=1280:720:force_original_aspect_ratio=decrease",
            "-q:v", "3",
            output_path,
        ]
        return cmd

    # -----------------------------------------------------------------------
    # Private helpers
    # -----------------------------------------------------------------------

    @staticmethod
    def _resolve_asset_path(asset_id: str, media_root: str) -> str | None:
        """Looks up the file_path for an asset from the DB."""
        try:
            from apps.assets.models import MediaAsset
            asset = MediaAsset.objects.filter(
                id=asset_id,
                status=MediaAsset.Status.READY,
            ).only("file_path").first()
            if asset:
                return str(Path(media_root) / asset.file_path)
        except Exception as exc:
            logger.warning("Could not resolve asset path for '%s': %s", asset_id, exc)
        return None

    @staticmethod
    def _build_color_filter(clip: dict) -> str:
        """Builds eq= filter string from color_filter effect if present."""
        for effect in clip.get("effects", []):
            if effect.get("type") == "color_filter":
                params = effect.get("params", {})
                brightness = params.get("brightness", 0)
                contrast = params.get("contrast", 1)
                saturation = params.get("saturation", 1)
                return f"eq=brightness={brightness}:contrast={contrast}:saturation={saturation}"
        return ""

    @staticmethod
    def _build_text_overlays(
        video_tracks: list,
        current_video: str,
        filter_parts: list,
    ) -> str:
        """
        Appends drawtext filters for all text overlay effects.
        Returns the label of the final video stream.
        """
        overlay_index = 0
        for track in video_tracks:
            for clip in track.get("clips", []):
                for effect in clip.get("effects", []):
                    if effect.get("type") != "text":
                        continue
                    params = effect.get("params", {})
                    text = params.get("content", "").replace("'", "\\'").replace(":", "\\:")
                    font_size = params.get("size", 24)
                    color = params.get("color", "white")
                    x = params.get("x", "(w-text_w)/2")
                    y = params.get("y", "(h-text_h)/2")
                    start = clip.get("timeline_start", 0)
                    end = clip.get("timeline_end", 0)
                    out_label = f"[vtxt{overlay_index}]"
                    filter_parts.append(
                        f"{current_video}drawtext="
                        f"text='{text}':"
                        f"fontsize={font_size}:"
                        f"fontcolor={color}:"
                        f"x={x}:y={y}:"
                        f"enable='between(t,{start},{end})'"
                        f"{out_label}"
                    )
                    current_video = out_label
                    overlay_index += 1
        return current_video

    @staticmethod
    def _write_subtitle_file(subtitle_tracks: list, output_path: str) -> str | None:
        """
        Writes subtitle entries from the timeline to a temporary SRT file.
        Returns the SRT file path, or None if no subtitles found.
        """
        entries = []
        index = 1
        for track in subtitle_tracks:
            for clip in track.get("clips", []):
                for effect in clip.get("effects", []):
                    if effect.get("type") != "subtitle":
                        continue
                    params = effect.get("params", {})
                    start = FFmpegCommandBuilder._seconds_to_srt(clip.get("timeline_start", 0))
                    end = FFmpegCommandBuilder._seconds_to_srt(clip.get("timeline_end", 0))
                    text = params.get("text", "")
                    entries.append(f"{index}\n{start} --> {end}\n{text}\n")
                    index += 1

        if not entries:
            return None

        srt_path = output_path.replace(Path(output_path).suffix, ".srt")
        with open(srt_path, "w", encoding="utf-8") as f:
            f.write("\n".join(entries))
        return srt_path

    @staticmethod
    def _seconds_to_srt(seconds: float) -> str:
        """Converts float seconds to SRT timestamp format HH:MM:SS,mmm."""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"
