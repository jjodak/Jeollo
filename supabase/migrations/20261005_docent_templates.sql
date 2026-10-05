begin;

create table if not exists public.docent_templates (
  id text primary key,
  name text not null,
  is_active boolean not null default true
);
insert into public.docent_templates (id, name) values ('template_1', 'Docent Template 1')
on conflict (id) do nothing;

create table if not exists public.heritage_docents (
  heritage_id text primary key references public.heritages(id) on delete cascade,
  template_id text not null references public.docent_templates(id),
  title text,
  subtitle text,
  background_url text,
  result_layers jsonb not null default '[]'::jsonb check (jsonb_typeof(result_layers) = 'array'),
  selection_layers jsonb not null default '[]'::jsonb check (jsonb_typeof(selection_layers) = 'array'),
  return_transition jsonb not null default '{"type":"smart","durationMs":200,"easing":"ease-in-out"}'::jsonb,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists public.docent_topics (
  id text primary key default gen_random_uuid()::text,
  heritage_id text not null references public.heritage_docents(heritage_id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  title text,
  subtitle text,
  script text,
  audio_url text,
  position jsonb not null default '{}'::jsonb check (jsonb_typeof(position) = 'object'),
  return_transition jsonb not null default '{}'::jsonb check (jsonb_typeof(return_transition) = 'object'),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  unique (heritage_id, sort_order)
);
create table if not exists public.docent_scenes (
  id text primary key default gen_random_uuid()::text,
  topic_id text not null references public.docent_topics(id) on delete cascade,
  title text,
  body text,
  audio_url text,
  layers jsonb not null default '[]'::jsonb check (jsonb_typeof(layers) = 'array'),
  advance text not null default 'click' check (advance in ('click', 'auto')),
  wait_ms integer not null default 0 check (wait_ms between 0 and 600000),
  transition jsonb not null default '{}'::jsonb check (jsonb_typeof(transition) = 'object'),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  unique (topic_id, sort_order)
);

alter table public.docent_templates enable row level security;
alter table public.heritage_docents enable row level security;
alter table public.docent_topics enable row level security;
alter table public.docent_scenes enable row level security;
grant select on public.docent_templates, public.heritage_docents, public.docent_topics, public.docent_scenes to anon, authenticated;
grant all on public.docent_templates, public.heritage_docents, public.docent_topics, public.docent_scenes to service_role;

drop policy if exists docent_templates_read on public.docent_templates;
create policy docent_templates_read on public.docent_templates for select to anon, authenticated using (is_active);
drop policy if exists heritage_docents_read on public.heritage_docents;
create policy heritage_docents_read on public.heritage_docents for select to anon, authenticated using (
  is_active and exists (select 1 from public.heritages h where h.id = heritage_id and h.is_active)
  and exists (select 1 from public.docent_templates t where t.id = template_id and t.is_active)
);
drop policy if exists docent_topics_read on public.docent_topics;
create policy docent_topics_read on public.docent_topics for select to anon, authenticated using (
  is_active and exists (select 1 from public.heritage_docents d where d.heritage_id = docent_topics.heritage_id)
);
drop policy if exists docent_scenes_read on public.docent_scenes;
create policy docent_scenes_read on public.docent_scenes for select to anon, authenticated using (
  is_active and exists (select 1 from public.docent_topics t where t.id = topic_id)
);
-- Administrators keep using the server service-role client; browsers cannot write.
commit;
