'use strict';

/* ============================================================
   뮤노폴리 (Mewnopoly) — 1차 데모 게임 로직
   기획안(영문 GPT 프롬프트) 기준. 규칙은 본 파일 최상단 상수에 그대로.
   ============================================================ */

// ============================================================
// 상수 (기획안 그대로 옮긴 숫자들)
// ============================================================
const TOTAL_TILES = 16;       // 0번 ~ 15번
const GOAL_TILE   = 15;       // 목표 도달 칸
const MAX_COINS_ON_BOARD = 4; // 동시에 보드 위 코인 최대 4개
const DEFAULT_FACE_VALS  = [-3, -2, -1, 1, 2, 3]; // 주사위 6면 기본값 (인덱스 0~5)

const COIN_SPAWN_BY_ROLL = {
  '-3': 1.00, '-2': 0.70, '-1': 0.45,
   '1': 0.20,  '2': 0.12,  '3': 0.08,
};

const HOLE_CHANCE_PLUS_2 = 0.18; // +2 굴림 시 지나친 1칸이 함정 될 확률
const HOLE_CHANCE_PLUS_3 = 0.28; // +3 굴림 시 지나친 각 칸마다 함정 될 확률
const GREEDY_HOLE_MULTIPLIER = 1.60; // 탐욕 업그레이드 시 함정 확률 +60%

// 업그레이드 카탈로그 8종 (COMMON 4 + RARE 3 + LEGENDARY 1)
const UPGRADE_CATALOG = [
  { id: 'c1_boost',       tier: 'common',    cost: 3, name: '면 강화',
    desc: '선택한 면의 숫자를 +1 (예: +2 → +3, -3 → -2)',
    selectFace: 'all', perFaceOnce: true },
  { id: 'c2_neg_relief',  tier: 'common',    cost: 3, name: '음수 완화',
    desc: '선택한 음수 면의 절댓값을 -1 (예: -3 → -2)',
    selectFace: 'neg', perFaceOnce: true },
  { id: 'c3_prob',        tier: 'common',    cost: 3, name: '확률 강화',
    desc: '선택한 면의 등장 확률을 +15%p (다른 면은 비례 차감)',
    selectFace: 'all', perFaceOnce: true },
  { id: 'c4_radar',       tier: 'common',    cost: 3, name: '코인 레이더',
    desc: '내 위치 +1~+3칸 범위 안의 코인을 보드에 강조 표시',
    single: true },
  { id: 'r1_reroll',      tier: 'rare',      cost: 5, name: '리롤',
    desc: '판당 굴림 다시 굴리기 2회 (0→15 한 사이클마다 충전)',
    single: true },
  { id: 'r2_insurance',   tier: 'rare',      cost: 5, name: '안전벨트',
    desc: '함정 1회 무시. 다 쓰면 다시 충전 구매 가능',
    rebuyable: true },
  { id: 'r3_greedy',      tier: 'rare',      cost: 5, name: '탐욕',
    desc: '+3 면 확률 2배. 단 함정 생성 확률 ×1.6 으로 위험',
    single: true },
  { id: 'l1_remove',      tier: 'legendary', cost: 7, name: '면 영구 제거',
    desc: '선택한 면을 주사위에서 영구 삭제 (최소 1면은 남겨야 함)',
    selectFace: 'remaining', perFaceOnce: true },
];

