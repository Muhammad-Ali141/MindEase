# This is an auto-generated Django model module.
# You'll have to do the following manually to clean this up:
#   * Rearrange models' order
#   * Make sure each model has one field with primary_key=True
#   * Make sure each ForeignKey and OneToOneField has `on_delete` set to the desired behavior
#   * Remove `managed = False` lines if you wish to allow Django to create, modify, and delete the table
# Feel free to rename the models, but don't rename db_table values or field names.
from django.db import models


class Admin(models.Model):
    admin_id = models.AutoField(primary_key=True)
    email = models.CharField(unique=True, max_length=100)
    password = models.CharField(max_length=255)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    last_login = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'admin'


class Diagnostictest(models.Model):
    test_id = models.AutoField(primary_key=True)
    test_code = models.CharField(max_length=50)
    test_name = models.CharField(max_length=100)
    questions = models.TextField()

    class Meta:
        managed = False
        db_table = 'diagnostictest'


class Message(models.Model):
    message_id = models.AutoField(primary_key=True)
    session = models.ForeignKey('Session', models.DO_NOTHING)
    sender = models.CharField(max_length=4)
    content_type = models.CharField(max_length=5, blank=True, null=True)
    message_text = models.TextField(blank=True, null=True)
    audio_file_path = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'message'


class Session(models.Model):
    session_id = models.AutoField(primary_key=True)
    user = models.ForeignKey('User', models.DO_NOTHING)
    session_type = models.CharField(max_length=5, blank=True, null=True)
    emotional_tone = models.CharField(max_length=50, blank=True, null=True)
    started_at = models.DateTimeField(blank=True, null=True)
    ended_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'session'


class Summary(models.Model):
    summary_id = models.AutoField(primary_key=True)
    session = models.ForeignKey(Session, models.DO_NOTHING)
    keypoints = models.TextField()
    generated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'summary'


class Testresult(models.Model):
    result_id = models.AutoField(primary_key=True)
    test = models.ForeignKey(Diagnostictest, models.DO_NOTHING)
    user = models.ForeignKey('User', models.DO_NOTHING)
    score = models.IntegerField()
    severity_level = models.CharField(max_length=16, blank=True, null=True)
    taken_at = models.DateTimeField(blank=True, null=True)
    user_responses = models.CharField(max_length=50, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'testresult'


class Therapistdirectory(models.Model):
    therapist_id = models.AutoField(primary_key=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'therapistdirectory'


class User(models.Model):
    user_id = models.AutoField(primary_key=True)
    email = models.CharField(unique=True, max_length=100)
    password = models.CharField(max_length=255)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    dob = models.DateField()
    gender = models.CharField(max_length=6, blank=True, null=True)
    lang_pref = models.CharField(max_length=7, blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'user'
