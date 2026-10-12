-- Stable per-browser player id on runs, so two players with the same display name stay separate on the leaderboard.
-- Existing grants (grant select on public.runs) cover the new column; realtime needs no change.
alter table public.runs add column if not exists player_id text check (player_id is null or char_length(player_id) between 1 and 64);
