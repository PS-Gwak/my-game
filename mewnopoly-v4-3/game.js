'use strict';

/* ============================================================
   뮤노폴리 v4.3 — Probability Climb
   v4.2 베이스 + 재현이형 피드백 7가지 반영:
     #1 0번 칸 성장 카운트 포함
     #2 5층 일회용 상점 폐지, 도박티켓·특별상점 추가, 보호막 함정 제거
     #3 확률 강화 v3: 양수는 깎지 않고 음수에서만 비율 감산
     #4 뒤쪽 보물상자 추가
     #5 럭키 자동 점프대(4→6, 10→13)
     #6 7번 세이브 리셋 보너스
     #7 막판 12·13·14 카운트다운과 보상 급증
   ============================================================ */

// ============================================================
// 상수
// ============================================================
const TOTAL_TILES = 16;
const GOAL_TILE   = 15;
const MAX_COINS_ON_BOARD = 4;

// 주사위 6면 인덱스 0~5 → 값 -3,-2,-1,+1,+2,+3
const FACE_IDX_TO_VAL = [-3, -2, -1, 1, 2, 3];
const FACE_KEY        = ['n3', 'n2', 'n1', 'p1', 'p2', 'p3'];

// 음수 면 인덱스 (확률 부스트에서 깎이는 대상)
const NEG_INDICES = [0, 1, 2]; // n3, n2, n1
const POS_INDICES = [3, 4, 5]; // p1, p2, p3

const POSITION_PROB_TABLE = [
  { n3: 0.11,    n2: 0.22,   n1: 0.38,   p1: 0.20,    p2: 0.08,    p3: 0.01      },
  { n3: 0.1138,  n2: 0.23,   n1: 0.39,   p1: 0.185,   p2: 0.072,   p3: 0.0092    },
  { n3: 0.1176,  n2: 0.24,   n1: 0.40,   p1: 0.17,    p2: 0.064,   p3: 0.0084    },
  { n3: 0.1244,  n2: 0.245,  n1: 0.41,   p1: 0.155,   p2: 0.058,   p3: 0.0076    },
  { n3: 0.1312,  n2: 0.25,   n1: 0.42,   p1: 0.14,    p2: 0.052,   p3: 0.0068    },
  { n3: 0.1380,  n2: 0.255,  n1: 0.43,   p1: 0.125,   p2: 0.046,   p3: 0.0060    },
  { n3: 0.1448,  n2: 0.26,   n1: 0.44,   p1: 0.11,    p2: 0.04,    p3: 0.0052    },
  { n3: 0.1516,  n2: 0.265,  n1: 0.45,   p1: 0.095,   p2: 0.034,   p3: 0.0044    },
  { n3: 0.1584,  n2: 0.27,   n1: 0.46,   p1: 0.08,    p2: 0.028,   p3: 0.0036    },
  { n3: 0.1652,  n2: 0.275,  n1: 0.47,   p1: 0.065,   p2: 0.022,   p3: 0.0028    },
  { n3: 0.1720,  n2: 0.28,   n1: 0.48,   p1: 0.05,    p2: 0.016,   p3: 0.0020    },
  { n3: 0.1838,  n2: 0.285,  n1: 0.49,   p1: 0.035,   p2: 0.01,    p3: 0.0012    },
  { n3: 0.1849,  n2: 0.29,   n1: 0.50,   p1: 0.02,    p2: 0.005,   p3: 0.0001    },
  { n3: 0.1849,  n2: 0.29,   n1: 0.52,   p1: 0.005,   p2: 0.0001,  p3: 0.00001   },
  { n3: 0.1799,  n2: 0.28,   n1: 0.54,   p1: 0.0001,  p2: 0.00001, p3: 0.00000001},
];

const COIN_SPAWN_BY_ROLL = {
  '-3': 1.00, '-2': 0.70, '-1': 0.45,
  '1':  0.20, '2':  0.12, '3':  0.08,
};

// v4.2 #5 — 함정 base v3 롤백 (+2:0.18, +3:0.28). 최저 보장은 그대로.
const TRAP_BASE = { '2': 0.18, '3': 0.28 };
const TRAP_MIN  = { '2': 0.06, '3': 0.10 };

const DOUBLE_COIN_CHANCE = 0.10;

// v4.3 #7 — 막판 보상 급증. 키 = 칸 번호, 값 = 코인 보상. 처음 1회만.
const TILE_REWARDS = { 3: 1, 5: 2, 8: 5, 10: 10, 12: 20, 13: 35, 14: 60 };
// v4.2 #2 — 세이브 포인트 = 7번 한 곳 (도달 보상 없는 칸)
const SAVE_TILES = [7];

// v4 #3 — 칸별 30회 방문마다 1단계 (단계 × 0.1)만큼 음수→양수 이동.
const TILE_GROWTH_STEP_VISITS = 30;
const TILE_GROWTH_RATIO_PER_STEP = 0.1;

// v4.3 — 리롤은 특별상점에서만 구매
const REROLL_COST = 5;
const REROLL_MAX_HELD = 2;

// v4.3 — 행운 장치들
const SPECIAL_SPAWN_CHANCE = 0.02;        // 코인 스폰 직전 2%: 도박티켓 1% / 특별상점 1%
const SPECIAL_SHOP_COST = 5;
const TREASURE_SPAWN_CHANCE = 0.12;       // 낮은 확률. 데모 플레이 뒤 조정하기 쉬운 한 곳.
const TREASURE_TTL_TURNS = 3;
const TREASURE_COIN_MIN = 3;
const TREASURE_COIN_MAX = 5;
const BRIDGE_SPAWN_CHANCE = 0.08;         // 4·10번 칸에 가끔 뜨는 다리
const NEGATIVE_PROB_FLOOR = 0.005;        // 음수 면은 최소 0.5% 남김

const DEBUG_SPECIAL_DEFAULTS = {
  gambleTicket: SPECIAL_SPAWN_CHANCE / 2,
  specialShop: SPECIAL_SPAWN_CHANCE / 2,
  treasure: TREASURE_SPAWN_CHANCE,
  bridge: BRIDGE_SPAWN_CHANCE,
  restartBonus: 1,
};

/* ------------------------------------------------------------
   영구 업그레이드
   v4.3 #3 — +1/+2/+3 새 공식:
     gain = (basePositive + 0.02) × (rate × Lv) × 0.8
     양수 면에 +gain을 바로 더하지 않고, 음수 면에서 실제로 빼온 만큼만 더함.
     양수 면은 절대 깎지 않고, 음수 면은 최소 0.5% 남김.
   가격표 (Lv1→Lv7 구매 시):
     p1_prob: [5, 6, 8, 10, 15, 25, 40]
     p2_prob: [10, 12, 16, 20, 30, 50, 80]
     p3_prob: [30, 36, 48, 60, 90, 150, 240]
   언락 조건: 다음 단계는 이전 단계 Lv4 도달 시 해금
   maxLv = 7
   ------------------------------------------------------------ */
const PRICE_TABLE_P1 = [5, 6, 8, 10, 15, 25, 40];
const PRICE_TABLE_P2 = [10, 12, 16, 20, 30, 50, 80];
const PRICE_TABLE_P3 = [30, 36, 48, 60, 90, 150, 240];

function priceFromTable(table, lv) {
  // lv = 현재 레벨. lv 0 → table[0], lv 6 → table[6]. lv 7(max) 도달 후엔 호출 X.
  if (lv < 0) lv = 0;
  if (lv >= table.length) lv = table.length - 1;
  return table[lv];
}

const PERM_UPGRADES = [
  {
    id: 'p1_prob', name: '+1 확률 강화',
    desc: '+1 면을 올릴 만큼 -1·-2에서만 빼온다. 다른 양수 면은 깎지 않는다.',
    rate: 0.15,
    targetIdx: 3,
    cost: (lv) => priceFromTable(PRICE_TABLE_P1, lv),
    maxLv: 7,
    unlock: (s) => true,
    lockMsg: '',
  },
  {
    id: 'p2_prob', name: '+2 확률 강화',
    desc: '+2 면을 올릴 만큼 -1·-2·-3에서만 빼온다. 두 칸씩 가지만 함정 위험도 동반.',
    rate: 0.18,
    targetIdx: 4,
    cost: (lv) => priceFromTable(PRICE_TABLE_P2, lv),
    maxLv: 7,
    unlock: (s) => s.permLevels.p1_prob >= 4,
    lockMsg: '잠금: +1 확률 Lv4 필요',
  },
  {
    id: 'p3_prob', name: '+3 확률 강화',
    desc: '+3 면을 올릴 만큼 -1·-2·-3에서만 빼온다. 한방 3칸 점프 + 함정 위험 최대.',
    rate: 0.21,
    targetIdx: 5,
    cost: (lv) => priceFromTable(PRICE_TABLE_P3, lv),
    maxLv: 7,
    unlock: (s) => s.permLevels.p2_prob >= 4,
    lockMsg: '잠금: +2 확률 Lv4 필요',
  },
  {
    id: 'coin_extra', name: '추가 코인 획득 확률',
    desc: '코인을 수집할 때 (Lv × 10%) 확률로 +1 추가. Lv7에서 70%.',
    multFn: (lv) => lv * 0.10,
    cost: (lv) => Math.round(10 * Math.pow(1.2, lv)),
    maxLv: 7,
    unlock: (s) => true,
    lockMsg: '',
  },
  // v4.2 (재현이형 모호점 #2 답=d) — 함정 감소 업그레이드 자체 제거 (단순화)
];

