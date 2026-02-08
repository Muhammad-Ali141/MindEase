# This is an auto-generated Django model module.
# You'll have to do the following manually to clean this up:
#   * Rearrange models' order
#   * Make sure each model has one field with primary_key=True
#   * Make sure each ForeignKey and OneToOneField has `on_delete` set to the desired behavior
#   * Remove `managed = False` lines if you wish to allow Django to create, modify, and delete the table
# Feel free to rename the models, but don't rename db_table values or field names.
import uuid

from django.db import models
from django.utils import timezone


class Admin(models.Model):
    admin_id = models.AutoField(primary_key=True)
    email = models.CharField(max_length=100, unique=True)
    password = models.CharField(max_length=255)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = 'admin'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name or ''}".strip()


class Diagnostictest(models.Model):
    test_id = models.AutoField(primary_key=True)
    test_code = models.CharField(max_length=50)
    test_name = models.CharField(max_length=100)
    questions = models.TextField()

    class Meta:
        db_table = 'diagnostictest'
        ordering = ['test_name']

    def __str__(self) -> str:
        return self.test_name


class User(models.Model):
    class Gender(models.TextChoices):
        MALE = 'Male', 'Male'
        FEMALE = 'Female', 'Female'
        OTHER = 'Other', 'Other'

    class Language(models.TextChoices):
        ENGLISH = 'English', 'English'
        URDU = 'Urdu', 'Urdu'

    user_id = models.AutoField(primary_key=True)
    email = models.CharField(max_length=100, unique=True)
    password = models.CharField(max_length=255)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    dob = models.DateField()
    gender = models.CharField(max_length=6, choices=Gender.choices, default=Gender.OTHER)
    lang_pref = models.CharField(max_length=7, choices=Language.choices, default=Language.ENGLISH)
    city = models.CharField(max_length=100, blank=True, null=True)
    nearest_major_city = models.CharField(max_length=100, blank=True, null=True)
    dashboard_tour_seen = models.BooleanField(default=False)
    primary_condition = models.CharField(max_length=20, blank=True, null=True)
    generic_screening_completed = models.BooleanField(default=False)
    last_test_date = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user'
        ordering = ['email']

    def __str__(self) -> str:
        return self.email


class Session(models.Model):
    class SessionState(models.TextChoices):
        FULL = 'full', 'Full Transcript'
        PENDING_ARCHIVE = 'pending_archive', 'Pending Archive'
        SUMMARY_ONLY = 'summary_only', 'Summary Only'

    session_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    session_uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    title = models.CharField(max_length=150, blank=True, default='')
    short_summary = models.TextField(blank=True, default='')
    full_summary = models.TextField(blank=True, default='')
    state = models.CharField(max_length=20, choices=SessionState.choices, default=SessionState.FULL)
    is_starred = models.BooleanField(default=False)
    archived_at = models.DateTimeField(blank=True, null=True)
    continuation_context = models.JSONField(blank=True, null=True, default=dict)
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    resume_message = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'session'
        ordering = ['-started_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'session_uuid'],
                name='unique_session_uuid_per_user',
            )
        ]

    def __str__(self) -> str:
        return f"Session #{self.pk} ({self.user.email})"


class Message(models.Model):
    class Sender(models.TextChoices):
        USER = 'user', 'User'
        AI = 'ai', 'AI'

    class ContentType(models.TextChoices):
        TEXT = 'text', 'Text'
        AUDIO = 'audio', 'Audio'

    message_id = models.AutoField(primary_key=True)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='messages')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='messages')
    sender = models.CharField(max_length=4, choices=Sender.choices)
    content_type = models.CharField(max_length=5, choices=ContentType.choices, default=ContentType.TEXT)
    sequence = models.PositiveIntegerField(null=True, blank=True)
    content = models.TextField(blank=True, null=True)
    emotion_label = models.CharField(max_length=50, blank=True, null=True)
    emotion_score = models.FloatField(blank=True, null=True)
    metadata = models.JSONField(blank=True, default=dict)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'message'
        ordering = ['sequence']
        constraints = [
            models.UniqueConstraint(
                fields=['session', 'sequence'],
                name='unique_message_sequence_per_session',
                condition=models.Q(sequence__isnull=False)
            )
        ]

    def __str__(self) -> str:
        return f"{self.get_sender_display()} message in session {self.session_id}"


