# Generated by Django 4.2 on 2025-02-12 23:22

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='DaggerwalkLog',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('world_x', models.IntegerField(help_text='X coordinate in world space')),
                ('world_z', models.IntegerField(help_text='Z coordinate in world space')),
                ('map_pixel_x', models.SmallIntegerField(help_text='X coordinate on the world map')),
                ('map_pixel_y', models.SmallIntegerField(help_text='Y coordinate on the world map')),
                ('region', models.CharField(help_text='Region name', max_length=255)),
                ('location', models.CharField(help_text='Specific location name', max_length=255)),
                ('location_type', models.CharField(help_text='Type of location', max_length=255)),
                ('player_x', models.DecimalField(decimal_places=6, help_text='Precise X coordinate of player', max_digits=20)),
                ('player_y', models.DecimalField(decimal_places=6, help_text='Precise Y coordinate of player', max_digits=20)),
                ('player_z', models.DecimalField(decimal_places=6, help_text='Precise Z coordinate of player', max_digits=20)),
                ('date', models.CharField(help_text='In-game date and time', max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True, help_text='Timestamp when this log entry was created')),
                ('weather', models.CharField(help_text='Current weather condition', max_length=255)),
                ('current_song', models.CharField(blank=True, help_text='Currently playing background music', max_length=255, null=True)),
            ],
            options={
                'verbose_name': 'Daggerwalk Log',
                'verbose_name_plural': 'Daggerwalk Logs',
            },
        ),
    ]
