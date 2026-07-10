"""
apps/projects/consumers.py

ProjectConsumer handles the WebSocket connection for a project workspace.
Primary responsibility: forward asset_ready notifications from Celery
workers to the connected browser client.

Connection URL: ws/project/<project_id>/
Authentication:  JWT token passed as query param ?token=<access_token>
"""

import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import AnonymousUser, User
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

from apps.projects.models import Project

logger = logging.getLogger("auracut")


class ProjectConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer for project-level events.

    Groups:
        project_<project_id> — receives asset_ready events from process_asset_task

    Message types received from channel layer:
        asset.ready — sent by process_asset_task when processing completes

    Message types sent to client:
        asset_ready — forwarded asset data
        error       — connection or auth errors
    """

    async def connect(self) -> None:
        self.project_id = self.scope["url_route"]["kwargs"]["project_id"]
        self.group_name = f"project_{self.project_id}"
        self.user = await self._authenticate()

        if self.user is None:
            await self.close(code=4001)
            return

        # Verify user owns this project
        project = await self._get_project()
        if project is None:
            logger.warning(
                "ProjectConsumer: user '%s' attempted to connect to project '%s' — not found or not owner.",
                self.user.username,
                self.project_id,
            )
            await self.close(code=4004)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info(
            "ProjectConsumer: user '%s' connected to project '%s'.",
            self.user.username,
            self.project_id,
        )

    async def disconnect(self, close_code: int) -> None:
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        logger.info(
            "ProjectConsumer: disconnected from project '%s' (code=%s).",
            self.project_id,
            close_code,
        )

    async def receive_json(self, content: dict, **kwargs) -> None:
        # Clients don't send messages on this channel — it's receive-only
        pass

    # -----------------------------------------------------------------------
    # Channel layer message handlers
    # -----------------------------------------------------------------------

    async def asset_ready(self, event: dict) -> None:
        """Forwards asset_ready event from Celery worker to the client."""
        await self.send_json({
            "type": "asset_ready",
            "asset": event["asset"],
        })

    # -----------------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------------

    async def _authenticate(self) -> User | None:
        """
        Extracts and validates JWT from query string.
        Returns User on success, None on failure.
        """
        query_string = self.scope.get("query_string", b"").decode()
        params = parse_qs(query_string)
        token_list = params.get("token", [])

        if not token_list:
            logger.warning("ProjectConsumer: no token in query string.")
            return None

        try:
            token = AccessToken(token_list[0])
            user = await database_sync_to_async(
                lambda: User.objects.get(id=token["user_id"])
            )()
            return user
        except (InvalidToken, TokenError, User.DoesNotExist) as exc:
            logger.warning("ProjectConsumer: authentication failed — %s.", exc)
            return None

    @database_sync_to_async
    def _get_project(self) -> Project | None:
        return Project.objects.filter(
            id=self.project_id,
            owner=self.user,
            is_deleted=False,
        ).first()
