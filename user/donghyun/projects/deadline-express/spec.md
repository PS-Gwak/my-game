# Deadline Express MVP — Implementation Spec

> 5분 한 노드 클리어 미니런. 자율적 템포 디펜스의 DNA를 5분 캡슐로 검증한다.
>
> **Author**: ilhyun (디렉팅) + Claude (설계)
> **Implementer**: Codex via omc routing
> **Date**: 2026-04-26
> **Status**: APPROVED v1 — 구현 진입
> **GDD 베이스**: `./GDD.md` (Claude 1차 기획), `./Deadline_Express_GDD.docx` (압축 비전)

---

## 1. 비전 & 스코프

### 1.1 한 줄
5분 안에 한 노드를 통과하는 자율적 템포 디펜스 미니런. 60분 풀런의 핵심 DNA(속도-열-자원 삼각구도, 1+3 모듈, 외부+내부 이중 방어)를 5분 캡슐로 압축한다.

### 1.2 In Scope (v1.0)
- 1 기관차 + 3 모듈 (전투 / 유지보수 / 채집) 고정 배치
- 속도 레버 4단 (정지/저/중/고)
- 포탑 수동 조준 (마우스)
- 모드 전환 (외부 사격 ↔ 내부 침입 대응)
- 일회성 폭주 스킬 BURNOUT (Space, 4분 이후 1회)
- 자원 3종: 고철 / 연료 / 냉각수
- 적 3종: 약탈자 바이크 / 사막 벌레 / 코뿔 트럭(미니보스)
- 내부 침입 1패턴
- 랜덤 이벤트 카드 6장 (1런당 1~2장 발동)
- 클리어/실패 화면, 재시작
- SFX 5종

### 1.3 Out of Scope (v1.0)
- 다중 노드 / 노드 맵
- 정비소 업그레이드
- 모듈 순서 재배치
- 메타 진행 (영구 업그레이드)
- 세이브 시스템
- BGM
- 스프라이트 (도형+컬러로 v1)
- 모바일 / 터치 입력

### 1.4 승리·패배
- **승리**: 5분 타이머 0 도달 OR 진행도 100% 도달 → 기관차 생존
- **패배**: 기관차 HP 0 OR 연료 0

---

## 2. 코어 루프 — 5분 감정 곡선

| 시간 | 페이즈 | 환경 밀도 | 흥미 트리거 |
|---|---|---|---|
| 0:00–0:45 | Warm-up | 낮음 | 튜토리얼 텍스트 3장, 적 1종(바이크) |
| 0:45–2:15 | Crescendo | 중간 | 적 2종 추가, 이벤트 카드 1장 발동, 자원 첫 풍족 구역 |
| 2:15–3:30 | Pinch | 높음 | 모래폭풍/협곡 환경 카드, 내부 침입 1회 강제, 열 80%↑ 압박 |
| 3:30–4:30 | Climax | 폭발 | 미니보스(코뿔 트럭) + 이벤트 카드 1장 추가 + BURNOUT 해금 |
| 4:30–5:00 | Sprint | 살짝 안정 | 결승선 가시화, 연료 점멸, 마지막 결단 |

### 재미 게이트 (critic 통과 기준)
- 지루구간(아무 입력 없이도 안전한 시간) ≤ 30초
- 결정 압박 빈도 ≥ 1회 / 30초
- BURNOUT 사용 시점이 자연스럽게 클라이맥스에 위치

---

## 3. 시스템 디테일

### 3.1 속도 / 열 / 연료 삼각구도
| 속도 | 코드값 | 연료 소모 (per sec) | 열 증가 (per sec) | 채집 흡입 반경 |
|---|---|---|---|---|
| 정지 | 0 | 0.5 | 0 | 220 px |
| 저속 | 1 | 1.0 | 0.8 | 160 px |
| 중속 | 2 | 2.0 | 3.2 | 100 px |
| 고속 | 3 | 4.0 | 7.2 | 0 px (off) |

- 열 증가 공식: `HEAT_GAIN = speed^2 * 0.8` per sec
- 열 감소 공식: `HEAT_DECAY = 1.2 * (maintBuff ? 1.5 : 1)` per sec
- 열 100% 도달 → 무작위 모듈 화재(15초 DoT, 냉각수 1개 사용 시 즉시 진압 또는 수리 드론 자동 출동 30초 쿨)
- 채집 흡입 반경: 위 표 단계값 사용 (`SPEED.harvest[speedIdx]`). 속도 3 = 채집 off (반경 0)
- **저속일수록 강함 = 절대 규칙(GDD §3) 보존**

