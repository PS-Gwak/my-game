# Deadline Express MVP — Implementation Plan

> spec.md를 마일스톤 단위로 풀어낸 실행 계획. 각 M은 omc→Codex 위임 후 검증 게이트 통과해야 다음으로.

**Workdir**: `user/donghyun/projects/deadline-express/`
**Origin**: `https://github.com/finhyun/makesonggreatagain.git` (branch: main)
**Push**: AI 금지. 사용자(ilhyun)가 수동 push.

---

## 검증 게이트 (모든 M 공통)

각 M 종료 후 다음 4단 검증을 통과해야 다음 M 진입:

1. **smoke**: 페이지 로드 → 콘솔 에러 0 → 기본 동작 1회 확인
2. **code-review**: `oh-my-claudecode:code-reviewer` (구조·가독성·SOLID, major issue 0)
3. **balancer**: 해당 M에서 도입된 수치가 spec §8 베이스라인과 일치 여부
4. **director**: 사용자 OK

failed → omc→Codex로 fix 위임 → 재검증

---

## M1 — 골격 + State + 속도 레버

### 목표
페이지 열면 1280×720 캔버스에 4칸 기차가 그려지고, 1/2/3/0 키로 속도가 즉시 바뀌며 콘솔에 fps/speed 디버그가 찍힌다.

### 산출 파일
- `index.html` (캔버스 + 모듈 import)
- `src/main.js` (rAF 루프, dt=1/60 고정)
- `src/state.js` (게임 상태 객체 + reset 함수)
- `src/config.js` (spec §8 그대로)
- `src/input.js` (키보드 매핑: 0/1/2/3, 향후 마우스·Tab·Q·C·Space 자리만 마련)
- `src/render/train.js` (사이드뷰 4칸 도형 렌더)
- `src/systems/speed.js` (속도 페이드 0.3s, 연료 차감)

### Done 기준
- [ ] 1280×720 캔버스 표시
- [ ] 기관차 + 3 모듈 컬러박스 그려짐 (라벨 텍스트 포함)
- [ ] 1/2/3/0 키로 speedTarget 바뀌고 currentSpeed가 0.3s 페이드 후 도달
- [ ] 좌상단에 fps + currentSpeed 디버그 텍스트
- [ ] 콘솔 에러 0
- [ ] 60FPS rAF 루프 안정

---

## M2 — 적 1종(바이크) + 포탑 + HP

### 목표
바이크 적이 우측에서 좌측으로 등장하며 사격, 마우스로 조준해 클릭 사격, 적 격추 시 사라짐, 모듈 HP가 차감된다.

### 산출 파일
- `src/systems/enemies.js` (스폰·이동·사격 AI, v1은 bike만)
- `src/systems/combat.js` (조준 벡터, 발사체, 명중 판정, DPS 60%/100%+크리)
- `src/render/fx.js` (총탄·피격 이펙트 — 가벼운 도형)
- 업데이트: `state.js`(enemies[], bullets[], moduleHP), `main.js`(시스템 호출), `input.js`(마우스), `render/train.js`(HP 표시)

### Done 기준
- [ ] 바이크 적이 일정 간격으로 우측 spawn
- [ ] 마우스 hold 시 수동 사격 (DPS 100% + 크리 25% 표시)
- [ ] 마우스 떼면 자동 포탑 (DPS 60%)
- [ ] 적 사격이 모듈 외벽 장갑 → HP 순으로 차감
- [ ] 격추 시 적 제거, 콘솔에 격추 카운트 로그

---

## M3 — 자원·열·연료·HUD

### 목표
5분 타이머 작동, HUD에 HP/연료/열/속도/BURNOUT/고철/냉각수 모두 표시, 채집칸이 자원을 흡입한다.

### 산출 파일
- `src/systems/resources.js` (스폰·흡입·인벤토리)
- 업데이트: `src/systems/speed.js`(열 적용·연료 적용), `src/render/hud.js`(신규)

### Done 기준
- [ ] 상단바: 진행도(타이머 기준) + ⏱타이머
- [ ] 하단 HUD 7개 게이지 모두 작동
- [ ] 자원 픽업 시각 표시 + 흡입 애니메이션
- [ ] 열 100% → 무작위 모듈 화재 (15초 DoT)
- [ ] 연료 0 → 게임 오버 화면
- [ ] HP 0 → 게임 오버 화면
- [ ] 5분 도달 → 클리어 화면
- [ ] C 키로 냉각수 사용 (열 -40%)

---

## M4 — 적 +2종 + 내부 침입 + 모드 전환

### 목표
사막 벌레·코뿔 트럭 등장, 3:30에 트럭 1대 강제 spawn, 외벽 0 → 내부 침입, Tab으로 외부/내부 전환, Q로 격리벽.

