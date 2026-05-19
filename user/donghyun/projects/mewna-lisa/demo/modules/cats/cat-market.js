/* ============================================================
   cat-market.js — 고양이 시장 UI (이적시장 / 2슬롯 리롤)
   ============================================================
   비유: 고양이 시장은 '도우미 채용소'입니다.
   2개 슬롯에 고양이들이 나타나고, 원하는 고양이를 영입 비용을
   내고 채용하면 그 고양이가 자동으로 모작을 만들어줘요.

   규칙:
   - 2 슬롯 = 해금된 고양이만 등장 (수채화 단계엔 도롬 꼼꼼이·날렵이만)
   - 각 슬롯: 고양이 1마리 + 영입 버튼 (슬롯마다 중복 없음)
   - 「시장 새로고침」 버튼 = 2슬롯 전체 리롤 ($50 소모)
   - 이미 영입한 고양이는 슬롯에 표시 안 됨 (모두 영입했으면 "만석" 표시)
   - 풀이 1마리면 1슬롯만, 0마리면 만석 메시지

   단계별 등장 풀:
   - 게임 시작: dorom_a, dorom_b
   - 점묘 해금: + arti
   - 유화 해금: + oil
   - 그라타주 해금: + gold
   - 박물관 해금: + gongjak(gongja)
   ============================================================ */

