'use strict';

/* ============================================================
   뮤노폴리 v2 — Probability Climb
   위치별 동적 확률 테이블 + 5종 영구 업그레이드 + 2종 일회성
   주사위 면 [-3,-2,-1,+1,+2,+3] 고정. 확률만 위치별로 다르고, 업그레이드로 가중.
   ============================================================ */

// ============================================================
// 상수 (PRD 명세 그대로)
// ============================================================
const TOTAL_TILES = 16;             // 0번 ~ 15번
const GOAL_TILE   = 15;             // 목표 칸
const MAX_COINS_ON_BOARD = 4;       // 보드 동시 코인 최대 개수

// 주사위 6면: 인덱스 0~5 → 값 -3,-2,-1,+1,+2,+3 (절대 변경 금지)
const FACE_IDX_TO_VAL = [-3, -2, -1, 1, 2, 3];
const FACE_KEY        = ['n3', 'n2', 'n1', 'p1', 'p2', 'p3'];

/* ------------------------------------------------------------
   위치별 6면 확률 테이블 (0~14번, 15세트)
   PRD AC US-002 의 숫자를 그대로 옮김. 합이 정확히 1이 아닐 수 있어도
   normalizeProbs 가 자동 보정 (음수 클램프 + 합 1 재정규화).
   ------------------------------------------------------------ */
const POSITION_PROB_TABLE = [
  { n3: 0.11,    n2: 0.22,   n1: 0.38,   p1: 0.20,    p2: 0.08,    p3: 0.01      }, // Tile 0
  { n3: 0.1138,  n2: 0.23,   n1: 0.39,   p1: 0.185,   p2: 0.072,   p3: 0.0092    }, // Tile 1
  { n3: 0.1176,  n2: 0.24,   n1: 0.40,   p1: 0.17,    p2: 0.064,   p3: 0.0084    }, // Tile 2
  { n3: 0.1244,  n2: 0.245,  n1: 0.41,   p1: 0.155,   p2: 0.058,   p3: 0.0076    }, // Tile 3
  { n3: 0.1312,  n2: 0.25,   n1: 0.42,   p1: 0.14,    p2: 0.052,   p3: 0.0068    }, // Tile 4
  { n3: 0.1380,  n2: 0.255,  n1: 0.43,   p1: 0.125,   p2: 0.046,   p3: 0.0060    }, // Tile 5
  { n3: 0.1448,  n2: 0.26,   n1: 0.44,   p1: 0.11,    p2: 0.04,    p3: 0.0052    }, // Tile 6
  { n3: 0.1516,  n2: 0.265,  n1: 0.45,   p1: 0.095,   p2: 0.034,   p3: 0.0044    }, // Tile 7
  { n3: 0.1584,  n2: 0.27,   n1: 0.46,   p1: 0.08,    p2: 0.028,   p3: 0.0036    }, // Tile 8
  { n3: 0.1652,  n2: 0.275,  n1: 0.47,   p1: 0.065,   p2: 0.022,   p3: 0.0028    }, // Tile 9
  { n3: 0.1720,  n2: 0.28,   n1: 0.48,   p1: 0.05,    p2: 0.016,   p3: 0.0020    }, // Tile 10
  { n3: 0.1838,  n2: 0.285,  n1: 0.49,   p1: 0.035,   p2: 0.01,    p3: 0.0012    }, // Tile 11
  { n3: 0.1849,  n2: 0.29,   n1: 0.50,   p1: 0.02,    p2: 0.005,   p3: 0.0001    }, // Tile 12
  { n3: 0.1849,  n2: 0.29,   n1: 0.52,   p1: 0.005,   p2: 0.0001,  p3: 0.00001   }, // Tile 13
  { n3: 0.1799,  n2: 0.28,   n1: 0.54,   p1: 0.0001,  p2: 0.00001, p3: 0.00000001}, // Tile 14
];

// 굴림 결과별 코인 등장 기본 확률 (PRD 명세 그대로)
const COIN_SPAWN_BY_ROLL = {
  '-3': 1.00, '-2': 0.70, '-1': 0.45,
  '1':  0.20, '2':  0.12, '3':  0.08,
};

// 함정 생성 기본·최저 확률
const TRAP_BASE = { '2': 0.18, '3': 0.28 };
const TRAP_MIN  = { '2': 0.06, '3': 0.10 };

