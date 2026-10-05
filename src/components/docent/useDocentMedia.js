import { useCallback, useEffect, useRef, useState } from 'react';

export function useDocentMedia(audioUrl, script, autoPlay = false, mediaKey = '') {
  const audioRef = useRef(null);
  const utteranceRef = useRef(null);
  const sessionRef = useRef(0);
  const progressRef = useRef(0);
  const playRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const session = ++sessionRef.current;
    setPlaying(false); setPaused(false); setProgress(0); progressRef.current = 0; setError('');
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.preload = 'metadata'; audioRef.current = audio;
      setDuration(0);
      const metadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      const update = () => { progressRef.current = audio.currentTime; setProgress(audio.currentTime); };
      const ended = () => { setPlaying(false); setPaused(false); };
      const failed = () => { setPlaying(false); setError('음성 파일을 재생하지 못했어요. 다시 시도해주세요.'); };
      audio.addEventListener('loadedmetadata', metadata);
      audio.addEventListener('durationchange', metadata);
      audio.addEventListener('timeupdate', update);
      audio.addEventListener('ended', ended);
      audio.addEventListener('error', failed);
      return () => {
        sessionRef.current++;
        audio.removeEventListener('loadedmetadata', metadata); audio.removeEventListener('durationchange', metadata);
        audio.removeEventListener('timeupdate', update); audio.removeEventListener('ended', ended); audio.removeEventListener('error', failed);
        audio.pause(); audio.removeAttribute('src'); audio.load(); audioRef.current = null;
      };
    }
    setDuration(script ? Math.max(12, Math.ceil(script.replace(/\s/g, '').length / 4.4)) : 0);
    return () => {
      if (sessionRef.current === session) sessionRef.current++;
      if (utteranceRef.current) window.speechSynthesis?.cancel();
      utteranceRef.current = null;
    };
  }, [audioUrl, script, mediaKey]);

  useEffect(() => {
    if (!playing || audioUrl) return;
    const timer = window.setInterval(() => {
      progressRef.current = Math.min(duration, progressRef.current + 0.25);
      setProgress(progressRef.current);
    }, 250);
    return () => window.clearInterval(timer);
  }, [playing, audioUrl, duration]);

  const play = useCallback(async () => {
    setError('');
    if (audioRef.current) {
      const session = sessionRef.current;
      if (audioRef.current.ended) audioRef.current.currentTime = 0;
      try { await audioRef.current.play(); if (session === sessionRef.current) { setPlaying(true); setPaused(false); } }
      catch { if (session === sessionRef.current) setError('음성 파일을 재생하지 못했어요. 다시 시도해주세요.'); }
    } else if (script && window.speechSynthesis && window.SpeechSynthesisUtterance) {
      if (paused && utteranceRef.current) window.speechSynthesis.resume();
      else {
        const utterance = new SpeechSynthesisUtterance(script);
        const session = sessionRef.current;
        utterance.lang = 'ko-KR'; utteranceRef.current = utterance;
        progressRef.current = 0; setProgress(0);
        utterance.onend = () => { if (session === sessionRef.current) { setPlaying(false); setPaused(false); setProgress(duration); utteranceRef.current = null; } };
        utterance.onerror = () => { if (session === sessionRef.current) { setPlaying(false); setError('도슨트 음성을 재생하지 못했어요.'); } };
        window.speechSynthesis.speak(utterance);
      }
      setPlaying(true); setPaused(false);
    }
  }, [paused, audioUrl, script, duration]);
  playRef.current = play;
  useEffect(() => {
    if (!autoPlay) return;
    const timer = window.setTimeout(() => playRef.current(), 0);
    return () => window.clearTimeout(timer);
  }, [audioUrl, script, autoPlay, mediaKey]);
  const toggle = () => {
    if (!playing) { play(); return; }
    audioRef.current?.pause();
    if (!audioUrl) window.speechSynthesis?.pause();
    setPlaying(false); setPaused(true);
  };

  const seek = (value) => {
    if (!audioRef.current || !duration) return;
    const next = Math.max(0, Math.min(duration, value));
    audioRef.current.currentTime = next; progressRef.current = next; setProgress(next);
  };
  return { playing, paused, progress, duration, error, toggle, seek,
    available: Boolean(audioUrl || (script && window.speechSynthesis)), seekable: Boolean(audioUrl && duration) };
}
