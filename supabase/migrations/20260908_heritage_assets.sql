-- Public image assets for heritage thumbnail and stamp UI.
-- Apply this after the base heritages table exists.
create table if not exists public.heritage_assets (
  id text primary key,
  thumbnail_image_url text,
  stamp_image_url text
);

alter table public.heritage_assets
  add column if not exists id text,
  add column if not exists thumbnail_image_url text,
  add column if not exists stamp_image_url text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'heritage_assets'
      and column_name = 'heritage_id'
  ) then
    execute 'update public.heritage_assets set id = heritage_id where id is null';
  end if;
end $$;

alter table public.heritage_assets
  drop column if exists heritage_id,
  drop column if exists detail_image_url,
  drop column if exists detail_image_alt,
  drop column if exists catalog_image_url,
  drop column if exists catalog_image_alt,
  drop column if exists stamp_paper_url,
  drop column if exists stamp_color,
  drop column if exists image_source,
  drop column if exists created_at,
  drop column if exists updated_at;

alter table public.heritage_assets enable row level security;

drop policy if exists "Public active heritage assets are readable" on public.heritage_assets;
create policy "Public active heritage assets are readable"
  on public.heritage_assets
  for select
  using (
    exists (
      select 1
      from public.heritages
      where heritages.id::text = heritage_assets.id
        and heritages.is_active is true
    )
  );
