## MindEase Git Push Workflow

Use this checklist whenever you are preparing to commit and push local work so the repo stays consistent with the version we pulled.

### 1. Confirm the project state

- Virtual env activated (`.\venv\Scripts\Activate.ps1`) and dependencies installed with `pip install -r backend\requirements.txt`.
- Backend settings now point to the shared PostgreSQL DB (`backend/backend/settings.py` reads env vars for `mentalhealthdb` / `postgres` / `admin123`) and rely on environment variables for secrets.
- PostgreSQL embeddings database populated via `python -m chatbot.build_database` (166k chunk pairs expected).
- Ollama model `llama3.1:8b` present (`ollama list`).

### 2. Run quick sanity checks

- Backend: `cd backend && python manage.py runserver` (ensure it starts and you can hit key endpoints).
- Optional: run targeted tests such as `python backend/chatbot/tests/test_phase1.py`.
- Verify no warnings about missing `.env`, dataset, or model weights.

### 3. Audit tracked vs ignored files

- `git status` — working tree must be clean or only show intentional changes.
- `git status --ignored` — make sure `.env`, `dataset/MentalChat16K.csv`, `deberta_best/model.safetensors`, `venv/`, `.next/`, etc. stay ignored.
- Spot-check for secrets or large binaries:
  ```bash
  git diff --stat
  find . -type f -size +10M -not -path "./.git/*" | xargs git check-ignore
  ```

### 4. Stage & commit

- Stage each logical change:
  ```bash
  git add <files>
  git status
  ```
- Use clear commit messages (e.g. `git commit -m "feat: add session analytics endpoint"`).
- If you need to abandon edits, `git checkout -- <file>` or `git reset --hard` (only when you are sure).

### 5. Push

- Ensure you are on the correct branch (`git branch` → typically `main`).
- `git pull --rebase` to pick up remote updates, resolve conflicts if prompted.
- `git push origin <branch>` once commits are ready.

### 6. Post-push verification

- Optionally clone the repo into a temp folder and run `SETUP_FOR_PARTNER.md` steps to ensure teammates can reproduce the environment.
- Update documentation (`SETUP_FOR_PARTNER.md`, `SESSION_TRACKING_IMPLEMENTATION.md`, etc.) when behaviour changes so the repo remains self-contained.

### Notes

- Never commit `.env` or production credentials; rely on `env.example` for templates.
- Large assets (dataset, model weights) must remain outside Git—share them through secure storage when needed.
- If you experiment with alternative database backends locally, revert settings to the shared PostgreSQL baseline before pushing.
