# v11.03 사회자 멘트 수정 — Codex 코드리뷰 요청서

> 작성: 2026-05-31 · 뮤나리자 경매 데모 / 사회자 멘트 논리결함 수정
> 리뷰 대상 파일: `auction-demo-v11.03/modules/auction-engine/v11-engine.js`
> **제약**: `v6-engine.js` / `v6-engine.css` 수정 금지 (원본 보존). 이 둘은 건드리지 않았는지도 확인 요청.

---

## 0. 리뷰 목적

비개발자 사용자가 게임 5판 플레이 로그를 보고 **사회자 멘트가 논리적으로 안 맞거나 어색한 지점 10가지**를 지적했다. Claude Code가 이를 수정했고, 이 수정이 **(a) 사용자 문제를 실제로 해결하는지 (b) 부작용/회귀는 없는지 (c) 빠진 케이스는 없는지**를 Codex가 코드 기준으로 검증해주길 바란다.

배경 진단 문서(참고): `../../docs/analysis/auction-research/v11.02-dialogue-diagnosis.md`

핵심 회귀 원인: v11.01~02에서 사회자 멘트를 **800ms 지연 큐(`hostQueue`/`drainHostQueue`)**로 출력하게 바꾼 뒤, 멘트가 생성 시점 상황으로 굳고 출력 시점에 재검증되지 않아 타이밍·대상·중복 오류가 발생.

---

## 1. 사용자가 제기한 문제 (로그 근거 포함)

| # | 문제 | 사용자 원칙 | 로그 예시 (v11.02) |
|---|------|------------|-------------------|
| P1 | rivalry 대상·타이밍 오류 | "빼앗겼다/따라잡혔다/역전" = **직전 1위(방금 빼앗긴 사람)**에게만. 옛 입찰자 언급 금지 | CPU1이 $80인데 "CPU9 따라잡혔다"(CPU9는 2단계 전) |
| P2 | 재촉 대상 오류 | "다음 호가 가시겠습니까/따라오시겠습니까/한 번 더" = **방금 빼앗긴 추격자**에게. 현재 1위(방금 입찰자)에게 금지 | CPU4가 마지막 입찰자인데 "CPU4 다음 호가 가시겠습니까?" |
| P3 | dropout 처리 | ①초반엔 시스템만, **후반(2~3명)에만 사회자** ②순서 **시스템→사회자** ③두 멘트 간 간격 | "CPU6 수고하셨습니다"(사회자)→"CPU6 빠집니다"(시스템) 순서 거꾸로 + 7초 초반 |
| P4 | 멘트 밀도/광기경고 | 같은 시각 3줄 = 못 따라감. **광기 변환 경고가 점프 본인과 같으면 중복** | 25.2s에 멘트 3줄 동시 |
| P5 | "한 발 물러납니다" 모순 | **포기 선언 때만**. 입찰/복귀 직후 금지 | CPU9가 입찰했는데 "CPU9 한 발 물러납니다" |
| P6 | "여기까지 한 번 더?" 발동 | **끝 1:1, 고민 길어질 때만** + 직전 입찰자 이름 앞에 | 19.1s 한창인데 발동 |
| N1 | 경매종류 오프닝 오발 | 비밀경매인데 "지정가 거래입니다" | 게임1 R5 |
| N2 | flavor 멘트 즉시 중복 | 같은 그림 설명 2연속 | "미술관에서도 탐낼…" 2번 |
| N3 | 낙찰 후 멘트 | 경매 끝났는데 "나 봉투 제출!" | 게임1 R5 낙찰 후 |
| N4 | 호가 없는 경매 호가 멘트 | 비밀·1회제한엔 "다음 호가" 류 금지 | 게임2 R5 |

**사용자 결정 (수정 기준)**:
- "초반/후반" = **남은 활성 CPU 수 기준** (후반 = 활성 ≤ 3명)
- rivalry = **후반에만 발동, 초반엔 아예 안 함**
- dropout = **후반에만 사회자, 순서 시스템→사회자**
- 광기 경고 = **점프 본인과 같을 때만 숨김** (다른 CPU 자극이면 유지)

---

## 2. Claude의 실제 수정 (구현 내역)

