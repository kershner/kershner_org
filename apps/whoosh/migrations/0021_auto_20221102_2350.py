# Generated by Django 3.2.16 on 2022-11-03 03:50

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('whoosh', '0020_auto_20221101_1946'),
    ]

    operations = [
        migrations.AlterField(
            model_name='whoosh',
            name='doppelganger',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='whoosh.whoosh'),
        ),
        migrations.AlterField(
            model_name='whoosh',
            name='uniq_id',
            field=models.CharField(default='3e9de668edc140beb8ab126bd4377bb7', max_length=100, null=True),
        ),
    ]