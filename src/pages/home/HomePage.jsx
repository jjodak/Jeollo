import { useCallback, useEffect, useRef, useState } from 'react';
import calendarIcon from '../../assets/figma/calendar.svg';
import dancheongTour from '../../assets/figma/dancheong-tour.png';
import eventFood from '../../assets/figma/event-food.png';
import eventHwaeomsa from '../../assets/figma/event-hwaeomsa.png';
import headsetIcon from '../../assets/figma/headset.svg';
import homeHero from '../../assets/figma/home-hero-scroll.png';
import locationIcon from '../../assets/figma/location.svg';
import popularBlog from '../../assets/figma/popular-blog.png';
import popularGimjeTrip from '../../assets/figma/popular-gimje-trip.png';
import popularBlogNext from '../../assets/figma/popular-blog-next.png';
import templeHero from '../../assets/figma/temple-hero.png';
import timeIcon from '../../assets/figma/time.svg';
import { getMonthlyEvents } from '../../services/eventService.js';
import { getNearbyActiveTemples } from '../../services/templeService.js';

const HERO_RECOMMENDATION_LIMIT = 4;

const fallbackHeroImages = [homeHero, templeHero, eventHwaeomsa, dancheongTour];

const fallbackHeroSlides = [
  {
    image: homeHero,
    title: '김제 금산사',
    alt: '김제 금산사 전경',
    targetTab: 'search',
  },
  {
    image: templeHero,
    title: '구례 화엄사',
    alt: '사찰 전각과 산 능선',
    targetTab: 'search',
  },
  {
    image: eventHwaeomsa,
    title: '화엄사 화야몽',
    alt: '화엄사 야간 행사 전경',
    targetTab: 'search',
  },
  {
    image: dancheongTour,
    title: '단청 투어',
    alt: '사찰 단청 무늬',
    targetTab: 'search',
  },
];

function getTempleFallbackImage(index) {
  return fallbackHeroImages[index % fallbackHeroImages.length];
}

function createHeroSlidesFromTemples(temples) {
  if (temples.length === 0) {
    return fallbackHeroSlides;
  }

  return temples
    .slice(0, HERO_RECOMMENDATION_LIMIT)
    .map((temple, index) => ({
      id: temple.id,
      image: temple.image_url || getTempleFallbackImage(index),
      fallbackImage: getTempleFallbackImage(index),
      title: temple.name,
      alt: `${temple.name} 대표 이미지`,
      targetTab: 'search',
      distanceKm: temple.distance_km,
    }));
}

const popularCards = [
  {
    image: popularBlog,
    category: '추천 블로그',
    title: '처음 방문한 절,\n나도 절 해보고싶다면?',
    description: '처음 방문한 절에서\n알아두면 좋은 다섯 가지',
  },
  {
    image: popularBlogNext,
    category: '추천 블로그',
    title: '처음 방문한 절,\n나도 절 해보고싶다면?',
    description: '절에 가기 전 가볍게 읽는 방문 이야기',
  },
  {
    image: popularGimjeTrip,
    category: '추천 블로그',
    title: '금산사 가는 김에\n김제도 한 바퀴',
    description: '근처 맛집부터 쉬어가기 좋은 곳까지',
  },
];

const eventPlaceholderImages = [eventHwaeomsa, eventFood];

function getEventPlaceholderImage(index) {
  return eventPlaceholderImages[index % eventPlaceholderImages.length];
}

function parseEventDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShortKoreanDate(value) {
  const date = parseEventDate(value);

  if (!date) {
    return null;
  }

  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatEventDateRange(startDate, endDate) {
  const startText = formatShortKoreanDate(startDate);
  const endText = endDate && endDate !== startDate ? formatShortKoreanDate(endDate) : null;

  if (!startText) {
    return '일정 확인';
  }

  return endText ? `${startText} ~ ${endText}` : startText;
}

function createEventCardFromApiEvent(event, index) {
  const fallbackImage = getEventPlaceholderImage(index);

  return {
    id: event.id,
    image: event.imageUrl || fallbackImage,
    fallbackImage,
    title: event.title,
    location: event.location || event.address || '장소 확인',
    date: event.dateText || formatEventDateRange(event.startDate, event.endDate),
    duration: event.durationText || '일정 확인',
  };
}

function getGreeting(date = new Date()) {
  const dayGreetings = [
    '여유로운 일요일이에요!',
    '새로운 한 주를 시작해볼까요?',
    '차분한 화요일이에요!',
    '잠시 쉬어가기 좋은 수요일이에요!',
    '주말이 가까워지는 목요일이에요!',
    '가볍게 떠나기 좋은 금요일이에요!',
    '좋은 주말이에요!',
  ];

  return dayGreetings[date.getDay()];
}

function getEventSectionTitle(date = new Date()) {
  return `${date.getMonth() + 1}월의 행사`;
}

function getNextMidnightDelay(date = new Date()) {
  const nextMidnight = new Date(date);
  nextMidnight.setHours(24, 0, 0, 0);

  return nextMidnight.getTime() - date.getTime();
}

function useToday() {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const refreshToday = () => setToday(new Date());
    const timeoutId = window.setTimeout(refreshToday, getNextMidnightDelay(today));

    return () => window.clearTimeout(timeoutId);
  }, [today]);

  return today;
}

