# Urdu Text Chat Pipeline (Qwen-only)

Urdu text chat uses **only Qwen** (Alibaba Cloud Model Studio, `qwen3.5-122b-a10b`). No Qalb, no local LLM, no script conversion. Everything stays in **Roman Urdu** (Latin script).

## Overview

- **User**: Writes in Roman Urdu.
- **System prompt**: Full mental health companion instructions, stored in Roman Urdu (see below).
- **Model**: Alibaba `qwen3.5-122b-a10b` via OpenAI-compatible API.
- **Output**: Assistant reply in Roman Urdu; no transliteration step.

## Pipeline Flow

```
User message (Roman Urdu) → [system: Roman Urdu prompt] + [history] + [user]
    → Qwen API (qwen_chat) → Assistant reply (Roman Urdu) → User
```

- **Crisis**: If suicide/self-harm keywords are detected, a fixed Roman Urdu crisis message (with Pakistan helplines) is returned without calling the API.

## System Prompt (Roman Urdu)

- The **full English** mental health system prompt (therapy-only, boundaries, crisis, structured steps) is kept in code in `backend/chatbot/urdu_qwen_chat.py` as `SYSTEM_PROMPT_ENGLISH`.
- **First run (no file)**: The app calls Qwen once to translate that English prompt into Roman Urdu, then saves the result to:
  - **`backend/chatbot/system_prompt_roman_urdu.txt`**
- **Later runs**: If that file exists, its content is loaded and used as the system message. No translation is done on startup.
- **To avoid translating every time**: Create `backend/chatbot/system_prompt_roman_urdu.txt` yourself and paste the Roman Urdu system prompt into it. Then the server will never call Qwen for translation on startup.

## Implementation Files

- **`backend/chatbot/urdu_qwen_chat.py`** — Alibaba client, `SYSTEM_PROMPT_ENGLISH`, load/save `system_prompt_roman_urdu.txt`, `qwen_chat(messages, max_tokens=512, temperature=0.7)`, crisis response in Roman Urdu.
- **`backend/chatbot/urdu_chat_pipeline.py`** — Builds `[system, ...history, user]`, calls `qwen_chat`, returns assistant reply in Roman Urdu.
- **`backend/chatbot/chat.py`** — For `lang_pref` Urdu, calls `run_urdu_pipeline` (no RAG, no Qalb, no translator).

## Environment

In `backend/chatbot/.env` (or env):

```env
ALIBABA_API_KEY=sk-xxx
ALIBABA_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

If `ALIBABA_API_KEY` is not set, Urdu chat will fail (no fallback).

## No Fallbacks

There is no second model or transliteration step if Qwen fails; the call fails so issues are visible.

## Notes

- **English pipeline and voice chat** are unchanged.
- Urdu is **text chat only**; language is from the **user profile** (`lang_pref`).
