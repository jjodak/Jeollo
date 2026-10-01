import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { getActiveTemples, getNearbyActiveTemples } from '../../services/templeService.js';
import { useCurrentLocation } from '../../hooks/useCurrentLocation.js';
import { PermissionRequestDialog } from '../../components/permissions/PermissionRequestDialog.jsx';
import { PermissionNotice } from '../mypage/PermissionNotice.jsx';
import { templeMatchesRegion } from '../../services/regionService.js';
import { formatDistanceKm, getDistanceKm, hasValidCoordinates, toCoordinate } from '../../utils/coordinates.js';
import { TempleDetailPopup } from './TempleDetailPopup.jsx';
import { getSlideKey, useHeroCarousel } from './useHeroCarousel.js';
import { useFeaturedPopularCard, useHeroSnap } from './useHomeInteractions.js';

const HERO_RECOMMENDATION_LIMIT = 4;

const fallbackHeroImages = [homeHero, templeHero, eventHwaeomsa, dancheongTour];

function getTempleFallbackImage(index) {
  return fallbackHeroImages[index % fallbackHeroImages.length];
}

function createHeroSlidesFromTemples(temples) {
  return temples
    .slice(0, HERO_RECOMMENDATION_LIMIT)
    .map((temple, index) => ({
      id: temple.id,
      image: temple.image_url || getTempleFallbackImage(index),
      fallbackImage: getTempleFallbackImage(index),
      title: temple.name,
      alt: `${temple.name} 대표 이미지`,
      distanceKm: temple.distance_km,
      temple,
    }));
}

// Existing editorial cards have no remote content source yet.
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

function getEventCoordinates(event) {
  const coordinates = {
    latitude: toCoordinate(event.mapY, 90),
    longitude: toCoordinate(event.mapX, 180),
  };

  return hasValidCoordinates(coordinates) ? coordinates : null;
}

function getEventDistanceText(event, currentLocation) {
  if (!hasValidCoordinates(currentLocation)) {
    return null;
  }

  const eventCoordinates = getEventCoordinates(event);

  if (!eventCoordinates) {
    return null;
  }

  return formatDistanceKm(getDistanceKm(currentLocation, eventCoordinates));
}

function createEventCardFromApiEvent(event, index, currentLocation) {
  const fallbackImage = getEventPlaceholderImage(index);

  return {
    id: event.id,
    image: event.imageUrl || fallbackImage,
    fallbackImage,
    title: event.title,
    location: event.location || event.address || '장소 확인',
    date: event.dateText || formatEventDateRange(event.startDate, event.endDate),
    distance: getEventDistanceText(event, currentLocation),
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

function useNearbyHeroSlides(locationState, selectedRegion) {
  const [slides, setSlides] = useState([]);
  const { coordinates, status } = locationState;

  useEffect(() => {
    let isMounted = true;

    if (status === 'pending') {
      return undefined;
    }

    const request = hasValidCoordinates(coordinates) ? getNearbyActiveTemples({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      limit: HERO_RECOMMENDATION_LIMIT,
    }) : getActiveTemples();
    request
      .then((temples) => {
        if (isMounted) {
          setSlides(createHeroSlidesFromTemples(temples.filter((temple) => templeMatchesRegion(temple, selectedRegion))));
        }
      })
      .catch(() => {
        if (isMounted) {
          setSlides([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [coordinates, status, selectedRegion]);

  return slides;
}

function useMonthlyEventCards(date, currentLocation) {
  const [events, setEvents] = useState([]);
  const year = date.getFullYear();
  const month = date.getMonth();

  useEffect(() => {
    let isMounted = true;
    const queryDate = new Date(year, month, 1);

    setEvents([]);

    getMonthlyEvents({ date: queryDate })
      .then(({ events, error }) => {
        if (!isMounted) {
          return;
        }

        setEvents(error ? [] : events);
      })
      .catch(() => {
        if (isMounted) {
          setEvents([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [month, year]);

  return useMemo(
    () => events.map((event, index) => createEventCardFromApiEvent(event, index, currentLocation)),
    [currentLocation, events],
  );
}

export function HomePage({ onMoveTab, selectedRegion, onChooseRegion }) {
  const homeRef = useRef(null);
  const [selectedTempleSlide, setSelectedTempleSlide] = useState(null);
  const closeTemplePopup = useCallback(() => setSelectedTempleSlide(null), []);
  const today = useToday();
  const greeting = getGreeting(today);
  const eventSectionTitle = getEventSectionTitle(today);
  const currentLocationState = useCurrentLocation({ manual: Boolean(selectedRegion) });
  const heroSlides = useNearbyHeroSlides(currentLocationState, selectedRegion);
  const eventCards = useMonthlyEventCards(today, currentLocationState.coordinates);
  const {
    activeSlide: activeHero,
    activeIndex: heroIndex,
    slideTransition: heroSlideTransition,
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
      {currentLocationState.showPermissionRequest ? <PermissionRequestDialog type="geolocation" busy={currentLocationState.requesting}
        onAllow={currentLocationState.requestPermission} onClose={currentLocationState.skipPermission}
        onAlternative={() => { currentLocationState.skipPermission(); onChooseRegion(); }} /> : null}
      {currentLocationState.notice ? <PermissionNotice notice={currentLocationState.notice} onClose={currentLocationState.closeNotice} /> : null}
      <section className="figma-hero-section" aria-label="추천 장소">
        <div className="figma-hero-carousel" aria-label="추천 사진 목록" {...heroCarouselHandlers}>
          {heroSlideTransition?.previousSlide ? (
            <article
              className={`figma-hero-slide figma-hero-slide--leaving figma-hero-slide--${heroSlideTransition.direction}`}
              key={heroSlideTransition.key}
              aria-hidden="true"
            >
              <img
                className="figma-home-image"
                src={heroSlideTransition.previousSlide.image}
                alt=""
                onError={(event) => {
                  if (!heroSlideTransition.previousSlide.fallbackImage) {
                    return;
                  }

                  event.currentTarget.onerror = null;
                  event.currentTarget.src = heroSlideTransition.previousSlide.fallbackImage;
                }}
              />
            </article>
          ) : null}
          {activeHero ? (
            <article
              className={
                heroSlideTransition
                  ? `figma-hero-slide figma-hero-slide--entering figma-hero-slide--${heroSlideTransition.direction}`
                  : 'figma-hero-slide'
              }
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
        {selectedRegion ? <button className="figma-region-choice" type="button" onClick={onChooseRegion}>{selectedRegion} 사찰 보기 · 지역 변경</button> : null}

        {activeHero ? (
          <>
            <div className="figma-place-copy">
              <p>추천 장소</p>
              <h2>{activeHero.title}</h2>
              <button type="button" onClick={() => setSelectedTempleSlide(activeHero)}>
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
                  onClick={() => scrollToHeroSlide(index, { manual: true })}
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

      {selectedTempleSlide ? (
        <TempleDetailPopup
          slide={selectedTempleSlide}
          onClose={closeTemplePopup}
        />
      ) : null}

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
              <div className="figma-event-card-body">
                <h4>{event.title}</h4>
                <div className="figma-event-card-meta">
                  <EventMeta icon={locationIcon} text={event.location} />
                  <EventMeta icon={calendarIcon} text={event.date} />
                  {event.distance ? <EventMeta icon={timeIcon} text={event.distance} /> : null}
                </div>
              </div>
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
