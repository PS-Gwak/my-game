// 뮤나리자 B 플레이 데모 — 경제 시험값·확률 규칙·성장 규칙·전화 대본
// (순수 데이터, DOM 없음).
//
// 이 파일의 숫자는 전부 「시험값」이다. 최종 밸런스가 아니라 이번 흐름을
// 검증하기 위한 임시 숫자이며, 확정 규칙은 정본 인계 문서를 따른다.
// (브라우저에서는 window.MewnaState 전역, Node 테스트에서는 require()로 읽는다 —
//  file:// 더블클릭 실행을 막지 않으려고 ES 모듈 대신 겸용 방식을 쓴다.)
"use strict";

(function (root) {
  // ── 2026-08-26 확정 유리창 표 (C 작업 관제 통합판) ─────────────────
  // 여기 숫자는 2026-08-26 동현이 확정한 값이며, 부모판(2026-08-25 회의 전 추천안)의
  // 유리창 시험값 표를 통째로 대신한다.
  //   옛값: 레벨 0 = 100%·25원(선투자 없음) · 레벨 1 = 85%·33원 / 5%·66원 / 10%·파손 33원
  //   새값: 아래 그대로. 「선투자 → 보수」 구조가 새로 들어와 총보수와 순이익이 갈린다.
  //
  //   · 유리창 한 장을 「시작할 때」 선투자 20원을 먼저 낸다 (upfrontCost).
  //     한 장에 한 번뿐이고 작업 도중에는 절대 다시 빠지지 않는다.
  //   · 레벨 0 = 유리창 1~4장. 일반 성공 100% · 총보수 40원.
  //     선투자를 빼면 순이익은 장당 20원이다.
  //   · 네 장을 끝내면 레벨 1로 오르고, 그 순간 잔고가 정확히 도화지값 100원이 된다.
  //     시작 현금 20 + 4장 × 순이익 20 = 100원 — 손으로 셀 수 있는 숫자다.
  //   · 레벨 1 = 일반 85%·총보수 53원 / 대성공 5%·총보수 86원 / 파손 10%.
  //     순이익으로 읽으면 33원 / 66원 / −40원이다.
  //     동현이 말한 「90% 성공 / 10% 파손」은 일반 85% + 대성공 5% = 90%로 지켜진다.
  //     대성공은 플레이어에게 숨은 확률이라 확률표에서는 성공 90%에 합쳐 보이고
  //     86원이라는 금액도 표에 싣지 않는다 (windowPublicTable 참고).
  //   · 파손은 보수 0원이고, 이미 낸 선투자 20원에 추가 배상 20원이 더 빠져
  //     한 장에 총 40원이 사라진다 (WINDOW_COSTS.breakTotalLoss).
  //
  // ── 2026-10-12 v5 · 1달러 단위 (형님 10/8 10-A · 10/12 작업실 설계표 2절) ──
  // 위 구조(선투자 → 보수 · 4장 뒤 레벨 1 · 대성공 숨김)는 그대로 두고 숫자만 1달러 단위로 줄였다.
  // 스크리치의 접시 닦기(1달러 넣고 2달러)와 같은 출발이다.
  //   · 레벨 0 = 선투자 1 → 보수 2 (순이익 1). 시작 현금 1 + 4장 × 1 = 5 = 뮤나리자 재료비.
  //   · 레벨 1 = 일반 85% · 3 / 대성공 5% · 5 / 파손 10% (보수 0 + 배상 1 = 총손실 2).
  const WINDOW_RULES = Object.freeze({
    levelUpWindows: 4, // 완료한 유리창 개수 조건 — 돈 조건이 아니다
    // 한 장을 시작할 때 먼저 내는 노동비. 한 장에 한 번만 나간다.
    upfrontCost: 1,
    tables: Object.freeze([
      // 레벨 0 — 총보수 2 (선투자 1을 빼면 순이익 1)
      Object.freeze([
        Object.freeze({ key: "normal", chance: 1, pay: 2, label: "창문 한 장 완성" }),
      ]),
      // 레벨 1 — 구간 순서는 일반 → 대성공 → 파손
      Object.freeze([
        Object.freeze({ key: "normal", chance: 0.85, pay: 3, label: "창문 한 장 완성" }),
        Object.freeze({ key: "jackpot", chance: 0.05, pay: 5, label: "아주 깨끗하게 닦았다!" }),
        // 보수 0 + 추가 배상 1. 이미 낸 선투자 1까지 합쳐 총손실 2다.
        Object.freeze({ key: "fail", chance: 0.1, pay: 0, label: "유리창 파손" }),
      ]),
    ]),
  });

  // ── 유리창 노동비 (2026-08-26 v1 재설계) ───────────────────────────
  // 옛 DEBT_RULES(자동 신용)는 폐기됐다. 게임이 저절로 붙이는 무이자 빚(debt)도,
  // 수입이 그 빚부터 갚던 자동 상환 흐름도 이 판에 남아 있지 않다.
  // 여기 남는 것은 「유리창 한 장에 얼마가 드는가」라는 값뿐이다.
  //   · 선투자 20원 — 한 장을 처음 밀 때 한 번 나간다. 낼 현금이 모자라면 빚지지 않고
  //     그냥 행동이 막힌다 (도화지·업그레이드·작업대 구매와 같은 규칙).
  //     2026-08-26 동현 확정: 전액 아니면 0이다. 가진 돈만 내고 시작하거나 보수에서
  //     부족분을 후불 정산하는 외상 경로는 없고, 막힌 자리에서 위기 대출 전화가 열린다.
  //     그래서 총보수는 늘 원금액 그대로이고 대출 중 50% 삭감도 그 원금액에서 센다.
  //   · 파손 배상 20원 — 이미 낸 선투자까지 합쳐 한 장에 총 40원이 사라진다.
  //     낼 현금이 모자라면 가진 만큼만 나가고 현금은 0에서 멈춘다. 빚은 생기지 않고,
  //     그 대신 「돈이 없어 비용을 못 냈다」는 위기가 대출 전화를 부른다.
  // (2026-10-12 v5: 1달러 단위 — 선투자 1 · 배상 1 · 총손실 2)
  const WINDOW_COSTS = Object.freeze({
    upfront: 1, // 유리창 한 장 선투자 (WINDOW_RULES.upfrontCost와 같은 값)
    breakCompensation: 1, // 파손 때 추가로 물어내는 배상액
    breakTotalLoss: 2, // 선투자 1 + 배상 1 — 파손 한 장의 총손실
    autoCredit: false, // 자동 신용은 폐기됐다 — 못 내면 빚이 아니라 차단이다
  });

  // ── 유리창 밀대 기본 속도 (2026-08-26 v1 · 0825 피드백) ────────────
  // 「기본 유리창 밀대 속도는 부모판 기본값의 50%로 낮춘다.」
  // 인쇄 스퀴지는 손대지 않는다 — 두 도구는 서로의 값을 읽지 않는다는 규칙 그대로다.
  // 디버그 창의 windowScrollSpeed 배율은 이 값 위에 그대로 곱해진다.
  const WINDOW_BASE_SPEED_SCALE = 0.5;

  // ── 스크래치식 대출 계약 (2026-08-26 v1 재설계 · 시험값) ────────────
  // 이 판에 남은 유일한 빚이다. 계약서는 상시 클릭 시작점이 아니라, 돈이 없어
  // 막히는 한 번의 위기에서 걸려 오는 전화로만 열린다.
  //   · 사건 순서(레퍼런스 정본) — 전화 권유 → 수락 → 계약서 → 서명 → 100원 지급 →
  //     악조건 공개. 수락은 계약서를 열 뿐이고 돈이 오가지 않는다.
  //   · 대출금 100원 — 서명하는 그 순간에 지급된다.
  //   · 이자율 100% — 서명하기 전에는 크게 말하지 않는다.
  //   · 총상환 200원 — 서명 「직후」 반전으로 공개한다.
  //   · 분할 상환은 없다. 언제나 200원을 한 번에 전액 갚는다. 갚을 수 있는 현금
  //     조건은 회복할 작품이 있으면 200원부터, 없으면 220원부터다(아래 repayCashNeeded).
  //   · 잔액이 남아 있는 동안 아래 승인된 「약한」 불이익 셋 중 정확히 하나만 걸린다.
  //   · 제안도 수락도 한 계약당 각각 한 번뿐이다. 다만 완납하면 그 계약이 끝나고,
  //     그 뒤 새 위기가 오면 같은 전화가 처음부터 다시 열린다 (재대출).
  // 금액·이자·불이익은 계약이 못박은 값이라 임의로 조정하지 않는다.
  // (2026-10-12 v5: 1달러 단위 — 5 받고 10 갚기. 받는 돈 : 갚는 돈 = 1 : 2 그대로)
  const LOAN_RULES = Object.freeze({
    principal: 5, // 서명하면 즉시 들어오는 현금
    interestRate: 1, // 100% — 서명 직후 반전으로 밝혀진다
    totalDue: 10, // 갚아야 할 총액 = principal × (1 + interestRate)
    lifetimeOffers: 1, // 한 계약당 제안 횟수 (완납하면 다음 계약이 새로 시작된다)
  });

  // ── 대출 불이익 3종 택1 (2026-08-26 동현 승인 · 부모 계약 7항 대체) ──
  //
  // 이 승인은 「잔액이 남는 동안 핵심 반복 수입 50% 삭감」과 「완납해도 재대출 없음」
  // 둘을 함께 대체한다. 이제 서명된 대출 한 건마다 아래 셋 중 정확히 하나만 걸리고,
  // 세 시험값 크기는 모두 10%다. 완납하면 그 불이익이 즉시 풀린다.
  //   salePriceDown — 작품 판매로 실제로 들어오는 돈이 10% 줄어든다 (내림)
  //   shopPriceUp   — 상점 카드가 말하는 값과 실제로 나가는 돈이 10% 오른다 (반올림)
  //   toolSlowdown  — 밀대가 실제로 미는 양이 10% 줄어든다
  // 크기는 세 줄이 따로 갖지 않고 아래 상수 하나에서만 나온다.
  // 2026-10-16 v8 · 형님 그릴미 3-B · 21-A: 대출은 「이자만」(5$ 빌리고 10$ 갚기) — 갚기 전 불이익은 걸지 않는다.
  // 불이익 목록 · 저장 검증은 기록용으로 그대로 두고(옛 저장 읽기 · 손댄 저장 막기 그대로), 효과와 안내만 끈다.
  // 나중에 불이익을 다시 들일지는 별도 판단(기둥 2-9) — 이 한 줄을 true로 바꾸면 v7까지의 불이익이 돌아온다.
  const LOAN_PENALTY_ON = false;
  const LOAN_PENALTY_MAGNITUDE = 0.1;
  const LOAN_PENALTIES = Object.freeze([
    Object.freeze({
      key: "salePriceDown",
      label: "판매가 하락",
      magnitude: LOAN_PENALTY_MAGNITUDE,
      short: "판매가 10% ↓",
      line: "작품 판매 수령액 10% 감소",
    }),
    Object.freeze({
      key: "shopPriceUp",
      label: "상점가 상승",
      magnitude: LOAN_PENALTY_MAGNITUDE,
      short: "상점가 10% ↑",
      line: "상점 물건값 10% 인상",
    }),
    Object.freeze({
      key: "toolSlowdown",
      label: "도구 감속",
      magnitude: LOAN_PENALTY_MAGNITUDE,
      short: "밀대 10% 느림",
      line: "밀대가 미는 양 10% 감소",
    }),
  ]);

  // 이 값이 「승인된 불이익」인가 — 맞으면 규칙 파일이 가진 정본 객체를 돌려준다.
  //
  // 대출 상태의 다른 값들과 같은 원칙을 쓴다. 자기 필드로 적힌 key 하나만 사실로
  // 읽고, 상속·비문자열·목록 밖의 값은 「불이익 없음」으로 읽는다. 크기(magnitude)는
  // 저장에서 읽지 않고 언제나 이 목록에서 다시 가져온다 — 손댄 저장이 10%를
  // 90%로 부풀리거나 0%로 지우는 길을 함께 닫는다.
  function validLoanPenalty(raw) {
    let key;
    try {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
      if (!Object.prototype.hasOwnProperty.call(raw, "key")) return null;
      key = raw.key;
    } catch (err) {
      return null; // 읽을 수 없는 값은 불이익으로 세지 않는다
    }
    if (typeof key !== "string") return null;
    for (let i = 0; i < LOAN_PENALTIES.length; i += 1) {
      if (LOAN_PENALTIES[i].key === key) return LOAN_PENALTIES[i];
    }
    return null;
  }

  // 서명 한 건이 고르는 불이익 하나 — 주입된 결정적 난수 한 굴림이 정한다.
  // 같은 굴림이면 언제나 같은 불이익이 나온다. 셋은 같은 폭으로 갈라 두어
  // 어느 하나로 굳지 않는다.
  function pickLoanPenalty(roll) {
    const r = Number(roll);
    const safe = (isFinite(r) && r >= 0 && r < 1) ? r : 0;
    const i = Math.min(LOAN_PENALTIES.length - 1,
      Math.floor(safe * LOAN_PENALTIES.length));
    return LOAN_PENALTIES[i];
  }

  // ── 세 채널이 실제로 값을 깎고 올리는 자리 (순수 규칙) ────────────────
  // 화면과 엔진이 각자 10%를 곱하지 않고 아래 세 함수 하나씩만 지난다.

  // 작품 한 점을 팔아 실제로 손에 들어오는 금액 — salePriceDown 일 때만 내림 10%.
  // v8(21-A 이자만): 계약이 고른 불이익은 기록 · 저장에는 그대로 남지만(옛 저장 · 손댄 저장 검증 그대로),
  // 아래 세 효과(판매값 · 상점값 · 도구 속도)는 LOAN_PENALTY_ON일 때만 건다.
  function salePriceWithPenalty(price, penalty) {
    const gross = Math.max(0, Math.round(Number(price) || 0));
    const p = LOAN_PENALTY_ON ? validLoanPenalty(penalty) : null;
    if (!p || p.key !== "salePriceDown") return gross;
    return Math.floor(gross * (1 - p.magnitude));
  }

  // 상점 카드가 말하고 실제로 빠져나가는 금액 — shopPriceUp 일 때만 반올림 10%.
  function shopCostWithPenalty(cost, penalty) {
    const base = Math.max(0, Math.round(Number(cost) || 0));
    const p = LOAN_PENALTY_ON ? validLoanPenalty(penalty) : null;
    if (!p || p.key !== "shopPriceUp") return base;
    return Math.round(base * (1 + p.magnitude));
  }

  // 밀대가 실제로 미는 양에 곱해지는 배율 — toolSlowdown 일 때만 0.9다.
  function toolSpeedScaleFor(penalty) {
    const p = LOAN_PENALTY_ON ? validLoanPenalty(penalty) : null;
    return (p && p.key === "toolSlowdown") ? (1 - p.magnitude) : 1;
  }

  // 화면에 나가는 한 줄 — 무엇이 걸렸고 얼마나 걸렸는지 숨기지 않는다.
  function loanPenaltyLine(penalty) {
    const p = LOAN_PENALTY_ON ? validLoanPenalty(penalty) : null; // v8: 불이익을 걸지 않으니 말하지도 않는다
    return p ? (p.label + " — " + p.line) : "";
  }
  // 좁은 자리에 붙는 짧은 표시.
  function loanPenaltyShort(penalty) {
    const p = LOAN_PENALTY_ON ? validLoanPenalty(penalty) : null;
    return p ? p.short : "";
  }

  // 대출 계약의 「비어 있는 새 판」 상태. 저장·초기화가 같은 모양을 쓴다.
  //   offered   — 위기 전화가 한 번이라도 울렸는가 (평생 1회의 근거)
  //   declined  — 거절했는가. 이번 생에는 다시 제안하지 않는다
  //   accepted  — 전화에서 수락해 계약서가 열렸는가
  //   signed    — 서명해 체결됐는가
  //   revealed  — 서명 직후의 반전(이자·총상환액)을 이미 봤는가
  //   balance   — 갚아야 할 남은 총액
  // 체결된 계약에는 여기에 두 값이 더 붙는다. 둘 다 위 여섯 핵심 필드와 달리
  // 「빚이 얼마인가」를 정하지 않는 곁가지라, 핵심 필드 판정(LOAN_CORE_KEYS)과
  // 저장 정규화(loanFromSave)를 지나지 않고 각자의 작은 규칙만 지난다.
  //   penalty   — 이 계약이 고른 불이익 하나 (loanPenaltyFromSave · activeLoanPenalty)
  //   repaid    — 지금까지 완납한 계약 수 (loanRepaidCount). 완납 표시에만 쓴다
  function emptyLoan() {
    return {
      offered: false, declined: false, accepted: false,
      signed: false, revealed: false, balance: 0,
    };
  }

  // 완납 횟수는 이 판의 저장기가 쓰는 타입(0 이상의 정수)일 때만 사실로 읽는다.
  // 손댄 값은 0으로 읽는다 — 이 값은 표시용이라 경제를 만들지도 지우지도 않는다.
  function loanRepaidCount(raw) {
    const v = loanOwnField(raw, "repaid");
    if (typeof v !== "number" || !isFinite(v) || v < 0) return 0;
    return Math.floor(v);
  }

  // ── 대출 계약값의 「정식 타입」 (2026-08-26 2차 독립 검토 대응) ──────
  //
  // 이 판의 저장기(engine.save)가 실제로 쓰는 타입은 하나뿐이다 — 상태 플래그는
  // 진짜 boolean, 잔액은 진짜 finite number다. 그런데 읽는 쪽이 `!!v`나 `Number(v)`로
  // 강제 변환하면 사람이 손댄 값이 정식 상태 행세를 한다.
  //   · Number(null) · Number(false) · Number("") · Number(" ") · Number("0")은 모두 0이라
  //     그 잔액이 그대로 「완납 0원」이 됐다(공짜 완납).
  //   · !!"false" · !!0 같은 값은 서명 이력을 지웠다 살렸다 할 수 있었다.
  // 그래서 값은 「정식 타입일 때만」 사실로 읽고, 아니면 참으로도 거짓으로도 읽지 않는다.
  function isLoanFlag(v) { return v === true || v === false; }
  function isLoanBalance(v) { return typeof v === "number" && isFinite(v); }

  // 계약이 쓰는 상태 플래그 다섯 개. 타입 검사가 목록을 따로 들지 않고 여기 하나만 본다.
  const LOAN_FLAG_KEYS = Object.freeze([
    "offered", "declined", "accepted", "signed", "revealed",
  ]);
  // 실행 중 대출 상태의 핵심 필드 — 다섯 플래그와 잔액.
  const LOAN_CORE_KEYS = Object.freeze(LOAN_FLAG_KEYS.concat(["balance"]));
  // 저장된 대출 항목의 핵심 필드 — 위 여섯에 「이 잔액이 어떤 계약의 숫자인가」를
  // 밝히는 스키마 식별자까지 더한다. 스키마도 저장 자신의 문자열 필드여야 한다.
  const LOAN_SAVE_CORE_KEYS = Object.freeze(LOAN_CORE_KEYS.concat(["schema"]));

  // 「이 잔액이 어떤 계약의 숫자인가」를 저장이 직접 밝히는 식별자.
  // 이 판의 스크래치식 대출(원금 100 · 총상환 200 · 분할 없음)만 이 값을 쓴다.
  // 규칙과 엔진이 서로 다른 문자열을 들면 「최신 저장인가」 판정이 둘로 갈라지므로
  // 값은 여기 한 곳에서만 나온다 (engine.js가 이 값을 그대로 가져다 쓴다).
  const LOAN_SAVE_SCHEMA_ID = "scratch-loan-2026-08-26-v1";

  // ── 「자기 필드」 계약 (2026-08-26 5차 독립 검토 대응) ─────────────────
  //
  // 4차까지의 판정은 값과 타입만 봤다. 그래서 프로토타입에 정식 조합을 올린 껍데기
  //   Object.create({ offered:true, accepted:true, signed:false, ..., balance:0 })
  // 가 정식 계약서 대기로 읽혔고, 이미 원금 100원을 받은 판에서 두 번째 서명이
  // 성립해 현금 100 → 200 · 잔액 200이 실제로 재현됐다. 같은 방식으로
  //   Object.create({ schema: 지금스키마, ...pending })
  // 을 save.loan에 넣으면 같은 스키마 정상 저장 행세까지 했다.
  //
  // 이 판의 저장기(JSON)와 엔진이 실제로 만드는 대출 상태는 언제나 「자기 필드를
  // 가진 평범한 객체」다. 그래서 물려받은 값은 사실로 읽지 않고, 물려받았다는 사실
  // 자체를 손댄 증거로 센다.
  //
  // 값은 필드마다 딱 한 번만 읽어 사진 한 장으로 만든다 — Proxy처럼 읽을 때마다
  // 다른 값을 주는 객체가 판정 두 곳에 서로 다른 사실을 보여 주지 못하게 한다.
  // 읽다가 예외가 나는 필드는 값을 쓰지 않고 「자기 필드가 아니다」쪽으로 센다.
  //   object    — 대출 상태로 볼 수 있는 객체인가 (배열·null은 아니다)
  //   own       — 자기 필드로 실제로 읽은 값들
  //   inherited — 자기 필드가 아닌데 프로토타입에서 읽히거나 읽다 실패한 키들
  //
  // 공개 한계: 자기 필드로 정식 조합을 그대로 흉내 내는 Proxy는 평범한 정식 객체와
  // 구별할 수 없다. 그 자리는 「완전히 정식인 새 판 저장은 진짜 새 판과 구별할 수
  // 없다」는 이미 공개된 한계와 같다. 상속 필드는 구별할 수 있으므로 반드시 막는다.
  //
  // 2026-08-26 6차 독립 검토 대응: 「이 값이 객체인가」를 묻는 것조차 실패할 수 있다.
  // 취소된 Proxy(Proxy.revocable → revoke)에는 Array.isArray조차 예외를 던진다.
  // 그 예외가 그대로 새 나가면 저장(save)이 통째로 끊기고, 반대로 「객체가 아니다」로
  // 조용히 넘기면 읽을 수 없는 상태가 빈 계약으로 세탁돼 평생 1회가 초기화된다.
  // 그래서 읽을 수 없는 값은 「핵심 필드가 하나도 자기 것이 아니다」로 센다 —
  // 아래 규칙들이 이미 그 자리를 격리로 다루고 있다.
  function loanOwnFields(raw, keys) {
    const list = keys || LOAN_CORE_KEYS;
    let src = null;
    let unreadable = false;
    try {
      if (raw && typeof raw === "object" && !Array.isArray(raw)) src = raw;
    } catch (err) {
      unreadable = true; // 객체인지조차 물어볼 수 없다 — 안전한 쪽(손댔다)으로 센다
    }
    const out = { object: !!src, own: {}, inherited: [] };
    if (unreadable) out.inherited = list.slice();
    if (!src) return out;
    for (let i = 0; i < list.length; i += 1) {
      const key = list[i];
      try {
        if (Object.prototype.hasOwnProperty.call(src, key)) out.own[key] = src[key];
        else if (key in src) out.inherited.push(key);
      } catch (err) {
        out.inherited.push(key); // 읽을 수 없으면 안전한 쪽(손댔다)으로 센다
      }
    }
    return out;
  }

  // 한 필드의 자기 값 하나만 묻는 짧은 길. 상속·부재·예외는 모두 undefined다.
  function loanOwnField(raw, key) { return loanOwnFields(raw, [key]).own[key]; }

  // 상속으로만 들어와 있는 핵심 필드 목록 — 비어 있지 않으면 손댄 저장·상태다.
  function loanInheritedKeys(raw, keys) { return loanOwnFields(raw, keys).inherited; }

  // 이 상태에 「정식 타입이 아닌 필드」가 하나라도 있는가 (2026-08-26 4차 검토 대응).
  //
  // 3차까지의 흔적 판정은 truthiness만 봤다. 그래서 값을 크게 만드는 대신 falsy
  // 비정식 타입으로 바꾸면(signed:0 · offered:0 · accepted:"") 흔적 자체가 사라졌고,
  // 평생 1회를 이미 쓴 판이 새 판 행세를 하며 원금 100원을 다시 받을 수 있었다.
  // 이제는 값의 참·거짓이 아니라 「이 판의 저장기가 쓰지 않는 타입이 적혀 있다」는
  // 사실 자체를 손댄 증거로 센다.
  //   · 플래그는 진짜 boolean만 정식이다 — 0 · 1 · "" · "false" · null · 배열 · 객체는 모두 흔적
  //   · 잔액은 진짜 finite number만 정식이다 — "0" · "200" · false · null · NaN 모두 흔적
  // 빠진 필드와 명시적 undefined는 여기서 흔적으로 세지 않는다. 둘은 저장을 한 번
  // 지나면 구별되지 않고(JSON은 undefined를 지운다), 「아무 필드도 없는 순수 신규·옛
  // 안전 상태」를 이유 없이 빚으로 만들지 않기 위해서다. 대신 아래 엄격 기회 판정
  // (loanOpportunityLeft)이 「필드가 없으면 정식 조합도 아니다」로 따로 막는다.
  //
  // 2026-08-26 5차 검토 대응: 값은 자기 필드일 때만 읽고, 핵심 필드가 상속으로만
  // 들어와 있으면 값이 무엇이든 그 자체를 손댄 증거로 센다.
  function typeTaintFromFields(f) {
    if (f.inherited.length > 0) return true; // 상속 필드 자체가 손댄 증거다
    for (let i = 0; i < LOAN_FLAG_KEYS.length; i += 1) {
      const v = f.own[LOAN_FLAG_KEYS[i]];
      if (v !== undefined && !isLoanFlag(v)) return true;
    }
    return f.own.balance !== undefined && !isLoanBalance(f.own.balance);
  }
  function loanTypeTaint(raw) { return typeTaintFromFields(loanOwnFields(raw)); }

  // 이 상태에 「갚아야 할 빚이 있었다」는 증거가 남아 있는가.
  // 서명·수락·반전 흔적이나 0이 아닌 잔액이 그 증거다. 거절·제안만 있는 판은
  // 빚의 증거가 아니다 — 없던 빚을 만들어 내지 않기 위해 따로 센다.
  // 증거도 자기 필드에서만 읽는다 — 상속값으로 빚을 확정하지도, 지우지도 않는다.
  function debtTraceFromFields(f) {
    if (f.own.signed || f.own.accepted || f.own.revealed) return true;
    return f.own.balance !== undefined && f.own.balance !== 0;
  }
  function loanDebtTrace(raw) { return debtTraceFromFields(loanOwnFields(raw)); }

  // 이 상태에 「평생 1회 계약을 이미 썼다」는 흔적이 남아 있는가.
  // 위 빚 증거에 거절·제안까지 더하고, 거기에 정식 타입이 아닌 필드 자체를 더한다.
  // 참값이 아니어도(0 · "" · null) 이 판이 쓰지 않는 타입이면 누군가 손댄 것이므로
  // 안전한 쪽(이미 썼다)으로만 기운다 — 2026-08-26 4차 독립 검토가 재현한 우회다.
  // 2026-08-26 5차 검토 대응: 여기서도 자기 필드만 읽고, 상속 필드는
  // typeTaintFromFields를 지나며 그대로 흔적으로 잡힌다.
  function useTraceFromFields(f) {
    if (f.own.declined || f.own.offered) return true;
    if (typeTaintFromFields(f)) return true;
    return debtTraceFromFields(f);
  }
  function loanUseTrace(raw) { return useTraceFromFields(loanOwnFields(raw)); }

  // 「이 판에 아직 대출 기회가 남아 있는가」 — 실행 중 상태의 유일한 엄격 판정
  // (2026-08-26 4차 독립 검토 대응).
  //
  // 예전에는 부르는 쪽마다 다른 조건을 truthiness로 셌다. 위기 전화 개방은
  // `!offered && !declined && !signed`를, loanReliefLeft는 `signed !== true`를 봤고,
  // 그래서 `offered:0` 하나만 밀어 넣어도 두 판정이 함께 「새 판」이라고 답했다
  // (실제로 위기 전화 → 수락 → 서명 → 현금 0 → 100이 재현됐다).
  //
  // 이제 기회가 남았다고 볼 수 있는 것은 자연 경로가 실제로 만드는 정식 조합뿐이다.
  //   · 다섯 플래그가 모두 정확한 boolean이고 잔액이 정확한 숫자 0
  //   · signed false · declined false · revealed false
  //   · pristine        — offered false + accepted false (아직 위기가 없었다)
  //   · 전화 제안 중     — offered true  + accepted false (지금 울리고 있다)
  //   · 정상 계약서 대기 — offered true  + accepted true  (수락했고 서명 전이다)
  // 그 밖의 타입·모순 조합은 재제안·재수락·재서명·원금 지급을 모두 닫는다.
  // 필드가 빠졌거나 undefined로 적힌 상태도 정식 조합이 아니라 함께 닫힌다.
  //
  // 2026-08-26 5차 독립 검토 대응: 다섯 플래그와 잔액은 「값이 정식인가」에 더해
  // 「이 객체 자신의 필드인가」까지 만족해야 한다. 핵심 필드가 하나라도 상속으로만
  // 들어와 있으면 정식 조합이 아니다 — Object.create(pending) 껍데기가 계약서 대기
  // 행세를 하며 원금을 두 번 받는 길을 여기 한 곳에서 닫는다.
  function opportunityFromFields(f) {
    if (!f.object) return false;
    if (f.inherited.length > 0) return false; // 상속 필드로 위장한 상태다
    for (let i = 0; i < LOAN_FLAG_KEYS.length; i += 1) {
      if (!isLoanFlag(f.own[LOAN_FLAG_KEYS[i]])) return false;
    }
    if (!isLoanBalance(f.own.balance) || f.own.balance !== 0) return false;
    if (f.own.signed !== false || f.own.declined !== false
      || f.own.revealed !== false) return false;
    if (f.own.offered === false) return f.own.accepted === false; // pristine
    return true; // offered true — 전화 제안 중이거나 정상 계약서 대기
  }
  function loanOpportunityLeft(raw) { return opportunityFromFields(loanOwnFields(raw)); }

  // 「정식 계약서 대기」 — 원금 100원 지급이 성립하는 유일한 상태 조합이다
  // (2026-08-26 3차 독립 검토 대응).
  //
  // 예전에는 「수락 true · 미서명 false」 두 항목만 봤다. 그래서 실행 중인 판에
  // 상태를 통째로 밀어 넣으면(balance 200 · revealed true인데 signed만 false)
  // 그 두 항목만 맞춰 두고 원금을 한 번 더 받을 수 있었다. 이제 자연 경로가 실제로
  // 만들어 내는 조합 전체를 확인한다 — 전화가 울렸고(offered), 거절하지 않았고,
  // 수락했고, 아직 서명 전이고, 반전을 본 적 없고, 갚을 잔액이 정확한 숫자 0이다.
  // 하나라도 어긋나면 계약서 대기가 아니다. 값은 정식 타입일 때만 사실로 읽는다.
  //
  // 2026-08-26 4차 독립 검토 대응: 조합 검사를 여기서 따로 적지 않고 엄격 기회 판정
  // (loanOpportunityLeft) 위에 「수락까지 끝났다」한 줄만 얹는다. 두 곳이 각자
  // 조건을 세면 한쪽만 고쳐진 채 남는데, 그 어긋남이 3·4차 우회의 공통 뿌리였다.
  //
  // 2026-08-26 5차 독립 검토 대응: 사진 한 장(loanOwnFields)에서 두 판정을 함께
  // 본다. 두 번 나눠 읽으면 그 사이에 값을 바꾸는 객체가 서로 다른 사실을 보여 줄 수
  // 있고, 그 어긋남이 지금까지 우회의 공통 뿌리였다.
  function pendingFromFields(f) {
    return opportunityFromFields(f) && f.own.offered === true && f.own.accepted === true;
  }
  function loanContractPending(raw) { return pendingFromFields(loanOwnFields(raw)); }

  // 서명 — 정식 계약서 대기 상태에서만 성립한다.
  // 재서명·중복 지급을 막는 유일한 판정이며, 여기서 반전(revealed)이 함께 열린다.
  // 성립 조합은 위 loanContractPending() 한 곳에서만 정의한다 — 손댄 플래그나
  // 직접 주입한 상태로 계약서를 다시 열어 원금 100원을 두 번 받는 길을 막는다.
  // 반환: { ok, cash, loan } — ok가 false면 cash·loan은 손대지 않은 값 그대로다.
  //
  // 2026-08-26 5차 독립 검토 대응: 두 겹의 문을 사진 한 장으로 함께 본다. 필드를
  // 두 번 나눠 읽으면 그 사이에 값이 바뀔 수 있고, 값은 자기 필드일 때만 읽는다.
  //
  // 2026-08-26 동현 승인(불이익 3종 택1): 체결하는 그 순간 승인된 셋 중 정확히
  // 하나를 고른다. 고르는 근거는 부르는 쪽이 넣어 주는 결정적 난수 한 굴림(roll)
  // 하나뿐이다 — 규칙 파일이 Math.random을 직접 부르지 않아야 검사가 채널마다
  // 같은 판을 다시 세울 수 있다.
  //
  // 2026-08-26 독립 검토 대응: roll 은 숫자 하나여도 되고 「부르면 굴림을 주는
  // 함수」여도 된다. 함수를 받으면 아래 두 겹의 문을 모두 지난 뒤, 실제로 체결이
  // 성립하는 그 순간에만 정확히 한 번 부른다. 예전에는 부르는 쪽이 굴림을 먼저
  // 뽑아 넘겨서, 성립하지 않는 서명 시도까지 난수를 한 칸씩 먹었고 그 어긋남이
  // 뒤이어 실제로 뽑히는 불이익을 바꿔 놓았다.
  function signLoan(cash, loan, roll) {
    const have = Math.max(0, Number(cash) || 0);
    const state = loan || emptyLoan();
    const f = loanOwnFields(state);
    if (!pendingFromFields(f)) {
      return { ok: false, cash: have, loan: state };
    }
    // 위 조합을 지나면 갚을 빚은 이미 0원이지만, 계약이 인정하는 빚을 한 번 더
    // 확인한다 — 지급 문은 두 겹으로 잠가 둔다.
    if (owedFromFields(f) > 0) return { ok: false, cash: have, loan: state };
    return {
      ok: true,
      // 빌린 돈은 「수입」이 아니라 남의 돈이라 판매 불이익을 지나지 않는다.
      cash: have + LOAN_RULES.principal,
      loan: Object.assign({}, state, {
        offered: true, declined: false, accepted: true,
        signed: true, revealed: true, balance: LOAN_RULES.totalDue,
        // 이 계약이 지고 갈 불이익 하나 — 셋 중 정확히 하나다.
        // 굴림은 여기서, 즉 체결이 확정된 뒤에만 한 번 꺼낸다.
        penalty: pickLoanPenalty(typeof roll === "function" ? roll() : roll),
        repaid: loanRepaidCount(state),
      }),
    };
  }

  // 이 계약이 인정하는 「지금 갚아야 할 금액」 (2026-08-26 독립 검토 대응).
  //
  // 분할 상환이 없으므로 비분할 계약에서 성립하는 잔액은 두 가지뿐이다 —
  // 체결 중 200원, 완납 뒤 0원. 그런데 잔액을 그대로 「갚을 금액」으로 쓰면,
  // 저장을 고치거나 상태를 직접 주입해 1~199원을 넣은 판이 그 액수만 내고
  // 완납이 된다(현금 120원 · 잔액 100원 저장으로 실제 재현됐다).
  //
  // 2026-08-26 2차 독립 검토 대응: 「정확히 0원」은 Number()로 재지 않는다.
  // Number(null) · Number(false) · Number("") · Number(" ") · Number("0")이 모두 0이라
  // 그 값들이 그대로 공짜 완납이 됐다(직접 재현됐다). 완납은 이 판의 저장기가 실제로
  // 쓰는 타입, 즉 「정확한 숫자 0」일 때만 인정한다.
  //
  // 2026-08-26 3차 독립 검토 대응: 「signed === false면 무조건 0원」을 버린다.
  // 그 한 줄이 미서명이라고만 적어 두면 양수 잔액 증거까지 통째로 지웠고, 실행 중인
  // 판에 balance 200 · signed false를 직접 주입하면 빚이 사라진 채 계약서가 다시
  // 열려 원금 100원을 두 번 받을 수 있었다(현금 120 → 220으로 재현됐다).
  // 저장 정규화(loanFromSave)는 이미 그 조합을 활동 계약으로 되돌리고 있었으므로,
  // 이 규칙만 같은 방향으로 맞추면 두 경로가 하나의 계약을 나눠 쓰게 된다.
  //
  // 그래서 갚을 금액은 잔액에서 그대로 오지 않고 언제나 이 규칙을 지난다.
  //   · 서명 + 정확한 숫자 0원 → 0원 (유일하게 성립하는 완납 상태)
  //   · 서명 + 그 밖의 모든 값(부분·초과·음수·타입이 다른 값) → 총상환액 200원
  //   · 미서명 + 정확한 양수 숫자 잔액 → 총상환액 200원 (빚이 있었다는 증거다)
  //   · 미서명 + 정확한 숫자 0원 → 0원 (정상 계약서 대기·거절·새 판)
  //   · signed가 정식 boolean이 아니다 → 빚의 증거가 있으면 200원, 없으면 0원
  // 되돌리는 방향은 언제나 「아직 전액이 남았다」다. 반대로 굴리면 조작된 상태가
  // 곧바로 공짜 완납이 된다. 반대로 흔적이 하나도 없는 판에 빚을 만들지도 않는다.
  // 숫자가 아닌 잔액은 빚의 액수를 확정할 근거가 못 되므로 여기서 빚을 만들지는
  // 않는다. 대신 그런 상태는 계약서 대기 조합(loanContractPending)에도 들지 못해
  // 원금 재지급이 함께 막힌다 — 확정할 수 없으면 최소한 지급은 닫는다.
  //
  // 2026-08-26 5차 독립 검토 대응: 서명 이력도 잔액도 자기 필드에서만 읽는다.
  // 프로토타입에 올려 둔 값은 빚을 확정하는 증거가 되지 못하고(없던 빚을 만들지
  // 않는다), 동시에 있던 빚을 지우는 근거도 되지 못한다.
  function owedFromFields(f) {
    if (f.own.signed === true) {
      return f.own.balance === 0 ? 0 : LOAN_RULES.totalDue;
    }
    if (f.own.signed === false) {
      // 서명 이력만 지운 상태 — 남은 양수 잔액이 곧 「빚이 있었다」는 증거다.
      return (isLoanBalance(f.own.balance) && f.own.balance > 0)
        ? LOAN_RULES.totalDue : 0;
    }
    return debtTraceFromFields(f) ? LOAN_RULES.totalDue : 0;
  }
  function loanOwed(loan) {
    return owedFromFields(loanOwnFields(loan || emptyLoan()));
  }

  // 저장에서 읽은 대출 계약을 이 판의 계약으로 되돌린다 (순수 규칙).
  // 스키마가 이 판의 것과 같은데도 「비분할 계약에서 성립할 수 없는」 조합이면
  // 안전한 쪽으로 되돌리고, 무엇을 고쳤는지 함께 돌려준다 — 부르는 쪽이 그 사실을
  // 이벤트·기록으로 밝힐 수 있어야 하기 때문이다(숨기지 않는다).
  //
  // 되돌리는 방향의 기준은 하나다. 「조작·손상된 상태가 경제 우회를 만들지 않는다」.
  //   · 서명 + 정확한 숫자 0원(완납)  → 빈 새 계약 + 완납 건수 1 (2026-08-26 동현
  //     승인 · 재대출. 완납은 계약을 닫으므로 서명 상태를 되살리지 않는다. 그래야
  //     후속 위기에서 전화가 다시 열린다 — 갚은 판이 손해를 보지 않는다.)
  //   · 서명한 계약의 이상한 잔액 → 총상환액 200원 (덜 갚고 끝나지 않는다)
  //   · 미서명인데 잔액이 양수다  → 활동 계약 200원 (2026-08-26 2차 검토로 뒤집힘.
  //     예전에는 0원으로 지웠는데, 그러면 서명 이력만 지운 저장이 빚을 통째로 없애고
  //     계약서를 다시 열어 원금 100원을 두 번 받는 길이 됐다. 남은 잔액은 「빚이
  //     있었다」는 증거이므로 빚이 남은 쪽으로 되돌린다. 현금은 건드리지 않는다.)
  //   · 서명 + 거절             → 거절을 지운다 (서명한 사실이 더 무겁다)
  //   · 수락 + 거절 (미서명)     → 거절이 이긴다 (새 대출금을 열어 주지 않는다)
  //   · 서명인데 제안·수락·반전이 없다 → 그 사실들을 세운다 (평생 1회가 깨지지 않게)
  //   · 타입이 정식이 아니어서 빚 여부를 확정할 수 없는데 계약을 쓴 흔적은 있다
  //     → 「평생 1회를 이미 썼다」는 안전 상태로 격리한다. 빚도 현금 변화도 만들지
  //        않지만 재제안·재서명·재지급은 모두 닫는다.
  //   · 필드가 있는데 정식 타입이 아니다 → 값이 falsy여도 그 자체가 손댄 흔적이다
  //     (2026-08-26 4차 검토). 빚 액수를 확정할 양수 숫자 증거가 없으면 위와 같은
  //     격리 상태로 두고, 무엇이 이상했는지(badFlag:키 · badBalanceType)를 남긴다.
  //   · 어떤 필드도 없는 순수 신규·옛 안전 저장 → 빈 계약 그대로다. 없던 빚도
  //     없던 소진도 만들지 않는다.
  // 현금은 여기서 한 푼도 만들지 않는다 — 자동 재지급도 자동 상환도 없다.
  // 반환: { loan, repaired, fixed }
  //
  // 2026-08-26 동현 승인(불이익 3종 택1): 「고른 불이익」은 여기서 다루지 않는다.
  // 이 함수가 정하는 것은 「빚이 얼마이고 계약이 어느 자리에 있는가」이고, 불이익은
  // 그 결과에 딸려 오는 곁가지라 아래 loanPenaltyFromSave 한 곳에서만 맞춘다.
  function loanFromSave(raw) {
    // 저장 항목도 자기 필드만 한 번씩 읽는다 (2026-08-26 5차 검토). 스키마까지
    // 함께 보는 이유는 「schema만 프로토타입에 올린 저장」이 최신 정상 저장으로도,
    // 구형 저장 안전 초기화로도 새 나가지 못하게 하기 위해서다.
    const f = loanOwnFields(raw, LOAN_SAVE_CORE_KEYS);
    const fixed = [];
    const add = function (tag) { if (fixed.indexOf(tag) < 0) fixed.push(tag); };
    // repaid — 이 저장의 「모양 자체」가 증언하는 완납 건수다. 저장이 따로 적어 둔
    // 완납 칸(loanRepaidCount)과 달리, 그 칸이 없던 시절의 완납 저장에서도 이력이
    // 사라지지 않게 한다. 부르는 쪽이 두 값 중 큰 쪽을 쓴다.
    const done = function (loan, repaid) {
      return {
        loan: loan, repaired: fixed.length > 0, fixed: fixed,
        repaid: Math.max(0, Math.floor(Number(repaid) || 0)),
      };
    };

    // 상속으로만 들어와 있는 핵심 필드 — 값이 무엇이든 이 판의 저장기가 만든 모양이
    // 아니다. 무엇이 상속돼 있었는지 그대로 남긴다.
    f.inherited.forEach(function (key) { add("inherited:" + key); });
    const proto = f.inherited.length > 0;

    // ── 최신 저장의 필수 필드 완전성 (2026-08-26 6차 독립 검토 대응) ────
    //
    // 5차까지는 「schema가 자기 필드로 지금 값과 같은가」만 봤다. 그래서
    //   data.loan = { schema: 지금스키마 }
    // 처럼 스키마만 남기고 핵심 여섯을 통째로 지운 저장이 아래 마지막 줄까지 내려가
    // 빈 계약(emptyLoan)으로 세탁됐고, 평생 1회를 이미 쓴 판이 새 판 행세를 하며
    // 위기 전화 → 수락 → 서명 → 원금 100원을 다시 받았다(실제 재현됐다).
    //
    // 이 판의 저장기(engine.save)는 언제나 여섯 필드를 모두 자기 필드로 적는다.
    // 그러니 「지금 스키마인데 핵심 필드가 빠져 있다」는 상태는 정상 저장이 아니라
    // 탐지할 수 있는 손상이다. 값의 참·거짓을 묻지 않고 그 사실 자체를 흔적으로 센다.
    //   · 자기 필드가 아예 없다      → missing:키
    //   · 자기 필드인데 값이 undefined → undefinedField:키
    // 둘은 이유를 구별해 남기지만 둘 다 정식 후보가 아니다. 상속으로 들어온 키는
    // 위 inherited:키가 이미 이유를 말하므로 여기서 다시 세지 않는다.
    //
    // 경계: 스키마가 다르거나 아예 없는 저장(구형 부모판·진짜 옛 저장)에는 이 규칙을
    // 소급하지 않는다. 그 저장들은 지금까지의 안전 경로를 그대로 지난다.
    // 공개 한계도 그대로다 — 여섯 필드를 모두 정식으로 갖춘 새 판 저장은 진짜 새 판과
    // 구별할 수 없다. 여기서 닫는 것은 「빠져 있어 알아볼 수 있는」 손상뿐이다.
    let incomplete = false;
    if (f.own.schema === LOAN_SAVE_SCHEMA_ID) {
      for (let i = 0; i < LOAN_CORE_KEYS.length; i += 1) {
        const key = LOAN_CORE_KEYS[i];
        if (Object.prototype.hasOwnProperty.call(f.own, key)) {
          if (f.own[key] === undefined) { incomplete = true; add("undefinedField:" + key); }
        } else if (f.inherited.indexOf(key) < 0) {
          incomplete = true;
          add("missing:" + key);
        }
      }
    }
    // 「이 판의 저장기가 만든 모양이 아니다」는 두 증거를 한 이름으로 묶는다 —
    // 아래 갈래들이 두 자리에서 서로 다른 조건을 세지 않게 하기 위해서다.
    const tampered = proto || incomplete;

    // 정식 boolean만 사실로 읽는다. 있는데 boolean이 아니면 참으로도 거짓으로도
    // 읽지 않고 「알 수 없음(null)」으로 두고 고친 항목에 남긴다.
    let badFlag = false;
    const flagOf = function (key) {
      const v = f.own[key];
      if (isLoanFlag(v)) return v;
      if (v !== undefined) { badFlag = true; add("badFlag:" + key); }
      return null;
    };
    const signed = flagOf("signed");
    const accepted = flagOf("accepted");
    const declined = flagOf("declined");
    const revealed = flagOf("revealed");
    const offered = flagOf("offered");

    // 잔액도 정식 finite number일 때만, 그리고 자기 필드일 때만 사실로 읽는다.
    const balanceGiven = f.own.balance !== undefined;
    const balance = isLoanBalance(f.own.balance) ? f.own.balance : null;
    if (balanceGiven && balance === null) add("badBalanceType");

    // 되돌아갈 두 안전 상태.
    //   활동 계약 — 빚 200원이 그대로 남은 체결 상태 (현금은 그대로 둔다)
    //   격리     — 평생 1회를 이미 쓴 것으로 두되 빚도 새 지급도 만들지 않는 상태
    const activeContract = function () {
      return done({
        offered: true, declined: false, accepted: true,
        signed: true, revealed: true, balance: LOAN_RULES.totalDue,
      });
    };
    const spentQuarantine = function () {
      add("lifetimeSpent");
      return done({
        offered: true, declined: true, accepted: false,
        signed: false, revealed: false, balance: 0,
      });
    };

    // ① 체결한 계약 — 유효 잔액은 정확한 숫자 0(완납)과 200(활동)뿐이다.
    if (signed === true) {
      // ①-a 완납한 계약 (2026-08-26 동현 승인 · 재대출).
      //
      // 예전에는 signed:true · balance:0 을 그대로 되살렸다. 그런데 완납은 그 계약을
      // 「끝난 것」으로 닫는 승인이라(repayLoanFull), 저장에서만 서명 상태가 살아남아
      // 실행 중 판정(loanOpportunityLeft)에 걸렸고 후속 위기의 재대출이 영구히
      // 막혔다 — 갚은 판이 안 갚은 판보다 불리해지는 자리였다.
      //
      // 이제 갚고 끝난 계약은 상환 경로와 똑같이 「빈 새 계약」으로 이행하고, 완납
      // 사실은 활동 계약이 아니라 별도의 완납 건수(repaid)로만 남긴다.
      // 열리는 것은 「다음 위기에서 다시 제안될 수 있다」뿐이다. 현금도 빚도 여기서
      // 만들지 않고, 잔액이 남은 계약(①-b)은 그대로 활동 계약으로 되돌아간다.
      //
      // 다만 이 판의 저장기가 만든 모양이 아닌 완납 기록(상속 필드·지금 스키마인데
      // 빠진 필드·정식 타입이 아닌 플래그)은 여기서도 믿지 않는다. 그런 저장은
      // 지금까지와 같은 격리로 보내 빚도 새 지급도 만들지 않는다.
      if (balance === 0) {
        if (tampered || badFlag) return spentQuarantine();
        if (accepted !== true) add("acceptedMissing");
        if (offered !== true) add("offeredMissing");
        if (revealed !== true) add("revealedMissing");
        if (declined === true) add("declinedWhileSigned");
        return done(emptyLoan(), 1); // 완납 한 건 — 이력은 repaid로만 남는다
      }
      // ①-b 아직 갚지 않은 활동 계약 — 잔액은 언제나 총상환액으로 되돌린다.
      let bal;
      if (balance === LOAN_RULES.totalDue) bal = LOAN_RULES.totalDue;
      else { bal = LOAN_RULES.totalDue; add("balance"); }
      if (accepted !== true) add("acceptedMissing"); // 수락 없이 서명한 판은 없다
      if (offered !== true) add("offeredMissing"); // 제안 없이 체결된 판도 없다
      if (revealed !== true) add("revealedMissing"); // 반전은 서명과 동시에 열린다
      if (declined === true) add("declinedWhileSigned");
      return done({
        offered: true, declined: false, accepted: true,
        signed: true, revealed: true, balance: bal,
      });
    }

    // ② 미체결이라고 적힌 저장 — 잔액은 정확한 숫자 0만 유효하다.
    if (signed === false) {
      if (balance !== null && balance > 0) {
        // 서명 이력만 지우고 갚을 돈은 남긴 저장이다. 빚을 지우는 쪽으로 되돌리면
        // 부채 삭제와 원금 재수령이 한꺼번에 열린다 — 활동 계약으로 되돌린다.
        add("unsignedBalance");
        add("signHistoryMissing");
        return activeContract();
      }
      if (balanceGiven && balance !== 0) {
        // 음수·문자열·null 같은 잔액 — 빚이 얼마인지 확정할 수 없다.
        add("unsignedBalance");
        return (tampered || useTraceFromFields(f)) ? spentQuarantine() : done(emptyLoan());
      }
      if (tampered) {
        // 핵심 필드가 상속으로만 들어와 있거나(proto), 지금 스키마 저장인데 빠져
        // 있다(incomplete) — 값이 전부 정식으로 보여도 이 판의 저장기가 만든 모양이
        // 아니다. 정상 대기·제안 상태로 되살리면 그 조합이 계약서를 다시 열어
        // 원금 100원을 두 번 받는 길이 된다.
        return spentQuarantine();
      }
      if (badFlag) {
        // 상태 플래그가 정식 boolean이 아니다 — 정상 대기 상태로 믿을 수 없다.
        // 2026-08-26 4차 독립 검토 대응: 예전에는 여기서도 흔적을 truthiness로 세어,
        // signed:0 · offered:0 같은 falsy 비정식 값이면 emptyLoan()으로 되돌아갔다.
        // 그 되돌림이 곧 「평생 1회 초기화」였다(새 위기 전화 → 서명 → 현금 +100원이
        // 재현됐다). 정식 타입이 아닌 필드가 적혀 있다는 사실 자체가 손댄 증거이므로
        // 값의 참·거짓을 묻지 않고 격리한다 — 빚도 현금 변화도 만들지 않되 재대출만 닫는다.
        return spentQuarantine();
      }
      // 여기부터는 모든 값이 정식 타입이다 — 지금까지의 규칙 그대로 읽는다.
      let acc = accepted === true;
      const dec = declined === true;
      if (acc && dec) { acc = false; add("acceptedWhileDeclined"); }
      if (revealed === true) add("revealedWithoutSign");
      return done({
        offered: offered === true || acc || dec,
        declined: dec, accepted: acc,
        signed: false, revealed: false, balance: 0,
      });
    }

    // ③ 서명 이력 자체가 없거나 정식 boolean이 아니다.
    if (balance !== null && balance > 0) {
      add("unsignedBalance");
      add("signHistoryMissing");
      return activeContract(); // 남은 잔액이 곧 「빚이 있었다」는 증거다
    }
    // 상속 필드와 빠진 필수 필드는 값이 무엇이든 손댄 흔적이다 — 빚을 확정할 자기
    // 필드 증거가 없으므로 빚도 현금 변화도 만들지 않되 재제안·재서명·재지급만
    // 함께 닫는다. (검토가 재현한 `{ schema: 지금스키마 }` 저장이 여기서 걸린다.)
    if (tampered || useTraceFromFields(f)) return spentQuarantine();
    return done(emptyLoan()); // 계약을 쓴 흔적이 하나도 없다 — 새 판과 같다
  }

  // 갚으려면 현금이 얼마부터 있어야 하는가 (2026-08-26 동현 확정).
  //
  // 총상환액은 200원 그대로고 분할도 없다. 다만 갚고 나서 지갑이 유리창 선투자
  // 20원 아래로 떨어지는데 팔거나 진행해 회복할 작품도 없으면, 유리창 한 장조차
  // 시작할 수 없고 대출은 이미 써 버려 돈을 만들 길이 하나도 없는 막다른 길이 된다.
  // 그래서 그 판에서만 선투자 20원을 남길 수 있는 220원부터 갚게 한다.
  // 회복할 작품이 남아 있으면 기존대로 200원부터다.
  //
  // 남기는 20원은 여기서 만든 새 경제 수치가 아니라 구매 쪽 공통 교착 방지 계약이
  // 쓰는 그 선투자 값(DEADLOCK_GUARD.reserve = WINDOW_RULES.upfrontCost)이다.
  // 갚을 금액은 저장된 잔액이 아니라 계약이 인정하는 값(loanOwed)에서 나온다 —
  // 조작된 부분 잔액이 요구 금액을 깎지 못하게 한다.
  function repayCashNeeded(loan, workLeft) {
    const owed = loanOwed(loan);
    if (owed <= 0) return 0; // 갚을 것이 없으면 요구 금액도 없다
    return workLeft ? owed : owed + DEADLOCK_GUARD.reserve;
  }

  // 상환 — 분할이 없다. 현금이 위 요구 금액 이상일 때만 한 번에 전액 갚는다.
  // 모자라면 한 푼도 나가지 않는다 — 현금은 절대 음수가 되지 않는다.
  //   opts.workLeft — 팔거나 진행해 현금을 회복할 작품이 남아 있는가
  // 반환: { ok, cash, loan, repaid, blockedByReserve }
  //   blockedByReserve — 잔액만큼은 있는데 선투자를 남기지 못해 막힌 경우에만 true.
  //   (그냥 돈이 모자란 199원 이하는 교착이 아니라 평범한 부족이라 false다.)
  function repayLoanFull(cash, loan, opts) {
    const have = Math.max(0, Number(cash) || 0);
    const state = loan || emptyLoan();
    // 나가는 금액도 저장된 잔액이 아니라 계약이 인정하는 값이다. 잔액에 1~199원이
    // 들어 있어도 그 액수를 부분 상환액으로 받아들이지 않는다 — 언제나 200원이다.
    const owed = loanOwed(state);
    const no = (guarded) => ({
      ok: false, cash: have, loan: state, repaid: 0, blockedByReserve: !!guarded,
    });
    if (owed <= 0) return no(false);
    if (have < owed) return no(false); // 총상환액 자체에 모자란다
    if (have < repayCashNeeded(state, !!(opts && opts.workLeft))) return no(true);
    // 2026-08-26 동현 승인(완납 뒤 재대출): 완납은 그 계약을 「끝난 것」으로 닫는다.
    // 예전에는 signed true · balance 0을 그대로 남겨 평생 1회를 못박았지만, 이제는
    // 완납한 판에 새 위기가 오면 전화 → 수락 → 계약서 → 서명이 처음부터 다시 열려야
    // 한다. 그래서 갚고 나온 계약은 「빈 새 계약」으로 정식 타입까지 못박아 돌려준다.
    //   · 고른 불이익은 여기서 사라진다 (완납이 곧 해제다)
    //   · 손댄 플래그도 함께 정식 값으로 덮인다 — 완납한 잔액 0원이 다시
    //     「확정할 수 없는 상태」로 읽혀 빚이 되살아나지 않는다
    //   · 거절 이력까지 지우는 것은 이 계약을 실제로 수락·서명·완납했기 때문이다.
    //     거절만 하고 끝난 판은 여기까지 오지 못한다 (owed가 0이라 위에서 막힌다)
    //   · repaid는 「몇 건을 완납했는가」만 센다. 표시에만 쓰고 경제를 만들지 않는다
    const done = Object.assign({}, emptyLoan(), {
      penalty: null, repaid: loanRepaidCount(state) + 1,
    });
    return {
      ok: true,
      cash: have - owed,
      loan: done,
      repaid: owed,
      blockedByReserve: false,
    };
  }

  // 지금 이 대출에 실제로 걸려 있는 불이익 하나 (없으면 null).
  //
  // 2026-08-26 동현 승인으로 「잔액이 남는 동안 핵심 반복 수입 50% 삭감」은 폐기됐다.
  // 대신 서명 한 건이 고른 불이익 하나만 걸리고, 완납하면 즉시 풀린다.
  //
  // 「빚이 남았는가」는 잔액을 그대로 믿지 않고 계약이 인정하는 값(loanOwed)으로
  // 본다 — 잔액만 망가뜨려 불이익을 지우는 우회를 함께 닫는다. 반대로 저장에서
  // 온 불이익 값도 승인된 목록에 있을 때만 사실로 읽는다.
  // 빚이 남아 있는데 승인된 불이익이 하나도 적혀 있지 않으면 첫 번째 승인값으로
  // 읽는다. 실행 중인 상태에 계약을 통째로 밀어 넣거나 이 칸만 지우면 「빚만 남기고
  // 대가는 없는」 계약이 되기 때문이다 — 저장 쪽(loanPenaltyFromSave)과 같은 방향이다.
  function activeLoanPenalty(loan) {
    if (loanOwed(loan) <= 0) return null; // 갚을 것이 없으면 걸린 불이익도 없다
    return validLoanPenalty(loanOwnField(loan, "penalty")) || LOAN_PENALTIES[0];
  }

  // 저장에서 읽은 「고른 불이익」을 이 판의 값으로 되돌린다 (순수 규칙).
  //   raw  — 저장에 들어 있던 대출 항목 그대로
  //   loan — 위 loanFromSave가 이미 되돌려 놓은 여섯 핵심 필드
  // 되돌리는 방향은 대출 규칙 전체와 같다. 「손댄 저장이 경제 우회를 만들지 않는다」.
  //   · 빚이 남은 계약인데 승인 목록 밖의 값이 적혀 있거나 아예 비어 있다
  //     → 첫 번째 승인값으로 채운다. 「불이익만 지운 저장」이 빚만 남기고 대가는
  //        없애는 우회를 여기서 닫는다.
  //   · 빚이 없는 계약 → 언제나 null이다. 완납·거절·새 판에 대가는 없다.
  // 크기(magnitude)는 저장에서 한 번도 읽지 않는다 — 언제나 승인 목록에서 나온다.
  function loanPenaltyFromSave(raw, loan) {
    if (loanOwed(loan) <= 0) return null;
    return validLoanPenalty(loanOwnField(raw, "penalty")) || LOAN_PENALTIES[0];
  }

  // 작품 한 점의 판매가가 실제 수령액으로 얼마가 되는가.
  // 화면은 원금액(gross)과 삭감액(cut)을 함께 받아 숨기지 않고 보여 준다.
  // 반환: { gross, net, cut }
  function loanSaleSplit(loan, amount) {
    const gross = Math.max(0, Math.round(Number(amount) || 0));
    const net = salePriceWithPenalty(gross, activeLoanPenalty(loan));
    return { gross: gross, net: net, cut: gross - net };
  }

  // ── 공통 교착 방지 계약 (2026-08-26 동현 확정) ──────────────────────
  // 실제로 재현된 교착: 현금 164원에서 잉크통 2단계 150원을 사면 14원이 남는다.
  // 유리창 한 장을 시작할 선투자 20원에 6원이 모자라 알바조차 열 수 없고, 대출은
  // 이미 소진·거절했고 팔아서 회복할 작품도 없으면 돈을 만들 길이 하나도 없다.
  //
  // 그래서 「대출도 없고 팔 작품도 없는」 판에서만, 현금을 선투자 아래로 떨어뜨리는
  // 구매를 막는다. 대출 제안이 아직 남아 있거나 팔아서 회복할 작품이 있으면 기존
  // 구매 규칙을 그대로 둔다 — 이 계약은 새 난이도가 아니라 막다른 길 하나만 지운다.
  //
  // 남겨야 할 액수는 여기서 새로 만들지 않는다. 「다음 유리창 한 장을 시작할 수 있는
  // 최소 현금」이 곧 선투자 그 값이라, WINDOW_RULES.upfrontCost를 그대로 가져다 쓴다.
  const DEADLOCK_GUARD = Object.freeze({
    reserve: WINDOW_RULES.upfrontCost, // 1$(v5) — 다음 한 장을 시작할 수 있는 최소 현금
  });

  // 이 구매가 영구 교착을 만드는가 (순수 판정).
  //   money    — 지금 현금
  //   cost     — 이 구매로 나갈 금액
  //   loanLeft — 아직 받을 수 있는 대출이 남아 있는가
  //   workLeft — 팔아서 현금을 회복할 작품이 남아 있는가
  function purchaseDeadlocks(info) {
    const o = info || {};
    const cost = Math.max(0, Math.round(Number(o.cost) || 0));
    if (cost <= 0) return false; // 공짜는 지갑을 비우지 않는다
    const money = Math.max(0, Math.round(Number(o.money) || 0));
    if (money - cost >= DEADLOCK_GUARD.reserve) return false; // 선투자가 남는다
    if (o.loanLeft) return false; // 대출 제안이 아직 남아 있다
    if (o.workLeft) return false; // 팔아서 회복할 작품이 남아 있다
    return true;
  }

  // 카드 위에 붙는 짧은 표시 — 「유리창 선투자 20원을 남겨야 한다」는 뜻만 말한다.
  function deadlockGuardShort() {
    return "선투자 " + DEADLOCK_GUARD.reserve + "$ 남기기";
  }

  // 오른쪽 기록에 남는 한 줄. 화면과 검사가 같은 문구 한 곳을 쓴다.
  function deadlockGuardLine(label) {
    return (label ? "「" + label + "」 " : "") + "구매를 막았습니다 — 유리창 선투자 "
      + DEADLOCK_GUARD.reserve + "$는 남겨야 합니다";
  }

  // 전액 상환이 같은 이유로 막혔을 때의 한 줄. 짧은 표시는 위 deadlockGuardShort()를
  // 그대로 나눠 쓴다 — 「선투자 20원을 남겨야 한다」는 말이 화면 한 곳에서만 나온다.
  function repayGuardLine() {
    return "전액 상환을 잠갔습니다 — 유리창 선투자 " + DEADLOCK_GUARD.reserve
      + "$는 남겨야 합니다";
  }

  // 완료한 유리창 개수 → 유리창 레벨. 누적 돈은 보지 않는다.
  function windowLevelFor(windowsDone) {
    return (Number(windowsDone) || 0) >= WINDOW_RULES.levelUpWindows ? 1 : 0;
  }

  // 지금 레벨에서 다음 레벨까지의 진행 — 왼쪽 유리창 알바 버튼의 게이지가 쓴다.
  // 레벨 1이 현재 최대라 그 뒤에는 가득 찬 채로 멈춘다 (다음 레벨은 아직 없다).
  function windowGaugeFor(windowsDone) {
    const done = Math.max(0, Number(windowsDone) || 0);
    const level = windowLevelFor(done);
    const maxed = level >= WINDOW_RULES.tables.length - 1;
    const need = WINDOW_RULES.levelUpWindows;
    return {
      level: level,
      done: maxed ? need : Math.min(done, need),
      need: need,
      ratio: maxed ? 1 : Math.min(1, done / need),
      maxed: maxed,
    };
  }

  // 플레이어에게 보여 주는 유리창 확률표 — 대성공은 감추고 성공 쪽에 합쳐 낸다.
  // 「잭팟(깨끗이 닦았다)은 지금처럼 히든확률로」라는 동현 지시를 표 쪽에서 지키는
  // 자리다. 보수는 일반 성공 금액만 말하고, 대성공 금액은 표에 싣지 않는다.
  function windowPublicTable(level) {
    const table = WINDOW_RULES.tables[Math.max(0, Math.min(WINDOW_RULES.tables.length - 1,
      Number(level) || 0))];
    let winChance = 0;
    let winPay = 0;
    let failChance = 0;
    table.forEach(function (row) {
      if (row.pay > 0) {
        winChance += row.chance;
        if (row.key === "normal") winPay = row.pay;
      } else {
        failChance += row.chance;
      }
    });
    const rows = [{ key: "win", label: "창문 한 장 완성", chance: winChance, pay: winPay }];
    if (failChance > 0) {
      // 2026-08-26 확정: 파손이 얼마짜리인지 숨기지 않는다. 다만 말하는 숫자는
      // 「추가 배상 20원」이 아니라 「총손실 40원」이다 — 플레이어가 실제로 잃는 것은
      // 이미 낸 선투자 20원까지 합친 그 금액이기 때문이다.
      rows.push({
        key: "none",
        label: "유리창 파손",
        chance: failChance,
        pay: 0,
        cost: WINDOW_COSTS.breakTotalLoss,
      });
    }
    return rows;
  }

  // (레벨, 0~1 굴림) → { key, pay, label } 확정 결과.
  // 엔진과 테스트가 같은 권위를 쓰도록 순수 규칙으로만 내보낸다.
  function windowResultFor(level, roll) {
    const table = WINDOW_RULES.tables[Math.max(0, Math.min(WINDOW_RULES.tables.length - 1,
      Number(level) || 0))];
    const r = Math.min(0.9999999999, Math.max(0, Number(roll) || 0));
    let edge = 0;
    for (let i = 0; i < table.length; i += 1) {
      edge += table[i].chance;
      if (r < edge) return table[i];
    }
    return table[table.length - 1];
  }

  // ── 경제·성장 시험값 ──────────────────────────────────────────
  const ECON_TEST_VALUES = Object.freeze({
    // 2026-08-26 확정: 부모판의 6겹 회의 시험값을 4겹으로 되돌린다.
    // 4겹 × 4장 = 밀대 완주 16회가 첫 도화지의 노동량이다.
    // 디버그 창에서 4·5·6겹으로 바꿔 볼 수 있고, 기본값이 이 값이다.
    windowStrokesPerWindow: 4, // 밀대 완주 4회 = 창문 한 장
    // 새 게임 시작 현금 (2026-08-26 확정). 유리창 첫 장의 선투자 20원을 낼 수 있는
    // 딱 그만큼이다 — 시작하자마자 「가진 돈을 밀어 넣는」 감각을 만든다.
    // 2026-10-12 v5(1달러 단위): 시작 현금 1 = 유리창 첫 선투자. 「시작 현금 = 첫 선투자」 원칙 그대로.
    startMoney: 1,
    // 2026-10-12 v5(형님 26-A): 재료비(도화지 + 잉크) = 이 값 × 원작 급 배율. 뮤나리자 5 · 키스 15,625.
    // 실제로 내는 값은 materialCostFor(원작)이 정한다. paperSizes의 small과 같은 값이다.
    paperCost: 5,
    manualPrintCount: 3, // 수동 인쇄(휠) 3회 — V6 정본 시안 D. 「시험 리듬」이라 바꾸지 않는다.
    autoFinishFrom: 0.8, // 13/16줄(80%)부터 자동 마무리 — V6 정본
    // 잉크가 중간에 떨어져 미완성으로 넘긴 작품의 판매가 — 정액이며 레벨 보너스가 붙지 않는다.
    // (2026-08-10 라운드 003 승인: 첫 작품은 반드시 이 손실을 한 번 겪는다.)
    // 2026-08-25 회의 전 추천안: 70 → 75원. 도화지 100원 대비 손실이 30 → 25원으로 줄어
    // 첫 손실 학습의 아픔은 남기면서 「팔아도 손해」의 크기를 한 단계 낮춘다.
    incompleteSalePrice: 75,
    // 2026-10-12 v5: 미완성은 정액이 아니라 「그 원작 재료비의 70%」(반올림)다. 뮤나리자 5 → 4.
    // 위 incompleteSalePrice(75)는 v4까지의 정액으로, 이 판에서는 쓰지 않는다(옛 검사 기록용).
    incompleteSaleRatio: 0.7,
    grades: Object.freeze([
      // price는 레벨 1일 때의 기본 판매가(시험값). 실제 판매가는 priceFor()가 레벨을 얹어 낸다.
      // 2026-08-19 확정: 브론즈 70 → 85원. 확률(55%)은 그대로 두어 「낮은 등급이 가장
      // 흔하다」는 순서를 지킨다 — 확률을 뒤집어 실버를 더 흔하게 만드는 안은 「중간 등급이
      // 제일 흔한」 모순이라 동현이 물렸다.
      // 레벨 보너스가 붙어 첫 정상 판매 시점(레벨 3) 실수령은 88원이고, 도화지 100원
      // 대비 손해가 30원 → 12원으로 줄어든다. (2026-08-19 정정: 레벨 4·10원은 계산 착오) 유리창 밀대 1~2번이면 메워지는 크기라
      // 「본전에 살짝 모자란다」는 긴장은 남기면서 벌칙 노동은 거의 사라진다.
      // 2026-08-25 회의 전 추천안: 브론즈 기본가 85 → 100원. 확률(55%)과 실버 이상
      // 기본값은 그대로 두고, 새 하위 완성 등급도 만들지 않는다. 레벨 보너스 계산법이
      // 그대로라 실제 판매가는 여기에 현재 레벨이 더 얹힌다.
      // 2026-10-12 v5(1달러 단위 · 설계표 2절): 기본가 5 · 7 · 12 · 25 · 50.
      // 확률은 이제 이 prob가 아니라 아래 ROUND_TABLES(확률 단계 표)가 정한다 — prob는 옛 검사 기록용으로만 남긴다.
      Object.freeze({ key: "bronze", label: "브론즈", prob: 0.55, price: 5 }),
      Object.freeze({ key: "silver", label: "실버", prob: 0.35, price: 7 }),
      Object.freeze({ key: "gold", label: "골드", prob: 0.09, price: 12 }),
      Object.freeze({ key: "platinum", label: "플래티넘", prob: 0.009, price: 25 }),
      Object.freeze({ key: "diamond", label: "다이아몬드", prob: 0.001, price: 50 }),
    ]),

    // ── 유리창 대성공(잭팟) 문구 ────────────────────────────────
    // 확률·보수는 위 WINDOW_RULES의 확정 결과표가 정한다. 여기에는 연출 문구만 남긴다.
    // (옛 시험값이던 8%/16% 확률과 보수 ×3 배수는 A 계약으로 폐기됐다.)
    jackpot: Object.freeze({
      label: "아주 깨끗하게 닦았다!",
    }),

    // ── 도화지 크기 → 필요한 스크롤 칸 수 — 시험값 ──────────────
    // 「칸」은 밀대가 지나가는 한 줄이다. 필요한 칸 = rows × strokes.
    // 큰 도화지(줄 수가 더 많은 종이)는 전용 픽셀 그림이 있어야 해서 이번 판에는
    // 소형 한 종류만 넣고, 크기에 따라 칸 수가 달라지는 계산 구조만 세워 뒀다.
    paperSizes: Object.freeze([
      Object.freeze({ key: "small", label: "소형 도화지", cost: 5, rows: 16, strokes: 3 }),
    ]),

    // ── 잉크 제한 — 시험값 ──────────────────────────────────────
    // 잉크통은 도화지를 살 때 한 통 가득 채워진다(도화지값에 잉크가 포함된 셈).
    // 「칸」은 내부 계산 단위다. 플레이어에게는 칸·리터가 아니라 「완성 필요량의 몇 %」로만 말한다.
    //
    // 2026-08-19 확정: 기본 잉크통은 소형 도화지 완성분(48칸)의 3분의 2인 32칸이다.
    // 그래서 첫 작품은 2회를 온전히 민 뒤 3회차에 들어가는 순간 바닥나고,
    // 3분의 1이 빈 채 미완성으로 팔린다.
    // 잉크통 1단계(+16칸)를 사야 비로소 한 장을 끝까지 찍을 수 있다.
    // (2026-08-10 라운드 003의 「절반인 24칸 · 1.5회」는 이 값으로 대체됐다.)
    ink: Object.freeze({
      // 2026-08-19 확정: 첫 잉크통을 1.5회분(24칸·50%) → 2회분(32칸·67%)로 올렸다.
      // 동현 원문은 2.5회였으나, 83%까지 그려진 그림을 「미완성」이라며 정액 70원에 파는
      // 것이 억울해 보여 2회로 정했다. 3분의 1이 눈에 띄게 비어 있어 미완성이 납득된다.
      baseCapacity: 32, // 잉크통 0단계 = 완성 필요량의 67% (인쇄 2회에서 바닥)
      capacityPerLevel: 16, // 1단계의 증가량 — capacitySteps[0]과 같은 값이다
      // 2026-08-19: 단계별 증가량. 0단계 24칸(50%) → 1단계 48칸(100%)
      // → 2단계 96칸(200%). 2단계가 +48인 이유는 도화지 두 장이 정확히 96칸이기
      // 때문이다 — 작업대 두 대를 한 묶음으로 끝까지 찍을 수 있는 최소 용량이다.
      // 0단계 32칸(67%) → 1단계 48칸(100%·한 장) → 2단계 96칸(200%·두 장).
      // 1단계 증가량이 24 → 16으로 줄어든 것은 기본이 그만큼 올라갔기 때문이다.
      // 2026-10-12 v5(설계표 4절): 잉크통 5단계 — 0단계 32칸(67%) → 48(100%) · 72(150%) · 96(200%) · 120(250%) · 144(300%).
      // 원작 잉크 배수와 짝이다: 진주 고양이 ×1.5 = 2단계 · 별이 빛나는 밤 ×2 = 3단계 · 절규 ×2.5 = 4단계 · 키스 ×3 = 5단계.
      // 2026-10-20 v9(기둥 설계표 4절): 잉크통 3단계 — 0단계 32칸(두 번) → 48(세 번) · 64(네 번) · 80(다섯 번).
      // 원작별 잉크 배수가 없어지고 「직접 미는 횟수 × 16칸」이 돼서, 가장 많이 미는 그림(5번 = 80칸)까지만 있으면 된다.
      capacitySteps: Object.freeze([16, 16, 16]),
      // 같은 그림에 한 번 더 밀 때 드는 칸 수 — 이번 판에서는 잠겨 있는 내부값이다.
      // 되살리려면 문구부터 새로 승인받는다.
      extraPrintCells: 16,
    }),

    // ── 경험치 — 시험값 ─────────────────────────────────────────
    xp: Object.freeze({
      windowStroke: 3, // 유리창 밀대 완주 1회
      windowDone: 12, // 창문 한 장 완성
      jackpot: 20, // 대성공 추가분
      printStroke: 5, // 인쇄 완주 1회
      sell: Object.freeze([10, 18, 30, 55, 90]), // 등급별 판매 경험치
      incompleteSell: 6, // 미완성 작품 판매 — 완성 브론즈보다 적다
    }),

    // 레벨 곡선 — 다음 레벨까지 필요한 경험치 = base + (레벨-1)×step (시험값)
    level: Object.freeze({ base: 40, step: 35, maxLevel: 20 }),

    // 레벨이 판매가에 주는 영향 — 등급 「항목별」로 계수가 다르다.
    // 하나의 전역 배율로 묶지 않는다(정본 §6-3). 높은 등급일수록 레벨값이 크다.
    levelPriceBonus: Object.freeze([0.02, 0.03, 0.05, 0.07, 0.10]),
  });

  // ── 자유 작업대·첫 갤러리 시험값 (2026-08-10 라운드 005 승인) ──
  // 여기 숫자도 전부 「시험값」이다. 무료 전시 칸 1개만 확정이고, 갤러리 가치 상승
  // 속도·상한·추가 칸 가격·버프 수치는 정본에서 「미정」이라 이 파일 어디에도
  // 숫자로 만들지 않는다.
  //
  // 라운드 004의 「총비용·부족액·필요한 유리창 수」 강제 목표 계산기는 라운드 005에서
  // 폐기됐고 되살리지 않는다. 다만 2026-08-12 계약 7·8이 「첫 정상 완성품 판매 직후
  // 60원짜리 두 번째 작업대 상품」을 되살렸으므로 그 가격만 여기 시험값으로 둔다.
  // 강제 목표도, 3·4번째 작업대도, 리셋으로 이어지는 별도 재화도 함께 만들지 않는다.
  //
  // 2026-10-06 두 방 데모 B-1: 작업대 확장을 뺐다(9/9 MNL-04 「작업대 확장 제외」 · 9/16 재확인 ·
  // 10/6 형님 「재현이형과 회의로 작업대 늘어나는 아이디어 폐기」). 작업대는 언제나 1대다.
  // 상품 정의(secondWorkbench)는 지우지 않고 남겨 두되, 상점에 내놓지 않는다(secondWorkbenchOffered).
  const EXPANSION_TEST_VALUES = Object.freeze({
    maxSlots: 1, // 이번 범위의 최대 칸 수 — 작업대 확장 제외(2026-10-06 B-1, 8/27판은 2)
    secondWorkbenchOffered: false, // 두 번째 작업대 상품을 상점에 내놓는가 — B-1부터 내놓지 않는다
    gallerySlots: 1, // 무료 전시 칸 1개
    // 검수 전용 돈 버튼. v5: 뒤쪽 원작(별밤 5,000 · 키스 100,000)까지 가 보게 1만 · 10만을 덧붙였다.
    reviewMoneyAmounts: Object.freeze([20, 100, 500, 10000, 100000]),
    // 두 번째 작업대 상품 — 첫 정상 완성품을 팔면 상점에 열리는 유료 상품이다.
    // 자연 경제 기준으로 그 순간 수중은 74원이고, 사면 14원이 남는다 (계약 8).
    // 정식 가격은 아직 확정이 아니다 (계약 「구현하지 않는 것」).
    secondWorkbench: Object.freeze({
      key: "secondWorkbench",
      label: "두 번째 작업대",
      cost: 60,
      effect: "같은 규격 작업대가 한 대 더 놓임",
      note: "도화지를 한 장씩 두 대에 놓고 위쪽 공통 밀대로 함께 밉니다.",
    }),
  });

  // ── 업그레이드 3항목 — 서로 효과를 섞지 않는 독립 항목 ─────────
  // 배열 순서가 곧 해금 순서다(위에서 아래로 하나씩).
  // 2026-10-08 두 방 데모 3단계(형님 4-A): 「앞 항목을 사야 뒤 항목이 열린다」는 조건은 뺐다.
  // 이제 해금은 구간 목표 하나만 본다 — 잉크통만 예전처럼 첫 미완성 판매 뒤 전화로 열리고,
  // 나머지는 아래 SEGMENT_TEST_VALUES의 구간을 하나 넘을 때마다 하나씩 열린다.
  // 가지치기 트리는 폐기됐다(정본 §6-1). 비용·효과 숫자는 전부 시험값.
  //
  // 2026-08-10 라운드 003 승인 사항 두 가지:
  //  1) 첫 미완성 판매 전에는 상점이 아예 열리지 않고, 첫 항목은 「잉크통 크기」다.
  //     (정본 §6-1의 「첫 업그레이드는 밀대」보다 나중에 승인된 결정이라 이쪽을 따른다.)
  //  2) 유리창 도구와 인쇄 도구를 완전히 분리한다.
  //     유리창 = 「고무 밀대」, 인쇄 = 「망 위의 잉크를 미는 인쇄 스퀴지」.
  //     한 항목이 다른 쪽 일을 절대 하지 않는다.
  //
  // 2026-08-12 계약 15: 일반 상점에서 유리창 전용 강화 카드(「고무 밀대 속도」·
  // 「고무 밀대 질」)를 뺐다. 유리창 전용 성장 화면도 따로 만들지 않는다. 두 항목의 내부
  // 효과 계산(엔진의 glassSpeedLevel·jackpotChance)은 그대로 남아 있어 나중에 별도
  // 유리창 성장 축이 승인되면 카드만 다시 붙이면 된다.
  // ── 2026-10-12 v5 · 업그레이드 5종 20단계 (형님 22-A · 작업실 설계표 4절) ──
  // 가격 배율은 피드더퀸(다음 단계 ×2.3 안팎)과 스크리치(운 ×5 · 봇 ×5~20)를 따랐다.
  // 효과가 큰 줄일수록 배율을 크게 했다(포춘밀). 숫자는 전부 출발값 — 형님이 해 보고 다시 맞춘다.
  // 열리는 때: 잉크통 = 첫 미완성 판매 뒤 전화(그대로) · 스퀴지 = 구간 1 · 잉크 질 = 구간 3 ·
  // 자동구매 = 구간 5 · 자동판매 = 구간 7. 배열 순서가 곧 상점에 나오는 순서다.
  // v4의 잉크통 단계 관문(2단계 = 진주 고양이 보유)은 설계표에 없어 뺐다 — 열리면 끝까지 산다.
  // ── 2026-10-20 v9 · 상점 3항목 + 오른쪽 「업그레이드」 세 칸 (그릴미 기둥 2-7 · 2-8 · 시안 2판) ──
  // 상점(왼쪽 상점 탭)에는 잉크통 크기 · 한 장 자동 제작 · 작품 자동판매만 남는다.
  // 인쇄 스퀴지 속도 · 모작 운은 오른쪽 맨 위 세 칸(RAIL_UPGRADES)으로 옮겼고, 스퀴지 재질(나무 → 브론즈 → 실버)이 새로 생겼다.
  // 배열 순서가 곧 상점에 나오는 순서이자 해금 순서다(앞 카드가 열려야 뒤 카드가 열린다 — 잉크통은 전화로 열린다).
  // 숫자는 기둥 경제 설계표(docs/plans/2026-10-06-mewna-two-room-demo/pillars-economy-2026-10-16/ 4절) 출발값 — 형님 플레이 뒤 다시 맞춘다.
  const UPGRADES = Object.freeze([
    Object.freeze({
      key: "inkTank",
      rail: "shop",
      label: "잉크통 크기",
      cost: 3, // 1단계 가격 — costs[0]과 같은 값이다
      costs: Object.freeze([3, 400, 10000]),
      maxLevel: 3,
      // 단계별 문구 — 카드가 「다음에 살 단계」의 말을 하도록 갈아 낀다.
      // 2026-10-20 v9: 한 번 밀 때 16칸 — 1단계 48칸(세 번) · 2단계 64칸(네 번) · 3단계 80칸(다섯 번).
      effects: Object.freeze([
        "잉크통이 세 번 밀 만큼 커짐",
        "잉크통이 네 번 밀 만큼 커짐",
        "잉크통이 다섯 번 밀 만큼 커짐",
      ]),
      notes: Object.freeze([
        "세 번 미는 그림을 끝까지 찍을 수 있게 됩니다.",
        "네 번 미는 그림도 끝까지 찍습니다.",
        "다섯 번 미는 그림도 끝까지 찍습니다.",
      ]),
      effect: "잉크통이 세 번 밀 만큼 커짐",
      note: "세 번 미는 그림을 끝까지 찍을 수 있게 됩니다.",
      unlock: Object.freeze({ type: "phone", value: "ink" }),
      // 단계 관문 — 1단계는 전화로 열리고, 2단계 = 구간 4 · 3단계 = 구간 8을 넘어야 산다(설계표 4절).
      stageGates: Object.freeze([
        null,
        Object.freeze({ type: "segment", value: 4 }),
        Object.freeze({ type: "segment", value: 8 }),
      ]),
    }),
    // 한 장 자동 제작 — v8 「도화지 자동구매」. 빈 작업대에 마지막으로 고른 원작을 알아서 한 장 올린다.
    Object.freeze({
      key: "autoBuyPaper",
      rail: "shop",
      label: "한 장 자동 제작",
      cost: 400,
      maxLevel: 1,
      effect: "작업대가 비면 마지막으로 그린 원작을 알아서 한 장 올림",
      note: "지갑이 참가비 두 장분 아래로 내려가면 멈춥니다.",
      unlock: Object.freeze({ type: "segment", value: 5 }),
    }),
    // 자동판매 2단계 — 1단계 = 브론즈 · 실버만 자동 / 2단계 = 골드 이상도 자동. 미완성은 두 단계 모두 손으로 판다.
    Object.freeze({
      key: "autoSellWork",
      rail: "shop",
      label: "작품 자동판매",
      cost: 3000,
      costs: Object.freeze([3000, 40000]),
      maxLevel: 2,
      effects: Object.freeze([
        "브론즈 · 실버 작품을 알아서 팔아 줌",
        "골드 이상 작품도 알아서 팔아 줌",
      ]),
      notes: Object.freeze([
        "미완성과 골드 이상은 직접 팝니다. 상점에서 잠시 끌 수 있습니다.",
        "미완성은 직접 팝니다. 상점에서 잠시 끌 수 있습니다.",
      ]),
      effect: "브론즈 · 실버 작품을 알아서 팔아 줌",
      note: "미완성과 골드 이상은 직접 팝니다. 상점에서 잠시 끌 수 있습니다.",
      unlock: Object.freeze({ type: "segment", value: 7 }),
    }),
  ]);

  // ── 스퀴지 재질 (기둥 2-7 · 설계표 3절) ─────────────────────────
  // 비유: 신발. 재질(나무 → 브론즈 → 실버)은 비싼 새 신발이고, 속도(1~5단계)는 싸게 조이는 신발 끈이다.
  // 새 신발을 사면 끈은 처음부터 다시 조인다(속도 1단계) — 그래도 새 재질 1단계가 앞 재질 5단계보다 약 25% 세다.
  //   f1 / f5 — 속도 1단계 · 5단계의 힘. 사이 단계는 등비(한 단계마다 약 ×1.18).
  //   price   — 이 재질을 사는 값(나무는 처음부터 가짐) · segment — 이 구간을 넘으면 오른쪽 칸에서 살 수 있다.
  //   steps   — 이 재질의 속도 2 · 3 · 4 · 5단계 값.
  const SQUEEGEE_MATERIALS = Object.freeze([
    Object.freeze({ key: "wood", label: "나무", f1: 1.0, f5: 1.94, price: 0, segment: 0, steps: Object.freeze([8, 18, 40, 90]) }),
    Object.freeze({ key: "bronze", label: "브론즈", f1: 2.4, f5: 4.65, price: 700, segment: 4, steps: Object.freeze([160, 360, 800, 1800]) }),
    Object.freeze({ key: "silver", label: "실버", f1: 5.8, f5: 11.2, price: 20000, segment: 7, steps: Object.freeze([4000, 9000, 20000, 45000]) }),
  ]);
  const SQUEEGEE_MAX_SPEED = 5;
  // 재질 · 속도 단계(1~5) → 밀대 힘. 화면의 밀대 빠르기 = 이 힘 ÷ 원작 저항.
  function squeegeeForce(materialIndex, speedStep) {
    const m = SQUEEGEE_MATERIALS[Math.max(0, Math.min(SQUEEGEE_MATERIALS.length - 1, Math.round(Number(materialIndex) || 0)))];
    const step = Math.max(1, Math.min(SQUEEGEE_MAX_SPEED, Math.round(Number(speedStep) || 1)));
    return m.f1 * Math.pow(m.f5 / m.f1, (step - 1) / (SQUEEGEE_MAX_SPEED - 1));
  }

  // ── 오른쪽 「업그레이드」 세 칸 — 화면 순서 = 모작 운 → 스퀴지 종류 → 스퀴지 속도 (형님 10/19 12번) ──
  // 상점 카드처럼 「위에서 아래로 차례로」 열리지 않고, 칸마다 자기 구간만 본다(시안 2판).
  // 단계는 엔진의 S.upgrades[key]에 같이 담는다 — 저장 · 불러오기가 상점 항목과 같은 길로 지나간다.
  //   inkQuality         — 모작 운(옛 잉크 질). 단계마다 모든 원작의 확률 단계 +1. 구간 3.
  //   squeegeeMaterial   — 스퀴지 종류. 0 나무 · 1 브론즈 · 2 실버. 다음 재질은 그 재질의 구간을 넘어야 산다.
  //   printSqueegeeSpeed — 스퀴지 속도. 지금 재질에 붙는 단계 0~4(= 속도 1~5단계). 재질을 바꾸면 0으로. 구간 1.
  const RAIL_UPGRADES = Object.freeze([
    Object.freeze({
      key: "inkQuality",
      rail: "right",
      label: "모작 운", // 2026-10-16 v8 · 형님 그릴미 22-A: 「잉크 질」 → 「모작 운」
      cost: 40,
      // 2026-10-20 v9(설계표 4절): 뒤쪽 값만 약 0.7배 — 40 · 300 · 2,500 · 14,000 · 110,000 · 900,000
      costs: Object.freeze([40, 300, 2500, 14000, 110000, 900000]),
      maxLevel: 6,
      effect: "좋은 등급이 나올 확률 단계 +1",
      note: "모든 원작에서 좋은 등급이 더 자주 나옵니다.",
      unlock: Object.freeze({ type: "segment", value: 3 }),
    }),
    Object.freeze({
      key: "squeegeeMaterial",
      rail: "right",
      label: "스퀴지 종류",
      cost: SQUEEGEE_MATERIALS[1].price,
      costs: Object.freeze([SQUEEGEE_MATERIALS[1].price, SQUEEGEE_MATERIALS[2].price]),
      maxLevel: SQUEEGEE_MATERIALS.length - 1,
      effect: "다음 재질 스퀴지 — 사면 속도는 1단계부터",
      note: "새 재질은 속도 1단계여도 앞 재질 5단계보다 셉니다.",
      unlock: Object.freeze({ type: "segment", value: SQUEEGEE_MATERIALS[1].segment }),
      stageGates: Object.freeze([
        Object.freeze({ type: "segment", value: SQUEEGEE_MATERIALS[1].segment }),
        Object.freeze({ type: "segment", value: SQUEEGEE_MATERIALS[2].segment }),
      ]),
    }),
    Object.freeze({
      key: "printSqueegeeSpeed",
      rail: "right",
      label: "스퀴지 속도",
      cost: SQUEEGEE_MATERIALS[0].steps[0],
      // 값은 지금 재질에 따라 다르다 — squeegeeSpeedCost(재질, 단계)가 정한다(아래 costs는 나무 기준 기록).
      costs: SQUEEGEE_MATERIALS[0].steps,
      maxLevel: SQUEEGEE_MAX_SPEED - 1,
      effect: "인쇄 밀대가 빨라짐",
      note: "망 위의 잉크를 미는 인쇄 도구입니다. 원작을 바꿔도 그대로입니다.",
      unlock: Object.freeze({ type: "segment", value: 1 }),
    }),
  ]);
  // 지금 재질에서 속도 단계(0~3 → 다음 단계)를 사는 값. 다 올렸으면 0.
  function squeegeeSpeedCost(materialIndex, level) {
    const m = SQUEEGEE_MATERIALS[Math.max(0, Math.min(SQUEEGEE_MATERIALS.length - 1, Math.round(Number(materialIndex) || 0)))];
    const lv = Math.max(0, Math.round(Number(level) || 0));
    return lv < m.steps.length ? m.steps[lv] : 0;
  }

  // v9: 엔진의 단계표(S.upgrades)는 상점 3항목 + 오른쪽 세 칸 단계를 함께 든다 — 저장도 한 길로 지나간다.
  const ALL_UPGRADES = Object.freeze(UPGRADES.concat(RAIL_UPGRADES));
  const UPGRADE_KEYS = Object.freeze(ALL_UPGRADES.map(function (u) { return u.key; }));
  const RAIL_UPGRADE_KEYS = Object.freeze(RAIL_UPGRADES.map(function (u) { return u.key; }));

  // ── 구간 목표 금액 — 시험값 (2026-10-08 두 방 데모 3단계 → 2026-10-12 v5 11칸) ─────────
  // 공방 경험치·레벨을 없애고 이 막대 하나로 해금을 연다(10/6 그릴미 · 형님 3-A · 4-A · 5-A).
  // 비유: 계단 열한 칸. 칸마다 「이번 칸에서 번 돈」이 목표에 닿으면 문 하나가 열리고 다음 칸으로 오른다.
  //   · 세는 돈 = 이번 구간에 「번」 돈의 합계(3-A) — 유리창 보수와 작품 판매 대금만.
  //     대출금은 남의 돈이고, 검수 전용 돈 버튼은 진짜 벌이가 아니라서 세지 않는다.
  //     돈을 써도 막대는 줄지 않는다(스크리치 방식).
  //   · 목표를 넘친 돈은 다음 구간으로 넘어간다(형님 확인 전 임시 판단 — 반영표 「임의로 정한 것」).
  //   · 2026-10-12 v5(작업실 설계표 5절): 1달러 단위 11칸. 해금은 스크리치처럼 앞에 몰고 뒤로 벌렸다
  //     (모의 플레이 중앙: 구간 1 = 0.6분 · 3 = 3.2분 · 6 = 11.4분 · 11 = 36.1분).
  const SEGMENT_TEST_VALUES = Object.freeze({
    // 2026-10-20 v9(기둥 설계표 7절): 구간 7~11을 약 0.7배로 — 모의 플레이 중앙 1막 35.6분.
    goals: Object.freeze([10, 30, 80, 250, 800, 2500, 5500, 17500, 55000, 175000, 500000]),
    // 구간 i를 넘으면 열리는 것. 상점 항목은 UPGRADES의 key, 「original:키」는 경매장 문에 그 원작이 뜨는 때,
    // null은 여는 것이 없는 칸(구간 9)과 마지막 칸(1막 끝)이다.
    rewards: Object.freeze([
      "printSqueegeeSpeed", "auctionDoor", "inkQuality", "original:pearl-cat", "autoBuyPaper",
      "original:starry-night", "autoSellWork", "original:scream", null, "original:kiss", null,
    ]),
    // 상점 항목이 아닌 보상의 이름표 — 새 원작은 얻기 전까지 이름을 숨기고 급만 말한다(카탈로그 실루엣과 같은 규칙).
    rewardLabels: Object.freeze({
      auctionDoor: "경매장 문",
      "original:pearl-cat": "새 원작 3급",
      "original:starry-night": "새 원작 4급",
      "original:scream": "새 원작 5급",
      "original:kiss": "새 원작 6급",
    }),
    // 2026-10-20 v9: 한 구간에 여럿이 함께 열리는 칸(구간 4 · 7 · 8)이 생겨 「다음: …」 줄을 칸마다 통째로 적는다(시안 2판).
    // null이면 위 rewards · rewardLabels로 만든 이름을 쓴다(여는 것이 없는 구간 9 = 「구간 10」, 마지막 = 「1막 끝」).
    rewardTexts: Object.freeze([
      "스퀴지 속도", "경매장 문", "모작 운", "새 원작 3급 · 브론즈 스퀴지 · 잉크통 2단계", "한 장 자동 제작",
      "새 원작 4급", "작품 자동판매 · 실버 스퀴지", "새 원작 5급 · 잉크통 3단계", null, "새 원작 6급", null,
    ]),
    // 막대가 세는 수입의 출처 — 엔진의 수입 문(gainIncome)이 붙이는 이름표와 같다.
    countedSources: Object.freeze(["window", "sale"]),
    // 마지막 구간까지 넘으면 「1막 끝」 화면이 뜬다(10/6 4-A — 화면 자리만, 초기화 없음).
    finalLabel: "1막 끝",
  });

  // ── 원작 사다리 6점 — 시험값 (2026-10-08 4단계 고리 → 2026-10-12 v5 사다리) ─────────────
  // 비유: 사다리 여섯 칸. 새 칸(새 원작)에 발을 올리면 처음엔 흔들려서(확률이 낮음) 아래 칸을 조금 더 밟는다.
  // 한두 번 다지면(원작 레벨업) 그 칸이 단단해져 주력이 된다(형님 20-B 「사다리 + 키워야 주력」).
  //   priceMult   — 급 배율. 판매가와 재료비 둘 다에 곱한다(26-A). ×5씩 오른다.
  //   firstPrice  — 경매장 문에서 처음 얻는 값. 다시 사면(레벨업) firstPrice × 1.6^(지금 레벨).
  //                 뮤나리자는 처음부터 가지므로 레벨업 기준값(15)으로만 쓴다.
  //   inkMult     — 한 장을 찍는 데 드는 잉크 배수(잉크통 단계와 짝).
  //   stageOffset — 출발 확률 단계 빼기. 확률 단계 = 3 + 잉크 질 단계 − stageOffset (0~8로 자름).
  //   segment     — 경매장 문에 이 원작이 처음 뜨는 구간(그 구간을 넘으면).
  //   startOwned  — 새 게임에서 처음부터 가진 원작.
  // 전부 출발값이다(작업실 설계표 3절 · 모의 플레이 200판으로 1막 약 36분에 맞춤).
  const ORIGINAL_TEST_VALUES = Object.freeze({
    // 2026-10-20 v9(기둥 설계표 2절): 2번째 = 「춤」(해바라기 대체 · 형님 9 = A2) · 한 번에 한 색이라 잉크 배수(inkMult)는 모두 1 —
    // 한 장 잉크 = 직접 미는 횟수(strokes) × 16칸. resist = 원작 저항(같은 스퀴지로 위 원작일수록 느리게 내려감).
    // 별이 빛나는 밤 · 절규 · 키스 첫 값은 약 0.7배(5,000 → 3,500 · 30,000 → 21,000 · 100,000 → 70,000).
    // strokes는 art.js의 칠하는 순서(색 − 1)와 같아야 한다 — 검사(two-room-v9)가 맞춰 본다.
    list: Object.freeze([
      Object.freeze({ key: "mewna-lisa", tier: 1, priceMult: 1, firstPrice: 15, inkMult: 1, stageOffset: 0, segment: 0, startOwned: true, strokes: 3, resist: 1.0 }),
      Object.freeze({ key: "dance", tier: 2, priceMult: 5, firstPrice: 60, inkMult: 1, stageOffset: 2, segment: 2, startOwned: false, strokes: 3, resist: 1.2 }),
      Object.freeze({ key: "pearl-cat", tier: 3, priceMult: 25, firstPrice: 500, inkMult: 1, stageOffset: 3, segment: 4, startOwned: false, strokes: 4, resist: 1.45 }),
      Object.freeze({ key: "starry-night", tier: 4, priceMult: 125, firstPrice: 3500, inkMult: 1, stageOffset: 4, segment: 6, startOwned: false, strokes: 4, resist: 1.75 }),
      Object.freeze({ key: "scream", tier: 5, priceMult: 625, firstPrice: 21000, inkMult: 1, stageOffset: 5, segment: 8, startOwned: false, strokes: 5, resist: 2.1 }),
      Object.freeze({ key: "kiss", tier: 6, priceMult: 3125, firstPrice: 70000, inkMult: 1, stageOffset: 6, segment: 10, startOwned: false, strokes: 5, resist: 2.5 }),
    ]),
    levelMult: 1.5,   // 원작 레벨 하나마다 판매가 ×1.5 (28-A — 스크리치 ×1.3보다 큼: 레벨업에 돈이 들어서)
    maxLevel: 5,      // 원작 레벨 최대 (5레벨 = ×5.06)
    rebuyGrowth: 1.6, // 다시 사기 값이 레벨마다 1.6배
  });

  function originalRule(key) {
    return ORIGINAL_TEST_VALUES.list.find(function (o) { return o.key === key; }) || null;
  }
  // 새 게임의 원작 레벨표 — 0이면 아직 없는 원작이다.
  function startingOriginalLevels() {
    const out = {};
    ORIGINAL_TEST_VALUES.list.forEach(function (o) { out[o.key] = o.startOwned ? 1 : 0; });
    return out;
  }
  function originalInkMult(key) {
    const o = originalRule(key);
    return o ? o.inkMult : 1;
  }
  // 2026-10-20 v9 — 한 번에 한 색: 이 원작을 직접 미는 횟수(= 색 − 1). 모르는 원작이면 뮤나리자(3).
  function manualStrokesFor(key) {
    const o = originalRule(key) || ORIGINAL_TEST_VALUES.list[0];
    return Math.max(1, Math.round(Number(o.strokes) || ECON_TEST_VALUES.manualPrintCount));
  }
  // 이 원작 한 장을 끝까지 찍는 잉크(칸) = 직접 미는 횟수 × 16줄(한 번 밀 때 한 줄에 1칸). 마지막 자동 마감은 잉크를 쓰지 않는다.
  function requiredCellsFor(key) {
    return manualStrokesFor(key) * ECON_TEST_VALUES.paperSizes[0].rows;
  }
  // 원작 저항 — 밀대 빠르기 = 스퀴지 힘 ÷ 저항. 모르는 원작이면 1.
  function originalResist(key) {
    const o = originalRule(key);
    return o && o.resist > 0 ? o.resist : 1;
  }
  // 그림 한 점의 판매가 = 등급 기본가 × 급 배율 × 1.5^(원작 레벨 − 1). (v4의 「+20%씩 더하기」를 곱하기로)
  function originalPriceFor(gradeIndex, key, level) {
    const g = ECON_TEST_VALUES.grades[gradeIndex];
    if (!g) return 0;
    const o = originalRule(key) || ORIGINAL_TEST_VALUES.list[0];
    const lv = Math.max(1, Math.min(ORIGINAL_TEST_VALUES.maxLevel, Math.round(Number(level) || 1)));
    return Math.round(g.price * o.priceMult * Math.pow(ORIGINAL_TEST_VALUES.levelMult, lv - 1));
  }
  // 재료비(도화지 + 잉크) = 5 × 급 배율 (26-A). 원작을 아직 고르지 않았으면 뮤나리자 값.
  function materialCostFor(key) {
    const o = originalRule(key) || ORIGINAL_TEST_VALUES.list[0];
    return Math.round(ECON_TEST_VALUES.paperCost * o.priceMult);
  }
  // 미완성(잉크가 모자라 도중에 끝난 그림)의 판매가 = 그 원작 재료비의 70% (반올림).
  function incompletePriceFor(key) {
    return Math.round(materialCostFor(key) * ECON_TEST_VALUES.incompleteSaleRatio);
  }
  // 경매장 문에서 이 원작을 얻는 값 — 처음이면 firstPrice, 가진 원작이면 firstPrice × 1.6^(지금 레벨).
  function originalLotPrice(key, currentLevel) {
    const o = originalRule(key);
    if (!o) return 0;
    const lv = Math.max(0, Math.round(Number(currentLevel) || 0));
    return lv <= 0 ? o.firstPrice : Math.round(o.firstPrice * Math.pow(ORIGINAL_TEST_VALUES.rebuyGrowth, lv));
  }
  // ── 경매장 문 매물 2칸 (형님 27-A · 설계표 9절 3) ──
  //   newLot   — 아직 없는 원작 중 급이 가장 낮은 것. 그 원작의 구간을 아직 못 넘었으면 locked(예고만, 살 수 없음).
  //              다 모았으면 null.
  //   levelLot — 지금 주력(가진 원작 중 급이 가장 높은 것)의 레벨업. 최고 레벨이면 null.
  // 비유: 진열장 두 칸 — 왼쪽은 「다음 그림」, 오른쪽은 「지금 쓰는 틀 다지기」.
  // 2026-10-16 v8 · 형님 그릴미 16-A · 5-A: 아래 칸(레벨업) = 「지금 그리는 원작」의 레벨업.
  // 가진 원작은 모두 계속 레벨업할 수 있다. 지금 원작을 아직 안 정했거나 안 가졌으면 v7처럼 급이 가장 높은 것.
  function doorLots(levels, segmentIndex, selectedKey) {
    const lv = function (o) { return Math.max(0, Math.round(Number(levels && levels[o.key]) || 0)); };
    const seg = Math.max(0, Math.round(Number(segmentIndex) || 0));
    const byTier = ORIGINAL_TEST_VALUES.list.slice().sort(function (a, b) { return a.tier - b.tier; });
    const lot = function (o, from, kind) {
      return {
        key: o.key,
        tier: o.tier,
        kind: kind,
        isNew: from <= 0,
        fromLevel: from,
        toLevel: from + 1,
        price: originalLotPrice(o.key, from),
        inkMult: o.inkMult,
        priceMult: o.priceMult,
        unlockSegment: o.segment,
        locked: kind === "new" && seg < o.segment,
      };
    };
    const nextNew = byTier.find(function (o) { return lv(o) <= 0; }) || null;
    const owned = byTier.filter(function (o) { return lv(o) >= 1; });
    const picked = owned.find(function (o) { return o.key === selectedKey; });
    const top = picked || (owned.length ? owned[owned.length - 1] : null);
    return {
      newLot: nextNew ? lot(nextNew, 0, "new") : null,
      levelLot: top && lv(top) < ORIGINAL_TEST_VALUES.maxLevel ? lot(top, lv(top), "levelUp") : null,
    };
  }

  // ── 확률 단계 표 (2026-10-12 v5 · 작업실 설계표 6절) ───────────────────────
  // 한 회차의 등급 확률을 단계 0~8 아홉 줄로 둔다. 3 = v4까지 쓰던 회차표(80 · 15 · 4 · 0.8 · 0.2).
  // 확률 단계 = 3 + 잉크 질 단계 − 원작 출발 단계(stageOffset) → 0~8로 자른다.
  // 새 원작일수록 처음엔 좋은 등급이 덜 나온다(스크리치 「새 복권은 낮은 운에서 출발」).
  // 그림 한 장 = 세 회차 독립 추첨, 최고 등급만 남는다(9/2 · 9/16 그대로).
  const ROUND_TABLES = Object.freeze([
    Object.freeze([0.97, 0.03, 0, 0, 0]),
    Object.freeze([0.92, 0.07, 0.01, 0, 0]),
    Object.freeze([0.86, 0.11, 0.025, 0.004, 0.001]),
    Object.freeze([0.80, 0.15, 0.04, 0.008, 0.002]),
    Object.freeze([0.72, 0.20, 0.06, 0.015, 0.005]),
    Object.freeze([0.63, 0.25, 0.09, 0.022, 0.008]),
    Object.freeze([0.54, 0.29, 0.12, 0.035, 0.015]),
    Object.freeze([0.45, 0.32, 0.16, 0.05, 0.02]),
    Object.freeze([0.36, 0.34, 0.20, 0.07, 0.03]),
  ]);
  const BASE_STAGE = 3;
  function probabilityStage(inkQualityLevel, key) {
    const o = originalRule(key) || ORIGINAL_TEST_VALUES.list[0];
    const raw = BASE_STAGE + Math.max(0, Math.round(Number(inkQualityLevel) || 0)) - o.stageOffset;
    return Math.max(0, Math.min(ROUND_TABLES.length - 1, raw));
  }

  function segmentRewardLabel(rewardKey) {
    if (!rewardKey) return "";
    const u = ALL_UPGRADES.find(function (x) { return x.key === rewardKey; }); // v9: 오른쪽 세 칸 이름도
    if (u) return u.label;
    return SEGMENT_TEST_VALUES.rewardLabels[rewardKey] || "";
  }

  // 지금 구간 번호와 그 구간에 번 돈에 수입 amount를 더한다.
  // 돌려주는 값: { index, earned, cleared } — cleared = 이번에 넘은 구간 번호들(0부터, 여러 개일 수 있다).
  // 순수 함수다. 상점을 여는 일·알림은 엔진이 cleared를 보고 한다.
  function segmentAdvance(index, earned, amount) {
    const goals = SEGMENT_TEST_VALUES.goals;
    let i = Math.max(0, Math.min(goals.length, Math.round(Number(index) || 0)));
    let have = Math.max(0, Number(earned) || 0);
    const add = Math.max(0, Math.round(Number(amount) || 0));
    const cleared = [];
    if (i >= goals.length) return { index: i, earned: 0, cleared: cleared }; // 다 넘었으면 더 세지 않는다
    have += add;
    while (i < goals.length && have >= goals[i]) {
      have -= goals[i]; // 넘친 돈은 다음 구간으로 넘어간다
      cleared.push(i);
      i += 1;
    }
    if (i >= goals.length) have = 0;
    return { index: i, earned: have, cleared: cleared };
  }

  // 오른쪽 위 막대가 그대로 그리는 값. 화면은 여기서 나온 글자·비율만 쓴다.
  function segmentView(index, earned) {
    const goals = SEGMENT_TEST_VALUES.goals;
    const total = goals.length;
    const i = Math.max(0, Math.min(total, Math.round(Number(index) || 0)));
    const done = i >= total;
    const goal = done ? goals[total - 1] : goals[i];
    const have = done ? goal : Math.max(0, Math.min(goal, Math.round(Number(earned) || 0)));
    const rewardKey = done ? null : SEGMENT_TEST_VALUES.rewards[i];
    // 2026-10-12 v5: 여는 것이 없는 칸(구간 9)은 「다음: 구간 10」, 마지막 칸은 「다음: 1막 끝」이라 말한다.
    const fullText = done ? null : (SEGMENT_TEST_VALUES.rewardTexts || [])[i];
    const rewardName = done ? SEGMENT_TEST_VALUES.finalLabel
      : fullText ? fullText
        : rewardKey ? segmentRewardLabel(rewardKey)
          : i === total - 1 ? SEGMENT_TEST_VALUES.finalLabel : "구간 " + (i + 2);
    const num = function (v) { return Number(v).toLocaleString("ko-KR"); };
    return {
      index: i,             // 지금 구간(0부터). 다 넘었으면 total
      number: done ? total : i + 1, // 화면에 쓰는 구간 번호(1부터)
      total: total,
      cleared: i,           // 넘은 구간 수
      goal: goal,
      earned: have,
      ratio: done ? 1 : (goal > 0 ? have / goal : 0),
      done: done,
      rewardKey: rewardKey,
      rewardLabel: rewardName,
      stepText: done ? "완료" : (i + 1) + " / " + total,
      // v5: 금액이 70만까지 커져 천 단위 쉼표를 붙인다.
      amountText: done ? "모든 구간 달성" : "이번 구간 " + num(have) + " / " + num(goal) + "$",
      rewardText: done ? SEGMENT_TEST_VALUES.finalLabel : "다음: " + rewardName,
    };
  }

  function upgradeByKey(key) {
    return ALL_UPGRADES.find(function (u) { return u.key === key; }) || null;
  }

  function paperSizeByKey(key) {
    return ECON_TEST_VALUES.paperSizes.find(function (p) { return p.key === key; })
      || ECON_TEST_VALUES.paperSizes[0];
  }

  // 도화지 크기 → 이 그림 한 장을 찍는 데 필요한 스크롤 칸 수.
  function paperCells(size) {
    const p = typeof size === "string" ? paperSizeByKey(size) : (size || ECON_TEST_VALUES.paperSizes[0]);
    return p.rows * p.strokes;
  }

  // ── 등급 확률 (2026-10-12 v5) ─────────────────────────────────────
  // v4까지는 최종 확률(브론즈 55%…)에서 회차 확률을 거꾸로 계산했다(세제곱근). v5는 거꾸로다 —
  // 회차 확률을 위 ROUND_TABLES(확률 단계 표)가 정하고, 최종 확률은 「세 회차 중 최고」로 계산한다.
  //   세 회차 최고 등급 ≤ g 일 확률 = (한 회차 ≤ g 일 확률)³
  // 모든 함수는 (잉크 질 단계, 원작 키)를 받는다. 원작 키가 없으면 뮤나리자(출발 단계 0)로 본다.
  const ROUNDS_PER_ARTWORK = ECON_TEST_VALUES.manualPrintCount; // 수동 3회 = 3회차

  // 한 회차 확률 5개 (지금 단계의 표 한 줄)
  function roundProbs(inkQualityLevel, key) {
    return ROUND_TABLES[probabilityStage(inkQualityLevel, key)].slice();
  }

  // 세 회차 최고 등급의 분포 — 확률표 「최종 결과 확률」이 쓰는 값.
  // 2026-10-20 v9 — 한 번에 한 색: 회차 수 = 그 원작을 직접 미는 횟수(3 · 3 · 4 · 4 · 5 · 5). 설계표 5절 · 9-A.
  function finalFromRounds(inkQualityLevel, key) {
    const probs = roundProbs(inkQualityLevel, key);
    const rounds = manualStrokesFor(key);
    const out = [];
    let cum = 0;
    let prevPow = 0;
    for (let i = 0; i < probs.length; i += 1) {
      cum += probs[i];
      const p = i === probs.length - 1 ? 1 : Math.pow(Math.min(1, cum), rounds);
      out.push(p - prevPow);
      prevPow = p;
    }
    return out;
  }
  // 최종 확률 5개 — 합계가 항상 100%. (v4 이름을 그대로 둔다 — 확률표 · 검사가 같은 이름을 부른다)
  function finalProbs(inkQualityLevel, key) { return finalFromRounds(inkQualityLevel, key); }

  // 관문 = 「등급 i에서 멈추지 않고 위로 올라갈 확률」. 확률 목록 → 관문 목록.
  function gatesFrom(probs) {
    const gates = [];
    let reach = 1;
    for (let i = 0; i < probs.length - 1; i += 1) {
      // 소수 찌꺼기(0.03 − 0.03 = 1e-17) 때문에 「나올 수 없는 등급」의 관문이 아주 조금 열리지 않게 0으로 자른다.
      const upper = reach - probs[i] < 1e-12 ? 0 : reach - probs[i];
      gates.push(reach > 1e-12 ? upper / reach : 0);
      reach = upper;
    }
    return gates;
  }
  // 최종 확률의 관문 (옛 한 번 추첨 경로용)
  function gateProbs(inkQualityLevel, key) { return gatesFrom(finalProbs(inkQualityLevel, key)); }
  function baseGates() { return gateProbs(0); }

  // 옛 「한 번에 최종 등급 뽑기」 — 주입된 난수로 관문을 차례로 통과한다.
  function rollGradeIndex(rng, inkQualityLevel, key) {
    const gates = gateProbs(inkQualityLevel, key);
    let index = 0;
    for (let i = 0; i < gates.length; i += 1) {
      if (rng() < gates[i]) index = i + 1;
      else break;
    }
    return index;
  }

  // 한 회차 추첨 — 8/27 rollGradeIndex와 같은 「관문 차례로 통과」 방식이라
  // 난수가 0이면 가장 높은 등급(그 단계에서 나올 수 있는 만큼), 1에 가까우면 브론즈다.
  function roundGates(inkQualityLevel, key) { return gatesFrom(roundProbs(inkQualityLevel, key)); }

  function drawRoundGrade(rng, inkQualityLevel, key) {
    const gates = roundGates(inkQualityLevel, key);
    let index = 0;
    for (let i = 0; i < gates.length; i += 1) {
      if (gates[i] > 0 && rng() < gates[i]) index = i + 1;
      else break;
    }
    return index;
  }

  // ── 레벨 ────────────────────────────────────────────────────
  function levelNeed(level) {
    return ECON_TEST_VALUES.level.base + (Math.max(1, level) - 1) * ECON_TEST_VALUES.level.step;
  }

  // 누적 경험치 → { level, into(현재 레벨에서 쌓인 양), need(다음 레벨까지 필요량) }
  function levelFromXp(totalXp) {
    let level = 1;
    let rest = Math.max(0, totalXp || 0);
    while (level < ECON_TEST_VALUES.level.maxLevel && rest >= levelNeed(level)) {
      rest -= levelNeed(level);
      level += 1;
    }
    const need = level >= ECON_TEST_VALUES.level.maxLevel ? 0 : levelNeed(level);
    return { level: level, into: rest, need: need };
  }

  // 등급별 실제 판매가 — 레벨 보너스는 등급마다 계수가 다르다(전역 배율 아님).
  function priceFor(gradeIndex, level) {
    const g = ECON_TEST_VALUES.grades[gradeIndex];
    if (!g) return 0;
    const bonus = ECON_TEST_VALUES.levelPriceBonus[gradeIndex] || 0;
    const steps = Math.max(0, (level || 1) - 1);
    return Math.round(g.price * (1 + bonus * steps));
  }

  // ── 상점 카드 표기 계약 — Scritchy Scratchy 장비 상점 문법 ──────
  // 공개된 카드는 사기 전에 「가격 + 현재 단계」를 같이 보여 준다.
  // 다음 단계가 남아 있으면 산 뒤에도 갱신된 가격과 올라간 레벨을 계속 보여 주고,
  // 마지막 단계까지 올린 항목만 가격 자리를 「강화 완료」, 구매 상태를 「MAX」로
  // 바꾸고 클릭할 수 없게 둔다. 아직 열리지 않은 자리는 가격도 레벨도 내보내지 않는다.
  //
  // 표기만 만드는 함수다. 해금 순서·가격·강화 효과·경제 시험값은 여기서 건드리지 않는다.
  // maxLevel이 2 이상인 항목이 나중에 생겨도 그대로 쓰도록 단계 수에 매이지 않게 만든다.
  // ── 0827 추가 확정 · 작업 탭 공통 카드 표기 계약 ────────────────────
  // (근거: coordination/0827-ui-presentation-comparison-2026-08-27/addenda/
  //  2026-08-27-work-pane-ui-unification.md · Discord 1542394725615669289)
  //
  // 상점 카드만이 아니라 작업 버튼으로 열리는 모든 작업 카드가 같은 네 항목만 담는다.
  //   이름 / 현재 돈 금액 / 레벨 / 레벨 게이지바
  // 설명문·보상 계산식·패널티 문장·진행 횟수·최고 레벨 문구·재고 문구는 기본 카드에서
  // 빠진다(접근성 이름에는 남길 수 있다). 돈은 원화 문구 없이 후치 `$`로 통일한다.
  // 이 결정은 표기만 바꾼다 — 경제·보상·해금 수치는 여기서 한 칸도 만들지 않는다.
  const WORK_CARD_FIELDS = Object.freeze(["name", "money", "level", "gauge"]);
  function moneyText(amount) {
    // v5: 값이 백만 단위까지 커져 천 단위 쉼표를 붙인다(1,300,000$).
    return Math.max(0, Math.round(Number(amount) || 0)).toLocaleString("ko-KR") + "$";
  }
  function workCardText(input) {
    const it = input || {};
    const maxLevel = Math.max(1, Math.round(Number(it.maxLevel) || 1));
    const level = Math.max(0, Math.min(maxLevel, Math.round(Number(it.level) || 0)));
    return {
      name: String(it.name || ""),
      money: moneyText(it.money),
      level: "Lv. " + level, // 진행 게이지형(Lv. 0/3)이 아니라 현재 단계만 쓴다
      gauge: shopCardGauge({ level: level, maxLevel: maxLevel }),
    };
  }

  // ── 상점 카드 표기 — 위 공통 계약과 같은 후치 $ 표기를 쓴다 ──────────
  // 2026-08-27 v1: 옛 `-50원` 표기는 0827 승인(상점 B · 한줄 균형형 + 작업 탭 통일)에서
  // `50$`로 교체됐다. 「강화 완료」·「MAX」 같은 최고 레벨 문구도 카드 본문에서 빠지고,
  // 그 사실은 게이지가 가득 찬 모습과 카드 상태(data-state)가 대신 말한다.
  // state 문구 자체는 접근성 이름이 계속 쓰므로 함수에는 남겨 둔다.
  function shopCardText(item) {
    const it = item || {};
    const level = Math.max(0, it.level || 0);
    const maxLevel = Math.max(1, it.maxLevel || 1);
    const max = level >= maxLevel;
    if (!it.revealed) {
      return { cost: "", level: "", state: "", max: max, clickable: false };
    }
    return {
      cost: moneyText(it.cost),
      level: "Lv. " + level, // 진행 게이지형(Lv. 0/3)이 아니라 현재 단계만 쓴다
      state: max ? "MAX" : (it.affordable ? "지금 살 수 있어요" : "돈이 모자라요"),
      max: max,
      clickable: !max && !!it.affordable,
    };
  }

  // ── 상점 카드 레벨 진행 게이지 (2026-08-27 v4 · 0825 UI 후속 2번) ──
  // 카드가 담는 것(이름 · 가격 · 현재 단계 · 짧은 효과)은 그대로 두고, 그 옆에
  // 「몇 단계 중 몇 단계인가」를 한눈에 보여 주는 짧은 막대를 하나 더 얹는다.
  //
  // 트랙(빈 막대) 길이는 레벨 0에도, 레벨 1에도, MAX에도 똑같은 고정값이다.
  // 채워지는 것은 안쪽 막대의 비율뿐이라 카드 안 다른 글자가 옆으로 밀리지 않는다
  // (상태가 변해도 UI 구역의 크기·위치는 고정한다는 정본 규칙).
  const SHOP_GAUGE_TRACK_PX = 72;
  function shopCardGauge(item) {
    const it = item || {};
    const maxLevel = Math.max(1, it.maxLevel || 1);
    const level = Math.max(0, Math.min(maxLevel, it.level || 0));
    const ratio = level / maxLevel;
    return {
      level: level,
      maxLevel: maxLevel,
      ratio: ratio,
      percent: Math.round(ratio * 100) + "%",
      trackPx: SHOP_GAUGE_TRACK_PX, // 레벨과 무관한 고정 길이
      label: level + "/" + maxLevel,
      max: level >= maxLevel,
    };
  }

  // ── 유리 파손 픽셀 연출 규칙 (2026-08-27 v4 · 0825 UI 후속 1번) ──
  // 「유리가 깨지면 실제로 깨지는 것이 보여야 한다」는 요구를 규칙 쪽에서 먼저 잠근다.
  // 화면 코드는 결과 키를 여기 넘기기만 하고 스스로 성공·실패를 판정하지 않는다 —
  // 그래야 성공·대성공에서 균열이 켜지는 실수가 구조적으로 불가능해진다.
  //
  // 그림 자체는 로컬 DOM/CSS가 그린다. 픽셀 파편이 단계별로 드러나는 2D 계단 연출이고
  // 이모지·외부 자원·3D·사진 표현은 쓰지 않는다 (정본 4-3 아트 규칙).
  const GLASS_BREAK_FX = Object.freeze({
    resultKey: "fail", // 이 결과 키에서만 켜진다
    shards: 9, // 픽셀 파편(균열 조각) 수
    steps: 4, // 균열이 번지는 단계 수
    stepMs: 120, // 한 단계가 머무는 시간
    holdMs: 520, // 다 갈라진 뒤 남아 있는 시간
  });
  function glassBreakFx(resultKey) {
    if (resultKey !== GLASS_BREAK_FX.resultKey) return null;
    const fx = GLASS_BREAK_FX;
    return {
      shards: fx.shards,
      steps: fx.steps,
      stepMs: fx.stepMs,
      holdMs: fx.holdMs,
      totalMs: fx.steps * fx.stepMs + fx.holdMs,
    };
  }

  // ── 0827 승인 · 유리 A「충격점 거미줄」의 유지 계약과 첫 안내 문구 ──────
  // 승인 비교판(comparison-0827-glass-presentation-2026-08-27-v1)의 shared_behavior:
  //   persistent_scenes: break · call · hold  →  다음 단계(next)에서만 지운다.
  // 즉 균열 그림은 연출 시간이 끝나도 스스로 닫히지 않고, 플레이어가 다음 유리창
  // 작업을 시작하는 순간(또는 전체 초기화)에만 사라진다.
  const GLASS_CRACK_PERSIST = Object.freeze({
    persistThrough: Object.freeze(["break", "call", "hold"]),
    clearsAt: "next", // 다음 유리창 작업 시작 (전체 초기화도 같은 정리를 쓴다)
  });
  // 첫 파손 안내 전화의 문구 — 승인 기록의 first_break_call 그대로다.
  function glassBreakCallLine() {
    return "유리창은 살살 닦아주세요! 잘못해서 파손되면 당신이 물어줘야해요.";
  }

  // ── 0827 승인 · 결과별 자동 마감의 「부드러운 동작」 ────────────────────
  // 승인 비교판의 자동 마감은 easeOutCubic 감속 곡선이다. 정본(4-2 변경 금지 연출)이
  // 못박은 「진행률 약 80% 이후 자동 마무리」 기준선과 총 소요 시간은 그대로 두고,
  // 그 구간을 지나는 「속도의 모양」만 선형에서 감속으로 바꾼다.
  // 순수 함수라 경제·확률·줄 수를 하나도 만들지 않는다.
  //   elapsedMs — 자동 마감이 시작된 뒤 흐른 시간
  //   totalMs   — 자동 마감 구간 전체 길이 (남은 줄 수 × 한 줄 시간)
  //   fromRow/toRow — 자동 마감이 채우는 줄 구간 (예: 13 → 16)
  function autoFinishRow(elapsedMs, totalMs, fromRow, toRow) {
    const from = Number(fromRow) || 0;
    const to = Number(toRow) || 0;
    const total = Number(totalMs) || 0;
    if (to <= from) return to;
    if (total <= 0) return to;
    const t = Math.max(0, Math.min(1, (Number(elapsedMs) || 0) / total));
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic — 승인 비교판과 같은 곡선
    return from + (to - from) * eased;
  }

  // ── 단계별 상점 값 (2026-08-19) ──────────────────────────────
  // 항목마다 단계별 가격·효과 문구를 가질 수 있게 한다. 배열이 없는 항목은
  // 예전처럼 단일 값을 그대로 쓴다 — 기존 항목의 동작이 달라지지 않는다.
  function upgradeCostFor(item, level) {
    const it = item || {};
    const lv = Math.max(0, Number(level) || 0);
    if (it.costs && it.costs.length) {
      return it.costs[Math.min(lv, it.costs.length - 1)];
    }
    return it.cost;
  }
  function upgradeEffectFor(item, level) {
    const it = item || {};
    const lv = Math.max(0, Number(level) || 0);
    if (it.effects && it.effects.length) {
      return it.effects[Math.min(lv, it.effects.length - 1)];
    }
    return it.effect;
  }
  function upgradeNoteFor(item, level) {
    const it = item || {};
    const lv = Math.max(0, Number(level) || 0);
    if (it.notes && it.notes.length) {
      return it.notes[Math.min(lv, it.notes.length - 1)];
    }
    return it.note;
  }
  // 잉크통 단계 → 통 용량(칸). 단계별 증가량을 차례로 더한다.
  function inkCapacityForLevel(level) {
    const ink = ECON_TEST_VALUES.ink;
    const lv = Math.max(0, Number(level) || 0);
    let cap = ink.baseCapacity;
    for (let i = 0; i < lv; i += 1) {
      const steps = ink.capacitySteps;
      cap += steps && steps.length
        ? steps[Math.min(i, steps.length - 1)]
        : ink.capacityPerLevel;
    }
    return cap;
  }

  function formatPercent(p) {
    const v = Math.round(p * 10000) / 100;
    return v.toLocaleString("ko-KR", { maximumFractionDigits: 2 }) + "%";
  }

  // ── 작업대 표시 계약 (2026-08-12 계약 11) ────────────────────────
  // 작업대 「가구」가 몇 대 서는가는 구매한 칸 수 하나만 본다. 올라간 작품 수도,
  // 지금 인쇄 중인지도, 유리창 알바 중인지도 「그 대 위에 무엇이 놓였는가」만 정할 뿐
  // 작업대 자체를 없애지 못한다. 그래서 60원을 낸 직후 빈 상태에서도 같은 규격 작업대
  // 두 대가 가로 한 줄로 서 있고, 도화지를 한 장만 올려도 나머지 한 대는 빈 작업대로 남는다.
  //
  // 돌려주는 배열의 길이 = 지금 서 있어야 할 작업대 대수.
  //   { index, filled(무엇인가 올라가 있다), empty(빈 작업대다) }
  function benchUnits(state) {
    const s = state || {};
    const slots = Math.max(1, (s.workbench && s.workbench.slots) || 1);
    const works = (s.works && s.works.length) || 0;
    const windowJob = s.mode === "window"; // 유리창 알바는 언제나 첫 대 하나만 쓴다
    const out = [];
    for (let i = 0; i < slots; i += 1) {
      const filled = windowJob ? i === 0 : i < works;
      out.push({ index: i, filled: filled, empty: !filled });
    }
    return out;
  }

  // ── 작업대 1~4개 배치 규칙 (2026-08-15 C 확정) ────────────────────
  // 확정된 것은 「어느 자리에 놓이는가」뿐이다.
  //   1개 — 가운데 한 칸
  //   2개 — 한 줄(2열 1행) 중앙
  //   3개 — 2×2 틀에서 오른쪽 아래를 비우고 전체 틀을 중앙 정렬
  //   4개 — 2×2 중앙
  // 예약 틀은 어떤 상태에서도 최대 2×2다. 그래야 왼쪽 잉크 카트리지의 기준이 흔들리지 않는다.
  // 정확한 픽셀 좌표와 작품 사이 간격은 아직 「미정」이라 여기서 숫자로 만들지 않는다 —
  // 자리(col·row)만 정하고, 실제 크기는 CSS 공통 변수 하나가 정한다.
  const BENCH_FRAME_COLS = 2;
  const BENCH_FRAME_ROWS = 2;
  // 작업대 대수 → 왼쪽 카드 표기. 2026-08-20 형 확정(문제 B):
  // 옛 코드는 「1대보다 많으면 무조건 두 대」라고 써서 3·4대에서 화면이 거짓말을 했다.
  // 표기 단위는 「칸」이 아니라 「대」로 통일한다 (진짜 독립 작업대 — 2026-08-18 확정).
  function benchSlotsLabel(slots) {
    const n = Math.max(1, Math.min(4, slots));
    return "· " + ["한", "두", "세", "네"][n - 1] + " 대";
  }

  function benchLayout(count) {
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > BENCH_FRAME_COLS * BENCH_FRAME_ROWS) {
      throw new Error("작업대 배치는 1~4개만 있다 (요청: " + count + ")");
    }
    const cols = n === 1 ? 1 : 2;
    const rows = n <= 2 ? 1 : 2;
    const cells = [];
    for (let i = 0; i < n; i += 1) {
      cells.push({ index: i, col: i % cols, row: Math.floor(i / cols) });
    }
    const reserved = [];
    for (let row = 0; row < BENCH_FRAME_ROWS; row += 1) {
      for (let col = 0; col < BENCH_FRAME_COLS; col += 1) {
        const taken = cells.some(function (c) { return c.col === col && c.row === row; });
        if (!taken) reserved.push({ col: col, row: row });
      }
    }
    return {
      count: n,
      cols: cols,
      rows: rows,
      frameCols: BENCH_FRAME_COLS,
      frameRows: BENCH_FRAME_ROWS,
      cells: cells,
      reserved: reserved,
    };
  }

  // ── 밀대 표시 계약 (2026-08-12 계약 12) ──────────────────────────
  // 화면에서 움직이는 수동 밀대는 언제나 최대 하나다. 두 작업대 위를 가로질러 함께
  // 지나는 공통 목재 밀대 그 하나뿐이고, 작품 캔버스 안에 개별 밀대를 따로 그리지
  // 않는다(perCanvas는 언제나 0). 그래서 두 작품을 함께 밀어도 막대가 세 개로 보이지 않는다.
  //
  // print는 엔진 내부 인쇄 상태({ phase, pos, inkOut })다. progress는 실제 인쇄
  // 진행률(0~1)이라 공통 밀대가 이 값에 맞춰 두 작업대 위를 함께 내려온다.
  // 2026-08-19로 대체된 밀대 문법 (0817 피드백 8-1 · v6 시안 D 복원).
  //   옛 계약(2026-08-12 계약 12): 위쪽에 공통 목재 막대 하나만 두고 캔버스 안에는
  //   밀대를 그리지 않는다. 그래서 도화지가 몇 장이든 움직이는 밀대는 언제나 하나였다.
  //   새 계약: 밀대를 도화지 그림 안에 그리고 도화지마다 하나씩 갖는다. 공통 막대는 없다.
  //   움직이는 밀대 수 = 지금 실제로 밀리고 있는 작품 수다.
  //     · 순차 제작 — 대상 한 장만 움직이므로 1
  //     · 동시 제작 — 진행 중인 작품 전부가 함께 움직인다
  // activeCount로 「지금 밀리고 있는 작품이 몇 장인가」를 받는다. 안 주면 1로 본다.
  // 2026-08-25 검수 지적 3으로 갱신: 「바닥남(inkOut)」이 아니라 「단계(phase)」를 본다.
  //   옛 규칙: inkOut이 켜지면 곧바로 밀대를 감췄다. ① 즉시 멈춤 시절에는 그 두 가지가
  //   같은 뜻이었지만, ② 모자람으로 바뀐 뒤에는 「모자란 채 아직 내려가는 중」이 생겼다.
  //   그래서 밀대가 도화지 한가운데서 눈앞에서 사라져 흐름이 끊긴 것처럼 보였다.
  //   새 규칙: 마감 단계(phase "inkout")에 들어가야 밀대가 사라진다. 모자란 채
  //   내려가는 동안(phase "ready"/"auto")에는 그대로 보인다.
  function squeegeeView(print, rows, activeCount) {
    const P = print || null;
    const total = rows || ECON_TEST_VALUES.paperSizes[0].rows;
    const moving = !!(P
      && (P.phase === "ready" || P.phase === "auto" || P.phase === "freeze"));
    const pos = moving ? Math.max(0, Math.min(total, P.pos || 0)) : 0;
    const sheets = Math.max(1, Math.round(Number(activeCount) || 1));
    return {
      common: false, // 위쪽 공통 목재 막대는 폐기됐다
      perCanvas: moving ? sheets : 0, // 그림면 안에 그리는 밀대 수 (도화지마다 하나)
      progress: moving ? pos / total : 0,
      moving: moving ? sheets : 0, // 화면에서 움직이는 수동 밀대 수
    };
  }

  // ── 상태가 바뀌어도 좌표가 변하면 안 되는 고정 앵커 목록 ──────────
  // 새 UI(경험치 바·잉크 표시·마감 알림)도 처음부터 자리를 차지해 두고
  // 보이기만 켜고 끄기 때문에, 어떤 상태에서도 좌표가 흔들리지 않는다.
  // ink-panel은 라운드 003에서 오른쪽 세로줄 → 작업대 바로 위로 옮겼다(자리는 여전히 고정).
  // 라운드 004에서 늘어난 자리(결과판·갤러리 칸)도 처음부터 좌표를 예약해 두고
  // 보이기만 켜고 끄기 때문에, 확장 전후로 옆 패널이 밀리지 않는다.
  // 2026-08-15 B 확정: 문 옆 잉크 카트리지도 2×2 예약 틀 왼쪽의 고정 앵커다 —
  // 작업대 수가 1~4로 바뀌어도 좌표·크기가 흔들리지 않는다.
  const ANCHOR_KEYS = Object.freeze([
    "left-rail", "center-workspace", "workbench", "ink-cartridge", "right-rail", "phone",
    "original-selector", "xp-panel", "ink-panel", "finish-choice", "result-board",
    "gallery-panel",
  ]);

  // ── 전화 대본 — 친근한 안내자, 지금 필요한 내용만 짧게 ────────────
  // 2026-08-10 라운드 003: 첫 미완성 판매 전에는 상점을 여는 전화가 없다.
  // 순서는 도화지(100원) → 잉크통(첫 미완성 판매 뒤) 둘뿐이다.
  const PHONE_SCRIPTS = Object.freeze({
    // 첫 전화: 도화지값(v5 = 뮤나리자 재료비 5$) 도달 순간. 도화지를 먼저 사게 한다(원작 선택은 그 다음).
    paper: Object.freeze({
      key: "paper",
      // 2026-10-20 v9 — 한 장 제작: 왼쪽 원작 카드를 누르면 참가비를 내고 바로 그린다(도화지 → 원작 고르기 두 단계를 하나로).
      pages: Object.freeze([
        "여보세요! 돈이 제법 모였네요. 이제 그림을 찍어 볼 때예요.",
        "왼쪽 「원작 카탈로그」에 뮤나리자 카드를 걸어 뒀어요. 한 장 참가비는 " + ECON_TEST_VALUES.paperCost + "$예요.",
        "카드를 누르면 참가비를 내고 작업대에서 바로 그리기 시작해요. 휠을 아래로 굴려 한 색씩 찍어 보세요!",
      ]),
    }),
    // 두 번째 전화: 첫 작품이 잉크가 모자라 미완성으로 팔린 직후.
    // 여기서는 잉크통 하나만 이야기한다. 다른 도구·다른 인쇄 이야기는 아직 꺼내지 않는다.
    ink: Object.freeze({
      key: "ink",
      // 2026-10-20 v9 · 펠로우십 스레드 6-A: 첫 잉크통을 사면 다음 한 장 참가비를 한 번 대신 내 준다 —
      // 「잉크통 사고 → 돈이 모자라 유리창으로 처음부터」 같은 세금 느낌을 없애려고.
      pages: Object.freeze([
        "여보세요! 그림 봤어요. 잉크가 중간에 떨어져서 미완성으로 넘어갔죠?",
        "지금 잉크통은 한 장을 끝까지 찍기에 모자라요. 두 번 밀면 바닥납니다.",
        "상점에 잉크통을 올려 뒀어요. " + UPGRADES[0].costs[0] + "$면 한 장을 끝까지 찍을 만큼 커집니다.",
        "잉크통을 사면 다음 한 장 참가비는 제가 낼게요. 원작 카드를 누르면 가득 찬 잉크로 바로 다시 그려요.",
      ]),
    }),
    // ── 첫 유리창 파손 안내 (2026-08-27 · 유리 A 승인) ───────────────────
    // 유리가 처음 깨진 그 자리에서 딱 한 번 울린다. 안내 전용이고 고를 것이 없다.
    // 문구는 승인 기록의 first_break_call을 규칙 함수 하나(glassBreakCallLine)에서
    // 꺼내 쓴다 — 화면과 대본이 서로 다른 문장을 갖지 않게 한다.
    glassBreak: Object.freeze({
      key: "glassBreak",
      pages: Object.freeze([
        glassBreakCallLine(),
        "이번 한 장은 보수 없이 배상까지 나갔어요. 다음 유리창부터 다시 시작하면 "
          + "깨진 자리는 새 유리로 갈아 둘게요.",
      ]),
    }),
    // ── 스크래치식 대출 안내 (2026-08-26 v1 → 2026-08-27 A안 승인으로 갱신) ──
    // 돈이 없어 막히는 「한 번의 위기」에서만 울린다. 앞의 두 통과 달리 친절한
    // 안내자가 아니라 장사꾼이다.
    // 순서는 계약이 못박았다 — 권유 → 더 큰 금액 강조 → 조건을 읽지 말라는 압박 → 안내.
    //
    // 2026-08-27 대출 A · 스크래치 충실형 승인: 이 통화는 「안내만 한다」. 거절 선택지가
    // 없고, 마지막 장은 고르라고 묻지 않고 「계약서를 내려보냈으니 눌러 서명하라」고
    // 알려 준다. choice가 true인 것은 여전히 마지막 장에서 통화가 저절로 끊기지 않고
    // 플레이어의 확인을 기다린다는 뜻이며, 그 확인 버튼은 이제 하나뿐이다.
    // 이자율과 총상환액은 여기서 한 글자도 말하지 않는다. 서명 직후에 반전으로 나온다.
    loan: Object.freeze({
      key: "loan",
      choice: true, // 마지막 장은 「다음」이 아니라 확인 한 번을 기다린다
      pages: Object.freeze([
        "여보세요, 사장님? 요즘 자금 사정이 좀 어렵다면서요. 마침 딱 맞는 상품이 있어요.",
        LOAN_RULES.principal + "$! 지금 바로, 오늘 안에 통장에 꽂아 드립니다. 더 크게 쓰셔도 되고요. "
          + "이 정도 금액은 저희 쪽에서는 아주 작은 편이에요.",
        "조건이요? 아이 참, 그런 건 읽을 필요 없어요. 다들 그냥 서명하세요. "
          + "읽는 동안에도 사장님만 손해잖아요.",
        "계약서는 이미 한 장 내려보냈습니다. 화면 위에서 내려온 종이를 눌러 서명하세요.",
      ]),
    }),
    // ── 서명 뒤 재전화 (2026-08-27 A안 승인) ─────────────────────────
    // 승인 흐름: … → 서명 → 대출금 수령 → 재전화 → 우상단 계약 정보 안내 → 확인.
    // 안내 전용이라 고를 것이 없고, 우상단의 그 자리를 정확히 가리킨다.
    // 이자 100%와 총상환 200원이라는 「반전」도 여기서 밝혀진다 — 두 숫자는 계약이
    // 못박은 값이라 대본에 그대로 적는다. 이번 계약이 고른 불이익 하나는 굴림마다
    // 달라지므로 여기서 이름을 부르지 않고, 우상단 계약 카드와 상세가 말한다.
    loanSigned: Object.freeze({
      key: "loanSigned",
      pages: Object.freeze([
        // 2026-10-20 v9 · 10-A: 대출 돈 단위도 「$」(다른 화면과 같게)
        "서명 감사합니다. " + LOAN_RULES.principal + "$는 방금 지급됐습니다. "
          + "아, 조건은 이자 100%라 갚을 돈은 " + LOAN_RULES.totalDue + "$ 한 번에 입니다.",
        LOAN_PENALTY_ON
          ? "그리고 다 갚기 전까지는 계약서에 적힌 불이익 하나가 따라붙어요. "
            + "계약서는 화면 오른쪽 위 작은 자리에 접어 두었습니다 — "
            + "그 자리를 누르면 상환금액과 걸린 불이익을 언제든 다시 볼 수 있습니다."
          // v8(21-A): 이자만 — 불이익 안내를 빼고 계약서 자리만 가리킨다
          : "계약서는 화면 오른쪽 위 작은 자리에 접어 두었습니다 — "
            + "그 자리를 누르면 갚을 돈을 언제든 다시 볼 수 있습니다.",
      ]),
    }),
  });

  // 서명 직후의 반전 — 숨겨 뒀던 조건을 이제야 크게 밝힌다.
  // 숫자는 LOAN_RULES 하나에서만 나온다 (화면이 따로 갖지 않는다).
  // 2026-08-26 동현 승인: 세 번째 줄은 「이 계약이 고른 불이익」을 그대로 말한다.
  // 옛 「버는 돈은 절반만 들어옵니다」는 50% 삭감과 함께 폐기됐다.
  function loanRevealLines(penalty) {
    const lines = [
      "이자율 " + Math.round(LOAN_RULES.interestRate * 100) + "%",
      "갚을 총액 " + LOAN_RULES.totalDue + "$", // v9 · 10-A
    ];
    const p = LOAN_PENALTY_ON ? validLoanPenalty(penalty) : null; // v8: 이자만
    if (p) lines.push("다 갚기 전까지 " + p.label + " — " + p.line);
    return lines;
  }

  // ── 잉크 표기 — 플레이어에게는 칸·리터가 아니라 완성 기준 % 로만 말한다 ──
  // have(가진 칸) / need(완성에 드는 칸) → 0 이상의 정수 퍼센트.
  function inkPercent(have, need) {
    if (!need || need <= 0) return 0;
    return Math.max(0, Math.round((have / need) * 100));
  }
  function inkCurrentText(percent) { return "현재 잉크 " + percent + "%"; }
  function inkNeedText() { return "완성 필요 100%"; }

  // ── 밑그림 단색 윤곽 (2026-08-25 검수 지적 1) ───────────────────────
  // 옛 구현은 「이웃과 색이 다른 칸」을 골라 그 칸을 통째로 칠했다. 16×16에서는
  // 거의 모든 칸이 경계라 윤곽선이 아니라 흰 면 덩어리가 됐다
  // (증거: qa/meeting-underdrawing-outline-1440x1000.png).
  //
  // 새 규칙은 「칸」이 아니라 두 칸이 맞닿은 「선」을 1픽셀로만 그린다.
  //   · 색이 같은 칸끼리는 사이에 선이 없다 → 덩어리 안쪽은 통째로 비어 있다
  //   · 한 선은 왼쪽 칸 기준으로 한 번만 그린다 → 두 겹으로 굵어지지 않는다
  //   · 도화지 바깥 테두리는 그리지 않는다 → 그림이 네모 상자에 갇혀 보이지 않는다
  // 돌려주는 값은 화면이 그대로 fillRect 할 픽셀 사각형이라, 검사도 화면과
  // 똑같은 픽셀을 재게 된다.
  function underdrawOutlinePixels(artRows, columns, sub) {
    const rows = artRows || [];
    const cols = Math.max(1, Math.round(Number(columns) || rows.length || 16));
    const s = Math.max(1, Math.round(Number(sub) || 3));
    const out = [];
    for (let y = 0; y < cols; y += 1) {
      const row = rows[y];
      if (!row) continue;
      for (let x = 0; x < cols; x += 1) {
        const ch = row[x];
        if (x > 0 && row[x - 1] !== ch) {
          out.push({ x: x * s, y: y * s, w: 1, h: s }); // 왼쪽 칸과의 세로 경계선
        }
        if (y > 0 && rows[y - 1] && rows[y - 1][x] !== ch) {
          out.push({ x: x * s, y: y * s, w: s, h: 1 }); // 윗 칸과의 가로 경계선
        }
      }
    }
    return out;
  }

  // ── 잉크 부족 마찰 긁힘 (2026-08-25 회의 전 추천안 계약 1 · 검수 지적 2) ──
  // ※ 2026-10-16 v7: 형님 46-B로 화면은 이 긁힘을 더 쓰지 않는다(아래 INK_SQUEEZE — 8/24 치약 쥐어짜기).
  //   이 함수와 아래 설명은 v6까지의 기록 · 옛 검사용으로만 남겨 둔다.
  // 「② 모자람」 개념만 참고판(ink-shortage-mock / inkfx-sequence-compare)에서 가져오고,
  // 그 판의 「칸마다 x·y를 함께 해싱해 무작위로 지우는」 방식은 쓰지 않는다 —
  // 그렇게 하면 무작위 네모 오염·파일 손상처럼 읽힌다는 것이 동현 지적이다.
  //
  // 옛 구현은 그 대신 「색판 그림이 있는 칸에만 옅게 남기기」를 썼는데, 원작 픽셀이
  // 없는 자리는 아예 비어서 모자란 구간이 큰 사각 공백으로 보였다
  // (증거: qa/meeting-ink-shortage-friction-1440x1000.png).
  //
  // 새 규칙은 원작 마스크와 아무 상관이 없는 「별도 마찰 마스크」다.
  // 마른 날이 도화지를 긁고 지나간 가는 세로줄 자리를 도화지 폭 전체에 걸쳐 정한다.
  //   · 폭은 언제나 1픽셀 — 굵은 면이 되지 않는다
  //   · 줄 사이는 최소 3픽셀 — 이웃 줄과 붙어 네모로 뭉치지 않는다
  //   · y를 보지 않는다 — 마른 줄이 이어지는 동안 같은 x가 계속 찍혀 자국이 세로로 이어진다
  //   · 색판 번호가 자리를 흔든다 — 공정마다 긁힌 자리가 다르다
  const FRICTION_MIN_GAP = 3; // 긁힘 사이 최소 간격(픽셀)
  const FRICTION_MIN_ALPHA = 0.16;
  // 가장 진한 자국도 본래 색의 26%를 넘지 않는다
  const FRICTION_ALPHA_SPREAD = 0.10;
  const scratchCache = {};
  function inkFrictionScratchPixels(plateIndex, width) {
    const w = Math.max(4, Math.round(Number(width) || 48));
    const plate = Math.max(0, Math.round(Number(plateIndex) || 0));
    const key = plate + "@" + w;
    if (scratchCache[key]) return scratchCache[key];
    const marks = [];
    let x = 1 + (plate % FRICTION_MIN_GAP); // 색판마다 첫 긁힘 자리가 다르다
    let i = 0;
    while (x < w - 1) {
      // 결정적 혼합 — 프레임마다 자국이 흔들리지 않게 난수를 쓰지 않는다.
      const mixed = (Math.imul(i + 1, 2246822519) ^ Math.imul(plate + 1, 3266489917)) >>> 0;
      marks.push({
        x: x,
        w: 1,
        alpha: FRICTION_MIN_ALPHA + (mixed % 11) / 10 * FRICTION_ALPHA_SPREAD,
      });
      x += FRICTION_MIN_GAP + (mixed % 4); // 간격 3~6픽셀
      i += 1;
    }
    scratchCache[key] = marks;
    return marks;
  }

  // ── 잉크 부족 「치약 쥐어짜기」 (2026-10-16 v7 · 형님 46-B) ──────────
  // 8/24 비교 시안 inkfx-sequence-compare의 「② 모자람 — 치약 쥐어짜기」를 숫자·식 그대로 쓴다.
  // 2026-08-25에 「무작위로 칸이 빠지면 파일 손상처럼 보인다」며 세로 긁힘(inkFrictionScratchPixels)으로
  // 바꿨던 것을, 형님이 10/16 A(세로 긁힘+옅어짐) · B(8/24 그대로) · C(B+옅어짐)를 나란히 보고 B로 되돌렸다
  // (비교판 ink-squeeze-compare-2026-10-16-v1). 세로 긁힘 규칙 함수는 기록·검사용으로 남겨 두되 화면은 쓰지 않는다.
  //   · 남은 잉크가 한 장 필요량의 10% 아래로 내려가면 그 줄부터 칸이 군데군데 빠진다 (남는 비율 100% → 30%)
  //   · 잉크가 아예 없는 채로 밀대만 지나간 줄은 원작 자리에 12%만 마른 점으로 남는다
  //   · 어느 칸이 빠지는지는 칸 자리(x·y)와 색판 번호로 정해진다 — 프레임마다 흔들리지 않는다
  // 비유: 치약을 끝까지 짜면 처음엔 굵게 나오다가 끝에선 듬성듬성 끊겨 나오는 것.
  const INK_SQUEEZE = Object.freeze({
    fadeFrom: 0.10, // 한 장 필요량의 10% 아래부터
    fadeMin: 0.30, // 바닥 직전 가장 듬성할 때 남는 비율
    dryDensity: 0.12, // 바닥난 뒤 마른 점으로 남는 비율
  });
  // 줄 하나를 찍은 직후 남은 잉크(칸)와 한 장 필요량(칸)으로 그 줄의 「남는 칸 비율」을 정한다.
  function inkSqueezeDensity(cellsLeft, need) {
    const n = Number(need);
    if (!(n > 0)) return 1;
    const ratio = Math.max(0, Number(cellsLeft) || 0) / n;
    if (ratio > INK_SQUEEZE.fadeFrom) return 1;
    return INK_SQUEEZE.fadeMin + (1 - INK_SQUEEZE.fadeMin) * (ratio / INK_SQUEEZE.fadeFrom);
  }
  // 그 칸이 남는가 — 8/24 판의 결정적 의사난수 식 그대로 (73856093 · 19349663 · 83492791).
  function inkSqueezeKeepCell(cx, cy, plateIndex, density) {
    if (!(density < 1)) return true;
    const h = ((cx * 73856093) ^ (cy * 19349663) ^ ((plateIndex + 1) * 83492791)) >>> 0;
    return (h % 1000) / 1000 < density;
  }

  const exported = {
    ECON_TEST_VALUES: ECON_TEST_VALUES,
    EXPANSION_TEST_VALUES: EXPANSION_TEST_VALUES,
    // 2026-08-15 A 확정 유리창 규칙 — 엔진과 테스트가 같은 권위를 쓴다
    WINDOW_RULES: WINDOW_RULES,
    windowLevelFor: windowLevelFor,
    windowResultFor: windowResultFor,
    // 2026-08-26 v1 — 유리창 노동비. 옛 DEBT_RULES(자동 신용)와 그 두 순수 함수
    // (payWithCredit·receiveIncome)는 계약 1항으로 폐기됐고 되살리지 않는다.
    WINDOW_COSTS: WINDOW_COSTS,
    // 2026-08-26 v1 — 유리창 밀대 기본 속도 배율 (부모 기본값의 50%)
    WINDOW_BASE_SPEED_SCALE: WINDOW_BASE_SPEED_SCALE,
    // 2026-08-26 v1 — 스크래치식 대출 계약. 이 판에 남은 유일한 빚이다.
    LOAN_RULES: LOAN_RULES,
    emptyLoan: emptyLoan,
    signLoan: signLoan,
    // 2026-08-26 3차 독립 검토 대응 — 원금 지급이 성립하는 유일한 상태 조합.
    // 화면(canSign)과 규칙(signLoan)이 같은 판정 하나를 나눠 쓴다.
    loanContractPending: loanContractPending,
    // 2026-08-26 4차 독립 검토 대응 — 「아직 대출 기회가 남았는가」의 유일한 엄격 판정.
    // 위기 전화 개방·수락·loanReliefLeft·계약서 대기가 모두 이 함수 하나를 지난다.
    loanOpportunityLeft: loanOpportunityLeft,
    // 같은 검토 대응 — 정식 타입이 아닌 필드가 있는가 (falsy 값도 손댄 증거다).
    loanTypeTaint: loanTypeTaint,
    loanUseTrace: loanUseTrace,
    loanDebtTrace: loanDebtTrace,
    // 2026-08-26 5차 독립 검토 대응 — 「핵심 필드는 객체 자신의 필드여야 한다」.
    // 규칙·엔진·화면이 모두 이 사진 한 장을 나눠 쓴다. 상속된 값은 사실로 읽지
    // 않고, 상속돼 있다는 사실 자체를 손댄 증거로 센다.
    LOAN_CORE_KEYS: LOAN_CORE_KEYS,
    LOAN_SAVE_CORE_KEYS: LOAN_SAVE_CORE_KEYS,
    // 2026-08-26 6차 독립 검토 대응 — 최신 저장 식별자. 「지금 스키마 저장인데 핵심
    // 필드가 빠졌다」를 규칙 쪽에서 판정하려면 규칙도 이 값을 알아야 한다.
    LOAN_SAVE_SCHEMA: LOAN_SAVE_SCHEMA_ID,
    loanOwnFields: loanOwnFields,
    loanOwnField: loanOwnField,
    loanInheritedKeys: loanInheritedKeys,
    // 2026-08-26 독립 검토 대응 — 비분할 계약이 인정하는 잔액은 200원과 0원뿐이다.
    // 순수 규칙·화면·불러오기가 모두 이 두 함수를 지나 임의 잔액을 막는다.
    loanOwed: loanOwed,
    loanFromSave: loanFromSave,
    repayLoanFull: repayLoanFull,
    // 2026-08-26 동현 확정 — 전액 상환도 같은 선투자 20원 근거로 막다른 길을 지운다.
    repayCashNeeded: repayCashNeeded,
    // 2026-08-26 동현 승인 — 대출 불이익 3종 택1 · 10%. 옛 50% 일괄 수입 삭감
    // (LOAN_RULES.incomeShare · loanIncomeSplit)은 이 승인으로 폐기됐고 되살리지 않는다.
    LOAN_PENALTIES: LOAN_PENALTIES,
    LOAN_PENALTY_MAGNITUDE: LOAN_PENALTY_MAGNITUDE,
    validLoanPenalty: validLoanPenalty,
    pickLoanPenalty: pickLoanPenalty,
    activeLoanPenalty: activeLoanPenalty,
    loanPenaltyFromSave: loanPenaltyFromSave,
    loanRepaidCount: loanRepaidCount,
    // 세 채널이 실제로 값을 깎고 올리는 자리 — 화면과 엔진이 각자 곱하지 않는다.
    salePriceWithPenalty: salePriceWithPenalty,
    shopCostWithPenalty: shopCostWithPenalty,
    toolSpeedScaleFor: toolSpeedScaleFor,
    loanSaleSplit: loanSaleSplit,
    loanPenaltyLine: loanPenaltyLine,
    loanPenaltyShort: loanPenaltyShort,
    loanRevealLines: loanRevealLines,
    // 2026-08-26 동현 확정 — 현금을 쓰는 모든 제품 구매가 지나는 공통 교착 방지 계약.
    DEADLOCK_GUARD: DEADLOCK_GUARD,
    purchaseDeadlocks: purchaseDeadlocks,
    deadlockGuardShort: deadlockGuardShort,
    deadlockGuardLine: deadlockGuardLine,
    repayGuardLine: repayGuardLine,
    // 2026-08-25 회의 전 추천안 — 잉크 부족 마찰 긁힘 (세로로 이어지는 마른 자국)
    // 과 밑그림 단색 윤곽. 둘 다 화면이 그대로 fillRect 할 픽셀 자리를 낸다.
    inkFrictionScratchPixels: inkFrictionScratchPixels,
    // 2026-10-16 v7 — 화면이 실제로 쓰는 잉크 부족 연출
    INK_SQUEEZE: INK_SQUEEZE,
    inkSqueezeDensity: inkSqueezeDensity,
    inkSqueezeKeepCell: inkSqueezeKeepCell,
    LOAN_PENALTY_ON: LOAN_PENALTY_ON, // v8 — 대출 불이익 효과를 거는가(지금 false)
    underdrawOutlinePixels: underdrawOutlinePixels,
    // 2026-08-19 라운드 006 — 레벨 게이지와 공개 확률표
    windowGaugeFor: windowGaugeFor,
    windowPublicTable: windowPublicTable,
    // 2026-08-15 C 확정 배치 규칙
    benchLayout: benchLayout,
    UPGRADES: UPGRADES,
    UPGRADE_KEYS: UPGRADE_KEYS,
    upgradeByKey: upgradeByKey,
    // 2026-10-20 v9 — 오른쪽 세 칸(모작 운 · 스퀴지 종류 · 스퀴지 속도) · 스퀴지 재질 · 한 번에 한 색
    RAIL_UPGRADES: RAIL_UPGRADES,
    RAIL_UPGRADE_KEYS: RAIL_UPGRADE_KEYS,
    ALL_UPGRADES: ALL_UPGRADES,
    SQUEEGEE_MATERIALS: SQUEEGEE_MATERIALS,
    SQUEEGEE_MAX_SPEED: SQUEEGEE_MAX_SPEED,
    squeegeeForce: squeegeeForce,
    squeegeeSpeedCost: squeegeeSpeedCost,
    manualStrokesFor: manualStrokesFor,
    requiredCellsFor: requiredCellsFor,
    originalResist: originalResist,
    paperSizeByKey: paperSizeByKey,
    paperCells: paperCells,
    baseGates: baseGates,
    gateProbs: gateProbs,
    finalProbs: finalProbs,
    rollGradeIndex: rollGradeIndex,
    // 2026-10-06 두 방 데모 A — 세 회차 독립 추첨
    ROUNDS_PER_ARTWORK: ROUNDS_PER_ARTWORK,
    roundProbs: roundProbs,
    roundGates: roundGates,
    drawRoundGrade: drawRoundGrade,
    finalFromRounds: finalFromRounds,
    levelNeed: levelNeed,
    levelFromXp: levelFromXp,
    priceFor: priceFor,
    // 2026-10-08 두 방 데모 3단계 — 구간 목표 금액
    SEGMENT_TEST_VALUES: SEGMENT_TEST_VALUES,
    segmentAdvance: segmentAdvance,
    segmentView: segmentView,
    segmentRewardLabel: segmentRewardLabel,
    // 2026-10-08 두 방 데모 4단계 — 원작 고리
    ORIGINAL_TEST_VALUES: ORIGINAL_TEST_VALUES,
    originalRule: originalRule,
    startingOriginalLevels: startingOriginalLevels,
    originalInkMult: originalInkMult,
    originalPriceFor: originalPriceFor,
    originalLotPrice: originalLotPrice,
    // 2026-10-12 v5 — 원작 사다리 · 재료비 · 경매장 문 2칸 · 확률 단계
    materialCostFor: materialCostFor,
    incompletePriceFor: incompletePriceFor,
    doorLots: doorLots,
    ROUND_TABLES: ROUND_TABLES,
    BASE_STAGE: BASE_STAGE,
    probabilityStage: probabilityStage,
    shopCardText: shopCardText,
    // 2026-08-27 v4 — 0825 UI 후속: 고정 길이 레벨 게이지 · 유리 파손 픽셀 연출
    SHOP_GAUGE_TRACK_PX: SHOP_GAUGE_TRACK_PX,
    shopCardGauge: shopCardGauge,
    GLASS_BREAK_FX: GLASS_BREAK_FX,
    glassBreakFx: glassBreakFx,
    // 2026-08-27 v1 — 0827 승인 선택안 통합
    //   대출 A · 유리 A(충격점 거미줄 유지·안내 문구·부드러운 자동 마감)
    //   상점 B + 작업 탭 공통 카드 표기
    WORK_CARD_FIELDS: WORK_CARD_FIELDS,
    workCardText: workCardText,
    moneyText: moneyText,
    GLASS_CRACK_PERSIST: GLASS_CRACK_PERSIST,
    glassBreakCallLine: glassBreakCallLine,
    autoFinishRow: autoFinishRow,
    // 2026-08-19 — 단계별 가격·문구·잉크통 용량
    upgradeCostFor: upgradeCostFor,
    upgradeEffectFor: upgradeEffectFor,
    upgradeNoteFor: upgradeNoteFor,
    inkCapacityForLevel: inkCapacityForLevel,
    formatPercent: formatPercent,
    benchUnits: benchUnits,
    benchSlotsLabel: benchSlotsLabel,
    squeegeeView: squeegeeView,
    inkPercent: inkPercent,
    inkCurrentText: inkCurrentText,
    inkNeedText: inkNeedText,
    ANCHOR_KEYS: ANCHOR_KEYS,
    PHONE_SCRIPTS: PHONE_SCRIPTS,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported; // Node 테스트용
  }
  root.MewnaState = exported; // 브라우저용 전역
})(typeof globalThis !== "undefined" ? globalThis : this);
