/* ============================================================
   devmode.js — 자체 검증 모드 (락-인 결정 17)
   ============================================================
   비유: 게임을 테스트할 때 쓰는 '치트 패널'입니다.
   돈 바꾸기, 단계 점프, 경매 디버그, 현재 상태 덤프 4가지 카테고리.
   실제 플레이에선 안 보이고, 시작 메뉴 「자체 검증 모드」 또는
   Ctrl+Shift+D 단축키로만 들어올 수 있어요.

   4카테고리 (락-인 결정 17):
   1. 자금 조정  — 돈을 원하는 액수로 설정
   2. 단계 점프  — 그림 종류 해금 / 경매 라운드 강제 설정
   3. 경매 디버그 — 경매 라운드 수 강제 변경
   4. 상태 덤프  — 현재 game state JSON 출력
   ============================================================ */

(function (global) {
  'use strict';

  // ── 자체 검증 모드 화면 렌더
  // container : 패널을 그려 넣을 DOM 요소
  // getState  : () → 현재 state 반환하는 함수 (game.js가 주입)
  // onUpdate  : () → 상태 바뀐 후 UI 갱신 콜백
  function renderDevMode(container, getState, onUpdate) {
    if (!container) return;

    function state() { return getState(); }
    function fmt(v) { return '$' + Math.round(v).toLocaleString('en-US'); }

    function rebuild() {
      const s = state();
      container.innerHTML = `
        <div class="dev8-wrap">
          <h2 class="dev8-title">⚙ 자체 검증 모드</h2>
          <p class="dev8-hint">이 패널은 개발·테스트용입니다. 실제 게임 진행에 영향을 줘요.</p>

          <!-- ① 자금 조정 -->
          <div class="dev8-section">
            <div class="dev8-section-title">① 자금 조정</div>
            <div class="dev8-row">
              <span>현재 자금: <strong>${fmt(s.money)}</strong></span>
            </div>
            <div class="dev8-row">
              <input type="number" id="dev8-money-input" value="${s.money}" min="0" step="100" class="dev8-input" />
              <button id="dev8-btn-set-money" class="dev8-btn">설정</button>
            </div>
            <div class="dev8-row dev8-quick-btns">
              <button class="dev8-btn-small" data-money="100">$100</button>
              <button class="dev8-btn-small" data-money="1000">$1,000</button>
              <button class="dev8-btn-small" data-money="5000">$5,000</button>
              <button class="dev8-btn-small" data-money="30000">$30,000</button>
            </div>
          </div>

          <!-- ② 단계 점프 (그림 종류 해금) -->
          <div class="dev8-section">
            <div class="dev8-section-title">② 단계 점프 — 그림 종류 해금</div>
            <div class="dev8-row dev8-unlock-btns">
              <button class="dev8-btn" id="dev8-unlock-wc"
                ${s.unlockedTypes.watercolor ? 'disabled' : ''}>
                수채화 해금 ${s.unlockedTypes.watercolor ? '✓' : ''}
              </button>
              <button class="dev8-btn" id="dev8-unlock-pt"
                ${s.unlockedTypes.pointillism ? 'disabled' : ''}>
                점묘화 해금 ${s.unlockedTypes.pointillism ? '✓' : ''}
              </button>
              <button class="dev8-btn" id="dev8-unlock-op"
                ${s.unlockedTypes.oilpainting ? 'disabled' : ''}>
                유화 해금 ${s.unlockedTypes.oilpainting ? '✓' : ''}
              </button>
              <button class="dev8-btn" id="dev8-unlock-gr"
                ${s.unlockedTypes.gratage ? 'disabled' : ''}>
                그라타주 해금 ${s.unlockedTypes.gratage ? '✓' : ''}
              </button>
            </div>
            <div class="dev8-row">
              <span>붓 레벨 (현재 ${s.brushLevel || 1}단계):</span>
              <select id="dev8-brush-select" class="dev8-input">
                ${[1,2,3,4,5].map(lvl =>
                  `<option value="${lvl}" ${(s.brushLevel||1) === lvl ? 'selected' : ''}>
                    ${lvl}단계
                  </option>`
                ).join('')}
              </select>
              <button id="dev8-btn-set-brush" class="dev8-btn">설정</button>
            </div>
          </div>

          <!-- ③ 경매 디버그 -->
          <div class="dev8-section">
            <div class="dev8-section-title">③ 경매 디버그</div>
            <div class="dev8-row">
              <span>경매 라운드 수 (현재 ${s.unlocks.auctionRounds || 1}라운드):</span>
              <select id="dev8-rounds-select" class="dev8-input">
                ${[1,3,5].map(r =>
                  `<option value="${r}" ${(s.unlocks.auctionRounds||1) === r ? 'selected' : ''}>${r}라운드</option>`
                ).join('')}
              </select>
              <button id="dev8-btn-set-rounds" class="dev8-btn">설정</button>
            </div>
            <div class="dev8-row">
              <button id="dev8-btn-unlock-auction" class="dev8-btn"
                ${s.unlocks.auctionOpen ? 'disabled' : ''}>
                경매장 즉시 해금 ${s.unlocks.auctionOpen ? '✓' : ''}
              </button>
            </div>
          </div>

          <!-- ④ 상태 덤프 -->
          <div class="dev8-section">
            <div class="dev8-section-title">④ 상태 덤프 (현재 게임 메모지 전체 출력)</div>
            <div class="dev8-row">
              <button id="dev8-btn-dump" class="dev8-btn">콘솔에 덤프</button>
              <button id="dev8-btn-dump-show" class="dev8-btn">화면에 보기</button>
            </div>
            <pre id="dev8-dump-box" class="dev8-dump-box" style="display:none;"></pre>
          </div>

        </div>
      `;

      // ① 자금 설정
      container.querySelector('#dev8-btn-set-money').onclick = () => {
        const val = parseInt(container.querySelector('#dev8-money-input').value, 10);
        if (!isNaN(val) && val >= 0) {
          state().money = val;
          onUpdate && onUpdate();
          rebuild();
        }
      };

      // 빠른 자금 버튼
      container.querySelectorAll('[data-money]').forEach(btn => {
        btn.onclick = () => {
          state().money = parseInt(btn.getAttribute('data-money'), 10);
          onUpdate && onUpdate();
          rebuild();
        };
      });

      // ② 그림 종류 해금
      const unlockMap = {
        'dev8-unlock-wc': 'watercolor',
        'dev8-unlock-pt': 'pointillism',
        'dev8-unlock-op': 'oilpainting',
        'dev8-unlock-gr': 'gratage',
      };
      Object.entries(unlockMap).forEach(([btnId, type]) => {
        const btn = container.querySelector('#' + btnId);
        if (btn && !btn.disabled) {
          btn.onclick = () => {
            state().unlockedTypes[type] = true;
            onUpdate && onUpdate();
            rebuild();
          };
        }
      });

      // ② 붓 레벨 설정
      container.querySelector('#dev8-btn-set-brush').onclick = () => {
        const lvl = parseInt(container.querySelector('#dev8-brush-select').value, 10);
        state().brushLevel = lvl;
        onUpdate && onUpdate();
        rebuild();
      };

      // ③ 경매 라운드 설정
      container.querySelector('#dev8-btn-set-rounds').onclick = () => {
        const r = parseInt(container.querySelector('#dev8-rounds-select').value, 10);
        state().unlocks.auctionRounds = r;
        onUpdate && onUpdate();
        rebuild();
      };

      // ③ 경매 즉시 해금
      const btnAuction = container.querySelector('#dev8-btn-unlock-auction');
      if (btnAuction && !btnAuction.disabled) {
        btnAuction.onclick = () => {
          state().unlocks.auctionOpen = true;
          onUpdate && onUpdate();
          rebuild();
        };
      }

      // ④ 콘솔 덤프
      container.querySelector('#dev8-btn-dump').onclick = () => {
        console.log('[devmode] state dump:', JSON.parse(JSON.stringify(state())));
      };

      // ④ 화면 덤프
      container.querySelector('#dev8-btn-dump-show').onclick = () => {
        const box = container.querySelector('#dev8-dump-box');
        const json = JSON.stringify(state(), (k, v) => {
          // 런타임 전용이라 저장 안 되는 키들 제외
          if (k === 'currentCanvas') return '[canvas — 저장 안 됨]';
          return v;
        }, 2);
        box.textContent = json;
        box.style.display = box.style.display === 'none' ? 'block' : 'none';
      };
    }

    rebuild();
  }

  global.MN9_DevMode = { renderDevMode };

})(typeof window !== 'undefined' ? window : globalThis);
