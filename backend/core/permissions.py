"""
core/permissions.py

Custom DRF permission classes for Auracut.
Applied at the view level to enforce object ownership.
"""

import logging

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

logger = logging.getLogger("auracut")


class IsOwner(BasePermission):
    """
    Grants access only if the requesting user owns the object.

    Supports two ownership patterns used across Auracut models:
        1. Direct ownership  — obj.owner == request.user
           Used by: Project
        2. Nested ownership  — obj.project.owner == request.user
           Used by: MediaAsset, ExportJob

    Returns 403 Forbidden (not 404) on ownership mismatch so the
    client knows the resource exists but is not accessible.
    """

    message = "You do not have permission to access this resource."

    def has_permission(self, request: Request, view: APIView) -> bool:
        # Object-level check handles the real enforcement.
        # View-level just requires authentication (handled by DEFAULT_PERMISSION_CLASSES).
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request: Request, view: APIView, obj: object) -> bool:
        # Pattern 1: direct owner field
        if hasattr(obj, "owner"):
            return obj.owner == request.user

        # Pattern 2: ownership via related project
        if hasattr(obj, "project"):
            return obj.project.owner == request.user

        # Pattern 3: ownership via direct user field (e.g. ExportJob.user)
        if hasattr(obj, "user"):
            return obj.user == request.user

        logger.warning(
            "IsOwner: object %s has no recognisable ownership field — denying access.",
            type(obj).__name__,
        )
        return False
