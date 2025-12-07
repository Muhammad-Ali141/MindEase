from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0012_user_diagnostic_fields"),
    ]

    operations = [
        # Alter user_responses column type
        migrations.RunSQL(
            sql='ALTER TABLE testresult ALTER COLUMN user_responses TYPE TEXT;',
            reverse_sql='ALTER TABLE testresult ALTER COLUMN user_responses TYPE VARCHAR(50);',
        ),
        # Add test_type column
        migrations.AddField(
            model_name="testresult",
            name="test_type",
            field=models.CharField(default="generic-screening", max_length=50),
            preserve_default=False,
        ),
        # Add domain_scores column
        migrations.AddField(
            model_name="testresult",
            name="domain_scores",
            field=models.JSONField(blank=True, null=True),
        ),
        # Make test_id nullable
        migrations.RunSQL(
            sql='ALTER TABLE testresult ALTER COLUMN test_id DROP NOT NULL;',
            reverse_sql='ALTER TABLE testresult ALTER COLUMN test_id SET NOT NULL;',
        ),
    ]

