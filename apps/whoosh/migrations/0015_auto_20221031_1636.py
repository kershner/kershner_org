# Generated by Django 3.2.16 on 2022-10-31 20:36

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('whoosh', '0014_whoosh_doppelgangers'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='whoosh',
            name='doppelgangers',
        ),
        migrations.AddField(
            model_name='whoosh',
            name='doppelganger',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.DO_NOTHING, to='whoosh.whoosh'),
        ),
    ]
