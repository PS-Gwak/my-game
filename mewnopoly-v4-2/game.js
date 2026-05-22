'use strict';

/* ============================================================
   뮤노폴리 v4.2 — Probability Climb
   v4.1 베이스 + 큰 변화 8가지:
     #1 도달 보상 재조정 (3:1 / 5:2 / 8:5 / 10:10 / 12:20) + 알림창 제거
     #2 세이브 포인트 = 7번 단 하나 (도달 보상 없는 칸)
     #3 +1/+2/+3 새 공식 (basePositive 비례) + maxLv 10→7
     #4 두 번 굴리기 (double_roll) 완전 제거
     #5 함정 base v3 롤백 (+2:0.18, +3:0.28)
     #6 9-2 인라인 선택 패널 완전 제거
     #7 게임 클리어(15 도달) 시 보드 리셋 (함정·코인·세이브 등 함정 빠질 때와 동일)
     #8 리롤 시스템 강화 (한도 2개 / 일반 굴림 3회당 1개 살 권한)
   v3/v4 변경은 그대로 유지:
     칸별 자동 성장 / 일회성 5번 칸 해금 / 최고 기록 표시 /
     코인 2배 칸 / 5줄 메시지 고정 / 잠금 업그레이드 DOM 숨김 등.
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

// v4.2 #1 — 도달 보상 재조정. 키 = 칸 번호, 값 = 코인 보상. 처음 1회만.
const TILE_REWARDS = { 3: 1, 5: 2, 8: 5, 10: 10, 12: 20 };
// v4.2 #2 — 세이브 포인트 = 7번 한 곳 (도달 보상 없는 칸)
const SAVE_TILES = [7];

// v4 #3 — 칸별 30회 방문마다 1단계 (단계 × 0.1)만큼 음수→양수 이동.
const TILE_GROWTH_STEP_VISITS = 30;
const TILE_GROWTH_RATIO_PER_STEP = 0.1;

// v4 #6 — 일회성 업그레이드 해금되는 위치
const TEMP_UNLOCK_TILE = 5;

// v4.2 #8 — 리롤 시스템
const REROLL_COST = 5;
const REROLL_MAX_HELD = 2;
const REROLL_ROLLS_PER_GRANT = 3; // 일반 굴림 3회당 1개 살 권한

/* ------------------------------------------------------------
   영구 업그레이드
   v4.2 #3 — +1/+2/+3 새 공식:
     gain = (basePositive + 0.02) × (rate × Lv)
     rate: p1=0.15 / p2=0.18 / p3=0.21
     basePositive = POSITION_PROB_TABLE[pos][faceKey]
     양수 면에만 +gain 더하고 음수 면은 안 건드림 (이후 normalize)
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
    desc: '+1 면에만 (basePositive+0.02)×(0.15×Lv) 만큼 더한다. 음수 면은 안 건드림 (이후 전체 정규화).',
    rate: 0.15,
    targetIdx: 3,
    cost: (lv) => priceFromTable(PRICE_TABLE_P1, lv),
    maxLv: 7,
    unlock: (s) => true,
    lockMsg: '',
  },
  {
    id: 'p2_prob', name: '+2 확률 강화',
    desc: '+2 면에만 (basePositive+0.02)×(0.18×Lv) 만큼 더한다. 두 칸씩 가지만 함정 위험도 동반.',
    rate: 0.18,
    targetIdx: 4,
    cost: (lv) => priceFromTable(PRICE_TABLE_P2, lv),
    maxLv: 7,
    unlock: (s) => s.permLevels.p1_prob >= 4,
    lockMsg: '잠금: +1 확률 Lv4 필요',
  },
  {
    id: 'p3_prob', name: '+3 확률 강화',
    desc: '+3 면에만 (basePositive+0.02)×(0.21×Lv) 만큼 더한다. 한방 3칸 점프 + 함정 위험 최대.',
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

const TEMP_UPGRADES = [
  { id: 'ignoreTrap', name: '함정 무시 1회', cost: 5,
    desc: '다음 함정 도착 1회 무효화. 리셋 시 사라짐.' },
  { id: 'reroll',     name: '리롤 1회',       cost: REROLL_COST,
    desc: '직전 굴림을 무효화하고 다시 굴림. 한도 2개. 일반 굴림 3회당 1개 살 권한.' },
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
  tempUnlocked: false,                    // #6 — 일회성 업그레이드 영구 해금

  // v4.2 #8 — 리롤 살 권한 카운터 (일반 굴림만 카운트, 리롤 굴림 미포함)
  normalRollCount: 0,
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
  // v4.1 피드백 — 화면 중앙을 가리는 팝업 알림은 전부 끔.
  // 각 상황은 호출부에서 이미 우측 이벤트 로그(logEvent)에 기록한다.
  const t = $('toast');
  if (!t) return;
  clearTimeout(showToast._timer);
  t.innerHTML = '';
  t.className = 'toast hidden';
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

/**
 * v4.2 #3 — 새 +1/+2/+3 부스트 공식.
 * gain = (basePositive + 0.02) × (rate × Lv)
 * basePositive 은 *이번 위치 테이블*의 원래 양수 확률.
 * 양수 면에만 +gain 더하고, 음수 면은 안 건드림.
 * 적용 후 합 100% 초과 가능 → 호출부에서 normalize.
 */