// ============================================================
// 상태 (게임 진행 중 바뀌는 모든 값)
// ============================================================
const state = {
  position: 0,                                // 현재 칸 (0~15)
  holes: new Set(),                           // 함정 칸 번호들 (영구)
  coins: new Set(),                           // 코인 놓인 칸 번호들
  coinCount: 0,                               // 내 코인 보유 수
  faceVals: DEFAULT_FACE_VALS.slice(),        // 주사위 6면 실제 값
  faceProbs: [1/6, 1/6, 1/6, 1/6, 1/6, 1/6], // 면별 등장 확률 (합 1)
  faceRemoved: [false, false, false, false, false, false], // 제거된 면
  ownedSingle: new Set(),                     // 1회 구매형 보유 ID들
  ownedFaceMap: {},                           // 면 선택형 — id → Set<faceIdx>
  insuranceLeft: 0,                           // 안전벨트 남은 횟수
  rerollsLeft: 0,                             // 이번 판 리롤 남은 횟수
  hasReroll: false,
  hasGreedy: false,
  hasRadar:  false,
  isAnimating: false,
  rolls: 0,                                   // 총 굴림 수
  wins:  0,                                   // 클리어 횟수
  lastRollIdx: null,
};

// ============================================================
// 짧은 도우미들
// ============================================================
function $(id) { return document.getElementById(id); }

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fmtFace(idx) {
  const v = state.faceVals[idx];
  return v > 0 ? '+' + v : String(v);
}

function logEvent(msg, kind) {
  const log = $('event-log');
  const p = el('p', kind ? 'ev-' + kind : '', msg);
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
  while (log.children.length > 40) log.removeChild(log.firstChild);
}

function showToast(html, kind, ms) {
  const t = $('toast');
  t.className = 'toast' + (kind === 'bad' ? ' toast-bad' : '');
  t.innerHTML = html;
  t.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.add('hidden'), ms || 1500);
}

// ============================================================
// 확률 처리
// ============================================================
function normalizeProbs() {
  for (let i = 0; i < 6; i++) if (state.faceRemoved[i]) state.faceProbs[i] = 0;
  const sum = state.faceProbs.reduce((a, b) => a + b, 0);
  if (sum <= 0) return;
  for (let i = 0; i < 6; i++) state.faceProbs[i] /= sum;
}

function effectiveProbs() {
  // 탐욕(R3) 보유 시: +3 면(인덱스 5) 확률 2배 → 재정규화
  const probs = state.faceProbs.slice();
  if (state.hasGreedy) probs[5] *= 2;
  for (let i = 0; i < 6; i++) if (state.faceRemoved[i]) probs[i] = 0;
  const sum = probs.reduce((a, b) => a + b, 0);
  if (sum > 0) for (let i = 0; i < 6; i++) probs[i] /= sum;
  return probs;
}

function rollFaceIdx() {
  const probs = effectiveProbs();
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < 6; i++) {
    acc += probs[i];
    if (r <= acc) return i;
  }
  // 부동소수점 잔량 대비
  for (let i = 5; i >= 0; i--) if (probs[i] > 0) return i;
  return 0;
}

// ============================================================
// 렌더 — 보드
// ============================================================
function makeTokenSVG() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('class', 'token');
  svg.innerHTML = `
    <ellipse cx="16" cy="7.5" rx="4.5" ry="4.5" fill="#f5c87a" stroke="#5a3818" stroke-width="1.5"/>
    <path d="M11.5 12.5 L20.5 12.5 L19 15 L13 15 Z" fill="#f5c87a" stroke="#5a3818" stroke-width="1.5"/>
    <path d="M9 22 Q9 15 16 15 Q23 15 23 22 Z" fill="#f5c87a" stroke="#5a3818" stroke-width="1.5"/>
    <rect x="6.5" y="22" width="19" height="3.5" rx="1.2" fill="#d49620" stroke="#5a3818" stroke-width="1.4"/>
    <rect x="4.5" y="25.5" width="23" height="3" rx="1.2" fill="#a06400" stroke="#5a3818" stroke-width="1.4"/>
  `;
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

    // 코인 레이더 강조: 내 위치 +1~+3 안의 코인 칸
    if (state.hasRadar && i > state.position && i <= state.position + 3 && state.coins.has(i)) {
      tile.classList.add('tile-radar');
    }

    const numLabel = i === GOAL_TILE ? '15 🏁' : (i === 0 ? '0 시작' : String(i));
    tile.appendChild(el('div', 'tile-num', numLabel));

    const marks = el('div', 'tile-marks');
    if (state.position === i) marks.appendChild(makeTokenSVG());
    if (state.holes.has(i))   marks.appendChild(el('div', 'mark-hole'));
    if (state.coins.has(i))   marks.appendChild(el('div', 'mark-coin'));
    tile.appendChild(marks);

    board.appendChild(tile);
  }
  $('legend-radar').classList.toggle('hidden', !state.hasRadar);
}

