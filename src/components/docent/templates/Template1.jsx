import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDocentMedia } from '../useDocentMedia.js';

const formatTime = (value) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;

function useArtboardScale() {
  const viewport = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(entry.contentRect.width / 393, entry.contentRect.height / 733)));
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  return [viewport, scale];
}

function layerStyle(layer) {
  return {
    left: layer.x, top: layer.y, width: layer.width, height: layer.height,
    opacity: layer.opacity, transform: `rotate(${layer.rotation}deg)`,
    ...(layer.mask ? {
      maskImage: `url("${layer.mask}")`, maskRepeat: 'no-repeat',
      maskPosition: `${layer.maskX}px ${layer.maskY}px`, maskSize: `${layer.maskSize}px ${layer.maskSize}px`,
    } : {}),
  };
}

function LayerArtwork({ layer }) {
  return <div className="docent-layer-content" style={{ width: '100%', height: '100%' }}>
    {layer.shape && <div className="docent-shape" style={{
      position: 'absolute', inset: layer.shape === 'line' ? 'calc(50% - 2px) 0 auto' : 0,
      height: layer.shape === 'line' ? 4 : undefined, background: layer.fill,
      borderRadius: layer.shape === 'ellipse' ? '50%' : layer.shape === 'rounded' ? 20 : 0,
      clipPath: layer.shape === 'triangle' ? 'polygon(50% 0,100% 100%,0 100%)' : undefined,
    }} />}
    {layer.imageUrl ? <img src={layer.imageUrl} alt="" draggable="false"
      className={layer.intrinsic ? 'docent-layer-intrinsic' : 'docent-layer-image'}
      style={layer.cropY ? { transform: `translateY(${layer.cropY}%)` } : undefined} /> : null}
    {layer.text ? <span style={{ fontSize: layer.fontSize, fontWeight: layer.fontWeight,
      textAlign: layer.textAlign, color: layer.color, position: 'relative', whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere' }}>{layer.text}</span> : null}
  </div>;
}

export function DocentResultArtwork({ layers }) {
  const [viewport, scale] = useArtboardScale();

  return <div className="docent-result-artwork" ref={viewport}>
    <div className="docent-artboard" style={{ transform: `translateX(-50%) scale(${scale})` }}>
      <DocentLayers layers={layers} transition={{ durationMs: 0 }} animate />
    </div>
  </div>;
}

export function DocentLayers({ layers, transition, className = '', animate = false, paused = false, sceneKey = '' }) {
  const previous = useRef(new Map());
  const elements = useRef(new Map());
  const retained = useRef(new Map());
  const entrances = useRef([]);
  const outgoingElement = useRef(null);
  // Snapshot only at a scene boundary, not on media progress re-renders.
  const outgoing = useMemo(() => [...previous.current.values()], [layers]);
  // Keep stable layer IDs mounted across scenes so Smart Animate interpolates geometry.
  for (const layer of layers) retained.current.set(layer.id, layer);
  const active = new Map(layers.map((layer) => [layer.id, layer]));
  useLayoutEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const initial = previous.current.size === 0;
    const animations = [];
    if (outgoingElement.current) {
      if (transition.durationMs && !reduced && !initial) {
        animations.push(outgoingElement.current.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: transition.durationMs, easing: transition.easing, fill: 'forwards',
        }));
      } else outgoingElement.current.style.opacity = '0';
    }
    for (const [id, el] of elements.current) {
      if (!el) continue;
      const layer = active.get(id) ?? { ...retained.current.get(id), opacity: 0 };
      const before = previous.current.get(id) ?? { ...layer, opacity: 0 };
      const frame = (l) => ({ left: `${l.x}px`, top: `${l.y}px`, width: `${l.width}px`, height: `${l.height}px`,
        opacity: l.opacity, transform: `rotate(${l.rotation}deg)` });
      if (transition.durationMs && !reduced && !initial) {
        const from = transition.type === 'dissolve' ? { ...frame(layer), opacity: 0 } : frame(before);
        animations.push(el.animate([from, frame(layer)], { duration: transition.durationMs, easing: transition.easing }));
        const image = el.querySelector('.docent-layer-image');
        if (image && before.cropY !== layer.cropY) animations.push(image.animate([
          { transform: `translateY(${before.cropY ?? 0}%)` }, { transform: `translateY(${layer.cropY ?? 0}%)` },
        ], { duration: transition.durationMs, easing: transition.easing }));
      }
      previous.current.set(id, layer);
    }
    return () => animations.forEach((animation) => animation.cancel());
  }, [layers, transition]);

  useLayoutEffect(() => {
    if (!animate) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    entrances.current = layers.flatMap(layer => {
      const effect = layer.animation;
      const el = elements.current.get(layer.id)?.querySelector('.docent-layer-content');
      if (!el || !effect || effect.type === 'none') return [];
      const transforms = { fade: 'none', up: 'translateY(40px)', down: 'translateY(-40px)',
        left: 'translateX(-40px)', right: 'translateX(40px)', zoom: 'scale(.3)', rotate: 'rotate(-90deg) scale(.5)', flip: 'perspective(600px) rotateY(90deg)' };
      return [el.animate([{ opacity: 0, transform: reduced ? 'none' : transforms[effect.type] }, { opacity: 1, transform: 'none' }],
        { delay: effect.delayMs, duration: reduced ? 1 : effect.durationMs, fill: 'both', easing: 'ease-out' })];
    });
    return () => { entrances.current.forEach(a => a.cancel()); entrances.current = []; };
  }, [layers, animate, sceneKey]);
  useLayoutEffect(() => { entrances.current.forEach(a => paused ? a.pause() : a.play()); }, [paused, layers, sceneKey]);

  return <div className={`docent-layers ${className}`} aria-hidden="true">
    {transition.type === 'dissolve' ? <div className="docent-layers docent-dissolve-outgoing" ref={outgoingElement}>
      {outgoing.map((layer) => <div key={layer.id} className={`docent-layer${layer.glow ? ' docent-layer--glow' : ''}`}
        style={layerStyle(layer)}>
        <LayerArtwork layer={layer} />
      </div>)}
    </div> : null}
    {[...[...retained.current].filter(([id]) => !active.has(id)), ...active].map(([id, stored]) => {
      const layer = active.get(id) ?? { ...stored, opacity: 0 };
      return <div key={id} ref={(el) => { if (el) elements.current.set(id, el); else elements.current.delete(id); }}
        className={`docent-layer${layer.glow ? ' docent-layer--glow' : ''}`}
        data-layer-id={id} style={layerStyle(layer)}>
        <LayerArtwork layer={layer} />
      </div>;
    })}
  </div>;
}