function applyProbBoostV2(probs, lv, rate, targetIdx, baseProbs) {
  if (lv <= 0) return probs;
  const basePositive = baseProbs[targetIdx];
  const gain = (basePositive + 0.02) * (rate * lv);
  if (gain <= 0) return probs;
  probs[targetIdx] += gain;
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

  let want = negSum * ratio;
  if (want > negSum) want = negSum;

  for (const i of NEG_INDICES) {
    const share = probs[i] / negSum;
    let cut = want * share;
    if (cut > probs[i]) cut = probs[i];
    probs[i] = Math.max(0, probs[i] - cut);
  }

  let posSum = 0;
  for (const i of POS_INDICES) posSum += probs[i];
  if (posSum > 0) {
    for (const i of POS_INDICES) {
      const share = probs[i] / posSum;
      probs[i] += want * share;
    }
  } else {
    for (const i of POS_INDICES) probs[i] += want / POS_INDICES.length;
  }

  return probs;
}

function getEffectiveProbs(position) {
  const safePos = Math.max(0, Math.min(POSITION_PROB_TABLE.length - 1, position));
  const base = POSITION_PROB_TABLE[safePos];
  const baseArr = [base.n3, base.n2, base.n1, base.p1, base.p2, base.p3];

  // 적용 순서: 기본 → p1 → p2 → p3 → 칸별 자동 성장 → normalize
  let probs = baseArr.slice();

  probs = applyProbBoostV2(probs, state.permLevels.p1_prob, PERM_UPGRADES[0].rate, 3, baseArr);
  probs = applyProbBoostV2(probs, state.permLevels.p2_prob, PERM_UPGRADES[1].rate, 4, baseArr);
  probs = applyProbBoostV2(probs, state.permLevels.p3_prob, PERM_UPGRADES[2].rate, 5, baseArr);

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

  const tempList = $('shop-temp');
  tempList.innerHTML = '';
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

function makeTempShopItem(u) {
  const item = el('div', 'shop-item');
  const canAfford = state.coins >= u.cost;
  const heldCount = u.id === 'ignoreTrap' ? state.ignoreTrap
                   : u.id === 'reroll'    ? state.rerollLeft
                   : 0;

  // v4.2 #8 — 리롤 카드 특수 처리: 살 권한 + 한도 체크
  let canBuyThis = canAfford;
  let lockReason = '';
  if (u.id === 'reroll') {
    const atLimit = state.rerollLeft >= REROLL_MAX_HELD;
    const hasGrant = state.normalRollCount >= REROLL_ROLLS_PER_GRANT;
    if (atLimit) {
      canBuyThis = false;
      lockReason = '한도 초과';
    } else if (!hasGrant) {
      canBuyThis = false;
      lockReason = '권한 부족';
    }
  }

  if (!canBuyThis) item.classList.add('disabled');

  const head = el('div', 'shop-item-head');
  head.appendChild(el('div', 'shop-item-name', u.name));
  // v4.2 #8 — 리롤은 한도 표시 "보유 N/2", 다른 건 "보유 N개"
  const heldLabel = u.id === 'reroll'
    ? '보유 ' + heldCount + '/' + REROLL_MAX_HELD
    : '보유 ' + heldCount + '개';
  head.appendChild(el('div', 'shop-item-level', heldLabel));
  item.appendChild(head);

  item.appendChild(el('div', 'shop-item-desc', u.desc));

  // v4.2 #8 — 리롤 카드에 진행도 표시
  if (u.id === 'reroll') {
    const cap = Math.min(state.normalRollCount, REROLL_ROLLS_PER_GRANT);
    const progressMsg = state.rerollLeft >= REROLL_MAX_HELD
      ? '한도 가득 — 사용 후 다시 구매 가능 (카운터: ' + state.normalRollCount + ')'
      : '다음 살 권한까지 ' + cap + '/' + REROLL_ROLLS_PER_GRANT + ' 굴림';
    item.appendChild(el('div', 'shop-item-desc shop-item-progress', progressMsg));
  }

  const buyLabel = (u.id === 'reroll' && lockReason)
    ? '구매 (' + u.cost + ') — ' + lockReason
    : '구매 (' + u.cost + ')';
  const buy = el('button', 'buy-btn', buyLabel);
  buy.disabled = !canBuyThis || state.isAnimating;
  buy.onclick = () => buyTemp(u);
  if (canBuyThis && !state.isAnimating) {
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
  if (state.savePoint != null) chips.push('💾 세이브: ' + state.savePoint + '번');

  if (chips.length === 0) {
    list.appendChild(el('span', 'owned-empty', '아직 없음 — 상점에서 구매'));
  } else {
    for (const c of chips) list.appendChild(el('span', 'owned-chip', c));
  }
}

function renderRerollBtn() {
  const reroll = $('btn-reroll');
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
    bestTile: state.bestTile,
    tileVisitCount: state.tileVisitCount.slice(),
    tileRewardClaimed: new Set(state.tileRewardClaimed),
    savePoint: state.savePoint,
    tempUnlocked: state.tempUnlocked,
    normalRollCount: state.normalRollCount, // v4.2 #8 — 리롤 카운터도 스냅샷에 포함
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
  state.bestTile          = snap.bestTile;
  state.tileVisitCount    = snap.tileVisitCount.slice();
  state.tileRewardClaimed = new Set(snap.tileRewardClaimed);
  state.savePoint         = snap.savePoint;
  state.tempUnlocked      = snap.tempUnlocked;
  state.normalRollCount   = snap.normalRollCount;
}

function clampDest(pos) {
  if (pos < 0) return 0;
  if (pos > GOAL_TILE) return GOAL_TILE;
  return pos;
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
  state.rolls += 1;
  logEvent('굴림 #' + state.rolls + ' → ' + fmtVal(val), val < 0 ? 'bad' : 'good');

  await sleep(500);

  try {
    await applyMovement(val);
  } finally {
    state.isAnimating = false;
    state.canReroll = !isFromReroll && state.prevSnapshot != null;
    // v4.2 #8 — 일반 굴림만 normalRollCount 증가. 리롤 굴림은 카운트 안 함.
    // 모호점 #7 답=c: 리롤 한도(2개) 가득 찬 상태면 카운터도 멈춤 (한 칸 비기 시작하면 0부터 다시).
    if (!isFromReroll && state.rerollLeft < REROLL_MAX_HELD) {
      state.normalRollCount += 1;
    }
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
      if (cur > 0 && cur < GOAL_TILE) {
        state.tileVisitCount[cur] = (state.tileVisitCount[cur] || 0) + 1;
      }
      maybeUpdateSavePoint(cur);
      if (cur > state.bestTile) state.bestTile = cur;

      renderBoard();
      renderDicePattern();
      play('move');
      await sleep(200);
    }
  } else {
    if (state.position > 0 && state.position < GOAL_TILE) {
      state.tileVisitCount[state.position] = (state.tileVisitCount[state.position] || 0) + 1;
    }
    if (state.position > state.bestTile) state.bestTile = state.position;
    renderBoard();
    renderDicePattern();
  }

  if (savedAtSavePoint) {
    logEvent('💾 세이브 발동 — ' + endPos + '번 칸에서 멈춤', 'mid');
  }

  // 1) 목표 도달 — v4.2 #7: 함정 빠질 때와 동일한 보드 리셋
  if (state.position >= GOAL_TILE) {
    state.wins += 1;
    logEvent('🏁 목표 도달! (' + state.wins + '번째 클리어)', 'good');
    showToast('목표 도달!<br><span style="font-size:18px">' + state.wins + '번째 클리어</span>', 'good', 1700);
    await sleep(1500);
    // v4.2 #1 답=b — 클리어 시 진척도까지 새 런처럼 초기화 (도달 보상 claimed·tileVisitCount·bestTile 도 0)
    // 단 영구 업그레이드·보유 코인·일회성 5번 해금은 유지
    resetAfterTrap(true);
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

  // 4) v4.2 #1 — 칸 도달 보상 (처음 1회만)
  await handleTileReward(state.position);

  // 5) v4 #6 — 일회성 업그레이드 영구 해금 (5번 도달 시)
  if (state.position >= TEMP_UNLOCK_TILE && !state.tempUnlocked) {
    state.tempUnlocked = true;
    logEvent('🔓 일회성 업그레이드 영구 해금 (5번 칸 도달)', 'good');
    showToast('일회성 업그레이드 해금<br><span style="font-size:18px">상점에 등장</span>', 'good', 1300);
    play('upgradeClick');
  }

  // 6) 굴림 결과에 따른 코인 스폰
  trySpawnCoinAhead(val);

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
    state.coins += reward;
    state.tileRewardClaimed.add(pos);
    play('coinRemove');
    logEvent('🎁 ' + pos + '번 칸 첫 도달 보상 +' + reward + '코인 — 보유 ' + state.coins, 'good');
    renderCoin();
  }
  // 이미 받은 경우: return (#6)
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

/**
 * v4.2 — 보드 리셋. 기본은 함정 시 호출 (얕은 리셋).
 * isClear=true 면 게임 클리어 시 호출 (재현이형 모호점 #1 답=b: 진척도까지 초기화).
 *
 * 공통 초기화:
 *   position=0, holes, boardCoins, doubleCoins, ignoreTrap, rerollLeft, savePoint, normalRollCount
 * 클리어 시 추가 초기화 (#1 답=b):
 *   tileVisitCount (칸별 방문 수), tileRewardClaimed (도달 보상 받은 기록), bestTile (최고 기록)
 * 두 경우 모두 유지:
 *   coins (보유 코인), permLevels (영구 업그레이드), tempUnlocked (일회성 5번 해금)
 */
function resetAfterTrap(isClear) {
  state.position = 0;
  state.holes.clear();
  state.boardCoins.clear();
  state.doubleCoins.clear();
  state.ignoreTrap = 0;
  state.rerollLeft = 0;
  state.lastRollIdx = null;
  state.canReroll = false;
  state.savePoint = null;
  state.normalRollCount = 0;
  if (isClear) {
    // v4.2 #1 답=b: 진척도까지 새 런처럼 초기화
    state.tileVisitCount = new Array(TOTAL_TILES).fill(0);
    state.tileRewardClaimed = new Set();
    state.bestTile = 0;
  }
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

function buyTemp(u) {
  if (state.isAnimating) return;
  if (!state.tempUnlocked) return;
  if (state.coins < u.cost) return;

  // v4.2 #8 — 리롤 구매 분기: 살 권한 + 한도 체크
  if (u.id === 'reroll') {
    if (state.rerollLeft >= REROLL_MAX_HELD) return;
    if (state.normalRollCount < REROLL_ROLLS_PER_GRANT) return;

    state.coins -= u.cost;
    state.normalRollCount -= REROLL_ROLLS_PER_GRANT;
    state.rerollLeft += 1;
    if (state.rerollLeft > REROLL_MAX_HELD) state.rerollLeft = REROLL_MAX_HELD;

    play('upgradeClick');
    logEvent('🛒 「' + u.name + '」 +1 (-' + u.cost + ')', 'good');

    // 굴림이 끝난 뒤라면 prevSnapshot 살아있음 → 리롤 즉시 가능
    if (state.prevSnapshot != null && !state.isAnimating) {
      state.canReroll = true;
    }
    renderAll();
    return;
  }

  // 함정 무시 등 일반 일회성
  state.coins -= u.cost;
  if (u.id === 'ignoreTrap') state.ignoreTrap += 1;
  play('upgradeClick');
  logEvent('🛒 「' + u.name + '」 +1 (-' + u.cost + ')', 'good');
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
