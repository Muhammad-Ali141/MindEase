from django.urls import path
from . import views

urlpatterns = [
    path("register/", views.register, name="register"),
    path("login/", views.login, name="login"),
    path("check-email/", views.check_email, name="check_email"),
    path("send-otp/", views.send_otp, name="send_otp"),
    path("verify-otp/", views.verify_otp, name="verify_otp"),
    path("chat/", views.chat_message, name="chat_message"),
    path("chat/welcome/", views.chat_welcome, name="chat_welcome"),
    path("chat/summary/", views.chat_summary, name="chat_summary"),
    path("sessions/count/", views.get_session_count, name="get_session_count"),
    path("sessions/increment/", views.increment_session_count, name="increment_session_count"),
    path("sessions/save/", views.save_session, name="save_session"),
    path("sessions/recent/", views.get_recent_sessions, name="get_recent_sessions"),
    path("sessions/get/", views.get_session_by_id, name="get_session_by_id"),
    path("profile/get/", views.get_user_profile, name="get_user_profile"),
    path("profile/update/", views.update_user_profile, name="update_user_profile"),
]
