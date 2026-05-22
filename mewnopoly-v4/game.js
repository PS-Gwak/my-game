'use strict';

/* ============================================================
   뮤노폴리 v4 — Probability Climb
   v3 베이스 + 재현이형 피드백 10항목(+모호점 6답변) 반영:
     #1 보드 옆 세션 최고 기록
     #2 +1/+2/+3 확률 강화 가격 재조정 (반값 + Lv별 점진 증가)
     #3 칸별 자동 성장 (30회마다 음수→양수 0.1배율 누적)
     #4 칸 도달 보상 (3/5/8/10번 처음 1회)
     #4-3 세이브 포인트 (5/8/10/12번 도달 시 갱신, 음수 굴림 시 멈춤)
     #5 함정 등장 확률 절반 (+2: 9%, +3: 14%)
     #6 일회성 업그레이드 5번 칸 영구 해금
     #7 리롤 버그 수정 (굴림 후 리롤 구매 시 버튼 활성화)
     #8 두 번 굴리기 영구 업그레이드 (7번 칸 해금, 함정 회피 우선 큰 값)
     #9-1 세이브 보상은 #4와 동일
     #9-2 이미 보상 받은 칸 재도달 시 인라인 선택 패널 (두 배 + 리셋 / 그냥)
   v3 락-인 유지:
     - 확률 강화 = 음수 면 깎아 양수 면에 더함
     - 잠금 업그레이드 DOM 숨김
     - 도면형 확률 / 폰트 키움 / 5줄 메시지 고정
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

// v4 #5 — 함정 확률 절반 (+2: 0.18→0.09, +3: 0.28→0.14). 최저 보장은 그대로.
const TRAP_BASE = { '2': 0.09, '3': 0.14 };
const TRAP_MIN  = { '2': 0.06, '3': 0.10 };

const DOUBLE_COIN_CHANCE = 0.10;

// v4 #4 — 칸 도달 보상 (처음 1회만). 키 = 칸 번호, 값 = 코인 보상.
const TILE_REWARDS = { 3: 5, 5: 10, 8: 10, 10: 20 };
// v4 #4-3 — 세이브 포인트 칸들 (오름차순). 통과·도달 시 갱신.
const SAVE_TILES = [5, 8, 10, 12];

// v4 #3 — 칸별 30회 방문마다 1단계 (단계 × 0.1)만큼 음수→양수 이동.
const TILE_GROWTH_STEP_VISITS = 30;
const TILE_GROWTH_RATIO_PER_STEP = 0.1;

// v4 #6 — 일회성 업그레이드 해금되는 위치
const TEMP_UNLOCK_TILE = 5;
// v4 #8 — 두 번 굴리기 해금되는 위치
const DOUBLE_ROLL_UNLOCK_TILE = 7;
const DOUBLE_ROLL_COST = 10;

/* ------------------------------------------------------------
   영구 업그레이드
   v4 #2 — +1/+2/+3 확률 강화 가격 절반·점진 증가:
     +1: 3 + floor(lv/2)
     +2: 5 + floor(lv/2)
     +3: 8 + floor(lv/2)
   (Lv별: 3,3,4,4,5,5,6,6,7,7 / 5,5,6,6,7,7,8,8,9,9 / 8,8,9,9,10,10,11,11,12,12)
   ------------------------------------------------------------ */
const PERM_UPGRADES = [
  {
    id: 'p1_prob', name: '+1 확률 강화',
    desc: '음수 면(–3·–2·–1)에서 일부를 깎아 그만큼 +1 면에 더한다. Lv당 음수 합의 3% 만큼 이동. 양수 면은 절대 줄지 않음.',
    shiftPerLv: 0.03,
    targetIdx: 3,
    cost: (lv) => 3 + Math.floor(lv / 2),
    maxLv: 10,
    unlock: (s) => true,
    lockMsg: '',
  },
  {
    id: 'p2_prob', name: '+2 확률 강화',
    desc: '음수 면에서 깎아 +2 면에 더한다. Lv당 음수 합의 4%. 두 칸씩 가지만 함정 위험도 동반.',
    shiftPerLv: 0.04,
    targetIdx: 4,
    cost: (lv) => 5 + Math.floor(lv / 2),
    maxLv: 10,
    unlock: (s) => s.permLevels.p1_prob >= 5,
    lockMsg: '잠금: +1 확률 Lv5 필요',
  },
  {
    id: 'p3_prob', name: '+3 확률 강화',
    desc: '음수 면에서 깎아 +3 면에 더한다. Lv당 음수 합의 5%. 한방 3칸 점프 + 함정 위험 최대.',
    shiftPerLv: 0.05,
    targetIdx: 5,
    cost: (lv) => 8 + Math.floor(lv / 2),
    maxLv: 10,
    unlock: (s) => s.permLevels.p2_prob >= 5,
    lockMsg: '잠금: +2 확률 Lv5 필요',
  },
  {
    id: 'coin_extra', name: '추가 코인 획득 확률',
    desc: '코인을 수집할 때 (Lv × 10%) 확률로 +1 추가. Lv10에서 100% (= 항상 2배).',
    multFn: (lv) => lv * 0.10,
    cost: (lv) => Math.round(10 * Math.pow(1.2, lv)),
    maxLv: 10,
    unlock: (s) => true,
    lockMsg: '',
  },
  {
    id: 'trap_reduce', name: '함정 감소',
    desc: '+2/+3 굴림 시 함정 생성 확률에 배율 (0.92^Lv). 최저 6%/10% 보장.',
    multFn: (lv) => Math.pow(0.92, lv),
    cost: (lv) => Math.round(10 * Math.pow(1.2, lv)),
    maxLv: 10,
    unlock: (s) => true,
    lockMsg: '',
  },
];