// ============================================================
// 렌더 — 주사위 6면 도안
// ============================================================
function renderDicePattern() {
  const wrap = $('dice-pattern');
  wrap.innerHTML = '';
  const probs = effectiveProbs();
  for (let i = 0; i < 6; i++) {
    const card = el('div', 'dice-face-card');
    if (state.faceVals[i] > 0) card.classList.add('face-pos');
    else if (state.faceVals[i] < 0) card.classList.add('face-neg');
    if (state.faceRemoved[i]) card.classList.add('face-removed');

    card.appendChild(el('div', 'dice-face-val', fmtFace(i)));
    const probTxt = state.faceRemoved[i] ? '제거' : (probs[i] * 100).toFixed(1) + '%';
    card.appendChild(el('div', 'dice-face-prob', probTxt));
    wrap.appendChild(card);
  }
}

// ============================================================
// 렌더 — 코인 + 상점 + 보유 업그레이드
// ============================================================
function renderCoin() {
  $('coin-count').textContent = String(state.coinCount);
}

function renderShop() {
  for (const tier of ['common', 'rare', 'legendary']) {
    const list = $('shop-' + tier);
    list.innerHTML = '';
    for (const u of UPGRADE_CATALOG.filter(x => x.tier === tier)) {
      list.appendChild(makeShopItem(u));
    }
  }
  renderOwned();
}

function makeShopItem(u) {
  const item = el('div', 'shop-item');

  const head = el('div', 'shop-item-head');
  head.appendChild(el('div', 'shop-item-name', u.name));
  head.appendChild(el('div', 'shop-item-cost', u.cost + ' 코인'));
  item.appendChild(head);

  item.appendChild(el('div', 'shop-item-desc', u.desc));

  const btnRow = el('div', 'shop-item-buttons');

  if (u.single) {
    if (state.ownedSingle.has(u.id)) {
      item.classList.add('owned-permanent');
      btnRow.appendChild(el('span', 'owned-tag', '보유 중'));
    } else {
      const buy = el('button', 'buy-btn', '구매 (' + u.cost + ')');
      buy.disabled = state.coinCount < u.cost;
      buy.onclick = () => buyUpgrade(u, null);
      btnRow.appendChild(buy);
    }
  } else if (u.rebuyable && u.id === 'r2_insurance') {
    btnRow.appendChild(el('span', 'owned-tag', '충전: ' + state.insuranceLeft + ' 회'));
    const buy = el('button', 'buy-btn', '+1 충전 (' + u.cost + ')');
    buy.disabled = state.coinCount < u.cost;
    buy.onclick = () => buyUpgrade(u, null);
    btnRow.appendChild(buy);
  } else if (u.selectFace) {
    const owned = state.ownedFaceMap[u.id] || new Set();
    const canBuy = state.coinCount >= u.cost;
    const aliveCount = state.faceRemoved.filter(r => !r).length;

    for (let i = 0; i < 6; i++) {
      const isNeg = state.faceVals[i] < 0;
      if (u.selectFace === 'neg' && !isNeg) continue;

      const btn = el('button', 'face-select-btn' + (isNeg ? ' face-neg-btn' : ''), fmtFace(i));
      const alreadyHas = owned.has(i);
      const removed = state.faceRemoved[i];
      let disabled = !canBuy || alreadyHas;
      if (u.selectFace === 'remaining' && removed) disabled = true;
      if (u.id === 'l1_remove' && aliveCount <= 1 && !removed) disabled = true;
      btn.disabled = disabled;
      if (alreadyHas) btn.innerHTML = fmtFace(i) + ' ✓';
      btn.onclick = () => buyUpgrade(u, i);
      btnRow.appendChild(btn);
    }
  }

  item.appendChild(btnRow);
  return item;
}

