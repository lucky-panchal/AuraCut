"""
apps/export/urls.py

Export endpoints:
    POST /api/projects/<project_id>/export/  — create export job
    GET  /api/export/<job_id>/               — get job status
"""

from django.urls import path

from .views import ExportCreateView, ExportDetailView

export_urlpatterns = [
    path(
        "projects/<uuid:project_id>/export/",
        ExportCreateView.as_view(),
        name="export-create",
    ),
    path(
        "export/<uuid:job_id>/",
        ExportDetailView.as_view(),
        name="export-detail",
    ),
]
