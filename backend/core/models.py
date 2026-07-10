"""
core/models.py

Abstract base model inherited by every model in Auracut.
Provides UUID primary key and automatic timestamps.
"""

import uuid

from django.db import models


class BaseModel(models.Model):
    """
    Abstract base for all Auracut models.

    Fields:
        id          — UUID primary key (not sequential, safe for public APIs)
        created_at  — set once on creation, never updated
        updated_at  — updated on every save
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
