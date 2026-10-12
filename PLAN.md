# Olsen Tower of Doom — Build Plan

## What it is
A fast, mobile-first browser game that teaches Olsen Consulting's **2 A's of Feedback**:
- **Giving feedback:** **Assist** (offer helpful, constructive ideas to support improvement instead of reacting from frustration or anger) and **Actionable** (clear, concrete steps the person can act on).
- **Receiving feedback:** **Appreciate** (say "thank you", even when it's uncomfortable or you disagree) and **Accept or Decline** (reflect, weigh its value, and make an autonomous choice about what to implement).

Players climb a 12-floor office tower overrun by feedback villains. Built for a live team workshop: a host projects a session code + QR, everyone plays on their phone, and a live leaderboard updates in real time.

## Game loop
- 12 floors per run: floors 1-5 and 7-11 are regular floors (alternating giving / receiving, drawn at random from a pool of 24), floor 6 is a **receiving boss**, floor 12 is a **giving boss**.
- Regular floor types: **choose** (pick the best response out of 3-4) and **spot** (read a quoted piece of feedback or reaction and identify which A it is missing, or whether it nails both).
- Boss floors: the player writes a free-text response; an AI judge (Vercel AI Gateway, with a deterministic heuristic fallback) scores each A from 0-2 and gives a short coaching tip; an exemplar answer is shown.
- 3 hearts. A wrong answer, a timeout (45s regular / 180s boss), or a failed boss costs a heart. 0 hearts = DOOMED. Surviving floor 12 = VICTORY.
- Scoring: 100 per correct answer + streak bonus (+25 per consecutive correct answer, capped at +100) + speed bonus (up to +50 if fast); boss: 75 per A-point + 100 if passed; victory: +150 per heart left. Max 3750.
- After every answer: a reveal panel explains why, with badges showing which A's were hit or missed.
- End screen: score, floors cleared, per-A mastery bars, your rank, and links to replay, view the leaderboard, or learn.

## Workshop flow: character creation + waiting lobby
1. The host opens `/host`, names the session, and gets `/host/[code]` in **LOBBY** state: a giant join code, a QR code for `/?s=CODE`, and a live grid of players as they join (hero avatar + name, with a pop-in animation and a "N heroes ready" count). The host is the only one who sees a **Start the Climb** button, which is protected by a secret host key stored in their browser.
2. A player scans the QR or clicks the link and lands on `/?s=CODE` with a "Joining session CODE" chip. They **create a character**: a name (1-24 characters) plus one of 8 office-adventurer heroes (emoji avatar, title, color, a one-line perk), with a live preview card. Then they enter the lobby.
3. `/lobby/[code]` is the **waiting room**. It shows "Waiting for the host to start the climb...", the player's own hero card, a live grid of everyone else in the lobby (Supabase Realtime Presence, with join/leave animations), the session name, a short rotating tip about the 2 A's, and a "Change hero" link. Players see each other appear in real time.
4. When the host presses Start, the session status changes to `playing` and every lobby client gets a countdown (3-2-1-CLIMB!) and is sent to `/play` at the same moment (realtime broadcast for an instant start, plus a 2s status poll as a fallback). Anyone who joins after the start skips the lobby and goes straight to `/play`.
5. During play, each player's presence updates with their floor, score and hearts, so the host view switches to a **live race** (everyone's hero climbing a tower graphic) next to the live leaderboard and team mastery. The host can End the session, which sets status `ended`.
6. Solo players with no session code skip the lobby: they create a character, then go straight to `/play`.
7. **Admin instance:** `/admin` (an alias of `/host`, labelled "Admin" in the nav) is where the facilitator creates and controls a session. Admin powers are Start the Climb, End session, and Reset to lobby (for a second round). They require the session's secret host key, which is saved in the creating browser. The admin view has a "Copy admin link" (`/host/CODE?k=HOSTKEY`) so the facilitator can run the controls from a phone or laptop while the projector shows the same page in spectator mode. Opening that link saves the key in that browser and strips it from the URL. Without the key, `/host/CODE` is a read-only spectator or projector view.

## Pages
- `/`: landing page with tower art and the character creator (name + hero picker, session code prefilled from `?s=CODE`). The button reads "Enter the Lobby" when there's a code and "Climb the Tower" otherwise.
- `/lobby/[code]`: the waiting room (see above).
- `/play`: the game. It shows the player's hero in the HUD. If the player's session is still in `lobby` status, they are redirected to the lobby.
- `/learn`: the 2 A's reference card with good and bad examples (printable).
- `/leaderboard` (`?s=CODE` optional): realtime top scores, global or per session.
- `/host`: create a session. `/host/[code]`: projector view. In LOBBY state it shows the join code, the QR code, the live player grid and the Start button. In PLAYING state it shows the live race, the live leaderboard, the player count and team mastery per A (the "team's weakest A"), plus an End button.

## Backend
- Supabase tables: `sessions(code, name, status lobby|playing|ended, started_at, host_key)` and `runs(player, avatar, score, floors, hearts, duration, outcome, a_stats jsonb, session_code)`. RLS: public read-only, and `host_key` is not readable by the public. All writes go through Next.js route handlers using the secret key. Realtime is on for `runs`. The lobby uses Realtime Presence + Broadcast on channel `lobby:CODE` and needs no tables.
- API routes: `POST /api/sessions` (returns hostKey), `GET /api/sessions/[code]`, `POST /api/sessions/[code]/start` and `/end` (require hostKey), `POST /api/runs` (zod validation, score clamped to MAX_SCORE, best-effort per-IP rate limit, returns rank), `POST /api/judge` (AI SDK + AI Gateway, prompt-injection-safe, with heuristic fallback).
- Deploy: GitHub `MounirMeziani/TowerOfDoom` -> Vercel project `olsentowerofdoomtemp` (team zune-labs) -> https://olsentowerofdoomtemp.vercel.app

## Build process (multi-agent workflow)
Foundation (3 parallel) -> Build (6 parallel: content, game, multiplayer/admin, lobby, landing/character, judge) -> Integrate -> Review (6 lenses + adversarial verification) -> Fix (parallel per area) -> Ship (deploy + production E2E).