const SPECIAL_SHOP_ITEMS = [
  { id: 'ignoreTrap', name: '보호막 1회', cost: SPECIAL_SHOP_COST,
    desc: '다음 함정 도착 1회 무효화하고, 밟은 함정은 보드에서 제거.' },
  { id: 'reroll',     name: '리롤 1회',       cost: REROLL_COST,
    desc: '직전 굴림을 무효화하고 다시 굴림. 한도 2개.' },
];

// ============================================================
// 상태
// ============================================================
const state = {
  position: 0,
  coins: 0,
  holes: new Set(),
  boardCoins: new Set(),
  doubleCoins: new Set(),
  boardGambleTickets: new Set(),
  boardSpecialShops: new Set(),
  treasureChests: new Map(),
  bridges: new Set(),
  permLevels: {
    p1_prob: 0, p2_prob: 0, p3_prob: 0,
    coin_extra: 0,
    // v4.2 — trap_reduce 제거
  },
  ignoreTrap: 0,
  rerollLeft: 0,
  lastRollIdx: null,
  canReroll: false,
  isAnimating: false,
  prevSnapshot: null,
  rolls: 0, wins: 0,

  // v4 신규 상태 (유지)
  bestTile: 0,                            // #1 — 세션 최고 도달 칸
  tileVisitCount: new Array(TOTAL_TILES).fill(0), // #3 — 칸별 방문 횟수
  tileRewardClaimed: new Set(),           // #4 — 도달 보상 처음 1회 체크
  savePoint: null,                        // #4-3 — 현재 세이브 칸 (null = 없음)
  gambling: false,                        // v4.3 #2 — 다음 굴림을 코인 도박으로 환산
  specialShopOpen: false,                 // v4.3 #2 — 특별상점 모달 상태
  restartCloudBridge: false,              // v4.3 #6 — 7세이브 리셋 보너스 4→6 다리
  runLog: [],                             // v4.3 — 컴퓨터 분석용 구조화 로그
  runId: 1,                               // v4.3 — 0번 복귀/클리어마다 다음 판 번호로 증가
  debugPanelOpen: false,                  // v4.3 — D키 개발자 패널 표시 여부
  diceProbabilityOverrides: {},           // 디버그 콘솔에서 칸별 주사위 확률을 덮어쓴 값
  debugSpecialChances: Object.assign({}, DEBUG_SPECIAL_DEFAULTS),
  debugTrapChanceOverride: null,          // null이면 기존 +2/+3 함정 확률을 그대로 사용

};

// ============================================================
// 사운드
// ============================================================
const SOUNDS = {};
function initSounds() {
  const map = {
    coinAdd:       'sounds/coin_add.ogg',
    coinRemove:    'sounds/coin_remove.ogg',
    move:          'sounds/move_1.ogg',
    reset:         'sounds/reset.ogg',
    rollClick1:    'sounds/roll_botton_click_1.ogg',
    rollClick2:    'sounds/roll_botton_click_2.ogg',
    rollHover:     'sounds/roll_botton_hover.ogg',
    upgradeClick:  'sounds/upgrade_click.ogg',
    upgradeHover:  'sounds/upgrade_hover.ogg',
  };
  for (const k in map) {
    try {
      const a = new Audio(map[k]);
      a.volume = 0.6;
      SOUNDS[k] = a;
    } catch (e) { /* 사운드 로드 실패해도 게임은 진행 */ }
  }
}
function play(name) {
  try {
    const s = SOUNDS[name];
    if (!s) return;
    const c = s.cloneNode(true);
    c.volume = s.volume;
    c.play().catch(() => {});
  } catch (e) {}
}
function playRollClick() {
  play(Math.random() < 0.5 ? 'rollClick1' : 'rollClick2');
}

// ============================================================
// 도우미들
// ============================================================
function $(id) { return document.getElementById(id); }

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fmtVal(val) { return val > 0 ? '+' + val : String(val); }

function logEvent(msg, kind) {
  const log = $('event-log');
  if (!log.dataset.placeholderCleared) {
    log.innerHTML = '';
    log.dataset.placeholderCleared = '1';
  }
  const p = el('p', kind ? 'ev-' + kind : '', msg);
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
  while (log.children.length > 40) log.removeChild(log.firstChild);
}

function recordEvent(type, data) {
  state.runLog.push(Object.assign({
    runId: state.runId,
    turn: state.rolls,
    type,
    position: state.position,
    coins: state.coins,
    bestTile: state.bestTile,
    savePoint: state.savePoint,
    timestamp: Date.now(),
  }, data || {}));
}

function recordDebugAction(action, data) {
  recordEvent('debug', Object.assign({ action }, data || {}));
}

function clampNumber(value, min, max) {
  let n = Number(value);
  if (!isFinite(n)) n = min;
  return Math.max(min, Math.min(max, n));
}

function clampInteger(value, min, max) {
  return Math.round(clampNumber(value, min, max));
}

function clampTile(value) {
  return clampInteger(value, 0, GOAL_TILE);
}

function chanceFromPercent(percent) {
  return clampNumber(percent, 0, 100) / 100;
}

function getDebugSpecialChance(id) {
  const defaults = DEBUG_SPECIAL_DEFAULTS;
  const raw = state.debugSpecialChances && state.debugSpecialChances[id];
  const fallback = defaults.hasOwnProperty(id) ? defaults[id] : 0;
  return clampNumber(raw == null ? fallback : raw, 0, 1);
}

function buildRunLogJson() {
  return JSON.stringify(state.runLog, null, 2);
}

function setLogActionStatus(msg) {
  const status = $('log-action-status');
  if (status) status.textContent = msg || '';
}

async function copyRunLogToClipboard() {
  const text = buildRunLogJson();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    setLogActionStatus('로그 복사 완료');
  } else {
    setLogActionStatus('클립보드 권한 없음 — 다운로드 사용');
  }
  return text;
}

function downloadRunLog() {
  const text = buildRunLogJson();
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = 'mewnopoly-run-' + state.runId + '-' + stamp + '.json';
  if (document.body && document.body.appendChild) document.body.appendChild(a);
  if (typeof a.click === 'function') a.click();
  if (a.parentNode && a.parentNode.removeChild) a.parentNode.removeChild(a);
  URL.revokeObjectURL(url);
  setLogActionStatus('로그 다운로드 준비 완료');
  return text;
}

function showToast(html, kind, ms) {
  // v4.1 피드백 — 화면 중앙을 가리는 팝업 알림은 전부 끔.
  // 각 상황은 호출부에서 이미 우측 이벤트 로그(logEvent)에 기록한다.
  const t = $('toast');
  if (!t) return;
  clearTimeout(showToast._timer);
  t.innerHTML = '';
  t.className = 'toast hidden';
}

function showBigMessage(html, kind, ms) {
  const t = $('toast');
  if (!t) return;
  clearTimeout(showToast._timer);
  t.innerHTML = html;
  t.className = 'toast' + (kind ? ' toast-' + kind : '');
  showToast._timer = setTimeout(() => {
    t.className = 'toast hidden';
    t.innerHTML = '';
  }, ms || 1200);
}

// ============================================================
// 확률 처리
// ============================================================

function dicePercentInputToArray(rawPercents) {
  if (Array.isArray(rawPercents)) return rawPercents.slice(0, FACE_KEY.length);
  const out = [];
  for (const key of FACE_KEY) out.push(rawPercents && rawPercents[key]);
  return out;
}

function normalizeProbs(rawArr) {
  const out = rawArr.slice();
  for (let i = 0; i < out.length; i++) {
    if (!isFinite(out[i]) || out[i] < 0) out[i] = 0;
  }
  const sum = out.reduce((a, b) => a + b, 0);
  if (sum <= 0) return [0, 0, 1, 0, 0, 0];
  for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
}

function getDiceProbabilityOverride(position) {
  const tile = clampTile(position);
  const probs = state.diceProbabilityOverrides && state.diceProbabilityOverrides[tile];
  return probs ? normalizeProbs(probs) : null;
}

function setDiceProbabilityOverride(position, rawPercents) {
  const tile = clampTile(position);
  const input = dicePercentInputToArray(rawPercents).map(v => Number(v));
  const probs = normalizeProbs(input);
  state.diceProbabilityOverrides[tile] = probs;
  recordDebugAction('dice_probability_override', {
    tile,
    probabilities: probs.map(p => Number(p.toFixed(6))),
  });
  renderAll();
  return probs;
}

function negativeCutOrder(targetIdx) {
  // 인덱스: n3=0, n2=1, n1=2. 재현이형 비율은 -1부터 적었다.
  if (targetIdx === 3) {
    return [
      { idx: 2, weight: 0.80 },
      { idx: 1, weight: 0.20 },
      { idx: 0, weight: 0.00 },
    ];
  }
  return [
    { idx: 2, weight: 0.50 },
    { idx: 1, weight: 0.30 },
    { idx: 0, weight: 0.20 },
  ];
}

function takeFromNegativesWithFloor(probs, want, order) {
  let taken = 0;
  let carry = 0;

  for (const item of order) {
    const desired = want * item.weight + carry;
    if (desired <= 0) continue;

    const canTake = Math.max(0, probs[item.idx] - NEGATIVE_PROB_FLOOR);
    const cut = Math.min(canTake, desired);
    probs[item.idx] -= cut;
    taken += cut;
    carry = desired - cut;
  }

  // 비율표에 없는 칸까지 부족분이 넘어올 때를 대비한 마지막 배수로.
  if (carry > 0) {
    const used = new Set(order.map(item => item.idx));
    for (const idx of [2, 1, 0]) {
      if (used.has(idx)) continue;
      const canTake = Math.max(0, probs[idx] - NEGATIVE_PROB_FLOOR);
      const cut = Math.min(canTake, carry);
      probs[idx] -= cut;
      taken += cut;
      carry -= cut;
      if (carry <= 0) break;
    }
  }

  return taken;
}

