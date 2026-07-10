"""
apps/assets/services.py

AssetService handles all business logic for media asset management.
Keeps views thin and processing logic testable in isolation.
"""

import logging
import os
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import UploadedFile

from core.validators import validate_asset_file
from apps.projects.models import Project
from .models import MediaAsset
from .tasks import process_asset_task

logger = logging.getLogger("auracut")


class AssetService:
    """
    Handles upload, retrieval, and deletion of media assets.

    Upload flow:
        1. Validate MIME type and file size (raises ValidationError if invalid)
        2. Save file to MEDIA_ROOT/uploads/<project_id>/<filename>
        3. Create MediaAsset DB record (status=uploading)
        4. Queue process_asset_task for async processing
        5. Return the asset record immediately (202 pattern)

    Delete flow:
        1. Remove original file, proxy, and thumbnail from filesystem
        2. Delete DB record (hard delete — asset is gone)
    """

    @staticmethod
    def upload_asset(project: Project, file: UploadedFile) -> MediaAsset:
        """
        Validates, saves, and queues processing for an uploaded file.
        Returns the created MediaAsset with status=uploading.
        Raises ValidationError if file is invalid.
        """
        # Validate MIME type and size — raises ValidationError on failure
        asset_type = validate_asset_file(file)

        # Build destination path: uploads/<project_id>/<original_filename>
        upload_dir = Path(settings.MEDIA_ROOT) / "uploads" / str(project.id)
        upload_dir.mkdir(parents=True, exist_ok=True)

        # Sanitise filename to prevent path traversal
        safe_filename = Path(file.name).name
        dest_path = upload_dir / safe_filename

        # Handle filename collisions by appending asset UUID later
        # For now write the file — UUID is assigned after DB record creation
        file_path_relative = AssetService._save_file(file, dest_path)

        # Create DB record
        asset = MediaAsset.objects.create(
            project=project,
            filename=safe_filename,
            asset_type=asset_type,
            file_path=file_path_relative,
            file_size=file.size,
            status=MediaAsset.Status.UPLOADING,
        )

        # Rename file to include UUID — prevents collisions across uploads
        final_dest = upload_dir / f"{asset.id}_{safe_filename}"
        final_relative = str(final_dest.relative_to(Path(settings.MEDIA_ROOT)))
        os.rename(dest_path, final_dest)
        asset.file_path = final_relative
        asset.save(update_fields=["file_path", "updated_at"])

        # Queue async processing
        process_asset_task.delay(str(asset.id))
        logger.info(
            "Asset uploaded: id=%s filename='%s' project=%s type=%s.",
            asset.id, safe_filename, project.id, asset_type,
        )
        return asset

    @staticmethod
    def get_project_assets(project: Project):
        """Returns all assets for a project ordered by creation date."""
        return MediaAsset.objects.filter(project=project)

    @staticmethod
    def get_asset(project: Project, asset_id: str) -> MediaAsset | None:
        """Returns a single asset belonging to the project, or None."""
        return MediaAsset.objects.filter(id=asset_id, project=project).first()

    @staticmethod
    def delete_asset(project: Project, asset_id: str) -> bool:
        """
        Deletes an asset and all its associated files from the filesystem.
        Returns True if deleted, False if asset not found.
        """
        asset = AssetService.get_asset(project, asset_id)
        if asset is None:
            return False

        media_root = Path(settings.MEDIA_ROOT)

        # Remove all associated files — log warnings but don't fail on missing files
        for path_field in (asset.file_path, asset.proxy_path, asset.thumbnail_path):
            if path_field:
                full_path = media_root / path_field
                try:
                    full_path.unlink(missing_ok=True)
                except OSError as exc:
                    logger.warning("Could not delete file '%s': %s", full_path, exc)

        asset.delete()
        logger.info("Asset deleted: id=%s filename='%s'.", asset_id, asset.filename)
        return True

    @staticmethod
    def _save_file(file: UploadedFile, dest_path: Path) -> str:
        """
        Writes uploaded file to dest_path in chunks.
        Returns path relative to MEDIA_ROOT as a string.
        """
        with open(dest_path, "wb") as f:
            for chunk in file.chunks():
                f.write(chunk)
        return str(dest_path.relative_to(Path(settings.MEDIA_ROOT)))
