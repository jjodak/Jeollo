-- Existing-table upgrade; no content changes and no table recreation.
-- Run docent_schema_audit.sql first. Resolve duplicate order values or invalid
-- transition JSON deliberately; this migration never renumbers or replaces data.
begin;

do $$
declare
  item record;
  key_columns smallint[];
begin
  for item in select * from (values
    ('docent_topics', 'heritage_id', 'docent_topics_heritage_id_sort_order_key'),
    ('docent_scenes', 'topic_id', 'docent_scenes_topic_id_sort_order_key')
  ) as definitions(table_name, parent_column, constraint_name)
  loop
    select array_agg(attnum order by attnum) into key_columns
    from pg_attribute
    where attrelid = format('public.%I', item.table_name)::regclass
      and attname in (item.parent_column, 'sort_order') and not attisdropped;
    -- Recognize equivalent UNIQUE constraints even if an administrator renamed them.
    if not exists (
      select 1 from pg_constraint c
      where c.conrelid = format('public.%I', item.table_name)::regclass and c.contype = 'u'
        and c.conkey @> key_columns and c.conkey <@ key_columns
    ) then
      execute format('alter table public.%I add constraint %I unique (%I, sort_order)',
        item.table_name, item.constraint_name, item.parent_column);
    end if;
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.heritage_docents'::regclass
      and conname = 'heritage_docents_return_transition_object'
  ) then
    alter table public.heritage_docents
      add constraint heritage_docents_return_transition_object
      check (jsonb_typeof(return_transition) = 'object');
  end if;
end $$;

commit;
