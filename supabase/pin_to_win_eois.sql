-- PIN TO WIN EOI capture table
-- Run in Supabase Dashboard > SQL Editor.

create table if not exists public.pin_to_win_eois (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  submitted_at timestamptz not null default now(),
  full_name text not null,
  email text,
  source_url text,
  user_agent text
);

alter table public.pin_to_win_eois enable row level security;

-- Browser/public roles cannot read or write this table.
revoke all on table public.pin_to_win_eois from anon, authenticated;

-- Vercel serverless functions use the Supabase secret/service key.
grant usage on schema public to service_role;
grant select, insert on table public.pin_to_win_eois to service_role;

create index if not exists pin_to_win_eois_submitted_at_idx
  on public.pin_to_win_eois (submitted_at desc);