### 산출 파일
- 업데이트: `src/systems/enemies.js`(worm/truck AI), `src/systems/breach.js`(신규: 내부 침입), `src/systems/combat.js`(외부/내부 모드 분기), `src/render/train.js`(내부 뷰 토글)

### Done 기준
- [ ] 벌레: 지하 → 5초 후 점프 → 측면 충돌
- [ ] 트럭: 3:30에 강제 1대, 정면 돌진
- [ ] 외벽 0 → 적 1마리 내부, 해당 칸 기능 정지
- [ ] Tab → 내부 모드 (외부 자동 포탑 효율 60%)
- [ ] Q → 격리벽 (30초 봉쇄)
- [ ] Pinch 페이즈에서 강제 침입 1회 트리거

---

## M5 — 이벤트 카드 6장 + BURNOUT

### 목표
이벤트 윈도우 내 카드 1~2장 무작위 발동, 4분 후 Space로 BURNOUT 1회.

### 산출 파일
- `src/systems/events.js` (6장 카드 풀 + 발동·해제 로직)
- 업데이트: `src/systems/speed.js`(BURNOUT 효과·후유증 화재), `src/render/hud.js`(이벤트 알림 토스트)

### Done 기준
- [ ] 6장 모두 구현 (storm/canyon/scrap/ghost/leak/sos)
- [ ] E6 SOS는 모달(게임 일시정지) → A/B 선택 후 효과
- [ ] BURNOUT 4분 후 잠금 해제, Space로 사용
- [ ] BURNOUT 5초간 속도 +1·사격 ×2·적 명중 -50%
- [ ] BURNOUT 종료 시 강제 화재 1건

---

## M6 — critic + balancer 패스 → 수치 튜닝

### 목표
spec §2 재미 게이트 통과: 지루구간 ≤ 30초, 결정 압박 빈도 ≥ 1/30s.

### 작업
1. **balancer (Claude 본)**: 5분 풀런 시뮬 → 페이즈별 입력 빈도·자원·HP 곡선. 수치 어긋나면 `config.js` 조정.
2. **qa-tester (`oh-my-claudecode:qa-tester`)**: 브라우저 플레이테스트 3회. `docs/playtest-checklist.md` 기록.
3. **critic (`oh-my-claudecode:critic`)**: 게이트 평가. 미달 시 구체적 개선 지시.
4. 종합 결과로 `config.js` 마지막 튜닝.

### Done 기준
- [ ] playtest 3회 모두 게이트 충족
- [ ] critic 평가서에 "PASS" 기록

---

## M7 — GDD v2 + README + 최종 커밋 + Slack 보고

### 목표
사용자 push 준비 완료 + 사용자 개인 Slack DM으로 완료 보고.

### 작업
- `GDD.md` v2: §3.1·§3.2 시스템에 v1 MVP에서 검증된 수치·구조 반영, "MVP는 5분 1노드 캡슐로 분리됨" 명시
- `README.md` (형용): 플레이 방법, 조작키, 실행법(`open index.html`), MVP 의도
- `docs/playtest-checklist.md`: 플레이테스트 기록 (M6 결과)
- 최종 커밋: `feat(deadline-express): MVP v1 — 5분 1노드 미니런 완성`
- 사용자에게 push 안내
- **Slack DM 발송**: 사용자(ilhyun) 개인 DM으로 GitHub 링크 + 한줄 요약 (mcp__claude_ai_Slack__slack_send_message)

### Done 기준
- [ ] README 첫 화면에서 "더블클릭→플레이"까지 5초 내 도달 가능한 안내
- [ ] GDD.md v2에 변경 이력 추가
- [ ] 모든 변경 커밋됨, working tree clean
- [ ] Slack DM 발송 완료
- [ ] 사용자에게 push 명령 안내

---

## 위임 라우팅

| 작업 종류 | 담당 | 호출 방식 |
|---|---|---|
| 코드 작성·수정·테스트 | Codex | `codex exec --sandbox workspace-write --cd <workdir> "<지시>"` |
| 코드 리뷰 | Claude 서브 | `oh-my-claudecode:code-reviewer` |
| QA 플레이테스트 | Claude 서브 | `oh-my-claudecode:qa-tester` |
| 엄격한 재미 평가 | Claude 서브 | `oh-my-claudecode:critic` |
| 수치 밸런스 시뮬 | Claude 본 | inline 추론·계산 |
| 통합·사용자 커뮤니케이션 | Claude 본 | this thread |
| Slack DM 보고 | Claude 본 | mcp__claude_ai_Slack__slack_send_message |
| 푸시·승인 | director (ilhyun) | manual |
