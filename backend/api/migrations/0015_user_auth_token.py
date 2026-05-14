from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0014_therapist_directory_extended"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="auth_token",
            field=models.CharField(
                blank=True, db_index=True, max_length=128, null=True
            ),
        ),
    ]