(function (global) {
  'use strict';

  // 리롤 비용
  const REROLL_COST = 50;

  // 슬롯 수
  const SLOT_COUNT = 2;

  // 현재 슬롯 배열 (렌더할 때 채움)
  let _slots = [];

  // ── 해금된 영입 가능 고양이 목록 반환
  function getAvailableCats(state) {
    const Cats = global.MN9_Cats;
    if (!Cats) return [];

    // dorom_a, dorom_b는 게임 시작부터 해금
    const catsUnlocked = (state.unlocks && state.unlocks.catsUnlocked) || {};
    const catsHired    = state.cats || {};

    return Object.values(Cats.CAT_DEFS).filter(cat => {
      const isStarter = cat.id === 'dorom_a' || cat.id === 'dorom_b';
      const unlocked  = isStarter || !!catsUnlocked[cat.id];
      const notHired  = !(catsHired[cat.id] && catsHired[cat.id].hired);
      return unlocked && notHired;
    });
  }

  // ── 2슬롯 생성 (해금된 고양이 중 중복 없이 최대 2마리 뽑기)
  function generateSlots(state) {
    const available = getAvailableCats(state);
    if (available.length === 0) {
      _slots = [];
      return;
    }
    // 풀을 셔플한 뒤 앞에서 min(2, 풀크기)개만 뽑아 중복 방지
    const shuffled = available.slice().sort(() => Math.random() - 0.5);
    const picked   = shuffled.slice(0, SLOT_COUNT);
    _slots = picked.map(cat => ({ catId: cat.id, cat, cost: cat.hireCost }));
  }

  // ── 고양이 시장 UI 렌더
  // container  : DOM 요소
  // state      : 현재 게임 상태
  // callbacks  :
  //   onHire(catId)  → 영입 성공 후 호출
  //   onReroll()     → 리롤 성공 후 호출
  function renderCatMarket(container, state, callbacks) {
    if (!container) return;

    const Cats  = global.MN9_Cats;
    if (!Cats) {
      container.innerHTML = '<div class="catmkt-empty">고양이 모듈이 없어요</div>';
      return;
    }

    const available = getAvailableCats(state);
    const money     = state.money || 0;

    // 슬롯이 아직 없으면 생성
    if (_slots.length === 0 && available.length > 0) generateSlots(state);

    // 현재 영입 상태 요약 (이미 영입된 고양이 표시용)
    const hiredCats = Object.entries(Cats.CAT_DEFS)
      .filter(([id]) => state.cats && state.cats[id] && state.cats[id].hired)
      .map(([, cat]) => cat);

    // 슬롯 HTML
    let slotsHtml;
    if (available.length === 0) {
      slotsHtml = `<div class="catmkt-all-hired">모든 해금 고양이를 영입했어요! 게임을 계속 진행하면 새 고양이가 등장해요.</div>`;
    } else if (_slots.length === 0) {
      slotsHtml = `<div class="catmkt-empty">시장에 고양이가 없어요</div>`;
    } else {
      slotsHtml = `
        <div class="catmkt-grid">
          ${_slots.map((slot, idx) => {
            const canAfford = money >= slot.cost;
            return `
              <div class="catmkt-slot" data-slot-idx="${idx}">
                <div class="catmkt-slot-emoji">${slot.cat.emoji}</div>
                <div class="catmkt-slot-name">${slot.cat.name}</div>
                <div class="catmkt-slot-info">
                  <div>전문 그림 종류: ${_typeLabel(slot.cat.type)}</div>
                  <div>그림 속도: ${slot.cat.autoIntervalSec}초에 한 장</div>
                  <div>등급 보정: +${slot.cat.gradeBonus || 0}</div>
                  <div>영입 비용: $${slot.cat.hireCost.toLocaleString('en-US')}</div>
                </div>
                <button
                  class="catmkt-hire-btn ${canAfford ? 'primary' : 'catmkt-disabled'}"
                  data-slot-idx="${idx}"
                  ${canAfford ? '' : 'disabled'}>
                  $${slot.cost.toLocaleString('en-US')} 영입
                </button>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // 영입된 고양이 목록
    const hiredHtml = hiredCats.length > 0
      ? `<div class="catmkt-hired-list">
           <div class="catmkt-hired-title">현재 영입된 도우미</div>
           <div class="catmkt-hired-chips">
             ${hiredCats.map(c => `
               <div class="catmkt-hired-chip">
                 ${c.emoji} ${c.name}
                 <span class="catmkt-hired-chip-sub">30초마다 자동 모작</span>
               </div>
             `).join('')}
           </div>
         </div>`
      : '';

    container.innerHTML = `
      <div class="catmkt-wrap">
        <div class="catmkt-topbar">
          <div class="catmkt-title">고양이 시장</div>
          <div class="catmkt-money">보유 자금: <strong>$${money.toLocaleString('en-US')}</strong></div>
          <button class="catmkt-close-btn" id="catmkt-btn-close">나가기 ✕</button>
        </div>

        ${hiredHtml}

        <div class="catmkt-controls">
          <button
            class="catmkt-reroll-btn ${money >= REROLL_COST && available.length > 0 ? '' : 'catmkt-disabled'}"
            id="catmkt-btn-reroll"
            ${money >= REROLL_COST && available.length > 0 ? '' : 'disabled'}>
            시장 새로고침 ($${REROLL_COST} 소모)
          </button>
          <div class="catmkt-hint">슬롯 ${SLOT_COUNT}개 · 영입 가능 고양이 ${available.length}마리</div>
        </div>

        ${slotsHtml}
      </div>
    `;

    // 나가기 버튼 (topbar에 있음)
    const btnClose = container.querySelector('#catmkt-btn-close');
    if (btnClose) {
      btnClose.onclick = () => {
        callbacks && callbacks.onClose && callbacks.onClose();
      };
    }

    // 리롤 버튼
    const btnReroll = container.querySelector('#catmkt-btn-reroll');
    if (btnReroll) {
      btnReroll.onclick = () => {
        if (state.money < REROLL_COST) return;
        state.money -= REROLL_COST;
        generateSlots(state);
        callbacks && callbacks.onReroll && callbacks.onReroll();
      };
    }

    // 영입 버튼들
    container.querySelectorAll('[data-slot-idx]').forEach(btn => {
      if (btn.tagName !== 'BUTTON') return;
      btn.onclick = () => {
        const idx  = parseInt(btn.getAttribute('data-slot-idx'), 10);
        const slot = _slots[idx];
        if (!slot) return;

        // E2: 자금 부족 체크
        if (state.money < slot.cost) return;

        // E2: cats 초기화
        if (!state.cats) state.cats = {};
        if (!state.cats[slot.catId]) state.cats[slot.catId] = { hired: false };
        if (state.cats[slot.catId].hired) return; // 이미 영입

        // E2: 원본 state에 직접 자금 차감 + 영입 처리
        state.money -= slot.cost;
        state.cats[slot.catId].hired = true;
        Cats.startCatTimer(slot.catId, state);

        // 영입한 슬롯 제거
        _slots.splice(idx, 1);

        callbacks && callbacks.onHire && callbacks.onHire(slot.catId);
      };
    });
  }

  // 그림 종류 한글 라벨
  function _typeLabel(type) {
    const MAP = {
      watercolor: '수채화', pointillism: '점묘화',
      oilpainting: '유화',  gratage: '그라타주',
    };
    return MAP[type] || type;
  }

  // 슬롯 초기화 (게임 화면 전환 시 리셋용)
  function resetSlots() { _slots = []; }

  global.MN9_CatMarket = {
    renderCatMarket,
    generateSlots,
    resetSlots,
    REROLL_COST,
  };

})(typeof window !== 'undefined' ? window : globalThis);