const TEMP_UPGRADES = [
  { id: 'ignoreTrap', name: '함정 무시 1회', cost: 5,
    desc: '다음 함정 도착 1회 무효화. 리셋 시 사라짐.' },
  { id: 'reroll',     name: '리롤 1회',       cost: 5,
    desc: '직전 굴림을 무효화하고 다시 굴림. 리셋 시 사라짐.' },
];

// v4 #8 — 두 번 굴리기 영구 업그레이드 (Lv 시스템 없음, 한 번 구매로 영구)
const DOUBLE_ROLL_UPGRADE = {
  id: 'double_roll',
  name: '두 번 굴리기',
  desc: '굴림마다 주사위 두 개 결과 중 하나 선택. 함정 회피 우선, 그 다음 큰 값.',
  cost: DOUBLE_ROLL_COST,
};

// ============================================================
// 상태
// ============================================================
const state = {
  position: 0,
  coins: 0,
  holes: new Set(),
  boardCoins: new Set(),
  doubleCoins: new Set(),
  permLevels: {
    p1_prob: 0, p2_prob: 0, p3_prob: 0,
    coin_extra: 0, trap_reduce: 0,
  },
  ignoreTrap: 0,
  rerollLeft: 0,
  lastRollIdx: null,
  canReroll: false,
  isAnimating: false,
  prevSnapshot: null,
  rolls: 0, wins: 0,

  // v4 신규 상태
  bestTile: 0,                            // #1 — 세션 최고 도달 칸
  tileVisitCount: new Array(TOTAL_TILES).fill(0), // #3 — 칸별 방문 횟수
  tileRewardClaimed: new Set(),           // #4 — 도달 보상 처음 1회 체크
  savePoint: null,                        // #4-3 — 현재 세이브 칸 (null = 없음)
  tempUnlocked: false,                    // #6 — 일회성 업그레이드 영구 해금
  hasDoubleRoll: false,                   // #8 — 두 번 굴리기 영구 구매 여부
  doubleRollUnlocked: false,              // #8 — 7번 도달로 영구 해금
  pendingResave: null,                    // #9-2 — 인라인 선택 패널 대기 (resolve 함수 보관)
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

function showToast(html, kind, ms) {
  const t = $('toast');
  t.className = 'toast';
  if (kind === 'bad')  t.classList.add('toast-bad');
  if (kind === 'good') t.classList.add('toast-good');
  t.innerHTML = html;
  t.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.add('hidden'), ms || 1500);
}

// ============================================================
// 확률 처리
// ============================================================

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

function applyProbBoost(probs, lv, shiftPerLv, targetIdx) {
  if (lv <= 0) return probs;

  let negSum = 0;
  for (const i of NEG_INDICES) negSum += probs[i];
  if (negSum <= 0) return probs;

  let want = negSum * (shiftPerLv * lv);
  if (want > negSum) want = negSum;

  for (const i of NEG_INDICES) {
    const share = probs[i] / negSum;
    let cut = want * share;
    if (cut > probs[i]) cut = probs[i];
    probs[i] = Math.max(0, probs[i] - cut);
  }

  probs[targetIdx] += want;
  return probs;
}

/**
 * v4 #3 — 칸별 자동 성장 적용.
 * 방문 횟수 / 30 = 단계 (누적). 단계 × 0.1 배율만큼
 * 음수 면 합 전체에서 깎아 양수 3면(p1·p2·p3)에 비율 그대로 분배해서 더함.
 * (음수 3면 사이 차감도 그들 비율 유지 / 양수 3면 사이 추가도 그들 비율 유지)
 */
