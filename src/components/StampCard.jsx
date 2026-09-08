import stampPaper from '../assets/figma/map-stamp-paper-mokgeo.svg';

export function StampImage({ src, className = '', alt = '' }) {
  return (
    <span className={`stamp-image ${className}`}>
      {src ? <img key={src} src={src} alt={alt} onError={(event) => { event.currentTarget.hidden = true; }} /> : null}
    </span>
  );
}

export function formatStampDate(value) {
  return value ? new Date(value).toLocaleDateString('ko-KR') : '';
}

export function StampCard({ heritage, selected = false, onSelect }) {
  const found = Boolean(heritage.acquiredAt);
  return (
    <button
      className={`collection-stamp-card${selected ? ' is-selected' : ''}${found ? '' : ' is-locked'}`}
      type="button"
      onClick={() => onSelect(heritage)}
      aria-label={`${heritage.stamp.title}, ${found ? '획득한 스탬프' : '미획득'}`}
      aria-pressed={selected}
      style={{ '--stamp-color': heritage.stamp.color }}
    >
      <span className="collection-stamp-paper">
        <img className="collection-paper-image" src={heritage.stamp.paperUrl || stampPaper} alt="" onError={(event) => { event.currentTarget.src = stampPaper; }} />
        <span className="collection-stamp-place">{heritage.place || '문화유산'}</span>
        <StampImage src={found ? heritage.stamp.imageUrl : ''} />
        <span className="collection-stamp-date">{found ? formatStampDate(heritage.acquiredAt) : '미획득'}</span>
      </span>
      <strong>{heritage.stamp.title}</strong>
    </button>
  );
}
