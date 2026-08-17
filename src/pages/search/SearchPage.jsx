import { useCallback, useEffect, useRef, useState } from 'react';

import searchIcon from '../../assets/figma/search.svg';
import categoryHeritageImage from '../../assets/figma/search-category-heritage.png';
import categoryTempleImage from '../../assets/figma/search-category-temple.png';
import categoryEventImage from '../../assets/figma/search-category-event.png';
import categoryTourImage from '../../assets/figma/search-category-tour.png';
import stampBookImage from '../../assets/figma/search-stamp-book.png';
import fallbackMapImage from '../../assets/figma/search-map-fallback.png';
import stampPaperMokgeo from '../../assets/figma/map-stamp-paper-mokgeo.svg';
import stampPaperBell from '../../assets/figma/map-stamp-paper-bell.svg';
import stampPaperSeokryeondae from '../../assets/figma/map-stamp-paper-seokryeondae.svg';
import stampArtMokgeo from '../../assets/figma/map-stamp-art-mokgeo.svg';
import stampArtBell from '../../assets/figma/map-stamp-art-bell.svg';
import stampArtSeokryeondae from '../../assets/figma/map-stamp-art-seokryeondae.svg';

const NAVER_MAP_KEY =
  import.meta.env.VITE_NAVER_MAP_NCP_KEY_ID ?? import.meta.env.VITE_NAVER_MAP_CLIENT_ID ?? '';
const STAMP_TOTAL = 10;

const categories = [
  {
    title: '문화유산',
    image: categoryHeritageImage,
    className: 'figma-search-category--heritage',
  },
  {
    title: '사찰',
    image: categoryTempleImage,
    className: 'figma-search-category--temple',
  },
  {
    title: '템플스테이·행사',
    image: categoryEventImage,
    className: 'figma-search-category--event',
  },
  {
    title: '테마 투어',
    image: categoryTourImage,
    className: 'figma-search-category--tour',
  },
];

const foundStamps = [
  {
    id: 'mokgeo',
    title: '범종각 목어',
    place: '김제 금산사',
    date: '2026.7.19',
    count: 6,
    lat: 35.72298,
    lng: 127.05314,
    color: '#3e7842',
    paper: stampPaperMokgeo,
    art: stampArtMokgeo,
    fallbackPosition: { left: '34%', top: '35%' },
    description:
      '잠잘 때에도 눈을 뜨고 자는 물고기처럼 항상 깨어 있으라는 뜻을 담은 불교 의식구입니다.',
  },
  {
    id: 'bell',
    title: '범종',
    place: '김제 금산사',
    date: '2026.7.5',
    count: 4,
    lat: 35.72282,
    lng: 127.05345,
    color: '#658d85',
    paper: stampPaperBell,
    art: stampArtBell,
    fallbackPosition: { left: '45%', top: '31%' },
    description:
      '맑고 청정한 종소리로 중생의 고통을 덜고 불법의 울림을 전한다는 의미를 지닙니다.',
  },
  {
    id: 'seokryeondae',
    title: '석련대',
    place: '김제 금산사',
    date: '2026.7.5',
    count: 3,
    lat: 35.72265,
    lng: 127.05375,
    color: '#ff5025',
    paper: stampPaperSeokryeondae,
    art: stampArtSeokryeondae,
    fallbackPosition: { left: '55%', top: '36%' },
    description:
      '돌로 만든 연꽃 모양의 불상 받침대로, 통일신라와 고려 사이의 과도기적 조형미가 보입니다.',
  },
];

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m4.5 6.8 5-2.3 5 2.3 5-2.3v12.7l-5 2.3-5-2.3-5 2.3V6.8Z" />
      <path d="M9.5 4.5v12.7" />
      <path d="M14.5 6.8v12.7" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M15 5 8 12l7 7" />
    </svg>
  );
}

function getNaverMarkerContent(stamp) {
  return `
    <button class="figma-map-native-marker" style="--stamp-color:${stamp.color}" type="button">
      <span class="figma-map-marker-stamp">
        <span class="figma-map-marker-art">
          <img src="${stamp.art}" alt="" />
        </span>
      </span>
      <i>${stamp.count}</i>
      <strong>${stamp.title}</strong>
    </button>
  `;
}

function loadNaverMaps() {
  if (!NAVER_MAP_KEY) {
    return Promise.reject(new Error('missing-naver-map-key'));
  }

  if (window.naver?.maps) {
    return Promise.resolve(window.naver.maps);
  }

  if (window.__jeolloNaverMapsPromise) {
    return window.__jeolloNaverMapsPromise;
  }

  window.__jeolloNaverMapsPromise = new Promise((resolve, reject) => {
    const callbackName = '__jeolloNaverMapsReady';
    const script = document.createElement('script');

    window[callbackName] = () => {
      if (window.naver?.maps) {
        resolve(window.naver.maps);
      } else {
        reject(new Error('naver-map-not-ready'));
      }
    };

    window.navermap_authFailure = () => {
      reject(new Error('naver-map-auth-failed'));
    };

    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(
      NAVER_MAP_KEY,
    )}&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => reject(new Error('naver-map-script-failed'));
    document.head.appendChild(script);
  });

  return window.__jeolloNaverMapsPromise;
}

