import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDocentMedia } from '../useDocentMedia.js';

const formatTime = (value) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;

export function DocentResultArtwork({ layers }) {
  const viewport = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(entry.contentRect.width / 393, entry.contentRect.height / 733)));
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  return <div className="docent-result-artwork" ref={viewport}>
    <div className="docent-artboard" style={{ transform: `translateX(-50%) scale(${scale})` }}>
      <DocentLayers layers={layers} transition={{ durationMs: 0 }} />
    </div>
  </div>;
}

export function DocentLayers({ layers, transition, className = '' }) {
  const previous = useRef(new Map());
  const elements = useRef(new Map());
  const retained = useRef(new Map());
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

  return <div className={`docent-layers ${className}`} aria-hidden="true">
    {transition.type === 'dissolve' ? <div className="docent-layers docent-dissolve-outgoing" ref={outgoingElement}>
      {outgoing.map((layer) => <div key={layer.id} className={`docent-layer${layer.glow ? ' docent-layer--glow' : ''}`}
        style={{ left: layer.x, top: layer.y, width: layer.width, height: layer.height,
          opacity: layer.opacity, transform: `rotate(${layer.rotation}deg)`,
          ...(layer.mask ? { maskImage: `url("${layer.mask}")`, maskRepeat: 'no-repeat',
            maskPosition: `${layer.maskX}px ${layer.maskY}px`, maskSize: `${layer.maskSize}px ${layer.maskSize}px` } : {}) }}>
        {layer.imageUrl ? <img src={layer.imageUrl} alt="" draggable="false"
          className={layer.intrinsic ? 'docent-layer-intrinsic' : 'docent-layer-image'}
          style={layer.cropY ? { transform: `translateY(${layer.cropY}%)` } : undefined} /> : null}
        {layer.text ? <span style={{ fontSize: layer.fontSize, fontWeight: layer.fontWeight }}>{layer.text}</span> : null}
      </div>)}
    </div> : null}
    {[...retained.current].map(([id, stored]) => {
      const layer = active.get(id) ?? { ...stored, opacity: 0 };
      return <div key={id} ref={(el) => { if (el) elements.current.set(id, el); else elements.current.delete(id); }}
        className={`docent-layer${layer.glow ? ' docent-layer--glow' : ''}`}
        data-layer-id={id} style={{ left: layer.x, top: layer.y, width: layer.width, height: layer.height,
          opacity: layer.opacity, transform: `rotate(${layer.rotation}deg)`,
          ...(layer.mask ? { maskImage: `url("${layer.mask}")`, maskRepeat: 'no-repeat',
            maskPosition: `${layer.maskX}px ${layer.maskY}px`, maskSize: `${layer.maskSize}px ${layer.maskSize}px` } : {}) }}>
        {layer.imageUrl ? <img src={layer.imageUrl} alt="" draggable="false"
          className={layer.intrinsic ? 'docent-layer-intrinsic' : 'docent-layer-image'}
          style={layer.cropY ? { transform: `translateY(${layer.cropY}%)` } : undefined} /> : null}
        {layer.text ? <span style={{ fontSize: layer.fontSize, fontWeight: layer.fontWeight }}>{layer.text}</span> : null}
      </div>;
    })}
  </div>;
}

export function Template1({ heritage, experience, onDetail }) {
  const viewport = useRef(null);
  const pendingAt = useRef(0);
  const remaining = useRef(0);
  const [scale, setScale] = useState(1);
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
  const audio = scene?.audioUrl || topic?.audioUrl || (!topic ? heritage.audioUrl : '');
  const media = useDocentMedia(audio, script, Boolean(topic), topic?.id ?? 'selection');
  const allImages = useMemo(() => [...new Set([experience.backgroundUrl, ...experience.selectionLayers.map((l) => l.imageUrl),
    ...experience.topics.flatMap((t) => t.scenes.flatMap((s) => s.layers.map((l) => l.imageUrl)))].filter(Boolean))], [experience]);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(entry.contentRect.width / 393, entry.contentRect.height / 733));
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
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
    if (sceneIndex + 1 < topic.scenes.length) { setSceneIndex((index) => index + 1); setScriptOpen(false); }
    else finish();
  };
  useEffect(() => {
    remaining.current = scene?.advance === 'auto' ? scene.waitMs + scene.transition.durationMs : 0;
  }, [scene]);
  useEffect(() => {
    if (!scene || scene.advance !== 'auto' || paused || hidden) return;
    pendingAt.current = performance.now();
    const timer = window.setTimeout(next, remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (performance.now() - pendingAt.current));
    };
  }, [scene, paused, hidden]);

  const select = (id) => { setTopicId(id); setSceneIndex(0); setPaused(false); setScriptOpen(false); };
  const toggle = () => {
    if (scene?.advance === 'auto') setPaused((value) => !value);
    if (media.available) media.toggle();
  };
  const title = scene?.title || topic?.title || heritage.docentTitle || heritage.name;
  const isPlaying = media.playing || (scene?.advance === 'auto' && !paused);
  return <section ref={viewport} className="docent-template-one" aria-label="도슨트 Template 1"
    data-topic-id={topic?.id ?? ''} data-scene-id={scene?.id ?? ''}>
    {experience.backgroundUrl || heritage.detailImageUrl ? <img className="docent-background"
      src={experience.backgroundUrl || heritage.detailImageUrl} alt="" /> : null}
    <div className="docent-background-scrim" />
    <div className="docent-artboard" style={{ transform: `translateX(-50%) scale(${scale})` }}>
      <header className="docent-header"><h2>{title}</h2><p>{topic?.subtitle || heritage.docentSubtitle}</p></header>
      <div className="docent-media">
        <button type="button" className="docent-media-toggle" onClick={toggle}
          aria-label={isPlaying ? '도슨트 일시정지' : '도슨트 재생'} disabled={!media.available && scene?.advance !== 'auto'}>
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
          <img src="/docent/template1/script.svg" alt="" /> 스크립트 보기
        </button>
        <button type="button" onClick={topic ? finish : onDetail}>건너뛰기</button>
      </div>
      <DocentLayers layers={layers} transition={transition} />
      {!topic ? <div className={`docent-topics${experience.topics.length > 3 ? ' docent-topics--list' : ''}`} aria-label="도슨트 질문 선택">
        {experience.topics.map((item) => <button key={item.id} type="button" onClick={() => select(item.id)}
          style={{ left: item.x, top: item.y }}>{item.label}</button>)}
      </div> : <button className="docent-next" type="button" onClick={next} aria-label={sceneIndex === topic.scenes.length - 1 ? '질문 선택으로 돌아가기' : '다음 장면'} />}
      {media.error ? <p className="docent-error" role="alert">{media.error}</p> : null}
      {scriptOpen ? <section className="docent-script" aria-label="도슨트 스크립트"><p>{script}</p></section> : null}
      <button className="docent-details" type="button" aria-label="상세 정보" onClick={onDetail}>
        <img src="/docent/template1/details.svg" alt="" />
      </button>
      <span className="docent-scene-status" role="status">{topic ? `${topic.label} · ${sceneIndex + 1} / ${topic.scenes.length}` : '궁금한 질문을 선택해주세요'}</span>
    </div>
  </section>;
}
