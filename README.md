# Session Notes Assistant — Clinical Psychology

Prototype from the DigiHealthDays 2026 hackathon.

**Problem:** Psychologists at a university hospital spend a lot of time writing summaries of their patient sessions.
**Idea:** The psychologist writes only a few keywords — an AI drafts the structured session summary, which she reviews, edits and signs off.

## Features
- Keyword input plus session details (pseudonym, date, session no., setting)
- Output format: structured session note *or* report letter to the referring physician
- Output language: German or English
- Draft split into sections (reason for session, mental status, content, interventions, risk assessment, plan) — every section editable
- "Please check" list: the AI flags missing or unclear information instead of inventing it
- One-click copy into the patient record; nothing is stored

> Prototype only. Use synthetic data — never real patient data. AI output is a draft and must be reviewed by the clinician.

## Run locally
```bash
npm install --prefix backend && npm install --prefix frontend
npm run build --prefix frontend
MGA_API_KEY=<your-key> node backend/server.js   # -> http://localhost:3000
```
Optional `APP_PASSWORD=<pw>` enables a login prompt (password only, username is ignored).

## Deploy
`render.yaml` describes a single Render web service. `MGA_API_KEY` and `APP_PASSWORD` are entered in the Render dashboard — they are never stored in this repository.