function StampMarker({ stamp, selected, onSelect }) {
  return (
    <button
      className={selected ? 'figma-map-stamp-marker is-selected' : 'figma-map-stamp-marker'}
      type="button"
      style={{
        '--stamp-color': stamp.color,
        left: stamp.fallbackPosition.left,
        top: stamp.fallbackPosition.top,
      }}
      onClick={() => onSelect(stamp.id)}
    >
      <span className="figma-map-marker-stamp" aria-hidden="true">
        <span className="figma-map-marker-art">
          <img src={stamp.art} alt="" />
        </span>
      </span>
      <i>{stamp.count}</i>
      <strong>{stamp.title}</strong>
    </button>
  );
}

function StampCard({ stamp, selected, onSelect }) {
  return (
    <button
      className={selected ? 'figma-map-stamp-card is-selected' : 'figma-map-stamp-card'}
      type="button"
      style={{ '--stamp-color': stamp.color }}
      onClick={() => onSelect(stamp.id)}
    >
      <img className="figma-map-stamp-card-paper" src={stamp.paper} alt="" aria-hidden="true" />
      <span className="figma-map-stamp-card-title">{stamp.place} {stamp.title}</span>
      <span className="figma-map-stamp-card-copy">{stamp.description}</span>
      <span className="figma-map-stamp-card-date">({stamp.date})</span>
      <span className="figma-map-stamp-card-art" aria-hidden="true">
        <img src={stamp.art} alt="" />
      </span>
      <strong>{stamp.title}</strong>
    </button>
  );
}

function SearchLanding({ onOpenMap }) {
  return (
    <section
      className="figma-search-screen"
      data-node-id="15:1149"
      data-name="iPhone 16 - 26"
      aria-label="탐색"
    >
      <label className="figma-search-field">
        <span>검색</span>
        <img src={searchIcon} alt="" aria-hidden="true" />
        <input type="search" placeholder="검색..." />
      </label>

      <h1 className="figma-search-title">절로 떠나는 발견의 시간</h1>

      <div className="figma-search-category-grid" aria-label="탐색 카테고리">
        {categories.map((category) => (
          <button
            className={`figma-search-category ${category.className}`}
            type="button"
            key={category.title}
          >
            <img src={category.image} alt="" aria-hidden="true" />
            <span aria-hidden="true" />
            <strong>{category.title}</strong>
          </button>
        ))}
      </div>

      <div className="figma-search-divider" aria-hidden="true" />

      <section className="figma-search-stamp-section" aria-label="스탬프 도감">
        <h2>스탬프 도감</h2>
        <img className="figma-search-stamps" src={stampBookImage} alt="" aria-hidden="true" />
        <button className="figma-search-map-button" type="button" onClick={onOpenMap}>
          <MapIcon />
          지도로 보기
        </button>
      </section>
    </section>
  );
}

