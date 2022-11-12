# Generated by Django 2.1.3 on 2022-10-23 04:55

import apps.whoosh.models
from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Whoosh',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created', models.DateTimeField(default=django.utils.timezone.now)),
                ('source_video', models.FileField(upload_to=apps.whoosh.models.whoosh_upload)),
                ('credit_text', models.CharField(blank=True, max_length=50, null=True)),
                ('mute_original', models.BooleanField(default=False)),
                ('processed', models.DateTimeField(blank=True, null=True)),
                ('processed_video', models.FileField(blank=True, null=True, upload_to=apps.whoosh.models.whoosh_processed)),
                ('user_agent', models.TextField(blank=True, null=True)),
                ('video_data', models.TextField(blank=True, null=True)),
            ],
            options={
                'verbose_name_plural': 'Whooshes',
            },
        ),
    ]
