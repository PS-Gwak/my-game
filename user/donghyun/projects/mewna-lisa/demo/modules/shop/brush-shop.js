/* ============================================================
   brush-shop.js — 붓 상점
   ============================================================
   비유: 붓을 더 굵게 업그레이드하는 '붓 전문점'입니다.
   1단계(가는 붓)에서 5단계(굵은 붓)까지 총 4번 업그레이드할 수 있어요.
   붓이 굵을수록 캔버스를 더 빠르게 채울 수 있습니다.

   가격표 (락-인):
   - 1→2단계: $300
   - 2→3단계: $800
   - 3→4단계: $2,000
   - 4→5단계: $5,000

   state.brushLevel += 1 처리는 이 모듈이 직접 수행
   ============================================================ */

(function (global) {
  'use strict';

  // 붓 레벨업 가격표 (현재 레벨 → 다음 레벨 비용)
  // 인덱스 = 현재 레벨 (1~4)
  const BRUSH_PRICES = {
    1: 300,
    2: 800,
    3: 2000,
    4: 5000,
  };

  // 붓 레벨 이름 (각 단계별 설명)
  const BRUSH_LEVEL_NAMES = {
    1: '가는 붓 (기본)',
    2: '얇은 붓',
    3: '중간 붓',
    4: '굵은 붓',
    5: '두꺼운 붓 (최고)',
  };

  // 현재 레벨 → 다음 레벨 구입 비용 반환
  // 레벨 5면 -1 (최고 단계)
  function getBrushUpgradeCost(currentLevel) {
    if (currentLevel >= 5) return -1;
    return BRUSH_PRICES[currentLevel] || -1;
  }

  // ── 붓 상점 UI 렌더
  // container  : 화면을 그려 넣을 DOM 요소
  // state      : 현재 게임 상태
  // callbacks  :
  //   onBuy()    → 구입 성공 시 (state 갱신은 이 모듈이 직접)
  //   onBack()   → 뒤로가기 버튼
  function renderBrushShop(container, state, callbacks) {
    if (!container) return;

    const money = state.money || 0;
    const brushLevel = state.brushLevel || 1;
    const cost = getBrushUpgradeCost(brushLevel);
    const canBuy = cost > 0 && money >= cost;

    // 단계별 미리보기 목록 생성
    const levelRows = [1, 2, 3, 4, 5].map(lvl => {
      const isCurrentOrPast = lvl <= brushLevel;
      const isCurrent = lvl === brushLevel;
      return `
        <div class="bshop-level-row ${isCurrent ? 'bshop-level-current' : ''} ${isCurrentOrPast ? 'bshop-level-done' : 'bshop-level-future'}">
          <div class="bshop-level-num">${lvl}단계</div>
          <div class="bshop-level-name">${BRUSH_LEVEL_NAMES[lvl]}</div>
          ${isCurrent ? '<div class="bshop-level-badge">현재</div>' : ''}
          ${isCurrentOrPast && !isCurrent ? '<div class="bshop-level-badge bshop-level-badge-done">완료</div>' : ''}
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="bshop-wrap">
        <div class="bshop-header">
          <div class="bshop-title">붓 상점</div>
          <div class="bshop-money">보유 자금: <strong>$${money.toLocaleString('en-US')}</strong></div>
        </div>

        <!-- 단계 미리보기 -->
        <div class="bshop-levels">${levelRows}</div>

        <!-- 업그레이드 버튼 -->
        <div class="bshop-upgrade-area">
          ${brushLevel >= 5
            ? `<div class="bshop-maxed">붓 최고 단계 달성! (5단계)</div>`
            : `<div class="bshop-upgrade-info">
                <div class="bshop-upgrade-label">${brushLevel}단계 → ${brushLevel + 1}단계 업그레이드</div>
                <div class="bshop-upgrade-desc">포인터 크기가 커져서 캔버스를 더 빠르게 채울 수 있어요</div>
               </div>
               <button
                 class="bshop-buy-btn ${canBuy ? 'primary' : 'bshop-disabled'}"
                 id="bshop-btn-buy"
                 ${canBuy ? '' : 'disabled'}>
                 $${cost.toLocaleString('en-US')} 구입
               </button>
               ${!canBuy && cost > 0
                 ? `<div class="bshop-need-money">자금 부족 — $${(cost - money).toLocaleString('en-US')} 더 필요해요</div>`
                 : ''
               }`
          }
        </div>
      </div>
    `;

    // 구입 버튼 이벤트
    const btnBuy = container.querySelector('#bshop-btn-buy');
    if (btnBuy) {
      btnBuy.onclick = () => {
        const lvl  = state.brushLevel || 1;
        const cost = getBrushUpgradeCost(lvl);
        if (cost < 0 || state.money < cost) return;

        // 자금 차감 + 레벨업
        state.money -= cost;
        state.brushLevel = lvl + 1;

        callbacks && callbacks.onBuy && callbacks.onBuy();
      };
    }
  }

  global.MN9_BrushShop = {
    renderBrushShop,
    getBrushUpgradeCost,
    BRUSH_PRICES,
    BRUSH_LEVEL_NAMES,
  };

})(typeof window !== 'undefined' ? window : globalThis);