/**
 * v4.3 #3 — 확률 부스트 v3.
 * gain = (basePositive + 0.02) × (rate × Lv) × 0.8
 * 음수 면에서 실제로 빼온 양만 목표 양수 면에 더한다.
 */
function applyProbBoostV3(probs, lv, rate, targetIdx, baseProbs) {
  if (lv <= 0) return probs;
  const basePositive = baseProbs[targetIdx];
  const want = (basePositive + 0.02) * (rate * lv) * 0.8;
  if (want <= 0) return probs;

  const taken = takeFromNegativesWithFloor(probs, want, negativeCutOrder(targetIdx));
  probs[targetIdx] += taken;
  return probs;
}

/**
 * v4 #3 — 칸별 자동 성장 적용.
 * 방문 횟수 / 30 = 단계 (누적). 단계 × 0.1 배율만큼
 * 음수 면 합 전체에서 깎아 양수 3면(p1·p2·p3)에 비율 그대로 분배해서 더함.
 */
function applyTileGrowth(probs, position) {
  const visits = state.tileVisitCount[position] || 0;
  const stage = Math.floor(visits / TILE_GROWTH_STEP_VISITS);
  if (stage <= 0) return probs;

  const ratio = stage * TILE_GROWTH_RATIO_PER_STEP;

  let negSum = 0;
  for (const i of NEG_INDICES) negSum += probs[i];
  if (negSum <= 0) return probs;

  let maxTake = 0;
  for (const i of NEG_INDICES) maxTake += Math.max(0, probs[i] - NEGATIVE_PROB_FLOOR);
  let want = Math.min(negSum * ratio, maxTake);
  let actualCut = 0;

  for (const i of NEG_INDICES) {
    const share = probs[i] / negSum;
    let cut = want * share;
    const canTake = Math.max(0, probs[i] - NEGATIVE_PROB_FLOOR);
    if (cut > canTake) cut = canTake;
    probs[i] = Math.max(NEGATIVE_PROB_FLOOR, probs[i] - cut);
    actualCut += cut;
  }

  let posSum = 0;
  for (const i of POS_INDICES) posSum += probs[i];
  if (posSum > 0) {
    for (const i of POS_INDICES) {
      const share = probs[i] / posSum;
      probs[i] += actualCut * share;
    }
  } else {
    for (const i of POS_INDICES) probs[i] += actualCut / POS_INDICES.length;
  }

  return probs;
}

function getEffectiveProbs(position) {
  const override = getDiceProbabilityOverride(position);
  if (override) return override;

  const safePos = Math.max(0, Math.min(POSITION_PROB_TABLE.length - 1, position));
  const base = POSITION_PROB_TABLE[safePos];
  const baseArr = [base.n3, base.n2, base.n1, base.p1, base.p2, base.p3];

  // 적용 순서: 기본 → p1 → p2 → p3 → 칸별 자동 성장 → normalize
  let probs = baseArr.slice();

  probs = applyProbBoostV3(probs, state.permLevels.p1_prob, PERM_UPGRADES[0].rate, 3, baseArr);
  probs = applyProbBoostV3(probs, state.permLevels.p2_prob, PERM_UPGRADES[1].rate, 4, baseArr);
  probs = applyProbBoostV3(probs, state.permLevels.p3_prob, PERM_UPGRADES[2].rate, 5, baseArr);

  probs = applyTileGrowth(probs, position);

  return normalizeProbs(probs);
}

function rollFaceIdx(position) {
  const probs = getEffectiveProbs(position);
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < 6; i++) {
    acc += probs[i];
    if (r <= acc) return i;
  }
  let maxI = 0;
  for (let i = 1; i < 6; i++) if (probs[i] > probs[maxI]) maxI = i;
  return maxI;
}

function effectiveTrapChance(val) {
  // v4.2 — 함정 감소 업그레이드 제거. 기본 확률만 사용 (v3 롤백 base: +2=0.18, +3=0.28).
  if (state.debugTrapChanceOverride != null) return clampNumber(state.debugTrapChanceOverride, 0, 1);
  const key = String(val);
  return TRAP_BASE[key] || 0;
}

function extraCoinChance() {
  return Math.min(1, state.permLevels.coin_extra * 0.10);
}

function spawnCoinChance(rolled) {
  const base = COIN_SPAWN_BY_ROLL[String(rolled)];
  return base == null ? 0 : base;
}

// ============================================================
// 렌더 — 보드
// ============================================================
function makeTokenSVG() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('class', 'token');
  svg.innerHTML =
    '<ellipse cx="16" cy="7.5" rx="4.5" ry="4.5" fill="#f5c87a" stroke="#5a3818" stroke-width="1.5"/>' +
    '<path d="M11.5 12.5 L20.5 12.5 L19 15 L13 15 Z" fill="#f5c87a" stroke="#5a3818" stroke-width="1.5"/>' +
    '<path d="M9 22 Q9 15 16 15 Q23 15 23 22 Z" fill="#f5c87a" stroke="#5a3818" stroke-width="1.5"/>' +
    '<rect x="6.5" y="22" width="19" height="3.5" rx="1.2" fill="#d49620" stroke="#5a3818" stroke-width="1.4"/>' +
    '<rect x="4.5" y="25.5" width="23" height="3" rx="1.2" fill="#a06400" stroke="#5a3818" stroke-width="1.4"/>';
  return svg;
}

function renderBoard() {
  const board = $('board');
  board.innerHTML = '';
  for (let i = 0; i < TOTAL_TILES; i++) {
    const tile = el('div', 'tile');
    tile.dataset.tile = String(i);
    if (i === 0)         tile.classList.add('tile-start');
    if (i === GOAL_TILE) tile.classList.add('tile-goal');
    if (state.holes.has(i)) tile.classList.add('tile-hole');
    if (state.boardSpecialShops.has(i)) tile.classList.add('tile-special-shop');
    if (state.treasureChests.has(i)) tile.classList.add('tile-treasure');
    if (hasBridgeAt(i)) tile.classList.add('tile-bridge');
    if (state.position === i) tile.classList.add('tile-player');
    if (SAVE_TILES.includes(i)) tile.classList.add('tile-save-candidate');
    if (state.savePoint === i) tile.classList.add('tile-save-active');
    if (state.bestTile === i && i > 0) tile.classList.add('tile-best');

    const numLabel = i === GOAL_TILE ? '15 목표' : (i === 0 ? '0 시작' : String(i));
    tile.appendChild(el('div', 'tile-num', numLabel));

    const marks = el('div', 'tile-marks');
    if (state.position === i)     marks.appendChild(makeTokenSVG());
    if (state.holes.has(i))       marks.appendChild(el('div', 'mark-hole'));
    if (state.boardCoins.has(i)) {
      const coinCls = state.doubleCoins.has(i) ? 'mark-coin coin-x2' : 'mark-coin';
      marks.appendChild(el('div', coinCls));
    }
    if (state.boardGambleTickets.has(i)) {
      marks.appendChild(el('div', 'mark-ticket', '🎟'));
    }
    if (state.boardSpecialShops.has(i)) {
      marks.appendChild(el('div', 'mark-special-shop', '🏪'));
    }
    if (state.treasureChests.has(i)) {
      marks.appendChild(el('div', 'mark-treasure', '🎁'));
    }
    if (hasBridgeAt(i)) {
      marks.appendChild(el('div', 'mark-bridge', '🌉'));
    }
    if (state.savePoint === i) {
      marks.appendChild(el('div', 'mark-save', '💾'));
    }
    if (state.bestTile === i && i > 0) {
      marks.appendChild(el('div', 'mark-best', '🏆'));
    }
    tile.appendChild(marks);

    board.appendChild(tile);
  }

  const bestEl = $('best-tile');
  if (bestEl) bestEl.textContent = state.bestTile + '번 칸';
}

// ============================================================
// 렌더 — 위치별 6면 확률 도면
// ============================================================
function renderDicePattern() {
  const wrap = $('dice-pattern');
  wrap.innerHTML = '';
  const probs = getEffectiveProbs(state.position);

  const orderIdx = [5, 4, 3, 2, 1, 0];
  for (const i of orderIdx) {
    const val = FACE_IDX_TO_VAL[i];
    const isPos = val > 0;
    const cell = el('div', 'prob-cell ' + (isPos ? 'face-pos' : 'face-neg'));
    cell.appendChild(el('div', 'prob-cell-face', fmtVal(val)));
    const pct = probs[i];
    const pctText = (pct * 100).toFixed(pct < 0.01 ? 3 : (pct < 0.1 ? 2 : 1)) + '%';
    cell.appendChild(el('div', 'prob-cell-pct', pctText));
    wrap.appendChild(cell);
  }

  const visits = state.tileVisitCount[state.position] || 0;
  const stage = Math.floor(visits / TILE_GROWTH_STEP_VISITS);
  const growthLabel = stage > 0 ? ' · 성장 ' + stage + '단계' : '';
  const visitLabel = ' (' + visits + '/' + TILE_GROWTH_STEP_VISITS + ')';
  $('pos-indicator').textContent = '위치 ' + state.position + visitLabel + growthLabel;
}

