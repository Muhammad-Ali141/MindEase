from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0011_user_dashboard_tour_flag"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="primary_condition",
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="generic_screening_completed",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="user",
            name="last_test_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]