### 3.2 모듈 1+3 (HP·역할)
| 모듈 | HP | 외벽 장갑 | 역할 |
|---|---|---|---|
| 기관차 | 200 | 100 | 연료탱크·열 게이지·속도 레버. **파괴=게임오버** |
| 전투칸 | 120 | 80 | 외부 포탑 1문 (자동 60% / 수동 100%+크리) |
| 유지보수칸 | 100 | 60 | 수리 드론 1기, 냉각 ×1.5 버프 |
| 채집칸 | 100 | 40 | 자기장 흡입 (반경 = 위 표) |

외벽 장갑 0 → 해당 칸 내부 침입 시작 (§3.5)

### 3.3 적 3종

| 종 | HP | 행동 | 출현 페이즈 | 보상 |
|---|---|---|---|---|
| 약탈자 바이크 | 30 | 측면 추격, 단발 사격 (DPS 4) | Warm-up~ | 고철 5 |
| 사막 벌레 | 80 | 지하 → 5초 후 점프 → 측면 충돌 (충격 25) | Crescendo~ | 고철 12, 냉각수 1 |
| 코뿔 트럭 | 200 | 정면 돌진 (충격 60), 1회 등장 미니보스 | Climax (3:30 강제 1대) | 연료 30, 고철 25 |

스폰 레이트: `ENEMY_RATE = clamp(0.5 + (timeMin*0.6), 0.3, 3.5)` 마리/초

### 3.4 자원
- 고철: 모듈 외벽 수리 (10 = +20 장갑)
- 연료: 게임오버 트리거. 시작 100, 채집으로 충전
- 냉각수: 즉시 열 -40% 소모품. 시작 2개, 최대 4개

### 3.5 내부 침입 (Breach)
- 외벽 0 → 적 1마리 내부 진입, 해당 칸 기능 정지
- 대응 옵션:
  1. **Tab으로 내부 모드 전환** → 마우스로 침입자 사격. 내부 모드 동안 외부 자동 포탑 효율 60% (즉 DPS 60%로 감소)
  2. **격리벽 수동 작동** (Q): 해당 칸 봉쇄, 칸 기능 30초 정지 후 자동 해제
- v1은 침입 패턴 1종(코뿔 트럭 측면 충돌 시 강제) + Pinch 페이즈 강제 1회

---

## 4. 흥미 메인 — 입력 긴장감

### 4.1 컨트롤 매핑
| 입력 | 동작 |
|---|---|
| 1 / 2 / 3 / 0 | 속도 저/중/고/정지 (즉시 0.3초 페이드) |
| 마우스 이동 | 조준 |
| 마우스 클릭 (지속) | 수동 사격 (DPS 100% + 크리 25%) |
| 손 뗌 | 자동 포탑 (DPS 60%, 크리 0%) |
| Tab | 외부 ↔ 내부 모드 전환 |
| Q | 격리벽 (침입 칸 봉쇄) |
| Space | BURNOUT (4분 후 1회 해금) |
| C | 냉각수 사용 (열 -40%, 1개 소모) |

### 4.2 BURNOUT — 클라이맥스 한 방
- 해금: 240초 경과 시
- 사용: Space 1회
- 효과: 5초간 속도 +1 (상한 무시), 사격 속도 ×2, 모든 적 명중률 -50%
- 종료 페널티: 강제 화재 (랜덤 모듈, 냉각수로만 진압 가능)
- **설계 의도**: "화끈한 한 방 + 후유증 관리"의 결단 압박

---

## 5. 흥미 보조 — 랜덤 이벤트 카드 (6장 풀, 1런 1~2장)

발동 타이밍: `EVENT_AT = [random(45..105)s, random(180..220)s]`

| ID | 이름 | 효과 |
|---|---|---|
| E1 | 모래폭풍 | 25초간 시야 50%↓, 적 명중률 -30%, 채집 흡입 -50% |
| E2 | 협곡 좁힘 | 20초간 외부 포탑 사거리 -30%, 적도 한쪽(하단)만 출현 |
| E3 | 고철 더미 | 12초간 흡입력 ×2, 단 적 스폰 ×1.5 |
| E4 | 유령 신호 | 가짜 적 표시 + 진짜 적 1마리 잠복 출현 (사망 시 보너스) |
| E5 | 냉각수 누수 | 30초간 열 +50% 가속, 채집물 ×1.5 |
| E6 | 무전 SOS | 모달 선택(게임은 일시정지로 대기): A) 5초간 기차 속도 강제 0·연료 -10·고철 +30 / B) 무시 |