export function Template1({ heritage, experience, onDetail }) {
  const [viewport, scale] = useArtboardScale();
  const pendingAt = useRef(0);
  const remaining = useRef(0);
  const [topicId, setTopicId] = useState(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [returnTransition, setReturnTransition] = useState(experience.returnTransition);
  const topic = experience.topics.find((item) => item.id === topicId) ?? null;
  const scene = topic?.scenes[sceneIndex] ?? null;
  const transition = scene?.transition ?? returnTransition;
  const layers = scene?.layers ?? experience.selectionLayers;
  const script = scene?.body || topic?.script || heritage.docentText;
  const audio = topic?.audioUrl || scene?.audioUrl || (!topic ? heritage.audioUrl : '');
  // Question audio spans all slides; scene audio remains a fallback for older content.
  const narration = audio ? '' : topic?.script || script;
  const media = useDocentMedia(audio, narration, Boolean(topic), topic?.id ?? 'selection');
  const allImages = useMemo(() => [...new Set([heritage.recognitionImageUrl, ...experience.selectionLayers.map((l) => l.imageUrl),
    ...experience.topics.flatMap((t) => t.scenes.flatMap((s) => s.layers.map((l) => l.imageUrl)))].filter(Boolean))], [experience, heritage.recognitionImageUrl]);

  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  useEffect(() => {
    // Preload upcoming original assets; a slow network should not flash an empty scene.
    allImages.forEach((url) => { const img = new Image(); img.src = url; });
  }, [allImages]);

  const finish = () => { setReturnTransition(topic?.returnTransition ?? experience.returnTransition); setTopicId(null); setSceneIndex(0); setPaused(false); setScriptOpen(false); };
  const next = () => {
    if (!topic) return;
    setSceneIndex((index) => Math.min(index + 1, topic.scenes.length - 1));
    setScriptOpen(false);
  };
  const previousScene = () => {
    setSceneIndex((index) => Math.max(0, index - 1));
    setScriptOpen(false);
  };
  const hasAutoAdvance = scene?.advance === 'auto' && sceneIndex + 1 < topic.scenes.length;
  useEffect(() => {
    remaining.current = scene?.advance === 'auto' ? (scene.transition.studio?.durationMs ?? scene.waitMs + scene.transition.durationMs) : 0;
  }, [scene]);
  useEffect(() => {
    if (!hasAutoAdvance || paused || hidden) return;
    pendingAt.current = performance.now();
    const timer = window.setTimeout(next, remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (performance.now() - pendingAt.current));
    };
  }, [scene, paused, hidden, hasAutoAdvance]);

  const select = (id) => { setTopicId(id); setSceneIndex(0); setPaused(false); setScriptOpen(false); };
  const toggle = () => {
    setPaused(isPlaying);
    if (media.available) media.toggle();
  };
  const title = scene?.title || topic?.title || heritage.docentTitle || heritage.name;
  const isPlaying = media.playing || (hasAutoAdvance && !paused);
  return <section ref={viewport} className="docent-template-one" aria-label="도슨트 Template 1"
    data-topic-id={topic?.id ?? ''} data-scene-id={scene?.id ?? ''}>
    {heritage.recognitionImageUrl ? <img className="docent-background" src={heritage.recognitionImageUrl} alt="인식한 사진" /> : null}
    <div className="docent-background-scrim" />
    <div className="docent-artboard" style={{ transform: `translateX(-50%) scale(${scale})` }}>
      <header className="docent-header"><h2>{title}</h2><p>{topic?.subtitle || heritage.docentSubtitle}</p></header>
      <div className="docent-media">
        <button type="button" className="docent-media-toggle" onClick={toggle}
          aria-label={isPlaying ? '도슨트 일시정지' : '도슨트 재생'} disabled={!media.available && !hasAutoAdvance}>
          <span className={isPlaying ? 'docent-pause-icon' : 'docent-play-icon'} aria-hidden="true" />
        </button>
        <input type="range" aria-label="도슨트 진행률" min="0" max={media.duration || 1} step="0.1"
          value={Math.min(media.progress, media.duration || 1)} disabled={!media.seekable}
          onChange={(event) => media.seek(Number(event.target.value))}
          style={{ '--progress': `${media.duration ? media.progress / media.duration * 100 : 0}%` }} />
        <span>{formatTime(media.progress)} / {formatTime(media.duration)}</span>
      </div>
      <div className="docent-links">
        <button type="button" onClick={() => setScriptOpen((value) => !value)} disabled={!script} aria-expanded={scriptOpen}>
          <img src="/docent/template1/script.svg" alt="" /> 텍스트 자세히보기
        </button>
        <button type="button" onClick={topic ? finish : onDetail}>건너뛰기</button>
      </div>
      <DocentLayers layers={layers} transition={transition} animate paused={paused || hidden} sceneKey={scene?.id} />
      {!topic ? <div className={`docent-topics${experience.topics.length > 3 ? ' docent-topics--list' : ''}`} aria-label="도슨트 질문 선택">
        {experience.topics.map((item) => <button key={item.id} type="button" onClick={() => select(item.id)}
          style={{ left: item.x, top: item.y }}>{item.label}</button>)}
      </div> : <>
        <button className="docent-previous" type="button" onClick={previousScene} aria-label="이전 장면" />
        <button className="docent-next" type="button" onClick={next} aria-label="다음 장면" />
      </>}
      {media.error ? <p className="docent-error" role="alert">{media.error}</p> : null}
      {scriptOpen ? <section className="docent-script" aria-label="도슨트 스크립트"><p>{script}</p></section> : null}
      {!topic && <button className="docent-details" type="button" aria-label="상세 정보" onClick={onDetail}>
        <img src="/docent/template1/details.svg" alt="" />
      </button>}
      <span className="docent-scene-status" role="status">{topic ? `${topic.label} · ${sceneIndex + 1} / ${topic.scenes.length}` : '궁금한 질문을 선택해주세요'}</span>
    </div>
  </section>;
}
