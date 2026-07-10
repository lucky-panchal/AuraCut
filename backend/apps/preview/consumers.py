"""
apps/preview/consumers.py

PreviewConsumer handles real-time preview frame requests from the editor.

Flow:
    1. Client sends preview_request with segment + effects
    2. Consumer revokes any pending preview task for this connection
    3. Consumer queues a new preview_render_task
    4. Task renders frame via FFmpeg and sends result back to this channel
    5. Consumer forwards frame to client

Connection URL: ws/preview/<project_id>/
Authentication:  JWT token passed as query param ?token=<access_token>
"""

import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import User
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

from apps.projects.models import Project
from .tasks import preview_render_task

logger = logging.getLogger("auracut")


class PreviewConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer for server-side preview frame rendering.

    Each connection tracks the last queued Celery task ID so it can
    be revoked when a new preview request arrives — prevents stale
    frames from arriving out of order.

    Message types received from client:
        preview_request — {type, segment, effects}

    Message types sent to client:
        preview_frame   — {type, data: base64, mime: "image/jpeg"}
        preview_error   — {type, message}
        status          — {type, message} connection status updates
    """

    async def connect(self) -> None:
        self.project_id = self.scope["url_route"]["kwargs"]["project_id"]
        self.pending_task_id: str | None = None
        self.user = await self._authenticate()

        if self.user is None:
            await self.close(code=4001)
            return

        project = await self._get_project()
        if project is None:
            logger.warning(
                "PreviewConsumer: user '%s' attempted to connect to project '%s' — not found.",
                self.user.username,
                self.project_id,
            )
            await self.close(code=4004)
            return

        await self.accept()
        await self.send_json({"type": "status", "message": "connected"})
        logger.info(
            "PreviewConsumer: user '%s' connected to project '%s'.",
            self.user.username,
            self.project_id,
        )

    async def disconnect(self, close_code: int) -> None:
        # Revoke any pending preview task on disconnect
        self._revoke_pending_task()
        logger.info(
            "PreviewConsumer: disconnected from project '%s' (code=%s).",
            self.project_id,
            close_code,
        )

    async def receive_json(self, content: dict, **kwargs) -> None:
        msg_type = content.get("type")

        if msg_type == "preview_request":
            await self._handle_preview_request(content)
        else:
            logger.debug("PreviewConsumer: unknown message type '%s'.", msg_type)

    # -----------------------------------------------------------------------
    # Channel layer message handlers (called by preview_render_task)
    # -----------------------------------------------------------------------

    async def preview_frame(self, event: dict) -> None:
        """Forwards rendered frame from Celery task to the client."""
        await self.send_json({
            "type": "preview_frame",
            "data": event["data"],
            "mime": event["mime"],
        })

    async def preview_error(self, event: dict) -> None:
        """Forwards preview render error to the client."""
        await self.send_json({
            "type": "preview_error",
            "message": event["message"],
        })

    # -----------------------------------------------------------------------
    # Private helpers
    # -----------------------------------------------------------------------

    async def _handle_preview_request(self, content: dict) -> None:
        """
        Revokes any pending preview task and queues a new one.
        Uses self.channel_name so the task sends the result directly
        to this consumer, not to a group.
        """
        segment = content.get("segment", {})
        effects = content.get("effects", [])

        if not segment.get("asset_id"):
            await self.send_json({
                "type": "preview_error",
                "message": "Invalid preview request: missing asset_id.",
            })
            return

        # Cancel previous pending task to avoid stale frame delivery
        self._revoke_pending_task()

        task = preview_render_task.delay(
            channel_name=self.channel_name,
            segment=segment,
            effects=effects,
        )
        self.pending_task_id = task.id
        logger.debug(
            "PreviewConsumer: queued task '%s' for project '%s'.",
            task.id,
            self.project_id,
        )

    def _revoke_pending_task(self) -> None:
        """Revokes the pending Celery task if one exists."""
        if self.pending_task_id:
            from config.celery import app as celery_app
            celery_app.control.revoke(self.pending_task_id, terminate=True)
            logger.debug("PreviewConsumer: revoked task '%s'.", self.pending_task_id)
            self.pending_task_id = None

    async def _authenticate(self) -> User | None:
        query_string = self.scope.get("query_string", b"").decode()
        params = parse_qs(query_string)
        token_list = params.get("token", [])

        if not token_list:
            return None

        try:
            token = AccessToken(token_list[0])
            user = await database_sync_to_async(
                lambda: User.objects.get(id=token["user_id"])
            )()
            return user
        except (InvalidToken, TokenError, User.DoesNotExist) as exc:
            logger.warning("PreviewConsumer: authentication failed — %s.", exc)
            return None

    @database_sync_to_async
    def _get_project(self) -> Project | None:
        return Project.objects.filter(
            id=self.project_id,
            owner=self.user,
            is_deleted=False,
        ).first()
