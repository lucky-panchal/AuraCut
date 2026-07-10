"""
core/exceptions.py

Global exception handler for Auracut REST API.
Registered in settings via REST_FRAMEWORK['EXCEPTION_HANDLER'].

Behaviour:
    - DRF-known exceptions (ValidationError, PermissionDenied, etc.)
      are handled by DRF's default handler and returned as-is.
    - Unhandled exceptions (500-level) are logged with full stack trace
      and returned as a safe, generic JSON response — no internal
      details leaked to the client.
"""

import logging
from typing import Any

from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler
from rest_framework import status

logger = logging.getLogger("auracut")


def global_exception_handler(exc: Exception, context: dict[str, Any]) -> Response:
    """
    Custom DRF exception handler.

    First delegates to DRF's default handler. If DRF cannot handle it
    (i.e. it returns None — meaning it's an unhandled server error),
    we log the full traceback and return a safe 500 response.
    """
    # Let DRF handle what it knows about (4xx errors, validation, etc.)
    response = drf_exception_handler(exc, context)

    if response is not None:
        # DRF handled it — standardise the response envelope
        response.data = {
            "error": True,
            "detail": response.data,
            "status_code": response.status_code,
        }
        return response

    # DRF could not handle it — this is an unhandled server error
    view = context.get("view")
    logger.exception(
        "Unhandled exception in view '%s': %s",
        type(view).__name__ if view else "unknown",
        exc,
        exc_info=exc,
    )

    return Response(
        {
            "error": True,
            "detail": "An unexpected error occurred. Please try again later.",
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
