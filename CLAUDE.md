# CLAUDE.md — MindEase

## Project Overview
MindEase is a bilingual (English + Urdu) mental health platform — FYP. Features: AI therapy chat (text + voice), clinical diagnostic tests (PHQ-9 style), therapist directory, session memory, mood tracking.

## Architecture
- **Frontend:** Next.js 14 App Router + TypeScript + Tailwind v4. Entry: `app/` (routes: `page.tsx` landing, `(auth)/auth`, `chat`, `voice-chat`, `dashboard`, `sessions`, `profile`, `diagnostic-test/[testType]`). Shared UI in `components/` (Radix primitives under `components/ui/`). API client: `lib/api.ts` → `http://127.0.0.1:8000/api`. i18n: `lib/i18n.ts`. Auth: Clerk (Google OAuth) + custom backend JWT.
- **Backend:** Django in `backend/` (app `api/` = REST views+models+services; project config in `backend/backend/`). SQLite (`db.sqlite3`). Endpoints cover auth/OTP, chat (+stream), voice, sessions, profile, therapists, STT, TTS, diagnostic tests (see `backend/api/urls.py`).
- **AI pipeline (`backend/chatbot/`):** RAG over PostgreSQL+pgvector (`rag_system_postgres.py`), LLM client (`llm_client.py`), conversation memory, text + audio emotion detection, Urdu Qwen chat (`urdu_qwen_chat.py`, `urdu_chat_pipeline.py`), Roman Urdu system prompt.
- **Speech:** English STT/TTS in `backend/stt/`, `backend/tts/` (Qwen3 TTS adapter). Urdu STT in `backend/urdu_stt/` + fine-tuned model at `finetuned_urdu_whisper/`. DeBERTa emotion model at `deberta_best/`.
- **Other:** `scraper/` (therapist data), `dataset/`, `experiments/`, `n8n/`, `refrences/`, `docs/`, `fyp.sql`, Jupyter `abc1.ipynb`.

## Running
- Frontend: `pnpm dev` (or `npm run dev`) — Next on :3000, Turbo enabled.
- Backend: `cd backend && python manage.py runserver` — Django on :8000. Python venv at `backend/venv/` or root `venv/`.
- Static landing mockup server: `node serve.mjs` (only when iterating on standalone HTML).

## Key Conventions
- Animations: `framer-motion` (NOT `motion/react`). Animate only `transform`/`opacity`; never `transition-all`.
- Theming: CSS variables (`--primary` clay `#a67c52`, `--sage` `#5D8A6B`, etc.); dark mode via `.dark` on `<html>` + `next-themes`.
- Bilingual: `dir="rtl"` for Urdu.
- Never use default Tailwind blue/indigo as brand color.

---

# Frontend Website Rules

## Always Do First
- **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.

## Reference Images
- If a reference image is provided: match layout, spacing, typography, and color exactly. Swap in placeholder content (images via `https://placehold.co/`, generic copy). Do not improve or add to the design.
- If no reference image: design from scratch with high craft (see guardrails below).
- Screenshot your output, compare against reference, fix mismatches, re-screenshot. Do at least 2 comparison rounds. Stop only when no visible differences remain or user says so.

## Local Server
- **Always serve on localhost** — never screenshot a `file:///` URL.
- Start the dev server: `node serve.mjs` (serves the project root at `http://localhost:3000`)
- `serve.mjs` lives in the project root. Start it in the background before taking any screenshots.
- If the server is already running, do not start a second instance.

## Screenshot Workflow
- Puppeteer is installed at `C:/Users/Hasnain Ibrar Butt/AppData/Local/Temp/puppeteer-test/`. Chrome cache is at `C:/Users/Hasnain Ibrar Butt/.cache/puppeteer/`. 
- **Always screenshot from localhost:** `node screenshot.mjs http://localhost:3000`
- Screenshots are saved automatically to `./temporary screenshots/screenshot-N.png` (auto-incremented, never overwritten).
- Optional label suffix: `node screenshot.mjs http://localhost:3000 label` → saves as `screenshot-N-label.png`
- `screenshot.mjs` lives in the project root. Use it as-is.
- After screenshotting, read the PNG from `temporary screenshots/` with the Read tool — Claude can see and analyze the image directly.
- When comparing, be specific: "heading is 32px but reference shows ~24px", "card gap is 16px but should be 24px"
- Check: spacing/padding, font size/weight/line-height, colors (exact hex), alignment, border-radius, shadows, image sizing

## Output Defaults
- Single `index.html` file, all styles inline, unless user says otherwise
- Tailwind CSS via CDN: `<script src="https://cdn.tailwindcss.com"></script>`
- Placeholder images: `https://placehold.co/WIDTHxHEIGHT`
- Mobile-first responsive

## Brand Assets
- Always check the `brand_assets/` folder before designing. It may contain logos, color guides, style guides, or images.
- If assets exist there, use them. Do not use placeholders where real assets are available.
- If a logo is present, use it. If a color palette is defined, use those exact values — do not invent brand colors.

## Anti-Generic Guardrails
- **Colors:** Never use default Tailwind palette (indigo-500, blue-600, etc.). Pick a custom brand color and derive from it.
- **Shadows:** Never use flat `shadow-md`. Use layered, color-tinted shadows with low opacity.
- **Typography:** Never use the same font for headings and body. Pair a display/serif with a clean sans. Apply tight tracking (`-0.03em`) on large headings, generous line-height (`1.7`) on body.
- **Gradients:** Layer multiple radial gradients. Add grain/texture via SVG noise filter for depth.
- **Animations:** Only animate `transform` and `opacity`. Never `transition-all`. Use spring-style easing.
- **Interactive states:** Every clickable element needs hover, focus-visible, and active states. No exceptions.
- **Images:** Add a gradient overlay (`bg-gradient-to-t from-black/60`) and a color treatment layer with `mix-blend-multiply`.
- **Spacing:** Use intentional, consistent spacing tokens — not random Tailwind steps.
- **Depth:** Surfaces should have a layering system (base → elevated → floating), not all sit at the same z-plane.

## Hard Rules
- Do not add sections, features, or content not in the reference
- Do not "improve" a reference design — match it
- Do not stop after one screenshot pass
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color