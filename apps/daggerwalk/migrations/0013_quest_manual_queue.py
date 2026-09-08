from django.db import migrations, models


def backfill_started_at(apps, schema_editor):
    Quest = apps.get_model("daggerwalk", "Quest")
    Quest.objects.filter(status__in=("in_progress", "completed")).update(
        started_at=models.F("created_at")
    )


class Migration(migrations.Migration):
    dependencies = [("daggerwalk", "0012_progression_guilds_monuments")]

    operations = [
        migrations.AddField(
            model_name="quest",
            name="started_at",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.RunPython(backfill_started_at, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="quest",
            name="slot",
            field=models.PositiveSmallIntegerField(
                blank=True,
                choices=[(1, "1"), (2, "2"), (3, "3")],
                help_text="Queued quests are promoted only when this slot becomes available.",
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="quest",
            name="status",
            field=models.CharField(
                choices=[
                    ("available", "Queued"),
                    ("in_progress", "In Progress"),
                    ("completed", "Completed"),
                    ("disabled", "Disabled"),
                ],
                db_index=True,
                default="available",
                max_length=20,
            ),
        ),
    ]
