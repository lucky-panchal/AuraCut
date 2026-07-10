"""
apps/assets/urls.py

Asset endpoints:
    Nested under projects: /api/projects/<project_id>/assets/
    Standalone:            /api/assets/<asset_id>/
"""

from django.urls import path

from .views import AssetListCreateView, AssetDetailView

# These are split across two include() calls in config/urls.py
project_asset_urlpatterns = [
    path(
        "projects/<uuid:project_id>/assets/",
        AssetListCreateView.as_view(),
        name="asset-list-create",
    ),
]

asset_urlpatterns = [
    path(
        "assets/<uuid:asset_id>/",
        AssetDetailView.as_view(),
        name="asset-detail",
    ),
]
