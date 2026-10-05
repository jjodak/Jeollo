import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('docent hardening preserves data, restores missing ordering constraints and is repeatable', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create table heritages(id text primary key, is_active boolean default true);`);
    await db.exec(await readFile('supabase/migrations/20261005_docent_templates.sql', 'utf8'));
    await db.exec(`alter table docent_topics drop constraint docent_topics_heritage_id_sort_order_key;
      alter table docent_scenes drop constraint docent_scenes_topic_id_sort_order_key;
      insert into heritages values ('h', true);
      insert into heritage_docents(heritage_id,template_id) values ('h','template_1');
      insert into docent_topics(id,heritage_id,label) values ('t','h','질문');
      insert into docent_scenes(id,topic_id) values ('s','t');`);
    const sql = await readFile('supabase/migrations/20261005_docent_templates_hardening.sql', 'utf8');
    await db.exec(sql);
    await db.exec(`alter table docent_topics rename constraint docent_topics_heritage_id_sort_order_key to custom_topic_order;`);
    await db.exec(sql);
    assert.equal((await db.query(`select count(*)::int as count from pg_constraint
      where conrelid='docent_topics'::regclass and contype='u'`)).rows[0].count, 1);
    assert.deepEqual((await db.query('select id, label from docent_topics')).rows, [{ id: 't', label: '질문' }]);
    await assert.rejects(db.exec(`insert into docent_topics(heritage_id,label) values ('h','중복')`));
    await assert.rejects(db.exec(`insert into docent_scenes(topic_id) values ('t')`));
    await assert.rejects(db.exec(`update heritage_docents set return_transition='[]'`));
    await db.exec(`insert into docent_scenes(id,topic_id,sort_order) values ('s2','t',1)`);
    await db.exec(await readFile('supabase/docent_schema_audit.sql', 'utf8'));
  } finally { await db.close(); }
});

test('docent migration is repeatable and only active public content is readable', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create table heritages(id text primary key, is_active boolean default true);
      grant select on heritages to anon, authenticated;
      insert into heritages values ('visible',true),('hidden',false);`);
    const sql = await readFile('supabase/migrations/20261005_docent_templates.sql', 'utf8');
    await db.exec(sql); await db.exec(sql);
    await db.exec(`insert into heritage_docents(heritage_id,template_id) values ('visible','template_1'),('hidden','template_1');
      insert into docent_topics(id,heritage_id,label) values ('t1','visible','질문'),('t2','hidden','숨김');
      insert into docent_scenes(id,topic_id) values ('s1','t1'),('s2','t2'); set role anon;`);
    assert.deepEqual((await db.query('select id from docent_scenes')).rows, [{ id: 's1' }]);
    await assert.rejects(db.exec(`insert into docent_topics(heritage_id,label,sort_order) values ('visible','변조',1)`));
    await db.exec('reset role');
    await assert.rejects(db.exec(`insert into docent_scenes(topic_id,advance,sort_order) values ('t1','bad',1)`));
    await db.exec(`update docent_templates set is_active=false; set role authenticated;`);
    assert.equal((await db.query('select id from docent_scenes')).rows.length, 0);
  } finally { await db.close(); }
});
