"""
WSGI config for Auracut.

Not used in production (Daphne uses ASGI), but required by
Django management commands and some tooling.
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

application = get_wsgi_application()
