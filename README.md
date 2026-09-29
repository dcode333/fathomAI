# Fathom AI — Demo Meeting Assistant

Demo-quality AI meeting assistant inspired by Fathom. Technical assessment build — not a production clone.

## Stack

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Supabase Auth + PostgreSQL
- LLM analysis (later phases)
- Google Meet + Demo Mode (same pipeline)

## Core pipeline

```text
Meeting Source (google_meet | demo)
  → Transcript
  → AI Analysis (structured JSON)
  → Meeting Intelligence Page
```

## Phase status

- [x] Phase 1 — Foundation (auth, schema, layout)
- [x] Phase 2 — Dashboard (meeting-first UI, cards, New Meeting)
- [x] Phase 3 — Meeting detail (Overview / Transcript / action items)
- [x] Phase 4 — Demo Meeting workflow
- [x] Phase 5 — AI analysis (OpenAI + local fallback)
- [x] Phase 6 — Ask AI
- [x] Phase 7 — Follow-up email
- [x] Phase 8 — Google Meet integration (OAuth + create Meet + paste transcript)
- [x] Phase 9 — Polish (in progress with integrations UX)

## Setup

1. Copy `.env.example` → `.env.local` and set Supabase URL + anon key
2. `npm install`
3. `npm run dev`
4. Open http://localhost:3000 → `/auth/login`

## Architecture

```text
src/
  app/
    auth/login | signup
    (app)/dashboard | meetings/[id] | settings/integrations
  components/
    auth/ layout/ ui/
  lib/
    supabase/ types/ ai/ google/ meetings/  (ai/google filled in later phases)
supabase/migrations/
```
