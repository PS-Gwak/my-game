/* ============================================================
   menu.js — 시작 메뉴 3창 (이어하기 / 새로 시작 / 자체 검증 모드)
   ============================================================
   비유: 게임을 처음 켰을 때 나오는 '첫 화면 안내원'입니다.
   세 가지 문 중 하나를 열어주고, 그 뒤는 game.js 가 이어받아요.

   3창:
   1. 이어하기  — 저장된 데이터가 있을 때만 활성
   2. 새로 시작 — 저장 데이터 삭제 후 처음부터
   3. 자체 검증 모드 — 개발자 디버그 화면 (Ctrl+Shift+D 단축키도 동작)
   ============================================================ */

(function (global) {
  'use strict';

  // ── 시작 메뉴 화면 렌더
  // container : 메뉴를 그려 넣을 DOM 요소
  // callbacks : { onContinue, onNewGame, onDevMode }
  function renderStartMenu(container, callbacks) {
    if (!container) return;

    const hasSave = !!global.MN9_Persist && !!global.MN9_Persist.loadState();

    container.innerHTML = `
      <div class="menu-card">
        <h1 class="menu-title">뮤더너츠 v9</h1>
        <p class="menu-tagline">붓질로 명화를 베끼고, 경매장에서 팔고, 박물관까지</p>

        <div class="menu-buttons">

          <!-- 1. 이어하기 — 저장 없으면 흐릿하게 비활성 -->
          <button
            id="btn-menu-continue"
            class="primary menu-btn ${hasSave ? '' : 'menu-btn-disabled'}"
            ${hasSave ? '' : 'disabled'}
          >
            ▶ 이어하기
            ${hasSave ? '<span class="menu-btn-sub">저장된 게임이 있어요</span>' : '<span class="menu-btn-sub">저장된 게임이 없어요</span>'}
          </button>

          <!-- 2. 새로 시작 -->
          <button id="btn-menu-new" class="menu-btn">
            ✦ 새로 시작
            <span class="menu-btn-sub">처음부터 ($100 · 수채화 붓 1단계)</span>
          </button>

          <!-- 3. 자체 검증 모드 -->
          <button id="btn-menu-dev" class="menu-btn menu-btn-dev">
            ⚙ 자체 검증 모드
            <span class="menu-btn-sub">자금·단계 조정, 경매 디버그 (Ctrl+Shift+D)</span>
          </button>

        </div>

        <p class="menu-hint">시작 자금 $100 · 수채화 붓 1단계 보유</p>
      </div>
    `;

    // 이어하기 버튼 연결
    const btnContinue = container.querySelector('#btn-menu-continue');
    if (btnContinue && hasSave) {
      btnContinue.onclick = () => callbacks.onContinue && callbacks.onContinue();
    }

    // 새로 시작 버튼 연결
    const btnNew = container.querySelector('#btn-menu-new');
    if (btnNew) {
      btnNew.onclick = () => {
        if (hasSave) {
          // 저장 데이터가 있으면 한 번 더 확인
          if (!confirm('지금까지의 진행을 모두 지우고 처음부터 시작할까요? (되돌릴 수 없어요)')) return;
        }
        callbacks.onNewGame && callbacks.onNewGame();
      };
    }

    // 자체 검증 모드 버튼 연결
    const btnDev = container.querySelector('#btn-menu-dev');
    if (btnDev) {
      btnDev.onclick = () => callbacks.onDevMode && callbacks.onDevMode();
    }
  }

  // ── Ctrl+Shift+D 단축키 → 자체 검증 모드 진입
  // onDevMode 콜백을 등록해 두면 어느 화면에서든 단축키로 들어갈 수 있어요
  function registerDevShortcut(onDevMode) {
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        onDevMode && onDevMode();
      }
    });
  }

  global.MN9_Menu = { renderStartMenu, registerDevShortcut };

})(typeof window !== 'undefined' ? window : globalThis);
