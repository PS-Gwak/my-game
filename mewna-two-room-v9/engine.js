// 뮤나리자 B 플레이 데모 — 순수 게임 엔진 (DOM 없음, Node 테스트로 직접 검증).
//
// 학습 흐름 (플레이 영상 분석의 「상황 → 전화 → 새 물건 등장 → 잠금 해제 →
// 고정 자리 편입 → 즉시 사용」 문법 이식) — 2026-08-10 라운드 003 승인판:
//  1. 현금 20원 — 할 수 있는 행동은 유리창 알바뿐. 상점은 아직 존재하지도 않는다.
//     (2026-08-26 확정: 시작 현금 0원 → 20원. 첫 장의 선투자를 낼 수 있는 딱 그만큼이다.)
//  2. 밀대 완주 4회 = 창문 1장 (2026-08-26 확정 · 디버그로 5·6겹도 고를 수 있다).
//     보수는 엔진이 따로 갖지 않고 State.windowResultFor가 정한다.
//     한 장을 처음 미는 순간 선투자 20원이 먼저 나가고(한 장에 한 번뿐),
//     레벨 0(1~4장)은 일반 성공 100% · 총보수 40원이라 순이익이 20원이다.
//     네 장을 끝내 레벨 1이 되면 일반 85%·총보수 53원 / 대성공 5%·총보수 86원 /
//     파손 10%가 돈다 (2026-08-26 확정 결과표 — 옛 25/33/66원 표는 폐기됐다).
//     일반 + 대성공 = 90%라 플레이어에게는 「성공 90% / 파손 10%」로만 보이고,
//     대성공 5%와 86원은 숨은 확률로 남는다.
//     파손은 보수 0원에 배상 20원이 더 빠져 선투자까지 총 40원을 잃는다.
//     (2026-08-26 확정: 옛 「부족분이 무이자 빚이 되고 수입이 빚부터 갚는다」는
//      자동 신용 규칙은 폐기됐다. 선투자 20원을 못 내면 아예 시작하지 않고,
//      배상을 못 내면 현금이 0에서 멈춘 채 위기 대출 전화가 열릴 뿐이다.)
//  3. 100원 도달 순간 첫 전화 → 도화지 구매가 열린다. (40원 밀대 전화는 폐기)
//  4. 도화지를 먼저 산다 → 작업대에 흰 도화지가 놓인다 → 그때 카탈로그가 떨어지고,
//     눌러서 원작 슬롯에 편입한 뒤 원작을 고르면 인쇄가 시작된다.
//     (2026-08-06 확정: 원작 선택은 도화지 구매 「뒤」다.)
//  5. 첫 작품은 잉크통이 완성 필요량의 50%뿐이라 인쇄 3회 중 1.5회에서 바닥난다.
//     그림은 눈에 보이게 미완성인 채로 작업대에 남고, 플레이어가 결과판에서
//     「미완성 복제품 70원에 판매」를 직접 누른다 (정액 · 레벨 보너스 없음).
//  6. 그 판매 뒤 두 번째 전화 → 상점이 열리고 「잉크통 크기」 하나만 들어온다(50원).
//  7. 잉크통을 사면 두 번째 도화지는 100%로 시작해 인쇄 3회를 다 채우고 정상 판매된다.
//  8. 두 번째 판매 뒤 「인쇄 스퀴지 속도」가 열린다(40원). 유리창 「고무 밀대」와는
//     이름도 효과도 완전히 별개다 — 한 항목이 다른 쪽 일을 하지 않는다.
//  9. 그 뒤 레벨에 따라 「잉크 질」이 열린다 (선형 해금). 유리창 전용 강화 카드는
//     2026-08-12 계약 15에서 일반 상점에서 빠졌다 — 내부 계산만 남고 카드는 없다.
//
// 2026-08-11 라운드 001 승인판이 5~6번을 이렇게 바꾼다 (초반 손실 확인·확률표 고정):
//  5'. 첫 도화지 안내 통화가 끝나기 전까지 유리창 대성공 확률은 0%다. 통화가 끝나야
//      기존 8%/16%가 돌아온다.
//  6'. 첫 미완성 작품은 잉크가 바닥나도 자동 판매하지 않는다. 작업대에 그대로 남고,
//      플레이어가 「미완성 복제품 70원에 판매」를 직접 눌러야 팔린다.
//      그 직후 「도화지 100원 / 판매 70원 / 손실 30원」 결과가 열리고, 「확인」을
//      누르기 전에는 잉크통 전화도 다음 도화지도 진행되지 않는다.
//      확인을 누른 뒤에만 잉크통 전화가 딱 한 번 울린다.
//  7'. 확률표는 제작 중인 도화지 hover에서만 뜨고 자리는 CSS 고정이다(포인터 추종 없음).
//
// 2026-08-10 라운드 005 승인판이 여기에 이어 붙는다 (라운드 004의 강제 목표를 대체한다):
// 10. 두 번째 「정상 완성」 판매 직후 무료 갤러리 칸 1개가 열린다.
//     (라운드 005의 무료 두 칸 작업대는 2026-08-11 라운드 001에서 폐기됐다 —
//      자연 플레이의 작업대는 한 칸으로 시작하고, 첫 정상 완성품을 판 뒤 상점에 열리는
//      60원 유료 두 번째 작업대를 사야 두 칸이 된다. 무료 확장은 없다.)
// 11. 도화지 구매는 한 번에 한 장이다. 빈 칸 하나에 100원짜리 한 장만 놓이고,
//     빈 칸과 돈이 남아 있으면 버튼을 다시 눌러 두 번째 장을 산다.
//     두 칸이어도 한 장만 사서 만들고 처리해도 된다.
// 12. 한 묶음의 도화지들은 같은 원작을 쓰고, 휠 입력 경로도 작업면 하나뿐이다.
//     그 한 번의 입력이 몇 점을 진행시키는지는 아래 19~21번의 제작 방식이 정한다.
//     서로 다른 원작을 칸별로 고르는 기능은 범위 밖이다.
// 13. 각 작품의 등급·가격은 따로 굴린다. 첫 미완성 70원은 라운드 001의 손실 학습
//     구간이라 자동 판매하지 않고 플레이어가 직접 판다. 두 번째 정상 74원까지는
//     예전 흐름 그대로 결과판 선택 없이 자동 판매되고, 그 두 번째 정상 판매가
//     무료 갤러리 칸을 연다. 갤러리가 열린 뒤부터는 자동 판매하지 않는다.
//     결과판에서 작품마다 복제품 안전 판매 또는 갤러리 전시를 자유롭게 고른다 —
//     판매+판매도, 판매+전시도, 전시+판매도 전부 유효하다. 전시를 막는 것은
//     규칙이 아니라 남은 무료 전시 칸(1개)뿐이다.
//     전시는 주기적 현금을 주지 않는다 — 가치 상승 속도·상한·버프 수치는 정본에서 미정이라
//     이 엔진은 그 숫자를 아예 만들지 않는다.
// 14. 유리창 대성공은 보상을 한 번만 주고 약 1.2초 동안 플레이 입력만 잠근다.
//     전화 일시정지(paused)와는 다른 축이라 영구 정지로 번지지 않는다.
//
// 2026-08-12 라운드 003 승인판이 「유료 두 번째 작업대」를 여기에 얹는다:
// 15. 첫 「정상 완성품」 판매가 끝나는 순간 두 번째 작업대 상품이 60원에 열린다.
//     첫 미완성 70원 판매는 이 조건에 넣지 않는다. 해금은 상품이 생기는 것이지
//     칸이 늘어나는 것이 아니다 — 무료 확장은 없다.
// 16. 해금 순간 상점 탭 금빛 「NEW」와 새 카드의 금빛 테두리를 함께 켠다.
//     상점을 열어 카드를 확인하면(confirmWorkbenchCard) 두 알림이 함께 꺼지고,
//     구매 전이어도 다시 켜지지 않는다.
// 17. buySecondWorkbench가 60원을 실제로 받고 작업대를 2칸으로 만든다.
//     두 칸에서 멈춘다 — 세 번째·네 번째 작업대도, 리셋용 별도 재화도 없다.
// 18. 두 칸이 되면 도화지는 여전히 클릭 한 번에 한 장·100원이고, 밀기를 시작한
//     뒤에는 두 번째 장을 끼워 넣을 수 없다. 화면에서 움직이는 수동 밀대는 위쪽
//     공통 목재 막대 하나뿐이지만, 그 입력이 실제로 몇 점을 진행시키는지는 아래
//     19~21번이 정한다. 등급 판정·판매/전시 규칙은 이번 계약에서 바꾸지 않는다.
//
// 2026-08-14 C 확정(2.1·5.3·7절)이 제작 방식과 잉크 차단을 다시 정한다:
// 19. 새 게임 자체가 순차 제작이다. 검수 전환을 쓰든 쓰지 않든 기본 방식은 언제나
//     "sequential"이고, 한 번의 입력은 현재 대상 작품 하나만 1칸 진행하며 잉크 I 하나만
//     쓴다. 대상 작품을 마감해야 다음 번호로 옮겨 간다. 옛 "batch"(한 입력으로 올라간
//     도화지를 모두 함께 미는 묶음 공유 진행) 방식은 폐기됐다 — 이 판에 남아 있지 않다.
// 20. 동시 제작은 업그레이드로 해금한 뒤 "simultaneous"를 고른 경우에만 돈다. 그때만
//     미완성 작품 전부가 한 입력으로 함께 진행되고 I × 진행 작품 수를 쓴다. 업그레이드
//     가격·해금 시점·해금 조건은 미정이라 이 엔진이 만들지 않는다(검수 도구로만 연다).
// 21. 다음 입력의 전체 비용보다 잔량이 적으면 순차·동시 모두 입력 전에 제작 전체가
//     막히고 작품 진행도 잉크 차감도 0이다. 승인된 예외는 위 5번의 A 확정 첫 학습
//     작품 한 장뿐이며, 그 한 장만 인쇄 도중 소진을 허용한다.
//
// 인쇄 엔진 출처: 정본 2026-07-21-squeegee-v6.html 「시안 D · 결과별 자동 마감」
// (수동 3회 → 유지면 즉시 마감 / 상승이면 멈춤→윤곽 순차→착 맞춤, 13줄(80%) 자동
// 마무리, 초당 12줄 캡, 줄 단위 착 판정, 등급 상승 시에만 테두리 광택,
// 플래티넘 이상 멈칫+불꽃, 색판 어긋남→착 맞춤, 한 칸 밀 때 그림 흔들림).
// 유리창 완주 엔진 출처: show-window-print-feedback-v3-2026-08-04 장면 1
// (16줄 = 13줄 수동 + 3줄 자동, 완주마다 때 레이어 1장 제거).
//
// 시간축: 엔진은 스스로 시계를 갖지 않는다. tick(ms)로만 흐르며, 전화 중(paused)
// 에는 tick이 무시되어 예약된 연출·교체가 전부 멈췄다가 정확히 재개된다.
//
// 이 파일의 경제·확률·성장 숫자는 전부 state.js의 「시험값」에서 온다.
"use strict";

