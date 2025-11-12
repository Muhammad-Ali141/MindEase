from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0008_message_user_cleanup"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='ALTER TABLE "session" DROP CONSTRAINT IF EXISTS unique_session_uuid_per_user;',
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    sql=(
                        'ALTER TABLE "session" '
                        'ADD CONSTRAINT unique_session_uuid_per_user '
                        'UNIQUE (user_id, session_uuid);'
                    ),
                    reverse_sql=(
                        'ALTER TABLE "session" '
                        'DROP CONSTRAINT IF EXISTS unique_session_uuid_per_user;'
                    ),
                ),
            ],
            state_operations=[
                migrations.AddConstraint(
                    model_name="session",
                    constraint=models.UniqueConstraint(
                        fields=["user", "session_uuid"],
                        name="unique_session_uuid_per_user",
                    ),
                )
            ],
        ),
    ]