function applyTileGrowth(probs, position) {
  const visits = state.tileVisitCount[position] || 0;
  const stage = Math.floor(visits / TILE_GROWTH_STEP_VISITS);
  if (stage <= 0) return probs;

  const ratio = stage * TILE_GROWTH_RATIO_PER_STEP; // 예: 1단계=0.1, 2단계=0.2 …

  let negSum = 0;
  for (const i of NEG_INDICES) negSum += probs[i];
  if (negSum <= 0) return probs;

  let want = negSum * ratio;
  if (want > negSum) want = negSum;

  // 음수 면 비율 유지하며 차감
  for (const i of NEG_INDICES) {
    const share = probs[i] / negSum;
    let cut = want * share;
    if (cut > probs[i]) cut = probs[i];
    probs[i] = Math.max(0, probs[i] - cut);
  }

  // 양수 3면 비율 유지하며 추가
  let posSum = 0;
  for (const i of POS_INDICES) posSum += probs[i];
  if (posSum > 0) {
    for (const i of POS_INDICES) {
      const share = probs[i] / posSum;
      probs[i] += want * share;
    }
  } else {
    // 양수 합이 0인 극단 케이스 — 균등 분배
    for (const i of POS_INDICES) probs[i] += want / POS_INDICES.length;
  }

  return probs;
}

function getEffectiveProbs(position) {
  const safePos = Math.max(0, Math.min(POSITION_PROB_TABLE.length - 1, position));
  const base = POSITION_PROB_TABLE[safePos];

  let probs = [base.n3, base.n2, base.n1, base.p1, base.p2, base.p3];

  // v3 확률 강화 (음수→해당 양수 면)
  probs = applyProbBoost(probs, state.permLevels.p1_prob, PERM_UPGRADES[0].shiftPerLv, 3);
  probs = applyProbBoost(probs, state.permLevels.p2_prob, PERM_UPGRADES[1].shiftPerLv, 4);
  probs = applyProbBoost(probs, state.permLevels.p3_prob, PERM_UPGRADES[2].shiftPerLv, 5);

  // v4 #3 — 칸별 자동 성장 (음수 합 전체 → 양수 3면 비율 유지 분배)
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
  const key = String(val);
  const base = TRAP_BASE[key];
  const min  = TRAP_MIN[key];
  if (base == null) return 0;
  const reduced = base * Math.pow(0.92, state.permLevels.trap_reduce);
  return Math.max(reduced, min);
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
    if (state.position === i) tile.classList.add('tile-player');
    // v4 #4-3 — 세이브 후보 칸은 옅게, 현재 세이브 칸은 강조
    if (SAVE_TILES.includes(i)) tile.classList.add('tile-save-candidate');
    if (state.savePoint === i) tile.classList.add('tile-save-active');
    // v4 #1 — 세션 최고 칸 강조 (도달 칸·세이브 칸과 별개 표시)
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
    // v4 — 세이브·최고 마커는 칸 우측에 작게
    if (state.savePoint === i) {
      marks.appendChild(el('div', 'mark-save', '💾'));
    }
    if (state.bestTile === i && i > 0) {
      marks.appendChild(el('div', 'mark-best', '🏆'));
    }
    tile.appendChild(marks);

    board.appendChild(tile);
  }

  // 세션 최고 표시 갱신
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

  // v4 — 위치 인디케이터에 칸 성장 단계 표시
  const visits = state.tileVisitCount[state.position] || 0;
  const stage = Math.floor(visits / TILE_GROWTH_STEP_VISITS);
  const growthLabel = stage > 0 ? ' · 성장 ' + stage + '단계' : '';
  const visitLabel = ' (' + visits + '/' + TILE_GROWTH_STEP_VISITS + ')';
  $('pos-indicator').textContent = '위치 ' + state.position + visitLabel + growthLabel;
}

// ============================================================
// 렌더 — 코인 + 상점 + 보유 일회성
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

  // v4 #8 — 두 번 굴리기 (해금 시 등장, 구매 후엔 「보유 중」 표시)
  if (state.doubleRollUnlocked) {
    permList.appendChild(makeDoubleRollItem());
  }

  const tempList = $('shop-temp');
  tempList.innerHTML = '';
  // v4 #6 — 일회성 업그레이드는 영구 해금 후에만 카드 추가 (잠금 표시 X)
  if (state.tempUnlocked) {
    for (const u of TEMP_UPGRADES) tempList.appendChild(makeTempShopItem(u));
  }

  renderOwned();
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