/* ------------------------------------------------------------
   영구 업그레이드 5종 (각 Lv10)
   - p1/p2/p3 _prob: 위치별 해당 양수 면 기본 확률에 곱하는 배율 테이블 (Lv1~10)
   - coin_spawn: 1.2^Lv, 가격 round(10 × 1.2^현재Lv)
   - trap_reduce: 0.92^Lv, 가격 round(10 × 1.2^현재Lv)
   - 언락 트리: +2는 +1 Lv5 도달부터, +3은 +2 Lv5 도달부터
   ------------------------------------------------------------ */
const PERM_UPGRADES = [
  {
    id: 'p1_prob', name: '+1 확률 강화',
    desc: '+1 면(밝은) 등장 확률에 배율을 곱한다. 안정 등반 핵심.',
    mult: [1.10, 1.21, 1.33, 1.46, 1.60, 1.75, 1.91, 2.08, 2.26, 2.45],
    cost: (lv) => 10 + lv,
    maxLv: 10,
    unlock: (s) => true,
    lockMsg: '',
  },
  {
    id: 'p2_prob', name: '+2 확률 강화',
    desc: '+2 면 등장 확률 배율. 두 칸씩 멀리 가지만 함정 생성 위험도 동반.',
    mult: [1.15, 1.32, 1.52, 1.75, 2.00, 2.30, 2.65, 3.05, 3.50, 4.00],
    cost: (lv) => 20 + lv * 2,
    maxLv: 10,
    unlock: (s) => s.permLevels.p1_prob >= 5,
    lockMsg: '잠금: +1 확률 Lv5 필요',
  },
  {
    id: 'p3_prob', name: '+3 확률 강화',
    desc: '+3 면 등장 확률 배율. 한방 3칸 점프 + 함정 위험 가장 큼.',
    mult: [1.25, 1.56, 1.95, 2.45, 3.10, 3.90, 4.90, 6.20, 7.80, 10.00],
    cost: (lv) => 60 + lv * 10,
    maxLv: 10,
    unlock: (s) => s.permLevels.p2_prob >= 5,
    lockMsg: '잠금: +2 확률 Lv5 필요',
  },
  {
    id: 'coin_spawn', name: '코인 등장 확률',
    desc: '굴림 후 코인 등장 확률에 배율 (1.2^Lv). 보드에 코인 자주 나옴.',
    multFn: (lv) => Math.pow(1.2, lv),
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

// 일회성 2종 (리셋 시 사라짐)
const TEMP_UPGRADES = [
  { id: 'ignoreTrap', name: '함정 무시 1회', cost: 5,
    desc: '다음 함정 도착 1회 무효화. 리셋 시 사라짐.' },
  { id: 'reroll',     name: '리롤 1회',       cost: 5,
    desc: '직전 굴림을 무효화하고 다시 굴림. 리셋 시 사라짐.' },
];

// ============================================================
// 상태 (게임 진행 중 바뀌는 모든 값)
// ============================================================
const state = {
  position: 0,                        // 현재 칸 (0~15)
  coins: 0,                           // 보유 코인 수
  holes: new Set(),                   // 함정 칸 번호 집합
  boardCoins: new Set(),              // 보드 위 코인 칸 집합
  permLevels: {                       // 영구 업그레이드 레벨 (0~10)
    p1_prob: 0, p2_prob: 0, p3_prob: 0,
    coin_spawn: 0, trap_reduce: 0,
  },
  ignoreTrap: 0,                      // 일회성 함정 무시 보유 개수
  rerollLeft: 0,                      // 일회성 리롤 보유 개수
  lastRollIdx: null,                  // 직전 굴림 면 인덱스 (리롤 가능 판단용)
  canReroll: false,                   // Roll 직후 리롤 가능 상태
  isAnimating: false,                 // 굴림·이동 진행 중 잠금
  prevSnapshot: null,                 // 리롤 복원용 직전 상태 스냅샷
  rolls: 0, wins: 0,                  // 통계
};

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

/** 음수 0 클램프 + 합 1로 재정규화 — 항상 인덱스 0~5의 배열 반환 */
function normalizeProbs(rawArr) {
  const out = rawArr.slice();
  for (let i = 0; i < out.length; i++) {
    if (!isFinite(out[i]) || out[i] < 0) out[i] = 0;
  }
  const sum = out.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    // 극단 케이스 — 모두 0이면 -1 면 100%로 (안전 폴백)
    return [0, 0, 1, 0, 0, 0];
  }
  for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
}

/**
 * 위치 기준 6면 유효 확률 산출.
 * 음수 면(n3,n2,n1)은 영구 업그레이드 영향 없음.
 * 양수 면(p1,p2,p3)은 해당 업그레이드 레벨>0 일 때 배율 곱함.
 * 마지막에 normalizeProbs 로 합 1 보정.
 */
function getEffectiveProbs(position) {
  const safePos = Math.max(0, Math.min(POSITION_PROB_TABLE.length - 1, position));
  const base = POSITION_PROB_TABLE[safePos];

  const lv1 = state.permLevels.p1_prob;
  const lv2 = state.permLevels.p2_prob;
  const lv3 = state.permLevels.p3_prob;
  const m1 = lv1 > 0 ? PERM_UPGRADES[0].mult[lv1 - 1] : 1;
  const m2 = lv2 > 0 ? PERM_UPGRADES[1].mult[lv2 - 1] : 1;
  const m3 = lv3 > 0 ? PERM_UPGRADES[2].mult[lv3 - 1] : 1;

  const raw = [
    base.n3,             // idx 0 → -3
    base.n2,             // idx 1 → -2
    base.n1,             // idx 2 → -1
    base.p1 * m1,        // idx 3 → +1
    base.p2 * m2,        // idx 4 → +2
    base.p3 * m3,        // idx 5 → +3
  ];
  return normalizeProbs(raw);
}

/** 현재 위치 기준 확률 분포로 6면 중 하나의 인덱스 추출 */
function rollFaceIdx(position) {
  const probs = getEffectiveProbs(position);
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < 6; i++) {
    acc += probs[i];
    if (r <= acc) return i;
  }
  // 부동소수점 잔량 대비 — 확률이 가장 큰 면으로 폴백
  let maxI = 0;
  for (let i = 1; i < 6; i++) if (probs[i] > probs[maxI]) maxI = i;
  return maxI;
}

