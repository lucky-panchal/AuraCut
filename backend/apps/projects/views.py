"""
apps/projects/views.py

Project CRUD and timeline state endpoints.
All views delegate business logic to ProjectService.
"""

import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsOwner
from .models import Project
from .serializers import ProjectSerializer, ProjectUpdateSerializer, TimelineStateSerializer
from .services import ProjectService

logger = logging.getLogger("auracut")


class ProjectListCreateView(APIView):
    """
    GET  /api/projects/  — list all projects for the authenticated user
    POST /api/projects/  — create a new project
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        projects = ProjectService.get_user_projects(request.user)
        serializer = ProjectSerializer(projects, many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request: Request) -> Response:
        serializer = ProjectSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        project = ProjectService.create_project(
            user=request.user,
            name=serializer.validated_data["name"],
        )
        return Response(
            ProjectSerializer(project, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ProjectDetailView(APIView):
    """
    GET    /api/projects/<id>/  — retrieve a project
    PATCH  /api/projects/<id>/  — rename a project
    DELETE /api/projects/<id>/  — soft-delete a project
    """

    permission_classes = [IsAuthenticated, IsOwner]

    def _get_project_or_404(self, request: Request, project_id: str) -> Project | Response:
        project = ProjectService.get_project(request.user, project_id)
        if project is None:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return project

    def get(self, request: Request, project_id: str) -> Response:
        result = self._get_project_or_404(request, project_id)
        if isinstance(result, Response):
            return result
        serializer = ProjectSerializer(result, context={"request": request})
        return Response(serializer.data)

    def patch(self, request: Request, project_id: str) -> Response:
        result = self._get_project_or_404(request, project_id)
        if isinstance(result, Response):
            return result

        serializer = ProjectUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated = ProjectService.update_project(
            user=request.user,
            project_id=project_id,
            name=serializer.validated_data["name"],
        )
        return Response(ProjectSerializer(updated, context={"request": request}).data)

    def delete(self, request: Request, project_id: str) -> Response:
        deleted = ProjectService.soft_delete_project(request.user, project_id)
        if not deleted:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class TimelineStateView(APIView):
    """
    GET   /api/projects/<id>/timeline/  — retrieve timeline state
    PATCH /api/projects/<id>/timeline/  — save timeline state (auto-save + Ctrl+S)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, project_id: str) -> Response:
        timeline = ProjectService.get_timeline_state(request.user, project_id)
        if timeline is None:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({"timeline_state": timeline})

    def patch(self, request: Request, project_id: str) -> Response:
        timeline_state = request.data.get("timeline_state")
        if timeline_state is None:
            return Response(
                {"detail": "timeline_state is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project = ProjectService.save_timeline_state(
            user=request.user,
            project_id=project_id,
            timeline_state=timeline_state,
        )
        if project is None:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = TimelineStateSerializer(project)
        return Response(serializer.data)
