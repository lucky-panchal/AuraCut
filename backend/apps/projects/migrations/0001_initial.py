"""
Initial migration for apps.projects — creates Project table.
"""

import uuid
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Project",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("timeline_state", models.JSONField(blank=True, null=True)),
                ("thumbnail", models.ImageField(blank=True, null=True, upload_to="thumbnails/projects/")),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="projects",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Project",
                "verbose_name_plural": "Projects",
                "ordering": ["-updated_at"],
                "abstract": False,
            },
        ),
    ]
