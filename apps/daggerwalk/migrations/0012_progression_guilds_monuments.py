from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("daggerwalk", "0011_quest_slot")]

    operations = [
        migrations.AddField(model_name="twitchuserprofile", name="current_guild", field=models.CharField(blank=True, db_index=True, default="", max_length=32)),
        migrations.AddField(model_name="twitchuserprofile", name="monument_token_adjustment", field=models.IntegerField(default=0, help_text="Admin adjustment to XP-earned Monument Tokens. Positive grants tokens; negative removes them.")),
        migrations.AddField(model_name="twitchuserprofile", name="twitch_profile_image_url", field=models.URLField(blank=True, default="", max_length=500)),
        migrations.AddField(model_name="twitchuserprofile", name="twitch_user_id", field=models.CharField(blank=True, db_index=True, max_length=32, null=True)),
        migrations.CreateModel(name="Monument", fields=[("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")), ("monument_type", models.CharField(db_index=True, max_length=50)), ("world_x", models.IntegerField()), ("world_z", models.IntegerField()), ("game_date", models.CharField(max_length=255)), ("guild_at_placement", models.CharField(blank=True, default="", max_length=32)), ("renown_title_at_placement", models.CharField(max_length=100)), ("guild_title_at_placement", models.CharField(blank=True, default="", max_length=100)), ("created_at", models.DateTimeField(auto_now_add=True)), ("owner", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="monuments", to="daggerwalk.twitchuserprofile")), ("poi", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="monument", to="daggerwalk.poi"))]),
        migrations.CreateModel(name="ProgressionEvent", fields=[("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")), ("event_type", models.CharField(db_index=True, max_length=32)), ("payload", models.JSONField(blank=True, default=dict)), ("created_at", models.DateTimeField(auto_now_add=True)), ("monument", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="progression_events", to="daggerwalk.monument")), ("profile", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="progression_events", to="daggerwalk.twitchuserprofile")), ("quest", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="progression_events", to="daggerwalk.quest"))]),
    ]
