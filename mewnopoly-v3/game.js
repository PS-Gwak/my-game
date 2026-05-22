'use strict';

/* ============================================================
   뮤노폴리 v3 — Probability Climb
   v2 베이스 + 9개 명세 변경 + 사운드 통합
   (확률 부스트 방식 변경, 2배 코인, 도면형 확률표, 잠금 숨김 등)
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

const TRAP_BASE = { '2': 0.18, '3': 0.28 };
const TRAP_MIN  = { '2': 0.06, '3': 0.10 };

// v3 명세 #1 — 코인 스폰 시 2배 칸이 될 확률 (고정 10%)
const DOUBLE_COIN_CHANCE = 0.10;

/* ------------------------------------------------------------
   영구 업그레이드
   v3 변경:
   - #3: p1/p2/p3 _prob 의 효과 방식이 "음수 면에서 깎아 양수 면에 더하기"로 변경
     (mult 배열은 사용 안 함. shiftPerLv 로 Lv당 깎는 비율 정의)
   - #7: coin_spawn → coin_extra (이름·효과 완전 변경: 수집 시 추가 1코인 확률)
   ------------------------------------------------------------ */
const PERM_UPGRADES = [
  {
    id: 'p1_prob', name: '+1 확률 강화',
    desc: '음수 면(–3·–2·–1)에서 일부를 깎아 그만큼 +1 면에 더한다. Lv당 음수 합의 3% 만큼 이동. 양수 면은 절대 줄지 않음.',
    shiftPerLv: 0.03, // Lv당 음수 합에서 깎아 +1 에 더하는 비율
    targetIdx: 3,     // +1 면 인덱스
    cost: (lv) => 10 + lv,
    maxLv: 10,
    unlock: (s) => true,
    lockMsg: '',
  },
  {
    id: 'p2_prob', name: '+2 확률 강화',
    desc: '음수 면에서 깎아 +2 면에 더한다. Lv당 음수 합의 4%. 두 칸씩 가지만 함정 위험도 동반.',
    shiftPerLv: 0.04,
    targetIdx: 4,
    cost: (lv) => 20 + lv * 2,
    maxLv: 10,
    unlock: (s) => s.permLevels.p1_prob >= 5,
    lockMsg: '잠금: +1 확률 Lv5 필요',
  },
  {
    id: 'p3_prob', name: '+3 확률 강화',
    desc: '음수 면에서 깎아 +3 면에 더한다. Lv당 음수 합의 5%. 한방 3칸 점프 + 함정 위험 최대.',
    shiftPerLv: 0.05,
    targetIdx: 5,
    cost: (lv) => 60 + lv * 10,
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

// ============================================================
// 상태
// ============================================================
const state = {
  position: 0,
  coins: 0,
  holes: new Set(),
  boardCoins: new Set(),
  doubleCoins: new Set(),             // v3 #1 — 2배 칸 (boardCoins 의 부분집합)
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
};

// ============================================================
// 사운드 (v3 통합)
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
    // 연속 재생 시 끊기지 않게 clone (특히 move 처럼 빠르게 반복되는 사운드)
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
  // v3 #4 — 첫 실제 로그가 들어올 때 초기 공백 5개를 제거 (이후엔 일반 동작)
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
// 확률 처리 (v3 #3 — 음수에서 깎아 양수에 더하는 방식)
// ============================================================

/** 음수 0 클램프 + 합 1로 재정규화 */
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

/**
 * v3 #3 — 확률 부스트 적용 (양수 면 절대 안 줄임).
 * 한 양수 면(targetIdx)에 대해:
 *  - 음수 면 합에서 (shiftPerLv × lv) 비율만큼 깎고
 *  - 그 깎은 양을 그대로 해당 양수 면에 더함
 *  - 음수 면 차감은 n3·n2·n1 의 현재 비율을 그대로 유지 (비례 분배)
 *  - 음수 면 0 이하로 떨어지지 않게 가드
 */
function applyProbBoost(probs, lv, shiftPerLv, targetIdx) {
  if (lv <= 0) return probs;

  // 현재 음수 면 합
  let negSum = 0;
  for (const i of NEG_INDICES) negSum += probs[i];
  if (negSum <= 0) return probs;

  // 목표 깎을 양 (음수 합의 shiftPerLv × lv)
  let want = negSum * (shiftPerLv * lv);
  // 음수 합 전체보다 많이 깎을 수는 없으니 클램프
  if (want > negSum) want = negSum;

  // 음수 면들에서 현재 비율 그대로 비례 깎기
  for (const i of NEG_INDICES) {
    const share = probs[i] / negSum; // 음수 내 비율
    let cut = want * share;
    if (cut > probs[i]) cut = probs[i]; // 안전 가드
    probs[i] = Math.max(0, probs[i] - cut);
  }

  // 깎은 양 전체를 해당 양수 면에 더하기
  probs[targetIdx] += want;
  return probs;
}

function getEffectiveProbs(position) {
  const safePos = Math.max(0, Math.min(POSITION_PROB_TABLE.length - 1, position));
  const base = POSITION_PROB_TABLE[safePos];

  // 기본 확률 그대로 시작
  let probs = [base.n3, base.n2, base.n1, base.p1, base.p2, base.p3];

  // v3 #3 — 각 양수 면 업그레이드를 순차 적용
  // (p1 먼저, 그 다음 p2, p3. 순서가 결과에 영향을 주지만 의도된 누적 효과)
  probs = applyProbBoost(probs, state.permLevels.p1_prob, PERM_UPGRADES[0].shiftPerLv, 3);
  probs = applyProbBoost(probs, state.permLevels.p2_prob, PERM_UPGRADES[1].shiftPerLv, 4);
  probs = applyProbBoost(probs, state.permLevels.p3_prob, PERM_UPGRADES[2].shiftPerLv, 5);

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

/** v3 #7 — 코인 수집 시 추가 1코인 확률 (coin_extra 업그레이드) */
function extraCoinChance() {
  return Math.min(1, state.permLevels.coin_extra * 0.10);
}

/** 굴림 결과별 코인 스폰 확률 — v3 에선 보드 스폰 업그레이드 없음 (고정값) */
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

    const numLabel = i === GOAL_TILE ? '15 목표' : (i === 0 ? '0 시작' : String(i));
    tile.appendChild(el('div', 'tile-num', numLabel));

    const marks = el('div', 'tile-marks');
    if (state.position === i)     marks.appendChild(makeTokenSVG());
    if (state.holes.has(i))       marks.appendChild(el('div', 'mark-hole'));
    if (state.boardCoins.has(i)) {
      // v3 #1 — 2배 코인 시각 구분
      const coinCls = state.doubleCoins.has(i) ? 'mark-coin coin-x2' : 'mark-coin';
      marks.appendChild(el('div', coinCls));
    }
    tile.appendChild(marks);

    board.appendChild(tile);
  }
}

// ============================================================
// 렌더 — 위치별 6면 확률 도면 (v3 #6 — 카드형 큰 폰트)
// ============================================================
function renderDicePattern() {
  const wrap = $('dice-pattern');
  wrap.innerHTML = '';
  const probs = getEffectiveProbs(state.position);

  // 가로 3 × 세로 2 카드 배치: 위 row = +3, +2, +1 / 아래 row = -1, -2, -3
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
  for (const u of PERM_UPGRADES) {
    // v3 #9 — 잠금된 업그레이드는 DOM 에 아예 추가 안 함
    const unlocked = u.unlock(state);
    const lv = state.permLevels[u.id];
    const isMax = lv >= u.maxLv;
    if (!unlocked && !isMax) continue;
    permList.appendChild(makePermShopItem(u));
  }

  const tempList = $('shop-temp');
  tempList.innerHTML = '';
  for (const u of TEMP_UPGRADES) tempList.appendChild(makeTempShopItem(u));

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
    // v3 — 살 수 있을 때만 hover 사운드
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
}

async function rollDice(isFromReroll) {
  if (state.isAnimating) return;
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
    const idx = Math.floor(Math.random() * 6);
    face.textContent = fmtVal(FACE_IDX_TO_VAL[idx]);
    face.classList.toggle('face-neg', FACE_IDX_TO_VAL[idx] < 0);
  }, 70);
  await sleep(400);
  clearInterval(tumbleTimer);

  const idx = rollFaceIdx(state.position);
  state.lastRollIdx = idx;
  const val = FACE_IDX_TO_VAL[idx];

  face.classList.remove('rolling');
  face.classList.remove('result-pop');
  void face.offsetWidth;
  face.textContent = fmtVal(val);
  face.classList.toggle('face-neg', val < 0);
  face.classList.add('result-pop');

  $('roll-readout').innerHTML = '결과: <strong>' + fmtVal(val) + '</strong>';
  $('roll-readout').classList.toggle('neg', val < 0);
  state.rolls += 1;
  logEvent('굴림 #' + state.rolls + ' → ' + fmtVal(val), val < 0 ? 'bad' : 'good');

  await sleep(500);

  try {
    await applyMovement(val);
  } finally {
    state.isAnimating = false;
    state.canReroll = !isFromReroll && state.rerollLeft > 0;
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
// 이동 + 함정 생성 + 함정 도착 + 코인 수집·스폰
// ============================================================
async function applyMovement(val) {
  const startPos = state.position;
  let endPos = startPos + val;
  if (endPos < 0) endPos = 0;
  if (endPos > GOAL_TILE) endPos = GOAL_TILE;

  const passed = [];
  if (val > 0) {
    for (let p = startPos + 1; p < endPos; p++) passed.push(p);
  }

  if (val === 2 || val === 3) {
    const chance = effectiveTrapChance(val);
    for (const t of passed) {
      if (t <= 0 || t >= GOAL_TILE) continue;
      if (state.holes.has(t)) continue;
      if (Math.random() < chance) {
        state.holes.add(t);
        state.boardCoins.delete(t);
        state.doubleCoins.delete(t);
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
      renderBoard();
      play('move'); // v3 — 칸 이동 사운드
      await sleep(200);
    }
  } else {
    renderBoard();
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
      logEvent('💥 함정! 0번으로 리셋 (보유 코인·영구 업그레이드 유지)', 'bad');
      showToast('함정!<br><span style="font-size:18px">0번으로 리셋</span>', 'bad', 1400);
      play('reset'); // v3 — 함정 리셋 사운드
      await sleep(900);
      resetAfterTrap();
      return;
    }
  }

  // 3) 도착 칸 코인 수집 (v3 — 2배 칸 + coin_extra 효과 합산)
  if (state.boardCoins.has(state.position)) {
    const isDouble = state.doubleCoins.has(state.position);
    state.boardCoins.delete(state.position);
    state.doubleCoins.delete(state.position);

    // 기본: 1코인. 2배 칸이면 +1 (= 2코인). coin_extra 발동 시 +1 추가.
    let gained = 1;
    if (isDouble) gained += 1;
    if (Math.random() < extraCoinChance()) gained += 1;

    state.coins += gained;
    play('coinRemove'); // v3 — 코인 획득 사운드

    let msg = '🪙 코인 +' + gained;
    const tags = [];
    if (isDouble) tags.push('2배 칸');
    if (gained > (isDouble ? 2 : 1)) tags.push('추가 획득');
    if (tags.length) msg += ' (' + tags.join(' + ') + ')';
    msg += ' — 보유 ' + state.coins;
    logEvent(msg, 'good');
    renderCoin();
  }

  // 4) 굴림 결과에 따른 코인 스폰 (v3 #1 — 10% 확률로 2배 칸)
  trySpawnCoinAhead(val);

  renderBoard();
  renderDicePattern();
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

  // v3 #1 — 10% 확률로 이 코인을 2배 칸으로 지정
  let isDouble = false;
  if (Math.random() < DOUBLE_COIN_CHANCE) {
    state.doubleCoins.add(pick);
    isDouble = true;
  }
  play('coinAdd'); // v3 — 코인 스폰 사운드
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
  play('upgradeClick'); // v3 — 업그레이드 구매 사운드
  logEvent('🛒 「' + u.name + '」 Lv' + (lv + 1) + ' 구매 (-' + cost + ')', 'good');
  renderAll();
}

function buyTemp(u) {
  if (state.isAnimating) return;
  if (state.coins < u.cost) return;

  state.coins -= u.cost;
  if (u.id === 'ignoreTrap') state.ignoreTrap += 1;
  if (u.id === 'reroll')     state.rerollLeft += 1;
  play('upgradeClick');
  logEvent('🛒 「' + u.name + '」 +1 (-' + u.cost + ')', 'good');
  renderAll();
}

// v3 #2 — 개발자 +10코인 (디버그)
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
