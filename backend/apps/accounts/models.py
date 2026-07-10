"""
apps/accounts/models.py

UserProfile extends Django's built-in User model via a OneToOne
relationship. Keeps auth concerns in Django's User and profile
concerns here — clean separation.
"""

import logging

from django.contrib.auth.models import User
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver

from core.models import BaseModel

logger = logging.getLogger("auracut")


class UserProfile(BaseModel):
    """
    Extended profile for every Auracut user.

    Created automatically via post_save signal when a User is created —
    callers never need to create this manually.

    Fields:
        user         — OneToOne link to Django's auth.User
        display_name — optional public-facing name (falls back to username)
        avatar       — optional profile image
    """

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    display_name = models.CharField(max_length=100, blank=True, default="")
    avatar = models.ImageField(
        upload_to="avatars/",
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"

    def __str__(self) -> str:
        return f"Profile({self.user.username})"

    @property
    def name(self) -> str:
        """Returns display_name if set, otherwise falls back to username."""
        return self.display_name or self.user.username


# ---------------------------------------------------------------------------
# Signal: auto-create UserProfile whenever a new User is saved
# ---------------------------------------------------------------------------

@receiver(post_save, sender=User)
def create_user_profile(sender: type, instance: User, created: bool, **kwargs) -> None:
    if created:
        UserProfile.objects.create(user=instance)
        logger.debug("UserProfile created for user '%s'.", instance.username)