function useHeroSnap(homeRef) {
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

function getSlideKey(slide) {
  return slide?.id ?? slide?.title ?? slide?.image;
}

function rotateSlides(slides, index) {
  if (slides.length === 0) {
    return [];
  }

  const nextIndex = ((index % slides.length) + slides.length) % slides.length;

  return [...slides.slice(nextIndex), ...slides.slice(0, nextIndex)];
}

function useHeroCarousel(slides) {
  const swipeStartRef = useRef(null);
  const [orderedSlides, setOrderedSlides] = useState([]);

  useEffect(() => {
    setOrderedSlides(slides);
    swipeStartRef.current = null;
  }, [slides]);

  const scrollToSlide = useCallback((index) => {
    setOrderedSlides(rotateSlides(slides, index));
  }, [slides]);

  const moveSlide = useCallback((direction) => {
    setOrderedSlides((currentSlides) => {
      if (currentSlides.length <= 1) {
        return currentSlides;
      }

      if (direction > 0) {
        return [...currentSlides.slice(1), currentSlides[0]];
      }

      return [
        currentSlides[currentSlides.length - 1],
        ...currentSlides.slice(0, currentSlides.length - 1),
      ];
    });
  }, []);

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
      moveSlide(deltaX < 0 ? 1 : -1);
    }
  }, [moveSlide, orderedSlides.length]);

  const handlePointerCancel = useCallback((event) => {
    swipeStartRef.current = null;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  }, []);

  const activeSlide = orderedSlides[0] ?? slides[0] ?? null;
  const activeIndex = activeSlide
    ? Math.max(slides.findIndex((slide) => getSlideKey(slide) === getSlideKey(activeSlide)), 0)
    : 0;

  return {
    activeSlide,
    activeIndex,
    scrollToSlide,
    carouselHandlers: {
      onPointerDown: handlePointerDown,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  };
}

function useNearbyHeroSlides() {
  const [slides, setSlides] = useState([]);

  useEffect(() => {
    let isMounted = true;

    if (!navigator.geolocation) {
      setSlides(fallbackHeroSlides);
      return undefined;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const temples = await getNearbyActiveTemples({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            limit: HERO_RECOMMENDATION_LIMIT,
          });

          if (isMounted && temples.length > 0) {
            setSlides(createHeroSlidesFromTemples(temples));
          } else if (isMounted) {
            setSlides(fallbackHeroSlides);
          }
        } catch {
          if (isMounted) {
            setSlides(fallbackHeroSlides);
          }
        }
      },
      () => {
        if (isMounted) {
          setSlides(fallbackHeroSlides);
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 5 * 60 * 1000,
      },
    );

    return () => {
      isMounted = false;
    };
  }, []);

  return slides;
}

