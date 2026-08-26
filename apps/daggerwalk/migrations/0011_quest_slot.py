from django.db import migrations, models
from django.db.models import Q


def assign_current_quest_slot(apps, schema_editor):
    Quest = apps.get_model('daggerwalk', 'Quest')
    current = Quest.objects.filter(status='in_progress').order_by('-created_at').first()
    if current:
        current.slot = 1
        current.save(update_fields=['slot'])


class Migration(migrations.Migration):

    dependencies = [
        ('daggerwalk', '0010_poi_discovered_alter_quest_quest_giver_img_number'),
    ]

    operations = [
        migrations.AddField(
            model_name='quest',
            name='slot',
            field=models.PositiveSmallIntegerField(
                blank=True,
                choices=[(1, '1'), (2, '2'), (3, '3')],
                null=True,
            ),
        ),
        migrations.RunPython(assign_current_quest_slot, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='quest',
            constraint=models.UniqueConstraint(
                condition=Q(status='in_progress'),
                fields=('slot',),
                name='unique_active_quest_slot',
            ),
        ),
        migrations.AddConstraint(
            model_name='quest',
            constraint=models.UniqueConstraint(
                condition=Q(status='in_progress'),
                fields=('poi',),
                name='unique_active_quest_poi',
            ),
        ),
    ]
