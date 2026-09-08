import { useCallback, useEffect, useRef, useState } from 'react';

const HERO_AUTOPLAY_DELAY_MS = 5200;
const HERO_MANUAL_HOLD_MS = 9000;
const HERO_TRACKPAD_THRESHOLD = 48;
const HERO_TRACKPAD_RESET_MS = 260;
const HERO_SLIDE_ANIMATION_MS = 640;

export function getSlideKey(slide) {
  return slide?.id ?? slide?.title ?? slide?.image;
}

function rotateSlides(slides, index) {
  if (slides.length === 0) {
    return [];
  }

  const nextIndex = ((index % slides.length) + slides.length) % slides.length;

  return [...slides.slice(nextIndex), ...slides.slice(0, nextIndex)];
}

export function useHeroCarousel(slides) {
  const carouselRef = useRef(null);
  const orderedSlidesRef = useRef([]);
  const swipeStartRef = useRef(null);
  const manualHoldUntilRef = useRef(0);
  const wheelDeltaRef = useRef(0);
  const wheelResetTimeoutRef = useRef(null);
  const transitionTimeoutRef = useRef(null);
  const [orderedSlides, setOrderedSlides] = useState([]);
  const [slideTransition, setSlideTransition] = useState(null);

  useEffect(() => {
    orderedSlidesRef.current = slides;
    setOrderedSlides(slides);
    setSlideTransition(null);
    swipeStartRef.current = null;
    wheelDeltaRef.current = 0;
    manualHoldUntilRef.current = 0;
    window.clearTimeout(wheelResetTimeoutRef.current);
    window.clearTimeout(transitionTimeoutRef.current);
  }, [slides]);

  useEffect(() => () => {
    window.clearTimeout(wheelResetTimeoutRef.current);
    window.clearTimeout(transitionTimeoutRef.current);
  }, []);

  const holdAutoplay = useCallback(() => {
    manualHoldUntilRef.current = Date.now() + HERO_MANUAL_HOLD_MS;
  }, []);

  const queueSlideTransition = useCallback((previousSlide, nextSlide, direction) => {
    if (!previousSlide || !nextSlide || getSlideKey(previousSlide) === getSlideKey(nextSlide)) {
      return;
    }

    window.clearTimeout(transitionTimeoutRef.current);
    setSlideTransition({
      direction: direction > 0 ? 'next' : 'previous',
      previousSlide,
      key: `${getSlideKey(previousSlide)}-${getSlideKey(nextSlide)}-${Date.now()}`,
    });
    transitionTimeoutRef.current = window.setTimeout(() => {
      setSlideTransition(null);
    }, HERO_SLIDE_ANIMATION_MS);
  }, []);

  const scrollToSlide = useCallback((index, options = {}) => {
    if (options.manual) {
      holdAutoplay();
    }

    const currentSlide = orderedSlidesRef.current[0] ?? slides[0] ?? null;
    const nextSlides = rotateSlides(slides, index);
    const currentIndex = currentSlide
      ? Math.max(slides.findIndex((slide) => getSlideKey(slide) === getSlideKey(currentSlide)), 0)
      : 0;
    queueSlideTransition(currentSlide, nextSlides[0], index >= currentIndex ? 1 : -1);
    orderedSlidesRef.current = nextSlides;
    setOrderedSlides(nextSlides);
  }, [holdAutoplay, queueSlideTransition, slides]);

  const moveSlide = useCallback((direction, options = {}) => {
    if (options.manual) {
      holdAutoplay();
    }

    const currentSlides = orderedSlidesRef.current;
    if (currentSlides.length <= 1) return;
    const nextSlides = rotateSlides(currentSlides, direction > 0 ? 1 : -1);
    queueSlideTransition(currentSlides[0], nextSlides[0], direction);
    orderedSlidesRef.current = nextSlides;
    setOrderedSlides(nextSlides);
  }, [holdAutoplay, queueSlideTransition]);

  useEffect(() => {
    if (slides.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (Date.now() < manualHoldUntilRef.current || document.visibilityState === 'hidden') {
        return;
      }

      moveSlide(1);
    }, HERO_AUTOPLAY_DELAY_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [moveSlide, slides.length]);

  const handlePointerDown = useCallback((event) => {
    if (orderedSlides.length <= 1) {
      return;
    }

    swipeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [orderedSlides.length]);

  const handlePointerUp = useCallback((event) => {
    const swipeStart = swipeStartRef.current;
    swipeStartRef.current = null;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }

    if (!swipeStart || orderedSlides.length <= 1) {
      return;
    }

    const deltaX = event.clientX - swipeStart.x;
    const deltaY = event.clientY - swipeStart.y;
    const horizontalSwipe = Math.abs(deltaX) >= 56 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4;

    if (horizontalSwipe) {
      moveSlide(deltaX < 0 ? 1 : -1, { manual: true });
    }
  }, [moveSlide, orderedSlides.length]);

  const handlePointerCancel = useCallback((event) => {
    swipeStartRef.current = null;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  }, []);

  const handleWheel = useCallback((event) => {
    if (orderedSlides.length <= 1) {
      return;
    }

    const deltaX = event.deltaX;
    const deltaY = event.deltaY;
    const horizontalIntent = Math.abs(deltaX) > 2 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;

    if (!horizontalIntent) {
      return;
    }

    event.preventDefault();
    holdAutoplay();
    wheelDeltaRef.current += deltaX;
    window.clearTimeout(wheelResetTimeoutRef.current);
    wheelResetTimeoutRef.current = window.setTimeout(() => {
      wheelDeltaRef.current = 0;
    }, HERO_TRACKPAD_RESET_MS);

    if (Math.abs(wheelDeltaRef.current) < HERO_TRACKPAD_THRESHOLD) {
      return;
    }

    const direction = wheelDeltaRef.current > 0 ? 1 : -1;
    wheelDeltaRef.current = 0;
    moveSlide(direction, { manual: true });
  }, [holdAutoplay, moveSlide, orderedSlides.length]);

  useEffect(() => {
    const element = carouselRef.current;
    element?.addEventListener('wheel', handleWheel, { passive: false });
    return () => element?.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const activeSlide = orderedSlides[0] ?? slides[0] ?? null;
  const activeIndex = activeSlide
    ? Math.max(slides.findIndex((slide) => getSlideKey(slide) === getSlideKey(activeSlide)), 0)
    : 0;

  return {
    activeSlide,
    activeIndex,
    slideTransition,
    scrollToSlide,
    carouselHandlers: {
      ref: carouselRef,
      onPointerDown: handlePointerDown,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  };
}
