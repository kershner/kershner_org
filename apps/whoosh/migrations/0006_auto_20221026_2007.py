# Generated by Django 3.2.16 on 2022-10-27 00:07

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('whoosh', '0005_remove_whoosh_end_time'),
    ]

    operations = [
        migrations.AddField(
            model_name='whoosh',
            name='crop_4_3',
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name='whoosh',
            name='start_time',
            field=models.CharField(blank=True, default='00:00:00', max_length=8, null=True),
        ),
    ]
