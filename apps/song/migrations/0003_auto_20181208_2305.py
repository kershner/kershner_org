# Generated by Django 2.1.3 on 2018-12-09 04:05

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('song', '0002_auto_20181208_2255'),
    ]

    operations = [
        migrations.AlterField(
            model_name='song',
            name='duration',
            field=models.CharField(default='poop', max_length=20),
            preserve_default=False,
        ),
    ]
