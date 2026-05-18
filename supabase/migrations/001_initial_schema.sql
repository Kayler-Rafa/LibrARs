-- Fase 5: Schema inicial do Libras AR
-- Executar no SQL Editor do Supabase

-- Habilitar extensão UUID
create extension if not exists "pgcrypto";

-- Perfis de usuário
create table if not exists profiles (
  id uuid references auth.users primary key,
  username text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Gestos por usuário
create table if not exists gestures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  samples jsonb not null,      -- array de vetores 63-dim
  sample_count int,
  is_public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Coleções públicas de gestos
create table if not exists gesture_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  title text not null,
  description text,
  gesture_ids uuid[],
  downloads int default 0,
  created_at timestamptz default now()
);

-- RLS: habilitar em todas as tabelas
alter table profiles enable row level security;
alter table gestures enable row level security;
alter table gesture_packs enable row level security;

-- Policies: profiles
create policy "Usuário vê só seu próprio perfil"
  on profiles for select using (auth.uid() = id);

create policy "Usuário edita só seu próprio perfil"
  on profiles for update using (auth.uid() = id);

create policy "Usuário cria seu próprio perfil"
  on profiles for insert with check (auth.uid() = id);

-- Policies: gestures
create policy "Usuário gerencia seus próprios gestos"
  on gestures for all using (auth.uid() = user_id);

create policy "Gestos públicos visíveis a todos"
  on gestures for select using (is_public = true);

-- Policies: gesture_packs
create policy "Usuário gerencia seus packs"
  on gesture_packs for all using (auth.uid() = user_id);

create policy "Packs de qualquer usuário visíveis a todos"
  on gesture_packs for select using (true);

-- Trigger: criar perfil automaticamente ao cadastrar
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
