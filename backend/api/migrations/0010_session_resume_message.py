from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0009_session_uuid_per_user"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        'ALTER TABLE "session" '
                        'ADD COLUMN IF NOT EXISTS resume_message TEXT DEFAULT \'\'::text;'
                    ),
                    reverse_sql=(
                        'ALTER TABLE "session" '
                        'DROP COLUMN IF EXISTS resume_message;'
                    ),
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="session",
                    name="resume_message",
                    field=models.TextField(blank=True, default=""),
                ),
            ],
        )
    ]

