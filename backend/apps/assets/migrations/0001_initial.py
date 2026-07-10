"""
Initial migration for apps.assets — creates MediaAsset table.
"""

import uuid
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("projects", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="MediaAsset",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("filename", models.CharField(max_length=255)),
                ("asset_type", models.CharField(
                    choices=[("video", "Video"), ("audio", "Audio"), ("image", "Image")],
                    max_length=10,
                )),
                ("file_path", models.CharField(max_length=512)),
                ("proxy_path", models.CharField(blank=True, default="", max_length=512)),
                ("thumbnail_path", models.CharField(blank=True, default="", max_length=512)),
                ("duration", models.FloatField(blank=True, null=True)),
                ("resolution", models.CharField(blank=True, default="", max_length=20)),
                ("fps", models.FloatField(blank=True, null=True)),
                ("codec", models.CharField(blank=True, default="", max_length=50)),
                ("file_size", models.BigIntegerField(default=0)),
                ("status", models.CharField(
                    choices=[
                        ("uploading", "Uploading"),
                        ("processing", "Processing"),
                        ("ready", "Ready"),
                        ("error", "Error"),
                    ],
                    default="uploading",
                    max_length=15,
                )),
                ("error_message", models.TextField(blank=True, default="")),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="assets",
                        to="projects.project",
                    ),
                ),
            ],
            options={
                "verbose_name": "Media Asset",
                "verbose_name_plural": "Media Assets",
                "ordering": ["-created_at"],
                "abstract": False,
            },
        ),
    ]
