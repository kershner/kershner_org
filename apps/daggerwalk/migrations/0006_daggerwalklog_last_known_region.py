# Generated by Django 4.2 on 2025-03-17 22:15

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('daggerwalk', '0005_remove_daggerwalklog_emoji_daggerwalklog_poi_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='daggerwalklog',
            name='last_known_region',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='daggerwalk.region'),
        ),
    ]
