# 사진 인식과 스탬프 워크플로우

사진 촬영/업로드 → 인식 성공 → 등록된 도슨트 준비 및 스탬프 자동 획득 →
도슨트 재생 → 더보기(문화유산 상세와 도감) → 탐색의 우표 스탬프/문화유산 도감.
탐색에서 선택한 문화유산은 상세 화면과 도슨트로 다시 연결됩니다.

## 콘텐츠 읽기

- `heritageContentService.js`: Supabase `heritages`, `heritage_assets`, `temples` 조회.
- `src/utils/heritageContent.js`: DB 행과 인식 응답을 화면에서 사용하는 공통 객체로 변환.
- 현재 인식 응답의 설명·원고·선택 콘텐츠를 재사용합니다. 이전 형식의 응답에만
  문화유산 단건 조회를 수행하며, 연결된 사찰 조회는 1분 동안 재사용합니다.
- 도슨트 원고는 `heritages.docent_text`, 없으면 `description`을 사용합니다.
  둘 다 비어 있으면 준비 중 상태를 표시하고 재생을 비활성화합니다.
- 음성은 기존 브라우저 Web Speech로 재생합니다. 별도의 AI 원고 생성이나
  서버 음성 합성 요청은 추가하지 않았습니다.
- 문화재 썸네일과 문화유산 도감 이미지는 `heritage_assets.thumbnail_image_url`을
  우선 사용하고, 없으면 기존 `heritages.thumbnail_url`과 선택 `content` 이미지로
  fallback합니다. 미획득 문화유산도 도감 탭에서는 이 이미지를 표시합니다.
- 스탬프 이미지는 `heritage_assets.stamp_image_url`을 우선 사용하고,
  없으면 선택 필드 `heritages.content.stamp.imageUrl`에서 읽습니다.
  자산 테이블이나 이미지 값이 아직 없어도 기존 정보와 빈 이미지 영역으로 동작합니다.
- 획득한 스탬프도 탐색에서 도감을 조회할 때 현재 DB 콘텐츠로 표시합니다.
  DB 조회 실패 시 브라우저에 저장된 획득 시점의 정보를 유지합니다.

## 추후 DB 등록 형식

`supabase/migrations/20260908_heritage_assets.sql`은 문화유산별 썸네일과
스탬프 이미지만 담는 `heritage_assets` 테이블을 추가합니다.
`supabase/migrations/20260908_heritage_content.sql`은 선택 콘텐츠 필드를 추가하는
SQL입니다. 이번 구현에서는 원격 DB에 적용하지 않았습니다.
관리자 SQL 경로로 적용한 뒤 각 문화유산의 이미지 자산은 다음처럼 등록합니다.

```sql
insert into public.heritage_assets (
  id,
  thumbnail_image_url,
  stamp_image_url
) values (
  'heritage-id',
  'https://your-public-storage.example/thumbnails/heritage.jpg',
  'https://your-public-storage.example/stamps/heritage.png'
)
on conflict (id) do update set
  thumbnail_image_url = excluded.thumbnail_image_url,
  stamp_image_url = excluded.stamp_image_url;
```

도슨트 제목, 상세 설명, 세부 정보는 각 문화유산의 `content`에 다음 형태의 JSON을
넣습니다. 예시 문구와 경로는 구조 설명용이며 앱에 기본 콘텐츠로 삽입되지 않습니다.

```json
{
  "docent": {
    "title": "도슨트 제목",
    "subtitle": "짧은 부제"
  },
  "stamp": {
    "title": "스탬프 이름",
    "description": "스탬프 설명",
    "color": "#497945"
  },
  "detail": {
    "text": "더보기를 눌렀을 때 이어지는 상세 설명",
    "facts": [
      { "label": "시대", "value": "등록할 시대 정보" },
      { "label": "재질", "value": "등록할 재질 정보" }
    ]
  }
}
```

원고 본문은 계속 `docent_text`, 요약 설명은 `description`에 넣습니다.
이미지는 브라우저에서 읽을 수 있는 공개 HTTP(S) URL 또는 앱 내 `/...` 경로를
사용합니다. `paperUrl`이 없으면 기존 Figma 우표 종이를 사용합니다. 이미지가 없거나
불러오지 못하면 회색 영역을 표시하며, 다른 문화유산의 그림으로 대체하지 않습니다.
브라우저의 publishable key에 대한 SELECT RLS 정책과 이미지 읽기 권한이 필요합니다.
키 값은 이 문서나 소스에 넣지 않습니다.

## 획득 기록

- `stampCollectionService.js`의 `readStampCollection`, `acquireStamp`가 저장 경계입니다.
- 현재는 로그인 없는 프로토타입으로 `localStorage`의 `jeollo.stamps.v1`에 저장합니다.
- 문화유산 ID별 한 번만 획득하며 재인식해도 최초 획득일과 총 개수는 유지합니다.
- 인식 실패, 취소된/이탈한 인식 요청, 도감 열람만으로는 획득하지 않습니다.
- 촬영 원본과 압축 이미지 데이터는 저장하지 않습니다.
- 저장 실패 시 획득 성공을 표시하지 않고 재시도를 제공하며 도슨트는 계속 열 수 있습니다.
- 저장 데이터가 손상되면 덮어쓰지 않고 오류 상태를 표시합니다.
- DB의 전체 도감과 획득 기록을 합쳐 전체 수를 계산합니다. 임의의 10개나 예시 획득
  내역은 넣지 않습니다. 사찰이 연결된 스캔 상세 화면은 해당 사찰 도감만 표시합니다.

추후 계정별 DB 저장 시 이 저장 서비스를 인증된 서버 API로 교체합니다.
`(user_id, heritage_id)` 유일 제약과 서버의 인식 검증을 적용해야 하며, 현재 로컬 기록은
기기 간 동기화되거나 서버가 검증한 방문 인증을 의미하지 않습니다.

## 검증

```bash
npm test
npm run test:e2e
npm run build
```

E2E는 설치된 Google Chrome을 사용하고 5183 포트에 임시 Vite 서버를 시작합니다.
테스트 전용 URL과 공개 키 자리표시자를 사용하므로 실제 환경변수가 없어도 실행됩니다.
Supabase와 인식 API 응답은 테스트에서 대체하므로 실제 OpenAI 호출이나 DB 쓰기가
발생하지 않습니다. 320px/393px 모바일과 1280px 데스크톱에서 동선을 확인합니다.
실제 기기 카메라 권한과 음성 출력은 HTTPS 환경에서 별도로 확인해야 합니다.
