"""
Development settings for Auracut.
Extends base.py — never use in production.
"""

from .base import *  # noqa: F401, F403

DEBUG = True

ALLOWED_HOSTS = ["*"]

# Allow React dev server (Vite default port)
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

CORS_ALLOW_CREDENTIALS = True

# Relaxed security for local development
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
]
