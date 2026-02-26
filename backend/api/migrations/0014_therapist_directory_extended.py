from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0013_testresult_enhancements"),
    ]

    operations = [
        migrations.AddField(
            model_name="therapistdirectory",
            name="email",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="therapistdirectory",
            name="region",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="therapistdirectory",
            name="credentials",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="therapistdirectory",
            name="specialty",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="therapistdirectory",
            name="website",
            field=models.URLField(blank=True, max_length=500, null=True),
        ),
        migrations.AddField(
            model_name="therapistdirectory",
            name="profile_url",
            field=models.URLField(blank=True, max_length=500, null=True),
        ),
        migrations.AddField(
            model_name="therapistdirectory",
            name="languages",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="therapistdirectory",
            name="external_id",
            field=models.CharField(blank=True, max_length=255, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="therapistdirectory",
            name="source",
            field=models.CharField(
                blank=True,
                choices=[
                    ("npi", "NPI Registry"),
                    ("import", "Imported (JSON/scraper)"),
                ],
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="therapistdirectory",
            name="service_type",
            field=models.JSONField(blank=True, null=True),
        ),
    ]
