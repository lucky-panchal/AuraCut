"""
apps/projects/models.py

Project is the top-level workspace for a user's edit session.
Timeline state is stored as a single JSONField — avoids over-normalizing
a deeply nested, frequently mutated structure.
"""

import logging

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone

from core.models import BaseModel

logger = logging.getLogger("auracut")


class Project(BaseModel):
    """
    Represents a single video editing project owned by a user.

    Fields:
        owner          — the user who created and owns this project
        name           — human-readable project title
        is_deleted     — soft delete flag (never hard-delete projects)
        deleted_at     — timestamp of soft deletion
        timeline_state — full NLE timeline serialized as JSON
        thumbnail      — optional project thumbnail image
    """

    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="projects",
    )
    name = models.CharField(max_length=255)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    # Stores the full TimelineState JSON structure defined in design.md.
    # Null until the user makes their first edit.
    timeline_state = models.JSONField(null=True, blank=True)

    thumbnail = models.ImageField(
        upload_to="thumbnails/projects/",
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "Project"
        verbose_name_plural = "Projects"
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return f"Project({self.name}, owner={self.owner.username})"

    def soft_delete(self) -> None:
        """Marks the project as deleted without removing the DB record."""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=["is_deleted", "deleted_at", "updated_at"])
        logger.info("Project '%s' soft-deleted.", self.id)