function useMonthlyEventCards(date) {
  const [cards, setCards] = useState([]);
  const year = date.getFullYear();
  const month = date.getMonth();

  useEffect(() => {
    let isMounted = true;
    const queryDate = new Date(year, month, 1);

    setCards([]);

    getMonthlyEvents({ date: queryDate })
      .then(({ events, error }) => {
        if (!isMounted) {
          return;
        }

        setCards(error ? [] : events.map((event, index) => createEventCardFromApiEvent(event, index)));
      })
      .catch(() => {
        if (isMounted) {
          setCards([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [month, year]);

  return cards;
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

function useFeaturedPopularCard() {
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

export function HomePage({ onMoveTab }) {
  const homeRef = useRef(null);
  const today = useToday();
  const greeting = getGreeting(today);
  const eventSectionTitle = getEventSectionTitle(today);
  const heroSlides = useNearbyHeroSlides();
  const eventCards = useMonthlyEventCards(today);
  const {
    activeSlide: activeHero,
    activeIndex: heroIndex,
    scrollToSlide: scrollToHeroSlide,
    carouselHandlers: heroCarouselHandlers,
  } = useHeroCarousel(heroSlides);
  const { listRef: popularListRef, featuredIndex } = useFeaturedPopularCard();
  useHeroSnap(homeRef);

  return (
    <section
      ref={homeRef}
      className="figma-home-screen"
      data-node-id="3:2"
      data-name="iPhone 16 - 17"
    >
      <section className="figma-hero-section" aria-label="추천 장소">
        <div className="figma-hero-carousel" aria-label="추천 사진 목록" {...heroCarouselHandlers}>
          {activeHero ? (
            <article
              className="figma-hero-slide"
              key={getSlideKey(activeHero)}
              aria-label={`${heroIndex + 1}번째 추천: ${activeHero.title}`}
            >
              <img
                className="figma-home-image"
                src={activeHero.image}
                alt={activeHero.alt}
                onError={(event) => {
                  if (!activeHero.fallbackImage) {
                    return;
                  }

                  event.currentTarget.onerror = null;
                  event.currentTarget.src = activeHero.fallbackImage;
                }}
              />
            </article>
          ) : null}
        </div>
        <div className="figma-top-gradient" aria-hidden="true" />
        <div className="figma-bottom-gradient" aria-hidden="true" />

        <p className="figma-greeting">{greeting}</p>

        {activeHero ? (
          <>
            <div className="figma-place-copy">
              <p>추천 장소</p>
              <h2>{activeHero.title}</h2>
              <button type="button" onClick={() => onMoveTab(activeHero.targetTab)}>
                자세히 보기 <span>→</span>
              </button>
            </div>

            <div className="figma-slider" aria-label="추천 사진 페이지">
              {heroSlides.map((slide, index) => (
                <button
                  className={index === heroIndex ? 'active' : undefined}
                  type="button"
                  key={slide.id ?? slide.title}
                  aria-current={index === heroIndex ? 'true' : undefined}
                  aria-label={`${index + 1}번째 추천 사진 보기`}
                  onClick={() => scrollToHeroSlide(index)}
                />
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="figma-popular-section" aria-label="금주의 인기 소식">
        <h3>금주의 인기 소식</h3>
        <div className="figma-horizontal-list figma-popular-list" ref={popularListRef}>
          {popularCards.map((card, index) => (
            <article
              className={
                index === featuredIndex
                  ? 'figma-popular-card figma-popular-card--featured'
                  : 'figma-popular-card'
              }
              key={card.image}
            >
              <img src={card.image} alt="" />
              <div className="card-gradient" aria-hidden="true" />
              <p>{card.category}</p>
              <h4>{card.title}</h4>
              <span>{card.description}</span>
            </article>
          ))}
        </div>
      </section>

      <div className="figma-divider figma-divider--first" aria-hidden="true" />

      <section className="figma-events-section" aria-label={eventSectionTitle}>
        <h3>{eventSectionTitle}</h3>
        <div className="figma-horizontal-list figma-event-list">
          {eventCards.map((event) => (
            <article className="figma-event-card" key={event.id ?? event.title}>
              <img
                className="event-image"
                src={event.image}
                alt=""
                onError={(errorEvent) => {
                  if (!event.fallbackImage) {
                    return;
                  }

                  errorEvent.currentTarget.onerror = null;
                  errorEvent.currentTarget.src = event.fallbackImage;
                }}
              />
              <h4>{event.title}</h4>
              <EventMeta icon={locationIcon} text={event.location} />
              <EventMeta icon={calendarIcon} text={event.date} />
              <EventMeta icon={timeIcon} text={event.duration} />
            </article>
          ))}
        </div>
      </section>

      <div className="figma-divider figma-divider--second" aria-hidden="true" />

      <section className="figma-tour-section" aria-label="도슨트 투어">
        <article className="figma-tour-card">
          <img src={dancheongTour} alt="" />
          <div className="card-gradient" aria-hidden="true" />
          <button className="figma-tour-fab" type="button" aria-label="도슨트 듣기">
            <img src={headsetIcon} alt="" />
          </button>
          <h3>단청, 색으로 쓴<br />불교 철학</h3>
          <p>
            금산사를 물들인 색과 무늬를 따라가는 여정<br />
            단청의 색, 공예 기법, 전각별 무늬를<br />
            절로의 도슨트와 함께 살펴보세요.
          </p>
          <button className="figma-tour-cta" type="button" onClick={() => onMoveTab('scan')}>
            도슨트 투어 살펴보기 <span>→</span>
          </button>
        </article>
      </section>
    </section>
  );
}

function EventMeta({ icon, text }) {
  return (
    <p className="figma-event-meta">
      <img src={icon} alt="" />
      <span>{text}</span>
    </p>
  );
}