E6는 결정 압박 + 내러티브 양념. 다른 5장은 환경 이벤트.

---

## 6. UI 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│ 진행도 ▓▓▓▓▓░░░░ 52%   타이머 ⏱02:34   📜이벤트 알림         │  상단바
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [기관차]──[전투칸]──[유지보수칸]──[채집칸]                      │  게임뷰
│   🔥 적 ↗↘↗   ⚙ 자원 ↙↙   적 침입 🚪                       │  사이드뷰
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ HP❤195/200 │ 연료⛽67 │ 열🌡58% │ 속도⚡▮▮▯ 2/3 │ BURN⚡⓿  │  HUD
│ 고철53 │ 냉각수2 │ 모드: 외부                                  │
└──────────────────────────────────────────────────────────────┘
키 안내: 1/2/3 속도, 마우스 사격, Tab 모드전환, Q 격리, C 냉각, Space 폭주
```

캔버스: 1280×720 권장 (스케일링 가능)

---

## 7. 기술 아키텍처

### 7.1 스택
- vanilla HTML + Canvas2D + ESM JS
- **의존성 0** (npm install 없이 더블클릭으로 실행 가능)
- 형의 이전 프로젝트(tower-stack/fishing-game) 단일 HTML 패턴 계승

### 7.2 파일 구조
```
user/donghyun/projects/deadline-express/
├── index.html              # 진입점
├── spec.md                 # ← 이 문서
├── GDD.md                  # 기존 비전 문서 (M7에서 v2 업그레이드)
├── README.md               # 형용 플레이/조작 가이드 (M7 작성)
├── src/
│   ├── main.js             # 게임 루프 (rAF 60FPS)
│   ├── state.js            # 게임 상태
│   ├── config.js           # 모든 수치 단일 소스 (밸런스용)
│   ├── input.js            # 키보드·마우스 매핑
│   ├── systems/
│   │   ├── speed.js        # 속도·열·연료
│   │   ├── combat.js       # 포탑·조준·발사
│   │   ├── enemies.js      # 스폰·AI
│   │   ├── resources.js    # 채집·인벤토리
│   │   ├── events.js       # 랜덤 카드
│   │   └── breach.js       # 내부 침입
│   ├── render/
│   │   ├── train.js        # 기차·모듈 렌더
│   │   ├── hud.js          # HUD
│   │   └── fx.js           # 폭발·화염 등 이펙트
│   └── audio.js            # SFX 5종 로딩·재생
└── assets/
    └── sfx/
        ├── shoot.wav
        ├── hit.wav
        ├── alarm.wav
        ├── fire.wav
        └── burnout.wav
