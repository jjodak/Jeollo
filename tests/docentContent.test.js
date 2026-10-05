import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHeritageContent } from '../src/utils/heritageContent.js';
import { docentRowToContent, applyDocentContent } from '../src/utils/docentRecords.js';
import { docentTemplate1Sample } from '../src/data/docentTemplate1Sample.js';

test('two unrelated heritages use the same template with independent data and topic counts', () => {
  for (const count of [2, 3]) {
    const model = normalizeHeritageContent({ id: `h-${count}`, name: `문화재 ${count}`, content: {
      docent: { ...docentTemplate1Sample, topics: docentTemplate1Sample.topics.slice(0, count) },
    } });
    assert.equal(model.docentExperience.topics.length, count);
    assert.equal(model.docentExperience.topics[0].scenes.length, 5);
    assert.equal(model.docentExperience.topics[1].scenes[0].transition.durationMs, 100);
  }
});
test('relational rows sort questions/scenes and exclude inactive content without losing legacy text', () => {
  const row = { template_id: 'template_1', title: '새 제목', topics: [
    { id: 'b', label: '두번째', sort_order: 2, scenes: [{ id: 's2', sort_order: 2 }, { id: 's1', sort_order: 1 }] },
    { id: 'a', label: '첫번째', sort_order: 1, scenes: [{ id: 's', sort_order: 0 }] },
    { id: 'hidden', label: '숨김', is_active: false, scenes: [] },
  ] };
  const content = docentRowToContent(row);
  assert.deepEqual(content.topics.map((t) => t.id), ['a', 'b']);
  assert.deepEqual(content.topics[1].scenes.map((s) => s.id), ['s1', 's2']);
  const legacy = normalizeHeritageContent({ id: 'h', name: '원래 이름', docent_text: '원래 원고' });
  assert.equal(applyDocentContent(legacy, content).docentText, '원래 원고');
  assert.equal(applyDocentContent(legacy, content).docentTitle, '새 제목');
  assert.equal(applyDocentContent(legacy, { templateType: 'template_1', topics: [] }), legacy);
});
test('invalid optional content and unsafe image URLs do not break legacy rendering', () => {
  assert.equal(normalizeHeritageContent({ id: 'old', docent_text: '원래 원고' }).docentExperience, null);
  const data = normalizeHeritageContent({ id: 'h', content: { docent: { templateType: 'template_1', topics: [
    { id: 't', label: '질문', scenes: [{ advance: 'auto', waitMs: -10, transition: { durationMs: NaN },
      layers: [{ id: 'unsafe', imageUrl: 'javascript:alert(1)' }, { id: 'safe', imageUrl: '/image.png', opacity: 99 }] }] },
    { id: 't', label: '중복', scenes: [{}] }, null,
  ] } } });
  assert.equal(data.docentExperience.topics.length, 1);
  const scene = data.docentExperience.topics[0].scenes[0];
  assert.equal(scene.waitMs, 0); assert.equal(scene.transition.durationMs, 0);
  assert.equal(scene.layers.length, 1); assert.equal(scene.layers[0].opacity, 1);
});