/** +2 또는 +3 굴림 시 효과적인 함정 생성 확률 (감소 업그레이드 + 최저값 보장) */
function effectiveTrapChance(val) {
  const key = String(val);
  const base = TRAP_BASE[key];
  const min  = TRAP_MIN[key];
  if (base == null) return 0;
  const reduced = base * Math.pow(0.92, state.permLevels.trap_reduce);
  return Math.max(reduced, min);
}

/** 굴림 결과별 효과적인 코인 등장 확률 (스폰 업그레이드 곱, 최대 1.0) */
function effectiveCoinChance(rolled) {
  const base = COIN_SPAWN_BY_ROLL[String(rolled)];
  if (base == null) return 0;
  return Math.min(1, base * Math.pow(1.2, state.permLevels.coin_spawn));
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

    const numLabel = i === GOAL_TILE ? '15 목표' : (i === 0 ? '0 시작' : String(i));
    tile.appendChild(el('div', 'tile-num', numLabel));

    const marks = el('div', 'tile-marks');
    if (state.position === i)     marks.appendChild(makeTokenSVG());
    if (state.holes.has(i))       marks.appendChild(el('div', 'mark-hole'));
    if (state.boardCoins.has(i))  marks.appendChild(el('div', 'mark-coin'));
    tile.appendChild(marks);

    board.appendChild(tile);
  }
}

// ============================================================
// 렌더 — 위치별 6면 확률표 (가로 막대 그래프)
// ============================================================
function renderDicePattern() {
  const wrap = $('dice-pattern');
  wrap.innerHTML = '';
  const probs = getEffectiveProbs(state.position);

  // 막대 폭은 6면 중 최대 확률을 100%로 잡아 시각적 차이 강조
  const maxProb = Math.max(...probs, 0.0001);

  // 위에서 아래로: +3, +2, +1, -1, -2, -3 (양수가 위)
  const orderIdx = [5, 4, 3, 2, 1, 0];
  for (const i of orderIdx) {
    const val = FACE_IDX_TO_VAL[i];
    const isPos = val > 0;
    const row = el('div', 'prob-row ' + (isPos ? 'face-pos' : 'face-neg'));
    row.appendChild(el('div', 'prob-face-val', fmtVal(val)));

    const bar = el('div', 'prob-bar');
    const fill = el('div', 'prob-bar-fill');
    fill.style.width = (probs[i] / maxProb * 100).toFixed(1) + '%';
    bar.appendChild(fill);
    row.appendChild(bar);

    const pctText = (probs[i] * 100).toFixed(probs[i] < 0.01 ? 3 : 2) + '%';
    row.appendChild(el('div', 'prob-pct', pctText));

    wrap.appendChild(row);
  }

  $('pos-indicator').textContent = '위치 ' + state.position;
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
  for (const u of PERM_UPGRADES) permList.appendChild(makePermShopItem(u));

  const tempList = $('shop-temp');
  tempList.innerHTML = '';
  for (const u of TEMP_UPGRADES) tempList.appendChild(makeTempShopItem(u));

  renderOwned();
}

