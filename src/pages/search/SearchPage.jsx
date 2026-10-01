import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCollection } from '../../components/CollectionProvider.jsx';
import { StampCard, formatStampDate } from '../../components/StampCard.jsx';

import searchIcon from '../../assets/figma/search.svg';
import categoryHeritageImage from '../../assets/figma/search-category-heritage.png';
import categoryTempleImage from '../../assets/figma/search-category-temple.png';
import categoryEventImage from '../../assets/figma/search-category-event.png';
import categoryTourImage from '../../assets/figma/search-category-tour.png';
import stampBookImage from '../../assets/figma/search-stamp-book.png';
import fallbackMapImage from '../../assets/figma/search-map-fallback.png';

const NAVER_MAP_KEY =
  import.meta.env.VITE_NAVER_MAP_NCP_KEY_ID ?? import.meta.env.VITE_NAVER_MAP_CLIENT_ID ?? '';

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
  const button = document.createElement('button');
  button.className = 'figma-map-native-marker';
  button.type = 'button';
  button.style.setProperty('--stamp-color', stamp.stamp.color);
  const frame = document.createElement('span');
  frame.className = 'figma-map-marker-stamp';
  const art = document.createElement('span');
  art.className = 'figma-map-marker-art';
  if (stamp.stamp.imageUrl) {
    const image = document.createElement('img');
    image.src = stamp.stamp.imageUrl;
    image.alt = '';
    art.append(image);
  }
  frame.append(art);
  const title = document.createElement('strong');
  title.textContent = stamp.name;
  button.append(frame, title);
  return button.outerHTML;
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

function SearchLanding({ onOpenMap, onOpenCatalog, stamps }) {
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
            onClick={category.title === '문화유산' ? onOpenCatalog : undefined}
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
        <span className="search-stamp-count">{stamps.length}개 획득</span>
        {stamps.length ? (
          <div className="search-stamp-preview collection-stamp-list">
            {stamps.slice(0, 3).map((heritage) => <StampCard key={heritage.id} heritage={heritage} onSelect={() => onOpenMap(heritage.id)} />)}
          </div>
        ) : <img className="figma-search-stamps" src={stampBookImage} alt="" aria-hidden="true" />}
        <button className="figma-search-map-button" type="button" onClick={onOpenMap}>
          <MapIcon />
          내 스탬프 보기
        </button>
      </section>
    </section>
  );
}

function SearchMap({ onSelectStamp, selectedStampId, stamps }) {
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

        const center = new maps.LatLng(stamps[0]?.latitude ?? 35.722923, stamps[0]?.longitude ?? 127.053411);
        const map = new maps.Map(mapElementRef.current, {
          center,
          zoom: 17,
          mapDataControl: false,
          scaleControl: false,
          logoControl: false,
          zoomControl: false,
        });

        mapInstanceRef.current = map;
        markersRef.current = stamps.map((stamp) => {
          const marker = new maps.Marker({
            position: new maps.LatLng(stamp.latitude, stamp.longitude),
            map,
            title: stamp.name,
            icon: {
              content: getNaverMarkerContent(stamp),
              anchor: new maps.Point(46, 54),
            },
          });

          maps.Event.addListener(marker, 'click', () => {
            onSelectStamp(stamp.id);
            map.panTo(new maps.LatLng(stamp.latitude, stamp.longitude));
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
  }, [onSelectStamp, stamps]);

  useEffect(() => {
    const selectedStamp = stamps.find((stamp) => stamp.id === selectedStampId);
    const maps = window.naver?.maps;

    if (!selectedStamp || !maps || !mapInstanceRef.current) {
      return;
    }

    mapInstanceRef.current.panTo(new maps.LatLng(selectedStamp.latitude, selectedStamp.longitude));
  }, [selectedStampId, stamps, mapStatus]);

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
          <p className="map-availability-note">{mapStatus === 'loading' ? '지도를 불러오는 중이에요' : '지도를 표시할 수 없어요'}</p>
        </div>
      ) : null}
    </>
  );
}

