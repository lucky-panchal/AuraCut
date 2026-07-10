"""
core/validators.py

File validation utilities for Auracut asset uploads.
All validation happens server-side before any file I/O is committed.

Validators:
    MIMEValidator     — checks actual file magic bytes, not just extension
    FileSizeValidator — checks against MAX_UPLOAD_SIZE setting
"""

import logging
from typing import Set

import magic
from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from rest_framework.exceptions import ValidationError

logger = logging.getLogger("auracut")

# Consolidated set of all permitted MIME types across all asset categories
_ALL_ALLOWED_MIMES: Set[str] = (
    settings.ALLOWED_VIDEO_MIMES
    | settings.ALLOWED_AUDIO_MIMES
    | settings.ALLOWED_IMAGE_MIMES
)


class MIMEValidator:
    """
    Validates uploaded file MIME type against an allowlist.

    Reads the first 2048 bytes of the file to detect the real MIME type
    via libmagic — prevents spoofed extensions (e.g. .exe renamed to .mp4).

    Usage:
        validator = MIMEValidator(allowed_mimes=settings.ALLOWED_VIDEO_MIMES)
        validator(uploaded_file)  # raises ValidationError if invalid
    """

    def __init__(self, allowed_mimes: Set[str] | None = None) -> None:
        # Default to all allowed types if no specific set provided
        self.allowed_mimes = allowed_mimes or _ALL_ALLOWED_MIMES

    def __call__(self, file: UploadedFile) -> None:
        detected_mime = self._detect_mime(file)

        if detected_mime not in self.allowed_mimes:
            logger.warning(
                "MIMEValidator: rejected file '%s' with detected MIME '%s'. Allowed: %s",
                file.name,
                detected_mime,
                self.allowed_mimes,
            )
            raise ValidationError(
                f"Unsupported file type '{detected_mime}'. "
                f"Allowed types: {', '.join(sorted(self.allowed_mimes))}."
            )

    def _detect_mime(self, file: UploadedFile) -> str:
        """Read magic bytes from the file header to detect real MIME type."""
        # Save and restore position — file may be read again after validation
        original_position = file.tell()
        try:
            header = file.read(2048)
            return magic.from_buffer(header, mime=True)
        finally:
            file.seek(original_position)


class FileSizeValidator:
    """
    Validates uploaded file does not exceed the configured size limit.

    Reads limit from settings.MAX_UPLOAD_SIZE (bytes).
    Checked before file is written to disk.

    Usage:
        validator = FileSizeValidator()
        validator(uploaded_file)  # raises ValidationError if too large
    """

    def __init__(self, max_size: int | None = None) -> None:
        self.max_size = max_size or settings.MAX_UPLOAD_SIZE

    def __call__(self, file: UploadedFile) -> None:
        if file.size > self.max_size:
            limit_mb = self.max_size / (1024 * 1024)
            actual_mb = file.size / (1024 * 1024)
            logger.warning(
                "FileSizeValidator: rejected file '%s' — size %.1fMB exceeds limit %.1fMB.",
                file.name,
                actual_mb,
                limit_mb,
            )
            raise ValidationError(
                f"File size {actual_mb:.1f}MB exceeds the maximum allowed size of {limit_mb:.1f}MB."
            )


def validate_asset_file(file: UploadedFile) -> str:
    """
    Convenience function that runs both validators and returns the detected
    asset category ('video', 'audio', 'image') for the caller to store.

    Raises ValidationError if file is invalid.
    Returns asset_type string if valid.
    """
    FileSizeValidator()(file)

    detected_mime = MIMEValidator._detect_mime(MIMEValidator(), file)

    if detected_mime in settings.ALLOWED_VIDEO_MIMES:
        return "video"
    if detected_mime in settings.ALLOWED_AUDIO_MIMES:
        return "audio"
    if detected_mime in settings.ALLOWED_IMAGE_MIMES:
        return "image"

    raise ValidationError(
        f"Unsupported file type '{detected_mime}'."
    )