// v4 #8 — 두 번 굴리기 카드 (특수: Lv 시스템 없음 · 한 번 구매로 영구)
function makeDoubleRollItem() {
  const item = el('div', 'shop-item');
  const u = DOUBLE_ROLL_UPGRADE;
  const owned = state.hasDoubleRoll;
  const canAfford = state.coins >= u.cost;

  if (owned) item.classList.add('maxed');
  else if (!canAfford) item.classList.add('disabled');

  const head = el('div', 'shop-item-head');
  head.appendChild(el('div', 'shop-item-name', u.name));
  head.appendChild(el('div', 'shop-item-level', owned ? '보유 중' : '미보유'));
  item.appendChild(head);

  item.appendChild(el('div', 'shop-item-desc', u.desc));

  if (owned) {
    item.appendChild(el('span', 'maxed-tag', '영구 활성'));
  } else {
    const buy = el('button', 'buy-btn', '구매 (' + u.cost + ')');
    buy.disabled = !canAfford || state.isAnimating;
    buy.onclick = () => buyDoubleRoll();
    if (canAfford && !state.isAnimating) {
      buy.addEventListener('mouseenter', () => play('upgradeHover'));
    }
    item.appendChild(buy);
  }
  return item;
}

function makeTempShopItem(u) {
  const item = el('div', 'shop-item');
  const canAfford = state.coins >= u.cost;
  const heldCount = u.id === 'ignoreTrap' ? state.ignoreTrap
                   : u.id === 'reroll'    ? state.rerollLeft
                   : 0;

  if (!canAfford) item.classList.add('disabled');

  const head = el('div', 'shop-item-head');
  head.appendChild(el('div', 'shop-item-name', u.name));
  head.appendChild(el('div', 'shop-item-level', '보유 ' + heldCount + '개'));
  item.appendChild(head);

  item.appendChild(el('div', 'shop-item-desc', u.desc));

  const buy = el('button', 'buy-btn', '구매 (' + u.cost + ')');
  buy.disabled = !canAfford || state.isAnimating;
  buy.onclick = () => buyTemp(u);
  if (canAfford && !state.isAnimating) {
    buy.addEventListener('mouseenter', () => play('upgradeHover'));
  }
  item.appendChild(buy);

  return item;
}

function renderOwned() {
  const list = $('owned-list');
  list.innerHTML = '';
  const chips = [];
  if (state.ignoreTrap > 0) chips.push('함정 무시 x' + state.ignoreTrap);
  if (state.rerollLeft > 0) chips.push('리롤 x' + state.rerollLeft);
  if (state.hasDoubleRoll)  chips.push('두 번 굴리기 (영구)');
  if (state.savePoint != null) chips.push('💾 세이브: ' + state.savePoint + '번');

  if (chips.length === 0) {
    list.appendChild(el('span', 'owned-empty', '아직 없음 — 상점에서 구매'));
  } else {
    for (const c of chips) list.appendChild(el('span', 'owned-chip', c));
  }
}

function renderRerollBtn() {
  const reroll = $('btn-reroll');
  // v4 #7 — 굴림 직후 prevSnapshot 살아있고 리롤 보유분 있으면 즉시 활성화.
  // (이전 v3 버그: 굴림 끝낸 뒤 리롤 구매 시 canReroll 갱신 안 돼서 안 보임)
  const visible = !state.isAnimating
                  && state.prevSnapshot != null
                  && state.rerollLeft > 0
                  && state.canReroll;
  reroll.classList.toggle('hidden', !visible);
  reroll.textContent = '리롤 (' + state.rerollLeft + ')';
  reroll.disabled = !visible;
}

function renderAll() {
  renderBoard();
  renderDicePattern();
  renderCoin();
  renderShop();
  renderRerollBtn();
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
    ignoreTrap: state.ignoreTrap,
    rerollLeft: state.rerollLeft,
    permLevels: Object.assign({}, state.permLevels),
    // v4 — 리롤 시 v4 신규 상태도 함께 복원
    bestTile: state.bestTile,
    tileVisitCount: state.tileVisitCount.slice(),
    tileRewardClaimed: new Set(state.tileRewardClaimed),
    savePoint: state.savePoint,
    tempUnlocked: state.tempUnlocked,
    hasDoubleRoll: state.hasDoubleRoll,
    doubleRollUnlocked: state.doubleRollUnlocked,
  };
}

