"""
WebSocket URL routing for Auracut.

Consumers are registered here as each app is built.
All WebSocket paths are prefixed with /ws/.
"""

from django.urls import re_path

from apps.projects.consumers import ProjectConsumer

# Preview and Export consumers added in Task 8
websocket_urlpatterns = [
    re_path(r"^ws/project/(?P<project_id>[0-9a-f-]+)/$", ProjectConsumer.as_asgi()),
]
