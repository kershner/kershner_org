# Generated by Django 2.1.3 on 2018-12-09 05:08

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('song', '0004_song_notes'),
    ]

    operations = [
        migrations.AlterField(
            model_name='song',
            name='notes',
            field=models.TextField(blank=True, null=True),
        ),
    ]
