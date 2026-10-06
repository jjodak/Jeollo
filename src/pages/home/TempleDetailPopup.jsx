import { useEffect } from 'react';
import { formatDistanceKm, toCoordinate } from '../../utils/coordinates.js';

function getTempleLocation(temple) {
  if (!temple) {
    return '';
  }

  return temple.address || temple.location || temple.addr1 || temple.place || '';
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getTempleDescription(temple) {
  if (!temple) {
    return '';
  }

  return text(temple.description) || text(temple.summary) || text(temple.overview);
}

function getTempleCoordinates(temple) {
  const latitude = toCoordinate(temple?.latitude, 90);
  const longitude = toCoordinate(temple?.longitude, 180);
  if (latitude === null || longitude === null) {
    return '';
  }

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export function TempleDetailPopup({ slide, onClose }) {
  const temple = slide?.temple ?? null;
  const title = temple?.name || slide?.title || '사찰 정보';
  const image = temple?.image_url || slide?.image;
  const fallbackImage = slide?.fallbackImage;
  const location = getTempleLocation(temple);
  const description = getTempleDescription(temple);
  const coordinates = getTempleCoordinates(temple);
  const distance = Number.isFinite(slide?.distanceKm) ? formatDistanceKm(slide.distanceKm) : '';

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="figma-temple-popup-backdrop" role="presentation" onClick={onClose}>
      <article
        className="figma-temple-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="figma-temple-popup-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="figma-temple-popup-close" type="button" onClick={onClose} aria-label="닫기">
          ×
        </button>
        <div className="figma-temple-popup-photo">
          {image ? (
            <img
              src={image}
              alt=""
              onError={(event) => {
                if (!fallbackImage) {
                  return;
                }

                event.currentTarget.onerror = null;
                event.currentTarget.src = fallbackImage;
              }}
            />
          ) : null}
        </div>
        <div className="figma-temple-popup-body">
          {distance ? <span className="figma-temple-popup-kicker">현재 위치에서 {distance}</span> : null}
          <h2 id="figma-temple-popup-title">{title}</h2>
          {location || coordinates ? (
            <dl>
              {location ? <div><dt>위치</dt><dd>{location}</dd></div> : null}
              {coordinates ? <div><dt>좌표</dt><dd>{coordinates}</dd></div> : null}
            </dl>
          ) : null}
          {description ? <p>{description}</p> : null}
        </div>
      </article>
    </div>
  );
}
