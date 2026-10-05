const labels = {
  era: ['시대', '제작 시대', '한국시대'],
  material: ['재질', '재료', '주 재료'],
  dimensions: ['크기', '규격', '높이'],
  designation: ['지정 정보', '지정', '문화재 지정', '보물', '국보'],
  collection: ['소장 정보', '소장', '소장처', '소유', '소유자', '관리자'],
};

export function getHeritageFactKey(fact) {
  if (Object.hasOwn(labels, fact?.key)) return fact.key;
  const label = typeof fact?.label === 'string' ? fact.label.trim() : '';
  return Object.keys(labels).find((key) => labels[key].includes(label)) ?? '';
}
