# Generated by Django 2.1.3 on 2022-10-24 00:46

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('whoosh', '0002_auto_20221023_2009'),
    ]

    operations = [
        migrations.AddField(
            model_name='whoosh',
            name='black_and_white',
            field=models.BooleanField(default=False),
        ),
    ]
