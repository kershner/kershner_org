# Generated by Django 3.2.16 on 2022-11-01 12:39

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('whoosh', '0016_auto_20221031_1746'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='whoosh',
            name='doppelganger',
        ),
        migrations.AddField(
            model_name='whoosh',
            name='doppelgangers',
            field=models.ManyToManyField(to='whoosh.Whoosh'),
        ),
    ]