function renderOwned() {
  const list = $('owned-list');
  list.innerHTML = '';
  const chips = [];

  for (const id of state.ownedSingle) {
    const u = UPGRADE_CATALOG.find(x => x.id === id);
    if (u) chips.push(u.name);
  }
  if (state.insuranceLeft > 0) chips.push('🛡 안전벨트 ×' + state.insuranceLeft);
  if (state.hasReroll) chips.push('🔄 리롤 (' + state.rerollsLeft + '/2 이번 판)');

  for (const id in state.ownedFaceMap) {
    const u = UPGRADE_CATALOG.find(x => x.id === id);
    const faces = [...state.ownedFaceMap[id]].map(fmtFace).join(', ');
    if (u) chips.push(u.name + ': ' + faces);
  }

  if (chips.length === 0) {
    list.appendChild(el('span', 'owned-empty', '아직 없음'));
  } else {
    for (const c of chips) list.appendChild(el('span', 'owned-chip', c));
  }
}

function renderAll() {
  renderBoard();
  renderDicePattern();
  renderCoin();
  renderShop();

  const reroll = $('btn-reroll');
  reroll.classList.toggle('hidden', !state.hasReroll);
  if (state.hasReroll) {
    reroll.textContent = '리롤 (' + state.rerollsLeft + ')';
    reroll.disabled = state.rerollsLeft <= 0 || state.lastRollIdx === null || state.isAnimating;
  }
}

// ============================================================
// 화면 크기 맞추기 — 1920x1080 디자인 기준, 화면이 작으면 축소
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
// 굴리기 → 결과 → 이동
// ============================================================
async function rollDice() {
  if (state.isAnimating) return;
  state.isAnimating = true;
  $('btn-roll').disabled = true;
  $('btn-reroll').disabled = true;

  const face = $('dice-face');
  face.classList.remove('dice-face-ready', 'result-pop', 'face-neg');
  face.classList.add('rolling');
  $('roll-readout').classList.remove('neg');
  $('roll-readout').innerHTML = '굴리는 중...';

  // 굴리는 동안 임시 면 빠르게 교체 (눈으로 굴림이 보이게)
  const tumbleTimer = setInterval(() => {
    const idx = Math.floor(Math.random() * 6);
    face.textContent = fmtFace(idx);
    if (state.faceVals[idx] < 0) face.classList.add('face-neg');
    else                          face.classList.remove('face-neg');
  }, 80);
  await sleep(900);
  clearInterval(tumbleTimer);

  // 실제 결과 추출
  const idx = rollFaceIdx();
  state.lastRollIdx = idx;
  const val = state.faceVals[idx];

  face.classList.remove('rolling');
  face.textContent = (val > 0 ? '+' : '') + val;
  face.classList.toggle('face-neg', val < 0);
  face.classList.add('result-pop');

  $('roll-readout').innerHTML = '결과: <strong>' + (val > 0 ? '+' : '') + val + '</strong>';
  $('roll-readout').classList.toggle('neg', val < 0);
  logEvent('굴림 #' + (++state.rolls) + ' → ' + (val > 0 ? '+' : '') + val);

  // 결과 보고 한 박자 쉰 뒤 이동 (가시성 설계: 굴림 → 결과 → 이동)
  await sleep(600);

  await applyMovement(val);

  state.isAnimating = false;
  $('btn-roll').disabled = false;
  if (state.hasReroll) {
    $('btn-reroll').disabled = state.rerollsLeft <= 0 || state.lastRollIdx === null;
    $('btn-reroll').textContent = '리롤 (' + state.rerollsLeft + ')';
  }
  renderShop();
  renderOwned();
}

