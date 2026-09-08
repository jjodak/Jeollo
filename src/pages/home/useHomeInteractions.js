import { useEffect, useRef, useState } from 'react';

export function useHeroSnap(homeRef) {
  const lastScrollTopRef = useRef(0);
  const snapTimeoutRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    const scrollContainer = homeRef.current?.closest('.page-body--immersive');

    if (!scrollContainer) {
      return undefined;
    }

    lastScrollTopRef.current = scrollContainer.scrollTop;

    const animateToTop = () => {
      window.cancelAnimationFrame(animationFrameRef.current);

      const startScrollTop = scrollContainer.scrollTop;
      const startedAt = performance.now();
      const duration = 650;

      const step = (currentTime) => {
        const elapsed = currentTime - startedAt;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = 1 - (1 - progress) ** 3;

        scrollContainer.scrollTop = startScrollTop * (1 - easedProgress);

        if (progress < 1) {
          animationFrameRef.current = window.requestAnimationFrame(step);
        }
      };

      animationFrameRef.current = window.requestAnimationFrame(step);
    };

    const handleScroll = () => {
      const currentScrollTop = scrollContainer.scrollTop;
      const isScrollingUp = currentScrollTop < lastScrollTopRef.current;
      lastScrollTopRef.current = currentScrollTop;

      window.clearTimeout(snapTimeoutRef.current);

      if (
        isScrollingUp &&
        currentScrollTop > 12 &&
        currentScrollTop < scrollContainer.clientHeight * 0.28
      ) {
        snapTimeoutRef.current = window.setTimeout(() => {
          animateToTop();
        }, 220);
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.clearTimeout(snapTimeoutRef.current);
      window.cancelAnimationFrame(animationFrameRef.current);
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [homeRef]);
}

function getCenteredCardIndex(listElement) {
  const cards = Array.from(listElement.querySelectorAll('.figma-popular-card'));
  const listRect = listElement.getBoundingClientRect();
  const listCenter = listRect.left + listRect.width / 2;

  return cards.reduce(
    (closest, card, index) => {
      const cardRect = card.getBoundingClientRect();
      const cardCenter = cardRect.left + cardRect.width / 2;
      const distance = Math.abs(listCenter - cardCenter);

      if (distance < closest.distance) {
        return { index, distance };
      }

      return closest;
    },
    { index: 0, distance: Number.POSITIVE_INFINITY },
  ).index;
}

export function useFeaturedPopularCard() {
  const listRef = useRef(null);
  const [featuredIndex, setFeaturedIndex] = useState(0);

  useEffect(() => {
    const listElement = listRef.current;

    if (!listElement) {
      return undefined;
    }

    let frameId = null;

    const updateFeaturedIndex = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        setFeaturedIndex(getCenteredCardIndex(listElement));
      });
    };

    updateFeaturedIndex();
    listElement.addEventListener('scroll', updateFeaturedIndex, { passive: true });
    window.addEventListener('resize', updateFeaturedIndex);

    return () => {
      window.cancelAnimationFrame(frameId);
      listElement.removeEventListener('scroll', updateFeaturedIndex);
      window.removeEventListener('resize', updateFeaturedIndex);
    };
  }, []);

  return { listRef, featuredIndex };
}
