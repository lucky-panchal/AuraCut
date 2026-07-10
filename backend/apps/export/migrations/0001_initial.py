"""
Initial migration for apps.export — creates ExportJob table.
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
        ("projects", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ExportJob",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("resolution", models.CharField(
                    choices=[("480p", "480p"), ("720p", "720p"), ("1080p", "1080p")],
                    default="1080p",
                    max_length=10,
                )),
                ("format", models.CharField(
                    choices=[("mp4", "MP4"), ("webm", "WebM")],
                    default="mp4",
                    max_length=10,
                )),
                ("bitrate", models.CharField(
                    choices=[("low", "Low"), ("medium", "Medium"), ("high", "High")],
                    default="medium",
                    max_length=10,
                )),
                ("fps", models.IntegerField(
                    choices=[(24, "24 fps"), (30, "30 fps"), (60, "60 fps")],
                    default=30,
                )),
                ("subtitle_burn_in", models.BooleanField(default=False)),
                ("status", models.CharField(
                    choices=[
                        ("queued", "Queued"),
                        ("processing", "Processing"),
                        ("completed", "Completed"),
                        ("failed", "Failed"),
                    ],
                    default="queued",
                    max_length=15,
                )),
                ("progress", models.IntegerField(default=0)),
                ("output_path", models.CharField(blank=True, default="", max_length=512)),
                ("error_message", models.TextField(blank=True, default="")),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="export_jobs",
                        to="projects.project",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="export_jobs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Export Job",
                "verbose_name_plural": "Export Jobs",
                "ordering": ["-created_at"],
                "abstract": False,
            },
        ),
    ]