// ============================================================
// 렌더 — 코인 + 상점 + 보유 아이템
// ============================================================
function renderCoin() {
  $('coin-count').textContent = String(state.coins);
}

function renderShop() {
  const permList = $('shop-perm');
  permList.innerHTML = '';
  for (const u of PERM_UPGRADES) {
    const unlocked = u.unlock(state);
    const lv = state.permLevels[u.id];
    const isMax = lv >= u.maxLv;
    if (!unlocked && !isMax) continue;
    permList.appendChild(makePermShopItem(u));
  }

  const tempList = $('shop-temp');
  tempList.innerHTML = '';
  tempList.appendChild(el('div', 'shop-empty-note', '보드의 특별상점에서만 구매'));

  renderOwned();
  renderSpecialShop();
}

function renderSpecialShop() {
  const modal = $('special-shop-modal');
  if (!modal) return;

  modal.classList.toggle('hidden', !state.specialShopOpen);

  const coinEl = $('special-shop-coin-count');
  if (coinEl) coinEl.textContent = String(state.coins);

  const rerollHeld = $('special-shop-reroll-held');
  if (rerollHeld) rerollHeld.textContent = state.rerollLeft + '/' + REROLL_MAX_HELD;

  const shieldHeld = $('special-shop-shield-held');
  if (shieldHeld) shieldHeld.textContent = String(state.ignoreTrap);

  const rerollBtn = $('special-shop-reroll');
  if (rerollBtn) {
    rerollBtn.disabled = !state.specialShopOpen
      || state.isAnimating
      || state.coins < SPECIAL_SHOP_COST
      || state.rerollLeft >= REROLL_MAX_HELD;
  }

  const shieldBtn = $('special-shop-shield');
  if (shieldBtn) {
    shieldBtn.disabled = !state.specialShopOpen
      || state.isAnimating
      || state.coins < SPECIAL_SHOP_COST;
  }
}

function openSpecialShop() {
  state.specialShopOpen = true;
  play('upgradeClick');
  logEvent('🏪 특별상점 발견 — 리롤·보호막 구매 가능', 'good');
  recordEvent('specialshop', { phase: 'open', tile: state.position });
  renderAll();
}

function closeSpecialShop() {
  if (!state.specialShopOpen) return;
  state.specialShopOpen = false;
  logEvent('🏪 특별상점 나가기', 'mid');
  renderAll();
}

function buySpecialShopItem(id) {
  if (!state.specialShopOpen) return;
  if (state.isAnimating) return;
  if (state.coins < SPECIAL_SHOP_COST) return;

  const item = SPECIAL_SHOP_ITEMS.find(u => u.id === id);
  if (!item) return;

  if (id === 'reroll') {
    if (state.rerollLeft >= REROLL_MAX_HELD) return;
    const beforeCoins = state.coins;
    state.coins -= SPECIAL_SHOP_COST;
    state.rerollLeft += 1;
    if (state.rerollLeft > REROLL_MAX_HELD) state.rerollLeft = REROLL_MAX_HELD;
    if (state.prevSnapshot != null && !state.isAnimating) state.canReroll = true;
    recordEvent('coin', {
      amount: -SPECIAL_SHOP_COST,
      reason: 'specialshop_reroll',
      beforeCoins,
      afterCoins: state.coins,
    });
  } else if (id === 'ignoreTrap') {
    const beforeCoins = state.coins;
    state.coins -= SPECIAL_SHOP_COST;
    state.ignoreTrap += 1;
    recordEvent('coin', {
      amount: -SPECIAL_SHOP_COST,
      reason: 'specialshop_ignoreTrap',
      beforeCoins,
      afterCoins: state.coins,
    });
  }

  play('upgradeClick');
  logEvent('🛒 특별상점 「' + item.name + '」 구매 (-' + SPECIAL_SHOP_COST + ')', 'good');
  recordEvent('specialshop', {
    phase: 'buy',
    itemId: id,
    itemName: item.name,
    cost: SPECIAL_SHOP_COST,
    rerollLeft: state.rerollLeft,
    ignoreTrap: state.ignoreTrap,
  });
  renderAll();
}

function makePermShopItem(u) {
  const item = el('div', 'shop-item');
  const lv = state.permLevels[u.id];
  const isMax = lv >= u.maxLv;
  const nextCost = isMax ? null : u.cost(lv);
  const canAfford = !isMax && state.coins >= nextCost;

  if (isMax) item.classList.add('maxed');
  else if (!canAfford) item.classList.add('disabled');

  const head = el('div', 'shop-item-head');
  head.appendChild(el('div', 'shop-item-name', u.name));
  head.appendChild(el('div', 'shop-item-level', 'Lv ' + lv + ' / ' + u.maxLv));
  item.appendChild(head);

  item.appendChild(el('div', 'shop-item-desc', u.desc));

  if (isMax) {
    const tag = el('span', 'maxed-tag', '최대 레벨');
    item.appendChild(tag);
  } else {
    const buy = el('button', 'buy-btn', '구매 (' + nextCost + ')');
    buy.disabled = !canAfford || state.isAnimating;
    buy.onclick = () => buyPerm(u);
    if (canAfford && !state.isAnimating) {
      buy.addEventListener('mouseenter', () => play('upgradeHover'));
    }
    item.appendChild(buy);
  }
  return item;
}

function renderOwned() {
  const list = $('owned-list');
  list.innerHTML = '';
  const chips = [];
  if (state.ignoreTrap > 0) chips.push('보호막 x' + state.ignoreTrap);
  if (state.rerollLeft > 0) chips.push('리롤 x' + state.rerollLeft);
  if (state.gambling) chips.push('도박 대기');
  if (state.restartCloudBridge) chips.push('4→6 구름다리');
  if (state.savePoint != null) chips.push('💾 세이브: ' + state.savePoint + '번');

  if (chips.length === 0) {
    list.appendChild(el('span', 'owned-empty', '아직 없음 — 상점에서 구매'));
  } else {
    for (const c of chips) list.appendChild(el('span', 'owned-chip', c));
  }
}

function renderRerollBtn() {
  const reroll = $('btn-reroll');
  const visible = state.prevSnapshot != null
                  && state.rerollLeft > 0;
  reroll.classList.toggle('hidden', !visible);
  reroll.textContent = '리롤 (' + state.rerollLeft + ')';
  reroll.disabled = !visible || state.isAnimating || !state.canReroll;
}

function setDebugPermLevel(upgradeId, level) {
  if (!['p1_prob', 'p2_prob', 'p3_prob'].includes(upgradeId)) return null;
  const before = state.permLevels[upgradeId];
  const next = clampInteger(level, 0, 7);
  state.permLevels[upgradeId] = next;
  recordDebugAction('perm_level', { upgradeId, beforeLevel: before, afterLevel: next });
  renderAll();
  return next;
}

function setDebugCoins(amount) {
  const beforeCoins = state.coins;
  const next = Math.max(0, Math.floor(clampNumber(amount, 0, 999999)));
  state.coins = next;
  recordDebugAction('set_coins', { beforeCoins, afterCoins: next });
  renderAll();
  return next;
}

function setDebugPosition(tile) {
  const before = state.position;
  const next = clampTile(tile);
  state.position = next;
  if (next > state.bestTile) state.bestTile = next;
  recordDebugAction('teleport', { from: before, to: next });
  renderAll();
  return next;
}

function setDebugSpecialChance(id, percent) {
  if (!DEBUG_SPECIAL_DEFAULTS.hasOwnProperty(id)) return null;
  const before = getDebugSpecialChance(id);
  const chance = chanceFromPercent(percent);
  state.debugSpecialChances[id] = chance;
  recordDebugAction('special_chance', {
    specialId: id,
    beforeChance: before,
    chance,
    percent: chance * 100,
  });
  renderAll();
  return chance;
}

function setDebugTrapChance(percent) {
  const before = state.debugTrapChanceOverride;
  const chance = chanceFromPercent(percent);
  state.debugTrapChanceOverride = chance;
  recordDebugAction('trap_chance', {
    beforeChance: before,
    chance,
    percent: chance * 100,
  });
  renderAll();
  return chance;
}

function setDebugSavePoint(tile) {
  const before = state.savePoint;
  let next = null;
  if (tile !== null && tile !== undefined && tile !== '' && tile !== 'none') {
    next = clampTile(tile);
  }
  state.savePoint = next;
  recordDebugAction('save_point', { beforeSavePoint: before, savePoint: next });
  renderAll();
  return next;
}

function forceTreasureBehind() {
  const candidates = [];
  for (let d = 1; d <= 3; d++) {
    const t = state.position - d;
    if (t < 0) break;
    if (!isEmptyEventTile(t)) continue;
    candidates.push(t);
  }
  if (candidates.length === 0) return null;

  const pick = candidates[0];
  state.treasureChests.set(pick, { ttl: TREASURE_TTL_TURNS });
  play('coinAdd');
  logEvent('🎁 [DEV] 뒤쪽 ' + pick + '칸에 보물상자 강제 생성', 'good');
  recordEvent('treasure', { phase: 'spawn', tile: pick, ttl: TREASURE_TTL_TURNS, source: 'debug_force' });
  return pick;
}

