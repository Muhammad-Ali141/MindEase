from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0007_session_schema_overhaul"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='ALTER TABLE "message" ADD COLUMN IF NOT EXISTS user_id INTEGER;',
                    reverse_sql='ALTER TABLE "message" DROP COLUMN IF EXISTS user_id;',
                ),
                migrations.RunSQL(
                    sql=(
                        'UPDATE "message" AS m '
                        'SET user_id = s.user_id '
                        'FROM "session" AS s '
                        'WHERE m.session_id = s.session_id '
                        'AND m.user_id IS NULL;'
                    ),
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "message" ALTER COLUMN user_id SET NOT NULL;',
                    reverse_sql='ALTER TABLE "message" ALTER COLUMN user_id DROP NOT NULL;',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "message" DROP CONSTRAINT IF EXISTS message_user_fk;',
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    sql=(
                        'ALTER TABLE "message" '
                        'ADD CONSTRAINT message_user_fk '
                        'FOREIGN KEY (user_id) REFERENCES "user"(user_id) '
                        'ON DELETE CASCADE;'
                    ),
                    reverse_sql='ALTER TABLE "message" DROP CONSTRAINT IF EXISTS message_user_fk;',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "message" DROP COLUMN IF EXISTS audio_file_path;',
                    reverse_sql='ALTER TABLE "message" ADD COLUMN audio_file_path VARCHAR(255);',
                ),
                migrations.RunSQL(
                    sql=(
                        "SELECT setval("
                        "  'session_session_id_seq',"
                        "  COALESCE((SELECT MAX(session_id) FROM \"session\"), 0) + 1,"
                        "  false"
                        ");"
                    ),
                    reverse_sql=(
                        "SELECT setval("
                        "  'session_session_id_seq',"
                        "  COALESCE((SELECT MAX(session_id) FROM \"session\"), 0) + 1,"
                        "  false"
                        ");"
                    ),
                ),
                migrations.RunSQL(
                    sql=(
                        "SELECT setval("
                        "  'message_message_id_seq',"
                        "  COALESCE((SELECT MAX(message_id) FROM \"message\"), 0) + 1,"
                        "  false"
                        ");"
                    ),
                    reverse_sql=(
                        "SELECT setval("
                        "  'message_message_id_seq',"
                        "  COALESCE((SELECT MAX(message_id) FROM \"message\"), 0) + 1,"
                        "  false"
                        ");"
                    ),
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="message",
                    name="user",
                    field=models.ForeignKey(
                        on_delete=models.CASCADE,
                        related_name="messages",
                        to="api.user",
                    ),
                ),
                migrations.RemoveField(
                    model_name="message",
                    name="audio_file_path",
                ),
            ],
        ),
    ]

