from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def root_view(request):
    """Root endpoint to confirm API is running"""
    return JsonResponse({
        "message": "MindEase API is running",
        "endpoints": {
            "admin": "/admin/",
            "api": "/api/",
            "api_docs": "Available endpoints: /api/register/, /api/login/, /api/chat/, etc."
        }
    })

urlpatterns = [
    path('', root_view, name='root'),
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
]
