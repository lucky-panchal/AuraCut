"""
apps/export/consumers.py

ExportConsumer handles the WebSocket connection for a single export job.
Streams progress updates and completion/failure events from the
Celery export_task to the connected browser client.

Connection URL: ws/export/<job_id>/
Authentication:  JWT token passed as query param ?token=<access_token>
"""

import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import User
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

from .models import ExportJob

logger = logging.getLogger("auracut")


class ExportConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer for export job progress streaming.

    Groups:
        export_<job_id> — receives messages from export_task

    Message types received from channel layer:
        export.message — sent by export_task with event/progress/download_url

    Message types sent to client:
        progress   — {event: "progress", value: 0-100}
        completed  — {event: "completed", download_url: "..."}
        failed     — {event: "failed", error: "..."}
    """

    async def connect(self) -> None:
        self.job_id = self.scope["url_route"]["kwargs"]["job_id"]
        self.group_name = f"export_{self.job_id}"
        self.user = await self._authenticate()

        if self.user is None:
            await self.close(code=4001)
            return

        job = await self._get_job()
        if job is None:
            logger.warning(
                "ExportConsumer: user '%s' attempted to connect to job '%s' — not found.",
                self.user.username,
                self.job_id,
            )
            await self.close(code=4004)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Send current job state immediately on connect
        # so the client doesn't miss progress if it connects late
        await self.send_json({
            "event": "state",
            "status": job.status,
            "progress": job.progress,
        })

        logger.info(
            "ExportConsumer: user '%s' connected to job '%s'.",
            self.user.username,
            self.job_id,
        )

    async def disconnect(self, close_code: int) -> None:
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        logger.info(
            "ExportConsumer: disconnected from job '%s' (code=%s).",
            self.job_id,
            close_code,
        )

    async def receive_json(self, content: dict, **kwargs) -> None:
        # Clients don't send messages on this channel
        pass

    # -----------------------------------------------------------------------
    # Channel layer message handlers
    # -----------------------------------------------------------------------

    async def export_message(self, event: dict) -> None:
        """Forwards export progress/completion/failure events to the client."""
        await self.send_json({k: v for k, v in event.items() if k != "type"})

    # -----------------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------------

    async def _authenticate(self) -> User | None:
        query_string = self.scope.get("query_string", b"").decode()
        params = parse_qs(query_string)
        token_list = params.get("token", [])

        if not token_list:
            logger.warning("ExportConsumer: no token in query string.")
            return None

        try:
            token = AccessToken(token_list[0])
            user = await database_sync_to_async(
                lambda: User.objects.get(id=token["user_id"])
            )()
            return user
        except (InvalidToken, TokenError, User.DoesNotExist) as exc:
            logger.warning("ExportConsumer: authentication failed — %s.", exc)
            return None

    @database_sync_to_async
    def _get_job(self) -> ExportJob | None:
        return ExportJob.objects.filter(
            id=self.job_id,
            user=self.user,
        ).first()
