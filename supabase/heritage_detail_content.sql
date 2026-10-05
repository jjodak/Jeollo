-- Supabase SQL Editor에서 실행: 이미 content 컬럼이 있으면 그대로 유지합니다.
alter table public.heritages
  add column if not exists content jsonb not null default '{}'::jsonb;

-- 세부사항은 content.detail.facts에 표시할 순서대로 저장합니다.
-- label 또는 value가 없거나 공백뿐인 항목은 화면에서 숨깁니다.
-- facts가 비어 있으면 '세부 사항' 제목과 영역도 숨깁니다.
-- 아래는 저장 형식 예시입니다. 실제 문화유산 ID, 항목명, 내용을 입력하고
-- 주석을 해제해 실행하세요. key는 아이콘 종류이며 항목명은 자유롭게 입력합니다.
-- era(시대), material(재질), dimensions(크기), designation(지정 정보), collection(소장 정보).
-- key 없이 저장한 기존 항목도 알려진 항목명으로 아이콘을 찾습니다.
-- 기존 도슨트/스탬프 및 detail.text 등 다른 내용은 유지합니다.
/*
update public.heritages
set content = jsonb_set(
  coalesce(content, '{}'::jsonb),
  '{detail}',
  coalesce(content->'detail', '{}'::jsonb) || jsonb_build_object(
    'facts', jsonb_build_array(
      jsonb_build_object('key', 'era', 'label', '시대', 'value', '실제 내용'),
      jsonb_build_object('key', 'material', 'label', '재질', 'value', ''),
      jsonb_build_object('key', 'dimensions', 'label', '크기', 'value', ''),
      jsonb_build_object('key', 'designation', 'label', '지정 정보', 'value', ''),
      jsonb_build_object('key', 'collection', 'label', '소장 정보', 'value', '')
    )
  ),
  true
), updated_at = now()
where id = '실제_문화유산_ID';
*/

-- 저장 내용 확인 (조회만 합니다).
select id, name, content->'detail' as detail
from public.heritages
where is_active = true
order by name;