function activateDebugBridge(from) {
  const to = bridgeTarget(from);
  if (to == null) return null;
  if (from === 4 && state.restartCloudBridge) state.restartCloudBridge = false;
  state.bridges.delete(from);
  state.position = to;
  maybeUpdateSavePoint(to);
  if (to > state.bestTile) state.bestTile = to;
  logEvent('🌉 [DEV] 다리 강제 발동 — ' + from + '번에서 ' + to + '번으로 이동', 'good');
  recordEvent('bridge', { from, to, source: 'debug_force' });
  return { tile: from, to, activated: true };
}

function forceLuckyBridge() {
  if ((state.position === 4 || state.position === 10) && canBridgeOpen(state.position)) {
    return activateDebugBridge(state.position);
  }

  for (const tile of [4, 10]) {
    if (!canBridgeOpen(tile)) continue;
    if (state.holes.has(tile)) continue;
    state.bridges.add(tile);
    logEvent('🌉 [DEV] ' + tile + '번 칸에 럭키 다리 강제 생성', 'good');
    recordEvent('bridge', { phase: 'spawn', tile, source: 'debug_force' });
    return { tile, activated: false };
  }
  return null;
}

function forceDebugSpecial(id) {
  let result = null;

  if (id === 'gambleTicket') {
    state.gambling = true;
    logEvent('🎟 [DEV] 도박티켓 상태 강제 진입', 'good');
    recordEvent('gamble', { phase: 'pickup', tile: state.position, source: 'debug_force' });
    result = { active: true };
  } else if (id === 'specialShop') {
    openSpecialShop();
    result = { open: true };
  } else if (id === 'treasure') {
    const tile = forceTreasureBehind();
    result = { tile };
  } else if (id === 'luckyBridge') {
    result = forceLuckyBridge();
  } else if (id === 'restartBonus') {
    grantRestartBonus(state.savePoint, 'debug_force');
    result = { rerollLeft: state.rerollLeft, coins: state.coins, restartCloudBridge: state.restartCloudBridge };
  } else {
    return null;
  }

  recordDebugAction('force_special', { specialId: id, result });
  renderAll();
  return result;
}

function buildDebugSnapshot() {
  const probs = getEffectiveProbs(state.position);
  const faceProbabilities = {};
  for (let i = 0; i < FACE_IDX_TO_VAL.length; i++) {
    faceProbabilities[fmtVal(FACE_IDX_TO_VAL[i])] = Number((probs[i] * 100).toFixed(4));
  }

  const visits = state.tileVisitCount[state.position] || 0;
  return {
    runId: state.runId,
    turn: state.rolls,
    position: state.position,
    coins: state.coins,
    savePoint: state.savePoint,
    bestTile: state.bestTile,
    wins: state.wins,
    rerollLeft: state.rerollLeft,
    ignoreTrap: state.ignoreTrap,
    canReroll: state.canReroll,
    isAnimating: state.isAnimating,
    gambling: state.gambling,
    specialShopOpen: state.specialShopOpen,
    restartCloudBridge: state.restartCloudBridge,
    permLevels: Object.assign({}, state.permLevels),
    faceProbabilities,
    tileGrowth: {
      visits,
      stage: Math.floor(visits / TILE_GROWTH_STEP_VISITS),
    },
    boardCounts: {
      holes: state.holes.size,
      coins: state.boardCoins.size,
      gambleTickets: state.boardGambleTickets.size,
      specialShops: state.boardSpecialShops.size,
      treasures: state.treasureChests.size,
      bridges: state.bridges.size,
    },
    debugOverrides: {
      diceTiles: Object.keys(state.diceProbabilityOverrides || {}).map(Number),
      specialChances: {
        gambleTicket: Number((getDebugSpecialChance('gambleTicket') * 100).toFixed(2)),
        specialShop: Number((getDebugSpecialChance('specialShop') * 100).toFixed(2)),
        treasure: Number((getDebugSpecialChance('treasure') * 100).toFixed(2)),
        bridge: Number((getDebugSpecialChance('bridge') * 100).toFixed(2)),
        restartBonus: Number((getDebugSpecialChance('restartBonus') * 100).toFixed(2)),
      },
      trapChance: state.debugTrapChanceOverride == null
        ? null
        : Number((state.debugTrapChanceOverride * 100).toFixed(2)),
    },
    runLogCount: state.runLog.length,
  };
}

function setDebugValue(id, value) {
  const node = $(id);
  if (node) node.value = String(value);
}

function setDebugText(id, text) {
  const node = $(id);
  if (node) node.textContent = text;
}

function setDebugSlider(id, value, textId, suffix) {
  const rounded = Math.round(Number(value) * 10) / 10;
  setDebugValue(id, rounded);
  setDebugText(textId, String(rounded).replace(/\.0$/, '') + (suffix || ''));
}

function renderDebugConsoleControls() {
  const probs = getEffectiveProbs(state.position);
  for (let i = 0; i < FACE_KEY.length; i++) {
    const key = FACE_KEY[i];
    setDebugSlider('debug-dice-' + key, probs[i] * 100, 'debug-dice-val-' + key, '%');
  }
  setDebugText('debug-dice-current-tile', state.position + '번 칸');

  setDebugSlider('debug-perm-p1', state.permLevels.p1_prob, 'debug-perm-val-p1', '');
  setDebugSlider('debug-perm-p2', state.permLevels.p2_prob, 'debug-perm-val-p2', '');
  setDebugSlider('debug-perm-p3', state.permLevels.p3_prob, 'debug-perm-val-p3', '');
  setDebugValue('debug-coin-input', state.coins);
  setDebugValue('debug-teleport-select', state.position);

  setDebugSlider('debug-special-gamble-ticket', getDebugSpecialChance('gambleTicket') * 100, 'debug-special-val-gamble-ticket', '%');
  setDebugSlider('debug-special-shop', getDebugSpecialChance('specialShop') * 100, 'debug-special-val-shop', '%');
  setDebugSlider('debug-special-treasure', getDebugSpecialChance('treasure') * 100, 'debug-special-val-treasure', '%');
  setDebugSlider('debug-special-bridge', getDebugSpecialChance('bridge') * 100, 'debug-special-val-bridge', '%');
  setDebugSlider('debug-special-restart', getDebugSpecialChance('restartBonus') * 100, 'debug-special-val-restart', '%');

  setDebugSlider('debug-trap-chance', effectiveTrapChance(2) * 100, 'debug-trap-val', '%');
  setDebugValue('debug-save-select', state.savePoint == null ? 'none' : state.savePoint);
}

function renderDebugPanel() {
  const panel = $('debug-panel');
  if (!panel) return;

  panel.classList.toggle('hidden', !state.debugPanelOpen);
  panel.setAttribute('aria-hidden', state.debugPanelOpen ? 'false' : 'true');

  const stateBox = $('debug-state');
  if (stateBox && state.debugPanelOpen) {
    stateBox.textContent = JSON.stringify(buildDebugSnapshot(), null, 2);
  }
  if (state.debugPanelOpen) renderDebugConsoleControls();
}

function toggleDebugPanel(force) {
  state.debugPanelOpen = typeof force === 'boolean' ? force : !state.debugPanelOpen;
  renderDebugPanel();
}

function handleDebugKeydown(ev) {
  if (!ev) return;
  if (ev.code !== 'KeyD') return;
  const tag = ev.target && ev.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  toggleDebugPanel();
}

function renderAll() {
  renderBoard();
  renderDicePattern();
  renderCoin();
  renderShop();
  renderRerollBtn();
  renderDebugPanel();
}

// ============================================================
// 화면 크기 맞추기
// ============================================================
function fitScreen() {
  const wrap = $('game-wrap');
  const sx = window.innerWidth  / 1920;
  const sy = window.innerHeight / 1080;
  const s = Math.min(sx, sy, 1.0);
  wrap.style.transform = 'scale(' + s + ')';
  const offX = Math.max(0, (window.innerWidth  - 1920 * s) / 2);
  const offY = Math.max(0, (window.innerHeight - 1080 * s) / 2);
  wrap.style.position = 'absolute';
  wrap.style.left = offX + 'px';
  wrap.style.top  = offY + 'px';
}

// ============================================================
// 굴리기 + 리롤
// ============================================================
function takeSnapshot() {
  return {
    position: state.position,
    coins: state.coins,
    holes: new Set(state.holes),
    boardCoins: new Set(state.boardCoins),
    doubleCoins: new Set(state.doubleCoins),
    boardGambleTickets: new Set(state.boardGambleTickets),
    boardSpecialShops: new Set(state.boardSpecialShops),
    treasureChests: new Map(state.treasureChests),
    bridges: new Set(state.bridges),
    ignoreTrap: state.ignoreTrap,
    rerollLeft: state.rerollLeft,
    permLevels: Object.assign({}, state.permLevels),
    bestTile: state.bestTile,
    tileVisitCount: state.tileVisitCount.slice(),
    tileRewardClaimed: new Set(state.tileRewardClaimed),
    savePoint: state.savePoint,
    gambling: state.gambling,
    restartCloudBridge: state.restartCloudBridge,
  };
}

function restoreSnapshot(snap) {
  state.position    = snap.position;
  state.coins       = snap.coins;
  state.holes       = new Set(snap.holes);
  state.boardCoins  = new Set(snap.boardCoins);
  state.doubleCoins = new Set(snap.doubleCoins);
  state.boardGambleTickets = new Set(snap.boardGambleTickets);
  state.boardSpecialShops = new Set(snap.boardSpecialShops);
  state.treasureChests = new Map(snap.treasureChests);
  state.bridges = new Set(snap.bridges);
  state.ignoreTrap  = snap.ignoreTrap;
  state.permLevels  = Object.assign({}, snap.permLevels);
  state.bestTile          = snap.bestTile;
  state.tileVisitCount    = snap.tileVisitCount.slice();
  state.tileRewardClaimed = new Set(snap.tileRewardClaimed);
  state.savePoint         = snap.savePoint;
  state.gambling          = snap.gambling;
  state.restartCloudBridge = snap.restartCloudBridge;
}

