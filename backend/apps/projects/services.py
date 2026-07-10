"""
apps/projects/services.py

ProjectService encapsulates all business logic for project management.
Views stay thin — they delegate everything here.
All methods enforce ownership by always filtering on owner=user.
"""

import logging
from typing import Optional

from django.contrib.auth.models import User
from django.db.models import QuerySet

from .models import Project

logger = logging.getLogger("auracut")


class ProjectService:
    """
    Handles all project-related business operations.

    Every method that touches a project takes the requesting user
    as a parameter and filters by owner — no view can accidentally
    access another user's project by passing a bare ID.
    """

    @staticmethod
    def create_project(user: User, name: str) -> Project:
        """Creates a new project owned by the given user."""
        project = Project.objects.create(owner=user, name=name.strip())
        logger.info("Project created: id=%s name='%s' owner='%s'.", project.id, project.name, user.username)
        return project

    @staticmethod
    def get_user_projects(user: User) -> QuerySet:
        """
        Returns all active (non-deleted) projects for the user.
        Ordered by -updated_at via model Meta.
        """
        return Project.objects.filter(owner=user, is_deleted=False)

    @staticmethod
    def get_project(user: User, project_id: str) -> Optional[Project]:
        """
        Returns a single active project owned by the user, or None.
        Never raises — callers handle the None case.
        """
        return Project.objects.filter(
            id=project_id,
            owner=user,
            is_deleted=False,
        ).first()

    @staticmethod
    def update_project(user: User, project_id: str, name: str) -> Optional[Project]:
        """
        Renames a project. Returns updated project or None if not found.
        Only touches the name and updated_at columns.
        """
        project = ProjectService.get_project(user, project_id)
        if project is None:
            return None

        project.name = name.strip()
        project.save(update_fields=["name", "updated_at"])
        logger.info("Project renamed: id=%s new_name='%s'.", project.id, project.name)
        return project

    @staticmethod
    def soft_delete_project(user: User, project_id: str) -> bool:
        """
        Soft-deletes a project owned by the user.
        Returns True if deleted, False if project not found.
        Media file cleanup is handled by the assets app.
        """
        project = ProjectService.get_project(user, project_id)
        if project is None:
            return False

        project.soft_delete()
        return True

    @staticmethod
    def save_timeline_state(user: User, project_id: str, timeline_state: dict) -> Optional[Project]:
        """
        Persists the full timeline JSON state for a project.
        Called by the auto-save debounce and manual Ctrl+S.
        Returns updated project or None if not found.
        """
        project = ProjectService.get_project(user, project_id)
        if project is None:
            return None

        project.timeline_state = timeline_state
        project.save(update_fields=["timeline_state", "updated_at"])
        logger.debug("Timeline saved for project id=%s.", project.id)
        return project

    @staticmethod
    def get_timeline_state(user: User, project_id: str) -> Optional[dict]:
        """
        Returns the raw timeline JSON for a project, or None if not found.
        Returns empty dict if project exists but has no timeline yet.
        """
        project = ProjectService.get_project(user, project_id)
        if project is None:
            return None

        return project.timeline_state or {}
