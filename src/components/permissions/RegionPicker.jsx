import { useEffect, useRef, useState, useId } from 'react';
import { REGIONS } from '../../services/regionService.js';

export function RegionPicker({ selectedRegion, onSelect, onClose }) {
  const dialog = useRef(null);
  const titleId = useId();
  const selectId = useId();
  const [region, setRegion] = useState(selectedRegion || '전국');
  useEffect(() => { dialog.current.showModal(); }, []);
  return <dialog ref={dialog} className="account-dialog region-picker" aria-labelledby={titleId} onCancel={onClose}>
    <h2 id={titleId}>지역 선택</h2>
    <p>선택한 지역에 등록된 사찰을 보여드려요.</p>
    <label htmlFor={selectId}>지역</label><select id={selectId} value={region} onChange={(event) => setRegion(event.target.value)}>{REGIONS.map((name) => <option key={name}>{name}</option>)}</select>
    <button className="account-primary" type="button" onClick={() => onSelect(region)}>이 지역으로 보기</button>
    <button className="account-text" type="button" onClick={onClose}>취소</button>
  </dialog>;
}
