-- Migration V6.3: Freundschafts-Anfragen
-- Nur noetig, wenn schema.sql schon VOR V6.3 ausgefuehrt wurde.
-- Im Supabase-Dashboard: SQL Editor -> New query -> einfuegen -> Run

drop policy if exists "friendships_read_own" on public.friendships;

create policy "friendships_read_own_or_incoming" on public.friendships
  for select using ((select auth.uid()) = user_id or (select auth.uid()) = friend_id);

create policy "friendships_delete_incoming" on public.friendships
  for delete using ((select auth.uid()) = friend_id);
