from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0010_session_resume_message"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="dashboard_tour_seen",
            field=models.BooleanField(default=False),
        ),
    ]