export function SearchPage({ collectionRequest, onOpenHeritage, onMoveTab }) {
  const { entries, stamps, status, storageError, refreshCatalog, syncError, refreshCollection } = useCollection();
  const [isMapView, setIsMapView] = useState(Boolean(collectionRequest));
  const [sheetState, setSheetState] = useState('expanded');
  const [selectedStampId, setSelectedStampId] = useState(collectionRequest?.heritageId ?? null);
  const [collectionTab, setCollectionTab] = useState(() => collectionRequest?.heritageId
    && !stamps.some((stamp) => stamp.id === collectionRequest.heritageId) ? 'catalog' : 'stamps');
  const [query, setQuery] = useState('');
  const dragStartYRef = useRef(null);
  const dragMovedRef = useRef(false);
  const displayedEntries = (collectionTab === 'stamps' ? stamps : entries).filter((entry) =>
    `${entry.name} ${entry.place} ${entry.stamp.title}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selectedStamp = displayedEntries.find((stamp) => stamp.id === selectedStampId) ?? displayedEntries[0];
  const collectionProgress = `${entries.length ? (stamps.length / entries.length) * 100 : 0}%`;
  const mapStamps = useMemo(() => stamps.filter((stamp) => Number.isFinite(stamp.latitude) && Number.isFinite(stamp.longitude)), [stamps]);

  const selectStamp = useCallback((stampId) => {
    setSelectedStampId(stampId);
    setSheetState('expanded');
  }, []);

  const openMap = (heritageId = null) => {
    setSelectedStampId(typeof heritageId === 'string' ? heritageId : null);
    setIsMapView(true);
    setCollectionTab('stamps');
  };

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
    return <SearchLanding stamps={stamps} onOpenMap={openMap}
      onOpenCatalog={() => { setCollectionTab('catalog'); setIsMapView(true); }} />;
  }

  return (
    <section
      className={`figma-map-screen figma-map-screen--sheet-${sheetState}`}
      data-node-id="16:1235"
      data-name="iPhone 16 - 29"
      aria-label="스탬프 지도"
    >
      <SearchMap stamps={mapStamps} selectedStampId={selectedStamp?.id} onSelectStamp={selectStamp} />
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
        <input type="search" placeholder="문화유산 또는 사찰 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
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

        <div className="figma-map-stamp-tabs" role="tablist" aria-label="도감 종류">
          <button className={collectionTab === 'stamps' ? 'active' : ''} type="button"
            role="tab" id="stamps-tab" aria-selected={collectionTab === 'stamps'} aria-controls="collection-panel"
            onClick={() => setCollectionTab('stamps')}>
            우표 스탬프
          </button>
          <button className={collectionTab === 'catalog' ? 'active' : ''} type="button"
            role="tab" id="catalog-tab" aria-selected={collectionTab === 'catalog'} aria-controls="collection-panel"
            onClick={() => setCollectionTab('catalog')}>문화유산 도감</button>
        </div>

        <div className="figma-map-sheet-body" role="tabpanel" id="collection-panel" aria-labelledby={collectionTab === 'stamps' ? 'stamps-tab' : 'catalog-tab'}>
          {storageError ? <p className="collection-empty-copy" role="alert">저장된 스탬프를 읽거나 저장하지 못했어요. 브라우저 저장 공간을 확인해주세요.</p> : null}
          {syncError ? <p className="collection-empty-copy" role="alert">{syncError} <button className="collection-text-action" onClick={refreshCollection}>다시 시도</button></p> : null}
          {status === 'error' ? <p className="collection-empty-copy" role="status">최신 도감을 불러오지 못했어요. <button className="collection-text-action" type="button" onClick={refreshCatalog}>다시 불러오기</button></p> : null}
          <div className="figma-map-stamp-progress">
            <span aria-hidden="true">
              <i style={{ width: collectionProgress }} />
            </span>
            <strong>{status === 'ready' ? `${stamps.length} / ${entries.length} 발견` : `${stamps.length}개 획득`}</strong>
          </div>

          {selectedStamp ? <article className="figma-map-stamp-detail" aria-live="polite">
            <span>{selectedStamp.acquiredAt ? `${formatStampDate(selectedStamp.acquiredAt)} 획득` : '아직 획득하지 않았어요'}</span>
            <strong>{selectedStamp.name}</strong>
            {selectedStamp.place ? <span>{selectedStamp.place}</span> : null}
            <p>{selectedStamp.stamp.description || '아직 등록된 설명이 없어요.'}</p>
            <button className="collection-text-action" type="button" onClick={() => onOpenHeritage(selectedStamp)}>더보기 · 도슨트</button>
          </article> : (
            <div className="collection-empty">
              <h2>{query ? '검색 결과가 없어요' : status === 'loading' ? '도감을 불러오는 중이에요' : collectionTab === 'stamps' ? '아직 획득한 스탬프가 없어요' : '등록된 문화유산이 없어요'}</h2>
              {!query && collectionTab === 'stamps' ? <button className="collection-primary-action" type="button" onClick={() => onMoveTab('scan')}>문화유산 스캔하기</button> : null}
            </div>
          )}

          <div className="collection-stamp-list" aria-label={collectionTab === 'stamps' ? '획득한 스탬프' : '전체 문화유산'}>
            {displayedEntries.map((stamp) => (
              <StampCard
                heritage={stamp}
                selected={stamp.id === selectedStamp?.id}
                onSelect={(heritage) => selectStamp(heritage.id)}
                variant={collectionTab === 'catalog' ? 'catalog' : 'stamp'}
                key={stamp.id}
              />
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
}