function clampDest(pos) {
  if (pos < 0) return 0;
  if (pos > GOAL_TILE) return GOAL_TILE;
  return pos;
}

function hasBridgeAt(tile) {
  if (tile === 4 && state.restartCloudBridge) return true;
  return state.bridges.has(tile);
}

function canBridgeOpen(tile) {
  if (tile === 4) return true;
  if (tile === 10) return state.savePoint != null && state.savePoint >= 7;
  return false;
}

function bridgeTarget(tile) {
  if (tile === 4) return 6;
  if (tile === 10) return 13;
  return null;
}

function isPickupAt(tile) {
  return state.boardCoins.has(tile)
    || state.boardGambleTickets.has(tile)
    || state.boardSpecialShops.has(tile)
    || state.treasureChests.has(tile);
}

function isEmptyEventTile(tile) {
  if (tile < 0 || tile >= GOAL_TILE) return false;
  if (state.position === tile) return false;
  if (state.holes.has(tile)) return false;
  if (SAVE_TILES.includes(tile)) return false;
  if (isPickupAt(tile)) return false;
  if (hasBridgeAt(tile)) return false;
  return true;
}

function isForwardPickupTile(tile) {
  if (tile <= 0 || tile >= GOAL_TILE) return false;
  if (state.holes.has(tile)) return false;
  if (isPickupAt(tile)) return false;
  if (hasBridgeAt(tile)) return false;
  return true;
}

function clearTilePickups(tile) {
  state.boardCoins.delete(tile);
  state.doubleCoins.delete(tile);
  state.boardGambleTickets.delete(tile);
  state.boardSpecialShops.delete(tile);
  state.treasureChests.delete(tile);
}

function totalForwardPickups() {
  return state.boardCoins.size + state.boardGambleTickets.size + state.boardSpecialShops.size;
}

function settleGamblingRoll(val) {
  if (!state.gambling) return;
  state.gambling = false;

  const before = state.coins;
  let delta = 0;
  if (val >= 0) {
    state.coins += val;
    delta = val;
    logEvent('🎟 도박티켓 정산 +' + val + '코인 — 보유 ' + state.coins, 'good');
  } else {
    state.coins = Math.max(0, state.coins + val);
    delta = state.coins - before;
    logEvent('🎟 도박티켓 정산 ' + val + '코인 — ' + before + '→' + state.coins, 'bad');
  }
  recordEvent('gamble', {
    phase: 'settle',
    roll: val,
    amount: delta,
    beforeCoins: before,
    afterCoins: state.coins,
  });
  if (delta !== 0) {
    recordEvent('coin', {
      amount: delta,
      reason: 'gamble',
      beforeCoins: before,
      afterCoins: state.coins,
    });
  }
  renderCoin();
}

function tickTreasureChests() {
  if (state.treasureChests.size === 0) return;

  const expired = [];
  for (const [tile, chest] of state.treasureChests.entries()) {
    chest.ttl -= 1;
    if (chest.ttl <= 0) expired.push(tile);
  }
  for (const tile of expired) {
    state.treasureChests.delete(tile);
    logEvent('⌛ ' + tile + '칸 보물상자 소멸', 'mid');
  }
}

async function maybeUseBridge() {
  const from = state.position;
  if (!hasBridgeAt(from)) return;
  if (!canBridgeOpen(from)) return;

  const to = bridgeTarget(from);
  if (to == null) return;

  if (from === 4 && state.restartCloudBridge) {
    state.restartCloudBridge = false;
  }
  state.bridges.delete(from);

  logEvent('🌉 다리 발동 — ' + from + '번에서 ' + to + '번으로 이동', 'good');
  await sleep(250);
  state.position = to;
  maybeUpdateSavePoint(to);
  if (to > state.bestTile) state.bestTile = to;
  recordEvent('bridge', { from, to });
  renderBoard();
  renderDicePattern();
  play('move');
  await sleep(250);
}

function collectGambleTicketAt(tile) {
  if (!state.boardGambleTickets.has(tile)) return;
  state.boardGambleTickets.delete(tile);
  state.gambling = true;
  play('upgradeClick');
  logEvent('🎟 도박티켓 획득 — 다음 굴림 눈금만큼 코인 정산', 'good');
  recordEvent('gamble', { phase: 'pickup', tile });
}

function collectSpecialShopAt(tile) {
  if (!state.boardSpecialShops.has(tile)) return;
  state.boardSpecialShops.delete(tile);
  openSpecialShop();
}

function collectTreasureAt(tile) {
  if (!state.treasureChests.has(tile)) return;
  state.treasureChests.delete(tile);

  const r = Math.random();
  if (r < 0.70) {
    const gained = TREASURE_COIN_MIN + Math.floor(Math.random() * (TREASURE_COIN_MAX - TREASURE_COIN_MIN + 1));
    const beforeCoins = state.coins;
    state.coins += gained;
    play('coinRemove');
    logEvent('🎁 보물상자 — 코인 다발 +' + gained + ' (보유 ' + state.coins + ')', 'good');
    recordEvent('treasure', { phase: 'pickup', tile, reward: 'coin', amount: gained });
    recordEvent('coin', {
      amount: gained,
      reason: 'treasure',
      beforeCoins,
      afterCoins: state.coins,
    });
    renderCoin();
  } else if (r < 0.85) {
    state.gambling = true;
    play('upgradeClick');
    logEvent('🎁 보물상자 — 도박티켓 획득', 'good');
    recordEvent('treasure', { phase: 'pickup', tile, reward: 'gamble' });
    recordEvent('gamble', { phase: 'pickup', tile, source: 'treasure' });
  } else {
    logEvent('🎁 보물상자 — 특별상점 발견', 'good');
    recordEvent('treasure', { phase: 'pickup', tile, reward: 'specialshop' });
    openSpecialShop();
  }
}

function handleFinalCountdown(pos) {
  if (pos < 12 || pos > 14) return;
  const left = GOAL_TILE - pos;
  const msg = left + '칸 남음!';
  logEvent('🔥 ' + msg, 'good');
  showBigMessage(msg, 'good', 1200);
}

async function rollDice(isFromReroll) {
  if (state.isAnimating) return;

  if (!isFromReroll) tickTreasureChests();

  state.isAnimating = true;
  state.canReroll = false;
  $('btn-roll').disabled = true;
  renderRerollBtn();
  renderShop();

  if (!isFromReroll) state.prevSnapshot = takeSnapshot();

  const face = $('dice-face');
  face.classList.remove('dice-face-ready', 'result-pop', 'face-neg');
  face.classList.add('rolling');
  $('roll-readout').classList.remove('neg');
  $('roll-readout').innerHTML = '굴리는 중...';

  const tumbleTimer = setInterval(() => {
    const idx1 = Math.floor(Math.random() * 6);
    face.textContent = fmtVal(FACE_IDX_TO_VAL[idx1]);
    face.classList.toggle('face-neg', FACE_IDX_TO_VAL[idx1] < 0);
  }, 70);
  await sleep(400);
  clearInterval(tumbleTimer);

  const chosenIdx = rollFaceIdx(state.position);
  const chosenVal = FACE_IDX_TO_VAL[chosenIdx];

  face.classList.remove('rolling', 'result-pop');
  void face.offsetWidth;
  face.textContent = fmtVal(chosenVal);
  face.classList.toggle('face-neg', chosenVal < 0);
  face.classList.add('result-pop');

  state.lastRollIdx = chosenIdx;
  const val = FACE_IDX_TO_VAL[chosenIdx];

  $('roll-readout').innerHTML = '결과: <strong>' + fmtVal(val) + '</strong>';
  $('roll-readout').classList.toggle('neg', val < 0);
  if (!isFromReroll) {
    state.rolls += 1;
    logEvent('굴림 #' + state.rolls + ' → ' + fmtVal(val), val < 0 ? 'bad' : 'good');
  }
  recordEvent('roll', {
    roll: val,
    faceIdx: chosenIdx,
    isReroll: !!isFromReroll,
    positionBefore: state.position,
  });
  settleGamblingRoll(val);

  await sleep(500);

  try {
    await applyMovement(val);
  } finally {
    state.isAnimating = false;
    state.canReroll = !isFromReroll && state.prevSnapshot != null;
    $('btn-roll').disabled = false;
    renderAll();
  }
}

async function useReroll() {
  if (!state.canReroll || state.rerollLeft <= 0 || state.isAnimating) return;
  if (!state.prevSnapshot) return;

  const snap = state.prevSnapshot;
  restoreSnapshot(snap);
  state.rerollLeft = Math.max(0, snap.rerollLeft - 1);
  state.lastRollIdx = null;

  logEvent('리롤 사용 (남은 ' + state.rerollLeft + '개)', 'mid');
  renderAll();

  await rollDice(true);
}

