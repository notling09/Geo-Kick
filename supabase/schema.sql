-- Geo-Kick Friendlies: Datenbank-Schema fuer Supabase
-- Im Supabase-Dashboard: SQL Editor -> New query -> einfuegen -> Run

-- Ein Klub pro Account (id = auth-User). Der Kader liegt als JSON-Schnappschuss
-- der aktuellen Start-Elf drin, damit Freunde jederzeit dagegen spielen koennen.
create table public.clubs (
  id uuid primary key references auth.users (id) on delete cascade,
  friend_code text unique not null,
  club_name text not null,
  crest text not null default 'crest-0',
  division int not null default 4,
  strength int not null default 0,
  formation text not null default '4-4-2',
  squad jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table public.clubs enable row level security;

-- Jeder darf Klubs lesen (noetig, um Freunde per Code zu finden und ihre
-- Aufstellung fuer das Freundschaftsspiel zu laden)
create policy "clubs_read_all" on public.clubs
  for select using (true);

-- Schreiben darf jeder nur seinen eigenen Klub
create policy "clubs_insert_own" on public.clubs
  for insert with check ((select auth.uid()) = id);

create policy "clubs_update_own" on public.clubs
  for update using ((select auth.uid()) = id);

-- Freundschaften (V6.3: Anfrage-Modell). Eine Zeile A -> B bedeutet
-- "A hat B geaddet". Existieren beide Richtungen, sind A und B Freunde;
-- existiert nur A -> B, ist das eine offene Anfrage an B.
create table public.friendships (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references public.clubs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);

alter table public.friendships enable row level security;

-- Lesen: eigene Zeilen UND Zeilen, die auf mich zeigen (eingehende Anfragen)
create policy "friendships_read_own_or_incoming" on public.friendships
  for select using ((select auth.uid()) = user_id or (select auth.uid()) = friend_id);

create policy "friendships_insert_own" on public.friendships
  for insert with check ((select auth.uid()) = user_id and user_id != friend_id);

create policy "friendships_delete_own" on public.friendships
  for delete using ((select auth.uid()) = user_id);

-- Loeschen eingehender Zeilen: noetig zum Ablehnen einer Anfrage und um
-- sich beim Entfernen auch aus der Liste des anderen zu streichen
create policy "friendships_delete_incoming" on public.friendships
  for delete using ((select auth.uid()) = friend_id);