(function (root) {
  let State;
  let Art;
  let Grade; // 2026-10-06 두 방 데모 A — 클로드판 등급 회차 부품(grade-logic.js, 바이트 그대로 복사)
  if (typeof module !== "undefined" && module.exports) {
    State = require("./state.js");
    Art = require("./art.js");
    Grade = require("./grade-logic.js");
  } else {
    State = root.MewnaState;
    Art = root.MewnaArt;
    Grade = root.MewnaGrade;
  }
  const ECON = State.ECON_TEST_VALUES;
  const EXP = State.EXPANSION_TEST_VALUES; // 갤러리·검수 돈 시험값 (작업대 확장은 이번 판에서 쓰지 않는다)
  const UPGRADES = State.UPGRADES;
  const SEG = State.SEGMENT_TEST_VALUES; // 2026-10-08 3단계 — 구간 목표 금액

  // ── 저장된 대출 잔액의 계약 식별자 (2026-08-26 동현 확정) ───────────
  // 「이 잔액이 어떤 계약의 숫자인가」를 저장이 직접 밝힌다. 구형 부모판 대출
  // (원금 1,000 · 총상환 2,000 · 250원 분할)에는 이 값이 없으므로, 불러올 때
  // 그 잔액을 신형 200원으로 조용히 바꾸지 않고 대출만 미체결로 되돌린다.
  //
  // 2026-08-26 6차 독립 검토 대응: 값 자체는 규칙 파일 한 곳에서만 나온다.
  // 규칙(loanFromSave)도 「지금 스키마 저장인데 필수 필드가 빠졌다」를 판정해야 해서
  // 두 파일이 같은 문자열을 따로 들면 판정이 둘로 갈라진다.
  const LOAN_SAVE_SCHEMA_ID = State.LOAN_SAVE_SCHEMA;

  // ── V6 정본·유리창 정본 상수 ─────────────────────────────────
  const CONSTANTS = Object.freeze({
    ART: 16, // 그림·창문 16줄
    SUB: 3, // 1칸 = 3×3 (색판 어긋남 표현)
    AUTO_ROWS: 13, // 13줄(80%)부터 자동 마무리 (V6 정본)
    MAX_ROWS_PER_SEC: 12, // 트랙패드 관성 폭주 캡 (V6 정본, 밀대 속도 0단계 기준)
    NOTCH_PX: 100, // 휠 딸깍 1번 = deltaY 100
    MANUAL_STROKES: ECON.manualPrintCount, // 수동 인쇄 3회 — 시험 리듬, 바꾸지 않는다
    // 2026-08-19 라운드 006: 겹 수는 디버그 창에서 3·4·5로 바꿀 수 있어 상수 하나로
    // 굳히지 않는다. 여기 값은 「기본값」이고, 실제로 도는 값은 windowStrokes()가 낸다.
    WINDOW_STROKES: ECON.windowStrokesPerWindow, // 기본 4 — 밀대 완주 4회 = 창문 1장
    WINDOW_LAYERS: ECON.windowStrokesPerWindow, // 때 레이어 수 = 완주 횟수 (완주 1회에 1겹)
    WINDOW_AUTO_ROW_MS: 70, // 유리창 자동 마무리 한 줄 (v3 정본, 밀대 속도 0단계)
    WINDOW_SWAP_MS: 1100, // 완성 창문이 새 더러운 창문으로 바뀌는 시간
    PRINT_AUTO_ROW_MS: 65, // 인쇄 자동 마무리 한 줄 (V6 정본, 밀대 속도 0단계)
    PROMOTE_PAUSE_MS: 200, // 상승 분기 멈춤 (V6 정본)
    OUTLINE_MS: 500, // 윤곽 순차 인쇄 (V6 정본)
    HOLD_MS: 300, // 착 맞은 그림 유지 (V6 정본)
    FREEZE_MS: 300, // 플래티넘 이상 멈칫 (V6 정본)
    REVEAL_TO_SALE_MS: 1500, // 발표 → 자동 판매 (갤러리 해금 뒤에는 곧바로 결과판)
    // 유리창 대성공 뒤 플레이 입력을 잠그는 시간 — 계약의 「약 1.2초」.
    // 전화 일시정지(paused)와 섞이지 않는 별도 축이다.
    JACKPOT_LOCK_MS: 1200,
    SHAKE_MS: 90, // 한 칸 민 직후 그림이 눌리듯 흔들리는 시간 (V6 시안 D 정본)
    WET_MS: 600, // 밀대가 지나간 줄의 젖은 광택 (V6 시안 D 정본, 잉크 둑 커서 세트)
    CATALOG_FALL_MS: 900, // 카탈로그 낙하
    CATALOG_UNLOCK_MS: 1000, // 황금빛 해금 연출
    CATALOG_DOCK_MS: 600, // 원작 슬롯으로 이동·축소
    INK_RING_DELAY_MS: 2000, // 첫 판매 결과를 보여준 뒤 세 번째 전화
    TICK_STEP_MS: 50, // tick 내부 잘게 나누기 (예약 연쇄가 순서대로 발화)
    // ── 속도 업그레이드 효과 (시험값) ──
    // 같은 계산식을 쓰지만 「고무 밀대 속도」는 유리창에만, 「인쇄 스퀴지 속도」는
    // 인쇄에만 적용된다. 서로의 단계를 절대 읽지 않는다.
    SPEED_ROWS_PER_LEVEL: 0.5, // 휠 한 칸당 줄 수: 1 → 1.5
    SPEED_CAP_PER_LEVEL: 0.5, // 초당 줄 캡: 12 → 18
    SPEED_AUTO_PER_LEVEL: 0.4, // 자동 마무리 시간: ÷1.4 (겉으로 알리지 않는 내부 개선)
    KEY_ROWS: 1.4, // 아래 화살표 1회 기본 줄 수
  });
  const C = CONSTANTS;

  const STAGE_NAMES = Object.freeze(["밑색", "큰 형태", "디테일·명암", "윤곽·마감"]);
  // 2026-10-16 v7 · 형님 48-B 확정(19:25): 치약 쥐어짜기는 「이 그림이 끝나기 전에 잉크가 바닥날 때만」.
  // true = 48-B(완성으로 끝나는 그림은 구멍 없이 — 확정) · false = 48-A(8/24처럼 잔량 10% 아래면 언제나 — 안 고름)
  const SQUEEZE_ONLY_WHEN_RUNNING_OUT = true;
  // 색판 어긋남 방향 (V6 PLATE_OFF 4장 + 2026-10-20 v9 시안의 5 · 6번째 판)
  const GROUP_OFF = [[0, 0], [0, 1], [1, 0], [-1, 1], [1, 1], [-1, 0]];
  // 2026-10-20 v9 — 한 번에 한 색(그릴미 기둥 2-3): 색판 하나 = 색 하나. 칠하는 순서는 art.js의 plateOrder가 정하고,
  // 마지막 판은 자동 마감(잉크 0)이다. 판 수 = 색 수(4~6) · 직접 미는 횟수 = 판 수 − 1(3 · 3 · 4 · 4 · 5 · 5).
  // (v8까지는 원작마다 색 여러 개를 4장으로 묶었다 — 뮤나리자는 원래 한 판에 한 색이라 그대로다.)
  const PLATE_GROUPS = {};
  Art.ORIGINALS.forEach(function (o) {
    PLATE_GROUPS[o.key] = (o.plateOrder || []).map(function (ch) { return [ch]; });
  });

  function createEngine(options) {
    const opt = options || {};
    // 검수용 작품 준비는 일반 게임 엔진에서 닫혀 있다. 캡처 하네스가 명시적으로
    // reviewHarness:true를 넘긴 격리 인스턴스에서만 상태 준비를 허용한다.
    const reviewHarness = opt.reviewHarness === true;
    let rng = opt.rng || Math.random;
    // 잭팟 전용 난수 — 등급 추첨과 섞이지 않게 따로 둔다(테스트 결정성 확보).
    let jackpotRng = opt.jackpotRng || function () { return rng(); };
    let S = null;
    let timers = null;
    let events = null;

    function init() {
      const ownedUpgrades = {};
      State.UPGRADE_KEYS.forEach(function (key) { ownedUpgrades[key] = 0; });
      S = {
        clock: 0,
        started: false,
        paused: false,
        // ── 2026-08-26 v1 · 현금 하나뿐이다 ────────────────────────────
        // money(현금)는 절대 음수가 되지 않는다. 부모판의 자동 신용 빚 상태와
        // 「수입이 빚부터 갚는」 자동 상환 흐름은 계약 1항으로 통째로 폐기됐다.
        // 살 돈이 없으면 빚지지 않고 그냥 행동이 막히고, 그 막힘이 대출 전화를 부른다.
        money: ECON.startMoney, // 새 게임 시작 현금 20$
        // ── 2026-08-26 v1 · 스크래치식 대출 계약 ───────────────────────
        // 이 판에 남은 유일한 빚이다. 상시 클릭 진입점이 없고, 돈이 없어 막히는
        // 한 번의 위기에서 걸려 오는 전화로만 열린다. 모양은 State.emptyLoan()이 정한다.
        loan: State.emptyLoan(),
        // 방금 실제로 삭감된 수입 한 줄 — 화면이 원금액과 삭감액을 숨기지 않고 말한다.
        lastIncomeCut: null, // { gross, net, cut, source }
        // 안내 통화가 울리는 중에 위기가 왔을 때 「끝나면 바로 걸어라」는 표식.
        // 제안이 판마다 한 번뿐이라 흘려보내면 위기가 통째로 사라진다.
        loanCrisisPending: null,
        // 2026-08-27 유리 A 승인 — 유리가 처음 깨졌으니 안내 전화를 걸어야 한다는 표시.
        // 저장하지 않는 「지금 한 순간」이다. 실제로 거는 것은 maybeRing()이다.
        glassBreakCallPending: false,
        mode: "idle", // idle | window | print — 중앙 작업대에 놓인 것
        window: null,
        windowsDone: 0,
        // ── 디버그 창 (2026-08-19 · 0817 피드백 4번) ─────────────────
        // D키로 여는 가운데 팝업. 이번 라운드에서는 동현이 명시한 유리창 3항목만 산다.
        // 나머지 항목과 최종 UI 방식은 시안을 고른 뒤 다음 라운드에서 붙인다.
        //   windowLayers      — 유리창 때가 몇 겹인가 (3·4·5). 진행 중인 창문에도 곧바로 든다.
        //   windowScrollSpeed — 유리창 밀대가 얼마나 빨리 굴러가는가 (1이 기본 속도의 1배)
        //   windowPay         — 레벨 0에서 창문 한 장을 끝냈을 때 받는 금액.
        //                       도화지 100원까지 몇 장인지 세어 보라고 만든 항목이라
        //                       레벨 0만 덮는다. 레벨 1의 확정 결과표는 그대로 돈다.
        debug: {
          open: false,
          values: {
            windowLayers: ECON.windowStrokesPerWindow,
            windowScrollSpeed: 1,
            windowPay: State.WINDOW_RULES.tables[0][0].pay,
            // 잉크 둑 커서 — 밀대 앞에 물감(유리창은 밀린 때)이 뭉쳐 굴러가는 연출.
            // 동현 요청으로 유리창·그림판을 각각 껐다 켤 수 있게 나눠 둔다.
            // 1 = 켬 · 0 = 끔.
            windowInkDam: 1,
            printInkDam: 1,
            // ── 2026-08-19 확정 · 10개 확장 ─────────────────────────
            // 조사안의 39개 후보 중 「검수가 실제로 막히는 것」부터 골랐다.
            forceGrade: -1, // 다음 작품 등급 강제 (-1 무작위 · 0 브론즈 ~ 4 다이아)
            timeScale: 1, // 시간 배속 — 전화·연출을 기다리는 시간을 줄인다
            firstInkPercent: 0, // 최초 물감량 % (0이면 규칙값 그대로)
            windowPayLv1: 0, // 레벨 1 완성 보수 (0이면 규칙값 그대로)
            // ── 2026-08-25 회의 전 추천안 · 계약 2 ────────────────────
            // 밑그림을 어떻게 보여 줄지 회의 자리에서 바로 비교하는 손잡이다.
            //   0 = 단색 윤곽 (기본 A) — 채우지 않은 한 색 윤곽선
            //   1 = 옅은 원색 (비교 B) — 원작 색을 낮은 불투명도로
            // 진행도·잉크·돈·등급을 하나도 건드리지 않는 「보기」 전용 값이다.
            underdrawing: 0,
            // ── 2026-08-27 v1 · 유리 A 승인 ──────────────────────────
            // 결과별 자동 마감을 켜고 끄며 조작 리듬을 비교하는 손잡이다.
            //   1 = 켬 (정본 기본값 — 80% 뒤 부드럽게 자동 마무리)
            //   0 = 끔 (끝까지 직접 밀어야 한 겹이 벗겨진다)
            windowAutoFinish: 1,
          },
          // 회의 검수용 「다음 유리창 파손」 한 번 예약 (계약 5).
          // 다음 한 장의 결과만 바꾸고, 쓰이는 순간 저절로 꺼져 이후 확률은 원래대로다.
          breakNextWindow: false,
        },
        strokesDone: 0,
        jackpots: 0,
        catalog: "none", // none | falling | landed | unlocking | docking | docked
        // 유리창 대성공 뒤 플레이 입력을 막아 두는 게임 시계 시각.
        // paused와 달리 시계는 그대로 흐르고, 지나면 저절로 풀린다.
        inputLockUntil: -1,
        // extraPrint(같은 그림 추가 인쇄)는 계산 얼개만 남기고 이번 대표 흐름에서는 잠가 둔다.
        // 공개 상태(getState)에는 내보내지 않는다 — 화면에도 상태에도 드러나지 않는다.
        unlocked: {
          paper: false, catalog: false, shop: false, extraPrint: false,
          // 두 번째 정상 완성 판매 순간 무료로 함께 열린다 (라운드 005).
          gallery: false,
        },
        // 중앙 작업면의 칸 수 — 시작은 언제나 한 칸이다.
        // 무료 확장은 없다. 두 번째 칸은 아래 secondBench 상품을 60원에 사야만 열린다.
        workbench: { slots: 1, expanded: false },
        // 두 번째 작업대 유료 상품 (2026-08-12 계약 7~10).
        //   unlocked  — 첫 정상 완성품 판매 직후 켜진다 (미완성 판매는 조건 아님)
        //   seen      — 상점에서 카드를 확인했다. 한 번 켜지면 다시 꺼지지 않는다
        //   purchased — 60원을 실제로 냈다
        // 알림(금빛 NEW·금빛 테두리)은 unlocked && !seen인 동안에만 켜진다.
        secondBench: { unlocked: false, seen: false, purchased: false },
        // 상점 탭 금빛 「NEW」 — 카드 테두리와 함께 켜지고 함께 꺼지는 별개의 알림이다.
        shopTabNew: false,
        firstNormalSaleDone: false, // 첫 「정상 완성」 판매를 이미 겪었는가
        works: [], // 이번 묶음에 올라간 작품들 — 등급·가격·결과를 각각 따로 들고 있다
        resultsOpen: false, // 산 도화지를 다 찍어 결과판이 선택을 기다리는 중
        expansionComplete: false, // 이번 묶음의 결과를 모두 처리했다
        // 무료 전시 칸 1개. 주기 수입·가치 상승 수치는 만들지 않는다 (정본 미정).
        gallery: { unlocked: false, items: [] },
        // 실제 경제와 분리된 검수 전용 돈. 한 번이라도 쓰면 표시가 계속 남는다.
        reviewMoney: { used: false },
        // ── 제작 방식과 검수 전용 전환 (2026-08-15 A~D 통합 검수 도구) ─────
        // productionMode는 검수 전용 값이 아니라 이 판의 제작 방식 그 자체다. 새 게임은
        // 언제나 작업대 1개·순차 제작으로 시작하고, 검수 도구를 쓰지 않아도 그 값이 돈다.
        // 3·4번째 작업대와 동시 제작 해금은 아직 자연 경로가 없어 상단 검수 바로만 열어
        // 본다. 그 도구는 돈·경험치·판매수·상점·업그레이드·자연 상품 해금을 하나도
        // 건드리지 않는다.
        //   used                  — 검수 전환을 한 번이라도 썼는가 (흔적)
        //   workbenchCount        — 검수로 세워 둔 작업대 수 1~4
        //   simultaneousUnlocked  — 동시 제작 해금 여부 (가격·조건은 미정이라 만들지 않는다)
        //   productionMode        — "sequential"(기본) | "simultaneous"(해금 뒤 선택)
        review: {
          used: false,
          workbenchCount: 1,
          simultaneousUnlocked: false,
          productionMode: "sequential",
          // 검수 전용 잉크 여유분(칸). 3·4번째 작업대는 아직 자연 경로가 없어
          // (상점 잉크통은 두 장분이 끝) 겉모습을 검수하려면 이 손잡이가 필요하다.
          // 돈·경험치·판매수·해금·확률·작업대 칸수는 하나도 건드리지 않는다.
          inkBonus: 0,
          inkUsed: false, // 검수 잉크를 썼다는 별도 흔적 (used와 뜻이 다르다)
        },
        // 순차 제작에서 지금 밀고 있는 작품 번호 (0부터).
        seqSlot: 0,
        // ── 2026-08-26 v1 · 작업대별 독립 입력 (계약 5항) ─────────────
        // 「순차·동시 전체 입력」이 아니라 「포인터가 올라간 한 대」가 입력을 받는다.
        // 화면이 호버로 이 값을 옮기고, 옮긴 작업대의 인쇄 상태만 S.print가 된다.
        // 다른 작업대의 인쇄 상태는 그 작품(works[i].printState)에 그대로 보관된다.
        benchFocus: 0,
        // 상점 카드별 알림 (계약 6항).
        //   popupShown — 이 카드가 「처음」 열릴 때의 아이콘 팝업을 이미 띄웠는가
        //   isNew      — 지금 NEW를 켜 두어야 하는가 (카드를 확인하면 꺼진다)
        shopNotices: {},
        // 지금 띄워 둔 최초 해금 아이콘 팝업 ({ key, label } 또는 null).
        shopPopup: null,
        // 첫 판매 손실 결과 — 「도화지값 / 판매가 / 손실」 한 묶음과 확인 대기 표시.
        // 확인을 누르기 전에는 잉크통 전화도 다음 도화지도 진행되지 않는다 (라운드 001).
        lossResult: null,
        inkCallScheduled: false, // 잉크통 전화 예약은 판마다 딱 한 번만 건다

        lastSalePrice: 0, // 결과판의 「받은 돈」 표시용
        upgrades: ownedUpgrades,
        shopRevealed: 0, // 선형 해금: 상점에 공개된 항목 수 (0~5)
        // 디버그 「상점 공개」로 통째로 연 판인가. 여기서 잰 경제 수치는
        // 자연 플레이로 도달한 상태가 아니라는 표시다 (전체 초기화로만 풀린다).
        debugShopRevealed: false,
        // 2026-10-08 두 방 데모 3단계: 공방 경험치·레벨을 없앴다(10/6 그릴미 · 형님 3-A).
        // 두 칸은 저장 모양을 지키려고 남겨 두되 더는 오르지 않는다 — 레벨은 언제나 1이라
        // 판매가에 레벨 보너스가 붙지 않는다(형님 6-A).
        xpTotal: 0,
        level: 1,
        // 구간 목표 금액 — index = 지금 구간(0부터, 다 넘으면 5), earned = 이번 구간에 번 돈
        segment: { index: 0, earned: 0 },
        // 구간 2를 넘으면 생기는 경매장 문 자리 — 4·5단계 전까지는 누를 수 없다
        auctionDoor: { open: false },
        // 마지막 구간을 넘으면 뜨는 「1막 끝」 화면(10/6 4-A — 화면 자리만, 초기화 없음)
        act1End: { reached: false, open: false },
        ink: { cells: 0, capacity: ECON.ink.baseCapacity },
        paperSizeKey: ECON.paperSizes[0].key,
        phone: {
          open: false, ringing: null, script: null, page: 0,
          // glassBreak — 2026-08-27 유리 A 승인: 유리가 처음 깨진 자리의 안내 전화 한 통.
          done: { paper: false, ink: false, glassBreak: false },
        },
        hasPaper: false,
        awaitingOriginal: false, // 흰 도화지는 놓였지만 아직 원작을 안 고른 상태
        print: null,
        artworksStarted: 0,
        artworksSold: 0,
        // 2026-08-19: 자동화 해금은 「손으로 몇 번 해 봤는가」를 본다. 자동으로 처리된
        // 것은 세지 않는다 — 자동화가 자기 자신을 열어 주면 뜻이 없기 때문이다.
        papersBoughtByHand: 0, // 손으로 산 도화지 수
        worksSoldByHand: 0, // 손으로 판 작품 수
        // 자동판매를 잠시 꺼 두는 스위치. 갤러리에 걸고 싶은 작품이 나왔을 때 쓴다 —
        // 스위치가 없으면 자동판매를 사는 순간 갤러리에 걸 작품이 영영 안 생긴다.
        autoSellOn: true,
        firstSaleDone: false,
        scopeComplete: false,
        currentOriginalKey: null, // 원작은 도화지를 산 뒤에 고른다 (2026-08-06 확정)
        nextOriginalKey: null,
        // 2026-10-20 v9 · 펠로우십 스레드 6-A: 첫 잉크통을 사면 다음 한 장 참가비를 한 번 대신 내 준다.
        //   "none" 아직 안 받음 · "ready" 다음 한 장이 무료 · "used" 이미 씀(한 판에 한 번)
        freeSheet: "none",
        // 2026-10-08 두 방 데모 4단계: 가진 원작과 그 원작의 레벨. 0이면 아직 없는 원작이다.
        // 처음엔 뮤나리자(레벨 1)만 있고, 나머지는 경매장 문에서 얻는다(기둥 ③ · 형님 12-A).
        originalLevels: State.startingOriginalLevels(),
        lastEvent: "",
        saleFeedback: "",
      };
      timers = [];
      events = [];
    }
    init();

    // 플레이 입력이 지금 통하는가.
    // 전화 일시정지(paused)와 대성공 입력 잠금(inputLockUntil)은 서로 다른 축이다.
    // 잠금은 시계가 흐르면 저절로 풀리고, 영구 정지로 바뀌지 않는다.
    function inputLocked() { return S.clock < S.inputLockUntil; }
    function canInteract() { return S.started && !S.paused && !inputLocked(); }
    function pushEvent(type, data) {
      const ev = data || {};
      ev.type = type;
      events.push(ev);
    }

    // ══ 돈이 드나드는 문 (2026-08-26 v1) ═══════════════════════════
    // 이 판의 돈은 현금(S.money) 하나뿐이다. 자동 신용 빚과 「수입이 빚부터 갚는」
    // 자동 상환 흐름은 계약 1항으로 폐기됐다. 남은 문은 아래 두 개다.
    //   gainIncome    — 실제 게임 수입.
    //   payWindowCost — 유리창 노동비. 낼 수 있는 만큼만 나가고, 못 낸 것은 위기가 된다.
    // 대출금 지급과 상환은 「수입」이 아니라 남의 돈이라 이 두 문을 지나지 않는다.

    // 지금 이 판에 실제로 걸려 있는 대출 불이익 하나 (없으면 null).
    // 판매·상점·밀대 세 자리가 각자 조건을 세지 않고 이 한 곳만 본다.
    function loanPenalty() { return State.activeLoanPenalty(S.loan); }

    // 이 상점 항목의 「지금 값」 — 카드가 말하는 값과 실제로 빠져나가는 금액이
    // 언제나 같아야 하므로 두 자리(shopState · buyUpgrade)가 이 함수 하나만 쓴다.
    function shopCostNow(u, level) {
      return State.shopCostWithPenalty(State.upgradeCostFor(u, level), loanPenalty());
    }

    // 실제 게임 수입 — 유리창 보수, 작품 수동/자동/묶음 판매가 전부 여기를 지난다.
    //
    // 2026-08-26 동현 승인: 「잔액이 남는 동안 핵심 반복 수입 50% 삭감」은 폐기됐다.
    // 유리창 보수는 빚이 남아 있어도 총보수 원금액이 온전히 들어온다. 깎이는 것은
    // 이 계약이 salePriceDown 을 골랐을 때의 「작품 판매」한 채널뿐이고, 그때도
    // 원금액(gross)과 삭감액(cut)을 숨기지 않는다.
    function gainIncome(amount, source) {
      const kind = source || "income";
      const split = (kind === "sale")
        ? State.loanSaleSplit(S.loan, amount)
        : { gross: Math.max(0, Math.round(Number(amount) || 0)) };
      if (split.net === undefined) { split.net = split.gross; split.cut = 0; }
      S.money += split.net;
      // 2026-10-08 3단계: 진짜 벌이(유리창 보수 · 작품 판매)만 구간 막대에 쌓는다.
      // 판매가 대출 불이익으로 깎였다면 실제로 손에 들어온 돈(net)만 센다.
      if (SEG.countedSources.indexOf(kind) >= 0) advanceSegment(split.net);
      if (split.cut > 0) {
        S.lastIncomeCut = {
          gross: split.gross, net: split.net, cut: split.cut, source: kind,
        };
        pushEvent("salePenalty", {
          gross: split.gross, net: split.net, cut: split.cut,
          penalty: loanPenalty().key, balance: State.loanOwed(S.loan), source: kind,
        });
      }
      return split;
    }

    // ══ 구간 목표 금액 (2026-10-08 두 방 데모 3단계) ═════════════════
    // 비유: 계단 다섯 칸. 이번 칸에서 번 돈이 목표에 닿으면 문 하나가 열리고 다음 칸으로 오른다.
    // 계산은 규칙 파일(State.segmentAdvance)이 하고, 여기서는 넘은 칸마다 문을 연다.
    function advanceSegment(amount) {
      if (S.act1End.reached) return; // 1막 끝까지 왔으면 더 세지 않는다
      const capsBefore = UPGRADES.map(upgradeCap);
      const r = State.segmentAdvance(S.segment.index, S.segment.earned, amount);
      S.segment.index = r.index;
      S.segment.earned = r.earned;
      r.cleared.forEach(onSegmentCleared);
      // 2026-10-20 v9: 구간이 단계 관문을 연 상점 카드(잉크통 2 · 3단계)는 「같은 카드의 다음 단계」 알림(NEW만)으로 알린다.
      UPGRADES.forEach(function (u, i) {
        if (i >= S.shopRevealed) return;
        const capNow = upgradeCap(u);
        if (capNow > capsBefore[i] && S.upgrades[u.key] < capNow) {
          markShopUnlocked(u, false);
          pushEvent("upgradeStageOpened", { key: u.key, label: u.label, level: capNow });
        }
      });
    }
    function onSegmentCleared(i) {
      const reward = SEG.rewards[i];
      pushEvent("segmentCleared", {
        index: i, number: i + 1, goal: SEG.goals[i], reward: reward,
        label: State.segmentRewardLabel(reward),
      });
      // 경매장 문 자리 — 4·5단계에서 진짜 경매장으로 이어진다. 지금은 보이기만 한다.
      if (reward === "auctionDoor" && !S.auctionDoor.open) {
        S.auctionDoor.open = true;
        pushEvent("auctionDoorOpened");
      }
      // v5: 「original:키」 = 경매장 문 새 원작 칸에 그 원작이 살 수 있게 뜬다(예고 → 매물).
      if (typeof reward === "string" && reward.indexOf("original:") === 0) {
        pushEvent("originalLotOpened", { key: reward.slice("original:".length) });
      }
      // 상점 항목이 보상이면 상점을 다시 훑어 연다(같은 알림 경로 — 팝업·NEW).
      refreshShop();
      // 마지막 칸 — 「1막 끝」 화면을 띄우고 게임 시계를 멈춘다(전화가 쓰는 것과 같은 정지).
      if (i === SEG.goals.length - 1 && !S.act1End.reached) {
        S.act1End.reached = true;
        S.act1End.open = true;
        S.paused = true;
        pushEvent("act1End");
      }
    }
    // 「1막 끝」 화면의 「계속 하기」 — 화면을 닫고 그대로 이어서 논다(초기화 없음).
    function closeAct1End() {
      if (!S.act1End.open) return false;
      S.act1End.open = false;
      S.paused = false;
      pushEvent("act1EndClosed");
      return true;
    }

    // 유리창 노동비 — 선투자와 파손 배상 두 가지뿐이다.
    // 현금이 모자라도 빚이 생기지 않는다. 가진 만큼만 나가고 현금은 0에서 멈추며,
    // 못 낸 금액이 있으면 그것이 곧 「대출 전화를 부르는 위기」다.
    // 일반 구매(도화지·업그레이드·작업대)는 이 함수를 쓰지 않는다 — 현금 검사로 막힌다.
    function payWindowCost(amount, source) {
      const want = Math.max(0, Math.round(Number(amount) || 0));
      const paid = Math.min(S.money, want);
      S.money -= paid;
      const unpaid = want - paid;
      if (unpaid > 0) {
        pushEvent("costUnpaid", { want: want, paid: paid, unpaid: unpaid, source: source || "window" });
        maybeOfferLoan(source || "window");
      }
      return { paid: paid, unpaid: unpaid };
    }

    // ══ 스크래치식 대출 계약 (2026-08-26 v1) ═══════════════════════
    // 계약서는 상시 클릭 시작점이 아니다. 아래 두 조건 중 먼저 발생한 「한 번의 위기」
    // 에서만 전화가 오고, 그 전화가 유일한 진입점이다.
    //   1) 유리창 파손 비용을 낼 돈이 부족하다        (payWindowCost의 unpaid)
    //   2) 필수 행동이 0원 때문에 막힌다              (blockedByNoMoney)
    // 거절하면 이번 생에는 다시 제안하지 않는다. 다만 2026-08-26 동현 승인으로
    // 「완납해도 재대출 없음」은 폐기됐다 — 200원을 전액 갚으면 그 계약이 닫히고,
    // 그 뒤 새 위기가 오면 같은 전화가 처음부터 다시 열린다(새 불이익을 다시 뽑는다).

    // 위기 한 번 — 아직 제안한 적이 없을 때만 전화가 울린다.
    //
    // 2026-08-26 4차 독립 검토 대응: 여기서 세던 `offered || declined || signed`는
    // truthiness라 `offered:0` 하나만 밀어 넣어도 「아직 제안 전」으로 읽혔고,
    // 그 전화가 곧바로 수락·서명·원금 재지급으로 이어졌다(현금 0 → 100 재현).
    // 이제 판정은 규칙 파일의 엄격 함수 하나(State.loanOpportunityLeft)가 하고,
    // 엔진은 「그 기회 중에서도 아직 전화가 울리지 않은 자리인가」만 덧붙인다.
    //
    // 2026-08-26 5차 독립 검토 대응: 여기서 읽는 플래그도 「대출 상태 자신의 필드」다.
    // 프로토타입에 올려 둔 값은 사실로 읽지 않는다 (State.loanOwnField).
    function maybeOfferLoan(reason) {
      if (!S.started) return false;
      if (!loanReliefLeft()) return false; // 기회 자체가 남아 있지 않다
      if (loanFlag("offered") !== false) return false; // 이미 한 번 울린 판이다
      if (S.phone.open || S.phone.ringing) {
        // 2026-08-27 유리 A 통합 대응: 아직 받지도 않은 파손 안내 벨이 울리고 있다면
        // 위기 쪽이 먼저다. 지갑이 빈 자리에서 유일한 탈출구를 안내 한 통 뒤로 미루면,
        // 그 통화를 받지 않는 동안 판이 통째로 잠긴다. 안내는 잃어버리지 않고 다시
        // 예약해 두었다가 위기 통화가 끝난 뒤에 건다.
        if (!S.phone.open && S.phone.ringing === "glassBreak") {
          S.glassBreakCallPending = true;
          S.phone.ringing = null;
        } else {
          // 안내 통화가 이미 울리고 있으면 그 통화가 끝난 뒤에 건다.
          // 제안이 판마다 한 번뿐이라 여기서 그냥 흘려보내면 위기가 통째로 사라진다.
          S.loanCrisisPending = reason || "blocked";
          return false;
        }
      }
      S.loan.offered = true;
      ring("loan");
      pushEvent("loanOffer", { reason: reason || "blocked" });
      return true;
    }

    // 「필수 행동이 0원 때문에 막혔다」 — 지갑이 완전히 빈 채로 도화지·업그레이드·
    // 작업대 구매가 거절된 순간이다. 그 자리에서 딱 한 번 대출 전화가 온다.
    function blockedByNoMoney(source) {
      if (S.money > 0) return false; // 0$일 때만이 계약이 말한 위기다
      return maybeOfferLoan(source || "blocked");
    }

    // ══ 공통 교착 방지 계약 (2026-08-26 동현 확정) ═══════════════════
    // 현금을 쓰는 「제품 구매」는 도화지·상점 업그레이드·두 번째 작업대 셋뿐이고,
    // 세 경로 모두 아래 blockDeadlockPurchase() 한 문을 지난다. 판정 자체는 규칙
    // 파일의 순수 함수(State.purchaseDeadlocks)가 하고 엔진은 지금 판의 사실만 넘긴다.
    // 검수 전용 현금 손잡이(setReviewMoney·addReviewMoney)는 제품 구매가 아니라
    // 이 문을 지나지 않는다 — QA는 일부러 위기 상태를 만들 수 있어야 한다.

    // 아직 대출로 현금이 들어올 여지가 남아 있는가.
    // 서명했으면 이미 받았고, 거절했으면 이번 생에는 다시 걸려 오지 않는다.
    // 아직 제안 전이거나 수락하고 서명을 안 했으면 남아 있다.
    // 2026-08-26 동현 승인: 완납하면 그 계약이 「빈 새 계약」으로 닫히므로, 갚은
    // 판은 여기서 다시 「기회가 남았다」로 읽힌다 — 그것이 재대출이 열리는 자리다.
    //
    // 2026-08-26 4차 독립 검토 대응: 「무엇이 아니다」를 하나씩 세던 방식을 버리고
    // 「무엇이어야 하는가」를 규칙 파일의 엄격 함수 하나로 묻는다. 예전 방식은
    // `signed !== true` 같은 부정 검사라 falsy 비정식 값(offered:0 · signed:0)이
    // 전부 통과했고, 위기 전화 개방·교착 판정·구매 문이 그 잘못된 「새 판」 판정을
    // 함께 따랐다. 이제 정식 조합(pristine · 전화 제안 중 · 정상 계약서 대기)이
    // 아니면 어느 경로에서도 기회가 남았다고 읽히지 않는다.
    // 계약이 인정하는 빚(State.loanOwed)이 남아 있으면 그것만으로도 이미 받은 것이다 —
    // 정식 조합은 모두 잔액이 정확한 숫자 0이라 이 검사와 어긋나지 않는다.
    function loanReliefLeft() {
      return State.loanOpportunityLeft(S.loan) && State.loanOwed(S.loan) <= 0;
    }

    // 지금 대출 상태에서 「이 판 자신의 필드」로 적혀 있는 플래그 하나.
    // 상속된 값·없는 값·읽을 수 없는 값은 모두 undefined로 읽힌다 — 규칙 쪽 엄격
    // 판정(State.loanOpportunityLeft)과 같은 원칙을 엔진도 그대로 쓴다.
    function loanFlag(key) { return State.loanOwnField(S.loan, key); }

    // 「정식 전화 제안 중」인가 — 전화가 울렸고 아직 수락도 거절도 하지 않은 자리다.
    // 불러오기가 그 한 통을 다시 걸어야 하는지 판정하는 유일한 조건이며, 위기 전화
    // 개방·수락과 같은 엄격 조합 하나를 나눠 쓴다.
    function loanOfferCallPending() {
      if (!S.started) return false;
      if (!loanReliefLeft()) return false;
      return loanFlag("offered") === true && loanFlag("accepted") === false;
    }

    // 팔아서 현금을 회복할 작품이 남아 있는가. 결과를 아직 고르지 않은 작품 한 점이면
    // 미완성 정액가로도 현금이 들어오므로 교착이 아니다. 이미 팔았거나 갤러리에 건
    // 작품(outcome이 정해진 작품)은 회복 경로가 아니다.
    function sellableWorkLeft() {
      return S.works.some(function (w) { return !w.outcome; });
    }

    // 이 구매가 영구 교착을 만드는가.
    //   grantsWork — 이 구매 자체가 팔 수 있는 작품을 낳는가 (도화지 한 장).
    //                도화지는 사는 그 순간 회복 경로가 함께 생기므로 교착이 아니다.
    function purchaseDeadlocks(cost, grantsWork) {
      return State.purchaseDeadlocks({
        money: S.money,
        cost: cost,
        loanLeft: loanReliefLeft(),
        workLeft: !!grantsWork || sellableWorkLeft(),
      });
    }

    // 막을 자리면 이유를 한 줄로 남기고 true를 돌려준다. 호출부는 그대로 거절하면 된다.
    // 돈·단계·작업 상태는 한 푼도 건드리지 않는다.
    function blockDeadlockPurchase(label, cost, grantsWork) {
      if (!purchaseDeadlocks(cost, grantsWork)) return false;
      pushEvent("purchaseBlockedByDeadlock", {
        label: label, cost: cost, money: S.money, reserve: State.DEADLOCK_GUARD.reserve,
      });
      S.lastEvent = State.deadlockGuardLine(label);
      return true;
    }

    // 전화 마지막 장에서 「수락」 — 계약서가 열린다. 아직 체결은 아니다.
    // 성립 판정은 화면이 아니라 여기서 한다. 버튼을 숨겨 두는 것만 믿으면
    // 콘솔·검수 도구로 앞 장에서 불러 권유 순서를 통째로 건너뛸 수 있다.
    // 2026-08-26 4차 독립 검토 대응: 성립 조건도 위 두 판정과 같은 엄격 함수를 쓴다.
    // 한 경로만 막으면 다른 경로가 그대로 남는다 — 개방·수락·서명·교착이 한 계약을
    // 나눠 쓰게 하는 것이 이 수정의 핵심이다.
    function acceptLoanOffer() {
      if (!phoneChoiceOpen()) return false; // 마지막 선택 장에서만 성립한다
      if (!loanReliefLeft()) return false; // 정식 조합이 아니면 기회가 없다
      if (loanFlag("offered") !== true || loanFlag("accepted") !== false) return false;
      if (State.loanOwed(S.loan) > 0) return false; // 이미 진 빚이 남아 있다
      S.loan.accepted = true;
      closePhone();
      S.lastEvent = "대출 계약서가 도착했습니다 — 서명하기를 누르면 체결됩니다";
      pushEvent("loanAccepted", {});
      return true;
    }

    // 전화 마지막 장에서 「거절」 — 이번 생에는 다시 제안하지 않는다.
    // 수락과 같은 문을 쓴다 — 마지막 선택 장 전에는 성립하지 않는다.
    function declineLoanOffer() {
      if (!phoneChoiceOpen()) return false;
      if (loanFlag("accepted") || loanFlag("signed")) return false;
      S.loan.declined = true;
      closePhone();
      S.lastEvent = "대출을 거절했습니다 — 다시 걸려 오지 않습니다";
      pushEvent("loanDeclined", {});
      return true;
    }

    // 서명 — 수락한 계약서에서 한 번만 성립한다. 현금 +100원, 갚을 잔액 200원.
    // 서명하는 그 순간 숨겨 뒀던 이자 100%와 총상환 200원이 반전으로 공개된다.
    //
    // 2026-08-26 동현 승인: 이 순간 승인된 불이익 셋 중 정확히 하나가 함께 정해진다.
    // 고르는 근거는 이 엔진에 주입된 결정적 난수(rng) 한 굴림뿐이라, 같은 난수·같은
    // 경로면 언제나 같은 불이익이 나온다. 굴림은 규칙 파일이 아니라 여기서 꺼낸다 —
    // 규칙은 순수하게 두고 무작위는 엔진 한 곳에서만 나오게 하는 기존 구조 그대로다.
    //
    // 2026-08-26 독립 검토 대응: 굴림을 미리 뽑아 넘기지 않고 난수 함수 자체를 넘긴다.
    // 예전에는 성립 검사보다 rng()가 먼저 실행돼, 계약서가 열리지도 않은 자리에서
    // 누른 헛서명까지 난수를 한 칸씩 먹었다. 그 어긋남이 뒤이어 실제로 체결될 때
    // 뽑히는 불이익을 바꿔 놓았다. 이제 규칙이 두 겹의 문을 모두 지난 뒤, 실제로
    // 체결이 성립하는 순간에만 이 함수를 정확히 한 번 부른다.
    function signLoanContract() {
      if (!S.started) return false;
      const next = State.signLoan(S.money, S.loan, rng);
      if (!next.ok) return false;
      S.money = next.cash;
      S.loan = next.loan;
      const penaltyLine = State.loanPenaltyLine(S.loan.penalty); // v8: 이자만이라 빈 글
      S.lastEvent = "서명 완료 — 현금 " + State.LOAN_RULES.principal
        + "$ 수령 · 갚을 총액 " + S.loan.balance + "$" // v9 · 10-A: 대출 돈 단위도 $
        + (penaltyLine ? " · " + penaltyLine : "");
      pushEvent("loanSigned", {
        principal: State.LOAN_RULES.principal, balance: S.loan.balance, money: S.money,
        penalty: S.loan.penalty.key,
      });
      pushEvent("loanRevealed", {
        interestRate: State.LOAN_RULES.interestRate,
        totalDue: State.LOAN_RULES.totalDue,
        penalty: S.loan.penalty.key,
        lines: State.loanRevealLines(S.loan.penalty),
      });
      // 2026-08-27 v1 · 대출 A 승인 흐름의 마지막 두 칸 —
      //   … 서명 → 대출금 수령 → **재전화** → 우상단 계약 정보 안내 → 확인.
      // 계약서가 우상단으로 접혀 간 그 자리를 통화가 직접 가리킨다. 안내 전용이라
      // 고를 것이 없고, 경제·불이익은 여기서 한 푼도 더 움직이지 않는다.
      if (!S.phone.open && !S.phone.ringing) ring("loanSigned");
      return true;
    }

    // 상환 — 분할이 없다. 총상환액 200원을 한 번에 갚는다.
    // 완납하는 순간 이 계약이 고른 불이익도 즉시 풀린다 (2026-08-26 동현 승인).
    // 그리고 계약 자체가 닫히므로, 그 뒤 새 위기가 오면 전화가 처음부터 다시 열린다.
    //
    // 2026-08-26 동현 확정: 구매 쪽 공통 교착 방지 계약과 같은 근거를 상환에도 쓴다.
    // 팔거나 진행해 회복할 작품이 하나도 없으면, 갚고 나서 선투자 20원이 남는
    // 220원부터만 갚는다. 회복할 작품이 있으면 기존대로 200원부터다.
    // 이미 서명한 판이라 「받을 대출이 남았는가」는 볼 필요가 없다 — 남아 있지 않다.
    function repayLoan() {
      if (!S.started) return false;
      const next = State.repayLoanFull(S.money, S.loan, { workLeft: sellableWorkLeft() });
      if (!next.ok) {
        if (next.blockedByReserve) {
          pushEvent("repayBlockedByDeadlock", {
            money: S.money,
            balance: State.loanOwed(S.loan), // 계약이 인정하는 잔액 그대로 말한다
            needed: State.repayCashNeeded(S.loan, sellableWorkLeft()),
            reserve: State.DEADLOCK_GUARD.reserve,
          });
          S.lastEvent = State.repayGuardLine();
        }
        return false;
      }
      S.money = next.cash;
      S.loan = next.loan;
      S.lastIncomeCut = null;
      // 2026-08-27 v1 · 대출 A — 서명 뒤 재전화는 「우상단에 접어 둔 계약서」를 가리키는
      // 안내다. 완납하면 그 계약서 자리 자체가 사라지므로, 아직 받지 않은 재전화는
      // 여기서 함께 거둔다. 아니면 없는 자리를 가리키는 전화가 계속 울리고, 그 통화가
      // 다음 위기 대출 전화까지 뒤로 밀어 버린다.
      if (S.phone.ringing === "loanSigned") S.phone.ringing = null;
      S.lastEvent = "대출 " + next.repaid + "$를 한 번에 모두 갚았습니다" // v9 · 10-A
        + (State.loanPenaltyLine(next.loan && next.loan.penalty) ? " — 걸려 있던 불이익이 풀렸습니다" : ""); // v8: 이자만
      pushEvent("loanRepaid", {
        repaid: next.repaid, balance: 0, money: S.money, count: S.loan.repaid,
      });
      return true;
    }

    // ── 게임 시계 예약표 — 일시정지 중에는 발화가 저절로 미뤄진다 ──
    function schedule(delay, callback) {
      timers.push({ at: S.clock + delay, callback: callback });
    }
    function runDueTimers() {
      if (!timers.length) return;
      const due = timers.filter(function (t) { return t.at <= S.clock; });
      timers = timers.filter(function (t) { return t.at > S.clock; });
      due.forEach(function (t) { t.callback(); });
    }

    // 시계를 「정확히 이만큼」 흘린다. 엔진 안에서 「창을 넘기는 데 걸리는 시간만큼」처럼
    // 정해진 양을 흘릴 때 쓴다 — 여기에 배속을 걸면 그 정해진 양까지 함께 부풀어 버린다.
    function advance(ms) {
      if (!S.started || S.paused) return;
      let left = ms;
      while (left > 0) {
        const dt = Math.min(C.TICK_STEP_MS, left);
        left -= dt;
        S.clock += dt;
        runDueTimers();
        tickWindowAuto();
        tickPrintAuto();
      }
      // 자동화는 시계 흐름 한 덩어리가 끝난 뒤 한 번만 판정한다.
      // 안쪽 반복마다 돌리면 한 번의 tick으로 도화지를 여러 장 사 버린다.
      runAutomation();
    }

    // ══ 업그레이드 효과 계산 — 항목끼리 효과를 섞지 않는다 ═════════
    // 유리창 계산은 「고무 밀대」단계만, 인쇄 계산은 「인쇄 스퀴지」단계만 읽는다.
    // 두 함수 묶음이 서로의 단계를 참조하지 않는 것이 이 분리의 핵심이다.
    function glassSpeedLevel() { return S.upgrades.rubberSqueegeeSpeed || 0; }
    function printSpeedLevel() { return S.upgrades.printSqueegeeSpeed || 0; }
    function rowsPerNotchFor(level) { return 1 + C.SPEED_ROWS_PER_LEVEL * level; }
    function maxRowsPerSecFor(level) {
      return C.MAX_ROWS_PER_SEC * (1 + C.SPEED_CAP_PER_LEVEL * level);
    }
    // 2026-08-26 동현 승인 — 대출 불이익 `toolSlowdown` 이 걸린 동안에만 0.9다.
    // 밀대는 유리창용과 인쇄용 둘이지만 「도구 감속」은 손으로 미는 그 도구 자체를
    // 두고 한 말이라 두 밀대에 같은 배율로 걸린다. 업그레이드 단계는 서로 보지
    // 않는다는 기존 분리 규칙은 그대로다 — 여기서 섞이는 것은 대출 불이익뿐이다.
    // 완납하면 loanPenalty()가 null이 되어 배율이 저절로 1로 돌아온다.
    function toolSpeedScale() { return State.toolSpeedScaleFor(loanPenalty()); }
    function windowRowsPerNotch() {
      return rowsPerNotchFor(glassSpeedLevel()) * windowSpeedScale() * toolSpeedScale();
    }
    // 2026-10-20 v9 — 스퀴지 재질 · 속도(그릴미 기둥 2-7): 인쇄 빠르기 = 재질 힘 ÷ 원작 저항(시안 2판 그대로).
    // 나무 1단계로 뮤나리자(저항 1.0)를 밀면 v8 첫 단계와 같은 빠르기(휠 한 칸 1줄 · 초당 12줄)다.
    // 유리창 쪽은 이 값을 전혀 읽지 않는다(두 도구는 서로의 단계를 보지 않는다).
    function squeegeeMaterialIndex() {
      return Math.max(0, Math.min(State.SQUEEGEE_MATERIALS.length - 1, Math.round(Number(S.upgrades.squeegeeMaterial) || 0)));
    }
    function squeegeeSpeedStep() {
      return 1 + Math.max(0, Math.min(State.SQUEEGEE_MAX_SPEED - 1, Math.round(Number(S.upgrades.printSqueegeeSpeed) || 0)));
    }
    function printForce() { return State.squeegeeForce(squeegeeMaterialIndex(), squeegeeSpeedStep()); }
    function printEffBase() { return printForce() / State.originalResist(priceOriginalKey()); }
    function printRowsPerNotch() { return printEffBase() * toolSpeedScale(); }
    function windowMaxRowsPerSec() { return maxRowsPerSecFor(glassSpeedLevel()); }
    function printMaxRowsPerSec() { return C.MAX_ROWS_PER_SEC * printEffBase(); } // v9: 초당 줄 상한도 빠르기만큼
    function windowAutoRowMs() {
      // 디버그 배율이 클수록 한 줄에 걸리는 시간이 짧아진다 (= 밀대가 빨라진다).
      return C.WINDOW_AUTO_ROW_MS
        / (1 + C.SPEED_AUTO_PER_LEVEL * glassSpeedLevel())
        / windowSpeedScale() / toolSpeedScale();
    }
    function printAutoRowMs() {
      return C.PRINT_AUTO_ROW_MS / printEffBase() / toolSpeedScale(); // v9: 80% 뒤 자동 마무리도 빠르기만큼
    }
    // 2026-08-15 A 확정: 대성공·실패가 잠기는 구간은 「첫 도화지 통화 전」이 아니라
    // 「유리창 레벨 0(1~4장)」이다. 레벨 1부터는 통화 전이어도 확정 결과표가 그대로 돈다.
    // 확률·보수는 엔진이 따로 갖지 않고 State.windowResultFor 하나만 본다.
    function windowLevel() { return State.windowLevelFor(S.windowsDone); }

    // ── 디버그가 덮어쓸 수 있는 유리창 값들 (2026-08-19) ──────────
    // 매번 다시 읽으므로 디버그 창에서 바꾼 값이 진행 중인 창문에도 곧바로 든다.
    // 때 레이어 수와 밀대 완주 횟수는 언제나 같은 값이다 — 완주 1회에 한 겹이 지워진다.
    function windowStrokes() {
      const n = Math.round(Number(S.debug.values.windowLayers));
      return n >= 1 ? n : C.WINDOW_STROKES;
    }
    // 2026-08-26 v1 (0825 피드백 계약 2항): 기본 유리창 밀대 속도를 부모판 기본값의
    // 50%로 낮춘다. 디버그 창의 배율은 그 위에 그대로 곱해지므로 「1배 = 새 기본값」이다.
    // 인쇄 스퀴지 쪽은 이 값을 읽지 않는다 — 두 도구는 서로의 값을 보지 않는다.
    function windowSpeedScale() {
      const v = Number(S.debug.values.windowScrollSpeed);
      return (v > 0 ? v : 1) * State.WINDOW_BASE_SPEED_SCALE;
    }
    // 이번 장의 보수 — 레벨 0은 디버그 금액이 덮고, 레벨 1부터는 확정 결과표 그대로다.
    function windowPayFor(result, level) {
      // 레벨 1 보수도 디버그로 바꿔 볼 수 있다 (0이면 규칙값 그대로).
      // 유리창과 그림의 벌이를 나란히 맞추는 실험에 쓴다.
      if (level >= 1 && result.key === "normal") {
        const forced = Math.round(Number(S.debug.values.windowPayLv1));
        if (forced > 0) return forced;
      }
      if (level >= 1 || result.pay <= 0) return result.pay;
      const v = Math.round(Number(S.debug.values.windowPay));
      return v >= 0 ? v : result.pay;
    }
    // ── 검수용 강제 파손 (2026-08-25 계약 5 · 검수 지적 4로 갱신) ──────
    // 예약이 켜져 있으면 이번 한 장만 확정 결과표 대신 파손 결과를 돌려준다.
    // 예약은 여기서 곧바로 꺼진다 — 그래서 그 다음 장부터는 원래 확률이 그대로 돈다.
    //
    // 2026-08-25 검수 지적 4: 예전에는 레벨 0 결과표에 파손 줄이 없다는 이유로
    // 아무 일도 하지 않고 예약도 그대로 남겼다. 그래서 새 게임을 켜고 버튼을 눌러도
    // 화면에서 아무 변화가 없어 회의 자리에서 즉시 시연할 수가 없었다.
    // 이제 레벨 0에서도 같은 뜻의 파손 결과를 만들어 준다 — 확률표 자체는 손대지
    // 않으므로 자연 플레이의 레벨 0은 여전히 100% 성공 25원 그대로다.
    const FORCED_BREAK_ROW = Object.freeze({ key: "fail", chance: 0, pay: 0, label: "유리창 파손" });
    function forcedWindowResult(level) {
      if (!S.debug.breakNextWindow) return null;
      S.debug.breakNextWindow = false;
      const table = State.WINDOW_RULES.tables[Math.max(0, Math.min(
        State.WINDOW_RULES.tables.length - 1, Number(level) || 0))];
      return table.find(function (r) { return r.key === "fail"; }) || FORCED_BREAK_ROW;
    }

    // 지금 놓인 작품들에 더해 한 장을 더 끝까지 찍을 잉크가 있는가.
    // 「완성 필요량 × (지금 장수 + 1)」을 통 용량이 감당하는지만 본다.
    function inkEnoughForAnotherSheet() {
      return inkCapacity() >= requiredCells() * (S.works.length + 1);
    }
    // 한 장을 더 놓기까지 몇 % 모자란지 — 플레이어에게 보여 줄 안내용 숫자다.
    function paperInkShortPercent() {
      const need = requiredCells() * (S.works.length + 1);
      const short = Math.max(0, need - inkCapacity());
      return State.inkPercent(short, requiredCells());
    }
    // 도화지 구매가 막혀 있으면 왜 막혔는지 화면에 알린다.
    // 지금은 잉크 부족 한 가지뿐이지만, 이유를 이름으로 구분해 두면 나중에
    // 다른 문(빈 칸 없음·선형 해금 등)을 같은 자리에 붙일 수 있다.
    function paperBlockState() {
      const blocked = S.unlocked.paper && S.works.length > 0 && !S.resultsOpen
        && hasEmptySlot() && !inkEnoughForAnotherSheet();
      return {
        blocked: blocked,
        reason: blocked ? "ink" : null,
        shortagePercent: blocked ? paperInkShortPercent() : 0,
        hint: blocked
          ? "상점에서 잉크통을 키우면 도화지를 한 장 더 놓을 수 있습니다"
          : "",
      };
    }
    function inkCapacity() {
      // 디버그로 최초 물감량을 %로 못박아 두면 그 값을 쓴다 (0이면 규칙값 그대로).
      // 「몇 %에서 미완성이 되는가」를 화면에서 바로 바꿔 볼 수 있게 하는 손잡이다.
      const forcedPct = Math.round(Number(S.debug.values.firstInkPercent));
      if (forcedPct > 0) {
        // 「50%」로 눌러 두면 언제나 지금 원작 한 장 필요량의 50%다(v9: 원작마다 미는 횟수가 달라 그 원작 기준).
        // 2026-08-19 정정: 여기에 잉크통 구매분을 더하고 있어서, 통을 한 번 사면
        // 50%가 실제로는 83%가 되는 등 손잡이의 숫자가 화면과 어긋났다.
        // 이 손잡이는 「몇 %에서 미완성이 되는가」를 보는 도구이므로 곧이곧대로 쓴다.
        return Math.round(requiredCellsNow() * forcedPct / 100) + (S.review.inkBonus || 0);
      }
      // 2026-08-19: 단계마다 증가량이 달라서 곱셈이 아니라 State의 단계별 계산을 쓴다.
      // (0단계 24칸 → 1단계 48칸 → 2단계 96칸 = 도화지 두 장분)
      // 검수 전용 여유분은 실제 상점 단계와 분리해 따로 더한다.
      return State.inkCapacityForLevel(S.upgrades.inkTank) + (S.review.inkBonus || 0);
    }
    function paperSize() { return State.paperSizeByKey(S.paperSizeKey); }
    function requiredCells() { return State.paperCells(paperSize()); }
    // 버튼 한 번의 결제액 — 칸 수와 무관하게 언제나 한 장 값이다 (라운드 005).
    // 「1장/2장 일괄 구매」는 이번 범위 밖이라 여기서 곱하지 않는다.
    // 2026-10-12 v5(형님 26-A): 한 번의 결제액 = 지금 고른 원작의 재료비(5 × 급 배율).
    // 원작을 아직 고르지 않은 첫 도화지는 뮤나리자 값이다.
    function paperClickCost() { return State.materialCostFor(S.currentOriginalKey || "mewna-lisa"); }

    // ══ 검수 전용 제작 전환 ═══════════════════════════════════════════
    // 지금 화면에 서 있어야 할 작업대 대수. 검수 전환을 쓰지 않은 자연 플레이에서는
    // 「실제로 산 칸 수」 그대로다 — 검수 도구가 유료 구매 경로를 대신하지 않는다.
    function benchSlots() {
      return S.review.used ? S.review.workbenchCount : S.workbench.slots;
    }
    // 이번 묶음에서 아직 비어 있는 칸이 남았는가.
    function hasEmptySlot() { return S.works.length < benchSlots(); }

    // 지금 돌고 있는 제작 방식 (2026-08-14 C 확정 2.1·5.3).
    //   "sequential"   — 새 게임의 기본. 대상 작품 하나만 밀고 완료하면 다음 번호로 옮긴다.
    //   "simultaneous" — 동시 제작 해금 뒤 골랐을 때. 미완성 작품 전부를 한 번에 민다.
    // 검수 도구를 한 번도 쓰지 않은 판도 같은 값 하나만 본다 — 방식이 갈리는 기준은
    // 「검수 전환을 썼는가」가 아니라 「어떤 방식을 고른 상태인가」다.
    function productionMode() {
      return S.review.productionMode;
    }
    function isSequentialReview() { return productionMode() === "sequential"; }
    function isSimultaneous() { return productionMode() === "simultaneous"; }
    // 아직 마감되지 않은 작품 번호들 (빈 자리와 완성작은 빠진다).
    function unfinishedSlots() {
      const out = [];
      S.works.forEach(function (w, i) { if (!w.done) out.push(i); });
      return out;
    }
    // ── 작업대별 독립 입력 (2026-08-26 v1 · 계약 5항) ────────────────────
    // 「순차·동시 전체 입력」은 자연 플레이의 방식이 아니다. 입력은 포인터가 올라간
    // 작업대 한 대에만 들어가고, 그 작업대의 작품만 진행하며 그 한 장분의 잉크만 쓴다.
    // 지금 입력을 받는 작업대 번호. 손으로 고른 곳이 아직 미완성이면 그곳이고,
    // 아니면 아직 마감되지 않은 첫 작업대다 (호버를 한 번도 하지 않은 경우의 기본값).
    function benchFocusSlot() {
      const left = unfinishedSlots();
      if (!left.length) return S.works.length ? S.works.length - 1 : 0;
      if (left.indexOf(S.benchFocus) >= 0) return S.benchFocus;
      return left[0];
    }

    // 포인터가 다른 작업대로 올라갔다 — 입력 대상을 그 대로 옮긴다.
    // 지금 작업대의 인쇄 상태는 그 작품에 그대로 보관되고, 새 작업대는 자기 상태를
    // 꺼내 온다. 그래서 오가며 밀어도 각자의 진행도·등급·잉크가 섞이지 않는다.
    function focusBench(slot) {
      const n = Math.round(Number(slot));
      if (!Number.isInteger(n) || n < 0 || n >= benchSlots()) return false;
      const w = S.works[n];
      if (!w || w.done) return false;
      const cur = benchFocusSlot();
      if (cur === n) { S.benchFocus = n; return true; }
      if (S.works[cur] && S.print) S.works[cur].printState = S.print;
      S.benchFocus = n;
      if (w.printState) {
        S.print = w.printState;
      } else {
        startArtwork(w.roundPlan);
        w.printState = S.print;
      }
      pushEvent("benchFocus", { slot: n });
      return true;
    }

    // ── 포인터·키가 「이 한 대」를 콕 집은 입력 (2026-08-26 동현 확정) ──
    // printWheelAt/printKeyAt이 민 인쇄 상태에는 주인 작업대 번호(soloBench)가 박힌다.
    // 그 표식이 박힌 인쇄 상태는 검수용 동시 제작을 골라 둔 판에서도 자기 작업대
    // 하나만 진행하고 그 한 장분 잉크만 쓴다. 표식을 호출 한 번이 아니라 인쇄 상태에
    // 두는 것이 핵심이다 — 80% 뒤 자동 마감은 시계 위에서 나중에 도는데, 그때도
    // 남의 작업대를 함께 밀어서는 안 되기 때문이다.
    // 「전체 입력」은 검수 도구(performPrintStroke·printWheel·printKey)의 몫으로 남는다.
    function soloBenchSlot() {
      const P = S.print;
      const n = P ? P.soloBench : -1;
      return Number.isInteger(n) && n >= 0 ? n : -1;
    }
    function runOnBench(slot, action) {
      if (!focusBench(slot)) return false; // 실패하면 여기서 끝난다 — 전체 입력으로 떨어지지 않는다
      // focusBench가 이 작업대의 인쇄 상태를 꺼내 온 「뒤에」 표식을 박는다.
      if (S.print) S.print.soloBench = benchFocusSlot();
      return action();
    }

    // 지금 입력 하나가 실제로 진행시키는 작품 번호들.
    //   포인터/키 대상 — 표식이 박힌 그 한 대 (동시 제작을 켜 둬도 마찬가지다)
    //   독립(기본)     — 지금 대상 작업대 하나
    //   동시(검수)     — 진행 중인 미완성 작품 전부 (빈 자리와 완성작은 빠진다)
    function progressSlots() {
      const left = unfinishedSlots();
      if (!left.length) return [];
      const solo = soloBenchSlot();
      if (solo >= 0) return left.indexOf(solo) >= 0 ? [solo] : [];
      return isSimultaneous() ? left : [benchFocusSlot()];
    }
    // 다음 입력 비용을 셈할 때의 진행 작품 수.
    // 동시 제작만 I × 작품 수이고, 독립 입력은 언제나 한 장분 I 하나다.
    function activeSlots() {
      const left = unfinishedSlots();
      if (!left.length) return [];
      const solo = soloBenchSlot();
      if (solo >= 0) return left.indexOf(solo) >= 0 ? [solo] : [];
      return isSimultaneous() ? left : [benchFocusSlot()];
    }
    // 화면·검수가 가리키는 「지금 대상 작업대」.
    // 이번 묶음이 전부 마감된 뒤(결과판)에는 마지막으로 민 작품을 그대로 가리킨다 —
    // 그래야 그 작품의 마감 연출이 1번 자리로 튀지 않고 제자리에서 끝난다.
    function activeWorkSlot() {
      return benchFocusSlot();
    }
    // 제작이 이미 시작된 묶음인가 — 첫 입력 이후에는 방식·작업대 수를 흔들지 않는다.
    function batchStarted() {
      if (!S.works.length) return false;
      if (S.works.some(function (w) { return w.stroke > 0 || w.done || w.outcome; })) return true;
      const P = S.print;
      return !!(P && (P.stroke > 0 || P.paintedTo > 0 || P.phase !== "ready"));
    }
    // 제작 중 방식 변경 허용 여부는 「미정」이다. 이 시안의 검수 도구에서는 첫 입력 전에는
    // 준비 상태로 보아 전환을 허용하고, 첫 입력 이후 묶음이 끝날 때까지 거절한다.
    // 이것을 제품 최종 규칙이라고 선언하지 않는다.
    function modeSwitchLocked() { return batchStarted(); }

    function setReviewWorkbenchCount(count) {
      const n = Number(count);
      if (!Number.isInteger(n) || n < 1 || n > 4) return false;
      if (modeSwitchLocked()) return false;
      S.review.used = true;
      S.review.workbenchCount = n;
      pushEvent("reviewProduction", { workbenchCount: n });
      return true;
    }

    function setReviewSimultaneousUnlock(on) {
      if (modeSwitchLocked()) return false;
      S.review.used = true;
      S.review.simultaneousUnlocked = !!on;
      // 해금을 다시 잠그면 순차 제작으로 돌아간다 — 순차를 삭제하거나 교체하지 않는다.
      if (!S.review.simultaneousUnlocked) S.review.productionMode = "sequential";
      pushEvent("reviewProduction", { simultaneousUnlocked: S.review.simultaneousUnlocked });
      return true;
    }

    function setReviewProductionMode(mode) {
      if (mode !== "sequential" && mode !== "simultaneous") return false;
      if (modeSwitchLocked()) return false;
      if (mode === "simultaneous" && !S.review.simultaneousUnlocked) return false;
      S.review.used = true;
      S.review.productionMode = mode;
      pushEvent("reviewProduction", { productionMode: mode });
      return true;
    }

    // ══ 잉크 — 작품 수와 제작 방식이 정하는 다음 입력 비용 ═══════════════
    // I(작품 하나가 한 번의 입력에서 쓰는 잉크)는 부모판의 내부 시험값을 그대로 쓴다.
    // 「작품당 최종 잉크 소비량·최대 용량·업그레이드 수치」는 미정이라 새로 만들지 않는다.
    // 2026-10-08 두 방 데모 4단계(형님 15-A): 원작마다 한 장에 드는 잉크 배수가 다르다(진주 고양이 ×2).
    // 지금 찍는(또는 찍을) 원작의 배수를 쓴다 — 원작을 고르기 전이면 지금 고른 원작, 그것도 없으면 뮤나리자.
    // 2026-10-20 v9 — 지금 찍는(또는 찍을) 원작을 직접 미는 횟수. 찍는 그림이 있으면 그 그림의 값.
    function manualNow() {
      if (S.print && Number.isInteger(S.print.manual)) return S.print.manual;
      return State.manualStrokesFor(S.currentOriginalKey || "mewna-lisa");
    }
    function inkMultNow() {
      const key = (S.print && S.print.originalKey) || S.currentOriginalKey || "mewna-lisa";
      return State.originalInkMult(key);
    }
    // 이 원작 한 장을 끝까지 찍는 데 드는 잉크(칸). 뮤나리자는 48칸, 진주 고양이는 96칸.
    // 도화지 구매 문(inkEnoughForAnotherSheet)은 원작을 고르기 전에 돌기 때문에 원래 값(requiredCells)을 그대로 쓴다.
    // 2026-10-20 v9 — 한 번에 한 색: 한 장 잉크 = 그 원작을 직접 미는 횟수 × 16칸(원작 배수 없음 · 기둥 설계표 2절).
    function requiredCellsNow() {
      return State.requiredCellsFor((S.print && S.print.originalKey) || S.currentOriginalKey || "mewna-lisa");
    }
    function inkPerWork() { return C.ART * inkMultNow(); } // inkMult는 v9에서 모두 1 — 한 번 밀 때 16칸
    function inkNextCost() { return inkPerWork() * activeSlots().length; }
    function inkInputsLeft() {
      const cost = inkNextCost();
      return cost > 0 ? Math.floor(S.ink.cells / cost) : 0;
    }
    // 한 줄을 지날 때 실제로 빠지는 잉크 — 동시 제작은 진행 작품 수만큼 함께 빠진다.
    function inkPerRow() {
      return (isSimultaneous() ? Math.max(1, activeSlots().length) : 1) * inkMultNow();
    }
    function inkShortagePercent() {
      const cost = inkNextCost();
      if (cost <= 0 || S.ink.cells >= cost) return 0;
      return Math.max(1, Math.round(((cost - S.ink.cells) / cost) * 100));
    }
    // ── 승인된 예외 한 가지: A 확정 첫 학습 작품 ──────────────────────
    // 맨 처음 산 도화지 한 장만 기본 잉크통(완성 필요량의 50%)으로 시작해 인쇄 3회 중
    // 1.5회에서 「도중에」 바닥나고, 그 미완성을 플레이어가 70원에 직접 판다 (A 계약 2.2).
    // 이 한 장에서만 부분 소진을 허용한다 — 조건을 제작 방식·작업대 수·「검수 전환을
    // 쓰지 않은 판 전체」로 넓히지 않는다. 첫 판매가 끝나면 곧바로 확정 차단이 돈다.
    //
    // 첫 판매 전에는 도화지가 한 장뿐이므로(buyPaper가 두 번째 장을 막는다) 그 한 장을
    // 가리는 데 작품별 표식이 따로 필요하지 않다.
    function firstLearningWork() {
      if (S.firstSaleDone) return false;
      return activeSlots().length === 1;
    }
    // 2026-10-08 두 방 데모 4단계(형님 15-A): 잉크가 두 배 드는 원작(진주 고양이)도 첫 학습 작품처럼
    // 남은 잉크로 도중까지 밀 수 있다 — 모자란 줄은 마른 자국이 되고 그 장은 미완성(정액)이 된다.
    // 막아 버리면 잉크통 1단계로 진주 고양이를 고른 판이 그림 한가운데서 영영 멈추기 때문이다.
    // 비유: 물감이 모자라면 붓을 뺏는 대신, 그린 데까지만 칠해진 그림으로 남긴다.
    // 2026-10-20 v9: 「잉크가 두 배 드는 원작」 대신 「잉크통이 이 원작 한 장 필요량보다 작을 때」 — 같은 뜻이다
    // (예: 잉크통 1단계 48칸으로 네 번 미는 진주 고양이 64칸을 고르면 세 번째까지 찍고 네 번째는 마른 자국 · 미완성).
    // 통 크기는 상점에서 산 단계 그대로 본다 — 디버그 「최초 물감량」 손잡이로 줄인 통은 v8처럼 입력 전 차단으로 남긴다.
    function partialInkAllowed() {
      const naturalCap = State.inkCapacityForLevel(S.upgrades.inkTank) + (S.review.inkBonus || 0);
      return firstLearningWork() || naturalCap < requiredCellsNow();
    }
    // idle(제작할 작품 없음) / normal(3회 이상) / warn(2회 이하) / blocked(다음 비용 부족)
    function inkStateKey() {
      if (S.print && S.print.inkOut) return "blocked"; // 이미 바닥나 멈춘 그림
      if (!activeSlots().length) return "idle";
      const left = inkInputsLeft();
      if (left <= 0) {
        // 첫 학습 작품만 남은 잉크로 도중까지 밀 수 있다 —
        // 그 한 장에서는 차단이 아니라 주의로 알린다.
        return partialInkAllowed() && S.ink.cells > 0 ? "warn" : "blocked";
      }
      return left <= 2 ? "warn" : "normal";
    }
    // 입력 전 전체 차단 — 작품 진행도 잉크 차감도 0으로 둔다 (C 계약 7절, B 계약 6.3).
    // 순차든 동시든, 검수 도구를 쓰든 쓰지 않든 똑같이 돈다. 위 첫 학습 작품 한 장만
    // 예외로 빠진다.
    function inkBlocked() {
      return !partialInkAllowed() && inkStateKey() === "blocked";
    }
    function inkStatus() {
      const cost = inkNextCost();
      return {
        cells: S.ink.cells,
        capacity: S.ink.capacity,
        need: requiredCellsNow(),
        percent: inkPercentNow(),
        needPercent: 100,
        out: !!(S.print && S.print.inkOut),
        perWork: inkPerWork(),
        activeWorks: activeSlots().length,
        nextCost: cost,
        nextCostPercent: State.inkPercent(cost, requiredCellsNow()),
        inputsLeft: inkInputsLeft(),
        state: inkStateKey(),
        shortagePercent: inkShortagePercent(),
        // 2026-08-18 저녁 동현 지시 · 옛 판(mewna-paid-second-workbench-v1)과 같은 룰:
        // 도화지를 사기 전에는 잉크통이 화면에 아예 없다. 소등한 대기 상태로 서
        // 있지도 않는다 — 잉크 정보가 필요할 때만 등장한다.
        // 위 가로 잉크 표시(#inkPanel)가 이미 쓰던 조건과 같은 문을 카트리지에도 건다.
        cartridgeVisible: !!(S.hasPaper || S.works.length > 0),
      };
    }

    // 플레이어에게 보여 줄 잉크량 — 칸이 아니라 「완성 필요량의 몇 %」다.
    // 도화지가 올라와 있으면 지금 통에 남은 양, 아니면 이 잉크통이 채워 줄 양을 말한다.
    function inkPercentNow() {
      const have = S.hasPaper ? S.ink.cells : S.ink.capacity;
      return State.inkPercent(have, requiredCellsNow());
    }

    // ══ 무료 갤러리 칸 · 검수 전용 돈 ══════════════════════════════
    // 갤러리 해금 조건은 상점의 「판매 횟수(sales)」 해금·데모 범위 완료와 별개다.
    // 저쪽은 판매 횟수만 세지만, 이 문은 「판매 누적 2점 이상 + 이번 판매 정상 완성」일 때 열린다.
    // 잉크가 바닥나 미완성 정액으로 넘긴 판매는 몇 번을 쌓아도 이 문을 열지 못한다.
    // (라운드 005의 무료 두 칸 작업대는 라운드 001에서 폐기됐다 — 칸 수는 건드리지 않는다.)
    function galleryUnlockReached(incomplete) {
      if (incomplete) return false;
      return S.artworksSold >= 2;
    }

    // 조건을 채운 정상 완성 판매 직후 — 돈을 한 푼도 내지 않고 무료 갤러리 칸이 열린다.
    // 작업대는 그대로 한 칸이다.
    function unlockGallery() {
      if (S.gallery.unlocked) return;
      S.unlocked.gallery = true;
      S.gallery.unlocked = true;
      pushEvent("galleryUnlocked", { capacity: EXP.gallerySlots });
      S.lastEvent = "정상 작품 판매로 조건을 채웠습니다 — 무료 갤러리 칸이 열렸습니다";
    }

    // ══ 두 번째 작업대 유료 상품 (2026-08-12 계약 7~11·17) ═══════════
    // 해금 조건은 「첫 정상 완성품 판매가 끝나는 순간」 하나뿐이다.
    // 잉크가 바닥나 70원 정액으로 넘긴 첫 미완성 판매는 몇 번을 쌓아도 열지 못한다.
    function secondBenchOffer() { return EXP.secondWorkbench; }

    function unlockSecondBench() {
      // 2026-10-06 두 방 데모 B-1: 작업대 확장 제외 — 상품을 상점에 내놓지 않는다.
      if (!EXP.secondWorkbenchOffered) return;
      if (S.secondBench.unlocked) return;
      S.secondBench.unlocked = true;
      // 상점 탭 금빛 NEW와 새 카드의 금빛 테두리를 「함께」 켠다 (계약 9).
      S.shopTabNew = true;
      S.secondBench.seen = false;
      pushEvent("workbenchOfferUnlocked", {
        key: secondBenchOffer().key, label: secondBenchOffer().label, cost: secondBenchOffer().cost,
      });
      S.lastEvent = "상점에 「" + secondBenchOffer().label + "」 상품이 열렸습니다 — "
        + secondBenchOffer().cost + "$";
    }

    // 상점에서 카드를 확인했다 — 탭 NEW와 카드 테두리를 함께 끈다 (계약 10).
    // 돈·칸 수·판매 수는 건드리지 않는다. 구매 전이어도 다시 켜지지 않는다.
    function confirmWorkbenchCard() {
      if (!S.secondBench.unlocked || S.secondBench.seen) return false;
      S.secondBench.seen = true;
      S.shopTabNew = false;
      // 2026-08-26 v1: 상점을 여는 그 한 번의 행동이 화면에 뜬 카드를 모두 확인한다.
      // 작업대 카드만 끄고 다른 카드의 NEW를 남겨 두면 화면과 상태가 어긋난다.
      confirmShopCard();
      pushEvent("workbenchOfferSeen", { key: secondBenchOffer().key });
      return true;
    }

    // 60원을 실제로 내고 두 번째 작업대를 세운다. 두 칸에서 멈춘다 (계약 17).
    function buySecondWorkbench() {
      if (!EXP.secondWorkbenchOffered) return false; // 2026-10-06 B-1: 작업대 확장 제외
      if (!canInteract()) return false;
      if (!S.secondBench.unlocked || S.secondBench.purchased) return false;
      if (S.workbench.slots >= EXP.maxSlots) return false; // 3·4번째 칸은 범위 밖
      const cost = secondBenchOffer().cost;
      if (S.money < cost) {
        blockedByNoMoney("buySecondWorkbench");
        return false;
      }
      // 공통 교착 방지 계약 — 사고 나면 다음 유리창 한 장도 시작할 수 없고, 대출도
      // 팔 작품도 남아 있지 않으면 그 구매가 곧 막다른 길이다 (2026-08-26 동현 확정).
      if (blockDeadlockPurchase(secondBenchOffer().label, cost, false)) return false;
      S.money -= cost;
      S.secondBench.purchased = true;
      S.secondBench.seen = true;
      S.shopTabNew = false;
      S.workbench.slots = EXP.maxSlots;
      S.workbench.expanded = true; // 무료가 아니라 「샀다」는 표시다
      pushEvent("workbenchBought", { cost: cost, slots: S.workbench.slots });
      S.lastEvent = secondBenchOffer().label + " 구매 −" + cost
        + "$ — 같은 규격 작업대 두 대가 가로로 섰습니다";
      return true;
    }

    // 2026-10-06 두 방 데모 A — 그림 한 장 = 세 회차 독립 추첨, 최고 기록만 확보.
    // 작품은 도화지를 살 때 세 회차의 추첨 계획(roundPlan)을 미리 들고, gradeIndex는 그 계획을
    // 끝까지 돌았을 때의 최고 등급(=최종 등급)이다. 판매가·자동 판매·갤러리는 8/27처럼 이 값을 쓴다.
    // 회차가 끝나기 전에는 어떤 화면도 계획이나 최종 등급을 읽지 않는다(클로드판 계약).
    function normalizePlan(plan) {
      if (Array.isArray(plan) && plan.length) {
        return plan.map(function (g) {
          const n = Math.round(Number(g));
          return Number.isInteger(n) && n >= 0 && n < ECON.grades.length ? n : 0;
        });
      }
      // 옛 호출(등급 숫자 하나)은 그 등급을 모든 회차 내내 뽑은 것으로 본다 — 검수 도구 전용 경로다.
      // v9: 회차 수 = 지금 원작을 직접 미는 횟수(뮤나리자 3 · 키스 5).
      const g = Math.round(Number(plan));
      const fixed = Number.isInteger(g) && g >= 0 && g < ECON.grades.length ? g : 0;
      const rounds = manualNow();
      return new Array(rounds).fill(fixed).slice(0, fixed === ECON.grades.length - 1 ? 1 : rounds);
    }
    function planFinalGrade(plan) {
      return plan.reduce(function (top, g) { return Math.max(top, g); }, 0);
    }

    function makeWork(slot, plan) {
      const roundPlan = normalizePlan(plan);
      return {
        slot: slot,
        originalKey: S.currentOriginalKey,
        materialCost: paperClickCost(), // v5: 이 장에 실제로 낸 재료비(원작을 바꾸면 차액 정산과 함께 갱신)
        gradeIndex: planFinalGrade(roundPlan),
        roundPlan: roundPlan,
        stroke: 0,
        price: 0,
        incomplete: false,
        done: false,
        outcome: null, // null | "sold" | "gallery"
      };
    }

    // 동시 제작에서는 한 묶음이 같은 입력으로 함께 마감되므로 연출도 하나다.
    // 그 연출 기준은 올라간 작품 중 가장 높은 등급으로 잡아, 좋은 결과가 묻히지 않게 한다.
    function topGradeIndex() {
      return S.works.reduce(function (top, w) { return Math.max(top, w.gradeIndex); }, 0);
    }

    // 지금 밀고 있는 인쇄가 어느 등급 연출을 따라야 하는가.
    // 기본인 순차 제작은 「지금 대상 작품」의 등급이고(작품별 독립 연출),
    // 동시 제작에서는 함께 마감되는 작품 중 가장 높은 등급이다.
    function batchGradeIndex() {
      if (isSequentialReview()) {
        const w = S.works[activeWorkSlot()];
        return w ? w.gradeIndex : 0;
      }
      return topGradeIndex();
    }

    // 지금 인쇄가 따라갈 회차 계획 — 순차 제작은 지금 대상 작품의 계획, 동시 제작(검수 도구)은
    // 가장 높은 등급 작품의 계획이다(8/27 batchGradeIndex와 같은 기준).
    function batchPlan() {
      if (isSequentialReview()) {
        const w = S.works[activeWorkSlot()];
        return w ? w.roundPlan : new Array(manualNow()).fill(0);
      }
      const top = topGradeIndex();
      const w = S.works.find(function (x) { return x.gradeIndex === top; });
      return w ? w.roundPlan : new Array(manualNow()).fill(0);
    }

    // 지금 작업대에 놓인 도화지들에 맞춰 인쇄 상태를 세운다.
    // (도화지를 더 놓은 직후처럼 아직 아무것도 밀지 않은 순간에만 부른다.)
    function ensurePrint() {
      startArtwork(batchPlan());
      // 독립 입력에서는 인쇄 상태가 「그 작업대의 것」이다 — 지금 대상 작품에 매달아 둔다.
      const w = S.works[benchFocusSlot()];
      if (w) w.printState = S.print;
    }

    // 한 번의 입력이 실제로 민 작품들의 진행 칸을 맞춘다.
    // 기본인 순차 제작은 대상 작품 하나만, 동시 제작은 미완성 작품 전부를 같이 민다.
    function syncWorkStrokes() {
      const P = S.print;
      if (!P) return;
      progressSlots().forEach(function (i) { S.works[i].stroke = P.stroke; });
    }

    // 자동 판매는 「정상 완성품」이면서 「첫 판매를 이미 겪었고, 아직 갤러리가 열리기 전」인
    // 한 구간뿐이다 — 예전(라운드 003) 흐름 그대로다.
    // 갤러리가 열린 뒤에는 판매·전시를 결과판에서 고른다.
    function autoSellMode() { return S.firstSaleDone && !S.gallery.unlocked; }

    // 미완성 묶음은 자동 판매 구간 판정과 무관하게 언제나 결과판에 남는다 (계약 3·4).
    // 첫 장만의 예외가 아니다 — 잉크통을 사지 않고 도화지를 계속 사서 매번 잉크가
    // 바닥나도 70원 판매는 그때마다 플레이어가 직접 눌러야 한다.
    function batchIncomplete() {
      return S.works.some(function (w) { return w.incomplete; });
    }

    // 작품 한 점의 등급값·가격을 굳힌다.
    function finalizeWork(w) {
      w.done = true;
      w.price = w.incomplete
        ? State.incompletePriceFor(w.originalKey) // v5: 그 원작 재료비의 70%
        : originalPrice(w.gradeIndex, w.originalKey);
    }

    // 이번 묶음의 등급값·가격을 굳힌다 (결과판을 열든 자동 판매하든 같은 값이다).
    // 순차 제작에서 이미 마감된 작품은 자기 진행 칸과 가격을 그대로 지킨다.
    // 마감 대상도 인쇄 칸도 「이번 입력이 실제로 민 작품」뿐이다 — 순차 제작에서 아직
    // 손도 대지 않은 다음 작업대의 도화지가 남의 진행 칸을 받아 적거나, 남의 잉크 소진
    // 때문에 done·가격까지 굳어 결과판에서 팔려 나가면 안 된다.
    // (정상 완성 마감에서는 이번 입력이 민 작품이 곧 아직 마감되지 않은 작품 전부이므로
    //  순차·동시 어느 쪽도 동작이 달라지지 않는다.)
    function finalizeWorks() {
      const P = S.print;
      const moved = progressSlots();
      moved.forEach(function (i) {
        const w = S.works[i];
        if (!w || w.done) return;
        if (P) w.stroke = P.stroke;
        finalizeWork(w);
      });
    }

    // 순차 제작 — 지금 대상 작품 하나를 마감하고 다음 번호로 옮겨 간다.
    // 옮길 작품이 남아 있으면 true를 돌려주고, 마지막 작품이면 false를 돌려 기존
    // 마감 경로(자동 판매·결과판)로 넘긴다. 다음 작품의 등급 난수·결과·연출은 독립이다.
    function advanceSequential() {
      if (!isSequentialReview()) return false;
      const P = S.print;
      const w = S.works[activeWorkSlot()];
      if (!w || w.done) return false;
      if (P) w.stroke = P.stroke;
      finalizeWork(w);
      w.printState = null; // 마감된 작업대는 자기 인쇄 상태를 더 들고 있지 않는다
      const next = S.works.findIndex(function (x) { return !x.done; });
      if (next < 0) return false;
      S.seqSlot = next;
      S.benchFocus = next;
      pushEvent("sequentialAdvance", { slot: next });
      S.lastEvent = (next + 1) + "번 작업대로 옮겨 갑니다 — 그 작업대 위에서 휠을 굴리세요";
      if (S.works[next].printState) {
        S.print = S.works[next].printState; // 아까 밀다 만 진행도를 그대로 되찾는다
      } else {
        startArtwork(S.works[next].roundPlan);
        S.works[next].printState = S.print;
      }
      return true;
    }

    // 이번 묶음을 정리하고 작업대를 비운다 — 결과판 완료와 자동 판매가 함께 쓴다.
    function clearBatch() {
      S.works = [];
      S.seqSlot = 0; // 다음 묶음은 다시 1번 작업대부터 시작한다
      S.benchFocus = 0; // 독립 입력의 대상도 1번 작업대로 돌아간다
      S.hasPaper = false;
      S.awaitingOriginal = false;
      S.print = null;
      S.mode = "idle";
      S.ink.cells = 0; // 남은 잉크는 그림과 함께 정리된다 (기존 시험 규칙 그대로)
      // 제작 중 예약해 둔 다음 원작이 있으면 지금 갈아끼운다 (등급 재추첨 없음)
      if (S.nextOriginalKey) {
        S.currentOriginalKey = S.nextOriginalKey;
        S.nextOriginalKey = null;
      }
    }

    // 자동 판매 — 돈·경험치·판매 수·피드백·이벤트를 모두 남기고,
    // 판매 누적 2점 이상인 상태에서 현재 정상 완성 작품을 팔면 무료 갤러리 칸까지 이어진다.
    function autoSellBatch() {
      if (!S.works.length) return;
      // 미완성 묶음은 어느 경로로 들어와도 자동 판매하지 않는다 — 결과판으로 넘긴다.
      if (batchIncomplete()) {
        openResults();
        return;
      }
      finalizeWorks();
      S.works.forEach(function (w) {
        if (w.outcome) return;
        w.outcome = "sold";
        // 2026-10-20 v9: 손으로 팔 때(sellWork)처럼 파는 순간의 원작 레벨로 값을 다시 잰다 — 발표 뒤 레벨이 올라도 화면 값과 판 돈이 같게.
        if (!w.incomplete) w.price = originalPrice(w.gradeIndex, w.originalKey);
        gainIncome(w.price, "sale"); // 판 돈도 빚부터 갚는다 (공통 수입 함수)
        S.artworksSold += 1;
        S.lastSalePrice = w.price;
        pushEvent("sold", {
          grade: ECON.grades[w.gradeIndex].key, price: w.price, incomplete: w.incomplete,
        });
        registerSale(w, true);
      });
      S.resultsOpen = false;
      clearBatch();
      refreshShop();
    }

    // 산 도화지를 다 찍었다 — 자동 판매하지 않고 결과판이 선택을 기다린다.
    // 라운드 001의 첫 미완성 작품도 이 판을 쓴다. 이때는 작품이 작업대에 그대로
    // 남은 채 「미완성 복제품 70원에 판매」를 기다리는 상태다.
    function openResults() {
      if (!S.works.length) return;
      finalizeWorks();
      S.resultsOpen = true;
      const incomplete = batchIncomplete();
      pushEvent("resultsOpen", {
        grades: S.works.map(function (w) { return ECON.grades[w.gradeIndex].key; }),
        incomplete: incomplete,
      });
      const unfinished = S.works.find(function (w) { return w.incomplete; });
      S.lastEvent = incomplete
        ? "미완성 작품이 작업대에 남았습니다 — 「미완성 복제품 "
          + (unfinished ? unfinished.price : 0) + "$에 판매」를 직접 누르세요"
        : S.works.length > 1
          ? "두 작품이 완성됐습니다 — 각각 복제품 판매나 갤러리 전시를 고르세요"
          : "작품이 완성됐습니다 — 복제품 판매나 갤러리 전시를 고르세요";
    }

    function pendingWork(slot) {
      const w = S.works[slot];
      if (!w || !w.done || w.outcome) return null;
      return w;
    }

    // 잉크통 전화 예약 — 판마다 딱 한 번만 건다. 라운드 001에서는 첫 판매가 아니라
    // 「손실 결과 확인」이 이 예약을 건다.
    function scheduleInkCall() {
      if (S.inkCallScheduled || S.phone.done.ink) return;
      S.inkCallScheduled = true;
      schedule(C.INK_RING_DELAY_MS, function () {
        if (!S.phone.done.ink && !S.phone.open && !S.phone.ringing) ring("ink");
      });
    }

    // 판매 한 건이 이야기 진행에 남기는 흔적 — 첫 판매 손실 결과, 잉크통 전화 예약,
    // 데모 범위 완료 표시, 판매 누적 2점 이상인 상태에서 현재 정상 완성 판매 시 갤러리 해금.
    // (돈·경험치·작품 상태는 부르는 쪽에서 이미 처리한 뒤다.)
    function registerSale(w, auto) {
      const cost = w.materialCost || State.materialCostFor(w.originalKey); // v5: 이 장의 재료비
      const price = w.price;
      const name = w.incomplete ? "미완성 작품" : ECON.grades[w.gradeIndex].label;
      const verb = auto ? " 자동 판매 +" : " 판매 +";
      if (!S.firstSaleDone) {
        S.firstSaleDone = true;
        const diff = cost - price;
        // 첫 판매 피드백 — 계산 없이 손익을 읽게 한다 (미완성은 도화지값보다 싸다)
        S.saleFeedback = name + verb + price + "$ — 참가비 " + cost
          + "$보다 " + Math.abs(diff) + "$ " + (diff > 0 ? "부족" : "이득");
        if (diff > 0) {
          // 라운드 001: 손실을 숫자 세 줄로 보여 주고 「확인」을 기다린다.
          // 확인 전에는 잉크통 전화 예약 자체를 만들지 않는다.
          S.lossResult = {
            paperCost: cost, salePrice: price, loss: diff, pending: true,
          };
          pushEvent("lossResult", { paperCost: cost, salePrice: price, loss: diff });
          S.lastEvent = "참가비 " + cost + "$ / 판매 " + price + "$ / 손실 " + diff
            + "$ — 「확인」을 누르세요";
        } else {
          // 첫 판매가 손해가 아니면 보여 줄 손실이 없다 — 예전처럼 곧바로 예약한다.
          scheduleInkCall();
        }
      } else {
        S.saleFeedback = name + verb + price + "$";
      }
      // 자동 판매는 곧바로 다음 도화지로 이어 준다 (라운드 003 흐름 그대로).
      if (auto) S.lastEvent = S.saleFeedback + " — 원작 카드를 누르면 다음 한 장을 그립니다";
      if (S.artworksSold >= 2) S.scopeComplete = true; // 데모 범위 완료 (계속 플레이 가능)
      // 판매 누적 2점 이상인 상태의 「정상 완성」 판매 — 여기서 무료 갤러리 칸이 열린다.
      // 미완성 정액 판매는 몇 번을 쌓아도 이 문을 열지 못한다.
      if (galleryUnlockReached(w.incomplete)) unlockGallery();
      // 첫 「정상 완성품」 판매가 끝나는 순간 두 번째 작업대 상품이 60원에 열린다
      // (2026-08-12 계약 7). 첫 미완성 70원 판매는 이 조건에 넣지 않는다.
      if (!w.incomplete && !S.firstNormalSaleDone) {
        S.firstNormalSaleDone = true;
        unlockSecondBench();
      }
      maybeRing();
    }

    // 손실 결과의 「확인」 — 돈도 판매 수도 건드리지 않고 대기만 끝낸다.
    // 이 순간에야 잉크통 전화가 예약되고, 통화가 끝나면 상점이 열린다 (라운드 001).
    // ── D키 디버그 창 (2026-08-19) ──────────────────────────────
    // 전화·결과판과 달리 게임을 멈추지 않는다 — 열어 둔 채로 계속 플레이하면서
    // 수치를 바꿔 보라고 만든 도구이기 때문이다.
    function toggleDebug(open) {
      S.debug.open = typeof open === "boolean" ? open : !S.debug.open;
      pushEvent("debugToggle", { open: S.debug.open });
      return S.debug.open;
    }
    // 허용한 항목만, 허용한 범위 안에서 바꾼다. 모르는 이름은 조용히 무시한다.
    const DEBUG_FIELDS = Object.freeze({
      windowLayers: Object.freeze({ min: 1, max: 9, step: 1 }),
      windowScrollSpeed: Object.freeze({ min: 0.25, max: 4, step: 0.25 }),
      windowPay: Object.freeze({ min: 0, max: 999, step: 1 }),
      windowInkDam: Object.freeze({ min: 0, max: 1, step: 1 }),
      printInkDam: Object.freeze({ min: 0, max: 1, step: 1 }),
      forceGrade: Object.freeze({ min: -1, max: 4, step: 1 }),
      timeScale: Object.freeze({ min: 1, max: 10, step: 1 }),
      firstInkPercent: Object.freeze({ min: 0, max: 300, step: 1 }),
      windowPayLv1: Object.freeze({ min: 0, max: 999, step: 1 }),
      // 2026-08-25 계약 2 — 밑그림 표현 A(0 단색 윤곽) / B(1 옅은 원색)
      underdrawing: Object.freeze({ min: 0, max: 1, step: 1 }),
      // 2026-08-27 v1 · 유리 A 승인 — 결과별 자동 마감 켬(1) / 끔(0).
      // 끄면 80% 뒤 자동 마무리가 돌지 않고 끝까지 직접 밀어야 한다.
      // 확률·보수·해금은 어느 쪽에서도 바뀌지 않는다 — 조작 리듬만 비교하는 손잡이다.
      windowAutoFinish: Object.freeze({ min: 0, max: 1, step: 1 }),
    });
    function setDebugValue(key, value) {
      const field = DEBUG_FIELDS[key];
      if (!field) return false;
      let v = Number(value);
      if (!isFinite(v)) return false;
      v = Math.min(field.max, Math.max(field.min, v));
      if (field.step >= 1) v = Math.round(v);
      S.debug.values[key] = v;
      // 잉크통 크기는 「지금 값」을 저장해 두고 쓰는 값이라, 손잡이만 돌려서는
      // 화면이 그대로다. 최초 물감량을 바꾼 순간 통 크기를 다시 재 준다.
      // (담긴 양이 새 통보다 많으면 넘치지 않게 줄인다.)
      if (key === "firstInkPercent") {
        // 손잡이를 처음 돌릴 때 「원래 통과 담긴 양」을 통째로 적어 둔다.
        // 매번 지금 값에서 비율을 다시 재면, 통이 아주 작아졌을 때(3% 등)
        // 반올림이 두 번 뭉개져 되돌렸을 때 잉크가 줄거나 공짜로 가득 차 버린다.
        // 언제나 「적어 둔 원래 값」에서 새로 계산하면 그런 표류가 없다.
        if (v > 0 && !S.inkDialBackup) {
          S.inkDialBackup = { cells: S.ink.cells, capacity: S.ink.capacity };
        }
        const base = S.inkDialBackup || { cells: S.ink.cells, capacity: S.ink.capacity };
        S.ink.capacity = inkCapacity();
        if (v > 0) {
          const ratio = base.capacity > 0 ? base.cells / base.capacity : 0;
          S.ink.cells = Math.min(S.ink.capacity, Math.round(ratio * S.ink.capacity));
        } else {
          // 기본으로 되돌렸다 — 적어 둔 칸 수를 그대로 되돌려 놓는다
          S.ink.cells = Math.min(S.ink.capacity, base.cells);
          S.inkDialBackup = null;
        }
      }
      pushEvent("debugSet", { key: key, value: v });
      return true;
    }

    // ── 디버그 즉시 실행 명령 (2026-08-19 확정 · 10개 확장의 나머지) ──
    // 값을 바꾸는 손잡이와 달리, 누르는 순간 한 번 일어나는 것들이다.
    // 전부 「검수를 빠르게」가 목적이고 게임 규칙(확률·가격·소비량)은 건드리지 않는다.
    const DEBUG_ACTIONS = Object.freeze({
      // 잉크를 지금 통 크기만큼 가득 채운다 — 「잉크 부족」 화면을 기다리지 않고 넘어간다.
      fillInk: function () {
        S.ink.capacity = inkCapacity();
        S.ink.cells = S.ink.capacity;
        return true;
      },
      // 잉크를 비운다 — 바닥나는 순간의 차단·미완성 흐름을 바로 본다.
      emptyInk: function () {
        S.ink.cells = 0;
        return true;
      },
      // 상점을 전부 공개한다 — 카드 배치와 문구를 한 화면에서 비교할 때 쓴다.
      // 사 준 것은 아니다. 살 수 있게 「보이기만」 한다.
      revealShop: function () {
        S.unlocked.shop = true;
        S.shopRevealed = UPGRADES.length;
        // 「검수로 연 판」 표시를 남긴다 — 여기서 잰 경제 수치가 자연 플레이로 도달한
        // 상태가 아님을 화면과 상태 어디서나 알 수 있게 한다.
        // (2026-10-08 3단계: 선형 구매 조건이 없어져 공개된 카드는 그대로 살 수 있다.)
        S.debugShopRevealed = true;
        return true;
      },
      // 라운드 005 문제 D (2026-08-20): 「전부 공개」는 5칸을 한 번에 열어 버려서
      // 「상점에 ○○이 열렸습니다」 등장 연출을 검수할 수 없었다. 이 명령은 다음
      // 상품 하나만, refreshShop과 똑같은 알림 경로(upgradeUnlocked)로 연다 —
      // 그래서 등장 연출 자체가 검수 대상이 될 수 있다. 다 열렸으면 실패를 돌려준다.
      revealShopNext: function () {
        if (S.shopRevealed >= UPGRADES.length) return false;
        const u = UPGRADES[S.shopRevealed];
        S.shopRevealed += 1;
        S.unlocked.shop = true;
        S.debugShopRevealed = true; // 전부 공개와 같은 「검수로 연 판」 표시
        pushEvent("upgradeUnlocked", { key: u.key, label: u.label });
        S.lastEvent = "상점에 「" + u.label + "」이(가) 열렸습니다";
        return true;
      },
      // 갤러리를 연다 — 전시 칸과 자동판매 해금 조건을 바로 확인한다.
      unlockGallery: function () {
        S.gallery.unlocked = true;
        // (2026-10-08 3단계부터 자동판매는 구간 5로 열린다 — 갤러리는 해금과 상관없지만,
        //  상점을 다시 훑는 것은 해가 없어 그대로 둔다.)
        refreshShop();
        return true;
      },
      // 2026-10-08 3단계: 「자동화 조건」(손으로 15장·30점 채우기)은 뺐다 — 자동화 두 종이
      // 이제 구간 4·5로 열리므로 손 횟수는 해금과 상관이 없다. 아래 「구간 채우기」가 그 자리를 맡는다.
      // 2026-08-25 계약 5 — 다음 유리창 한 장을 파손으로 못박는다.
      // 파손은 레벨 1의 10% 결과라 자연 플레이에서는 열 장을 닦아도 못 볼 수 있다.
      // 이 예약은 「다음 한 장」에만 들고, 쓰이는 순간 스스로 꺼진다.
      breakNextWindow: function () {
        if (S.debug.breakNextWindow) return false; // 이미 예약돼 있다
        S.debug.breakNextWindow = true;
        S.lastEvent = "검수 예약 — 다음 유리창 한 장이 파손됩니다 (총손실 "
          + State.WINDOW_COSTS.breakTotalLoss + "$)";
        return true;
      },
      // 2026-10-08 3단계: 「레벨 +1」 대신 「구간 채우기」 — 지금 구간에 모자란 돈만큼을
      // 「번 돈」으로 쳐서 구간 하나를 넘긴다(현금은 늘지 않는다). 잉크 질·자동화·1막 끝처럼
      // 뒤 구간에서 열리는 것을 빨리 본다. 다 넘었으면 실패로 알린다.
      clearSegment: function () {
        if (S.act1End.reached || S.segment.index >= SEG.goals.length) return false;
        const need = SEG.goals[S.segment.index] - S.segment.earned;
        advanceSegment(need);
        return true;
      },
    });
    function runDebugAction(name) {
      const fn = DEBUG_ACTIONS[name];
      if (!fn) return false;
      const ok = fn();
      if (ok) {
        // review.used는 여기서 절대 건드리지 않는다.
        // benchSlots()가 이 깃발로 「검수로 세운 대수 / 실제로 산 대수」를 고른다.
        //  · true로 켜면 → 돈 주고 산 작업대가 검수 기본값 1대로 되돌아간다 (2026-08-19 사고).
        //  · false로 끄면 → 검수로 세워 둔 3·4대가 1대로 무너진다 (그 거울상. 이번에 제거).
        // 이 명령들은 잉크·상점·갤러리·구간만 건드리며 작업대 수와 아무 상관이 없다.
        pushEvent("debugAction", { name: name });
      }
      return ok;
    }

    // 바깥(화면 루프·검사)에서 부르는 시계. 여기에만 디버그 배속이 걸린다.
    // 배속은 「기다리는 시간을 줄이는」 도구이므로, 규칙이 정한 길이가 아니라
    // 바깥에서 흘려 주는 실제 시간에만 곱해야 한다.
    function tick(ms) {
      const scale = Math.round(Number(S.debug.values.timeScale)) || 1;
      advance(ms * scale);
    }

    function lossPending() { return !!(S.lossResult && S.lossResult.pending); }

    function confirmLossResult() {
      if (!canInteract()) return false;
      const rec = S.lossResult;
      if (!rec || !rec.pending) return false;
      rec.pending = false;
      pushEvent("lossConfirmed", { loss: rec.loss });
      S.lastEvent = "손실을 확인했습니다 — 왜 모자랐는지 알려 줄 전화가 곧 옵니다";
      scheduleInkCall();
      return true;
    }

    // 이번 묶음에서 실제로 산 작품을 전부 처리하면 작업대를 비운다.
    // 완료 판정은 「실제로 산 작품 수」만 본다 — 판매+판매도, 판매+전시도,
    // 전시+판매도, 한 장짜리 묶음의 단 한 번 처리도 모두 완료다.
    // 계속 플레이는 막지 않는다 — 유리창 알바도 도화지 구매도 그대로 열려 있다.
    // ══ 자동화 두 종 (2026-08-19 확정 · 0817 피드백 9번) ═══════════
    // 손으로 누르던 반복을 게임이 대신한다. 둘 다 「사야 열리는」 상점 항목이고,
    // 배우는 장면과 축하 장면은 손에 남긴다.

    // 지갑 하한선 — 자동구매가 상점에 쓸 돈까지 다 가져가면 안 된다.
    // 도화지값 두 장분 아래로는 사지 않는다 (동현 확정).
    function autoBuyFloor() { return paperClickCost() * 2; } // v5: 지금 원작 재료비 두 장분

    // 도화지 자동구매 — 빈 칸이 있고 지갑이 하한선 위면 한 장 놓는다.
    // 한 번에 한 장만 산다. 여러 장이 필요하면 다음 판정에서 또 산다 — 그래야
    // 잉크 부족 차단이나 손실 확인 같은 다른 문이 사이에 끼어들 수 있다.
    // 2026-10-20 v9: 「한 장 자동 제작」 — 작업대가 비면 마지막으로 고른 원작을 한 장 올린다(한 장 제작과 같은 길).
    function autoBuyPaperStep() {
      if (!S.upgrades.autoBuyPaper) return false;
      if (!S.unlocked.paper || !S.currentOriginalKey) return false;
      if (S.money - paperClickCost() < autoBuyFloor()) return false;
      return makeSheet(S.currentOriginalKey, true); // byAuto — 손으로 산 횟수에 세지 않는다
    }

    // 작품 자동판매 — 결과판에 올라온 것 중 「정상 완성 + 실버 이하」만 판다.
    //   · 미완성은 손으로 판다 — 왜 70원밖에 안 되는지 직접 보는 것이 학습이다.
    //   · 골드 이상은 손으로 판다 — 다이아(0.1%)가 떴을 때 축하 장면을 놓치지 않게.
    //   · 스위치가 꺼져 있으면 아무것도 팔지 않는다 (갤러리에 걸 작품을 고르는 중).
    // 2026-10-12 v5: 자동판매 2단계 — 1단계 = 실버까지(0 브론즈 · 1 실버), 2단계 = 다이아까지 전부.
    // 미완성은 두 단계 모두 손으로 판다.
    const AUTO_SELL_MAX_GRADE = 1; // 1단계 상한 (옛 이름 그대로)
    function autoSellMaxGrade() {
      return (S.upgrades.autoSellWork || 0) >= 2 ? ECON.grades.length - 1 : AUTO_SELL_MAX_GRADE;
    }
    function autoSellStep() {
      if (!S.upgrades.autoSellWork || !S.autoSellOn) return false;
      if (!S.resultsOpen) return false;
      let sold = false;
      const maxGrade = autoSellMaxGrade();
      S.works.forEach(function (w, index) {
        if (w.outcome) return;
        if (w.incomplete) return; // 미완성은 손으로
        if (w.gradeIndex > maxGrade) return; // 1단계면 골드 이상은 손으로
        if (sellWork(index, true)) sold = true; // byAuto
      });
      return sold;
    }

    // 자동판매 켜고 끄기 — 산 뒤에도 언제든 바꿀 수 있다.
    function setAutoSell(on) {
      if (!S.upgrades.autoSellWork) return false;
      S.autoSellOn = !!on;
      pushEvent("autoSellToggled", { on: S.autoSellOn });
      S.lastEvent = S.autoSellOn
        ? "작품 자동판매를 켰습니다"
        : "작품 자동판매를 잠시 껐습니다 — 갤러리에 걸 작품을 고를 수 있습니다";
      return true;
    }

    // 매 시계 흐름마다 한 번씩 판정한다. 판매를 먼저 하고 구매를 뒤에 하는 이유는,
    // 판 돈으로 다음 도화지를 살 수 있어야 흐름이 끊기지 않기 때문이다.
    function runAutomation() {
      autoSellStep();
      autoBuyPaperStep();
    }

    function finishResultsIfDone() {
      if (!S.works.length) return;
      const left = S.works.filter(function (w) { return !w.outcome; });
      if (left.length) return; // 아직 고르지 않은 작품이 남아 있으면 결과판을 계속 연다
      const count = S.works.length;
      const incomplete = S.works.some(function (w) { return w.incomplete; });
      S.resultsOpen = false;
      S.expansionComplete = true;
      clearBatch();
      pushEvent("expansionComplete", { works: count, incomplete: incomplete });
      S.lastEvent = count > 1
        ? "이번 묶음 완료 — " + count + "점을 모두 처리했습니다. 원작 카드를 누르면 다음 한 장을 그립니다"
        : "한 장 처리 완료 — 원작 카드를 누르면 다음 한 장을 그립니다";
      refreshShop();
      maybeRing();
    }

    // 복제품이라고 밝히는 안전 판매 — 진품 사기·경매 위작 출품은 여기 없다.
    // 몇 점을 팔지는 규칙이 정하지 않는다. 한 묶음을 전부 팔아도 된다 (라운드 005).
    function sellWork(slot, byAuto) {
      if (!canInteract()) return false;
      const w = pendingWork(slot);
      if (!w) return false;
      // 2026-10-20 v9(시안 2판): 판매가는 「파는 순간의 원작 레벨」로 — 결과판이 열린 뒤 경매장에서 그 원작
      // 레벨업을 사도 확률표 가격과 판매가가 함께 오른다. 미완성은 정액(재료비의 70%)이라 그대로.
      if (!w.incomplete) w.price = originalPrice(w.gradeIndex, w.originalKey);
      w.outcome = "sold";
      gainIncome(w.price, "sale"); // 수동·자동 판매 모두 공통 수입 함수를 지난다
      S.artworksSold += 1;
      // 자동판매 해금은 「손으로 몇 점 팔았는가」만 센다.
      if (!byAuto) S.worksSoldByHand += 1;
      S.lastSalePrice = w.price;
      pushEvent("workSold", { slot: slot, grade: ECON.grades[w.gradeIndex].key, price: w.price });
      S.lastEvent = (w.incomplete ? "미완성 작품" : ECON.grades[w.gradeIndex].label)
        + " 복제품 판매 +" + w.price + "$";
      registerSale(w);
      refreshShop();
      finishResultsIfDone();
      return true;
    }

    // 무료 전시 칸에 건다. 전시를 막는 것은 규칙이 아니라 남은 칸뿐이다 —
    // 칸이 차 있으면 그때만 거절된다(추가 칸 구매는 범위 밖).
    function displayWork(slot) {
      if (!canInteract() || !S.gallery.unlocked) return false;
      const w = pendingWork(slot);
      if (!w) return false;
      if (S.gallery.items.length >= EXP.gallerySlots) return false;
      w.outcome = "gallery";
      S.gallery.items.push({
        slot: w.slot,
        originalKey: w.originalKey,
        grade: ECON.grades[w.gradeIndex].key,
        gradeIndex: w.gradeIndex,
        label: ECON.grades[w.gradeIndex].label,
      });
      pushEvent("workDisplayed", { slot: slot, grade: ECON.grades[w.gradeIndex].key });
      S.lastEvent = ECON.grades[w.gradeIndex].label + " 작품을 갤러리에 전시했습니다";
      finishResultsIfDone();
      return true;
    }

    // 검수 전용 돈 — 실제 경제와 분리된 도구다.
    // 돈만 더하고 해금·판매 수·작품 결과·경험치·작업 상태는 건드리지 않는다.
    // 2026-08-26: 이 돈도 공통 수입 함수를 지난다. 빚이 남아 있으면 먼저 갚고 남는 만큼만
    // 현금이 된다 — 검수 도구라고 「빚을 건너뛰는 현금」을 만들면 화면이 거짓말을 한다.
    function addReviewMoney(amount) {
      if (!S.started) return false;
      const value = Number(amount);
      if (EXP.reviewMoneyAmounts.indexOf(value) < 0) return false;
      gainIncome(value, "review");
      S.reviewMoney.used = true;
      pushEvent("reviewMoney", { amount: value });
      return true;
    }

    // 검수 전용: 현금을 특정 금액으로 맞춘다. 「돈이 없어 막히는 위기」와
    // 「200원 전액 상환」을 브라우저 검수에서 결정적으로 재현하기 위한 손잡이다.
    // 해금·확률·판매 수·경험치·대출 상태는 하나도 건드리지 않는다.
    function setReviewMoney(amount) {
      if (!S.started) return false;
      const value = Math.max(0, Math.round(Number(amount) || 0));
      S.money = value;
      S.reviewMoney.used = true;
      pushEvent("reviewMoney", { amount: value, exact: true });
      return true;
    }

    // 검수 전용 잉크 — 지금 세워 둔 작업대 수만큼 한 묶음을 끝까지 찍을 수 있게
    // 잉크통 여유분을 채운다. 실제 상점 단계는 건드리지 않고, 돈·경험치·판매수·
    // 해금·확률도 하나도 바꾸지 않는다. 3·4번째 작업대 겉모습을 검수할 때 쓴다.
    // 2026-10-08 3단계: 잉크통 2단계(두 장분)가 7-A로 빠져, 두 대 장면의 두 장분 잉크는 이제
    // 이 검수 손잡이로만 채운다. sheets를 주면 작업대 수 대신 그 장수만큼 채운다(검사 도우미용).
    function addReviewInk(sheets) {
      if (!S.started) return false;
      const want = Number.isInteger(sheets) && sheets > 0 ? sheets : benchSlots();
      const need = requiredCells() * Math.max(1, want);
      const have = inkCapacity();
      if (have >= need) return false;
      const grown = need - have;
      S.review.inkBonus = (S.review.inkBonus || 0) + grown;
      // review.used는 「검수 도구로 작업대 수를 바꿨다」는 표시라 여기서 켜면 안 된다.
      // benchSlots()가 그 깃발을 보고 실제로 산 칸수 대신 검수 칸수(기본 1)를 쓰기
      // 때문에, 잉크만 채웠는데 사 둔 두 번째 작업대가 사라진다 (2026-08-19 발견).
      S.review.inkUsed = true;
      S.ink.capacity = inkCapacity();
      if (S.hasPaper) S.ink.cells += grown;
      pushEvent("reviewInk", { capacity: S.ink.capacity, need: need });
      return true;
    }

    // 브라우저 화면 검수 전용: 자연 플레이의 첫 손실 학습·구매·상점 해금을 건너뛰고
    // 작업대 1~4개의 「작품이 놓인 모습」만 만든다. 돈·경험치·판매수·업그레이드·
    // 자연 해금은 건드리지 않으며 플레이 화면에는 버튼으로 노출하지 않는다.
    function prepareReviewArtworks(count) {
      if (!reviewHarness || !S.started) return false;
      const n = Number(count);
      if (!Number.isInteger(n) || n < 1 || n > 4 || modeSwitchLocked()) return false;
      S.review.used = true;
      S.review.workbenchCount = n;
      S.review.inkBonus = Math.max(S.review.inkBonus || 0,
        requiredCells() * n - State.inkCapacityForLevel(S.upgrades.inkTank));
      S.review.inkUsed = true;
      S.currentOriginalKey = S.currentOriginalKey || "mewna-lisa";
      S.awaitingOriginal = false;
      S.resultsOpen = false;
      S.expansionComplete = false;
      S.mode = "print";
      S.hasPaper = true;
      S.works = [];
      S.benchFocus = 0;
      for (let i = 0; i < n; i += 1) {
        const work = makeWork(i, 0);
        S.works.push(work);
        startArtwork(work.roundPlan);
        work.printState = S.print;
      }
      S.print = S.works[0].printState;
      S.ink.capacity = inkCapacity();
      S.ink.cells = S.ink.capacity;
      pushEvent("reviewArtworks", { count: n });
      return true;
    }

    // ══ 경험치와 레벨 — 2026-10-08 두 방 데모 3단계에서 뺐다 ══════════════
    // 유리창·인쇄·판매에서 경험치가 쌓이지 않고 공방 레벨도 오르지 않는다(10/6 그릴미 · 형님 3-A).
    // 판매가에 붙던 레벨 보너스도 함께 사라졌다(형님 6-A) — 4단계에서 원작 레벨이 그 자리를 맡는다.
    // 해금은 위 「구간 목표 금액」이 연다.

    // ══ 상점 해금 — 위에서 아래로 하나씩, 조건은 구간 목표 하나 ═══════
    // 2026-10-08 두 방 데모 3단계(형님 4-A): 「앞 항목을 한 번은 사야 다음이 열린다」는
    // 선형 조건을 뺐다. 해금은 구간 목표 하나만 본다. (카드는 여전히 위에서 아래로 차례로
    // 드러난다 — refreshShop이 순서대로 훑는다.)
    function upgradeReady(index) {
      const u = UPGRADES[index];
      if (!u) return false;
      if (u.unlock.type === "segment") return S.segment.index >= u.unlock.value;
      if (u.unlock.type === "phone") return S.phone.done[u.unlock.value] === true;
      if (u.unlock.type === "level") return S.level >= u.unlock.value;
      // 판매 횟수 조건 — 「두 번째 작품을 팔면 인쇄 도구가 보인다」처럼
      // 실제로 겪은 일에 맞춰 열린다.
      if (u.unlock.type === "sales") return S.artworksSold >= u.unlock.value;
      // 2026-08-19: 손으로 도화지를 몇 장 샀는가 — 자동구매를 열어 주는 문.
      // 「사기 자동화는 손으로 여러 번 사 본 뒤에 열어 준다」는 유니버설 페이퍼클립 방식.
      if (u.unlock.type === "papers") return S.papersBoughtByHand >= u.unlock.value;
      // 갤러리가 열린 뒤 + 손으로 몇 점을 팔았는가 — 자동판매를 열어 주는 문.
      // 판매에는 「등급 확인」과 「팔까 걸까」 선택이 붙어 있어 갤러리보다 뒤로 미룬다.
      if (u.unlock.type === "galleryAndSales") {
        return S.gallery.unlocked && S.worksSoldByHand >= u.unlock.value;
      }
      return false;
    }

    // ══ 원작 고리 (2026-10-08 두 방 데모 4단계) ═══════════════════════
    // 비유: 원작은 틀이다. 틀이 좋을수록(급) 같은 그림도 비싸게 팔리고, 같은 틀을 또 사면(원작 레벨) 값이 오른다.
    function originalLevel(key) {
      return Math.max(0, Math.round(Number(S.originalLevels[key]) || 0));
    }
    function ownsOriginal(key) { return originalLevel(key) >= 1; }
    // 그림 한 점의 판매가 — 미완성 값(v5: 그 원작 재료비의 70%, State.incompletePriceFor)은 여기를 지나지 않는다.
    function originalPrice(gradeIndex, key) {
      const k = key || "mewna-lisa";
      return State.originalPriceFor(gradeIndex, k, Math.max(1, originalLevel(k)));
    }
    // 확률표가 값을 말할 원작 — 찍고 있는 그림이 있으면 그 원작, 아니면 지금 고른 원작.
    function priceOriginalKey() {
      return (S.print && S.print.originalKey) || S.currentOriginalKey || "mewna-lisa";
    }
    // ── 경매장 문 매물 2칸 (2026-10-12 v5 · 형님 27-A) ──
    // ① 새 원작 — 아직 없는 원작 중 급이 가장 낮은 것. 그 원작의 구간을 못 넘었으면 예고만(locked).
    // ② 주력 레벨업 — 가진 원작 중 급이 가장 높은 것의 다음 레벨.
    // 화면 카드와 실제 결제가 같은 계산(State.doorLots)을 쓴다.
    function auctionLots() { return State.doorLots(S.originalLevels, S.segment.index, S.currentOriginalKey); } // v8 · 5-A
    function lotView(lot) {
      if (!lot) return null;
      const canPay = S.auctionDoor.open && !lot.locked && S.money >= lot.price;
      const guardBlocked = canPay && purchaseDeadlocks(lot.price, false);
      return {
        key: lot.key,
        tier: lot.tier,
        // 「새 원작」인지 「가진 원작 레벨업」인지 — 알림 표시(NEW)와 헷갈리지 않게 isNew 대신 kind로 낸다.
        kind: lot.kind,
        fromLevel: lot.fromLevel,
        toLevel: lot.toLevel,
        price: lot.price,
        inkMult: lot.inkMult,
        priceMult: lot.priceMult,
        locked: !!lot.locked, // 아직 그 원작의 구간 전 — 실루엣 예고만
        unlockSegment: lot.unlockSegment,
        lotKey: lot.key + ":" + lot.toLevel, // 화면이 「보여 준 매물」을 결제에 다시 넘기는 이름표
        // 돈이 값에 닿았다 → 그 칸에 느낌표(기둥 ⑤). 교착 방지가 막는 동안은 켜지 않는다.
        affordable: canPay && !guardBlocked,
        reserveBlocked: guardBlocked,
      };
    }
    function auctionLotState() {
      const lots = auctionLots();
      const newLot = lotView(lots.newLot);
      const levelLot = lotView(lots.levelLot);
      // v4 화면 · 검사 호환: lot = 지금 살 수 있는 쪽(새 원작 우선), 없으면 예고 중인 새 원작.
      const lot = (newLot && !newLot.locked ? newLot : null) || levelLot || newLot;
      return {
        open: S.auctionDoor.open,
        newLot: newLot,
        levelLot: levelLot,
        lot: lot,
        allMax: !newLot && !levelLot,
        affordable: !!((newLot && newLot.affordable) || (levelLot && levelLot.affordable)),
        reserveBlocked: !!(lot && lot.reserveBlocked),
      };
    }
    // 경매장 문 칸을 눌러 그 매물을 값대로 바로 얻는다(임시 방식 — 진짜 경매는 5단계).
    // 쓰는 돈은 구간 막대를 줄이지 않는다 — 막대는 번 돈만 센다(이 결제는 gainIncome을 지나지 않는다).
    // expectKey(선택): 화면 칸이 보여 준 매물 「원작:목표 레벨」. 두 칸 중 그 매물을 산다.
    // 없으면 살 수 있는 쪽(새 원작 먼저)을 산다. 첫 결제 직후 칸이 다음 매물로 바뀐 순간의
    // 두 번째 클릭이 그 매물까지 사 버리는 일을 막는다(별도 검수 10/8).
    function buyAuctionLot(expectKey) {
      if (!canInteract() || !S.auctionDoor.open) return false;
      const lots = auctionLots();
      const pool = [lots.newLot, lots.levelLot].filter(function (l) { return l && !l.locked; });
      let lot = null;
      if (typeof expectKey === "string") {
        lot = pool.find(function (l) { return l.key + ":" + l.toLevel === expectKey; }) || null;
      } else {
        lot = pool.find(function (l) { return S.money >= l.price; }) || pool[0] || null;
      }
      if (!lot) return false;
      if (S.money < lot.price) {
        blockedByNoMoney("buyAuctionLot");
        return false;
      }
      if (blockDeadlockPurchase("경매 원작", lot.price, false)) return false;
      const capsBefore = UPGRADES.map(upgradeCap);
      S.money -= lot.price;
      S.originalLevels[lot.key] = lot.toLevel;
      const art = Art.originalByKey(lot.key);
      const label = art ? art.label : lot.key;
      // 받침에 따라 「을/를」을 고른다(해바라기를 · 진주 고양이를).
      const lastCode = label.charCodeAt(label.length - 1);
      const objMark = (lastCode >= 0xAC00 && lastCode <= 0xD7A3 && (lastCode - 0xAC00) % 28) ? "을" : "를";
      pushEvent("originalAcquired", {
        key: lot.key, label: label, level: lot.toLevel, isNew: lot.isNew, price: lot.price,
      });
      S.lastEvent = lot.isNew
        ? "경매에서 「" + label + "」" + objMark + " 얻었습니다 −" + lot.price.toLocaleString("ko-KR") + "$ — 카탈로그에서 고를 수 있습니다"
        : "「" + label + "」 원작 Lv " + lot.toLevel + " −" + lot.price.toLocaleString("ko-KR") + "$ — 이 원작의 모작 값이 올랐습니다";
      // 잉크가 두 배 드는 원작을 처음 얻으면 잉크통 다음 단계가 상점에 다시 열린다(15-A).
      // 관문이 새로 풀린 카드만 「같은 카드의 다음 단계」 알림(NEW만, 팝업 없음)으로 알린다.
      UPGRADES.forEach(function (u, i) {
        if (i >= S.shopRevealed) return; // 아직 상점에 안 나온 카드는 나올 때 원래 길로 나온다
        const capNow = upgradeCap(u);
        if (capNow > capsBefore[i] && S.upgrades[u.key] < capNow) {
          markShopUnlocked(u, false);
          pushEvent("upgradeStageOpened", { key: u.key, label: u.label, level: capNow });
        }
      });
      return true;
    }

    // ── 상점 단계 관문 (2026-10-08 두 방 데모 4단계) ────────────────────
    // 한 카드 안에서도 단계마다 열리는 조건이 다를 수 있다(잉크통 2단계 = 진주 고양이를 얻은 뒤).
    // 지금 살 수 있는 마지막 단계 = 조건이 처음 막히는 단계 직전까지.
    function stageGateMet(gate) {
      if (!gate) return true;
      if (gate.type === "originalOwned") return ownsOriginal(gate.value);
      // 2026-10-20 v9: 잉크통 2 · 3단계 = 구간 4 · 8, 스퀴지 재질 브론즈 · 실버 = 구간 4 · 7(기둥 설계표 3 · 4절)
      if (gate.type === "segment") return S.segment.index >= gate.value;
      return false;
    }
    function upgradeCap(u) {
      const gates = u.stageGates || [];
      for (let i = 0; i < u.maxLevel; i += 1) {
        if (!stageGateMet(gates[i])) return i;
      }
      return u.maxLevel;
    }

    // ── 상점 해금 알림 (2026-08-26 v1 · 계약 6항) ─────────────────────
    // 새 장비가 「처음」 열릴 때만 화면을 덮지 않는 작은 아이콘 팝업과 NEW를 함께 켠다.
    // 같은 카드의 다음 단계가 열릴 때는 NEW만 다시 켜고 팝업은 띄우지 않는다.
    // 카드를 실제로 확인하면 둘 다 꺼지는 기존 규칙은 그대로다.
    function shopNotice(key) {
      if (!S.shopNotices[key]) S.shopNotices[key] = { popupShown: false, isNew: false };
      return S.shopNotices[key];
    }
    function markShopUnlocked(u, firstTime) {
      const notice = shopNotice(u.key);
      notice.isNew = true;
      S.shopTabNew = true;
      if (firstTime && !notice.popupShown) {
        notice.popupShown = true;
        S.shopPopup = { key: u.key, label: u.label };
        pushEvent("shopUnlockPopup", { key: u.key, label: u.label, first: true });
      } else {
        pushEvent("shopStageNew", { key: u.key, label: u.label });
      }
    }
    // 카드를 확인했다 — 그 카드의 팝업과 NEW가 함께 꺼진다.
    // key를 주지 않으면 「상점을 열어 전부 확인했다」는 뜻이라 모든 카드가 함께 꺼진다
    // (화면에서 상점 탭을 여는 것이 곧 그 행동이다).
    function confirmShopCard(key) {
      if (key === undefined || key === null) {
        Object.keys(S.shopNotices).forEach(function (k) { S.shopNotices[k].isNew = false; });
        S.shopPopup = null;
      } else {
        const notice = S.shopNotices[key];
        if (notice) notice.isNew = false;
        if (S.shopPopup && S.shopPopup.key === key) S.shopPopup = null;
      }
      // 남은 NEW가 하나도 없으면 상점 탭 금빛 표시도 함께 꺼진다.
      const anyNew = Object.keys(S.shopNotices).some(function (k) {
        return S.shopNotices[k].isNew;
      });
      if (!anyNew && !(S.secondBench.unlocked && !S.secondBench.seen)) S.shopTabNew = false;
      return true;
    }

    function refreshShop() {
      while (S.shopRevealed < UPGRADES.length && upgradeReady(S.shopRevealed)) {
        const u = UPGRADES[S.shopRevealed];
        S.shopRevealed += 1;
        S.unlocked.shop = true;
        markShopUnlocked(u, true); // 이 카드가 화면에 처음 나타나는 순간
        pushEvent("upgradeUnlocked", { key: u.key, label: u.label });
        S.lastEvent = "상점에 「" + u.label + "」이(가) 열렸습니다";
        // 2026-10-08 3단계: 구간 1(200$)은 첫 미완성 판매 순간 채워진다(유리창 4장 160 + 판매 75).
        // 그래서 전화로 잉크통이 열리는 순간 인쇄 스퀴지까지 한꺼번에 열리면, 팝업이 스퀴지로
        // 덮여 「전화가 알려 준 잉크통」 안내가 가려진다. 전화로 연 카드가 나오면 이번에는 거기서
        // 멈춘다 — 다음 카드는 잉크통을 사거나 다음에 팔 때(다음 훑기) 바로 열린다.
        if (u.unlock.type === "phone") break;
      }
    }

    function buyUpgrade(key) {
      if (!canInteract()) return false;
      // 2026-10-20 v9: 모작 운 · 스퀴지 종류 · 스퀴지 속도는 오른쪽 세 칸 — 같은 구매 문을 지나되 해금 · 값 규칙이 다르다.
      if (State.RAIL_UPGRADE_KEYS.indexOf(key) >= 0) return buyRailUpgrade(key);
      const index = UPGRADES.findIndex(function (u) { return u.key === key; });
      if (index < 0 || index >= S.shopRevealed) return false; // 아직 열리지 않은 항목
      // 2026-08-19 정정: 여기에 「디버그로 공개했으면 순서 규칙을 지켜라」는 관문을 잠깐
      // 넣었다가 뺐다. 그러면 「상점 공개」를 눌러도 다섯 항목 전부 못 사서, 카드에는
      // 「지금 살 수 있어요」라고 쓰인 채 눌러도 아무 일이 없는 고장난 버튼이 된다.
      // 검수 도구의 목적은 「그 화면까지 빨리 가 보는 것」이므로 사는 것도 열어 둔다.
      // 대신 그렇게 연 판은 debugShopRevealed 표시가 남아, 여기서 잰 경제 수치가
      // 자연 플레이로 도달한 상태가 아님을 화면과 상태 어디서나 알 수 있다.
      const u = UPGRADES[index];
      const level = S.upgrades[key];
      // 2026-10-08 4단계: 단계 관문까지 본다(잉크통 2단계는 진주 고양이를 얻어야 열림).
      if (level >= upgradeCap(u)) return false;
      // 단계마다 가격이 다를 수 있다 (잉크통 1단계 50원 · 2단계 150원).
      // 대출 불이익 `shopPriceUp` 이 걸려 있으면 카드가 말하는 값과 실제로 빠져나가는
      // 금액이 함께 10% 오른다 — 화면과 계산이 같은 함수 하나를 지난다.
      const cost = shopCostNow(u, level);
      if (S.money < cost) {
        blockedByNoMoney("buyUpgrade");
        return false;
      }
      // 공통 교착 방지 계약 — 실제로 재현된 「164원에서 150원짜리 잉크통 2단계를 사면
      // 14원이 남아 유리창조차 못 여는」 막다른 길이 여기서 막힌다 (2026-08-26 동현 확정).
      if (blockDeadlockPurchase(u.label, cost, false)) return false;
      S.money -= cost;
      S.upgrades[key] += 1;
      let freeLine = "";
      if (key === "inkTank") {
        // 잉크통을 키우면 지금 쓰던 통도 그만큼 늘어난다 (시험 규칙).
        const grown = inkCapacity() - S.ink.capacity;
        S.ink.capacity = inkCapacity();
        if (S.hasPaper && grown > 0) S.ink.cells += grown;
        // 2026-10-20 v9 · 6-A: 첫 잉크통(1단계)을 사면 다음 한 장 참가비를 한 번 대신 낸다.
        if (S.upgrades.inkTank === 1 && S.freeSheet === "none") {
          S.freeSheet = "ready";
          pushEvent("freeSheetGranted", {});
          freeLine = " · 다음 한 장 참가비는 무료입니다";
        }
      }
      pushEvent("upgradeBought", { key: key, label: u.label, level: S.upgrades[key] });
      // 같은 카드에 다음 단계가 남았으면 NEW만 다시 켠다 (아이콘 팝업은 없다).
      // 2026-10-08 4단계: 「남았다」는 지금 열려 있는 단계까지만 센다(관문 뒤 단계는 열릴 때 따로 알린다).
      if (S.upgrades[key] < upgradeCap(u)) markShopUnlocked(u, false);
      else shopNotice(key).isNew = false;
      S.lastEvent = u.label + " 구매 −" + cost + "$ — "
        + State.upgradeEffectFor(u, level) + freeLine;
      // 라운드 005 문제 C (2026-08-20): 검수용 「최초 물감량」 손잡이가 켜져 있으면
      // 통 크기를 손잡이 값이 정하므로, 잉크통을 사도 그 자리에서는 통이 안 커진다.
      // 설계상 맞는 동작이지만 화면이 설명을 안 하면 「잉크통 고장」으로 읽힌다 → 안내 한 줄.
      if (key === "inkTank" && Math.round(Number(S.debug.values.firstInkPercent)) > 0) {
        S.lastEvent = u.label + " 구매 −" + cost + "$ — 지금은 검수용 물감량을 직접 지정해 둬서 "
          + "통 크기가 바로 안 바뀝니다. 손잡이를 「기본」으로 되돌리면 반영됩니다.";
      }
      refreshShop();
      return true;
    }

    // ══ 2026-10-20 v9 · 오른쪽 「업그레이드」 세 칸 (그릴미 기둥 2-7 · 2-8 · 시안 2판) ══════════
    // 순서 = 모작 운 → 스퀴지 종류(다음 재질) → 스퀴지 속도(형님 10/19 12번). 상점 카드와 달리 칸마다 자기 구간만 본다.
    // 스퀴지 두 칸은 실제로 그리는 동안(결과판이 열리기 전)엔 못 산다 — 미는 도중에 빠르기가 바뀌지 않게(시안 그대로).
    // 모작 운은 그리는 중에도 산다 — 그때는 아직 끝나지 않은 회차의 숨은 추첨을 새 확률로 다시 뽑아 확률표와 맞춘다.
    function railRule(key) {
      return State.RAIL_UPGRADES.find(function (u) { return u.key === key; }) || null;
    }
    function squeegeeBusy() { return !!(S.hasPaper && !S.resultsOpen); }
    // 지금 이 칸에서 다음 단계를 살 때 내는 값(대출 불이익 채널을 같은 함수로 지난다 — v8부터 효과는 꺼져 있다).
    function railCostNow(key) {
      const u = railRule(key);
      if (!u) return 0;
      const level = S.upgrades[key] || 0;
      const base = key === "printSqueegeeSpeed"
        ? State.squeegeeSpeedCost(squeegeeMaterialIndex(), level)
        : State.upgradeCostFor(u, level);
      return State.shopCostWithPenalty(base, loanPenalty());
    }
    // 다음 단계가 아직 구간에 막혀 있으면 그 구간 번호, 아니면 0.
    // 2026-08-10 라운드 003 승인(확정 기준): 첫 미완성 판매 전에는 어떤 업그레이드도 열리지 않고 첫 항목은 잉크통이다.
    // 2026-10-08 형님 4-A: 그 뒤 해금은 구간 목표 하나(앞 항목을 사야 다음이 열리는 조건 없음).
    // 그래서 오른쪽 세 칸은 「잉크통 전화가 끝났고(상점이 열림) + 그 칸의 구간을 넘었을 때」 연다 — v8 상점 차례와 같은 뜻.
    // 시안은 전화가 없어 구간만 봤다. 자연 흐름에서는 구간 1이 첫 판매 순간에 채워져 잉크통 전화를 끊으면 곧바로 열린다.
    function railLockSegment(key) {
      const u = railRule(key);
      if (!u) return 0;
      const level = S.upgrades[key] || 0;
      if (S.segment.index < u.unlock.value || !S.phone.done.ink) return u.unlock.value;
      const gate = u.stageGates ? u.stageGates[level] : null;
      if (gate && !stageGateMet(gate)) return gate.value;
      return 0;
    }
    function railSlotState(key) {
      const u = railRule(key);
      const level = S.upgrades[key] || 0;
      const max = level >= u.maxLevel;
      const lockSeg = max ? 0 : railLockSegment(key);
      const price = max ? 0 : railCostNow(key);
      const busy = key !== "inkQuality" && squeegeeBusy();
      const canPay = !max && !lockSeg && S.money >= price;
      const guardBlocked = canPay && purchaseDeadlocks(price, false);
      return {
        key: key,
        label: u.label,
        level: level,
        maxLevel: u.maxLevel,
        max: max,
        locked: lockSeg > 0,
        unlockSegment: lockSeg,
        price: price,
        busy: busy && !max && !lockSeg,
        affordable: canPay && !guardBlocked && !busy,
        reserveBlocked: guardBlocked,
      };
    }
    function railState() {
      const mat = squeegeeMaterialIndex();
      const matRule = State.SQUEEGEE_MATERIALS[mat];
      const next = State.SQUEEGEE_MATERIALS[mat + 1] || null;
      const material = railSlotState("squeegeeMaterial");
      material.current = { key: matRule.key, label: matRule.label, index: mat };
      material.next = next ? { key: next.key, label: next.label } : null;
      const speed = railSlotState("printSqueegeeSpeed");
      speed.step = squeegeeSpeedStep();
      speed.maxStep = State.SQUEEGEE_MAX_SPEED;
      speed.material = { key: matRule.key, label: matRule.label };
      speed.force = printForce();
      speed.eff = printEffBase();
      return {
        busy: squeegeeBusy(),
        order: ["inkQuality", "squeegeeMaterial", "printSqueegeeSpeed"],
        luck: railSlotState("inkQuality"),
        material: material,
        speed: speed,
      };
    }
    // 모작 운을 그리는 중에 샀다 — 아직 끝나지 않은 회차의 숨은 추첨을 새 확률 단계로 다시 뽑는다.
    // 끝난 회차(이미 화면에 드러난 결과)는 그대로 두고, 첫 그림 학습 고정 · 디버그 등급 고정 · 다이아가 이미 나온 판은 손대지 않는다.
    function rerollUnsettledRounds() {
      const P = S.print;
      if (!P || (P.phase !== "ready" && P.phase !== "auto") || P.inkOut) return false;
      if (S.artworksStarted <= 1) return false;
      const forced = Math.round(Number(S.debug.values.forceGrade));
      if (forced >= 0 && forced < ECON.grades.length) return false;
      const top = ECON.grades.length - 1;
      const done = P.draws.length;
      const plan = P.roundPlan.slice(0, done);
      if (plan.indexOf(top) >= 0) return false;
      for (let i = done; i < P.manual; i += 1) {
        const draw = State.drawRoundGrade(rng, S.upgrades.inkQuality, P.originalKey);
        plan.push(draw);
        if (draw === top) break;
      }
      P.roundPlan = plan;
      P.targetGradeIndex = planFinalGrade(plan);
      P.promote = P.targetGradeIndex > 0;
      const w = S.works[activeWorkSlot()];
      if (w && !w.done) {
        w.roundPlan = plan;
        w.gradeIndex = P.targetGradeIndex;
      }
      return true;
    }
    function buyRailUpgrade(key) {
      if (!canInteract()) return false;
      const u = railRule(key);
      if (!u) return false;
      const level = S.upgrades[key] || 0;
      if (level >= u.maxLevel) return false;
      if (railLockSegment(key)) return false; // 아직 그 구간 전
      if (key !== "inkQuality" && squeegeeBusy()) return false; // 그리는 동안엔 스퀴지를 바꾸지 않는다
      const cost = railCostNow(key);
      if (S.money < cost) {
        blockedByNoMoney("buyUpgrade");
        return false;
      }
      if (blockDeadlockPurchase(u.label, cost, false)) return false;
      const beforeMat = State.SQUEEGEE_MATERIALS[squeegeeMaterialIndex()];
      S.money -= cost;
      S.upgrades[key] = level + 1;
      const price = cost.toLocaleString("ko-KR");
      if (key === "squeegeeMaterial") {
        S.upgrades.printSqueegeeSpeed = 0; // 새 재질은 속도 1단계부터(17 확정)
        const now = State.SQUEEGEE_MATERIALS[squeegeeMaterialIndex()];
        S.lastEvent = now.label + " 스퀴지 −" + price + "$ — 속도는 1단계부터, 그래도 " + beforeMat.label + " 5단계보다 셉니다";
      } else if (key === "printSqueegeeSpeed") {
        S.lastEvent = "스퀴지 속도 " + squeegeeSpeedStep() + "/" + State.SQUEEGEE_MAX_SPEED + " −" + price + "$ — 밀대가 빨라졌습니다";
      } else {
        const rerolled = rerollUnsettledRounds();
        S.lastEvent = "모작 운 Lv " + S.upgrades[key] + " −" + price + "$ — 좋은 등급이 나올 확률 단계 +1"
          + (rerolled ? " (지금 그림의 남은 회차부터)" : "");
      }
      pushEvent("upgradeBought", { key: key, label: u.label, level: S.upgrades[key], rail: true });
      return true;
    }

    // ══ 유리창 알바 — 때 5레이어, 완주 5회 = 한 장 ═════════════════
    function makeWindow() {
      return {
        pass: 0, // 지워진 때 레이어 — 0겹부터 windowStrokes()겹까지
        // 2026-08-26 확정 선투자 — 이 한 장에 대해 20원을 이미 냈는가.
        // 「시작할 때 한 번」의 시작은 실제로 밀대를 처음 미는 순간이다.
        // 창문만 띄워 놓고 아무것도 하지 않으면 돈이 나가지 않고,
        // 한 번 낸 뒤에는 완주를 몇 번 하든 다시 빠지지 않는다.
        upfrontPaid: false,
        stroke: makeStroke(),
        rowT: new Array(C.ART).fill(-1e9), // 줄 "착" 반짝 시각
        swapping: false,
        doneClock: -1e9, // 완성 광택(마지막에만) 기준 시각
        jackpot: false,
        result: null, // "normal" | "jackpot" | "fail" — 확정 결과표가 정한 이번 장의 결과
      };
    }
    function makeStroke() {
      return { pos: 0, phase: "ready", autoStart: 0, budget: 2, budgetClock: S.clock };
    }

    function startWindowJob() {
      if (!canInteract() || S.hasPaper) return false;
      // 앞 장이 아직 교체 연출 중이면 그 교체부터 끝낸다.
      // 이 함수는 「유리창 앞에 섰습니다 — 휠을 아래로 굴려 밀대를 미세요」라고
      // 말하면서 true를 돌려주는데, 교체 중에는 windowWheel이 통째로 거절돼
      // 화면 안내와 실제 입력이 어긋났다. 검수 도구(completeWindowStroke·
      // completeWindow)는 이미 같은 자리에서 같은 방식으로 교체를 끝내고 있었고,
      // 이제 그 처리가 이 문 하나로 모인다.
      // 화면에서 이 함수를 부르는 곳은 「알바 시작」 버튼 한 곳뿐이다 — 가만히
      // 보고 있는 동안의 교체 연출은 그대로 흐르고, 플레이어가 직접 「지금 밀겠다」고
      // 누른 그 순간에만 남은 교체를 끝낸다.
      if (S.window && S.window.swapping) advance(C.WINDOW_SWAP_MS + C.TICK_STEP_MS);
      // 2026-08-26 동현 확정: 선투자 20원을 못 내는 현금 0~19원에서는 행동을
      // 시작하지 않는다. 가진 돈만 내고 시작하거나 보수에서 부족분을 뒤늦게
      // 정산하는 외상 경로는 없다 — 그 자리에서 위기 대출 전화가 열릴 뿐이다.
      // 이미 유리창 앞에 서 있어도 아직 선투자를 내지 않은 장이면 똑같이 막힌다.
      if ((!S.window || !S.window.upfrontPaid) && !canAffordWindowUpfront()) {
        return blockWindowUpfront();
      }
      if (S.mode === "window") return true;
      S.mode = "window";
      if (!S.window) S.window = makeWindow();
      S.lastEvent = "유리창 앞에 섰습니다 — 휠을 아래로 굴려 밀대를 미세요";
      pushEvent("windowOpen");
      return true;
    }

    // 휠 입력 → 줄 수. 페이지 스크롤과 분리, 아래 방향만, 초당 줄 수 캡.
    function windowWheel(deltaY) {
      if (!canInteract() || S.mode !== "window" || !S.window || S.window.swapping) return false;
      const st = S.window.stroke;
      if (st.phase !== "ready" || deltaY <= 0) return false;
      // 선투자를 못 내 어차피 막힐 입력이면 휠 관성 예산까지 태우지 않는다.
      if (!S.window.upfrontPaid && !canAffordWindowUpfront()) return blockWindowUpfront();
      const cap = windowMaxRowsPerSec(); // 유리창 = 고무 밀대 단계만 반영
      st.budget = Math.min(cap / 3, st.budget + ((S.clock - st.budgetClock) / 1000) * cap);
      st.budgetClock = S.clock;
      const rows = Math.min((deltaY / C.NOTCH_PX) * windowRowsPerNotch(), st.budget);
      if (rows <= 0) return false;
      st.budget -= rows;
      return windowAdvance(rows);
    }

    // ── 선투자 20원 (2026-08-26 동현 확정) ────────────────────────────
    // 「가진 돈만 내고 시작」도, 「보수에서 부족분을 후불 정산」도 없다. 현금이 20원에
    // 못 미치면 유리창은 시작조차 하지 않고, 그 순간이 곧 생애 한 번의 위기 대출
    // 전화가 열리는 자리다. 전화를 이미 거절했거나 소진한 생애에서는 계속 막히기만
    // 하고 자동 빚은 만들지 않는다 — 이 판에 「빚」이라 부를 수 있는 것은 계약 대출
    // 하나뿐이라는 규칙을 어떤 우회로도 뚫지 않는다.
    //
    // 덕분에 선투자는 언제나 전액 아니면 0이고, 총보수는 한 푼도 미리 깎이지 않는다.
    // 그래서 대출 중 수입 50% 삭감이 늘 「총보수 원금액」에서 계산된다.
    function canAffordWindowUpfront() {
      return S.money >= State.WINDOW_RULES.upfrontCost;
    }

    // 선투자를 못 내 막힌 자리 — 위기 전화를 걸고 왜 막혔는지 한 줄로 말한다.
    // 언제나 false를 돌려주므로 호출부는 그대로 이 값을 반환하면 된다.
    function blockWindowUpfront() {
      const cost = State.WINDOW_RULES.upfrontCost;
      pushEvent("windowUpfrontBlocked", { cost: cost, money: S.money });
      S.lastEvent = "유리창 선투자 " + cost + "$가 모자랍니다 — 현금 " + S.money
        + "$로는 시작할 수 없습니다";
      maybeOfferLoan("windowUpfront");
      return false;
    }

    // 이 한 장의 선투자를 아직 안 냈으면 지금 낸다 (한 장에 한 번뿐).
    // 낼 수 없으면 한 푼도 나가지 않고 밀기 자체가 성립하지 않는다.
    function payWindowUpfront(w) {
      if (!w || w.upfrontPaid) return true;
      if (!canAffordWindowUpfront()) return blockWindowUpfront();
      const cost = State.WINDOW_RULES.upfrontCost;
      w.upfrontPaid = true;
      S.money -= cost;
      pushEvent("windowUpfront", { cost: cost, paid: cost, money: S.money });
      S.lastEvent = "유리창 한 장 선투자 −" + cost + "$";
      return true;
    }

    // 2026-08-27 v1 · 유리 A 승인 — 결과별 자동 마감을 켜 두었는가.
    // 끄면 80% 뒤 자동 마무리가 돌지 않고 끝까지 직접 밀어야 한다. 확률·보수·해금은
    // 어느 쪽에서도 달라지지 않는다 — 조작 리듬을 비교하는 검수 손잡이다.
    function windowAutoFinishOn() {
      return Number(S.debug.values.windowAutoFinish) !== 0;
    }
    // 손으로 밀 수 있는 마지막 줄. 자동 마감이 켜져 있으면 80% 지점(AUTO_ROWS)까지고,
    // 꺼져 있으면 마지막 줄(ART)까지 직접 민다.
    function windowManualLimit() {
      return windowAutoFinishOn() ? C.AUTO_ROWS : C.ART;
    }
    // 자동 마감 구간 전체 길이 — 남은 줄 수 × 한 줄 시간. 총 소요 시간은 정본 그대로이고,
    // 그 구간을 지나는 속도의 모양만 State.autoFinishRow(easeOutCubic)가 정한다.
    function windowAutoTotalMs() {
      return windowAutoRowMs() * (C.ART - C.AUTO_ROWS);
    }

    function windowAdvance(rows) {
      const w = S.window;
      const st = w.stroke;
      if (st.phase !== "ready" || rows <= 0) return false;
      // 밀기 시작 = 이 한 장의 선투자 시점. 못 내면 첫 입력이 통째로 막힌다.
      if (!payWindowUpfront(w)) return false;
      const limit = windowManualLimit();
      const before = Math.floor(st.pos);
      st.pos = Math.min(limit, st.pos + rows);
      const after = Math.floor(st.pos);
      for (let r = before; r < after; r += 1) {
        w.rowT[r] = S.clock;
        pushEvent("windowRow", { row: r });
      }
      if (st.pos >= C.ART) {
        // 자동 마감을 꺼 둔 판 — 손으로 마지막 줄까지 밀었으니 그 자리에서 끝난다.
        finishWindowStroke();
      } else if (st.pos >= C.AUTO_ROWS && windowAutoFinishOn()) {
        st.phase = "auto"; // 13줄(80%)부터 남은 3줄 자동 마무리
        st.autoStart = S.clock;
      }
      return true;
    }

    function tickWindowAuto() {
      const w = S.window;
      if (!w || S.mode !== "window" || w.swapping) return;
      const st = w.stroke;
      if (st.phase !== "auto") return;
      // 2026-08-27 v1 · 유리 A 승인: 남은 줄을 일정 간격으로 툭툭 떨구지 않고
      // 승인 비교판과 같은 감속 곡선으로 부드럽게 마감한다. 시작·끝 시각과 줄 수는
      // 그대로라 정본의 「80% 이후 자동 마무리」 계약을 벗어나지 않는다.
      const target = Math.min(C.ART, Math.floor(State.autoFinishRow(
        S.clock - st.autoStart, windowAutoTotalMs(), C.AUTO_ROWS, C.ART)));
      while (Math.floor(st.pos) < target) {
        const r = Math.floor(st.pos);
        w.rowT[r] = S.clock;
        pushEvent("windowRow", { row: r });
        st.pos = r + 1;
      }
      if (st.pos >= C.ART) finishWindowStroke();
    }

    function finishWindowStroke() {
      const w = S.window;
      w.pass += 1; // 한 번의 완주 = 때 레이어 1장 제거
      S.strokesDone += 1;
      w.stroke = makeStroke();
      w.rowT.fill(-1e9);
      pushEvent("strokeReturn");
      if (w.pass >= windowStrokes()) {
        // 창문 한 장 완성 — 이때만 보수를 준다. 결과와 보수는 확정 결과표가 정한다.
        // 레벨은 「이 장을 끝내기 직전까지 완료한 개수」로 본다 (다섯 장째까지는 레벨 0).
        const level = windowLevel();
        const result = forcedWindowResult(level) || State.windowResultFor(level, jackpotRng());
        const jackpot = result.key === "jackpot";
        // 레벨 0 보수만 디버그 금액이 덮는다 (도화지까지 몇 장인지 세어 보는 항목).
        const pay = windowPayFor(result, level);
        // 2026-08-26 v1: 파손은 「보수 0원 + 추가 배상 20원」이고, 이미 낸 선투자
        // 20원까지 합쳐 한 장에 총 40원이 사라진다. 현금은 음수가 되지 않으며,
        // 자동 신용이 폐기돼서 못 낸 몫이 빚으로 남지도 않는다. 대신 그 「못 냄」이
        // 대출 전화를 부르는 두 위기 중 하나다 (계약 7항 1번).
        //
        // 2026-08-25 검수 지적 4는 그대로 살아 있다: 레벨 조건을 걸지 않으므로
        // 자연 플레이의 레벨 0은 여전히 100% 성공이고, 검수용 강제 파손만
        // 새 게임에서도 즉시 들린다.
        const broke = result.key === "fail";
        // 2026-08-27 유리 A 승인 — 처음 깨진 그 자리에서 안내 전화 한 통을 예약한다.
        // 실제로 거는 것은 아래 maybeRing()이고, 위기 대출 전화가 있으면 그쪽이 먼저다.
        if (broke && !S.phone.done.glassBreak) S.glassBreakCallPending = true;
        // 선투자는 언제나 전액을 미리 냈다(못 내면 시작 자체가 막힌다). 그래서 보수는
        // 한 푼도 미리 깎이지 않은 총보수 원금액 그대로 수입의 문을 지난다 —
        // 대출 중 50% 삭감도 늘 이 원금액에서 계산된다.
        if (pay > 0) gainIncome(pay, "window");
        const comp = broke ? State.WINDOW_COSTS.breakCompensation : 0;
        if (comp > 0) payWindowCost(comp, "windowBreak");
        S.windowsDone += 1;
        w.swapping = true;
        w.jackpot = jackpot;
        w.result = result.key;
        w.doneClock = S.clock;
        pushEvent("windowDone", {
          pay: pay,
          jackpot: jackpot,
          result: result.key,
          // 파손이면 얼마를 물어냈는지, 그래서 지금 빚이 얼마인지 숨기지 않는다.
          // breakCompensation은 추가 배상액이고, totalLoss는 선투자까지 합친 총손실이다.
          breakCompensation: comp,
          totalLoss: broke ? State.WINDOW_COSTS.breakTotalLoss : 0,
          money: S.money,
        });
        if (jackpot) {
          S.jackpots += 1;
          // 보상은 위에서 이미 한 번만 지급됐다. 여기서는 약 1.2초 동안 플레이 입력만
          // 잠근다 — 일시정지(paused)를 켜지 않으므로 영구 정지로 번지지 않고,
          // 시계가 그만큼 흐르면 저절로 풀린다.
          S.inputLockUntil = S.clock + C.JACKPOT_LOCK_MS;
          pushEvent("windowJackpot", {
            pay: pay, label: ECON.jackpot.label, lockMs: C.JACKPOT_LOCK_MS,
          });
          S.lastEvent = ECON.jackpot.label + " 확정 보수 +" + pay + "$";
        } else if (result.key === "fail") {
          // 2026-08-26 v1: 파손 문구는 선투자·배상·총손실을 함께 말한다.
          // 빚이라는 개념이 없으므로 「남은 빚」 줄도 사라졌다.
          S.lastEvent = result.label + " — 보수 0$ · 배상 "
            + State.WINDOW_COSTS.breakCompensation + "$ (선투자 "
            + State.WINDOW_COSTS.upfront + "$까지 총손실 "
            + State.WINDOW_COSTS.breakTotalLoss + "$)";
        } else {
          // 대출 잔액이 남아 있으면 실제로 들어온 금액과 삭감액을 숨기지 않는다.
          const cutNow = S.lastIncomeCut;
          S.lastEvent = "창문 한 장 완성 +" + pay + "$ (선투자 "
            + State.WINDOW_COSTS.upfront + "$를 빼면 순이익 "
            + Math.max(0, pay - State.WINDOW_COSTS.upfront) + "$)"
            + (cutNow && cutNow.source === "window" && cutNow.gross === pay
              ? " · 대출 상환 중이라 " + cutNow.cut + "$가 빠지고 "
                + cutNow.net + "$만 들어왔습니다"
              : "");
        }
        const current = w;
        schedule(C.WINDOW_SWAP_MS, function () {
          if (S.window === current) S.window = makeWindow();
        });
        maybeRing();
      } else {
        S.lastEvent = "때 " + w.pass + "겹 제거 / " + windowStrokes() + "겹";
      }
    }

    // 검수용: 현재 완주를 즉시 끝까지 민다.
    function completeWindowStroke() {
      if (!canInteract() || S.hasPaper) return false;
      if (S.mode !== "window" && !startWindowJob()) return false;
      if (S.window && S.window.swapping) advance(C.WINDOW_SWAP_MS + C.TICK_STEP_MS);
      const w = S.window;
      if (!w) return false;
      // 검수 도구도 선투자 차단을 우회하지 않는다 (2026-08-26 동현 확정).
      if (!payWindowUpfront(w)) return false;
      const st = w.stroke;
      // 자동 마감을 꺼 둔 판에서는 검수 도구도 마지막 줄까지 직접 민다 (같은 규칙).
      if (st.phase === "ready") windowAdvance(windowManualLimit() - st.pos);
      let guard = 0;
      while (S.window === w && w.stroke === st && guard < 20) {
        advance(windowAutoRowMs() * 3 + 10);
        guard += 1;
      }
      return true;
    }

    // 검수용: 창문 한 장을 통째로 끝낸다 (완주 5회 + 교체 대기 처리).
    function completeWindow() {
      if (!canInteract() || S.hasPaper) return false;
      if (S.mode !== "window") startWindowJob();
      if (S.window && S.window.swapping) advance(C.WINDOW_SWAP_MS + C.TICK_STEP_MS);
      if (!S.window) return false;
      // 아직 선투자를 안 낸 장인데 낼 돈이 없으면 헛돌지 않고 곧바로 막힌다.
      if (!S.window.upfrontPaid && !canAffordWindowUpfront()) return blockWindowUpfront();
      const target = S.windowsDone + 1;
      let guard = 0;
      while (S.windowsDone < target && guard < windowStrokes() + 2) {
        completeWindowStroke();
        guard += 1;
      }
      return S.windowsDone === target;
    }

    // ══ 전화 — 받으면 전체 일시정지, 끊으면 정확히 재개 ═══════════
    // 순서: 도화지(100원) → 잉크통(첫 미완성 판매 뒤). 두 통뿐이다.
    function ring(script) {
      S.phone.ringing = script;
      pushEvent("ring", { script: script });
      S.lastEvent = "전화가 울립니다 — 빨간 전화기를 눌러 받아 보세요";
    }

    function maybeRing() {
      if (S.phone.open || S.phone.ringing) return;
      // 안내 통화 때문에 미뤄 둔 위기가 있으면 그것부터 건다 (계약 7항 · 평생 1회).
      if (S.loanCrisisPending) {
        const reason = S.loanCrisisPending;
        S.loanCrisisPending = null;
        if (maybeOfferLoan(reason)) return;
      }
      // 2026-08-27 유리 A 승인 — 유리가 처음 깨진 자리에서 딱 한 통 걸려 온다.
      // 안내 전용이라 고를 것이 없고, 통화가 끝나도 균열은 그대로 남는다
      // (다음 유리창 작업을 시작할 때만 새 유리로 갈린다).
      if (S.glassBreakCallPending && !S.phone.done.glassBreak) {
        S.glassBreakCallPending = false;
        ring("glassBreak");
        return;
      }
      // 첫 미완성 판매 전에는 업그레이드를 알리는 전화가 없다 (라운드 003 승인).
      // 2026-08-15 A 확정: 첫 도화지 전화는 「유리창 레벨 1 진입」과 「실제 잔고 100원」을
      // 둘 다 채워야 울린다. 돈만 100원을 넘겨도 레벨 0 구간에서는 울리지 않는다.
      if (!S.phone.done.paper && windowLevel() >= 1 && S.money >= paperClickCost()) ring("paper");
    }

    function answerPhone() {
      if (!S.started || S.paused || !S.phone.ringing) return false;
      S.phone.open = true;
      S.phone.script = S.phone.ringing;
      S.phone.ringing = null;
      S.phone.page = 0;
      S.paused = true; // 게임 시계 정지 — 타이머·자동 진행·입력 전부 멈춤
      pushEvent("phoneOpen");
      return true;
    }

    function phonePages() {
      return S.phone.script ? State.PHONE_SCRIPTS[S.phone.script].pages : [];
    }

    // 지금 통화가 「마지막 장에서 선택을 기다리는」 대본인가 (대출 권유).
    function phoneChoiceOpen() {
      const script = S.phone.script && State.PHONE_SCRIPTS[S.phone.script];
      return !!(S.phone.open && script && script.choice
        && S.phone.page >= script.pages.length - 1);
    }

    function advancePhone() {
      if (!S.phone.open) return false;
      if (S.phone.page < phonePages().length - 1) {
        S.phone.page += 1;
        return true;
      }
      // 선택형 대본은 마지막 장에서 저절로 끊기지 않는다 —
      // 수락/거절 중 하나를 실제로 눌러야 통화가 끝난다.
      if (phoneChoiceOpen()) return false;
      return closePhone();
    }

    function prevPhone() {
      if (!S.phone.open || S.phone.page === 0) return false;
      S.phone.page -= 1;
      return true;
    }

    function closePhone() {
      if (!S.phone.open) return false;
      const script = S.phone.script;
      S.phone.open = false;
      S.phone.script = null;
      S.paused = false; // 시계가 다시 흐른다 — 예약된 교체·연출 그대로 재개
      if (script === "paper" && !S.phone.done.paper) {
        S.phone.done.paper = true;
        S.unlocked.paper = true; // 한 장 제작 해금 (v9: 왼쪽 원작 카탈로그가 열린다)
        pushEvent("paperUnlocked");
        S.lastEvent = "원작 카탈로그가 열렸습니다 — 뮤나리자 카드를 누르면 바로 한 장 그립니다";
      } else if (script === "glassBreak") {
        // 2026-08-27 유리 A 승인 — 첫 파손 안내는 딱 한 번이다. 균열은 그대로 남는다.
        S.phone.done.glassBreak = true;
        S.lastEvent = "유리창은 살살 — 다음 한 장을 시작하면 깨진 자리가 새 유리로 갈립니다";
      } else if (script === "ink" && !S.phone.done.ink) {
        S.phone.done.ink = true;
        refreshShop(); // 상점 + 첫 업그레이드「잉크통 크기」해금
        S.lastEvent = "상점 탭이 열렸습니다 — 잉크통을 키우면 한 장을 끝까지 찍고, 다음 한 장은 무료예요";
      } else if (script === "loan") {
        // 수락·거절이 각자 자기 문구를 이미 써 두었다. 여기서 덮어쓰지 않는다.
        // 둘 다 플래그를 먼저 세우고 이 함수를 부르므로 아래 판정에 걸리지 않는다.
        //
        // 2026-08-26 5차 독립 검토 대응: 수락도 거절도 하지 않은 채 통화만 끊긴 경우는
        // 불러오기 교착(README 15번)과 정확히 같은 자리다 — offered:true 때문에 위기
        // 전화가 다시 열리지 않아 회복 수단이 사라진다. 아직 살아 있는 제안이면 그
        // 한 통을 다시 건다. 제안은 여전히 한 번뿐이고 원금도 한 번뿐이다.
        if (loanOfferCallPending()) {
          ring("loan");
          pushEvent("loanOfferRestored", { source: "hangup" });
        }
      } else if (script === "loanSigned") {
        // 2026-08-27 v1 · 대출 A — 재전화를 끊으면 그 자리를 한 줄로 다시 짚어 준다.
        S.lastEvent = "계약서는 오른쪽 위에 접어 두었습니다 — 눌러 갚을 돈을 확인하세요"; // v8: 이자만
      } else {
        S.lastEvent = "통화 종료 — 하던 일이 그대로 이어집니다";
      }
      pushEvent("phoneClose");
      maybeRing();
      return true;
    }

    // ══ 카탈로그 — 흰 도화지가 놓인 뒤 떨어진다 → 클릭 → 슬롯 편입 ══
    function dropCatalog() {
      if (S.catalog !== "none") return;
      S.catalog = "falling";
      pushEvent("catalogFall");
      schedule(C.CATALOG_FALL_MS, function () {
        if (S.catalog === "falling") {
          S.catalog = "landed"; // 반드시 플레이어가 클릭해야 다음으로 간다
          pushEvent("catalogLanded");
          S.lastEvent = "작업대에 카탈로그가 떨어졌습니다 — 눌러 보세요";
        }
      });
    }

    function clickCatalog() {
      if (!canInteract() || S.catalog !== "landed") return false;
      S.catalog = "unlocking";
      pushEvent("unlockFlash"); // 황금빛 「카탈로그 해금」 연출
      schedule(C.CATALOG_UNLOCK_MS, function () {
        if (S.catalog !== "unlocking") return;
        S.catalog = "docking"; // 좌상단 원작 슬롯으로 이동·축소
        pushEvent("catalogDock");
        schedule(C.CATALOG_DOCK_MS, function () {
          if (S.catalog !== "docking") return;
          S.catalog = "docked";
          S.unlocked.catalog = true; // 그 뒤에만 원작 선택 가능
          pushEvent("catalogDocked");
          S.lastEvent = "카탈로그가 원작 자리에 걸렸습니다 — 이제 원작을 고르세요";
        });
      });
      return true;
    }

    // ══ 도화지 → 흰 도화지 → 원작 선택 → 인쇄 (2026-08-06 확정 순서) ══
    // 클릭 한 번 = 도화지 딱 한 장. 빈 칸 하나에 놓이고 100원만 빠진다.
    // 첫 손실 학습을 끝낸 뒤에는 빈 칸과 돈이 남아 있으면 버튼을 다시 눌러 두 번째 장을
    // 살 수 있고, 두 칸이어도 한 장만 사서 만들고 처리해도 된다 (라운드 005).
    function buyPaper(byAuto) {
      if (!canInteract() || !S.unlocked.paper) return false;
      if (lossPending()) return false; // 손실 결과를 확인하기 전에는 다음 장으로 넘어가지 않는다
      // 첫 손실 학습이 끝날 때까지는 도화지가 한 장뿐이다 (2026-08-15 동현 확정).
      // 미완성 70원 직접 판매까지가 그 한 장으로 배우는 구간이므로, 빈 칸이나 돈이
      // 남아 있어도 두 번째 장은 놓이지 않는다 (A 계약 2.2).
      if (!S.firstSaleDone && S.works.length) return false;
      // 첫 손실 학습 뒤에는 잉크통 1단계를 먼저 사야 다음 도화지로 넘어간다.
      // 첫 작품 구매는 허용해야 하므로 첫 판매가 끝난 뒤부터만 이 선형 해금 문을 건다.
      if (S.firstSaleDone && S.upgrades.inkTank < 1) return false;
      if (S.resultsOpen) return false; // 결과를 처리하기 전에는 새 장을 놓지 않는다
      if (printingInProgress()) return false; // 이미 밀고 있는 묶음에는 끼워 넣지 않는다
      if (batchStarted()) return false; // 순차 제작으로 한 점을 이미 마감한 묶음도 마찬가지다
      if (!hasEmptySlot()) return false; // 빈 칸이 없으면 더 살 수 없다
      // ── 잉크가 모자라면 다음 장을 아예 놓지 않는다 (2026-08-19 확정) ──
      // 재현이형 의견함: 「작업대를 2개 이상 쓰면 잉크도 두 배로 써야 함」.
      // 이 문이 없으면 두 장을 놓고도 잉크가 한 장분뿐이라, 1번만 완성되고 2번은
      // 손도 못 댄 채 결과판이 열리지 않아 아무 것도 누를 수 없는 교착이 됐다
      // (2026-08-19 실제 재현). 첫 장은 언제나 허용한다 — 잉크 절반으로 미완성을
      // 배우는 라운드 001의 첫 손실 학습이 그 한 장으로 이뤄지기 때문이다.
      if (S.works.length > 0 && !inkEnoughForAnotherSheet()) {
        S.lastEvent = "잉크가 " + paperInkShortPercent() + "% 모자랍니다 — "
          + "상점에서 잉크통을 먼저 키우면 도화지를 한 장 더 놓을 수 있습니다";
        return false;
      }
      const size = paperSize();
      // 2026-10-20 v9 · 6-A: 첫 잉크통 선물이 남아 있으면 이번 한 장은 참가비 0$(한 판에 한 번).
      const free = S.freeSheet === "ready";
      const cost = free ? 0 : paperClickCost();
      if (S.money < cost) {
        // 지갑이 완전히 빈 채로 막혔다면 그것이 계약 7항의 두 번째 위기다.
        blockedByNoMoney("buyPaper");
        return false;
      }
      // 공통 교착 방지 계약 — 도화지도 같은 문을 지난다. 다만 사는 그 순간 「팔아서
      // 회복할 작품」한 점이 함께 생기므로(미완성이어도 정액가로 팔린다) 교착이
      // 아니고, 그래서 실제로 막히지 않는다 (2026-08-26 동현 확정).
      if (blockDeadlockPurchase(size.label, cost, true)) return false;
      if (inkCapacity() <= 0) return false; // 빈 통으로는 아예 시작할 수 없다
      // 잉크통이 완성 필요량보다 작아도 구매 자체는 막지 않는다 (라운드 003 승인).
      // 첫 학습 작품에서는 모자란 잉크가 인쇄 도중에 실제로 바닥나고 그 작품은 미완성으로
      // 남는다. 그 뒤로는 다음 입력 비용을 못 채우는 순간 입력 전에 전체가 막힌다.
      S.money -= cost;
      if (free) {
        S.freeSheet = "used";
        pushEvent("freeSheetUsed", { original: S.currentOriginalKey });
      }
      const slot = S.works.length;
      S.artworksStarted += 1;
      // 자동화 해금은 「손으로 몇 장 샀는가」만 센다 (자동으로 산 것은 빼고).
      if (!byAuto) S.papersBoughtByHand += 1;
      const work = makeWork(slot, rollRoundPlan());
      // 2026-10-20 v9 · 6-A: 이 장에 실제로 낸 돈(무료 한 장이면 0)을 적는다 — 옛 원작 바꾸기 길의 차액 정산이
      // 정가가 아니라 실제 낸 돈을 기준으로 해야 「무료로 받은 참가비」가 현금으로 환불되지 않는다(아스트라 리뷰).
      work.materialCost = cost;
      S.works.push(work);
      S.hasPaper = true;
      S.mode = "print";
      S.saleFeedback = "";
      S.resultsOpen = false;
      // 잉크통은 도화지를 놓을 때 한 통 가득 찬다 (시험 규칙).
      // 잉크는 지나간 줄 기준으로만 줄어든다 — 실제로 진행한 작품 수만큼 함께 빠진다.
      S.ink.capacity = inkCapacity();
      S.ink.cells = S.ink.capacity;
      pushEvent("paperBought", {
        cells: S.ink.cells, need: requiredCells(), slot: slot, sheets: S.works.length,
      });
      if (S.currentOriginalKey) {
        S.awaitingOriginal = false;
        ensurePrint();
        S.lastEvent = "도화지 구매 −" + cost + "$ — 흰 도화지가 "
          + S.works.length + "장 놓였습니다";
      } else {
        // 흰 도화지가 먼저 놓이고, 그 다음에 원작을 고른다.
        S.print = null;
        S.awaitingOriginal = true;
        S.lastEvent = "도화지 구매 −" + cost + "$ — 완전한 흰 종이가 가운데 놓였습니다";
        dropCatalog(); // 첫 도화지에서만 카탈로그가 떨어진다
      }
      return true;
    }

    // ══ 2026-10-20 v9 · 한 장 제작 (그릴미 기둥 2-1 · 시안 2판 · 형님 11-A · 14-A) ══════════
    // 왼쪽 「원작 카탈로그」의 가진 원작 카드를 누르면 그 원작 참가비(5 × 급 배율)를 내고 바로 그리기 시작한다.
    // 옛 두 단계(도화지 구매 → 카탈로그에서 원작 고르기)를 한 번의 클릭으로 묶은 것이다. 참가비 · 잉크 채우기 ·
    // 등급 계획 · 첫 그림 학습 규칙 · 교착 방지 · 6-A 무료 한 장은 아래 buyPaper 한 길을 그대로 지난다.
    // 작업대는 한 대라, 그리는 동안(판매 전)에는 다른 카드를 누를 수 없다(14-A — 「다음 작품 예약」 없음).
    function sheetBusy() { return !!(S.hasPaper || S.works.length || S.resultsOpen); }
    function makeSheet(key, byAuto) {
      if (!canInteract() || !S.unlocked.paper) return false;
      if (!Art.originalByKey(key) || !ownsOriginal(key)) return false;
      if (sheetBusy() || lossPending()) return false;
      const prevKey = S.currentOriginalKey;
      S.currentOriginalKey = key;
      S.nextOriginalKey = null;
      const paid = S.freeSheet === "ready" ? 0 : paperClickCost();
      if (!buyPaper(byAuto)) {
        S.currentOriginalKey = prevKey; // 못 샀으면 고른 원작도 그대로 둔다
        return false;
      }
      S.works[S.works.length - 1].fixedOriginal = true; // 다 팔 때까지 원작을 바꾸지 않는다(14-A)
      const art = Art.originalByKey(key);
      pushEvent("sheetStarted", { original: key, fee: paid, auto: !!byAuto });
      S.lastEvent = "「" + art.label + "」 한 장 제작 "
        + (paid > 0 ? "−" + paid.toLocaleString("ko-KR") + "$" : "— 첫 잉크통 선물로 참가비 무료")
        + " — 휠을 아래로 굴려 한 색씩 찍으세요";
      return true;
    }

    // 세 회차의 추첨 계획을 도화지를 살 때 미리 세운다(클로드판 startPicture와 같은 방식).
    // 회차마다 독립이고, 최종 확률은 8/27 값 그대로가 되게 State.roundProbs가 역산해 둔다.
    function rollRoundPlan() {
      // 디버그로 등급을 못박아 두면 「최종 확보 등급」만 그 값이 되고, 몇 번째 회차에 닿는지는
      // 자연 가중치대로 다양하다(클로드판 forcedPath — 첫 회차 강제 출현 없음).
      // 다이아는 확률이 아주 낮아 이 손잡이가 없으면 축하 연출을 보기 어렵다.
      // v9: 회차 수 = 지금 원작을 직접 미는 횟수(한 번에 한 색 — 3 · 3 · 4 · 4 · 5 · 5).
      // 계획은 늘 지금 고른 원작(S.currentOriginalKey)을 위해 뽑는다 — 남아 있는 옛 인쇄 상태의 횟수(manualNow)를 쓰면
      // 인쇄 전에 원작을 바꿨을 때 3번 미는 그림에 5회 계획이 남는다(아스트라 리뷰).
      const rounds = State.manualStrokesFor(S.currentOriginalKey || "mewna-lisa");
      const forced = Math.round(Number(S.debug.values.forceGrade));
      if (forced >= 0 && forced < ECON.grades.length) {
        const path = Grade.forcedPath(null, rounds, forced, rng);
        return path.length ? path : [forced];
      }
      // 첫 작품만 학습용 브론즈 고정 — 모든 회차 브론즈. 두 번째부터 실제 추첨.
      // (유지 여부는 정본 §5-4에서 「미정」이라 현행을 그대로 둔다.)
      if (S.artworksStarted <= 1) return new Array(rounds).fill(0);
      const plan = [];
      for (let i = 0; i < rounds; i += 1) {
        const draw = State.drawRoundGrade(rng, S.upgrades.inkQuality, S.currentOriginalKey || "mewna-lisa"); // v5: 원작별 확률 단계
        plan.push(draw);
        if (draw === ECON.grades.length - 1) break; // 다이아 — 남은 회차는 생략되므로 뽑지 않는다
      }
      return plan;
    }

    function startArtwork(preservedPlan) {
      const original = Art.originalByKey(S.currentOriginalKey);
      if (!original) return;
      const groups = PLATE_GROUPS[S.currentOriginalKey] || PLATE_GROUPS["mewna-lisa"];
      const plates = groups.map(function () { return []; });
      const lastPlate = groups.length - 1; // 마지막 색판 = 자동 마감(잉크 0)
      const manual = lastPlate; // v9: 직접 미는 횟수 = 색 − 1
      original.art.forEach(function (row, y) {
        for (let x = 0; x < C.ART; x += 1) {
          const ch = row[x];
          for (let k = 0; k < groups.length; k += 1) {
            if (groups[k].indexOf(ch) >= 0) {
              plates[k].push([x, y]);
              break;
            }
          }
        }
      });
      const plan = preservedPlan != null ? normalizePlan(preservedPlan) : rollRoundPlan();
      // target = 이 계획을 끝까지 돌았을 때의 최고 등급. 엔진 안쪽(마감 방식·판매가)만 쓰고
      // 화면은 회차가 끝날 때 드러나는 best만 본다.
      const target = planFinalGrade(plan);
      S.print = {
        originalKey: S.currentOriginalKey,
        artRows: original.art,
        colors: original.colors,
        plates: plates,
        manual: manual, // v9 — 이 그림을 직접 미는 횟수(인쇄 점 수 · 회차 수)
        plateNames: original.plateNames || [], // v9 — 색판 이름(기록 줄 「다음 공정」)
        phase: "ready", // ready → auto → (keep: 즉시 | promote: dpause → doutline → dhold) → freeze → reveal
        pos: 0,
        paintedTo: 0,
        stroke: 0,
        curPlate: 0,
        plateProg: plates.map(function () { return 0; }),
        rowT: new Array(C.ART).fill(-1e9),
        lastRowT: -1e9, // 한 칸 민 직후 그림 흔들림 기준 시각 (V6 시안 D)
        snapped: false,
        snapT: -1e9,
        budget: 2,
        budgetClock: S.clock,
        targetGradeIndex: target,
        startGradeIndex: target,
        promote: target > 0, // 최종 확보 등급이 브론즈 초과 = 순차 마감 가지
        signaled: false, // (8/27의 절반 지점 미래 등급 광택은 두 방 데모 A에서 없앴다 — 항상 false)
        roundPlan: plan, // 세 회차 추첨 계획 — 회차가 끝나기 전에는 화면에 내보내지 않는다
        best: null, // 지금까지 확보한 최고 등급 (null = 아직 한 회차도 안 끝남)
        draws: [], // 끝난 회차의 실제 추첨 결과 (끝난 순서)
        finishQueue: [], // 다이아 조기 종료 때 건너뛴 색판 + 마지막 색을 차례로 자동으로 찍을 목록
        outlinePlate: lastPlate, // 지금 자동으로 찍고 있는 판 (v9: 마지막 색판 = 자동 마감)
        outlineStart: -1,
        autoNextAt: -1,
        branch: null, // "keep" | "promote" — 결과별 자동 마감 표식
        baseRows: 0, // 기본 인쇄로 지금까지 지나간 칸 수 (남은 잉크 계산용)
        inkOut: false, // 잉크가 도중에 바닥나 미완성이 된 상태
        inkOutStroke: 0, // 몇 번째 밀대 진행 도중에 바닥났는가 (1회차부터 셈)
        inkOutRow: -1, // 바닥난 줄 (그 줄부터 마른 점만 남는다 — v7 치약 쥐어짜기)
        // 2026-08-25 계약 1 — 색판별로 「잉크 없이 마른 날만 지나간 줄」 표식.
        // v6까지는 이 줄을 세로 마찰 띠로 그렸고, v7(형님 46-B)부터는 원작 자리에 12% 마른 점으로 남긴다(아래 dens).
        dry: plates.map(function () { return []; }),
        dryRows: 0, // 마른 자국으로 남은 줄 수 (빈 면적의 크기)
        // 2026-10-16 v7(형님 46-B): 색판별 · 줄별로 「찍힐 때 남은 칸 비율」(1 = 온전히, 1보다 작으면 칸이 군데군데 빠짐).
        // 화면은 이 값과 State.inkSqueezeKeepCell로 칸을 고른다 — 8/24 치약 쥐어짜기.
        dens: plates.map(function () { return []; }),
        extraPass: false, // 지금 밀고 있는 것이 추가 인쇄인가 (이번 판에서는 잠김)
        extraProg: 0,
        extraRuns: 0,
        awaitingExtra: false, // 발표 뒤 선택 대기 (이번 판에서는 쓰이지 않는다)
        // 이 인쇄 상태의 주인 작업대 번호 (2026-08-26 동현 확정 · 계약 5항).
        // -1은 「아직 아무 작업대도 콕 집지 않았다」이고, 포인터·키로 한 대를 집는
        // 순간 그 번호가 박혀 이후 자동 마감까지 그 한 대만 진행시킨다.
        soloBench: -1,
      };
    }

    function printWheel(deltaY) {
      if (!canInteract() || !S.hasPaper) return false;
      const P = S.print;
      if (!P || P.phase !== "ready" || deltaY <= 0) return false;
      // 「입력 전 차단」은 한 번의 밀기 시작점에서만 판정한다. 이미 밀대를 내리기
      // 시작했다면 그 입력의 남은 줄은 끝까지 처리해 중간에 얼어붙지 않게 한다.
      if (P.pos <= 0 && P.paintedTo <= 0 && inkBlocked()) return false;
      const cap = printMaxRowsPerSec(); // 인쇄 = 인쇄 스퀴지 단계만 반영
      P.budget = Math.min(cap / 3, P.budget + ((S.clock - P.budgetClock) / 1000) * cap);
      P.budgetClock = S.clock;
      const mag = Math.min((deltaY / C.NOTCH_PX) * printRowsPerNotch(), P.budget);
      if (mag <= 0) return false;
      P.budget -= mag;
      printApplyMove(mag);
      return true;
    }

    function printKey() {
      if (!canInteract() || !S.print || S.print.phase !== "ready") return false;
      if (inkBlocked()) return false; // 입력 전 전체 차단 — 진행 0 · 차감 0
      printApplyMove(C.KEY_ROWS * printRowsPerNotch());
      return true;
    }

    function printApplyMove(m) {
      const P = S.print;
      if (!P) return;
      P.pos = Math.max(0, Math.min(C.ART, P.pos + m));
      if (P.pos > P.paintedTo) printPaintTo(P.pos);
      if (P.phase === "ready" && P.pos >= C.ART) finishDownstroke();
    }

    function printPaintTo(p) {
      const P = S.print;
      p = Math.min(C.ART, p);
      if (p <= P.paintedTo) return;
      const from = Math.floor(P.paintedTo);
      const to = Math.floor(p);
      P.paintedTo = p;
      for (let r = from; r < to; r += 1) {
        printRowCrossed(r);
        if (P.phase !== "ready" && P.phase !== "auto") return;
      }
    }

    // 잉크가 도중에 바닥난 순간 (2026-08-25 회의 전 추천안 · 계약 1로 갱신).
    //
    // 옛 규칙(①  즉시 멈춤)은 폐기됐다: 밀대가 그 줄에서 얼어붙고 곧바로 결과판이 열렸다.
    // 새 규칙은 참고판 ink-shortage-mock / inkfx-sequence-compare의 「② 모자람」이다 —
    // 잉크가 있는 구간은 정상 인쇄하고, 모자란 구간은 흐름을 끊지 않고 도화지 끝까지 밀되
    // 그 자리는 마른 자국만 남아 미완성이 된다(v7부터 마른 자국 = 원작 자리의 12% 마른 점).
    // 그래서 여기서는 「바닥났다」는 사실만 기록하고 phase를 얼리지 않는다.
    // 실제 마감(결과판 열기)은 그 회차를 끝까지 민 뒤 finishDownstroke가 한다.
    function inkOutAt(row) {
      const P = S.print;
      if (!P || P.inkOut) return;
      P.inkOut = true;
      P.inkOutStroke = P.stroke + 1; // 지금 밀던 회차 (1회차부터)
      P.inkOutRow = row;
      pushEvent("inkOut", { row: row, stroke: P.inkOutStroke });
      S.lastEvent = "잉크가 모자랍니다 — 밀대 진행 " + P.inkOutStroke + "/"
        + P.manual + "부터 마른 자국만 남습니다";
      // 이번 입력이 함께 밀고 있던 도화지들이 미완성이 된다.
      // (순차 제작에서 이미 마감한 작품은 그대로 완성 상태로 남고, 아직 한 번도 밀지 않은
      //  다음 작업대의 도화지는 진행 0·미완성 아님으로 남아 다음 순차 제작 대상이 된다.
      //  동시 제작은 진행 작품 전부가 이번 입력에 들어 있으므로 동작이 같다.)
      progressSlots().forEach(function (i) {
        const w = S.works[i];
        if (w && !w.done) w.incomplete = true;
      });
    }

    // 2026-10-16 v7(형님 46-B · 48번): 잉크 부족 「치약 쥐어짜기」 — 한 줄을 찍은 직후의 남은 칸 비율.
    // 이 그림이 끝나기 전에 잉크가 바닥날 때만(SQUEEZE_ONLY_WHEN_RUNNING_OUT) 남은 잉크가 한 장 필요량의
    // 10% 아래로 내려간 줄부터 칸이 빠진다. 잉크가 딱 맞게 남아 완성되는 그림, 다음 밀기 전에 막혀 잉크를
    // 채운 뒤 이어 찍는 그림에는 구멍을 남기지 않는다 — 다 찍고 나서도 구멍이 남아 흠난 완성작이 되지 않게.
    // 끝까지 남은 줄 수 = 이번 회차의 남은 줄 + 남은 손 회차 × 16줄 (윤곽 자동 마감은 잉크를 쓰지 않는다).
    function squeezeDensityForRow(row, perRow) {
      const P = S.print;
      if (SQUEEZE_ONLY_WHEN_RUNNING_OUT) {
        // 다이아가 계획된 회차에서 손 회차가 일찍 끝난다(settlePrintRound의 earlyStop) — 그 뒤 회차는 셈에 넣지 않는다.
        const plan = P.roundPlan || [];
        const topAt = plan.indexOf(ECON.grades.length - 1);
        const strokesPlanned = topAt >= 0 ? Math.min(P.manual, topAt + 1) : P.manual;
        const rowsLeft = (C.ART - (row + 1)) + Math.max(0, strokesPlanned - P.stroke - 1) * C.ART;
        if (!partialInkAllowed() || S.ink.cells >= rowsLeft * perRow) return 1;
      }
      return State.inkSqueezeDensity(S.ink.cells, requiredCellsNow());
    }

    // 모자란 채 한 회차를 끝까지 민 뒤 — 그 자리에서 미완성으로 남긴다.
    // 2026-08-12 계약 2·3은 그대로다: 별도 설명판이나 「지금 결과 보기」 중간 상자 없이
    // 곧바로 미완성 결과판이 열리고, 정액 판매는 플레이어가 결과판에서 직접 누른다.
    function finishStarvedPrint() {
      const P = S.print;
      P.phase = "inkout";
      P.autoNextAt = -1;
      openResults();
    }

    function printRowCrossed(r) {
      const P = S.print;
      // 잉크 소모 — 한 줄(=한 칸)을 지날 때마다 잉크통에서 빠진다.
      // 순차 제작은 한 줄에 1칸, 동시 제작은 진행 작품 수만큼 함께 빠진다.
      // 그래서 같은 묶음을 끝냈을 때 순차와 동시의 총 잉크는 같고 입력 횟수만 다르다.
      const perRow = inkPerRow();
      // 2026-08-25 계약 1: 모자라도 멈추지 않는다. 이 줄은 「마른 날만 지나간 줄」이 된다.
      const dryRow = S.ink.cells < perRow;
      if (dryRow) inkOutAt(r);
      else S.ink.cells -= perRow;
      P.rowT[r] = S.clock;
      P.lastRowT = S.clock; // 그림이 한 번 눌리듯 흔들린다 (V6 시안 D)

      if (dryRow) {
        // 마른 줄도 밀대는 지나간다 — 색판 진행은 올리되 찍힌 칸으로 세지 않는다.
        const dk = P.extraPass ? P.plates.length - 1 : P.curPlate;
        if (P.extraPass) {
          if (P.extraProg < r + 1) P.extraProg = r + 1;
        } else if (P.plateProg[dk] < r + 1) {
          P.plateProg[dk] = r + 1;
        }
        if (!P.dry[dk][r]) {
          P.dry[dk][r] = true;
          P.dryRows += 1;
        }
        // v7: 마른 줄은 원작 자리에 12%만 마른 점으로 남는다 (8/24 치약 쥐어짜기)
        if (P.dens) P.dens[dk][r] = State.INK_SQUEEZE.dryDensity;
        // 13줄(80%)부터는 정상 인쇄와 똑같이 남은 줄을 자동으로 마무리한다 —
        // 잉크가 없다고 해서 밀대의 리듬이 달라지지 않는다.
        if (r === C.AUTO_ROWS - 1 && r + 1 < C.ART && P.phase === "ready") {
          P.phase = "auto";
          P.autoNextAt = S.clock + printAutoRowMs();
        }
        return;
      }

      if (P.extraPass) {
        // 추가 인쇄 — 이미 다 찍힌 그림 위에 한 번 더 내린다.
        if (P.extraProg >= r + 1) return;
        P.extraProg = r + 1;
        pushEvent("printRow", { row: r });
        if (r === C.AUTO_ROWS - 1 && P.extraProg < C.ART && P.phase === "ready") {
          P.phase = "auto";
          P.autoNextAt = S.clock + printAutoRowMs();
        }
        return;
      }

      const k = P.curPlate;
      if (P.plateProg[k] >= r + 1) return;
      P.plateProg[k] = r + 1;
      P.baseRows += 1;
      if (P.dens) P.dens[k][r] = squeezeDensityForRow(r, perRow);
      pushEvent("printRow", { row: r }); // 줄 단위 "착" 판정음
      // (8/27의 「진행 절반에서 미래 등급색 광택」은 두 방 데모 A에서 없앴다 — 회차가 끝나기 전에
      //  다음 결과를 드러내지 않는다. 테두리 반응은 회차 완료 때 settlePrintRound 한 곳에서만.)
      // 13줄(80%)에서 이번 밀기의 남은 줄을 자동 마무리
      if (r === C.AUTO_ROWS - 1 && P.plateProg[k] < C.ART && P.phase === "ready") {
        P.phase = "auto";
        P.autoNextAt = S.clock + printAutoRowMs();
      }
    }

    function tickPrintAuto() {
      const P = S.print;
      if (!P) return;
      if (P.phase === "auto") {
        while (P.phase === "auto" && S.clock >= P.autoNextAt) {
          printPaintTo(Math.floor(P.paintedTo) + 1);
          P.pos = Math.max(P.pos, P.paintedTo);
          P.autoNextAt += printAutoRowMs();
          if (P.paintedTo >= C.ART && P.phase === "auto") {
            P.phase = "ready";
            finishDownstroke();
          }
        }
      }
      if (P.phase === "doutline") stepOutline();
    }

    function finishDownstroke() {
      const P = S.print;
      P.stroke += 1;
      syncWorkStrokes(); // 이번 입력이 실제로 민 작품들만 같은 인쇄 단계가 된다
      if (P.extraPass) {
        resolveExtraPrint();
        return;
      }
      // 2026-08-25 계약 1: 모자란 채 한 회차를 도화지 끝까지 밀었다 —
      // 흐름을 끊지 않고 완주했으니 이제 그 상태 그대로 미완성으로 남긴다.
      // (윤곽·색판 자동 마감은 하지 않는다 — 완성이 아니기 때문이다.)
      if (P.inkOut) {
        finishStarvedPrint();
        return;
      }
      // 2026-10-06 두 방 데모 A — 이번 회차의 등급을 지금 드러낸다.
      const settled = settlePrintRound();
      if (settled.earlyStop || P.curPlate >= P.manual - 1) {
        startResultFinish();
        return;
      }
      P.curPlate += 1;
      P.pos = 0;
      P.paintedTo = 0;
      pushEvent("printReturn"); // 밀대가 맨 위로 돌아오는 "칙"
      // v9: 다음 공정 = 칠하는 순서의 다음 색(art.js plateNames)
      S.lastEvent = "밀대 진행 " + P.stroke + "/" + P.manual
        + " 완료 — 다음 색 「" + (P.plateNames[P.curPlate] || STAGE_NAMES[Math.min(3, P.curPlate)]) + "」 자동 장전";
    }

    // 한 회차가 끝났다 — 계획해 둔 이번 회차의 추첨값을 확정하고 최고 기록을 갱신한다.
    // 낮거나 같은 결과로는 내려가지 않는다(9/2 「등급 상승만 · 앞 결과 보장」).
    // 다이아가 나오면 earlyStop이 참이라 남은 수동 회차를 생략한다(클로드판 grade-logic).
    function settlePrintRound() {
      const P = S.print;
      const planned = P.roundPlan[P.draws.length];
      const st = Grade.settleRound(P.best, Number.isInteger(planned) ? planned : 0);
      P.draws.push(st.draw);
      P.best = st.bestAfter;
      pushEvent("roundSettled", {
        round: P.draws.length,
        grade: ECON.grades[st.draw].key,
        improved: st.improved,
        best: ECON.grades[P.best].key,
        earlyStop: st.earlyStop,
      });
      // 첫 확보와 최고 기록 상승에만 — 테두리 깜빡 + 확률표 그 줄 반응 (클로드판 recordImprove)
      if (st.improved) {
        pushEvent("gradeImproved", { grade: ECON.grades[P.best].key, first: P.draws.length === 1 });
      }
      return st;
    }

    // V6 시안 D: 결과별 자동 마감 — 유지는 즉시, 상승은 순차 연출.
    // 두 방 데모 A: 「유지/상승」은 최종 확보 등급으로 정한다(브론즈 = 즉시, 실버 이상 = 순차).
    // 2026-10-20 v9(시안 2판 · 형님 13-A): 자동 마감은 등급과 상관없이 늘 짧은 애니메이션이다 —
    // 0.2초 멈춤 → 마지막 한 색이 0.5초 동안 위에서 아래로 → 착 맞춤 → 잠깐 유지 → 발표.
    // 「유지/상승」 표식(branch)은 그대로 남겨 발표 광택 · 팡파르(상승일 때만)를 가른다.
    // 다이아로 일찍 끝나 건너뛴 색판이 있으면 마지막 색 전에 차례로 자동으로 찍는다(잉크 0).
    function startResultFinish() {
      const P = S.print;
      // v7 안전망(48-B): 미완성 없이 마감되는 그림에는 치약 구멍을 남기지 않는다.
      // 인쇄 도중 잉크통을 사서 채워 끝까지 찍은 경우처럼, 줄을 찍을 때는 바닥날 줄 알았던 그림도 여기서 메운다.
      if (P.dens && SQUEEZE_ONLY_WHEN_RUNNING_OUT) P.dens = P.plates.map(function () { return []; });
      const lastPlate = P.plates.length - 1;
      P.branch = P.promote ? "promote" : "keep";
      P.phase = "dpause"; // 잠깐 멈춘 뒤 마지막 색이 위에서 아래로 찍힌다
      P.finishQueue = [];
      for (let k = P.curPlate + 1; k < P.manual; k += 1) P.finishQueue.push(k);
      P.finishQueue.push(lastPlate);
      S.lastEvent = "밀대 진행 " + P.stroke + "/" + P.manual
        + " 완료 — 마지막 색 「" + (P.plateNames[lastPlate] || "마감") + "」 자동 마감";
      schedule(C.PROMOTE_PAUSE_MS, function () {
        if (S.print !== P) return;
        P.phase = "doutline";
        P.outlinePlate = P.finishQueue.length ? P.finishQueue.shift() : lastPlate;
        P.curPlate = Math.min(P.manual - 1, P.outlinePlate);
        P.outlineStart = S.clock;
      });
    }

    function stepOutline() {
      const P = S.print;
      const lastPlate = P.plates.length - 1;
      const k = Number.isInteger(P.outlinePlate) ? P.outlinePlate : lastPlate;
      const ratio = Math.min(1, (S.clock - P.outlineStart) / C.OUTLINE_MS);
      const nextRows = Math.min(C.ART, Math.floor(ratio * C.ART));
      for (let r = P.plateProg[k]; r < nextRows; r += 1) {
        P.rowT[r] = S.clock;
        pushEvent(k === lastPlate ? "outlineRow" : "autoPlateRow", { row: r, plate: k });
      }
      P.plateProg[k] = nextRows;
      if (ratio >= 1 && P.finishQueue && P.finishQueue.length) {
        // 건너뛴 색판 하나를 다 찍었다 — 다음 판(마지막은 언제나 마지막 색)으로
        P.outlinePlate = P.finishQueue.shift();
        P.curPlate = Math.min(P.manual - 1, P.outlinePlate);
        P.outlineStart = S.clock;
        return;
      }
      if (ratio >= 1) {
        P.snapped = true;
        P.snapT = S.clock;
        pushEvent("snap");
        P.phase = "dhold"; // 착 맞은 그림을 잠시 보여준 뒤 발표
        schedule(C.HOLD_MS, function () {
          if (S.print !== P) return;
          onPrintComplete();
        });
      }
    }

    function onPrintComplete() {
      const P = S.print;
      if (P.promote && P.targetGradeIndex >= 3) {
        // 플래티넘 이상 — 멈칫했다가 불꽃이 터진다
        P.phase = "freeze";
        schedule(C.FREEZE_MS, function () {
          if (S.print !== P) return;
          pushEvent("burst", { grade: ECON.grades[P.targetGradeIndex].key });
          printReveal();
        });
        return;
      }
      printReveal();
    }

    function printReveal() {
      const P = S.print;
      P.phase = "reveal";
      const g = ECON.grades[P.targetGradeIndex];
      pushEvent("reveal", { grade: g.key, promote: P.promote, jackpot: P.promote && P.targetGradeIndex >= 3 });
      if (P.promote) {
        // 등급 상승 시에만 테두리 광택·팡파르 (유지 결과는 조용히 끝난다)
        pushEvent("revealGlow", { grade: g.key, diamond: g.key === "diamond" });
        pushEvent("fanfare", { top: P.targetGradeIndex >= 3 });
      }
      // 잉크가 남아 있을 때의 「한 번 더」 선택지는 이번 대표 흐름에서 잠겨 있다.
      if (canOfferExtra()) {
        P.awaitingExtra = true;
        pushEvent("extraOffer", { cells: S.ink.cells });
        return;
      }
      // 순차 제작이면 이 한 점만 마감하고 다음 번호로 넘어간다 (묶음은 아직 끝나지 않았다).
      if (advanceSequential()) return;
      // 갤러리가 열리기 전(두 번째 정상 완성까지)은 예전처럼 잠깐 보여 준 뒤 자동 판매한다.
      if (autoSellMode()) {
        S.lastEvent = g.label + " 등급 확정 — 곧 판매됩니다";
        schedule(C.REVEAL_TO_SALE_MS, function () {
          if (S.print === P) autoSellBatch();
        });
        return;
      }
      // 갤러리가 열린 뒤에는 자동 판매하지 않는다 — 한 장짜리 묶음도 결과판에서 판매/전시를 고른다.
      openResults();
    }

    // 이번 판에서는 항상 false다. 계산 얼개만 남겨 두고 화면·상태 어디에도 드러내지 않는다.
    // (되살릴 때는 unlocked.extraPrint를 여는 조건부터 새로 승인받는다.)
    function canOfferExtra() {
      const P = S.print;
      if (!P || !S.unlocked.extraPrint) return false;
      if (P.targetGradeIndex >= ECON.grades.length - 1) return false; // 다이아몬드는 더 오를 곳이 없다
      return S.ink.cells >= ECON.ink.extraPrintCells;
    }

    // 같은 그림에 한 번 더 내린다 — 잉크를 쓰고 등급 관문을 한 번 더 굴린다.
    // (색 판 수·시작 등급과는 완전히 다른 축이다 — 정본 §5-3)
    function extraPrint() {
      if (!canInteract()) return false;
      const P = S.print;
      if (!P || !P.awaitingExtra || S.ink.cells < ECON.ink.extraPrintCells) return false;
      P.awaitingExtra = false;
      P.extraRuns += 1;
      P.extraPass = true;
      P.extraProg = 0;
      P.phase = "ready";
      P.pos = 0;
      P.paintedTo = 0;
      P.rowT.fill(-1e9);
      P.snapped = false; // 다시 어긋났다가 마지막에 착 맞는다
      P.snapT = -1e9;
      P.budget = 2;
      P.budgetClock = S.clock;
      pushEvent("extraStart", { run: P.extraRuns });
      S.lastEvent = "추가 인쇄 " + P.extraRuns + "회차 — 휠을 아래로 굴려 한 번 더 내리세요";
      return true;
    }

    function resolveExtraPrint() {
      const P = S.print;
      P.extraPass = false;
      P.snapped = true;
      P.snapT = S.clock;
      pushEvent("snap");
      const index = P.targetGradeIndex;
      const gates = State.gateProbs(S.upgrades.inkQuality, P.originalKey);
      const win = index < gates.length && rng() < gates[index];
      if (win) {
        P.targetGradeIndex = index + 1;
        P.promote = true;
        const up = ECON.grades[P.targetGradeIndex];
        pushEvent("extraResult", { up: true, grade: up.key });
        S.lastEvent = "추가 인쇄 성공 — " + up.label + "로 올랐습니다";
        if (P.targetGradeIndex >= 3) {
          P.phase = "freeze"; // 플래티넘 이상 — 멈칫했다가 불꽃
          schedule(C.FREEZE_MS, function () {
            if (S.print !== P) return;
            pushEvent("burst", { grade: ECON.grades[P.targetGradeIndex].key });
            printReveal();
          });
          return;
        }
      } else {
        pushEvent("extraResult", { up: false, grade: ECON.grades[index].key });
        S.lastEvent = "추가 인쇄 실패 — 등급은 " + ECON.grades[index].label + " 그대로입니다";
      }
      printReveal();
    }

    // 기다리지 않고 지금 마감한다 — 잉크가 바닥난 미완성 묶음을 바로 넘긴다.
    // 미완성은 언제나 결과판을 열기만 한다. 정상 완성 뒤의 「한 번 더」 대기만
    // 자동 판매 구간에서 즉시 팔린다.
    // (결과판의 실제 판매·전시는 sellWork/displayWork만 담당한다.)
    function sellNow() {
      if (!canInteract()) return false;
      const P = S.print;
      if (!P) return false;
      // 2026-08-12 계약 2: 잉크가 바닥나는 순간 결과판이 이미 열려 있다.
      // 「기다리지 않고 넘긴다」는 뜻은 그 순간 이미 이뤄졌으므로 그대로 성공을 돌려준다.
      if (S.resultsOpen) return !!P.inkOut;
      if (P.awaitingExtra) {
        P.awaitingExtra = false;
        if (autoSellMode()) autoSellBatch();
        else openResults();
        return true;
      }
      // 미완성 묶음은 자동 판매 구간이어도 팔지 않는다 — 결과판만 연다 (계약 3·4).
      if (P.inkOut) {
        openResults();
        return true;
      }
      return false;
    }

    // 검수용: 수동 인쇄 한 번을 즉시 완주.
    function performPrintStroke() {
      if (!canInteract() || !S.print || S.print.phase !== "ready") return false;
      if (inkBlocked()) return false; // 입력 전 전체 차단 — 진행 0 · 차감 0
      const P = S.print;
      printApplyMove(C.ART);
      let guard = 0;
      while (S.print === P && P.phase === "auto" && guard < 30) {
        advance(printAutoRowMs() * 2);
        guard += 1;
      }
      return true;
    }

    // 검수용: 남은 인쇄·연출을 끝내고 결과판에 남은 작품까지 전부 판매로 넘긴다.
    // (학습 흐름의 자동 판매와 달리, 결과판에 남은 작품까지 전부 판매하는 검수·자동화 전용 지름길이다.)
    function finishPrint() {
      if (!canInteract() || !S.print) return false;
      let guard = 0;
      while (S.print && guard < 300) {
        if (S.resultsOpen) {
          const next = S.works.findIndex(function (w) { return !w.outcome; });
          if (next < 0) break;
          sellWork(next);
        } else if (S.print.awaitingExtra) sellNow();
        else if (S.print.phase === "ready") performPrintStroke();
        else advance(200);
        guard += 1;
      }
      return !S.print;
    }

    // 검수용: 추가 인쇄 한 번을 걸고 결과까지 진행한다.
    function performExtraPrint() {
      if (!extraPrint()) return false;
      let guard = 0;
      while (S.print && S.print.extraPass && guard < 30) {
        if (S.print.phase === "ready") performPrintStroke();
        else advance(100);
        guard += 1;
      }
      guard = 0;
      while (S.print && !S.print.awaitingExtra && S.print.phase !== "reveal" && guard < 60) {
        advance(100);
        guard += 1;
      }
      return true;
    }

    // ══ 원작 선택 — 도화지가 놓인 뒤에 고른다 ══════════════════════
    function printingInProgress() {
      const P = S.print;
      return !!(S.hasPaper && P && (P.stroke > 0 || P.paintedTo > 0 || P.phase !== "ready"));
    }

    function chooseOriginal(key) {
      if (!canInteract() || !S.unlocked.catalog) return false;
      if (!Art.originalByKey(key)) return false;
      // 2026-10-08 4단계: 경매로 얻은(가진) 원작만 고를 수 있다(기둥 ③ · 14-A).
      if (!ownsOriginal(key)) return false;
      // 2026-10-20 v9 · 14-A: 원작 카드(한 장 제작)로 시작한 그림은 다 팔 때까지 원작이 정해져 있다 — 바꾸기 · 예약 모두 없음.
      // 옛 길(도화지 → 원작 고르기)은 옛 검사용으로만 남아 있고, 두 길이 섞이면 돈 · 회차가 꼬인다(아스트라 리뷰).
      if (S.hasPaper && S.works.some(function (w) { return w.fixedOriginal && !w.outcome; })) return false;
      if (printingInProgress()) {
        S.nextOriginalKey = key === S.currentOriginalKey ? null : key;
        return true;
      }
      const changed = key !== S.currentOriginalKey;
      // ── 2026-10-12 v5: 재료비 차액 정산 (반영표 「임의로 정한 것」) ──
      // 재료비가 원작마다 다르므로(26-A), 도화지를 놓은 뒤 원작을 바꾸면 이미 낸 재료비와의 차액을 맞춘다.
      // 비싼 원작으로 바꾸면 차액을 내고(못 내면 바꾸지 않음), 싼 원작으로 바꾸면 차액을 돌려받는다.
      // 돌려받는 돈은 「번 돈」이 아니라서 구간 막대에 쌓지 않는다.
      const pending = S.hasPaper ? S.works.filter(function (w) { return !w.done && !w.outcome; }) : [];
      let settledLine = "";
      if (changed && pending.length) {
        const newCost = State.materialCostFor(key);
        const paid = pending.reduce(function (sum, w) { return sum + (w.materialCost || 0); }, 0);
        const diff = newCost * pending.length - paid;
        if (diff > 0 && S.money < diff) {
          const art = Art.originalByKey(key);
          S.lastEvent = "「" + (art ? art.label : key) + "」 재료비가 " + diff + "$ 더 듭니다 — 돈이 모자라 바꾸지 않았습니다";
          pushEvent("originalSwapBlocked", { key: key, need: diff, money: S.money });
          return false;
        }
        S.money -= diff; // diff < 0 이면 돌려받는다
        pending.forEach(function (w) { w.materialCost = newCost; });
        if (diff !== 0) pushEvent("materialSettled", { key: key, diff: diff });
        // 별도 검수(10/13) M1: 돈이 조용히 빠지거나 들어오지 않게 기록 줄에 정산을 밝힌다.
        settledLine = diff > 0 ? "재료비 차액 −" + diff.toLocaleString("ko-KR") + "$ 냈습니다"
          : diff < 0 ? "재료비 차액 +" + (-diff).toLocaleString("ko-KR") + "$ 돌려받았습니다" : "";
      }
      S.currentOriginalKey = key;
      S.nextOriginalKey = null;
      if (S.hasPaper) {
        if (S.print) {
          // 인쇄 시작 전에는 그림을 바꾼다. v5: 확률이 원작마다 달라서(확률 단계) 회차 계획을 새 원작으로 다시 뽑는다.
          // 계획은 회차가 끝나기 전에는 화면에 드러나지 않으므로, 다시 뽑아도 플레이어가 얻는 정보가 없다.
          // 한 묶음의 도화지는 같은 원작을 쓰므로 원작 표시도 함께 바꾼다.
          if (changed) {
            // 별도 검수(10/13) L4: 작업대가 여러 대(검수 손잡이)면 작품마다 따로 뽑는다(v4처럼 작품별 계획).
            pending.forEach(function (w) {
              const plan = rollRoundPlan();
              w.roundPlan = plan;
              w.gradeIndex = planFinalGrade(plan);
            });
            S.works.forEach(function (w) { w.originalKey = S.currentOriginalKey; });
            ensurePrint(); // 지금 대상 작품의 계획으로 인쇄 상태를 다시 세우고 그 작업대에 매단다
            const art = Art.originalByKey(key);
            S.lastEvent = "원작을 「" + (art ? art.label : key) + "」(으)로 바꿨습니다"
              + (settledLine ? " — " + settledLine : "");
          }
        } else {
          // 흰 도화지 위에 이제 막 원작이 정해졌다 — 여기서 인쇄가 시작된다.
          S.awaitingOriginal = false;
          // 2026-10-20 v9(아스트라 재리뷰 권장): 도화지를 살 때 뽑은 계획은 그때 원작의 횟수다 — 다른 원작이 정해지면
          // 그 원작의 횟수 · 확률로 다시 뽑는다(인쇄 전이라 드러난 정보가 없다 · 위 인쇄 중 분기와 같은 규칙).
          if (changed) {
            pending.forEach(function (w) {
              const plan = rollRoundPlan();
              w.roundPlan = plan;
              w.gradeIndex = planFinalGrade(plan);
            });
          }
          S.works.forEach(function (w) { w.originalKey = S.currentOriginalKey; });
          ensurePrint();
          pushEvent("artworkReady", { original: key });
          S.lastEvent = "원작 선택 완료 — 작업대에서 휠을 아래로 굴려 인쇄를 시작하세요";
        }
      }
      return true;
    }

    // ══ 확률표 — 「모작 등급 확률」: 등급/확률/가격, 실제 최종 확률 ═══
    function probTableState() {
      // v5: 확률은 원작마다 다르다 — 확률 단계 = 3 + 잉크 질 − 원작 출발 단계.
      const probKey = priceOriginalKey();
      const stage = State.probabilityStage(S.upgrades.inkQuality, probKey);
      const probs = State.finalProbs(S.upgrades.inkQuality, probKey);
      // 2026-10-06 두 방 데모 A — 표기 둘: 최종 결과 확률(세 회차 최고 등급, 기본 · 9/16 B · 9/30 체험판)과
      // 회차별 추첨 확률. 최종 결과 확률은 8/27 finalProbs와 같은 값이다(회차 확률을 거기서 역산했으므로).
      const rounds = State.roundProbs(S.upgrades.inkQuality, probKey);
      const rows = ECON.grades.map(function (g, i) {
        return {
          key: g.key,
          label: g.label,
          prob: probs[i],
          percent: State.formatPercent(probs[i]),
          roundProb: rounds[i],
          roundPercent: State.formatPercent(rounds[i]),
          price: originalPrice(i, priceOriginalKey()),
        };
      });
      // 라운드 005: 확률표는 「제작 중인 도화지」에 딸린 정보다.
      // 작업대가 비어 있으면(돈이 아무리 많아도) 숨기고, 결과판이 열렸거나
      // 잉크가 바닥나 결과가 굳었어도 숨긴다.
      // 실제로 띄울지는 화면 쪽에서 포인터가 도화지 위에 올라가 있는 동안에만 정한다 —
      // 여기 visible은 「띄울 수 있는 상태인가」까지만 말한다.
      const revealed = !!(S.print && (S.print.phase === "reveal" || S.print.inkOut));
      const visible = S.unlocked.paper && S.hasPaper && !S.resultsOpen && !revealed;
      return {
        visible: visible,
        rows: rows,
        stage: stage, // v5: 지금 원작의 확률 단계(0~8)
        sum: probs.reduce(function (a, b) { return a + b; }, 0),
        // 지금 확보한 등급 (회차가 하나라도 끝났을 때만) — 표의 그 줄을 고정 강조한다
        held: S.print && S.print.best !== null && S.print.best !== undefined
          ? ECON.grades[S.print.best].key : null,
      };
    }

    // ── 유리창 확률표 (2026-08-19 · 0817 피드백 3번) ──────────────
    // 「표의 등장방식과 위치는 모작 등급확률표와 똑같이, 안의 내용만 유리창에 맞게」
    // 라는 동현 지시대로 probTableState()와 같은 모양으로 낸다.
    // 대성공(잭팟)은 플레이어에게 숨은 확률이라 State.windowPublicTable이 성공 쪽에
    // 합쳐서 낸 줄만 싣는다 — 이 표에 잭팟 이름도 금액도 드러나지 않는다.
    function windowProbTableState() {
      const level = windowLevel();
      const rows = State.windowPublicTable(level).map(function (r) {
        return {
          key: r.key,
          label: r.label,
          chance: r.chance,
          percent: State.formatPercent(r.chance),
          pay: r.pay,
          // 파손 줄은 「받는 돈」이 아니라 「잃는 돈」을 말한다 (총손실 40원).
          cost: r.cost || 0,
        };
      });
      // 모작 확률표가 「제작 중인 도화지에 딸린 정보」인 것과 짝을 맞춰,
      // 이 표는 「지금 닦고 있는 유리창에 딸린 정보」다. 도화지가 올라와 있으면
      // 유리창 알바를 할 수 없으므로 함께 숨는다.
      return {
        visible: S.mode === "window" && !S.hasPaper && !S.resultsOpen,
        level: level,
        rows: rows,
      };
    }

    // ── 유리창 레벨 게이지 (2026-08-19 · 0817 피드백 3번) ─────────
    // 동현이 첨부한 스크래치 화면처럼 「본업」 항목 안에 레벨과 진행 막대가 함께 산다.
    // 우리 화면에서 그 자리는 왼쪽 구매줄의 유리창 알바 버튼이다.
    function windowGaugeState() {
      const g = State.windowGaugeFor(S.windowsDone);
      return {
        level: g.level,
        done: g.done,
        need: g.need,
        ratio: g.ratio,
        maxed: g.maxed,
        percent: Math.round(g.ratio * 100),
      };
    }

    // 보유 단계 사본 — 항목이 늘거나 이름이 바뀌어도 목록 하나만 고치면 된다.
    function ownedUpgradeState() {
      const out = {};
      State.UPGRADE_KEYS.forEach(function (key) { out[key] = S.upgrades[key] || 0; });
      return out;
    }

    // ══ 상점 화면용 상태 — 선형 해금 순서 그대로 ═══════════════════
    function shopState() {
      const items = UPGRADES.map(function (u, i) {
        const level = S.upgrades[u.key];
        // 2026-10-08 4단계: 지금 열린 마지막 단계(관문 앞)까지만 산다 — 잉크통 2단계는 진주 고양이 뒤.
        const cap = upgradeCap(u);
        // 카드는 언제나 「다음에 살 단계」의 값을 말한다. 지금 열린 마지막 단계까지 올렸으면
        // 그 마지막 값을 그대로 두고 owned·MAX 표시가 대신 말한다(관문 뒤 단계 값을 미리 말하지 않는다).
        const shownLevel = level >= cap ? Math.max(0, cap - 1) : level;
        const cost = shopCostNow(u, shownLevel);
        // 돈은 충분한가 → 그런데 사면 교착이 되는가. 둘을 갈라서 내보낸다.
        // 카드가 「돈이 모자라요」와 「선투자를 남겨야 해요」를 다른 말로 할 수 있어야 한다.
        const canPay = i < S.shopRevealed && level < cap && S.money >= cost;
        const guardBlocked = canPay && purchaseDeadlocks(cost, false);
        // 2026-10-20 v9: 다음 단계가 구간 관문에 막혀 있으면 그 구간 번호(잉크통 2단계 = 구간 4 · 3단계 = 구간 8) — 카드가 「구간 n」으로 말한다.
        const nextGate = level >= cap && cap < u.maxLevel && u.stageGates ? u.stageGates[cap] : null;
        return {
          gatedSegment: nextGate && nextGate.type === "segment" ? nextGate.value : 0,
          key: u.key,
          label: u.label,
          cost: cost,
          effect: State.upgradeEffectFor(u, shownLevel),
          note: State.upgradeNoteFor(u, shownLevel),
          level: level,
          maxLevel: cap,
          fullMaxLevel: u.maxLevel,
          owned: level >= cap,
          revealed: i < S.shopRevealed,
          affordable: canPay && !guardBlocked,
          // 2026-08-26 동현 확정 — 공통 교착 방지 계약이 막고 있는 카드인가.
          reserveBlocked: guardBlocked,
          // 2026-08-26 v1 계약 6항 — 이 카드에 NEW를 켜 두어야 하는가.
          isNew: !!(S.shopNotices[u.key] && S.shopNotices[u.key].isNew),
        };
      });
      return {
        unlocked: S.unlocked.shop,
        revealed: S.shopRevealed,
        // 새 장비가 「처음」 열릴 때만 뜨는 작은 아이콘 팝업 (없으면 null).
        // 화면을 덮지 않는 알림이라 게임을 멈추지 않는다.
        unlockPopup: S.shopPopup ? { key: S.shopPopup.key, label: S.shopPopup.label, first: true } : null,
        // 디버그로 통째로 연 판인지 — 화면이 「검수용으로 연 상태」임을 알릴 수 있게
        debugRevealed: !!S.debugShopRevealed,
        total: UPGRADES.length,
        // 상점 탭 금빛 「NEW」 — 새 상품이 열린 순간 켜지고, 카드를 확인하면 꺼진다.
        // 카드 테두리(workbenchOffer.isNew)와 짝을 이루는 별개의 알림이다 (계약 9·10).
        tabNew: S.shopTabNew,
        items: items,
      };
    }

    // 두 번째 작업대 상품의 공개 모습 — 열리기 전에는 아예 내보내지 않는다.
    // 「60원」과 「작업대」를 한 조각에서 함께 읽을 수 있어야 한다 (계약 7·8).
    function workbenchOfferState() {
      if (!S.secondBench.unlocked) return null;
      const offer = secondBenchOffer();
      const canPay = !S.secondBench.purchased && S.money >= offer.cost;
      const guardBlocked = canPay && purchaseDeadlocks(offer.cost, false);
      return {
        key: offer.key,
        label: offer.label,
        effect: offer.effect,
        note: offer.note,
        cost: offer.cost,
        purchased: S.secondBench.purchased,
        affordable: canPay && !guardBlocked,
        // 2026-08-26 동현 확정 — 공통 교착 방지 계약이 막고 있는 카드인가.
        reserveBlocked: guardBlocked,
        // 카드 금빛 테두리 — 확인 전까지만 켜지고, 구매 전이어도 다시 켜지지 않는다.
        isNew: !S.secondBench.seen,
      };
    }

    // ══ 공개 상태 ═════════════════════════════════════════════════
    function getState() {
      const P = S.print;
      const w = S.window;
      // 2026-08-26 동현 확정 — 상환 교착 방지의 지금 판정 (파생값이라 저장하지 않는다).
      // 2026-08-26 독립 검토 대응: 화면이 읽는 잔액도 계약이 인정하는 값(200원 또는
      // 0원)에서 나온다. 잔액을 직접 주입해도 화면이 「100원만 갚으면 된다」고 말하지
      // 않는다 — 불러오기 한 곳만 막으면 다른 주입 경로가 그대로 남기 때문이다.
      const loanBalance = State.loanOwed(S.loan);
      const repayNeeded = State.repayCashNeeded(S.loan, sellableWorkLeft());
      const repayGuarded = loanBalance > 0
        && S.money >= loanBalance && S.money < repayNeeded;
      // 2026-08-26 2차 독립 검토 대응: 화면에 나가는 상태 플래그도 정식 boolean만
      // 사실로 읽는다. 「계약이 인정하는 빚이 남아 있다」는 그 자체로 체결의 증거라,
      // 서명 플래그만 지운 판이 화면에서 미체결 행세를 하지 못한다.
      //
      // 2026-08-26 5차 독립 검토 대응: 화면이 읽는 플래그도 「대출 상태 자신의 필드」
      // 하나에서 한 번에 읽는다. 프로토타입에 올려 둔 값을 화면이 사실로 그리면,
      // 규칙이 이미 닫은 상태를 화면만 보고 만든 검수가 다시 정상이라 믿게 된다.
      const loanOwn = State.loanOwnFields(S.loan).own;
      const loanSigned = loanOwn.signed === true || loanBalance > 0;
      const loanAccepted = loanOwn.accepted === true || loanSigned;
      // 2026-08-26 동현 승인 — 지금 실제로 걸려 있는 불이익과 완납 건수.
      // 규칙 쪽 판정 하나(State.activeLoanPenalty)를 화면도 그대로 나눠 쓴다.
      const activePenalty = loanPenalty();
      const repaidCount = State.loanRepaidCount(S.loan);
      return {
        started: S.started,
        paused: S.paused,
        inputLocked: S.clock < S.inputLockUntil,
        clock: S.clock,
        money: S.money, // 현금 — 절대 음수가 되지 않는다
        // 2026-08-26 v1 — 유리창 노동비. 자동 신용(옛 debt)은 폐기됐고 이 판에
        // 「빚」이라 부를 수 있는 것은 아래 loan 하나뿐이다.
        windowCosts: {
          upfront: State.WINDOW_COSTS.upfront,
          breakCompensation: State.WINDOW_COSTS.breakCompensation,
          breakTotalLoss: State.WINDOW_COSTS.breakTotalLoss,
          autoCredit: State.WINDOW_COSTS.autoCredit,
        },
        // 2026-08-26 동현 확정 — 공통 교착 방지 계약의 지금 상태.
        // 저장하는 값이 아니라 대출·작품에서 그때그때 나오는 파생값이다.
        deadlockGuard: {
          reserve: State.DEADLOCK_GUARD.reserve, // 남겨야 할 유리창 선투자
          loanLeft: loanReliefLeft(), // 아직 받을 수 있는 대출이 남아 있는가
          workLeft: sellableWorkLeft(), // 팔아서 회복할 작품이 남아 있는가
          active: !loanReliefLeft() && !sellableWorkLeft(), // 지금 이 계약이 걸려 있는가
          notice: (!loanReliefLeft() && !sellableWorkLeft())
            ? State.deadlockGuardShort() : "",
        },
        // 2026-08-26 v1 — 스크래치식 대출 계약. 계약서 화면이 읽는 값은 전부 여기서 나온다.
        loan: {
          // 2026-08-26 4차 독립 검토 대응: 화면도 규칙과 같은 엄격 판정을 따른다.
          // 기회가 이미 닫힌 상태를 「아직 제안 전」으로 그리면, 화면만 보고 만든
          // 검수·후속 판정이 다시 새 판이라고 믿게 된다 — 그 어긋남이 우회의 통로였다.
          offered: !loanReliefLeft() || loanOwn.offered === true
            || loanAccepted || loanOwn.declined === true,
          declined: loanOwn.declined === true,
          accepted: loanAccepted,
          signed: loanSigned,
          revealed: loanOwn.revealed === true || loanSigned,
          balance: loanBalance, // 계약이 인정하는 잔액 — 200원 또는 0원
          principal: State.LOAN_RULES.principal,
          interestRate: State.LOAN_RULES.interestRate,
          totalDue: State.LOAN_RULES.totalDue,
          // 전화 마지막 장에서 수락/거절 버튼이 열려 있는가.
          offerOpen: phoneChoiceOpen(),
          // 2026-08-26 동현 승인 — 이 계약이 고른 불이익 하나. 갚을 것이 없으면 null이다.
          // 값도 크기도 규칙 파일의 승인 목록에서만 나온다 (손댄 저장이 부풀리지 못한다).
          penalty: activePenalty,
          penaltyLine: State.loanPenaltyLine(activePenalty),
          penaltyShort: State.loanPenaltyShort(activePenalty),
          // 잔액이 남아 있는 동안에만 그 불이익이 걸려 있다.
          penaltyActive: loanBalance > 0,
          // 화면이 버튼을 켜고 끄는 데 쓰는 판정. 실제 판정은 엔진이 다시 하므로
          // 화면을 건너뛰고 눌러도 규칙이 깨지지 않는다.
          // 2026-08-26 3차 독립 검토 대응: 화면 판정과 규칙 판정이 서로 다른 조건을
          // 세지 않도록 지급이 성립하는 유일한 조합(State.loanContractPending)을
          // 그대로 쓴다. 예전에는 「수락했고 체결 표시가 없다」만 봐서, 상태를 직접
          // 주입한 판이 서명 버튼을 열어 둔 채 원금을 다시 받을 수 있었다.
          canSign: State.loanContractPending(S.loan) && !loanSigned,
          // 2026-08-26 동현 확정 — 상환 교착 방지. 팔거나 진행해 회복할 작품이 없으면
          // 갚고도 선투자 20원이 남는 220원부터 열린다(있으면 200원 그대로).
          // 저장하는 값이 아니라 대출 잔액과 작품에서 그때그때 나오는 파생값이다.
          canRepay: loanBalance > 0 && S.money >= repayNeeded,
          repayNeeded: repayNeeded, // 지금 갚으려면 있어야 할 현금 (200원 또는 220원)
          // 잔액만큼은 모았는데 선투자를 남기지 못해 잠긴 자리인가.
          reserveBlocked: repayGuarded,
          // 그 자리에서만 붙는 짧은 이유. 막히지 않았으면 아무 말도 하지 않는다.
          repayNotice: repayGuarded ? State.deadlockGuardShort() : "",
          // 2026-08-26 동현 승인 — 완납은 계약을 닫으므로 서명 플래그가 남지 않는다.
          // 그래서 「완납했는가」를 두 증거 중 하나로 본다. 이 판에서 직접 갚은
          // 건수(repaid)이거나, 「서명했고 잔액이 0원」이라고 적힌 저장이다.
          // 두 번째는 이 승인 이전 저장이 그대로 살아나는 자리라 함께 인정한다.
          cleared: loanBalance <= 0 && (loanOwn.signed === true || repaidCount > 0),
          repaidCount: repaidCount, // 지금까지 완납한 계약 수 (재대출 이력)
          // 방금 삭감된 수입 한 줄 — 원금액과 삭감액을 숨기지 않는다.
          lastCut: S.lastIncomeCut ? {
            gross: S.lastIncomeCut.gross, net: S.lastIncomeCut.net,
            cut: S.lastIncomeCut.cut, source: S.lastIncomeCut.source,
          } : null,
          // 서명 직후의 반전 문구. 서명 전에는 빈 배열이라 화면에 샐 수 없다.
          revealLines: (loanOwn.revealed === true || loanSigned)
            ? State.loanRevealLines(activePenalty) : [],
        },
        mode: S.mode,
        windowsDone: S.windowsDone,
        // 2026-08-15 A 확정: 완료한 유리창 개수만 보는 유리창 레벨 (0 또는 1).
        windowLevel: windowLevel(),
        strokesDone: S.strokesDone,
        jackpots: S.jackpots,
        window: w ? {
          pass: w.pass,
          layers: windowStrokes(),
          strokeRow: Math.min(C.ART, Math.floor(w.stroke.pos)),
          strokePhase: w.stroke.phase,
          swapping: w.swapping,
          jackpot: w.jackpot,
          result: w.result,
        } : null,
        catalog: S.catalog,
        unlocked: {
          paper: S.unlocked.paper,
          catalog: S.unlocked.catalog,
          shop: S.unlocked.shop,
          gallery: S.unlocked.gallery,
        },
        // 중앙 작업면 — 칸 수와 버튼 한 번의 결제액.
        // paperCost는 칸 수와 무관하게 언제나 한 장 값(100원)이다 (라운드 005).
        // 가격은 여기가 아니라 workbenchOffer 쪽에 있다 — 작업대 자체는 살 것이 아니라
        // 「지금 몇 칸인가」만 말한다.
        workbench: {
          slots: benchSlots(),
          expanded: S.workbench.expanded,
          paperCost: paperClickCost(),
          filled: S.works.length,
          empty: Math.max(0, benchSlots() - S.works.length),
        },
        // 검수 전용 제작 전환의 현재 모습. 실제 경제·성장·해금과는 완전히 분리돼 있다.
        review: {
          used: S.review.used,
          workbenchCount: S.review.workbenchCount,
          simultaneousUnlocked: S.review.simultaneousUnlocked,
          productionMode: S.review.productionMode,
          modeSwitchLocked: modeSwitchLocked(),
        },
        // 지금 입력이 향하는 작업대 번호.
        activeWorkSlot: activeWorkSlot(),
        // 2026-08-26 v1 계약 5항 — 작업대별 독립 입력.
        //   benchInput  — 자연 플레이의 입력 방식 ("independent")
        //   benchFocus  — 포인터가 올라가 지금 입력을 받는 작업대 번호
        benchInput: isSimultaneous() ? "simultaneous-review" : "independent",
        benchFocus: benchFocusSlot(),
        // 두 번째 작업대 상품 — 열리기 전에는 null이라 상태 어디에도 60원이 없다.
        workbenchOffer: workbenchOfferState(),
        // 이번 묶음에 올라간 작품들 — 등급·가격·결과가 각각 따로다.
        works: S.works.map(function (work) {
          return {
            slot: work.slot,
            originalKey: work.originalKey,
            stroke: work.stroke,
            gradeIndex: work.gradeIndex,
            grade: ECON.grades[work.gradeIndex].key,
            gradeLabel: ECON.grades[work.gradeIndex].label,
            // v9: 아직 팔지 않은 완성작은 지금 원작 레벨로 다시 센 값(파는 순간 그 값으로 판다)
            price: work.done && !work.outcome && !work.incomplete
              ? originalPrice(work.gradeIndex, work.originalKey) : work.price,
            incomplete: work.incomplete,
            done: work.done,
            outcome: work.outcome,
          };
        }),
        resultsOpen: S.resultsOpen,
        expansionComplete: S.expansionComplete,
        // 무료 전시 칸 1개. 주기 수입·가치 상승 속도·상한·버프 수치는 여기 없다(정본 미정).
        gallery: {
          unlocked: S.gallery.unlocked,
          capacity: EXP.gallerySlots,
          used: S.gallery.items.length,
          items: S.gallery.items.map(function (item) {
            return {
              slot: item.slot,
              originalKey: item.originalKey,
              grade: item.grade,
              gradeIndex: item.gradeIndex,
              label: item.label,
            };
          }),
        },
        // 검수 전용 돈 — 실제 경제와 분리된 도구다.
        reviewMoney: {
          used: S.reviewMoney.used,
          amounts: EXP.reviewMoneyAmounts.slice(),
        },
        // 첫 판매 손실 결과 — 도화지값 100 / 판매가 70 / 손실 30과 확인 대기.
        // 확인하기 전에는 잉크통 전화도 다음 도화지도 진행되지 않는다 (라운드 001).
        lossResult: S.lossResult ? {
          paperCost: S.lossResult.paperCost,
          salePrice: S.lossResult.salePrice,
          loss: S.lossResult.loss,
          pending: S.lossResult.pending,
        } : null,
        lastSalePrice: S.lastSalePrice,
        upgrades: ownedUpgradeState(),
        shop: shopState(),
        // 2026-08-19 자동화 두 종 — 화면이 스위치와 진행도를 보여 준다.
        automation: {
          buyPaper: !!S.upgrades.autoBuyPaper,
          sellWork: !!S.upgrades.autoSellWork,
          sellOn: S.autoSellOn,
          buyFloor: autoBuyFloor(),
          // 아직 안 열렸으면 「몇 번 더 하면 열리는가」를 알려 준다.
          papersByHand: S.papersBoughtByHand,
          worksSoldByHand: S.worksSoldByHand,
        },
        // 2026-10-08 3단계: 경험치 막대 대신 구간 목표 금액 막대가 그리는 값.
        // 레벨은 언제나 1이다(판매가 보너스 없음 — 형님 6-A).
        segment: State.segmentView(S.segment.index, S.segment.earned),
        auctionDoor: { open: S.auctionDoor.open },
        // 2026-10-08 4단계 — 경매장 문에 걸린 다음 매물(실루엣·급·예상가)과 가진 원작
        auction: auctionLotState(),
        originals: Art.ORIGINALS.map(function (item) {
          const rule = State.originalRule(item.key) || {};
          return {
            key: item.key,
            label: item.label,
            tier: rule.tier || 1,
            priceMult: rule.priceMult || 1,
            inkMult: rule.inkMult || 1,
            level: originalLevel(item.key),
            owned: ownsOriginal(item.key),
            // 2026-10-20 v9 — 한 장 제작 카드가 읽는 값
            fee: State.materialCostFor(item.key), // 한 장 참가비 = 5 × 급 배율
            strokes: State.manualStrokesFor(item.key), // 직접 미는 횟수(색 − 1)
            resist: State.originalResist(item.key),
            firstPrice: rule.firstPrice || 0, // 경매장 예상가
            unlockSegment: rule.segment || 0,
          };
        }),
        // 2026-10-20 v9 — 한 장 제작(왼쪽 원작 카탈로그 카드)의 지금 상태
        sheet: {
          busy: sheetBusy(), // 작업대에 그림이 있다(판매 전) — 다른 카드는 못 누른다(14-A)
          current: (S.hasPaper || S.works.length) ? S.currentOriginalKey : null,
          last: S.currentOriginalKey, // 마지막으로 고른 원작(경매장 아래 칸 · 한 장 자동 제작)
          free: S.freeSheet === "ready", // 6-A — 다음 한 장 참가비 무료
          freeState: S.freeSheet,
          // 첫 손실 학습 뒤 잉크통을 사기 전에는 다음 한 장을 놓지 않는다(v8 buyPaper 그대로) — 카드가 이유를 말한다
          needInkTank: !!(S.firstSaleDone && S.upgrades.inkTank < 1),
          nextNew: (function () {
            const lots = auctionLots();
            return lots.newLot ? lots.newLot.key : null;
          }()),
        },
        // 2026-10-20 v9 — 오른쪽 「업그레이드」 세 칸
        rail: railState(),
        act1End: { reached: S.act1End.reached, open: S.act1End.open },
        level: S.level,
        // 칸 수(cells/capacity/need)는 계산·검수용으로만 남기고,
        // 화면에 쓰는 값은 percent(현재)·nextCostPercent(다음 한 번의 입력 비용)다.
        // 2026-08-15 B 확정: 현재 잔량과 다음 입력 비용을 언제나 함께 내보낸다.
        ink: inkStatus(),
        paperSize: {
          key: paperSize().key,
          label: paperSize().label,
          cost: paperSize().cost,
          cells: requiredCells(),
        },
        phone: {
          open: S.phone.open,
          ringing: S.phone.ringing,
          script: S.phone.script,
          page: S.phone.page,
          pages: phonePages().length,
          done: {
            paper: S.phone.done.paper,
            ink: S.phone.done.ink,
            glassBreak: S.phone.done.glassBreak,
          },
        },
        hasPaper: S.hasPaper,
        awaitingOriginal: S.awaitingOriginal,
        print: P ? {
          phase: P.phase,
          stroke: P.stroke,
          curPlate: P.curPlate,
          plateProg: P.plateProg.slice(),
          targetGradeIndex: P.targetGradeIndex,
          targetGrade: ECON.grades[P.targetGradeIndex].key,
          startGradeIndex: P.startGradeIndex,
          // 2026-10-06 두 방 데모 A — 화면은 이 아래 「끝난 회차」 정보만 읽는다
          // (targetGrade·promote·price는 검사용 안쪽 값이라 화면이 읽지 않는다).
          best: P.best === null ? null : ECON.grades[P.best].key,
          bestIndex: P.best,
          draws: P.draws.map(function (i) { return ECON.grades[i].key; }),
          roundsDone: P.draws.length,
          roundsTotal: P.manual, // v9: 직접 미는 횟수(원작마다 3 · 3 · 4 · 4 · 5 · 5)
          plateCount: P.plates.length,
          branch: P.branch,
          promote: P.promote,
          snapped: P.snapped,
          signaled: P.signaled,
          inkOut: P.inkOut,
          inkOutStroke: P.inkOutStroke,
          // 2026-08-25 계약 1 — 모자람 연출을 검수·검사에서 숫자로 확인할 수 있게 낸다.
          // paintedTo가 도화지 줄 수와 같으면 밀대가 중간에 얼지 않고 끝까지 내려갔다는 뜻이다.
          paintedTo: Math.round(P.paintedTo),
          paintedRows: P.baseRows, // 실제로 잉크가 묻은 줄 수
          dryRows: P.dryRows, // 마른 자국(v7: 마른 점)으로 남은 줄 수
          // 빈 면적 — 완성에 필요한 전체 줄 수에서 실제로 찍힌 줄을 뺀 값.
          // 마른 자국으로 지나간 줄과 아직 손도 못 댄 색판을 함께 센다.
          // 잉크가 적을수록 이 값이 그대로 커진다 (계약 1 「점진적으로 커진다」).
          emptyRows: Math.max(0, P.manual * C.ART - P.baseRows),
          extraPass: P.extraPass,
          extraRuns: P.extraRuns,
          awaitingExtra: P.awaitingExtra,
          price: P.inkOut
            ? State.incompletePriceFor(P.originalKey)
            : originalPrice(P.targetGradeIndex, P.originalKey),
        } : null,
        artworksSold: S.artworksSold,
        firstSaleDone: S.firstSaleDone,
        scopeComplete: S.scopeComplete,
        currentOriginal: S.currentOriginalKey,
        nextOriginal: S.nextOriginalKey,
        probTable: probTableState(),
        // 2026-08-19 라운드 006 — 유리창 확률표·레벨 게이지·도화지 차단 안내·디버그 창
        windowProbTable: windowProbTableState(),
        windowGauge: windowGaugeState(),
        paperBlock: paperBlockState(),
        debug: {
          open: S.debug.open,
          values: {
            windowLayers: windowStrokes(),
            // 손잡이가 든 「배율」 그대로다. 실제로 도는 속도는 여기에 기본 배율
            // (State.WINDOW_BASE_SPEED_SCALE = 0.5)이 한 번 더 곱해진 값이다.
            windowScrollSpeed: Number(S.debug.values.windowScrollSpeed) > 0
              ? Number(S.debug.values.windowScrollSpeed) : 1,
            windowPay: Math.round(Number(S.debug.values.windowPay)),
            windowInkDam: Number(S.debug.values.windowInkDam) ? 1 : 0,
            printInkDam: Number(S.debug.values.printInkDam) ? 1 : 0,
            forceGrade: Math.round(Number(S.debug.values.forceGrade)),
            timeScale: Math.round(Number(S.debug.values.timeScale)) || 1,
            firstInkPercent: Math.round(Number(S.debug.values.firstInkPercent)),
            windowPayLv1: Math.round(Number(S.debug.values.windowPayLv1)),
            // 2026-08-25 계약 2 — 0 단색 윤곽(기본) · 1 옅은 원색
            underdrawing: Number(S.debug.values.underdrawing) ? 1 : 0,
            // 2026-08-27 v1 — 자동 마감 손잡이. 화면 디버그 창이 이 값을 그대로 읽는다.
            windowAutoFinish: windowAutoFinishOn() ? 1 : 0,
          },
          // 2026-08-25 계약 5 — 다음 한 장을 파손으로 못박아 둔 예약 상태
          breakNextWindow: !!S.debug.breakNextWindow,
        },
        lastEvent: S.lastEvent,
        saleFeedback: S.saleFeedback,
      };
    }

    // ══ 저장·불러오기 (2026-08-26) ═══════════════════════════════
    // 담는 것은 「판을 다시 이어 갈 수 있는 지속 상태」다 — 현금과 대출 계약,
    // 유리창·경험치 진행, 산 업그레이드·작업대·갤러리, 해금과 전화 진행이다.
    // 자동 신용 빚(옛 debt)은 계약 1항으로 폐기됐고 저장 항목에도 없다.
    // 담지 않는 것은 「지금 손에 들려 있는 한 순간」이다 — 밀고 있는 도화지·인쇄 진행·
    // 결과판·예약된 연출. 불러오면 작업대가 비어 있는 상태에서 이어진다.
    // 그래야 저장 형식이 연출 계약(V6 시안 D)의 내부 값에 묶이지 않는다.
    // 2026-10-08 3단계 별도 검수: 상점 카드 순서가 바뀌어(잉크 질을 자동화 두 종 앞으로) 3으로 올렸다.
    // 2 이하 저장은 불러올 때 「상점에서 몇 칸 열렸나」를 새 순서로 다시 센다(아래 applySave 끝).
    // 2026-10-08 4단계: 원작 레벨표(originalLevels)가 저장에 들어가 4로 올렸다.
    // 3 이하 저장은 「뮤나리자만 가진 판」으로 읽는다(아래 applySave).
    // 2026-10-12 v5: 1달러 단위 · 원작 6점 · 업그레이드 단계가 바뀌어 5로 올렸다.
    // 4 이하 저장은 돈 단위부터 달라(100$ 도화지 시절) 읽지 않는다 — load가 false를 돌려주고 새 게임으로 시작한다.
    // 2026-10-20 v9: 한 번에 한 색 · 원작 「춤」(해바라기 키 대체) · 스퀴지 재질 · 6-A 무료 한 장 · 구간 금액이 바뀌어 6으로 올렸다.
    // 5 이하 저장은 원작 키와 경제 숫자가 달라 읽지 않는다 — load가 false를 돌려주고 새 게임으로 시작한다.
    const SAVE_VERSION = 6;
    // 저장된 대출 잔액이 「어떤 계약의 숫자인가」를 밝히는 식별자.
    // 이 판의 스크래치식 대출(원금 100 · 총상환 200 · 분할 없음)만 이 값을 쓴다.
    const LOAN_SAVE_SCHEMA = LOAN_SAVE_SCHEMA_ID;

    function save() {
      return {
        version: SAVE_VERSION,
        // 2026-08-26 v1: 자동 신용 빚(debt)은 폐기돼 저장 항목에서도 사라졌다.
        money: S.money,
        // 대출 계약은 판을 이어 갈 수 있게 하는 지속 상태다.
        // 「제안했는가·거절했는가·수락했는가·서명했는가·반전을 봤는가·얼마 남았는가」를
        // 모두 담아야 평생 1회 규칙이 저장을 건너뛰고 깨지지 않는다.
        // schema는 「이 잔액이 어떤 계약의 숫자인가」를 밝히는 식별자다. 구형 부모판
        // 대출(원금 1,000 · 총상환 2,000 · 250원 분할)의 잔액을 신형 200원으로
        // 조용히 갈아 끼우지 않기 위해 저장·불러오기 양쪽에서 검사한다.
        //
        // 2026-08-26 5차 독립 검토 대응: 실행 중인 대출 상태를 그대로 베끼지 않는다.
        // 프로토타입에 정식 조합을 올린 껍데기(Object.create(pending))를 필드 단위로
        // 읽어 적으면 상속값이 「자기 필드」로 세탁돼, 다음 불러오기에서 완전히 정상적인
        // 계약서 대기로 되살아난다. 그래서 저장에 나가는 값은 언제나 규칙이 인정하는
        // 정규 상태 하나(State.loanFromSave)를 지난 것뿐이다. 정상 상태에서는 이 함수가
        // 아무것도 고치지 않으므로 지금까지의 저장 모양과 값이 그대로다.
        // 2026-08-26 동현 승인: 여섯 핵심 필드 뒤에 「고른 불이익」과 「완납 건수」를
        // 함께 적는다. 둘 다 실행 중 상태를 그대로 베끼지 않고 규칙의 작은 판정을
        // 지난 값이다 — 프로토타입에 올려 둔 값이 자기 필드로 세탁되지 않게 한다.
        loan: Object.assign({ schema: LOAN_SAVE_SCHEMA },
          State.loanFromSave(S.loan).loan, {
            penalty: loanPenalty(),
            repaid: State.loanRepaidCount(S.loan),
          }),
        // 상점 카드별 알림 — 최초 해금 팝업을 이미 봤는지까지 함께 담는다.
        shopNotices: JSON.parse(JSON.stringify(S.shopNotices)),
        started: S.started,
        windowsDone: S.windowsDone,
        strokesDone: S.strokesDone,
        jackpots: S.jackpots,
        xpTotal: S.xpTotal,
        // 2026-10-08 3단계 — 구간 목표 금액 · 경매장 문 자리 · 1막 끝
        segment: { index: S.segment.index, earned: S.segment.earned },
        auctionDoor: { open: S.auctionDoor.open },
        act1End: { reached: S.act1End.reached, open: S.act1End.open },
        upgrades: Object.assign({}, S.upgrades),
        shopRevealed: S.shopRevealed,
        unlocked: Object.assign({}, S.unlocked),
        workbenchSlots: S.workbench.slots,
        workbenchExpanded: S.workbench.expanded,
        secondBench: Object.assign({}, S.secondBench),
        shopTabNew: S.shopTabNew,
        gallery: { unlocked: S.gallery.unlocked, items: S.gallery.items.slice() },
        artworksStarted: S.artworksStarted,
        artworksSold: S.artworksSold,
        papersBoughtByHand: S.papersBoughtByHand,
        worksSoldByHand: S.worksSoldByHand,
        autoSellOn: S.autoSellOn,
        firstSaleDone: S.firstSaleDone,
        firstNormalSaleDone: S.firstNormalSaleDone,
        phoneDone: Object.assign({}, S.phone.done),
        paperSizeKey: S.paperSizeKey,
        currentOriginalKey: S.currentOriginalKey,
        nextOriginalKey: S.nextOriginalKey,
        catalogDocked: S.catalog === "docked",
        originalLevels: Object.assign({}, S.originalLevels),
        freeSheet: S.freeSheet, // v9 · 6-A
      };
    }

    // 불러오기가 실제로 읽는 저장 항목들 (save가 적는 것과 같은 목록이다).
    // 값은 여기 적힌 이름으로 「한 번씩만」 읽는다 — 읽을 때마다 다른 값을 주는
    // 객체가 검증 단계와 적용 단계에 서로 다른 사실을 보여 주지 못하게 한다.
    // version은 저장 형식 표시라 판을 되돌리는 데 쓰지 않는다 — 옛 형식인지 알아보는 데만 쓴다.
    const SAVE_KEYS = Object.freeze([
      "version", "money", "loan", "shopNotices", "started", "windowsDone", "strokesDone",
      "jackpots", "xpTotal", "segment", "auctionDoor", "act1End",
      "upgrades", "shopRevealed", "unlocked",
      "workbenchSlots", "workbenchExpanded", "secondBench", "shopTabNew",
      "gallery", "artworksStarted", "artworksSold", "papersBoughtByHand",
      "worksSoldByHand", "autoSellOn", "firstSaleDone", "firstNormalSaleDone",
      "phoneDone", "paperSizeKey", "currentOriginalKey", "nextOriginalKey",
      "catalogDocked", "originalLevels", "freeSheet",
    ]);

    // 이 입력을 「끝까지 안전하게 읽을 수 있는가」 (2026-08-26 6차 독립 검토 대응).
    //
    // 읽을 수 없는 저장이면 여기서 null이 나오고, 그때까지 지금 판은 한 글자도
    // 바뀌지 않았다. 아래 세 문을 지나야 적용 단계로 넘어간다.
    //   1) 객체인가 — 취소된 Proxy(Proxy.revocable → revoke)는 typeof는 지나가지만
    //      Array.isArray에서 예외를 던진다. 그 예외를 밖으로 내보내지 않는다.
    //   2) JSON으로 오갈 수 있는 나무인가 — 이 판의 저장은 언제나 JSON 왕복을 지난
    //      평범한 나무다. 순환 참조, 읽다 던지는 getter, 안에 박힌 취소된 Proxy,
    //      직렬화할 수 없는 값은 전부 여기서 한 번에 걸린다.
    //   3) 필요한 항목을 실제로 한 번씩 읽어 낼 수 있는가.
    // loan만은 베끼지 않고 참조 그대로 넘긴다 — 「자기 필드인가 상속인가」는 값이
    // 아니라 객체 모양 자체라, 베끼는 순간 그 사실이 사라진다.
    function readableSave(data) {
      try {
        if (!data || typeof data !== "object" || Array.isArray(data)) return null;
      } catch (err) {
        return null; // 객체인지조차 물어볼 수 없다
      }
      try {
        JSON.stringify(data);
      } catch (err) {
        return null; // 순환·읽기 예외·직렬화 불가
      }
      const out = {};
      try {
        for (let i = 0; i < SAVE_KEYS.length; i += 1) {
          out[SAVE_KEYS[i]] = data[SAVE_KEYS[i]];
        }
      } catch (err) {
        return null;
      }
      return out;
    }

    // 읽어 둔 저장으로 「후보 판」을 세운다. 부르는 쪽(load)이 실패를 되돌린다.
    function applySave(data) {
      init(); // 지금 판을 고치는 것이 아니라 새 판 객체를 하나 만들어 건다
      const numOr = function (v, fallback) {
        const n = Number(v);
        return isFinite(n) ? n : fallback;
      };
      // 현금은 음수가 되지 않는다. (옛 저장의 debt 항목은 읽지 않고 그대로 버린다 —
      // 자동 신용 자체가 폐기됐으므로 되살릴 자리가 없다.)
      S.money = Math.max(0, Math.round(numOr(data.money, ECON.startMoney)));
      // 대출 계약 — 옛 저장에는 loan이 없거나 옛 모양이다. 없으면 init()이 이미
      // 「빈 계약」으로 두었으므로 그대로 둔다.
      //
      // 2026-08-26 동현 확정: 구형 부모판 대출 저장(원금 1,000 · 총상환 2,000 ·
      // 250원 분할)을 신형 200원 잔액으로 조용히 바꾸지 않는다. 스키마 식별자가
      // 이 판의 계약과 다르면 대출만 「신형 미체결」로 안전 초기화하고, 현금·유리창·
      // 업그레이드·해금 같은 나머지 일반 진행은 그대로 이어 간다.
      // 대출 쪽에서 무언가를 되돌렸으면 그 한 줄이 마지막 기록을 가져간다. 아래에서
      // 평범한 「불러왔습니다」로 덮어 버리면 되돌린 사실이 화면에서 사라진다.
      //
      // 2026-08-26 5차 독립 검토 대응: 스키마도 저장 항목 「자신의」 문자열 필드여야
      // 지금 계약의 저장으로 인정한다. Object.create({schema, ...pending}) 처럼
      // 프로토타입에 올려 둔 스키마는 최신 정상 저장으로 통과시키지 않는다.
      // 그렇다고 구형 저장 안전 초기화(아래 첫 갈래)로 보내지도 않는다 — 그 길은
      // 대출을 빈 계약으로 되돌리므로 평생 1회가 초기화돼 오히려 더 큰 우회가 된다.
      // 핵심 필드가 하나라도 상속으로 들어와 있으면 아래 정규화(loanFromSave)가
      // 격리 상태로 되돌리고 그 사실을 그대로 밝힌다.
      let loanNotice = "";
      const loanInherited = (data.loan && typeof data.loan === "object")
        ? State.loanInheritedKeys(data.loan, State.LOAN_SAVE_CORE_KEYS) : [];
      const loanSchemaOwn = (data.loan && typeof data.loan === "object")
        ? State.loanOwnField(data.loan, "schema") : undefined;
      if (data.loan && typeof data.loan === "object"
        && loanInherited.length === 0 && loanSchemaOwn !== LOAN_SAVE_SCHEMA) {
        S.loan = State.emptyLoan();
        pushEvent("loanSaveIncompatible", {
          found: typeof loanSchemaOwn === "string" ? loanSchemaOwn : null,
          expected: LOAN_SAVE_SCHEMA,
        });
        loanNotice = "예전 판의 대출 기록은 지금 계약과 호환되지 않아 "
          + "대출 없음 상태로 되돌렸습니다 — 나머지 진행은 그대로입니다";
      } else if (data.loan && typeof data.loan === "object") {
        // 2026-08-26 독립 검토 대응: 스키마가 같아도 「비분할 계약에서 성립할 수 없는」
        // 조합은 그대로 받지 않는다. 옛 방식은 잔액을 0~200으로 자르기만 해서, 같은
        // 스키마 저장에 100원을 넣으면 그 100원이 총상환액 행세를 했다(현금 120원 ·
        // 잔액 100원으로 재현). 이제 계약이 인정하는 잔액(200원 또는 0원)과 성립하는
        // 상태 조합만 통과하고, 되돌린 것이 있으면 그 사실을 그대로 밝힌다.
        const parsed = State.loanFromSave(data.loan);
        S.loan = parsed.loan;
        // 2026-08-26 동현 승인: 되돌린 계약 위에 「고른 불이익」과 「완납 건수」를
        // 얹는다. 빚이 남았는데 승인 목록 밖의 값이 적혀 있으면 규칙이 승인값으로
        // 채우고, 빚이 없으면 언제나 null이다 (State.loanPenaltyFromSave).
        S.loan.penalty = State.loanPenaltyFromSave(data.loan, S.loan);
        // 완납 건수는 두 증거 중 큰 쪽을 쓴다 — 저장이 직접 적어 둔 칸과, 저장의
        // 모양 자체가 증언하는 완납(서명 + 잔액 0원)이다. 두 번째가 있어야 완납 칸이
        // 없던 시절의 저장에서도 「이미 한 번 갚았다」는 이력이 사라지지 않는다.
        S.loan.repaid = Math.max(State.loanRepaidCount(data.loan), parsed.repaid || 0);
        if (parsed.repaired) {
          // 저장에 실제로 들어 있던 값을 그대로 밝힌다. !!나 Number()로 바꿔 적으면
          // 「무엇이 어떻게 이상했는가」가 기록에서 사라진다 — null·""·"0"·"true"가
          // 전부 false·0으로 뭉개져 우회 흔적을 지운다.
          const asFound = function (v) {
            if (v === null || v === undefined) return v === undefined ? undefined : null;
            const t = typeof v;
            if (t === "boolean" || t === "number" || t === "string") return v;
            return Array.isArray(v) ? "[array]" : "[" + t + "]";
          };
          // 2026-08-26 5차 검토 대응: 밝히는 값도 저장 자신의 필드에서만 읽는다.
          // 상속된 값을 「저장에 들어 있던 값」이라고 적으면, 무엇이 자기 필드였고
          // 무엇이 프로토타입에서 왔는지가 기록에서 사라진다. 상속된 키는 따로 센다.
          const found = State.loanOwnFields(data.loan, State.LOAN_SAVE_CORE_KEYS).own;
          // 되돌린 결과가 실제로 어떤 상태인가 — 알림이 결과와 어긋나지 않게 한다.
          // 2026-08-26 동현 승인(재대출): 완납한 계약은 서명 상태로 되살아나지 않고
          // 빈 새 계약 + 완납 건수로 이행한다. 그래서 「이미 갚은 판인가」는 서명
          // 플래그가 아니라 규칙이 돌려준 완납 건수(parsed.repaid)로 읽는다.
          const mode = S.loan.signed === true
            ? (S.loan.balance > 0 ? "active" : "cleared")
            : (parsed.repaid > 0 ? "cleared"
              : (S.loan.declined ? "quarantined"
                : (S.loan.accepted ? "unsignedOffer" : "none")));
          pushEvent("loanSaveRepaired", {
            fixed: parsed.fixed.slice(),
            found: {
              signed: asFound(found.signed),
              accepted: asFound(found.accepted),
              declined: asFound(found.declined),
              revealed: asFound(found.revealed),
              offered: asFound(found.offered),
              balance: asFound(found.balance),
            },
            // 자기 필드가 아니라 프로토타입에서 읽힌(또는 읽다 실패한) 키들.
            inherited: loanInherited.slice(),
            mode: mode,
            balance: S.loan.balance, // 되돌린 잔액
            totalDue: State.LOAN_RULES.totalDue,
          });
          const tail = mode === "active"
            ? "갚을 총액은 " + State.LOAN_RULES.totalDue + "$ 그대로입니다"
            : mode === "cleared"
              // 2026-08-26 동현 승인: 완납은 계약을 닫을 뿐 대출 자체를 닫지 않는다.
              // 「다시 받을 수 없다」고 말하면 화면이 폐기된 평생 1회를 되살린다.
              ? "이미 모두 갚은 계약이라 갚을 빚은 없습니다 — 새 위기가 오면 "
                + "대출 전화가 다시 열립니다"
              : mode === "quarantined"
                // 「대출 없음」이라고만 말하면 새 대출이 가능한 것처럼 읽힌다.
                // 이 판의 평생 1회는 이미 쓴 것으로 처리했다는 사실을 그대로 말한다.
                ? "이 판의 대출 기회는 이미 쓴 것으로 처리했습니다 — 갚을 빚은 없지만 "
                  + "다시 제안·서명되지 않습니다"
                : mode === "unsignedOffer"
                  ? "아직 서명하지 않은 계약서 상태이며 받은 대출금은 없습니다"
                  : "대출 없음 상태이며 갚을 총액 " + State.LOAN_RULES.totalDue
                    + "$ 계약도 걸려 있지 않습니다";
          loanNotice = "저장된 대출 기록이 지금 계약과 맞지 않아 안전하게 되돌렸습니다 — "
            + tail + " · 나머지 진행은 그대로입니다";
        }
      }
      if (data.shopNotices && typeof data.shopNotices === "object") {
        Object.keys(data.shopNotices).forEach(function (key) {
          const n = data.shopNotices[key];
          if (!n || typeof n !== "object") return;
          S.shopNotices[key] = { popupShown: !!n.popupShown, isNew: !!n.isNew };
        });
      }
      S.started = data.started !== false;
      S.windowsDone = Math.max(0, Math.round(numOr(data.windowsDone, 0)));
      S.strokesDone = Math.max(0, Math.round(numOr(data.strokesDone, 0)));
      S.jackpots = Math.max(0, Math.round(numOr(data.jackpots, 0)));
      // 2026-10-08 3단계: 경험치·레벨을 없앴다. 옛 저장에 경험치가 쌓여 있어도 레벨은 1이다
      // (판매가 보너스 없음 — 형님 6-A). 경험치 칸은 저장 모양을 지키려고 0으로만 둔다.
      S.xpTotal = 0;
      S.level = 1;
      // 구간 목표 금액 — 없거나 이상한 값이면 처음(구간 1 · 0원)부터. 옛 저장은 구간이 없다.
      if (data.segment && typeof data.segment === "object") {
        S.segment.index = Math.max(0, Math.min(SEG.goals.length,
          Math.round(numOr(data.segment.index, 0))));
        S.segment.earned = S.segment.index >= SEG.goals.length ? 0
          : Math.max(0, Math.min(SEG.goals[S.segment.index] - 1,
            Math.round(numOr(data.segment.earned, 0))));
      }
      // 경매장 문은 구간 2를 넘은 판에서만 열려 있다 — 저장 글자와 구간이 어긋나면 구간을 믿는다.
      S.auctionDoor.open = S.segment.index >= SEG.rewards.indexOf("auctionDoor") + 1;
      // 1막 끝도 구간이 정한다. 화면을 띄운 채 저장했으면 다시 띄운다(시계도 함께 멈춤).
      S.act1End.reached = S.segment.index >= SEG.goals.length;
      S.act1End.open = S.act1End.reached && !!(data.act1End && data.act1End.open);
      if (S.act1End.open) S.paused = true;
      if (data.upgrades && typeof data.upgrades === "object") {
        State.UPGRADE_KEYS.forEach(function (key) {
          // 2026-10-08 3단계: 단계 수를 그 항목의 최고 단계로 자른다 — 옛 저장의 잉크통 2단계(7-A로 뺌)는 1단계로 읽는다.
          const u = State.upgradeByKey(key);
          S.upgrades[key] = Math.max(0, Math.min(u ? u.maxLevel : 0,
            Math.round(numOr(data.upgrades[key], 0))));
        });
      }
      S.shopRevealed = Math.max(0, Math.min(UPGRADES.length,
        Math.round(numOr(data.shopRevealed, 0))));
      if (data.unlocked && typeof data.unlocked === "object") {
        ["paper", "catalog", "shop", "gallery"].forEach(function (key) {
          S.unlocked[key] = !!data.unlocked[key];
        });
      }
      S.workbench.slots = Math.max(1, Math.min(EXP.maxSlots,
        Math.round(numOr(data.workbenchSlots, 1))));
      S.workbench.expanded = !!data.workbenchExpanded;
      if (data.secondBench && typeof data.secondBench === "object") {
        S.secondBench.unlocked = !!data.secondBench.unlocked;
        S.secondBench.seen = !!data.secondBench.seen;
        S.secondBench.purchased = !!data.secondBench.purchased;
      }
      // 2026-10-06 두 방 데모 B-1: 작업대 확장 제외. 옛 저장에 「두 대 · 상품 열림/구매」가 남아 있어도
      // 한 대 · 상품 없음으로 읽는다(칸 수는 위에서 maxSlots 1로 이미 잘린다. 진행 중 작품은 원래 저장되지 않는다).
      if (!EXP.secondWorkbenchOffered) {
        S.workbench.slots = 1;
        S.workbench.expanded = false;
        S.secondBench.unlocked = false;
        S.secondBench.seen = false;
        S.secondBench.purchased = false;
      }
      S.shopTabNew = !!data.shopTabNew;
      if (data.gallery && typeof data.gallery === "object") {
        S.gallery.unlocked = !!data.gallery.unlocked;
        S.gallery.items = Array.isArray(data.gallery.items)
          ? data.gallery.items.slice(0, EXP.gallerySlots) : [];
      }
      S.artworksStarted = Math.max(0, Math.round(numOr(data.artworksStarted, 0)));
      S.artworksSold = Math.max(0, Math.round(numOr(data.artworksSold, 0)));
      S.papersBoughtByHand = Math.max(0, Math.round(numOr(data.papersBoughtByHand, 0)));
      S.worksSoldByHand = Math.max(0, Math.round(numOr(data.worksSoldByHand, 0)));
      S.autoSellOn = data.autoSellOn !== false;
      S.firstSaleDone = !!data.firstSaleDone;
      S.firstNormalSaleDone = !!data.firstNormalSaleDone;
      if (data.phoneDone && typeof data.phoneDone === "object") {
        S.phone.done.paper = !!data.phoneDone.paper;
        S.phone.done.ink = !!data.phoneDone.ink;
        // 2026-08-27 유리 A 승인 — 첫 파손 안내를 이미 들었는가. 이 열쇠가 없는
        // 구형 저장은 「아직 못 들었다」로 읽힌다 (안내가 한 번 더 오는 쪽이 안전하다).
        S.phone.done.glassBreak = !!data.phoneDone.glassBreak;
      }
      if (typeof data.paperSizeKey === "string") S.paperSizeKey = data.paperSizeKey;
      // 2026-10-08 4단계: 원작 레벨표. 없거나 이상한 값이면 「뮤나리자 레벨 1만 가진 판」으로 읽는다.
      // 처음부터 가진 원작(뮤나리자)은 레벨이 0으로 내려가지 않고, 레벨은 0~최고 레벨로 자른다.
      S.originalLevels = State.startingOriginalLevels();
      if (data.originalLevels && typeof data.originalLevels === "object" && !Array.isArray(data.originalLevels)) {
        State.ORIGINAL_TEST_VALUES.list.forEach(function (o) {
          const v = Math.max(0, Math.min(State.ORIGINAL_TEST_VALUES.maxLevel,
            Math.round(numOr(data.originalLevels[o.key], o.startOwned ? 1 : 0))));
          S.originalLevels[o.key] = o.startOwned ? Math.max(1, v) : v;
        });
      }
      S.currentOriginalKey = typeof data.currentOriginalKey === "string"
        ? data.currentOriginalKey : null;
      S.nextOriginalKey = typeof data.nextOriginalKey === "string"
        ? data.nextOriginalKey : null;
      // 가지지 않은 원작이 골라져 있던 저장(3단계까지는 아무 원작이나 고를 수 있었다)은 뮤나리자로 되돌린다.
      if (S.currentOriginalKey && !ownsOriginal(S.currentOriginalKey)) S.currentOriginalKey = "mewna-lisa";
      if (S.nextOriginalKey && !ownsOriginal(S.nextOriginalKey)) S.nextOriginalKey = null;
      // 잉크통 단계도 지금 열린 단계까지만(진주 고양이 없이 2단계였던 옛 저장 → 1단계).
      // v9: 오른쪽 세 칸(스퀴지 재질 · 구간 관문)도 같은 규칙으로 자른다.
      State.ALL_UPGRADES.forEach(function (u) {
        S.upgrades[u.key] = Math.min(S.upgrades[u.key], upgradeCap(u));
      });
      // v9 · 6-A: 무료 한 장 상태. 모르는 값이면 잉크통을 이미 샀는지로 읽는다(샀으면 「이미 씀」 — 공짜를 두 번 주지 않는다).
      S.freeSheet = ["none", "ready", "used"].indexOf(data.freeSheet) >= 0 ? data.freeSheet
        : (S.upgrades.inkTank >= 1 ? "used" : "none");
      if (S.freeSheet === "none" && S.upgrades.inkTank >= 1) S.freeSheet = "used";
      S.catalog = data.catalogDocked ? "docked" : "none";
      S.ink.capacity = inkCapacity();
      // 2026-10-08 3단계 별도 검수: 옛 저장(형식 2 이하)의 shopRevealed는 「옛 카드 순서에서 앞에서 몇 칸」이다.
      // 3단계에서 순서가 바뀌어 그대로 읽으면 다른 카드가 열려 보이고, 이미 산 자동구매 카드가 숨는다.
      // 그래서 새 순서로 다시 센다: 앞에서부터 「이미 샀거나 지금 조건으로 열릴」 카드가 이어지는 데까지만 연다.
      // 아직 조건이 안 된 카드를 건너뛰어 열지 않는다 — 그래야 구간이 낮은데 잉크 질 같은 뒤 카드를 살 수 있게 되는 일이 없다.
      // (그 뒤에 옛 판에서 이미 산 카드가 있으면 효과는 그대로 살아 있고, 카드는 차례가 오면 보인다.)
      // (비유: 진열대 순서를 바꾼 뒤 「앞에서 세 칸까지 진열」이라는 옛 메모를 믿지 않고, 진열할 물건을 앞에서부터 다시 세는 것)
      if (!(numOr(data.version, 0) >= 3)) {
        let open = 0;
        while (open < UPGRADES.length && (S.upgrades[UPGRADES[open].key] > 0 || upgradeReady(open))) open += 1;
        S.shopRevealed = open;
        if (S.shopRevealed > 0) S.unlocked.shop = true;
      }
      // 되돌린 것이 있으면 그 사실을 말한다 — 평범한 안내로 덮어 숨기지 않는다.
      S.lastEvent = loanNotice
        || "저장한 상태를 불러왔습니다 — 작업대는 비운 채로 이어집니다";
      pushEvent("loaded", { money: S.money, version: SAVE_VERSION });
      // ── 정식 전화 제안 상태의 복원 (2026-08-26 5차 독립 검토 대응) ──
      //
      // 저장은 대출의 offered만 담고 전화 진행 상태(울리는 중·몇 장째)는 담지 않는다.
      // 그래서 「현금 0원 위기로 대출 전화가 울린 직후」를 저장하고 다시 불러오면
      // offered:true는 복원되는데 전화는 닫혀 있었다. 새 위기도 offered:true 때문에
      // 전화를 다시 열지 않아, 현금 0원·회복할 작품 없음에서 유일한 회복 수단이
      // 통째로 사라지는 영구 교착이 실제로 재현됐다.
      //
      // 전화 진행 상태 전체를 새 저장 스키마로 확대하지 않고, 그 한 통을 여기서
      // 안전하게 다시 건다 — 플레이어는 권유를 처음 장부터 다시 읽고 마지막 장에서
      // 수락·거절을 고른다. 이 복원은 offered를 몰래 지우지도, 현금을 주지도,
      // 자동 수락하지도 않는다. 열리는 것은 「울리는 전화」 하나뿐이다.
      //
      // 조건은 규칙이 인정하는 정식 「전화 제안 중」 조합 그 하나뿐이다. 계약서 대기
      // (수락 완료)·활동 200원·완납 0원·거절·손상 격리는 여기서 걸러진다.
      if (loanOfferCallPending() && !S.phone.open && !S.phone.ringing) {
        ring("loan");
        pushEvent("loanOfferRestored", { source: "load" });
      }
      return true;
    }

    // 저장을 읽어 지금 판을 그 상태로 되돌린다.
    // 망가진 값이면 아무것도 바꾸지 않고 false를 돌려준다 — 반쯤 읽힌 판을 만들지 않는다.
    //
    // 2026-08-26 6차 독립 검토 대응: 예전에는 검증을 다 끝내기 전에 init()을 먼저
    // 불렀다. 그래서 읽다 예외가 나는 저장(취소된 Proxy 같은 값)을 주면 지금 판이
    // 이미 새 판으로 지워진 뒤에 실패했다 — 현금도 대출도 작품도 통째로 날아갔다.
    //
    // 이제 순서가 뒤집혔다.
    //   1) 안전하게 읽을 수 있는지부터 확인한다 (readableSave). 여기까지 지금 판은
    //      한 글자도 바뀌지 않는다.
    //   2) 값 자체가 판을 이어 갈 수 있는 저장인지 본다 (현금이 진짜 숫자인가).
    //   3) 그 다음에야 후보 판을 세운다. init()은 지금 판 객체를 고치는 것이 아니라
    //      새 객체를 만들어 거는 것이라, 예전 판은 아래 세 변수에 그대로 살아 있다.
    //      적용 도중 무엇이 터져도 그 셋을 그대로 다시 걸면 판이 되돌아온다.
    // 실패한 불러오기는 사건 한 줄도 남기지 않는다 — 기존 판에 새 기록을 쓰는 것
    // 자체가 「현재 판 불변」을 깨기 때문이다. 돌려주는 것은 false 하나뿐이다.
    function load(input) {
      const data = readableSave(input);
      if (!data) return false;
      if (typeof data.money !== "number" || !isFinite(data.money)) return false;
      if (!(Number(data.version) >= SAVE_VERSION)) return false; // v9: 형식 5 이하(옛 원작 키 · 경제 숫자) 저장은 읽지 않는다
      const prevS = S;
      const prevTimers = timers;
      const prevEvents = events;
      try {
        return applySave(data);
      } catch (err) {
        S = prevS;
        timers = prevTimers;
        events = prevEvents;
        return false;
      }
    }

    return {
      CONSTANTS: CONSTANTS,
      SAVE_VERSION: SAVE_VERSION,
      STAGE_NAMES: STAGE_NAMES,
      GROUP_OFF: GROUP_OFF,
      PLATE_GROUPS: PLATE_GROUPS,
      start: function () {
        if (S.started) return false;
        S.started = true;
        S.lastEvent = "유리창 알바로 돈을 모아 보세요";
        return true;
      },
      reset: function () { init(); },
      // 2026-08-26 — 저장·불러오기. 저장에는 debt가 들어가고, debt가 없는 옛 저장은
      // 0으로 안전하게 읽는다. 플레이어가 돈을 빌리는 경로는 여기에도 없다.
      save: save,
      load: load,
      setRandom: function (fn) { rng = fn || Math.random; },
      setJackpotRandom: function (fn) { jackpotRng = fn || function () { return rng(); }; },
      tick: tick,
      // 내부 참조 — 화면 그리기 전용 (테스트·검수는 getState 사용)
      view: function () { return { S: S, clock: S.clock }; },
      drainEvents: function () {
        const out = events;
        events = [];
        return out;
      },
      getState: getState,
      // 행동
      startWindowJob: startWindowJob,
      windowWheel: windowWheel,
      windowKey: function () {
        if (!canInteract() || S.mode !== "window" || !S.window || S.window.swapping) return false;
        return windowAdvance(C.KEY_ROWS * windowRowsPerNotch());
      },
      completeWindowStroke: completeWindowStroke,
      completeWindow: completeWindow,
      // 2026-08-26 v1 — 스크래치식 대출. 전화 → 수락/거절 → 서명 한 번 → 전액 상환.
      acceptLoanOffer: acceptLoanOffer,
      declineLoanOffer: declineLoanOffer,
      signLoanContract: signLoanContract,
      repayLoan: repayLoan,
      answerPhone: answerPhone,
      advancePhone: advancePhone,
      prevPhone: prevPhone,
      closePhone: closePhone,
      clickCatalog: clickCatalog,
      buyPaper: buyPaper,
      // 2026-10-20 v9 — 한 장 제작(왼쪽 원작 카드) · 오른쪽 세 칸은 buyUpgrade(키)로 산다
      makeSheet: function (key) { return makeSheet(key, false); },
      printWheel: printWheel,
      printKey: printKey,
      // ── 2026-08-26 v1 계약 5항 — 작업대별 독립 입력 ──────────────────
      // 포인터가 올라간 작업대를 입력 대상으로 삼고(focusBench), 그 대에만
      // 휠·아래 화살표를 넣는다. 다른 작업대의 진행도·등급·잉크는 움직이지 않는다.
      // 2026-08-26 동현 확정: 검수용 동시 제작을 골라 둔 상태에서도 마찬가지다.
      // 대상 판정이 실패하면 그대로 false다 — 전체 입력으로 떨어지는 우회는 없다.
      focusBench: focusBench,
      printWheelAt: function (slot, deltaY) {
        return runOnBench(slot, function () { return printWheel(deltaY); });
      },
      printKeyAt: function (slot) {
        return runOnBench(slot, function () { return printKey(); });
      },
      performPrintStroke: performPrintStroke,
      finishPrint: finishPrint,
      extraPrint: extraPrint,
      performExtraPrint: performExtraPrint,
      sellNow: sellNow,
      buyUpgrade: buyUpgrade,
      // 2026-10-08 4단계 — 경매장 문에서 다음 매물을 예상가로 얻는다(임시 · 5단계에서 난수 낙찰로)
      buyAuctionLot: buyAuctionLot,
      closeAct1End: closeAct1End, // 2026-10-08 3단계 — 「1막 끝」 화면의 「계속 하기」
      // 2026-08-12 — 유료 두 번째 작업대. 확인(알림 끄기)과 구매(60원)는 별개 행동이다.
      confirmWorkbenchCard: confirmWorkbenchCard,
      // 2026-08-26 v1 계약 6항 — 상점 카드를 확인하면 그 카드의 팝업·NEW가 함께 꺼진다.
      confirmShopCard: confirmShopCard,
      buySecondWorkbench: buySecondWorkbench,
      chooseOriginal: chooseOriginal,
      // 라운드 005 — 결과판 처리·첫 갤러리 전시·검수 전용 돈
      sellWork: sellWork,
      displayWork: displayWork,
      addReviewMoney: addReviewMoney,
      // 2026-08-26 v1 — 검수 전용 「현금을 이 금액으로」 손잡이 (위기·전액 상환 재현용)
      setReviewMoney: setReviewMoney,
      // 2026-08-19 — 자동판매 켜고 끄기 (산 뒤에만 동작한다)
      setAutoSell: setAutoSell,
      // 2026-08-19 — 검수 전용 잉크 (3·4번째 작업대 겉모습 검수용)
      addReviewInk: addReviewInk,
      prepareReviewArtworks: prepareReviewArtworks,
      // 2026-08-15 — 검수 전용 제작 전환 (작업대 1~4 · 동시 제작 해금 · 순차/동시 선택).
      // 돈·경험치·판매수·상점·업그레이드·자연 상품 해금은 하나도 건드리지 않는다.
      setReviewWorkbenchCount: setReviewWorkbenchCount,
      setReviewSimultaneousUnlock: setReviewSimultaneousUnlock,
      setReviewProductionMode: setReviewProductionMode,
      // 라운드 001 — 첫 판매 손실 결과의 「확인」
      confirmLoss: confirmLossResult,
      // 2026-08-19 라운드 006 — D키 디버그 창 (유리창 3항목).
      // 돈·경험치·판매수·해금을 직접 건드리지 않는다. 유리창 규칙 값만 갈아 끼운다.
      toggleDebug: toggleDebug,
      setDebugValue: setDebugValue,
      // 2026-08-19 — 디버그 즉시 실행 명령 6종
      runDebugAction: runDebugAction,
    };
  }

  const exported = {
    createEngine: createEngine,
    // 저장된 대출이 이 판의 계약인지 검사하는 식별자 (검수·저장 도구가 함께 읽는다).
    LOAN_SAVE_SCHEMA: LOAN_SAVE_SCHEMA_ID,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported; // Node 테스트용
  }
  root.MewnaEngine = exported; // 브라우저용 전역
})(typeof globalThis !== "undefined" ? globalThis : this);
