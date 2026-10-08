-- Cloud UKO demo trial system schema
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- after the project is created. Safe to re-run (uses IF NOT EXISTS / OR REPLACE).

-- One row per signed-up trial user. Linked 1:1 to Supabase's built-in
-- auth.users table, which handles the actual email/password.
create table if not exists public.trial_access (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique references auth.users(id) on delete cascade,
    business_name text,
    full_name text,
    trial_start timestamptz not null default now(),
    status text not null default 'trialing' check (status in ('trialing', 'active', 'expired', 'cancelled')),
    payfast_payment_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists trial_access_user_id_idx on public.trial_access(user_id);

-- Keep updated_at current on every change
create or replace function public.set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trial_access_set_updated_at on public.trial_access;
create trigger trial_access_set_updated_at
    before update on public.trial_access
    for each row execute function public.set_updated_at();

-- Row Level Security: a logged-in user can read and create their OWN
-- row, but can never update it themselves - status changes (trialing ->
-- active on payment, -> expired after 7 days) only ever happen via the
-- backend service using the service_role key, which bypasses RLS
-- entirely. This is what makes the trial clock tamper-proof: nothing
-- the browser does can flip its own status to "active".
alter table public.trial_access enable row level security;

drop policy if exists "Users can view their own trial row" on public.trial_access;
create policy "Users can view their own trial row"
    on public.trial_access for select
    using (auth.uid() = user_id);

drop policy if exists "Users can create their own trial row" on public.trial_access;
create policy "Users can create their own trial row"
    on public.trial_access for insert
    with check (auth.uid() = user_id);

-- Deliberately no UPDATE or DELETE policy for the `authenticated` role -
-- only the service_role key (used solely by the Render backend) can
-- change status or trial_start.

-- Convenience view: lets the frontend ask "am I still in my trial?"
-- with one query instead of computing the 7-day math client-side.
create or replace view public.trial_status as
select
    t.user_id,
    t.business_name,
    t.full_name,
    t.status,
    t.trial_start,
    (t.trial_start + interval '7 days') as trial_end,
    case
        when t.status = 'active' then true
        when t.status = 'trialing' and now() < (t.trial_start + interval '7 days') then true
        else false
    end as has_access,
    greatest(0, ceil(extract(epoch from ((t.trial_start + interval '7 days') - now())) / 86400)) as days_remaining
from public.trial_access t;

-- Views don't inherit RLS from their base table automatically in all
-- Postgres/Supabase versions, so lock this one down too.
alter view public.trial_status set (security_invoker = true);
