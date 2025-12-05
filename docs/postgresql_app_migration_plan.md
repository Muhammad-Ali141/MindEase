## PostgreSQL Unification Plan

Goal: move all application data currently living in MySQL (users, sessions, diagnostics, etc.) into the same PostgreSQL instance that already powers the RAG embeddings, so the entire platform runs on one database backend.

---

### 1. Current State Recap

- **MySQL** holds the legacy app tables accessed via `backend/api/models.py` (`user`, `session`, `message`, `summary`, `diagnostictest`, `testresult`, `therapistdirectory`, `admin`). Those models are marked `managed = False`, so Django treats them as existing external tables. Only `EmailVerification` is Django-managed.
- **PostgreSQL (`mentalhealthdb`)** already hosts the pgvector-enabled RAG schema (`input_chunks`, `output_chunks`) via `backend/chatbot/rag_system_postgres.py`.
- Django’s default database in `backend/backend/settings.py` points to MySQL, while the chatbot code (`chatbot/config.py`) reads PostgreSQL credentials from `.env`.
- **Session memory and chat transcripts are intentionally left in RAM only.** `ConversationMemory` in `backend/chatbot/conversation_memory.py` stores exchanges in process memory; `SESSION_COUNTS` and `USER_SESSIONS` in `backend/api/views.py` are in-memory placeholders. These will remain untouched during the migration and will be addressed only after the relational data is stable on PostgreSQL.

---

### 2. Target Architecture

1. A single PostgreSQL database (we can reuse `mentalhealthdb`) that stores:
   - Existing pgvector tables (`input_chunks`, `output_chunks`).
   - Application tables that currently live in MySQL.
   - **Session memory remains in RAM for now**; we will revisit persistent chat storage only after verifying the migration.
2. Django’s default connection will point to PostgreSQL; the chatbot config will share the same credentials to avoid duplicate settings.
3. Database migrations are managed by Django going forward (no more `managed = False` models).

---

### 3. Detailed Migration Plan

#### Phase A – Preparation & Inventory

1. **Snapshot current MySQL schema/data**
   - `mysqldump -u root -p mindease_db > backups/mysql_mindease_$(date +%Y%m%d).sql`
   - Capture table definitions:  
     `SHOW CREATE TABLE user;`, `SHOW CREATE TABLE session;`, etc. (keep for reference).
2. **Document foreign keys & indexes**  
   Verify expected relationships (`session.user_id`, `message.session_id`, etc.) and note missing constraints that should be enforced in PostgreSQL.
3. **Assess data quality**
   - Null fields, date formats, enum-like values (`gender`, `lang_pref`, `session_type`).
   - Record counts per table; keep for validation after migration.

#### Phase B – Design PostgreSQL schema

1. **Update Django models**
   - Convert `managed = False` models to normal Django models.
   - Add explicit `on_delete` behaviours (`models.CASCADE` or DO NOTHING where appropriate).
   - Consider splitting into dedicated apps/modules if needed (e.g. `accounts`, `therapy`).
   - Create new models for in-memory structures when we choose to persist them (e.g. `SessionHistory`, `ChatMessage`).
2. **Generate migrations**
   - With models updated, run `python manage.py makemigrations api`.
   - Adjust migration files to ensure correct column types (e.g. `AutoField`, `TextField`, `DateTimeField`), constraints, and indexes (`db_index=True`).
3. **Prepare PostgreSQL database**
   - Confirm pgvector extension enabled (`CREATE EXTENSION IF NOT EXISTS vector;`).
   - Decide on a clean schema (same `mentalhealthdb` database, or create fresh `mindease_app` and migrate RAG tables into it).
   - If using same DB, plan namespace separation as needed (optional `public` schema is sufficient if naming conflicts are resolved).

#### Phase C – Data Migration

1. **Provision blank tables in PostgreSQL**
   - Point Django settings to a temporary PostgreSQL URL.
   - Run `python manage.py migrate` to create tables defined by migrations.
2. **Transfer data**
   - Option A: use `pgloader` (handles MySQL → PostgreSQL direct migration, preserves types).
   - Option B: dump each table to CSV and use `psql \copy` or a custom Python script using Django ORM.
   - Respect foreign-key ordering (`user` → `session` → `message`, etc.).
3. **Validate**
   - Row counts match MySQL source.
   - Spot-check sample rows (dates, unicode).
   - Run integrity queries to ensure FK relationships hold.

#### Phase D – Application Updates

1. **Configuration**
   - Update `.env` files: set `DB_ENGINE=django.db.backends.postgresql`, align `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`.
   - Update `backend/backend/settings.py` to remove MySQL-specific options.
   - Ensure `chatbot/config.py` continues to read the same env vars.
2. **Code adjustments**
   - Remove MySQL-specific libraries (`mysqlclient`) from requirements if no longer needed.
   - Ensure `psycopg2-binary` (or `psycopg`) stays in requirements.
3. **Testing**
   - Run automated tests (`python manage.py test`, chatbot test suite).
   - Manual smoke tests: user registration, OTP flow, login, chat endpoints, RAG retrieval.
   - Confirm admin or analytics features behave as expected.

#### Phase E – Deployment & Cleanup

1. **Back up PostgreSQL after migration** (`pg_dump mentalhealthdb > backups/postgres_mindease_$(date +%Y%m%d).sql`).
2. **Remove MySQL dependencies**
   - Decommission local MySQL instance if no longer needed.
   - Remove MySQL service references from docs (`SETUP_FOR_PARTNER.md`, `GIT_PUSH_GUIDE.md`).
3. **Monitor**
   - Observe logs post-migration for any SQL errors.
   - Confirm performance of RAG queries remains acceptable with combined workload (tune indexes if necessary).

---

### 4. Follow-up Enhancements (Post-migration)

- **Persist conversation history**: move the in-memory `USER_SESSIONS` placeholder to actual tables (`SessionHistory`, `ChatTurn`) in PostgreSQL.
- **Use Django admin or API endpoints** for analytics (e.g., diagnostic test results, therapist directory).
- **Implement Alembic-like migrations** for vector index tuning if data grows.
- **Update CI/CD** to run migrations automatically and seed vector data when needed.

---

### 5. Next Steps Checklist

- [ ] Capture current MySQL schema and data statistics.
- [ ] Draft updated Django models (with `managed = True`, proper FKs).
- [ ] Decide on data transfer tool (pgloader vs. custom scripts).
- [ ] Create prototype migration in a scratch PostgreSQL database.
- [ ] Update configuration & documentation.
- [ ] Execute migration on development machine, run full regression tests.
- [ ] Roll out to production/staging as needed.
