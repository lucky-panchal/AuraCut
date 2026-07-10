"""
WebSocket URL routing for Auracut.
All WebSocket paths are prefixed with /ws/.
"""

from django.urls import re_path

from apps.projects.consumers import ProjectConsumer
from apps.preview.consumers import PreviewConsumer
from apps.export.consumers import ExportConsumer

websocket_urlpatterns = [
    re_path(r"^ws/project/(?P<project_id>[0-9a-f-]+)/$", ProjectConsumer.as_asgi()),
    re_path(r"^ws/preview/(?P<project_id>[0-9a-f-]+)/$", PreviewConsumer.as_asgi()),
    re_path(r"^ws/export/(?P<job_id>[0-9a-f-]+)/$", ExportConsumer.as_asgi()),
]
