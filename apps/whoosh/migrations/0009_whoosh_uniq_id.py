# Generated by Django 3.2.16 on 2022-10-28 01:03

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('whoosh', '0008_rename_crop_4_3_whoosh_portrait'),
    ]

    operations = [
        migrations.AddField(
            model_name='whoosh',
            name='uniq_id',
            field=models.CharField(max_length=8, null=True),
        ),
    ]
