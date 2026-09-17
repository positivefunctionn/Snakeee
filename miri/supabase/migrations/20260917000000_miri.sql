-- Mìrì private diary schema. Run in Supabase SQL Editor or with the Supabase CLI.
create extension if not exists pgcrypto;

create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, email text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.diary_entries (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 entry_date date not null, title text not null default '', content text not null default '', mood text, mood_note text, thoughts text,
 gratitude_1 text, gratitude_2 text, gratitude_3 text, best_moment text, hardest_moment text, weather text, location text, food text, study_work text,
 important boolean not null default false, important_title text, important_description text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,entry_date),
 constraint valid_mood check (mood is null or mood in ('Happy','Loved','Peaceful','Normal','Sad','Angry','Emotional','Tired','Excited','Overwhelmed'))
);
create table public.photos (id uuid primary key default gen_random_uuid(), entry_id uuid not null references public.diary_entries(id) on delete cascade, user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, storage_path text not null unique, caption text, display_order integer not null default 0, created_at timestamptz not null default now());
create table public.songs (id uuid primary key default gen_random_uuid(), entry_id uuid not null unique references public.diary_entries(id) on delete cascade, user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, title text not null, artist text, album text, cover_url text, spotify_url text, youtube_url text, note text, created_at timestamptz not null default now(), constraint song_urls check ((spotify_url is null or spotify_url ~* '^https://') and (youtube_url is null or youtube_url ~* '^https://')));
create table public.diary_people (id uuid primary key default gen_random_uuid(), entry_id uuid not null references public.diary_entries(id) on delete cascade, user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, name text not null);
create table public.diary_tags (id uuid primary key default gen_random_uuid(), entry_id uuid not null references public.diary_entries(id) on delete cascade, user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, tag text not null);
create table public.tomorrow_tasks (id uuid primary key default gen_random_uuid(), entry_id uuid not null references public.diary_entries(id) on delete cascade, user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, task text not null, completed boolean not null default false, created_at timestamptz not null default now());
create index diary_entries_user_date_idx on public.diary_entries(user_id,entry_date desc); create index photos_user_created_idx on public.photos(user_id,created_at desc); create index tags_user_tag_idx on public.diary_tags(user_id,tag); create index people_user_name_idx on public.diary_people(user_id,name);

create or replace function public.set_updated_at() returns trigger language plpgsql security invoker as $$ begin new.updated_at=now(); return new; end; $$;
create trigger diary_entries_updated before update on public.diary_entries for each row execute procedure public.set_updated_at();
create trigger profiles_updated before update on public.profiles for each row execute procedure public.set_updated_at();
create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,email) values(new.id,new.email) on conflict(id) do update set email=excluded.email; return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.create_profile();

alter table public.profiles enable row level security; alter table public.diary_entries enable row level security; alter table public.photos enable row level security; alter table public.songs enable row level security; alter table public.diary_people enable row level security; alter table public.diary_tags enable row level security; alter table public.tomorrow_tasks enable row level security;
create policy "own profile" on public.profiles for all to authenticated using (id=auth.uid()) with check(id=auth.uid());
create policy "own diary" on public.diary_entries for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "own photos" on public.photos for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and exists(select 1 from public.diary_entries e where e.id=entry_id and e.user_id=auth.uid()));
create policy "own songs" on public.songs for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and exists(select 1 from public.diary_entries e where e.id=entry_id and e.user_id=auth.uid()));
create policy "own people" on public.diary_people for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and exists(select 1 from public.diary_entries e where e.id=entry_id and e.user_id=auth.uid()));
create policy "own tags" on public.diary_tags for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and exists(select 1 from public.diary_entries e where e.id=entry_id and e.user_id=auth.uid()));
create policy "own tasks" on public.tomorrow_tasks for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and exists(select 1 from public.diary_entries e where e.id=entry_id and e.user_id=auth.uid()));

-- Create a private bucket named diary-photos in the Storage dashboard (do not make it public).
-- Object paths must be user_id/entry_id/filename; these policies prevent cross-user access.
create policy "private photo select" on storage.objects for select to authenticated using (bucket_id='diary-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "private photo insert" on storage.objects for insert to authenticated with check (bucket_id='diary-photos' and (storage.foldername(name))[1]=auth.uid()::text and coalesce((metadata->>'size')::bigint,0) between 1 and 10485760 and coalesce(metadata->>'mimetype','') in ('image/jpeg','image/png','image/webp','image/gif'));
create policy "private photo update" on storage.objects for update to authenticated using (bucket_id='diary-photos' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='diary-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "private photo delete" on storage.objects for delete to authenticated using (bucket_id='diary-photos' and (storage.foldername(name))[1]=auth.uid()::text);
