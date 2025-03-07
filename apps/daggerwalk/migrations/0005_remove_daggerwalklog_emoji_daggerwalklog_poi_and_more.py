# Generated by Django 4.2 on 2025-03-07 02:11

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('daggerwalk', '0004_remove_daggerwalklog_location_type_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='daggerwalklog',
            name='emoji',
        ),
        migrations.AddField(
            model_name='daggerwalklog',
            name='poi',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='logs', to='daggerwalk.poi'),
        ),
        migrations.AddField(
            model_name='poi',
            name='emoji',
            field=models.CharField(blank=True, max_length=10, null=True),
        ),
        migrations.AddField(
            model_name='region',
            name='emoji',
            field=models.CharField(blank=True, max_length=10, null=True),
        ),
        migrations.AlterField(
            model_name='region',
            name='climate',
            field=models.CharField(choices=[('Desert', 'Desert'), ('Mountain', 'Mountain'), ('Woodlands', 'Woodlands'), ('Swamp', 'Swamp'), ('Ocean', 'Ocean'), ('Subtropical', 'Subtropical'), ('Rainforest', 'Rainforest')], max_length=100),
        ),
    ]