// ============================================================
// 이동 + 함정 생성 + 함정 도착 + 코인 수집·스폰 + v4 새 효과들
// ============================================================
async function applyMovement(val) {
  const startPos = state.position;
  let endPos = startPos + val;
  if (endPos > GOAL_TILE) endPos = GOAL_TILE;

  // v4 #4-3 — 음수 굴림이면 세이브 포인트에서 멈춤
  let savedAtSavePoint = false;
  if (val < 0 && state.savePoint != null && endPos < state.savePoint) {
    endPos = state.savePoint;
    savedAtSavePoint = true;
  }
  if (endPos < 0) endPos = 0;

  if (startPos < GOAL_TILE && endPos !== startPos) {
    state.tileVisitCount[startPos] = (state.tileVisitCount[startPos] || 0) + 1;
  }

  const passed = [];
  if (val > 0) {
    for (let p = startPos + 1; p < endPos; p++) passed.push(p);
  }

  // 함정 생성 (+2/+3만)
  if (val === 2 || val === 3) {
    const chance = effectiveTrapChance(val);
    for (const t of passed) {
      if (t <= 0 || t >= GOAL_TILE) continue;
      if (state.holes.has(t)) continue;
      if (SAVE_TILES.includes(t)) continue;
      if (hasBridgeAt(t)) continue;
      if (Math.random() < chance) {
        state.holes.add(t);
        clearTilePickups(t);
        logEvent('☠ ' + t + '칸에 함정 생성', 'bad');
      }
    }
  }

  // 한 칸씩 이동 시각화
  if (val !== 0 && endPos !== startPos) {
    const step = endPos > startPos ? 1 : -1;
    const steps = Math.abs(endPos - startPos);
    let cur = startPos;
    for (let s = 0; s < steps; s++) {
      cur += step;
      state.position = cur;
      maybeUpdateSavePoint(cur);
      if (cur > state.bestTile) state.bestTile = cur;

      renderBoard();
      renderDicePattern();
      play('move');
      await sleep(200);
    }
  } else {
    if (state.position > state.bestTile) state.bestTile = state.position;
    renderBoard();
    renderDicePattern();
  }

  recordEvent('move', {
    from: startPos,
    to: state.position,
    roll: val,
    savedAtSavePoint,
  });

  if (savedAtSavePoint) {
    logEvent('💾 세이브 발동 — ' + endPos + '번 칸에서 멈춤', 'mid');
  }

  await maybeUseBridge();

  // 1) 목표 도달 — v4.2 #7: 함정 빠질 때와 동일한 보드 리셋
  if (state.position >= GOAL_TILE) {
    state.wins += 1;
    logEvent('🏁 목표 도달! (' + state.wins + '번째 클리어)', 'good');
    showToast('목표 도달!<br><span style="font-size:18px">' + state.wins + '번째 클리어</span>', 'good', 1700);
    await sleep(1500);
    // v4.2 #1 답=b — 클리어 시 진척도까지 새 런처럼 초기화 (도달 보상 claimed·tileVisitCount·bestTile 도 0)
    // 단 영구 업그레이드·보유 코인은 유지
    resetAfterTrap(true);
    return;
  }

  // 2) 함정 도착 검사
  if (state.holes.has(state.position)) {
    if (state.ignoreTrap > 0) {
      state.ignoreTrap -= 1;
      state.holes.delete(state.position);
      logEvent('🛡 보호막 발동 — 함정 제거 (남은 ' + state.ignoreTrap + '개)', 'good');
      recordEvent('trap', {
        tile: state.position,
        blocked: true,
        shieldLeft: state.ignoreTrap,
      });
      showToast('보호막<br><span style="font-size:18px">함정 제거</span>', 'good', 1300);
    } else {
      logEvent('💥 함정! 0번으로 리셋 (영구 강화·최고·성장은 유지)', 'bad');
      recordEvent('trap', {
        tile: state.position,
        blocked: false,
        bestTileAtReset: state.bestTile,
      });
      showToast('함정!<br><span style="font-size:18px">0번으로 리셋</span>', 'bad', 1400);
      play('reset');
      await sleep(900);
      resetAfterTrap();
      return;
    }
  }

  // 3) 도착 칸 코인 수집
  if (state.boardCoins.has(state.position)) {
    const isDouble = state.doubleCoins.has(state.position);
    state.boardCoins.delete(state.position);
    state.doubleCoins.delete(state.position);

    let gained = 1;
    if (isDouble) gained += 1;
    if (Math.random() < extraCoinChance()) gained += 1;

    const beforeCoins = state.coins;
    state.coins += gained;
    play('coinRemove');

    let msg = '🪙 코인 +' + gained;
    const tags = [];
    if (isDouble) tags.push('2배 칸');
    if (gained > (isDouble ? 2 : 1)) tags.push('추가 획득');
    if (tags.length) msg += ' (' + tags.join(' + ') + ')';
    msg += ' — 보유 ' + state.coins;
    logEvent(msg, 'good');
    recordEvent('coin', {
      amount: gained,
      reason: 'board_coin',
      tile: state.position,
      isDouble,
      beforeCoins,
      afterCoins: state.coins,
    });
    renderCoin();
  }

  // 4) v4.3 #2·#4 — 도박티켓·특별상점·뒤쪽 보물 수집
  collectGambleTicketAt(state.position);
  collectSpecialShopAt(state.position);
  collectTreasureAt(state.position);

  // 5) v4.3 #7 — 막판 카운트다운
  handleFinalCountdown(state.position);

  // 6) v4.2 #1 — 칸 도달 보상 (처음 1회만)
  await handleTileReward(state.position);

  // 7) 굴림 결과에 따른 코인·행운 스폰 + 뒤쪽 보물 + 럭키 다리
  trySpawnCoinAhead(val);
  trySpawnTreasureBehind();
  trySpawnLuckyBridges();

  renderBoard();
  renderDicePattern();
}

/** v4 #4-3 — 세이브 칸 통과·도달 시 세이브 포인트 갱신 (큰 값만 갱신) */
function maybeUpdateSavePoint(tilePos) {
  if (!SAVE_TILES.includes(tilePos)) return;
  if (state.savePoint == null) {
    state.savePoint = tilePos;
    play('upgradeClick');
    logEvent('💾 세이브 생성 — ' + tilePos + '번', 'mid');
  } else if (tilePos > state.savePoint) {
    state.savePoint = tilePos;
    play('upgradeClick');
    logEvent('💾 세이브 이동 — ' + tilePos + '번 (이전보다 높음)', 'mid');
  }
}

/**
 * v4.2 #1 — 도착 칸 보상 처리. 처음 1회만 지급. 알림창(showToast) 호출 제거.
 * 이미 받은 경우엔 아무 일도 안 함 (#6: 9-2 인라인 선택 패널 완전 제거).
 */
async function handleTileReward(pos) {
  if (!TILE_REWARDS.hasOwnProperty(pos)) return;
  const reward = TILE_REWARDS[pos];

  if (!state.tileRewardClaimed.has(pos)) {
    const beforeCoins = state.coins;
    state.coins += reward;
    state.tileRewardClaimed.add(pos);
    play('coinRemove');
    logEvent('🎁 ' + pos + '번 칸 첫 도달 보상 +' + reward + '코인 — 보유 ' + state.coins, 'good');
    recordEvent('coin', {
      amount: reward,
      reason: 'tile_reward',
      tile: pos,
      beforeCoins,
      afterCoins: state.coins,
    });
    renderCoin();
  }
  // 이미 받은 경우: return (#6)
}

function trySpawnCoinAhead(rolled) {
  const eff = spawnCoinChance(rolled);
  if (eff <= 0) return;
  if (Math.random() >= eff) return;
  if (totalForwardPickups() >= MAX_COINS_ON_BOARD) return;

  const candidates = [];
  for (let d = 1; d <= 3; d++) {
    const t = state.position + d;
    if (t >= GOAL_TILE) break;
    if (!isForwardPickupTile(t)) continue;
    candidates.push(t);
  }
  if (candidates.length === 0) return;

  const pick = candidates[Math.floor(Math.random() * candidates.length)];

  const gambleChance = getDebugSpecialChance('gambleTicket');
  const shopChance = getDebugSpecialChance('specialShop');
  const specialRoll = Math.random();
  if (specialRoll < gambleChance) {
    state.boardGambleTickets.add(pick);
    play('coinAdd');
    logEvent('🎟 ' + pick + '칸에 도박티켓 등장', 'good');
    recordEvent('gamble', { phase: 'spawn', tile: pick });
    return;
  }
  if (specialRoll < Math.min(1, gambleChance + shopChance)) {
    state.boardSpecialShops.add(pick);
    play('coinAdd');
    logEvent('🏪 ' + pick + '칸에 특별상점 등장', 'good');
    recordEvent('specialshop', { phase: 'spawn', tile: pick });
    return;
  }

  state.boardCoins.add(pick);

  let isDouble = false;
  if (Math.random() < DOUBLE_COIN_CHANCE) {
    state.doubleCoins.add(pick);
    isDouble = true;
  }
  play('coinAdd');
  logEvent('✨ ' + pick + '칸에 ' + (isDouble ? '2배 코인' : '코인') + ' 등장', isDouble ? 'good' : 'mid');
}

function trySpawnTreasureBehind() {
  if (Math.random() >= getDebugSpecialChance('treasure')) return;

  const candidates = [];
  for (let d = 1; d <= 3; d++) {
    const t = state.position - d;
    if (t < 0) break;
    if (!isEmptyEventTile(t)) continue;
    candidates.push(t);
  }
  if (candidates.length === 0) return;

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  state.treasureChests.set(pick, { ttl: TREASURE_TTL_TURNS });
  play('coinAdd');
  logEvent('🎁 뒤쪽 ' + pick + '칸에 보물상자 등장 (' + TREASURE_TTL_TURNS + '턴)', 'good');
  recordEvent('treasure', { phase: 'spawn', tile: pick, ttl: TREASURE_TTL_TURNS });
}

