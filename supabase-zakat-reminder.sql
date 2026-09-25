alter table public.gold_tracker
add column if not exists nisab_reached_date date,
add column if not exists zakat_reminder_enabled boolean not null default false;
