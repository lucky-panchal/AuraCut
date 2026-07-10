"""
apps/projects/urls.py

Project endpoints mounted under /api/projects/.
"""

from django.urls import path

from .views import ProjectListCreateView, ProjectDetailView, TimelineStateView

urlpatterns = [
    path("", ProjectListCreateView.as_view(), name="project-list-create"),
    path("<uuid:project_id>/", ProjectDetailView.as_view(), name="project-detail"),
    path("<uuid:project_id>/timeline/", TimelineStateView.as_view(), name="project-timeline"),
]
