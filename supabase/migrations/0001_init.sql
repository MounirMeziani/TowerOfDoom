-- Olsen Tower of Doom: sessions (workshop rooms) and runs (completed climbs).
-- Writes go through Next.js route handlers using the secret key; the browser only reads.
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{4,8}$'),
  name text not null default 'Tower Session' check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);
create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  session_code text references public.sessions(code) on delete set null,
  player_name text not null check (char_length(player_name) between 1 and 24),
  score integer not null check (score >= 0),
  floors_cleared integer not null check (floors_cleared >= 0),
  total_floors integer not null check (total_floors > 0),
  hearts_left integer not null check (hearts_left >= 0),
  duration_ms integer not null check (duration_ms >= 0),
  outcome text not null check (outcome in ('victory', 'doomed')),
  a_stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists runs_session_score_idx on public.runs (session_code, score desc);
create index if not exists runs_score_idx on public.runs (score desc);
alter table public.sessions enable row level security;
alter table public.runs enable row level security;
drop policy if exists "Anyone can read sessions" on public.sessions;
create policy "Anyone can read sessions" on public.sessions for select to anon, authenticated using (true);
drop policy if exists "Anyone can read runs" on public.runs;
create policy "Anyone can read runs" on public.runs for select to anon, authenticated using (true);
grant select on public.sessions, public.runs to anon, authenticated;
grant all on public.sessions, public.runs to service_role;
do $$ begin
  alter publication supabase_realtime add table public.runs;
exception when duplicate_object then null;
end $$;
