# Generated by Django 3.2.16 on 2022-10-24 18:49

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('whoosh', '0004_auto_20221024_1339'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='whoosh',
            name='end_time',
        ),
    ]