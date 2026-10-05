-- Read-only: inspect actual database settings before applying the hardening migration.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('docent_templates', 'heritage_docents', 'docent_topics', 'docent_scenes');

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('docent_templates', 'heritage_docents', 'docent_topics', 'docent_scenes');

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
  and table_name in ('docent_templates', 'heritage_docents', 'docent_topics', 'docent_scenes');

select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('public.heritage_docents'::regclass, 'public.docent_topics'::regclass, 'public.docent_scenes'::regclass);

select tablename, indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename in ('heritage_docents', 'docent_topics', 'docent_scenes');

-- These three result sets should be empty before applying the migration.
select heritage_id, sort_order, count(*) from public.docent_topics
group by heritage_id, sort_order having count(*) > 1;
select topic_id, sort_order, count(*) from public.docent_scenes
group by topic_id, sort_order having count(*) > 1;
select heritage_id from public.heritage_docents
where jsonb_typeof(return_transition) <> 'object';
