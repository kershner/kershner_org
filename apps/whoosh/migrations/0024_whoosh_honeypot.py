# Generated by Django 3.2.16 on 2022-11-12 02:33

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('whoosh', '0023_alter_whoosh_uniq_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='whoosh',
            name='honeypot',
            field=models.CharField(blank=True, max_length=200, null=True),
        ),
    ]