function makePermShopItem(u) {
  const item = el('div', 'shop-item');
  const lv = state.permLevels[u.id];
  const isMax = lv >= u.maxLv;
  const unlocked = u.unlock(state);
  const nextCost = isMax ? null : u.cost(lv);
  const canAfford = !isMax && state.coins >= nextCost;

  if (isMax) item.classList.add('maxed');
  else if (!unlocked) item.classList.add('locked');
  else if (!canAfford) item.classList.add('disabled');

  const head = el('div', 'shop-item-head');
  head.appendChild(el('div', 'shop-item-name', u.name));
  head.appendChild(el('div', 'shop-item-level', 'Lv ' + lv + ' / ' + u.maxLv));
  item.appendChild(head);

  item.appendChild(el('div', 'shop-item-desc', u.desc));

  if (!unlocked && !isMax) {
    item.appendChild(el('div', 'shop-item-lock', u.lockMsg));
  }

  if (isMax) {
    const tag = el('span', 'maxed-tag', '최대 레벨');
    item.appendChild(tag);
  } else {
    const buy = el('button', 'buy-btn', '구매 (' + nextCost + ')');
    buy.disabled = !unlocked || !canAfford || state.isAnimating;
    buy.onclick = () => buyPerm(u);
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
  item.appendChild(buy);

  return item;
}

function renderOwned() {
  const list = $('owned-list');
  list.innerHTML = '';
  const chips = [];
  if (state.ignoreTrap > 0) chips.push('함정 무시 x' + state.ignoreTrap);
  if (state.rerollLeft > 0) chips.push('리롤 x' + state.rerollLeft);

  if (chips.length === 0) {
    list.appendChild(el('span', 'owned-empty', '아직 없음 — 상점에서 구매'));
  } else {
    for (const c of chips) list.appendChild(el('span', 'owned-chip', c));
  }
}

function renderRerollBtn() {
  const reroll = $('btn-reroll');
  const visible = state.canReroll && state.rerollLeft > 0;
  reroll.classList.toggle('hidden', !visible);
  reroll.textContent = '리롤 (' + state.rerollLeft + ')';
  reroll.disabled = !visible || state.isAnimating;
}

function renderAll() {
  renderBoard();
  renderDicePattern();
  renderCoin();
  renderShop();
  renderRerollBtn();
}

// ============================================================
// 화면 크기 맞추기 — 1920x1080 디자인 기준, 작은 화면에서 자동 축소
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
// 굴리기 + 리롤 (스냅샷 저장 → 결과 → 이동)
// ============================================================
function takeSnapshot() {
  return {
    position: state.position,
    coins: state.coins,
    holes: new Set(state.holes),
    boardCoins: new Set(state.boardCoins),
    ignoreTrap: state.ignoreTrap,
    rerollLeft: state.rerollLeft,
    // 리롤로 굴림 직전 상태로 되돌릴 때 영구 업그레이드도 함께 복원해야
    // "굴림 → 업그레이드 구매 → 리롤로 코인 환불 + 레벨 유지" 무료 업그레이드 버그 차단
    permLevels: Object.assign({}, state.permLevels),
  };
}

function restoreSnapshot(snap) {
  state.position    = snap.position;
  state.coins       = snap.coins;
  state.holes       = new Set(snap.holes);
  state.boardCoins  = new Set(snap.boardCoins);
  state.ignoreTrap  = snap.ignoreTrap;
  state.permLevels  = Object.assign({}, snap.permLevels);
  // 리롤 자체 사용분은 따로 차감되므로 rerollLeft 는 여기서 복원하지 않음 (호출부에서 처리)
}

async function rollDice(isFromReroll) {
  if (state.isAnimating) return;
  state.isAnimating = true;
  state.canReroll = false;
  $('btn-roll').disabled = true;
  renderRerollBtn();
  renderShop(); // 굴림 중 구매 막기

  // 직전 상태 스냅샷 (리롤 복원용) — 리롤 호출 시엔 새로 저장하지 않음
  if (!isFromReroll) state.prevSnapshot = takeSnapshot();

  const face = $('dice-face');
  face.classList.remove('dice-face-ready', 'result-pop', 'face-neg');
  face.classList.add('rolling');
  $('roll-readout').classList.remove('neg');
  $('roll-readout').innerHTML = '굴리는 중...';

  // 굴림 시각화 — 0.4초간 무작위 면 빠르게 교체
  const tumbleTimer = setInterval(() => {
    const idx = Math.floor(Math.random() * 6);
    face.textContent = fmtVal(FACE_IDX_TO_VAL[idx]);
    face.classList.toggle('face-neg', FACE_IDX_TO_VAL[idx] < 0);
  }, 70);
  await sleep(400);
  clearInterval(tumbleTimer);

  // 실제 결과 추출
  const idx = rollFaceIdx(state.position);
  state.lastRollIdx = idx;
  const val = FACE_IDX_TO_VAL[idx];

  face.classList.remove('rolling');
  face.classList.remove('result-pop');
  // 브라우저가 result-pop 재시작을 보장하려면 두 클래스 토글 사이에 reflow 한 번 강제
  void face.offsetWidth;
  face.textContent = fmtVal(val);
  face.classList.toggle('face-neg', val < 0);
  face.classList.add('result-pop');

  $('roll-readout').innerHTML = '결과: <strong>' + fmtVal(val) + '</strong>';
  $('roll-readout').classList.toggle('neg', val < 0);
  state.rolls += 1;
  logEvent('굴림 #' + state.rolls + ' → ' + fmtVal(val), val < 0 ? 'bad' : 'good');

  // 결과 펄스 0.5초 후 이동 시작
  await sleep(500);

  try {
    await applyMovement(val);
  } finally {
    // 이동 중 어떤 분기에서도 잠금 해제 보장 (예외·리셋 분기 모두 커버)
    state.isAnimating = false;
    state.canReroll = !isFromReroll && state.rerollLeft > 0;
    $('btn-roll').disabled = false;
    renderAll();
  }
}

async function useReroll() {
  if (!state.canReroll || state.rerollLeft <= 0 || state.isAnimating) return;
  if (!state.prevSnapshot) return;

  // 직전 상태 복원 + 리롤 1회 소진
  const snap = state.prevSnapshot;
  restoreSnapshot(snap);
  state.rerollLeft = Math.max(0, snap.rerollLeft - 1);
  state.lastRollIdx = null;

  logEvent('리롤 사용 (남은 ' + state.rerollLeft + '개)', 'mid');
  renderAll();

  // 다시 굴림 — 새 스냅샷 저장하지 않음 (한 굴림당 1회 리롤)
  await rollDice(true);
}

// ============================================================
// 이동 + 함정 생성 + 함정 도착 + 코인 수집·스폰
// ============================================================
async function applyMovement(val) {
  const startPos = state.position;
  let endPos = startPos + val;
  if (endPos < 0) endPos = 0;
  if (endPos > GOAL_TILE) endPos = GOAL_TILE;

  // 지나친 칸 (출발 다음 칸 ~ 도착 직전, 양수 굴림만 함정 생성)
  const passed = [];
  if (val > 0) {
    for (let p = startPos + 1; p < endPos; p++) passed.push(p);
  }

  // 함정 생성 — +2 또는 +3 굴림 시, 지나친 칸에만 (도착 칸·0·15 제외)
  if (val === 2 || val === 3) {
    const chance = effectiveTrapChance(val);
    for (const t of passed) {
      if (t <= 0 || t >= GOAL_TILE) continue;     // 0·15 칸은 함정 안 됨
      if (state.holes.has(t)) continue;            // 이미 함정이면 그대로
      if (Math.random() < chance) {
        state.holes.add(t);
        state.boardCoins.delete(t);                // 코인 있었으면 제거
        logEvent('☠ ' + t + '칸에 함정 생성', 'bad');
      }
    }
  }

  // 한 칸씩 이동 시각화 (0.2초 간격)
  if (val !== 0 && endPos !== startPos) {
    const step = endPos > startPos ? 1 : -1;
    const steps = Math.abs(endPos - startPos);
    let cur = startPos;
    for (let s = 0; s < steps; s++) {
      cur += step;
      state.position = cur;
      renderBoard();
      await sleep(200);
    }
  } else {
    // 0번에서 음수 → 0칸 이동, 그래도 UI 갱신
    renderBoard();
  }

  // 1) 목표 도달 (승리) — 도착이 15
  if (state.position >= GOAL_TILE) {
    state.wins += 1;
    logEvent('🏁 목표 도달! (' + state.wins + '번째 클리어)', 'good');
    showToast('목표 도달!<br><span style="font-size:18px">' + state.wins + '번째 클리어</span>', 'good', 1700);
    await sleep(1500);
    // 새 사이클: 0번 칸으로 복귀. 코인·영구 업그레이드는 유지, 보드 함정·코인·일회성 보존
    state.position = 0;
    renderBoard();
    renderDicePattern();
    return;
  }

  // 2) 함정 도착 검사 — ignoreTrap 보유 시 1개 소진 후 무효
  if (state.holes.has(state.position)) {
    if (state.ignoreTrap > 0) {
      state.ignoreTrap -= 1;
      logEvent('🛡 함정 무시 발동 (남은 ' + state.ignoreTrap + '개)', 'good');
      showToast('함정 무시<br><span style="font-size:18px">1개 소진</span>', 'good', 1300);
    } else {
      logEvent('💥 함정! 0번으로 리셋 (보유 코인·영구 업그레이드 유지)', 'bad');
      showToast('함정!<br><span style="font-size:18px">0번으로 리셋</span>', 'bad', 1400);
      await sleep(900);
      resetAfterTrap();
      return;
    }
  }

  // 3) 도착 칸 코인 수집
  if (state.boardCoins.has(state.position)) {
    state.boardCoins.delete(state.position);
    state.coins += 1;
    logEvent('🪙 코인 +1 (보유 ' + state.coins + ')', 'good');
    renderCoin();
  }

  // 4) 굴림 결과에 따른 코인 스폰 (이동 완료 후)
  trySpawnCoinAhead(val);

  renderBoard();
  renderDicePattern(); // 위치 변동 시 확률표 갱신
}

function trySpawnCoinAhead(rolled) {
  const eff = effectiveCoinChance(rolled);
  if (eff <= 0) return;
  if (Math.random() >= eff) return;
  if (state.boardCoins.size >= MAX_COINS_ON_BOARD) return;

  const candidates = [];
  for (let d = 1; d <= 3; d++) {
    const t = state.position + d;
    if (t >= GOAL_TILE) break;                 // 15(목표)·그 이상 안 둠
    if (state.boardCoins.has(t)) continue;
    if (state.holes.has(t)) continue;
    candidates.push(t);
  }
  if (candidates.length === 0) return;

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  state.boardCoins.add(pick);
  logEvent('✨ ' + pick + '칸에 코인 등장', 'mid');
}

/** 함정 도착 리셋 — 위치/보드 함정·코인/일회성 보유만 초기화. 보유 코인·영구 업그레이드 유지 */
function resetAfterTrap() {
  state.position = 0;
  state.holes.clear();
  state.boardCoins.clear();
  state.ignoreTrap = 0;
  state.rerollLeft = 0;
  state.lastRollIdx = null;
  state.canReroll = false;
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
  logEvent('🛒 「' + u.name + '」 Lv' + (lv + 1) + ' 구매 (-' + cost + ')', 'good');
  renderAll();
}

function buyTemp(u) {
  if (state.isAnimating) return;
  if (state.coins < u.cost) return;

  state.coins -= u.cost;
  if (u.id === 'ignoreTrap') state.ignoreTrap += 1;
  if (u.id === 'reroll')     state.rerollLeft += 1;
  logEvent('🛒 「' + u.name + '」 +1 (-' + u.cost + ')', 'good');
  renderAll();
}

// ============================================================
// 시작점
// ============================================================
function init() {
  $('btn-roll').addEventListener('click', () => rollDice(false));
  $('btn-reroll').addEventListener('click', useReroll);
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