function restoreSnapshot(snap) {
  state.position    = snap.position;
  state.coins       = snap.coins;
  state.holes       = new Set(snap.holes);
  state.boardCoins  = new Set(snap.boardCoins);
  state.doubleCoins = new Set(snap.doubleCoins);
  state.ignoreTrap  = snap.ignoreTrap;
  state.permLevels  = Object.assign({}, snap.permLevels);
  // v4 — 신규 상태 복원
  state.bestTile          = snap.bestTile;
  state.tileVisitCount    = snap.tileVisitCount.slice();
  state.tileRewardClaimed = new Set(snap.tileRewardClaimed);
  state.savePoint         = snap.savePoint;
  state.tempUnlocked      = snap.tempUnlocked;
  state.hasDoubleRoll     = snap.hasDoubleRoll;
  state.doubleRollUnlocked = snap.doubleRollUnlocked;
}

/**
 * v4 #8 — 두 번 굴리기 시 두 결과 중 하나 선택.
 * 함정 회피 우선 → 둘 다 안전이면 큰 값 → 둘 다 함정이면 큰 값 → 동일하면 그 값.
 * 함정 체크는 *현재 보드에 이미 있는* 함정만 본다 (새로 생기는 함정 시뮬 X).
 */
function pickBetterRoll(idxA, idxB) {
  const valA = FACE_IDX_TO_VAL[idxA];
  const valB = FACE_IDX_TO_VAL[idxB];

  const destA = clampDest(state.position + valA);
  const destB = clampDest(state.position + valB);

  const trapA = state.holes.has(destA);
  const trapB = state.holes.has(destB);

  // 한쪽만 함정 → 함정 아닌 쪽
  if (trapA && !trapB) return idxB;
  if (trapB && !trapA) return idxA;

  // 둘 다 안전 or 둘 다 함정 → 큰 값 (값 같으면 어느 거든)
  return valA >= valB ? idxA : idxB;
}

function clampDest(pos) {
  if (pos < 0) return 0;
  if (pos > GOAL_TILE) return GOAL_TILE;
  return pos;
}

