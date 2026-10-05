import { contentImageUrl } from './heritageContent.js';
import { normalizeDocentExperience } from './docentContent.js';

const byOrder = (rows) => [...(rows ?? [])].filter((row) => row.is_active !== false)
  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.id).localeCompare(String(b.id)));

export function docentRowToContent(row) {
  return { templateType: row.template_id, title: row.title, subtitle: row.subtitle,
    backgroundUrl: row.background_url, resultLayers: row.result_layers, selectionLayers: row.selection_layers,
    returnTransition: row.return_transition,
    topics: byOrder(row.topics).map((topic) => ({ id: topic.id, label: topic.label, title: topic.title,
      subtitle: topic.subtitle, script: topic.script, audioUrl: topic.audio_url, returnTransition: topic.return_transition, ...topic.position,
      scenes: byOrder(topic.scenes).map((scene) => ({ id: scene.id, title: scene.title, body: scene.body,
        audioUrl: scene.audio_url, layers: scene.layers, advance: scene.advance, waitMs: scene.wait_ms,
        transition: scene.transition })) })) };
}

export function applyDocentContent(heritage, docent) {
  if (!docent) return heritage;
  const experience = normalizeDocentExperience(docent, contentImageUrl);
  if (!experience) return heritage;
  return { ...heritage, docentExperience: experience,
    docentTitle: docent.title?.trim() || heritage.docentTitle,
    docentSubtitle: docent.subtitle?.trim() || heritage.docentSubtitle };
}
