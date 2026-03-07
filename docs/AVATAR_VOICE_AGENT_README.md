# Avatar-Based Voice Agent — Flow & Setup Guide

This document describes the **end-to-end flow** for the avatar-based AI voice agent and the **step-by-step preparation** before integration: which tools to use, where to put them, and how to create the avatar. It does **not** cover implementation in code.

**Constraint:** Everything runs **locally** — no paid or cloud APIs for avatar or lip-sync.

---

## 1. High-Level Flow (What We’re Building Toward)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  USER                                                                        │
│  Speaks into mic                                                            │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STT (Speech-to-Text) — already in project                                  │
│  Transcribes user speech → text                                             │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LLM (Chat) — already in project                                            │
│  Produces assistant reply as text                                           │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  TTS (Text-to-Speech) — already in project                                  │
│  Converts reply text → audio (WAV)                                           │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────────────────┐
│  LIP-SYNC (Rhubarb)           │   │  FRONTEND                                 │
│  Input: same WAV               │   │  Plays audio; drives avatar with        │
│  Output: viseme timeline (JSON)│   │  viseme timeline → smooth mouth movement  │
└───────────────────────────────┘   └───────────────────────────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  AVATAR (3D or 2D)                                                           │
│  Renders on screen; mouth/face driven by visemes; smooth, local, no APIs   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Result:** User sees a talking avatar that speaks the AI’s reply with lip-sync, all running locally.

---

## 2. Flow Steps (Logical Order)

| Step | What happens | Who / Where |
|------|----------------|-------------|
| 1 | User speaks | Microphone (existing) |
| 2 | Speech → text | STT service (existing) |
| 3 | Text → AI reply | LLM / chat (existing) |
| 4 | Reply text → audio WAV | TTS service (existing) |
| 5 | Same WAV → viseme timeline | **Rhubarb Lip-Sync** (new, local) |
| 6 | Frontend receives: audio + viseme JSON | Backend response (to be added later) |
| 7 | Frontend plays audio and drives avatar | Avatar component (to be added later) |
| 8 | Avatar shows talking with lip-sync | 3D/2D viewer (Three.js or Lottie) |

Steps 1–4 already exist. Steps 5–8 are what we prepare for by **getting tools and making the avatar** first.

---

## 3. Tools to Get (Before Integration)

### 3.1 Lip-Sync: Rhubarb Lip-Sync

