-- Waiting lobby: session lifecycle + host-only control, hero avatar on runs.
alter table public.sessions add column if not exists status text not null default 'lobby';
alter table public.sessions add column if not exists started_at timestamptz;
alter table public.sessions add column if not exists host_key text not null default encode(extensions.gen_random_bytes(16), 'hex');
do $$ begin
  alter table public.sessions add constraint sessions_status_check check (status in ('lobby', 'playing', 'ended'));
exception when duplicate_object then null;
end $$;
alter table public.runs add column if not exists avatar text check (avatar is null or char_length(avatar) <= 32);
-- host_key must never be readable by the public: replace the table-level select grant with column grants.
revoke select on public.sessions from anon, authenticated;
grant select (id, code, name, status, started_at, created_at) on public.sessions to anon, authenticated;
