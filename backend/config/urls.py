"""
Root URL configuration for Auracut.
App-level URLs are included here as each app is built.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from apps.assets.urls import project_asset_urlpatterns, asset_urlpatterns

urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/auth/", include("apps.accounts.urls")),
    path("api/projects/", include("apps.projects.urls")),
    path("api/", include(project_asset_urlpatterns)),
    path("api/", include(asset_urlpatterns)),

    # Task 7: path("api/", include("apps.export.urls")),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
