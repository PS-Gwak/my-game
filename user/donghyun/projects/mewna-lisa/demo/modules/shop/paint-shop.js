/* ============================================================
   paint-shop.js — 물감 상점
   ============================================================
   비유: 4종류 물감을 각각 0~4단계로 업그레이드할 수 있는
   '미술 재료 가게'입니다. 단계가 올라갈수록 그림 채도가 진해지고
   모작 등급 보정도 받을 수 있어요.

   가격표 (락-인):
   - 레벨 0→1: $200
   - 레벨 1→2: $500
   - 레벨 2→3: $1,200
   - 레벨 3→4: $3,000

   종류: 수채화·점묘화·유화·그라타주 각각 따로 구입
   조건: 해당 그림 종류가 해금된 후에만 구입 가능

   state.paintLevels[type] += 1 처리는 이 모듈이 직접 수행
   ============================================================ */

(function (global) {
  'use strict';

  // 물감 레벨업 가격표 (현재 레벨 → 다음 레벨 비용)
  // 인덱스 = 현재 레벨 (0~3)
  const PAINT_PRICES = [200, 500, 1200, 3000];

  // 물감 종류 라벨
  const TYPE_LABELS = {
    watercolor:  '수채화 물감',
    pointillism: '점묘화 물감',
    oilpainting: '유화 물감',
    gratage:     '그라타주 도구',
  };

  // 현재 레벨 → 다음 레벨 구입 비용 반환
  // 레벨 4 이면 -1 (최고 단계, 더 이상 구입 불가)
  function getPaintUpgradeCost(currentLevel) {
    if (currentLevel >= 4) return -1;
    return PAINT_PRICES[currentLevel] || -1;
  }

  // ── 물감 상점 UI 렌더
  // container  : 화면을 그려 넣을 DOM 요소
  // state      : 현재 게임 상태
  // callbacks  :
  //   onBuy(type)    → 구입 성공 시 (state 갱신은 이 모듈이 직접)
  //   onBack()       → 뒤로가기 버튼
  function renderPaintShop(container, state, callbacks) {
    if (!container) return;

    const money = state.money || 0;
    const paintLevels = state.paintLevels || {};
    const unlockedTypes = state.unlockedTypes || {};

    const rows = ['watercolor', 'pointillism', 'oilpainting', 'gratage'].map(type => {
      const isUnlocked = !!unlockedTypes[type];
      const lvl  = paintLevels[type] || 0;
      const cost = getPaintUpgradeCost(lvl);
      const canBuy = isUnlocked && cost > 0 && money >= cost;

      if (!isUnlocked) {
        return `
          <div class="pshop-item pshop-item-locked">
            <div class="pshop-item-info">
              <div class="pshop-item-name">${TYPE_LABELS[type]}</div>
              <div class="pshop-item-desc">해당 그림 종류 해금 후 구입 가능해요</div>
            </div>
            <div class="pshop-locked-badge">잠김</div>
          </div>
        `;
      }

      if (lvl >= 4) {
        return `
          <div class="pshop-item">
            <div class="pshop-item-info">
              <div class="pshop-item-name">${TYPE_LABELS[type]}</div>
              <div class="pshop-item-desc">현재 ${lvl}단계 — 최고 단계 달성!</div>
            </div>
            <div class="pshop-maxed">최고 단계!</div>
          </div>
        `;
      }

      return `
        <div class="pshop-item">
          <div class="pshop-item-info">
            <div class="pshop-item-name">${TYPE_LABELS[type]}</div>
            <div class="pshop-item-desc">현재 ${lvl}단계 → ${lvl + 1}단계</div>
            <div class="pshop-item-effect">채도 진해짐 + 등급 보정 향상</div>
          </div>
          <button
            class="pshop-buy-btn ${canBuy ? '' : 'pshop-disabled'}"
            data-paint-type="${type}"
            ${canBuy ? '' : 'disabled'}>
            $${cost.toLocaleString('en-US')} 구입
          </button>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="pshop-wrap">
        <div class="pshop-header">
          <div class="pshop-title">물감 상점</div>
          <div class="pshop-money">보유 자금: <strong>$${money.toLocaleString('en-US')}</strong></div>
        </div>
        <div class="pshop-list">${rows}</div>
      </div>
    `;

    // 구입 버튼 이벤트
    container.querySelectorAll('[data-paint-type]').forEach(btn => {
      btn.onclick = () => {
        const type = btn.getAttribute('data-paint-type');
        const lvl  = state.paintLevels[type] || 0;
        const cost = getPaintUpgradeCost(lvl);
        if (cost < 0 || state.money < cost) return;

        // 자금 차감 + 레벨업
        state.money -= cost;
        state.paintLevels[type] = lvl + 1;

        callbacks && callbacks.onBuy && callbacks.onBuy(type);
      };
    });
  }

  global.MN9_PaintShop = {
    renderPaintShop,
    getPaintUpgradeCost,
    PAINT_PRICES,
    TYPE_LABELS,
  };

})(typeof window !== 'undefined' ? window : globalThis);