class Summary(models.Model):
    class SummaryType(models.TextChoices):
        FULL = 'full', 'Full'
        SHORT = 'short', 'Short'
        ARCHIVE = 'archive', 'Archive'

    summary_id = models.AutoField(primary_key=True)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='summaries')
    type = models.CharField(max_length=20, choices=SummaryType.choices, default=SummaryType.FULL)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'summary'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"Summary for session {self.session_id}"


class Testresult(models.Model):
    class Severity(models.TextChoices):
        MINIMAL = 'minimal', 'Minimal'
        MILD = 'mild', 'Mild'
        MODERATE = 'moderate', 'Moderate'
        SEVERE = 'severe', 'Severe'
        EXTREMELY_SEVERE = 'extremely severe', 'Extremely Severe'

    result_id = models.AutoField(primary_key=True)
    test = models.ForeignKey(Diagnostictest, on_delete=models.CASCADE, related_name='results', blank=True, null=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='test_results')
    test_type = models.CharField(max_length=50)
    score = models.IntegerField()
    severity_level = models.CharField(
        max_length=20,
        choices=Severity.choices,
        default=Severity.MINIMAL
    )
    taken_at = models.DateTimeField(default=timezone.now)
    user_responses = models.TextField(blank=True, null=True)
    domain_scores = models.JSONField(blank=True, null=True)

    class Meta:
        db_table = 'testresult'
        ordering = ['-taken_at']

    def __str__(self) -> str:
        return f"Result {self.pk} for {self.user.email}"


class Therapistdirectory(models.Model):
    class Source(models.TextChoices):
        NPI = "npi", "NPI Registry (US)"
        IMPORT = "import", "Imported (scraped/JSON)"
        MANUAL = "manual", "Manual"

    therapist_id = models.AutoField(primary_key=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    # Extended fields for directory display and filtering
    credentials = models.CharField(max_length=200, blank=True, null=True)
    specialty = models.CharField(max_length=200, blank=True, null=True)
    region = models.CharField(max_length=100, blank=True, null=True)
    email = models.CharField(max_length=255, blank=True, null=True)
    website = models.URLField(max_length=500, blank=True, null=True)
    languages = models.CharField(max_length=255, blank=True, null=True)  # e.g. "Urdu, English"
    source = models.CharField(
        max_length=20, choices=Source.choices, default=Source.MANUAL, blank=True
    )
    external_id = models.CharField(
        max_length=50, blank=True, null=True, unique=True
    )  # e.g. NPI number for dedup
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = "therapistdirectory"
        ordering = ["first_name", "last_name"]

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name or ''}".strip()


class EmailVerification(models.Model):
    user_email = models.CharField(max_length=100, db_column='user_email')
    otp_code = models.CharField(max_length=6, db_column='otp_code')
    created_at = models.DateTimeField(auto_now_add=True, db_column='created_at')
    is_verified = models.BooleanField(default=False, db_column='is_verified')

    class Meta:
        db_table = 'emailverification'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"{self.user_email} ({'verified' if self.is_verified else 'pending'})"


class SessionArchiveJob(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    job_id = models.AutoField(primary_key=True)
    session = models.OneToOneField(Session, on_delete=models.CASCADE, related_name='archive_job')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveIntegerField(default=0)
    scheduled_at = models.DateTimeField(default=timezone.now)
    last_error = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'session_archive_job'
        ordering = ['status', '-scheduled_at']

    def __str__(self) -> str:
        return f"Archive job for session {self.session.session_id} ({self.status})"