function SearchMap({ onSelectStamp, selectedStampId }) {
  const mapElementRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [mapStatus, setMapStatus] = useState(NAVER_MAP_KEY ? 'loading' : 'fallback');

  useEffect(() => {
    let disposed = false;

    if (!mapElementRef.current) {
      return undefined;
    }

    if (!NAVER_MAP_KEY) {
      setMapStatus('fallback');
      return undefined;
    }

    setMapStatus('loading');

    loadNaverMaps()
      .then((maps) => {
        if (disposed || !mapElementRef.current) {
          return;
        }

        const center = new maps.LatLng(35.722923, 127.053411);
        const map = new maps.Map(mapElementRef.current, {
          center,
          zoom: 17,
          mapDataControl: false,
          scaleControl: false,
          logoControl: false,
          zoomControl: false,
        });

        mapInstanceRef.current = map;
        markersRef.current = foundStamps.map((stamp) => {
          const marker = new maps.Marker({
            position: new maps.LatLng(stamp.lat, stamp.lng),
            map,
            title: stamp.title,
            icon: {
              content: getNaverMarkerContent(stamp),
              anchor: new maps.Point(46, 54),
            },
          });

          maps.Event.addListener(marker, 'click', () => {
            onSelectStamp(stamp.id);
            map.panTo(new maps.LatLng(stamp.lat, stamp.lng));
          });

          return marker;
        });

        setMapStatus('ready');
      })
      .catch(() => {
        if (!disposed) {
          setMapStatus('fallback');
        }
      });

    return () => {
      disposed = true;
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      mapInstanceRef.current = null;
    };
  }, [onSelectStamp]);

  useEffect(() => {
    const selectedStamp = foundStamps.find((stamp) => stamp.id === selectedStampId);
    const maps = window.naver?.maps;

    if (!selectedStamp || !maps || !mapInstanceRef.current) {
      return;
    }

    mapInstanceRef.current.panTo(new maps.LatLng(selectedStamp.lat, selectedStamp.lng));
  }, [selectedStampId]);

  return (
    <>
      <div
        ref={mapElementRef}
        className={mapStatus === 'ready' ? 'figma-map-canvas' : 'figma-map-canvas is-hidden'}
        aria-hidden={mapStatus !== 'ready'}
      />

      {mapStatus !== 'ready' ? (
        <div className="figma-map-fallback">
          <img src={fallbackMapImage} alt="" aria-hidden="true" />
          {foundStamps.map((stamp) => (
            <StampMarker
              stamp={stamp}
              selected={stamp.id === selectedStampId}
              onSelect={onSelectStamp}
              key={stamp.id}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

export function SearchPage() {
  const [isMapView, setIsMapView] = useState(false);
  const [sheetState, setSheetState] = useState('expanded');
  const [selectedStampId, setSelectedStampId] = useState(foundStamps[2].id);
  const dragStartYRef = useRef(null);
  const dragMovedRef = useRef(false);
  const selectedStamp = foundStamps.find((stamp) => stamp.id === selectedStampId) ?? foundStamps[0];
  const collectionProgress = `${(foundStamps.length / STAMP_TOTAL) * 100}%`;

  const selectStamp = useCallback((stampId) => {
    setSelectedStampId(stampId);
    setSheetState('expanded');
  }, []);

  const handleHandlePointerDown = (event) => {
    dragStartYRef.current = event.clientY;
    dragMovedRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleHandlePointerMove = (event) => {
    if (dragStartYRef.current === null) {
      return;
    }

    if (Math.abs(event.clientY - dragStartYRef.current) > 8) {
      dragMovedRef.current = true;
    }
  };

  const handleHandlePointerUp = (event) => {
    if (dragStartYRef.current === null) {
      return;
    }

    const deltaY = event.clientY - dragStartYRef.current;

    if (deltaY > 24) {
      setSheetState('collapsed');
    }

    if (deltaY < -24) {
      setSheetState('expanded');
    }

    dragStartYRef.current = null;
  };

  if (!isMapView) {
    return <SearchLanding onOpenMap={() => setIsMapView(true)} />;
  }

  return (
    <section
      className={`figma-map-screen figma-map-screen--sheet-${sheetState}`}
      data-node-id="16:1235"
      data-name="iPhone 16 - 29"
      aria-label="스탬프 지도"
    >
      <SearchMap selectedStampId={selectedStampId} onSelectStamp={selectStamp} />
      <div className="figma-map-top-gradient" aria-hidden="true" />

      <button
        className="figma-map-back-button"
        type="button"
        aria-label="탐색 화면으로 돌아가기"
        onClick={() => setIsMapView(false)}
      >
        <BackIcon />
      </button>

      <label className="figma-map-search-field">
        <span>검색</span>
        <img src={searchIcon} alt="" aria-hidden="true" />
        <input type="search" placeholder="검색..." />
      </label>

      <aside className="figma-map-sheet" aria-label="우표 스탬프 모음">
        <button
          className="figma-map-sheet-handle"
          type="button"
          aria-label={sheetState === 'expanded' ? '스탬프 모음 내리기' : '스탬프 모음 올리기'}
          onPointerDown={handleHandlePointerDown}
          onPointerMove={handleHandlePointerMove}
          onPointerUp={handleHandlePointerUp}
          onClick={() => {
            if (!dragMovedRef.current) {
              setSheetState((current) => (current === 'expanded' ? 'collapsed' : 'expanded'));
            }
          }}
        >
          <span />
        </button>

        <div className="figma-map-sheet-body">
          <div className="figma-map-stamp-tabs" role="tablist" aria-label="도감 종류">
            <button className="active" type="button">
              우표 스탬프
            </button>
            <button type="button">문화유산 도감</button>
          </div>

          <article className="figma-map-stamp-detail" aria-live="polite">
            <span>{selectedStamp.date}</span>
            <strong>{selectedStamp.title}</strong>
            <p>{selectedStamp.description}</p>
          </article>

          <div className="figma-map-stamp-progress">
            <span aria-hidden="true">
              <i style={{ width: collectionProgress }} />
            </span>
            <strong>{foundStamps.length} / {STAMP_TOTAL} 발견</strong>
          </div>

          <div className="figma-map-stamp-list" aria-label="발견한 스탬프">
            {foundStamps.map((stamp) => (
              <StampCard
                stamp={stamp}
                selected={stamp.id === selectedStampId}
                onSelect={selectStamp}
                key={stamp.id}
              />
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
}
