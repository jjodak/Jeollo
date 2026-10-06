const string = (value) => typeof value === 'string' ? value.trim() : '';
const number = (value, fallback, min = -2000, max = 2000) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

export function normalizeDocentExperience(value, mediaUrl) {
  const data = object(value);
  if (!string(data.templateType)) return null;
  const layers = (items) => Array.isArray(items) ? items.filter((item) => item && typeof item === 'object')
    .map((item, index) => ({
      id: string(item.id) || `layer-${index}`, imageUrl: mediaUrl(item.imageUrl), text: string(item.text),
      x: number(item.x, 0), y: number(item.y, 0), width: number(item.width, 100, 1), height: number(item.height, 100, 1),
      opacity: number(item.opacity, 1, 0, 1), rotation: number(item.rotation, 0, -360, 360),
      shape: ['rectangle', 'rounded', 'ellipse', 'triangle', 'line'].includes(item.shape) ? item.shape : '',
      fill: /^#[0-9a-f]{6}$/i.test(item.fill) ? item.fill : '#b8d99a',
      color: /^#[0-9a-f]{6}$/i.test(item.color) ? item.color : '#ffffff',
      textAlign: ['left', 'center', 'right'].includes(item.textAlign) ? item.textAlign : 'center',
      animation: { type: ['fade', 'up', 'down', 'left', 'right', 'zoom', 'rotate', 'flip'].includes(item.animation?.type) ? item.animation.type : 'none',
        delayMs: number(item.animation?.delayMs, 0, 0, 600000), durationMs: number(item.animation?.durationMs, 600, 100, 10000) },
      intrinsic: item.intrinsic === true, glow: item.glow === true,
      fontSize: number(item.fontSize, 20, 8, 120),
      fontWeight: number(item.fontWeight, 900, 400, 900),
      mask: mediaUrl(item.mask), maskX: number(item.maskX, 0), maskY: number(item.maskY, 0),
      maskSize: number(item.maskSize, 118.087, 1),
      cropY: number(item.cropY, 0, -100, 100),
    })).filter((item) => item.imageUrl || item.text || item.shape) : [];
  const transition = (input) => {
    const t = object(input);
    const studio = object(t.studio);
    return { studio: { durationMs: studio.durationMs == null ? null : number(studio.durationMs, 5000, 100, 600000) }, type: t.type === 'dissolve' ? 'dissolve' : 'smart',
      durationMs: number(t.durationMs, 0, 0, 5000),
      easing: ['ease-out', 'ease-in-out', 'linear', 'ease-in'].includes(t.easing) ? t.easing : 'ease-in-out' };
  };
  const seen = new Set();
  const topics = (Array.isArray(data.topics) ? data.topics : []).map((input, index) => {
    const topic = object(input);
    const id = string(topic.id) || `topic-${index}`;
    const scenes = (Array.isArray(topic.scenes) ? topic.scenes : []).map((inputScene, sceneIndex) => {
      const scene = object(inputScene);
      return { id: string(scene.id) || `scene-${sceneIndex}`, title: string(scene.title), body: string(scene.body),
        audioUrl: mediaUrl(scene.audioUrl), layers: layers(scene.layers), transition: transition(scene.transition),
        advance: scene.advance === 'auto' ? 'auto' : 'click', waitMs: number(scene.waitMs, 0, 0, 600000) };
    });
    if (seen.has(id) || !string(topic.label) || !scenes.length) return null;
    seen.add(id);
    return { id, label: string(topic.label), title: string(topic.title), subtitle: string(topic.subtitle),
      script: string(topic.script), audioUrl: mediaUrl(topic.audioUrl),
      returnTransition: transition(topic.returnTransition ?? data.returnTransition),
      x: number(topic.x, index % 2 ? 20 : 145, 0, 373), y: number(topic.y, 275 + index * 110, 230, 650),
      scenes };
  }).filter(Boolean);
  if (!topics.length) return null;
  return { templateType: string(data.templateType), backgroundUrl: mediaUrl(data.backgroundUrl),
    resultLayers: layers(data.resultLayers), selectionLayers: layers(data.selectionLayers),
    topics, returnTransition: transition(data.returnTransition ?? { durationMs: 200, easing: 'ease-in-out' }) };
}