function trySpawnLuckyBridges() {
  for (const tile of [4, 10]) {
    if (!canBridgeOpen(tile)) continue;
    if (state.bridges.has(tile)) continue;
    if (tile === 4 && state.restartCloudBridge) continue;
    if (state.holes.has(tile)) continue;
    if (Math.random() >= getDebugSpecialChance('bridge')) continue;
    state.bridges.add(tile);
    logEvent('🌉 ' + tile + '번 칸에 럭키 다리 등장', 'good');
    recordEvent('bridge', { phase: 'spawn', tile });
  }
}

function grantRestartBonus(previousSavePoint, source) {
  const beforeCoins = state.coins;
  const beforeReroll = state.rerollLeft;
  state.rerollLeft = Math.min(REROLL_MAX_HELD, state.rerollLeft + 1);
  state.coins += 3;
  state.restartCloudBridge = true;
  logEvent('🎁 리스타트 보너스 — 리롤 1개, 코인 +3, 4→6 구름다리', 'good');
  recordEvent('restart_bonus', {
    previousSavePoint,
    source: source || 'reset',
    rerollGained: state.rerollLeft - beforeReroll,
    coinsGained: 3,
    bridge: '4->6',
  });
  recordEvent('coin', {
    amount: 3,
    reason: 'restart_bonus',
    beforeCoins,
    afterCoins: state.coins,
  });
}

/**
 * v4.2 — 보드 리셋. 기본은 함정 시 호출 (얕은 리셋).
 * isClear=true 면 게임 클리어 시 호출 (재현이형 모호점 #1 답=b: 진척도까지 초기화).
 *
 * 공통 초기화:
 *   position=0, holes, boardCoins, doubleCoins, 행운 물건, ignoreTrap, rerollLeft, savePoint
 * 클리어 시 추가 초기화 (#1 답=b):
 *   tileVisitCount (칸별 방문 수), tileRewardClaimed (도달 보상 받은 기록), bestTile (최고 기록)
 * 두 경우 모두 유지:
 *   coins (보유 코인), permLevels (영구 업그레이드)
 */
function resetAfterTrap(isClear) {
  const previousSavePoint = state.savePoint;
  const positionBeforeReset = state.position;
  const bestTileAtReset = state.bestTile;

  recordEvent('win_or_reset', {
    result: isClear ? 'clear' : 'reset',
    positionBeforeReset,
    bestTileAtReset,
    wins: state.wins,
    nextRunId: state.runId + 1,
  });

  state.position = 0;
  state.holes.clear();
  state.boardCoins.clear();
  state.doubleCoins.clear();
  state.boardGambleTickets.clear();
  state.boardSpecialShops.clear();
  state.treasureChests.clear();
  state.bridges.clear();
  state.ignoreTrap = 0;
  state.rerollLeft = 0;
  state.lastRollIdx = null;
  state.canReroll = false;
  state.savePoint = null;
  state.gambling = false;
  state.specialShopOpen = false;
  state.restartCloudBridge = false;
  if (isClear) {
    // v4.2 #1 답=b: 진척도까지 새 런처럼 초기화
    state.tileVisitCount = new Array(TOTAL_TILES).fill(0);
    state.tileRewardClaimed = new Set();
    state.bestTile = 0;
  }

  if (!isClear && previousSavePoint === 7 && Math.random() < getDebugSpecialChance('restartBonus')) {
    grantRestartBonus(previousSavePoint, 'reset');
  }

  state.runId += 1;
  renderAll();
}

// ============================================================
// 영구 업그레이드 구매
// ============================================================
function buyPerm(u) {
  if (state.isAnimating) return;
  const lv = state.permLevels[u.id];
  if (lv >= u.maxLv) return;
  if (!u.unlock(state)) return;
  const cost = u.cost(lv);
  if (state.coins < cost) return;

  state.coins -= cost;
  state.permLevels[u.id] = lv + 1;
  play('upgradeClick');
  logEvent('🛒 「' + u.name + '」 Lv' + (lv + 1) + ' 구매 (-' + cost + ')', 'good');
  recordEvent('coin', {
    amount: -cost,
    reason: 'permanent_upgrade',
    upgradeId: u.id,
    beforeCoins: state.coins + cost,
    afterCoins: state.coins,
  });
  renderAll();
}

function devAddCoins() {
  const beforeCoins = state.coins;
  state.coins += 100;
  logEvent('🛠 [DEV] +100 코인', 'mid');
  recordDebugAction('add_coins', {
    amount: 100,
    beforeCoins,
    afterCoins: state.coins,
  });
  recordEvent('coin', {
    amount: 100,
    reason: 'dev',
    beforeCoins,
    afterCoins: state.coins,
  });
  renderAll();
}

function bindDebugInput(id, handler) {
  const node = $(id);
  if (!node || node._debugBound) return;
  node._debugBound = true;
  node.addEventListener('input', handler);
  node.addEventListener('change', handler);
}

function bindDebugClick(id, handler) {
  const node = $(id);
  if (!node || node._debugBound) return;
  node._debugBound = true;
  node.addEventListener('click', handler);
}

function readDebugDicePercents() {
  return FACE_KEY.map(key => {
    const input = $('debug-dice-' + key);
    return input ? Number(input.value) : 0;
  });
}

function bindDebugConsole() {
  for (const key of FACE_KEY) {
    bindDebugInput('debug-dice-' + key, () => {
      setDiceProbabilityOverride(state.position, readDebugDicePercents());
    });
  }

  bindDebugInput('debug-perm-p1', () => setDebugPermLevel('p1_prob', $('debug-perm-p1').value));
  bindDebugInput('debug-perm-p2', () => setDebugPermLevel('p2_prob', $('debug-perm-p2').value));
  bindDebugInput('debug-perm-p3', () => setDebugPermLevel('p3_prob', $('debug-perm-p3').value));

  bindDebugInput('debug-coin-input', () => setDebugCoins($('debug-coin-input').value));
  bindDebugClick('debug-add-100', devAddCoins);
  bindDebugClick('debug-teleport-button', () => setDebugPosition($('debug-teleport-select').value));

  bindDebugInput('debug-special-gamble-ticket', () => setDebugSpecialChance('gambleTicket', $('debug-special-gamble-ticket').value));
  bindDebugInput('debug-special-shop', () => setDebugSpecialChance('specialShop', $('debug-special-shop').value));
  bindDebugInput('debug-special-treasure', () => setDebugSpecialChance('treasure', $('debug-special-treasure').value));
  bindDebugInput('debug-special-bridge', () => setDebugSpecialChance('bridge', $('debug-special-bridge').value));
  bindDebugInput('debug-special-restart', () => setDebugSpecialChance('restartBonus', $('debug-special-restart').value));

  bindDebugClick('debug-force-gamble-ticket', () => forceDebugSpecial('gambleTicket'));
  bindDebugClick('debug-force-special-shop', () => forceDebugSpecial('specialShop'));
  bindDebugClick('debug-force-treasure', () => forceDebugSpecial('treasure'));
  bindDebugClick('debug-force-bridge', () => forceDebugSpecial('luckyBridge'));
  bindDebugClick('debug-force-restart', () => forceDebugSpecial('restartBonus'));

  bindDebugInput('debug-trap-chance', () => setDebugTrapChance($('debug-trap-chance').value));
  bindDebugClick('debug-save-button', () => setDebugSavePoint($('debug-save-select').value));
}

// ============================================================
// 시작점
// ============================================================
function init() {
  initSounds();

  const rollBtn = $('btn-roll');
  rollBtn.addEventListener('click', () => {
    playRollClick();
    rollDice(false);
  });
  rollBtn.addEventListener('mouseenter', () => play('rollHover'));

  const rerollBtn = $('btn-reroll');
  rerollBtn.addEventListener('click', () => {
    playRollClick();
    useReroll();
  });

  const devBtn = $('btn-dev-coin');
  if (devBtn) devBtn.addEventListener('click', devAddCoins);
  bindDebugConsole();

  const copyLogBtn = $('btn-log-copy');
  if (copyLogBtn) copyLogBtn.addEventListener('click', () => {
    copyRunLogToClipboard().catch(() => setLogActionStatus('로그 복사 실패'));
  });

  const downloadLogBtn = $('btn-log-download');
  if (downloadLogBtn) downloadLogBtn.addEventListener('click', downloadRunLog);

  const specialRerollBtn = $('special-shop-reroll');
  if (specialRerollBtn) {
    specialRerollBtn.addEventListener('click', () => buySpecialShopItem('reroll'));
    specialRerollBtn.addEventListener('mouseenter', () => play('upgradeHover'));
  }

  const specialShieldBtn = $('special-shop-shield');
  if (specialShieldBtn) {
    specialShieldBtn.addEventListener('click', () => buySpecialShopItem('ignoreTrap'));
    specialShieldBtn.addEventListener('mouseenter', () => play('upgradeHover'));
  }

  const specialLeaveBtn = $('special-shop-leave');
  if (specialLeaveBtn) specialLeaveBtn.addEventListener('click', closeSpecialShop);

  window.addEventListener('resize', fitScreen);
  document.addEventListener('keydown', handleDebugKeydown);

  fitScreen();
  renderAll();
  logEvent('게임 시작 — 「주사위 굴리기」를 눌러 첫 굴림.', 'mid');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