async function rollDice(isFromReroll) {
  if (state.isAnimating) return;
  if (state.pendingResave) return; // v4 #9-2 — 선택 대기 중엔 굴림 막기

  state.isAnimating = true;
  state.canReroll = false;
  $('btn-roll').disabled = true;
  renderRerollBtn();
  renderShop();

  if (!isFromReroll) state.prevSnapshot = takeSnapshot();

  const face = $('dice-face');
  const face2 = $('dice-face-2');
  face.classList.remove('dice-face-ready', 'result-pop', 'face-neg');
  face.classList.add('rolling');
  $('roll-readout').classList.remove('neg');
  $('roll-readout').innerHTML = '굴리는 중...';

  // v4 #8 — 두 번 굴리기 활성 시 두 번째 주사위 표시
  const useDouble = state.hasDoubleRoll;
  if (useDouble) {
    face2.classList.remove('hidden', 'dice-face-ready', 'result-pop', 'face-neg');
    face2.classList.add('rolling');
  } else {
    face2.classList.add('hidden');
  }

  const tumbleTimer = setInterval(() => {
    const idx1 = Math.floor(Math.random() * 6);
    face.textContent = fmtVal(FACE_IDX_TO_VAL[idx1]);
    face.classList.toggle('face-neg', FACE_IDX_TO_VAL[idx1] < 0);
    if (useDouble) {
      const idx2 = Math.floor(Math.random() * 6);
      face2.textContent = fmtVal(FACE_IDX_TO_VAL[idx2]);
      face2.classList.toggle('face-neg', FACE_IDX_TO_VAL[idx2] < 0);
    }
  }, 70);
  await sleep(400);
  clearInterval(tumbleTimer);

  // 실제 결과 추출
  let chosenIdx;
  if (useDouble) {
    const idxA = rollFaceIdx(state.position);
    const idxB = rollFaceIdx(state.position);
    chosenIdx = pickBetterRoll(idxA, idxB);

    const valA = FACE_IDX_TO_VAL[idxA];
    const valB = FACE_IDX_TO_VAL[idxB];
    const chosenVal = FACE_IDX_TO_VAL[chosenIdx];

    // 두 주사위 결과 둘 다 표시, 선택된 쪽 강조
    face.classList.remove('rolling', 'result-pop');
    face2.classList.remove('rolling', 'result-pop');
    void face.offsetWidth;
    void face2.offsetWidth;

    face.textContent  = fmtVal(valA);
    face2.textContent = fmtVal(valB);
    face.classList.toggle('face-neg', valA < 0);
    face2.classList.toggle('face-neg', valB < 0);

    face.classList.toggle('chosen', chosenIdx === idxA);
    face2.classList.toggle('chosen', chosenIdx === idxB);
    face.classList.toggle('not-chosen', chosenIdx !== idxA);
    face2.classList.toggle('not-chosen', chosenIdx !== idxB);

    face.classList.add('result-pop');
    face2.classList.add('result-pop');
  } else {
    chosenIdx = rollFaceIdx(state.position);
    const chosenVal = FACE_IDX_TO_VAL[chosenIdx];

    face.classList.remove('rolling', 'result-pop', 'chosen', 'not-chosen');
    void face.offsetWidth;
    face.textContent = fmtVal(chosenVal);
    face.classList.toggle('face-neg', chosenVal < 0);
    face.classList.add('result-pop');
  }

  state.lastRollIdx = chosenIdx;
  const val = FACE_IDX_TO_VAL[chosenIdx];

  if (useDouble) {
    const valA = FACE_IDX_TO_VAL[state.lastRollIdx]; // 표시용
    $('roll-readout').innerHTML = '두 결과 중 선택: <strong>' + fmtVal(val) + '</strong>';
  } else {
    $('roll-readout').innerHTML = '결과: <strong>' + fmtVal(val) + '</strong>';
  }
  $('roll-readout').classList.toggle('neg', val < 0);
  state.rolls += 1;
  logEvent('굴림 #' + state.rolls + ' → ' + fmtVal(val) + (useDouble ? ' (두 번 굴리기)' : ''), val < 0 ? 'bad' : 'good');

  await sleep(500);

  try {
    await applyMovement(val);
  } finally {
    state.isAnimating = false;
    // v4 #7 — 굴림 종료 후 prevSnapshot이 살아있으면 리롤 가능 상태로
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

  // 통과 칸들 (양수 굴림일 때 도착 칸 직전까지)
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
      if (SAVE_TILES.includes(t)) continue; // v4 — 세이브 후보 칸엔 함정 안 생기게
      if (Math.random() < chance) {
        state.holes.add(t);
        state.boardCoins.delete(t);
        state.doubleCoins.delete(t);
        logEvent('☠ ' + t + '칸에 함정 생성', 'bad');
      }
    }
  }

  // 한 칸씩 이동 시각화 (각 칸 도달 시 v4 효과 적용)
  if (val !== 0 && endPos !== startPos) {
    const step = endPos > startPos ? 1 : -1;
    const steps = Math.abs(endPos - startPos);
    let cur = startPos;
    for (let s = 0; s < steps; s++) {
      cur += step;
      state.position = cur;
      // v4 #3 — 각 칸 도달 시 방문 카운트 증가 (0번·15번 제외)
      if (cur > 0 && cur < GOAL_TILE) {
        state.tileVisitCount[cur] = (state.tileVisitCount[cur] || 0) + 1;
      }
      // v4 #4-3 — 세이브 칸을 통과(또는 도달)하면 세이브 갱신
      maybeUpdateSavePoint(cur);
      // v4 #1 — 최고 기록 갱신
      if (cur > state.bestTile) state.bestTile = cur;

      renderBoard();
      renderDicePattern();
      play('move');
      await sleep(200);
    }
  } else {
    // 이동 없음 (val=0 or 경계 막힘)
    if (state.position > 0 && state.position < GOAL_TILE) {
      state.tileVisitCount[state.position] = (state.tileVisitCount[state.position] || 0) + 1;
    }
    if (state.position > state.bestTile) state.bestTile = state.position;
    renderBoard();
    renderDicePattern();
  }

  if (savedAtSavePoint) {
    logEvent('💾 세이브 발동 — ' + endPos + '번 칸에서 멈춤', 'mid');
    showToast('💾 세이브 발동<br><span style="font-size:18px">' + endPos + '번 칸에서 멈춤</span>', 'good', 1300);
  }

  // 1) 목표 도달
  if (state.position >= GOAL_TILE) {
    state.wins += 1;
    logEvent('🏁 목표 도달! (' + state.wins + '번째 클리어)', 'good');
    showToast('목표 도달!<br><span style="font-size:18px">' + state.wins + '번째 클리어</span>', 'good', 1700);
    await sleep(1500);
    state.position = 0;
    renderBoard();
    renderDicePattern();
    return;
  }

  // 2) 함정 도착 검사
  if (state.holes.has(state.position)) {
    if (state.ignoreTrap > 0) {
      state.ignoreTrap -= 1;
      logEvent('🛡 함정 무시 발동 (남은 ' + state.ignoreTrap + '개)', 'good');
      showToast('함정 무시<br><span style="font-size:18px">1개 소진</span>', 'good', 1300);
    } else {
      logEvent('💥 함정! 0번으로 리셋 (영구 강화·최고·성장은 유지)', 'bad');
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

    state.coins += gained;
    play('coinRemove');

    let msg = '🪙 코인 +' + gained;
    const tags = [];
    if (isDouble) tags.push('2배 칸');
    if (gained > (isDouble ? 2 : 1)) tags.push('추가 획득');
    if (tags.length) msg += ' (' + tags.join(' + ') + ')';
    msg += ' — 보유 ' + state.coins;
    logEvent(msg, 'good');
    renderCoin();
  }

  // 4) v4 #4 / #9 — 칸 도달 보상 (도착 칸에서만, 처음 1회 / 재도달 시 선택 패널)
  await handleTileReward(state.position);

  // 5) v4 #6 — 일회성 업그레이드 영구 해금 (5번 도달 시)
  if (state.position >= TEMP_UNLOCK_TILE && !state.tempUnlocked) {
    state.tempUnlocked = true;
    logEvent('🔓 일회성 업그레이드 영구 해금 (5번 칸 도달)', 'good');
    showToast('일회성 업그레이드 해금<br><span style="font-size:18px">상점에 등장</span>', 'good', 1300);
    play('upgradeClick');
  }

  // 6) v4 #8 — 두 번 굴리기 영구 해금 (7번 도달 시)
  if (state.position >= DOUBLE_ROLL_UNLOCK_TILE && !state.doubleRollUnlocked) {
    state.doubleRollUnlocked = true;
    logEvent('🔓 두 번 굴리기 영구 해금 (7번 칸 도달)', 'good');
    showToast('두 번 굴리기 해금<br><span style="font-size:18px">상점에 등장</span>', 'good', 1300);
    play('upgradeClick');
  }

  // 7) 굴림 결과에 따른 코인 스폰
  trySpawnCoinAhead(val);

  renderBoard();
  renderDicePattern();
}

