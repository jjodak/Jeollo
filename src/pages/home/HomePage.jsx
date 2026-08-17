import { useEffect, useRef, useState } from 'react';
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
import timeIcon from '../../assets/figma/time.svg';

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

const eventCards = [
  {
    image: eventHwaeomsa,
    title: '화엄사 ‘2026 화야몽’\n야간 인문 프로그램',
    location: '전남 구례 화엄사',
    date: '7월 18일',
    duration: '약 35분',
  },
  {
    image: eventFood,
    title: '사찰음식 체험갑니다.\n선운사로!',
    location: '전북 고창 선운사',
    date: '7월 3일 ~ 7월 31일',
    duration: '약 60분',
  },
];

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
        <img className="figma-home-image" src={homeHero} alt="김제 금산사 전경" />
        <div className="figma-top-gradient" aria-hidden="true" />
        <div className="figma-bottom-gradient" aria-hidden="true" />

        <p className="figma-greeting">{greeting}</p>

        <div className="figma-place-copy">
          <p>추천 장소</p>
          <h2>김제 금산사</h2>
          <button type="button" onClick={() => onMoveTab('search')}>
            자세히 보기 <span>→</span>
          </button>
        </div>

        <div className="figma-slider" aria-hidden="true">
          <span />
          <span className="active" />
          <span />
          <span />
        </div>
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
            <article className="figma-event-card" key={event.title}>
              <img className="event-image" src={event.image} alt="" />
              <h4>{event.title}</h4>
              <EventMeta icon={locationIcon} text={event.location} />
              <EventMeta icon={calendarIcon} text={event.date} />
              <EventMeta icon={timeIcon} text={event.duration} />
            </article>
          ))}
          <div className="figma-event-placeholder" aria-hidden="true" />
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
