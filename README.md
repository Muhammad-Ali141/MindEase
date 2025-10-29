<!-- Create virtual environment -->
python -m venv venv

<!-- Activate it -->
venv\Scripts\activate

<!-- Install Django and DRF -->
pip install django djangorestframework mysqlclient

<!-- Create backend project -->
django-admin startproject backend

<!-- Go inside backend folder -->
cd backend

<!-- Create API app -->
python manage.py startapp api

python manage.py runserver

<!-- install cors -->
pip install django-cors-headers

<!-- Connect to MySQL database
on cmd run:
login to MySQL -->
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p
enter password

<!-- show database exists or not -->
SHOW DATABASES;
USE mindease_db;

<!-- check whether is imports the same database or not -->
SHOW TABLES;

<!-- update backend/backend/settings.py, -->
set your MySQL password

<!-- Connect Django with MySQL -->
<!-- in project terminal, connect Django to mysql -->
python manage.py inspectdb
<!-- to store them in models.py -->
python manage.py inspectdb > api/models.py

<!-- Run backend -->
python manage.py runserver
<!-- Run frontend -->
npm run dev

<!-- Use JWT (JSON WEB TOKENS)
pip install djangorestframework djangorestframework-simplejwt -->

-> database connected with backend and frontend

<!-- Integrate frontend with backend -->