async function useReroll() {
  if (!state.hasReroll || state.rerollsLeft <= 0 || state.isAnimating) return;
  state.rerollsLeft -= 1;
  logEvent('🔄 리롤 사용 (남은 ' + state.rerollsLeft + '회)', 'mid');
  await rollDice();
}

// ============================================================
// 이동·홀·코인 처리
// ============================================================
async function applyMovement(rolled) {
  const startPos = state.position;
  let target = startPos + rolled;
  if (target < 0) target = 0;
  if (target > GOAL_TILE) target = GOAL_TILE;

  // 지나친 칸들 (출발 다음 ~ 도착 직전) — +2/+3 만 사용
  const crossed = [];
  if (rolled > 1) {
    for (let p = startPos + 1; p < startPos + rolled; p++) {
      if (p >= 0 && p < GOAL_TILE) crossed.push(p);
    }
  }

  // 한 칸씩 이동 시각화 (가시성 설계: 토템 보드에서 한 칸씩 이동)
  if (rolled !== 0) {
    const step = rolled > 0 ? 1 : -1;
    const steps = Math.abs(target - startPos);
    let cur = startPos;
    for (let s = 0; s < steps; s++) {
      cur += step;
      state.position = cur;
      renderBoard();
      await sleep(220);
    }
  }

  // 홀 생성 (양의 +2/+3 굴림 시만, crossed 칸들에 확률로)
  if (rolled === 2 || rolled === 3) {
    const baseChance = rolled === 2 ? HOLE_CHANCE_PLUS_2 : HOLE_CHANCE_PLUS_3;
    const chance = state.hasGreedy ? baseChance * GREEDY_HOLE_MULTIPLIER : baseChance;
    for (const t of crossed) {
      if (t <= 0 || t >= GOAL_TILE) continue;
      if (state.holes.has(t)) continue;
      if (Math.random() < chance) {
        state.holes.add(t);
        // 코인이 있던 칸이 함정이 되면 코인 제거
        if (state.coins.has(t)) state.coins.delete(t);
        logEvent('☠ ' + t + '칸에 함정 생성', 'bad');
      }
    }
  }

  renderBoard();

  // 1) 승리 체크 (목표 도달)
  if (state.position >= GOAL_TILE) {
    state.wins += 1;
    logEvent('🏁 목표 도달! (' + state.wins + '번째 클리어)', 'good');
    showToast('🏁 목표 도달!<br><span style="font-size:18px">' + state.wins + '번째 클리어</span>', null, 1700);
    await sleep(1500);
    // 새 사이클 시작: 0번 칸으로 (홀·코인·보유 업그레이드·코인 보유는 유지)
    state.position = 0;
    if (state.hasReroll) state.rerollsLeft = 2;
    renderBoard();
    return;
  }

  // 2) 함정 체크 (도착 칸이 함정인지)
  if (state.holes.has(state.position)) {
    if (state.insuranceLeft > 0) {
      state.insuranceLeft -= 1;
      logEvent('🛡 안전벨트 발동 — 함정 무시', 'good');
      showToast('🛡 안전벨트<br><span style="font-size:18px">함정 1회 무시</span>', null, 1300);
    } else {
      logEvent('💥 함정! 0번 칸으로 리셋', 'bad');
      showToast('💥 함정!<br><span style="font-size:18px">0번으로 리셋</span>', 'bad', 1400);
      await sleep(900);
      state.position = 0;
      if (state.hasReroll) state.rerollsLeft = 2;
      renderBoard();
      return;
    }
  }

  // 3) 코인 수집 (도착 칸에 코인 있을 때)
  if (state.coins.has(state.position)) {
    state.coins.delete(state.position);
    state.coinCount += 1;
    logEvent('🪙 코인 +1 (보유 ' + state.coinCount + ')', 'good');
    renderCoin();
  }

  // 4) 코인 스폰 (굴린 결과에 따른 확률)
  trySpawnCoinAhead(rolled);

  renderBoard();
}

