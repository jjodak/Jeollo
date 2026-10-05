# Docent Template 1

문화재 콘텐츠와 renderer를 분리한다. `DocentPlayer`의 renderer 목록에 `template_2`를
추가하면 같은 DB 관계로 다른 연출을 구현할 수 있다. 등록되지 않았거나 유효한 질문이 없는
템플릿, DB 미적용·조회 실패는 기존 기본 도슨트로 돌아간다. 문화재 이름으로 renderer를 선택하지 않는다.

## 확인한 Figma 흐름

파일 `rzbdoke4PKo2QHapufEf7g`, 선택 프레임 `1:4886`.
디자인 컨텍스트·원본 자산·스크린샷과 Plugin API의 실제 prototype reactions를 조회했다.
`get_motion_context`에는 keyframe motion이 없으며, 아래 동작은 프레임 간 Smart Animate다.
웹 프로토타입은 Figma 로그인 화면이 표시되어 브라우저 재생 대신 원본 reactions로 시간을 확인했다.

| 질문/구간 | 프레임 순서 | trigger / 전환 |
| --- | --- | --- |
| 인식 결과 | `1:82` → 선택 `1:4886` | 앱의 도슨트 듣기 버튼으로 연결 |
| 이 위에 부처님이? | `1:383` → `1:518` → `1:139` → `1:275` → `1:651` → 선택 | 모든 단계 클릭. 진입 300ms ease-in-out, 중간 300ms ease-out, 마지막 두 전환 200ms ease-in-out |
| 연대 추정 | `1:5339` → `1:5255` → 선택 | 클릭. 진입 100ms ease-out, 분리 300ms ease-in-out, 복귀 200ms ease-in-out |
| 어떻게 만들어졌을까? | `1:4971` → `1:5160` → `1:5053` → 선택 | 클릭. 모두 300ms ease-in-out |
| 로고 시작 | `1:5453` → `1:5430` → `1:5439` → `1:5442` | 최초 클릭 Smart Animate 400ms, 이후 각각 600ms 대기 + Dissolve 400ms |
| 다른 로고 시작 | `1:5456` → `1:5461` → `1:5466` | 최초 클릭 Dissolve 300ms, 이후 500ms 대기 + Dissolve 300ms |

로고 시작 시퀀스의 마지막 프레임에는 도슨트로 이어지는 연결이 없다. 인식 이후 요청 범위에
앱 공통 splash를 임의로 넣지 않았다. Template 1은 별도로 자동 Scene/Dissolve도 지원한다.
표시 이미지의 동일한 layer ID를 유지하면서 위치·크기·회전·투명도를 Web Animations API로
보간한다. 새 레이어/제거되는 레이어는 opacity로 드러나거나 사라진다. 감소된 모션 설정에서는
최종 상태를 즉시 표시한다. 페이지 이탈·질문 종료 때 음성과 타이머를 정리한다.
Dissolve는 이전 Scene의 레이어를 전환 시간 동안 보존해 새 Scene과 교차 페이드한다.
같은 layer ID의 이미지 URL이나 위치가 바뀌어도 이전 이미지가 즉시 교체되지 않는다.

## 실제 DB 구조

마이그레이션: `supabase/migrations/20261005_docent_templates.sql`.

| 테이블 | 역할 |
| --- | --- |
| `docent_templates` | 지원할 템플릿 ID·이름·활성 여부 |
| `heritage_docents` | 문화재 ID와 템플릿 연결, 제목·부제·배경·결과/선택 화면 레이어 |
| `docent_topics` | 문화재별 질문·제목·부제·원고·오디오·버튼 위치·순서·복귀 전환 |
| `docent_scenes` | 질문별 Scene·순서·본문·오디오·레이어·진행 방식·대기 시간·전환 |

각 표의 `is_active`로 비활성 데이터를 공개 조회에서 제외한다. 부모 문화재 또는 템플릿이
비활성이면 하위 도슨트도 RLS로 숨긴다. 공개/회원 브라우저에는 읽기 정책만 있으며,
관리자 쓰기는 기존 서버 service-role 경계를 사용한다. 앱은 인식 성공 이후에만 이 콘텐츠를
조회한다. 인식 API의 GPT-5 모델·GPS 후보·판정 계약은 변경하지 않았다.

`heritages.content.docent`도 같은 콘텐츠 구조의 호환 fallback으로 남긴다.
실제 `heritage_docents` 설정이 있으면 새 테이블의 데이터를 우선 사용한다.
기존 상세 본문·facts·stamp·docent_text·audio_url 값은 변경하지 않는다.

## Scene 데이터

