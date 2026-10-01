export const REGIONS = ['전국', '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
const aliases = { 충청북도: '충북', 충청남도: '충남', 전라북도: '전북', 전북특별자치도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남' };

export function templeMatchesRegion(temple, region) {
  if (!region || region === '전국') return true;
  const address = String(temple.address || temple.addr1 || temple.location || '').trim();
  const province = address.split(/\s+/)[0];
  return (aliases[province] || province).startsWith(region);
}
