"""
apps/export/views.py

Export job creation and status endpoints.
"""

import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.projects.services import ProjectService
from .serializers import ExportJobCreateSerializer, ExportJobSerializer
from .services import ExportService

logger = logging.getLogger("auracut")


class ExportCreateView(APIView):
    """
    POST /api/projects/<project_id>/export/

    Creates an export job and queues it for processing.
    Returns 202 Accepted with job_id immediately.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, project_id: str) -> Response:
        project = ProjectService.get_project(request.user, project_id)
        if project is None:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not project.timeline_state:
            return Response(
                {"detail": "Project has no timeline to export. Add clips first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ExportJobCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        job = ExportService.create_export_job(
            user=request.user,
            project=project,
            resolution=data["resolution"],
            format=data["format"],
            bitrate=data["bitrate"],
            fps=data["fps"],
            subtitle_burn_in=data["subtitle_burn_in"],
        )

        queue_position = ExportService.get_queue_position(job)
        response_data = ExportJobSerializer(job, context={"request": request}).data
        response_data["queue_position"] = queue_position

        return Response(response_data, status=status.HTTP_202_ACCEPTED)


class ExportDetailView(APIView):
    """
    GET /api/export/<job_id>/

    Returns current status, progress, and download URL for an export job.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, job_id: str) -> Response:
        job = ExportService.get_job(request.user, job_id)
        if job is None:
            return Response(
                {"detail": "Export job not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        response_data = ExportJobSerializer(job, context={"request": request}).data
        response_data["queue_position"] = ExportService.get_queue_position(job)
        return Response(response_data)