```json
{
  "id": "scene-1",
  "topic_id": "topic-1",
  "sort_order": 0,
  "advance": "auto",
  "wait_ms": 600,
  "transition": { "type": "dissolve", "durationMs": 400, "easing": "ease-in-out" },
  "layers": [
    { "id": "artifact", "imageUrl": "/media/artifact.png", "x": 41, "y": 337, "width": 311, "height": 241, "glow": true }
  ]
}
```

`advance=click`는 화면의 연출 영역을 눌러 진행한다. 마지막 Scene 클릭과 건너뛰기는 질문
선택으로 복귀한다. `auto`는 들어오는 전환 시간 + `wait_ms` 이후 진행하며, 일시정지 또는
탭을 숨기는 동안 남은 시간을 보존한다. Scene 오디오가 있으면 우선 사용하고, 없으면 질문
오디오를 사용한다. 음성 URL이 없는 원고만 기존 방식처럼 한국어 음성 합성을 사용한다.
실제 파일 오류는 안내하며 TTS로 자동 대체하지 않는다. 파일 재생은 실제 duration/timeupdate를
사용한다. TTS 시간은 추정치이며 정확한 탐색을 제공하지 않는다.

레이어 좌표는 393×733의 콘텐츠 artboard 기준이다. 화면 전체 393×852에 그려진 OS 상태바와
OS 하단 버튼은 앱에 복제하지 않는다. 기존 4탭 내비게이션과 safe area를 유지하며 artboard는
가용 가로·세로에 맞게 축소/확대한다. 긴 질문이 4개 이상이면 스크롤 목록으로 바꾼다.
SVG는 `intrinsic: true`일 때 원본 root 크기를 보존한다. PNG는 alpha를 유지해 crop한다.
`text`, `fontSize`, `fontWeight`로 강조 설명, `glow`와 원본 SVG로 강조 위치를 표현한다.
`mask`, `maskX`, `maskY`, `maskSize`, `cropY`는 Figma의 재질 비교/3단 분리에서 필요한 값이다.
문화재별 단순 설명을 template 코드에 추가하지 않고 레이어 데이터로 변경한다.

## 샘플 및 운영

`src/data/docentTemplate1Sample.js`는 Figma 석련대 콘텐츠 fixture이며 runtime renderer가
문화재 ID/이름으로 자동 주입하지 않는다. 실제 DB에 질문 3개, Scene 10개를 저장했다.
질문 버튼의 초기 문구는 사용자 편집용 `텍스트 1`, `텍스트 2`, `텍스트 3`이다.
Supabase Table Editor의 `docent_topics`에서 해당 문화재의 `label`을 수정하면 버튼 문구가 바뀐다.
`title`은 재생 화면 제목, `script`는 원고이므로 질문 버튼 문구와 별도로 수정한다.

```bash
node scripts/installDocentTemplate1Sample.js --heritage-id=실제_석련대_ID
```

기존 활성 설정을 덮어쓰지 않는다. 미완성 최초 등록은 비활성으로 유지하고, 질문/Scene 등록과
공개 조회 확인 후 활성화한다. 관리자 페이지는 향후 이 네 테이블을 편집하도록 연결하면 된다.
새 템플릿 등록만으로 새 renderer 코드가 만들어지지는 않는다. renderer 구현 및 앱 배포가 필요하다.
샘플에 녹음 오디오가 제공되지 않아 TTS로 연결했으며 실제 기기 음성 품질은 별도 확인 대상이다.
다운로드한 원본 자산은 `public/docent/template1`에 있고 임시 Figma URL을 runtime에 사용하지 않는다.

## 재개 후 검증 (2026-10-05)

- Figma 선택 화면 및 세 질문의 실제 prototype reactions를 다시 조회해 순서와 시간을 확인했다.
- Supabase 공개 키로 활성 Template 1 설정, 질문 3개, Scene 10개의 조회 성공을 재확인했다.
- 동일 layer ID의 이미지 교체에 대한 Dissolve 교차 페이드 회귀 테스트를 추가했다.
- 단위·DB 테스트 85개와 빌드가 통과했다. 브라우저 144개 중 141개가 첫 실행에서 통과했고,
  HTTPS 테스트 서버와 불일치하던 OAuth 기대 주소를 설정 기반으로 수정한 뒤 나머지 3개도 통과했다.
  브라우저 검증 크기는 320×568, 393×852, 1280×900이다.
- 실제 휴대전화의 카메라/GPS 권한과 한국어 TTS 음성 품질은 데스크톱 브라우저 모바일 에뮬레이션과 별도 검증 대상이다.