/** v4 #4-3 — 세이브 칸 통과·도달 시 세이브 포인트 갱신 (큰 값만 갱신) */
function maybeUpdateSavePoint(tilePos) {
  if (!SAVE_TILES.includes(tilePos)) return;
  if (state.savePoint == null || tilePos > state.savePoint) {
    state.savePoint = tilePos;
    play('upgradeClick');
    logEvent('💾 세이브 갱신 — ' + tilePos + '번', 'mid');
  }
}

/**
 * v4 #4 — 도착 칸 보상 처리.
 * 처음 도달: 보상 지급 + claimed 등록.
 * 이미 받음: #9-2 인라인 선택 패널 노출.
 */
async function handleTileReward(pos) {
  if (!TILE_REWARDS.hasOwnProperty(pos)) return;
  const reward = TILE_REWARDS[pos];

  if (!state.tileRewardClaimed.has(pos)) {
    // 처음 도달 — 보상 지급
    state.coins += reward;
    state.tileRewardClaimed.add(pos);
    play('coinRemove');
    logEvent('🎁 ' + pos + '번 칸 첫 도달 보상 +' + reward + '코인 — 보유 ' + state.coins, 'good');
    showToast('🎁 ' + pos + '번 칸 보상<br><span style="font-size:18px">+' + reward + ' 코인</span>', 'good', 1300);
    renderCoin();
  } else {
    // 이미 받음 — 인라인 선택 패널 (단, 보드 리셋 가치가 있는 5/8/10번에서만)
    if (!SAVE_TILES.includes(pos)) return; // 3번 등은 재선택 안 함
    await showResavePanel(pos, reward);
  }
}

/** v4 #9-2 — 인라인 선택 패널 등장 (모달 X, 클릭 시 처리) */
function showResavePanel(pos, baseReward) {
  return new Promise(resolve => {
    const panel = $('resave-panel');
    panel.classList.remove('hidden');
    state.pendingResave = { pos, baseReward, resolve };
    state.isAnimating = true; // 클릭 전까지 굴림 막기
    $('btn-roll').disabled = true;

    // 패널 안내 텍스트에 보상량 명시
    const desc = panel.querySelector('.resave-desc');
    if (desc) {
      desc.innerHTML = pos + '번 칸 보상은 ' + baseReward + '코인이었어요.<br>두 배(' + (baseReward * 2) + '코인) 받고 보드 리셋할까요, 아니면 그냥 진행할까요?';
    }
  });
}

