"""
apps/assets/views.py

Asset upload, listing, retrieval, and deletion endpoints.
All views verify project ownership before touching any asset.
"""

import logging

from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.projects.services import ProjectService
from .models import MediaAsset
from .serializers import MediaAssetSerializer
from .services import AssetService

logger = logging.getLogger("auracut")


def _get_project_or_404(user, project_id: str) -> tuple:
    """
    Returns (project, None) if found, or (None, 404 Response) if not.
    Centralises the project ownership check for all asset views.
    """
    project = ProjectService.get_project(user, project_id)
    if project is None:
        return None, Response(
            {"detail": "Project not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    return project, None


class AssetListCreateView(APIView):
    """
    GET  /api/projects/<project_id>/assets/  — list all assets in a project
    POST /api/projects/<project_id>/assets/  — upload a new asset
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request: Request, project_id: str) -> Response:
        project, err = _get_project_or_404(request.user, project_id)
        if err:
            return err

        assets = AssetService.get_project_assets(project)
        serializer = MediaAssetSerializer(assets, many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request: Request, project_id: str) -> Response:
        project, err = _get_project_or_404(request.user, project_id)
        if err:
            return err

        file = request.FILES.get("file")
        if not file:
            return Response(
                {"detail": "No file provided. Send file as multipart/form-data with key 'file'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ValidationError from AssetService is caught by global_exception_handler
        asset = AssetService.upload_asset(project=project, file=file)
        serializer = MediaAssetSerializer(asset, context={"request": request})
        return Response(serializer.data, status=status.HTTP_202_ACCEPTED)


class AssetDetailView(APIView):
    """
    GET    /api/assets/<asset_id>/  — retrieve a single asset
    DELETE /api/assets/<asset_id>/  — delete asset and all associated files
    """

    permission_classes = [IsAuthenticated]

    def _get_asset_or_404(self, request: Request, asset_id: str):
        """
        Finds the asset and verifies the requesting user owns its project.
        Returns (asset, None) or (None, Response).
        """
        try:
            asset = MediaAsset.objects.select_related("project__owner").get(id=asset_id)
        except MediaAsset.DoesNotExist:
            return None, Response(
                {"detail": "Asset not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if asset.project.owner != request.user:
            return None, Response(
                {"detail": "Asset not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return asset, None

    def get(self, request: Request, asset_id: str) -> Response:
        asset, err = self._get_asset_or_404(request, asset_id)
        if err:
            return err
        serializer = MediaAssetSerializer(asset, context={"request": request})
        return Response(serializer.data)

    def delete(self, request: Request, asset_id: str) -> Response:
        asset, err = self._get_asset_or_404(request, asset_id)
        if err:
            return err

        deleted = AssetService.delete_asset(asset.project, asset_id)
        if not deleted:
            return Response(
                {"detail": "Asset not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