function trySpawnCoinAhead(rolled) {
  const chance = COIN_SPAWN_BY_ROLL[String(rolled)];
  if (chance == null) return;
  if (Math.random() >= chance) return;
  if (state.coins.size >= MAX_COINS_ON_BOARD) return;

  // 내 현재 위치 +1~+3 칸 중 유효한 칸 (보드 밖·이미 코인·함정·목표칸 제외)
  const candidates = [];
  for (let d = 1; d <= 3; d++) {
    const t = state.position + d;
    if (t > GOAL_TILE - 1) break;     // 목표칸엔 안 둠
    if (state.coins.has(t)) continue;
    if (state.holes.has(t)) continue;
    candidates.push(t);
  }
  if (candidates.length === 0) return;

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  state.coins.add(pick);
  logEvent('✨ ' + pick + '칸에 코인 등장', 'mid');
}

// ============================================================
// 업그레이드 구매 + 효과 적용
// ============================================================
function buyUpgrade(u, faceIdx) {
  if (state.coinCount < u.cost) return;

  if (u.single) {
    if (state.ownedSingle.has(u.id)) return;
    state.coinCount -= u.cost;
    state.ownedSingle.add(u.id);
    applySingleEffect(u);
    logEvent('🛒 「' + u.name + '」 구매 (-' + u.cost + ')', 'good');
  } else if (u.rebuyable && u.id === 'r2_insurance') {
    state.coinCount -= u.cost;
    state.insuranceLeft += 1;
    logEvent('🛒 「' + u.name + '」 +1 충전 (총 ' + state.insuranceLeft + ', -' + u.cost + ')', 'good');
  } else if (u.selectFace) {
    if (faceIdx == null) return;
    const set = state.ownedFaceMap[u.id] || (state.ownedFaceMap[u.id] = new Set());
    if (set.has(faceIdx)) return;
    if (u.selectFace === 'neg' && state.faceVals[faceIdx] >= 0) return;
    if (u.selectFace === 'remaining' && state.faceRemoved[faceIdx]) return;
    if (u.id === 'l1_remove') {
      const alive = state.faceRemoved.filter(r => !r).length;
      if (alive <= 1) return;
    }

    state.coinCount -= u.cost;
    set.add(faceIdx);
    applyFaceEffect(u, faceIdx);
    logEvent('🛒 「' + u.name + ' / ' + fmtFace(faceIdx) + '」 구매 (-' + u.cost + ')', 'good');
  }

  renderAll();
}

function applySingleEffect(u) {
  if (u.id === 'c4_radar')   state.hasRadar  = true;
  if (u.id === 'r1_reroll') { state.hasReroll = true; state.rerollsLeft = 2; }
  if (u.id === 'r3_greedy')  state.hasGreedy = true;
}

function applyFaceEffect(u, idx) {
  if (u.id === 'c1_boost')        state.faceVals[idx] += 1;
  else if (u.id === 'c2_neg_relief') state.faceVals[idx] += 1; // -3 → -2 (절댓값 -1)
  else if (u.id === 'c3_prob') {
    state.faceProbs[idx] += 0.15;
    normalizeProbs();
  } else if (u.id === 'l1_remove') {
    state.faceRemoved[idx] = true;
    state.faceProbs[idx] = 0;
    normalizeProbs();
  }
}

// ============================================================
// 시작점
// ============================================================
function init() {
  $('btn-roll').addEventListener('click', rollDice);
  $('btn-reroll').addEventListener('click', useReroll);
  window.addEventListener('resize', fitScreen);

  fitScreen();
  renderAll();
  logEvent('게임 시작 — 「주사위 굴리기」 를 눌러 첫 굴림.', 'mid');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