### 토대 (신설)
- **상태 변수**: `state.prevBidderId`(직전 1위=추격자), `state.auctionResolved`(낙찰/종료 플래그), `state._lastDrainedCat`(직전 배출 멘트 분류), `state._lastFlavorLine`(직전 flavor 문구)
- **헬퍼**: `setLastBidder(id)`(prevBidderId←기존 lastBidderId, lastBidderId←신규), `activeCpuCount()`, `isLateGame()`(활성≤3), `chaserIsActive()`(추격자 생존·미retire), `pickPersuasionGeneric(ctx)`(P6 라인 제외 버전)
- **makeHostCtx**: `prevBidderLabel` 필드 추가
- **logBid**: 4번째 인자 `meta = {cat, cpuId, leaderAtIssue}`. hostQueue push 시 태그
- **drainHostQueue**: 배출 직전 검증 게이트 — ①rivalry는 leaderAtIssue ≠ 현재 lastBidderId면 폐기 ②retired 대상 폐기 ③직전과 같은 분류(rivalry/persona) 연속이면 스킵 ④auctionResolved면 차단

### 항목별 처리
- **P1**: rivalry는 `isLateGame()`일 때만 발사, target=`prevBidderId`. 큐 배출 시 최신성 검증.
- **P2**: cooldown/counter 풀 `lastBidderLabel`→`prevBidderLabel`. 발사 게이트에 `chaserIsActive()`, 없으면 이름 없는 풀로 대체.
- **P3**: dropout 사회자 멘트 `isLateGame()`에서만. 순서 시스템(즉시)→사회자(큐 800ms). 자유·촛불·지정가·1회제한 4곳.
- **P4**: `onLargeJump`에 `actorCpu` 전달 → 변환 대상==점프 본인이면 ⚠️ 숨김.
- **P5**: "한 발 물러납니다"(`persona_wth_giveup`)는 `startWthAway`에서만 호출됨을 확인(입찰/복귀 경로엔 없음). 주석만 추가.
- **P6**: persuasion index 5에 추격자 이름. 일반 호출은 `pickPersuasionGeneric`(index 5 제외). **활성 2명 + 추격자 생존 시 50% 확률**로만 index 5.
- **N1**: 비밀경매·네덜란드식 shouts에서 "지정가 거래입니다" 라인 `filter` 제거.
- **N2**: `pickFlavorLine` 직전 문구 동일 시 1회 재추첨.
- **N3**: 낙찰/종료 시 `auctionResolved=true` → host 큐 차단·비움. 낙찰멘트만 `immediate` 우회.
- **N4**: 1회제한 cooldown("다음 호가") → 중립 안내로 교체. 비밀경매는 호가 추격 멘트 없음 확인.

### 새로 추가한 사회자 문구
1. (P6 개작) `📢 {추격자}, 여기까지 오셨는데 진짜 한 번 더 안 하십니까?`
2. (N4 신규) `📢 현재 최고가 {가격}. 한 분당 한 번, 선착순입니다.`
3. (N4 신규) `📢 아직 입찰 없습니다. 선착순 한 번, 도전하실 분?`

---

## 3. Codex 검토 요청 포인트 (중점)

1. **prevBidderId 추적 누락**: 모든 입찰 1위 변경 경로가 `setLastBidder`를 거치는가? 직접 `state.lastBidderId = X` 남은 곳이 있으면 prevBidderId가 어긋난다. 자유·촛불·셋째 경매 전부 확인.
2. **drainHostQueue 검증 게이트 엣지**: 폐기/스킵 로직이 큐를 무한 누적시키거나, 정상 멘트를 과도하게 죽이지 않는가? 배출 0건으로 사회자가 침묵해버리는 케이스는?
3. **P1 후반 한정**: rivalry를 `isLateGame()`에서만 발사 → 초반 빼앗김 멘트 전무. 의도된 것이나, 초반이 과하게 조용한지 코드 흐름상 판단.
4. **P6 1:1 판정**: `activeCpuCount() === 2`로 구현(=CPU 2명). 유저 포함 1:1은 미포함. 기준 적절한지.
5. **N3 낙찰후 차단 부작용**: `auctionResolved` 플래그가 정상적인 낙찰 멘트·다음 라운드 진행까지 막지 않는가? 라운드 전환 시 리셋 확인.
6. **중복 스킵 범위**: 연속중복 스킵을 rivalry·persona 분류에만 적용. 다른 조합(cooldown 연속 등) 중복이 남는지.
7. **3개 경매 모드 일관성**: 토대 로직(prevBidderId·isLateGame·큐 검증)이 자유/촛불뿐 아니라 지정가·비밀·1회제한·네덜란드식에도 모순 없이 적용되는가.
8. **회귀**: 기존 점검로그(`inspectionLog`)·속사포·긴박감 수정(사이클#7·#8)이 깨지지 않았는가. `runFreeAuctionSimulation` self-test 영향 여부.

리뷰 결과는 "문제별 OK / 수정 필요(구체 위치·이유)" 형태로 받으면 좋겠다.
