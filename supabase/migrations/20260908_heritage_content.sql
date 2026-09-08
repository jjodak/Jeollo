-- Optional presentation content; existing heritage fields remain the source of truth.
alter table public.heritages
  add column if not exists content jsonb not null default '{}'::jsonb;