```

### 7.3 코드 원칙
- 시스템(`systems/*.js`)은 순수함수 우선 — 입력 state → 출력 state. 부수효과(렌더·SFX)는 별도 콜백.
- `config.js`에 모든 수치 상수. 밸런서가 단일 파일만 만지면 튜닝 가능.
- 60FPS 고정 timestep (`dt = 1/60`), `requestAnimationFrame` + 누적 시간.
- 캔버스 더블 버퍼링 불필요 (Canvas2D는 자동).

---

## 8. 수치 베이스라인 (config.js 초안)

```javascript
// config.js
export const SPEED = {
  fuel:  [0.5, 1, 2, 4],         // per sec
  heat:  [0, 0.8, 3.2, 7.2],     // per sec
  harvest: [220, 160, 100, 0],   // px
};
export const HEAT = {
  decay: 1.2,
  maintMult: 1.5,
  fireDuration: 15,              // sec
  coolantPunch: 40,              // pct
};
export const HP = {
  loco: 200, combat: 120, maint: 100, harvest: 100,
  armor: { loco: 100, combat: 80, maint: 60, harvest: 40 },
};
export const ENEMY = {
  rateBase: 0.5,
  rateGrow: 0.6,                 // +rate per minute
  rateMin: 0.3, rateMax: 3.5,
  bike:    { hp: 30, dps: 4 },
  worm:    { hp: 80, impact: 25, delay: 5 },
  truck:   { hp: 200, impact: 60, spawnAt: 210 },  // 3:30
};
export const EVENT = {
  windows: [[45, 105], [180, 220]],
  pool: ['storm','canyon','scrap','ghost','leak','sos'],
};
export const BURNOUT = {
  unlockAt: 240, durSec: 5, speedBoost: 1, fireRateMult: 2,
  enemyAccuracyDebuff: 0.5, postFire: true,
};
export const TIMER = { totalSec: 300 };
```

---

## 9. 팀 에이전트 구성

| Role | 페르소나 | 책임 | 통과 기준 |
|---|---|---|---|
| director | ilhyun (사용자) | 우선순위·승인·푸시 | 사용자 OK |
| architect | Claude (이 세션) | 설계·요구분해·omc 라우팅 | spec/plan 완성 |
| implementer | Codex via `omc ask codex` | 구현·수정 | 빌드·smoke 통과 |
| balancer | Claude 서브 | config.js 검토·재미 곡선 시뮬 | 5분 곡선 합리 |
| critic | `oh-my-claudecode:critic` | 5분 래클 가차없이 깎기 | 재미 게이트 §2 통과 |
| qa-tester | `oh-my-claudecode:qa-tester` | 수동 체크리스트 | 버그 0 critical |
| code-reviewer | `oh-my-claudecode:code-reviewer` | 구조·가독성·SOLID | major issue 0 |

### 9.1 흐름 (M마다 반복)
```
[director]
   └─ Claude(architect)가 작업지시 작성
        └─ omc ask codex "<작업 지시>" → Codex 구현
             └─ code-reviewer → qa-tester → critic → balancer
                  └─ Claude 통합 → director 승인
                       └─ 다음 M
```
**critic이 막으면 머지 불가 = "엄격함"의 칼.**

### 9.2 omc 라우팅 명세
- 코드 작성·수정·테스트는 `codex exec` 또는 `omc ask codex` (사용자 환경에서 가능한 라우트)
- Claude는 작업 지시·리뷰·통합·사용자 커뮤니케이션
- Gemini는 v1에서 사용 안 함 (필요 시 ccg로 트리 모델 비교용)

---

## 10. 테스팅

### 10.1 자동
- `node --test src/systems/*.test.js`
- 대상: 순수함수 (`speed.calcHeat`, `combat.calcDamage`, `events.pickCard`, `enemies.spawnRate`)
- 목표 커버리지: systems 핵심 함수 80%+

### 10.2 수동
파일: `docs/playtest-checklist.md` (M7에서 작성)
- 5분 풀런 ×3
- 각 페이즈 진입 시간·이벤트 발동·BURNOUT 사용·실패 사유 기록
- 평가: critic 게이트 (§2)

### 10.3 Smoke
- 페이지 로드 → 타이틀 → 시작 → 5초 내 첫 적 등장 → 콘솔 에러 0

---

## 11. 마일스톤 (ralph 루프 단위)

| M | omc→Codex 위임 단위 | 산출 (Done 기준) |
|---|---|---|
| M1 | 골격 + state + 속도 레버 | 기차 그려지고 1/2/3/0 키로 속도 변함, dt 루프 정상 |
| M2 | 적 1종 (바이크) + 포탑 자동/수동 + HP | 적 등장·격추 가능, 모듈 HP 차감 |
| M3 | 자원 채집·열·연료·HUD | 5분 타이머·HUD 모든 게이지 작동 |
| M4 | 적 +2종 (벌레·트럭) + 내부 침입 + 모드전환 | Tab으로 내부 모드, 격리벽 작동 |
| M5 | 이벤트 카드 6장 + BURNOUT | 4분 후 Space 한 방 작동, 카드 시각 효과 적용 |
| M6 | critic + balancer 패스 → 수치 튜닝 | 재미 게이트 §2 통과 |
| M7 | GDD.md v2 + README.md + 커밋 | 사용자 push 준비 완료 |

각 M 완료 시 사용자 승인 체크포인트 (ralph 모드의 verifier 역할).

---

## 12. 산출물 위치 & 배포

- **작업 트리**: `/Users/finito/Documents/Playground/.tmp/codex-scratch/deadline-express/` (이미 클론됨, finhyun/makesonggreatagain origin)
- **결과 경로**: `user/donghyun/projects/deadline-express/{index.html, src/, assets/, README.md, GDD.md(v2), spec.md(이 파일), docs/playtest-checklist.md}`
- **커밋**: Claude가 마일스톤별 커밋
- **푸시**: 사용자(ilhyun)가 직접 `git push origin main` (AI는 push 안 함 — 레포 권한 분리)

---

## 13. Open Questions (구현 전 확정)

없음. v1 디자인은 사용자(ilhyun) 승인 완료(2026-04-26). 변경 발생 시 이 섹션에 추가 후 재검토.

---

## 14. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-04-26 | v1 spec 작성·승인 (architect=Claude, director=ilhyun) |
