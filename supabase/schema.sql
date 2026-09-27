-- ILAAURA Launch Board: Supabase schema.
-- Paste into Supabase → SQL Editor → New query, and run. Safe to re-run.

-- Who may see and edit the board. Add rows with:
--   insert into public.board_members (email) values ('you@example.com');
create table if not exists public.board_members (
  email text primary key
);

create table if not exists public.tasks (
  id   text primary key default gen_random_uuid()::text,
  t    text not null check (char_length(t) between 1 and 200),   -- title
  c    text not null default 'Other' check (char_length(c) <= 60), -- area
  o    text not null default '' check (char_length(o) <= 40),      -- owner
  d    text not null default '',                                   -- due date, YYYY-MM-DD or ''
  s    text not null default 'todo' check (s in ('todo','doing','blocked','done')),
  p    text not null default 'med'  check (p in ('high','med','low')),
  crit boolean not null default false,                             -- critical path
  n    text not null default '' check (char_length(n) <= 1000),    -- notes
  u    bigint                                                      -- last updated, ms since epoch
);

-- Membership check used by every policy. security definer so it can read
-- board_members regardless of that table's own policies.
create or replace function public.is_board_member()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.board_members
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

alter table public.board_members enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "read own membership" on public.board_members;
create policy "read own membership" on public.board_members
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "members read"   on public.tasks;
drop policy if exists "members insert" on public.tasks;
drop policy if exists "members update" on public.tasks;
drop policy if exists "members delete" on public.tasks;
create policy "members read"   on public.tasks for select to authenticated using (public.is_board_member());
create policy "members insert" on public.tasks for insert to authenticated with check (public.is_board_member());
create policy "members update" on public.tasks for update to authenticated using (public.is_board_member()) with check (public.is_board_member());
create policy "members delete" on public.tasks for delete to authenticated using (public.is_board_member());

-- Live updates between browsers.
do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null;
end $$;