function handleResaveChoice(takeDouble) {
  if (!state.pendingResave) return;
  const { pos, baseReward, resolve } = state.pendingResave;
  const panel = $('resave-panel');
  panel.classList.add('hidden');

  if (takeDouble) {
    const doubled = baseReward * 2;
    state.coins += doubled;
    state.holes.clear();
    state.boardCoins.clear();
    state.doubleCoins.clear();
    state.savePoint = null;
    state.position = 0;
    play('coinRemove');
    logEvent('💎 ' + pos + '번 재도달 — 두 배 보상 +' + doubled + ' + 보드 리셋', 'good');
    showToast('💎 두 배 보상<br><span style="font-size:18px">+' + doubled + ' 코인, 보드 리셋</span>', 'good', 1400);
  } else {
    logEvent('➡ ' + pos + '번 재도달 — 그냥 진행 (보상 없음)', 'mid');
  }

  state.pendingResave = null;
  state.isAnimating = false;
  $('btn-roll').disabled = false;
  renderAll();
  resolve();
}

function trySpawnCoinAhead(rolled) {
  const eff = spawnCoinChance(rolled);
  if (eff <= 0) return;
  if (Math.random() >= eff) return;
  if (state.boardCoins.size >= MAX_COINS_ON_BOARD) return;

  const candidates = [];
  for (let d = 1; d <= 3; d++) {
    const t = state.position + d;
    if (t >= GOAL_TILE) break;
    if (state.boardCoins.has(t)) continue;
    if (state.holes.has(t)) continue;
    candidates.push(t);
  }
  if (candidates.length === 0) return;

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  state.boardCoins.add(pick);

  let isDouble = false;
  if (Math.random() < DOUBLE_COIN_CHANCE) {
    state.doubleCoins.add(pick);
    isDouble = true;
  }
  play('coinAdd');
  logEvent('✨ ' + pick + '칸에 ' + (isDouble ? '2배 코인' : '코인') + ' 등장', isDouble ? 'good' : 'mid');
}

function resetAfterTrap() {
  state.position = 0;
  state.holes.clear();
  state.boardCoins.clear();
  state.doubleCoins.clear();
  state.ignoreTrap = 0;
  state.rerollLeft = 0;
  state.lastRollIdx = null;
  state.canReroll = false;
  // v4 — 함정 빠질 때 세이브만 초기화. coins·permLevels·tileVisitCount·
  // tileRewardClaimed·bestTile·tempUnlocked·hasDoubleRoll·doubleRollUnlocked은 유지.
  state.savePoint = null;
  renderAll();
}

// ============================================================
// 영구·일회성 구매
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
  renderAll();
}

// v4 #8 — 두 번 굴리기 구매 (특수)
function buyDoubleRoll() {
  if (state.isAnimating) return;
  if (state.hasDoubleRoll) return;
  if (!state.doubleRollUnlocked) return;
  if (state.coins < DOUBLE_ROLL_COST) return;

  state.coins -= DOUBLE_ROLL_COST;
  state.hasDoubleRoll = true;
  play('upgradeClick');
  logEvent('🛒 「두 번 굴리기」 영구 구매 (-' + DOUBLE_ROLL_COST + ')', 'good');
  renderAll();
}

function buyTemp(u) {
  if (state.isAnimating) return;
  if (!state.tempUnlocked) return;
  if (state.coins < u.cost) return;

  state.coins -= u.cost;
  if (u.id === 'ignoreTrap') state.ignoreTrap += 1;
  if (u.id === 'reroll')     state.rerollLeft += 1;
  play('upgradeClick');
  logEvent('🛒 「' + u.name + '」 +1 (-' + u.cost + ')', 'good');

  // v4 #7 — 리롤 산 직후 canReroll 갱신 (굴림이 끝난 뒤라면 prevSnapshot 살아있음)
  if (u.id === 'reroll' && state.prevSnapshot != null && !state.isAnimating) {
    state.canReroll = true;
  }
  renderAll();
}

function devAddCoins() {
  state.coins += 10;
  logEvent('🛠 [DEV] +10 코인', 'mid');
  renderAll();
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

  // v4 #9-2 — 인라인 선택 패널 버튼들
  const resaveYes = $('btn-resave-yes');
  const resaveNo  = $('btn-resave-no');
  if (resaveYes) resaveYes.addEventListener('click', () => handleResaveChoice(true));
  if (resaveNo)  resaveNo .addEventListener('click', () => handleResaveChoice(false));

  const devBtn = $('btn-dev-coin');
  if (devBtn) devBtn.addEventListener('click', devAddCoins);

  window.addEventListener('resize', fitScreen);

  fitScreen();
  renderAll();
  logEvent('게임 시작 — 「주사위 굴리기」를 눌러 첫 굴림.', 'mid');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