- **What it is:** Open-source tool that takes an **audio file** (and optional transcript) and outputs a **viseme timeline** (e.g. A, E, I, O, U with start/end times).
- **Why:** Local, no paid API, good quality, widely used for games and avatars.
- **Where to get it:**  
  - [Rhubarb Lip-Sync](https://github.com/DanielSWolf/rhubarb-lip-sync) (official C++ project; releases include executables).  
  - Or a **Python/JS wrapper** or **WASM build** if you prefer running it from Python (backend) or browser.
- **Where to put it in the project (suggested):**
  - **Option A (backend):** e.g. `backend/tools/rhubarb/` — place the Rhubarb executable (or wrapper script) here so the Django app can run it after TTS.
  - **Option B (static binary):** e.g. `tools/rhubarb/` at repo root — if you want a single place for dev tools and scripts.
- **Output you’ll use later:** A JSON (or similar) list of segments: `{ "viseme": "A", "start": 0.0, "end": 0.05 }`, etc. This will drive the avatar’s mouth.

**Preparation checklist:**

- [ ] Download or build Rhubarb Lip-Sync (executable or Python/WASM).
- [ ] Place it in a chosen directory (e.g. `backend/tools/rhubarb/` or `tools/rhubarb/`).
- [ ] Test from command line: input WAV + optional text → get viseme file/JSON.
- [ ] Document the exact command or API you’ll call (for later integration).

---

### 3.2 Avatar: 3D (Recommended) or 2D

**Option A — 3D avatar (best quality, smooth)**

- **Tools:**
  - **Blender** (free): Create or edit the character and add **viseme morph targets** (blend shapes) for mouth shapes (A, E, I, O, U, etc.).
  - **Export:** GLB (or GLTF) with morph targets.
- **Runtime (later, in the app):** Three.js + React Three Fiber (`@react-three/fiber`, `@react-three/drei`). No paid API; runs in the browser.
- **Where to put assets (suggested):**
  - `public/avatar/` or `assets/avatar/` — e.g. `therapist.glb`, and optionally a `README` listing which morph targets are used (e.g. `viseme_A`, `viseme_E`).

**Option B — 2D avatar (simpler assets)**

- **Tools:**
  - **Lottie:** Design in After Effects (or use a free Lottie character) with separate mouth/face layers or states.
  - Export as `.json` (Lottie).
- **Runtime (later):** Lottie Web player in React. Drive which “mouth” or state is visible based on viseme.
- **Where to put assets (suggested):**
  - `public/avatar/` or `assets/avatar/` — e.g. `therapist-lottie.json`.

**Preparation checklist (3D):**

- [ ] Install Blender.
- [ ] Create or obtain a rigged character (CC-0 or compatible license).
- [ ] Add viseme morph targets (mouth shapes) matching Rhubarb’s set (A, E, I, O, U, etc.).
- [ ] Export GLB; place in `public/avatar/` (or chosen folder).
- [ ] Note the exact morph target names for each viseme (for later integration).

**Preparation checklist (2D):**

- [ ] Create or obtain a Lottie character with mouth/expression layers.
- [ ] Map Rhubarb visemes to Lottie layers or animation states.
- [ ] Export JSON; place in `public/avatar/` (or chosen folder).

---

### 3.3 Frontend Runtime (No Setup in Directory Yet)

- **3D:** Later you will add `three`, `@react-three/fiber`, `@react-three/drei` via npm. No need to “put tools in a directory” — just dependency install before integration.
- **2D:** Lottie player library (e.g. `lottie-react` or `@lottiefiles/react-lottie-player`) — same idea, install when you implement.

So for **this phase**, you only ensure the **avatar asset** (GLB or Lottie JSON) lives in the repo (e.g. under `public/avatar/` or `assets/avatar/`).

---

## 4. Suggested Directory Layout (Before Integration)

Keep everything needed for the avatar and lip-sync in clear places:

```
MindEase/
├── backend/
│   └── tools/
│       └── rhubarb/              # Rhubarb executable or wrapper
│           ├── rhubarb (or .exe)
│           └── README.md          # How to run, input/output format
├── public/
│   └── avatar/                    # Avatar assets (served by Next.js)
│       ├── therapist.glb          # 3D model with visemes (or .json for Lottie)
│       └── README.md              # Morph target names / Lottie state mapping
├── tools/                         # (Optional) shared dev tools at repo root
│   └── rhubarb/
│       └── ...
└── docs/
    └── AVATAR_VOICE_AGENT_README.md   # This file
```

- **Rhubarb:** One canonical place (e.g. `backend/tools/rhubarb/` or `tools/rhubarb/`), documented so the backend (or a script) can run it.
- **Avatar:** One place (e.g. `public/avatar/`) so the app can load the same asset during integration.

---

## 5. Viseme Set (So Avatar and Rhubarb Match)

Rhubarb typically outputs a small set of mouth shapes. Your avatar (3D morph targets or 2D layers) should use the **same names** so the integration layer can map 1:1.

**Common Rhubarb-style set:**

- `A` — open (e.g. “ah”)
- `B` — closed / lips together (e.g. “m”, “b”, “p”)
- `C` — smile / “ee”
- `D` — “oh”
- `E` — “oo”
- `F` — “f”, “v”
- `G` — “th”
- `H` — neutral / rest

When you create the avatar, name your morph targets or Lottie states to match (e.g. `viseme_A`, `viseme_B`, …) so the future integration code can drive them without extra mapping logic.

---

## 6. Order of Work (Summary)

1. **Get Rhubarb**  
   Download/build, put in `backend/tools/rhubarb/` (or `tools/rhubarb/`), test CLI with a WAV, document input/output.

2. **Create the avatar**  
   - 3D: Blender → viseme morph targets → export GLB → put in `public/avatar/`.  
   - 2D: Lottie with mouth layers → export JSON → put in `public/avatar/`.

3. **Document**  
   - In `backend/tools/rhubarb/README.md` (or equivalent): how to run Rhubarb and the exact output format.  
   - In `public/avatar/README.md`: list of viseme names / morph targets or Lottie states.

4. **Later (integration phase)**  
   - Backend: after TTS, run Rhubarb on the WAV; return audio + viseme JSON.  
   - Frontend: play audio; drive avatar from viseme timeline (Three.js morph targets or Lottie).  
   - (Integration details will be in a separate implementation doc.)

---

## 7. What This README Does *Not* Cover

- Actual Django or Next.js code.
- How to run Rhubarb from Python or return visemes from an API.
- How to load the GLB or Lottie in React or update morph targets per frame.
- Microphone, STT, LLM, or TTS implementation (those already exist).

This file is only the **flow** and the **preparation steps**: getting the right tools into the directory and making the avatar so that integration can be done cleanly later.
