"""
Root URL configuration for Auracut.
App-level URLs are included here as each app is built.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),

    # App URLs registered here as tasks are completed
    # Task 3: path("api/auth/", include("apps.accounts.urls")),
    # Task 4: path("api/projects/", include("apps.projects.urls")),
    # Task 5: path("api/", include("apps.assets.urls")),
    # Task 7: path("api/", include("apps.export.urls")),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
