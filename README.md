# Olsen Tower of Doom

A fast, mobile-first browser game that teaches Olsen Consulting's **2 A's of Feedback**:
**Assist** + **Actionable** when giving feedback, **Appreciate** + **Accept or Decline** when receiving it.
Players climb a 12-floor office tower of feedback villains. Built for live workshops: a facilitator runs an
admin/host view (join code, QR, lobby, **Start the Climb**), players join on their phones, and a realtime leaderboard tracks the race.

See [PLAN.md](./PLAN.md) for the full game design, pages, backend and build plan.

## Stack
Next.js 16 (App Router, React Compiler), React 19, Tailwind CSS v4, TypeScript, Supabase (Postgres + Realtime),
Vercel AI SDK via AI Gateway, `motion`, `qrcode.react`, `zod`.

## Scripts
| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server on http://localhost:3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit -p .` | Type-check |

## Environment variables
Put these in `.env.local` (never commit it):

| Variable | Used by | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser | Public (publishable) key for reads + Realtime |
| `SUPABASE_SECRET_KEY` | server only | Secret key used by route handlers for all writes |
| `AI_GATEWAY_API_KEY` (or Vercel OIDC on Vercel) | server only | Vercel AI Gateway for the boss-floor judge (falls back to a heuristic judge if missing) |

## Deploy
GitHub `MounirMeziani/TowerOfDoom` -> Vercel project `olsentowerofdoomtemp` -> https://olsentowerofdoomtemp.vercel.app
