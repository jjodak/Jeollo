import stampPaper from '../assets/figma/stamp/stamp-paper-framed.svg';

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

export function StampCard({ heritage, selected = false, onSelect, variant = 'stamp' }) {
  const found = Boolean(heritage.acquiredAt);
  const isCatalog = variant === 'catalog';
  const imageSrc = isCatalog || found ? heritage.stamp.imageUrl : '';
  const statusText = isCatalog
    ? (found ? `${formatStampDate(heritage.acquiredAt)} 획득` : '미획득')
    : (found ? formatStampDate(heritage.acquiredAt) : '미획득');
  return (
    <button
      className={`collection-stamp-card${isCatalog ? ' is-catalog' : ''}${selected ? ' is-selected' : ''}${!isCatalog && !found ? ' is-locked' : ''}`}
      type="button"
      onClick={() => onSelect(heritage)}
      aria-label={`${heritage.stamp.title}, ${isCatalog ? '문화유산 도감' : found ? '획득한 스탬프' : '미획득'}`}
      aria-pressed={selected}
      style={{ '--stamp-color': heritage.stamp.color }}
    >
      <span className="collection-stamp-frame">
        <span className="collection-stamp-paper">
          <img className="collection-paper-image" src={stampPaper} alt="" />
          <strong className="collection-stamp-title">{heritage.stamp.title}</strong>
          <span className="collection-stamp-description">{heritage.stamp.description}</span>
          <StampImage src={imageSrc} alt={isCatalog ? heritage.name : ''} />
        </span>
      </span>
      <span className="collection-stamp-date">{statusText}</span>
    </button>
  );
}
