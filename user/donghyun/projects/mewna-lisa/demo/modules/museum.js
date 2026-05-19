/* ============================================================
   museum.js — 박물관 엔딩 시퀀스
   ============================================================
   비유: 그라타주 4등급 그림을 박물관에 헌정하는 '엔딩 이벤트'입니다.
   조건이 갖춰지면 어느 화면에서든 「박물관 엔딩」 버튼이 나타나고,
   클릭하면 헌정 시퀀스가 진행됩니다.

   트리거 조건 (락-인):
   - 그라타주 4등급 이상 그림 보유 (원본 grade >= 4)
   - 보유 자금 $1,000,000 이상 (V8 상향)
   - state.unlocks.museumEnding === true

   결과 분기 (architect 권고):
   - 성공 30%: 박물관 인정 + 명성 텍스트
   - 부분 50%: 일부 인정
   - 실패 20%: 헌정 거부

   헌정 결과:
   - 자금 전액 차감
   - 그라타주 4등급 그림 1장 인벤토리 제거
   - state.museumCollection 배열에 그림 메타데이터 보관
   - state.museumOutcome = 'success' | 'partial' | 'fail'

   헌정 후 선택지:
   - 「새 게임」: 완전 리셋
   - 「계속」: 현재 상태 유지 (같은 게임 계속)
   ============================================================ */

(function (global) {
  'use strict';

  // 결과 분기 확률 (합계 100)
  const OUTCOME_PROBS = { success: 30, partial: 50, fail: 20 };

  // 결과별 텍스트
  const OUTCOME_TEXTS = {
    success: {
      title: '헌정 성공!',
      emoji: '🏛',
      desc: '박물관이 여러분의 그라타주 작품을 전시 컬렉션에 포함했습니다. 이름이 영원히 새겨질 거예요.',
      color: '#f5a700',
    },
    partial: {
      title: '부분 인정',
      emoji: '📜',
      desc: '박물관이 작품을 보관했지만 공식 전시는 아직입니다. 더 많은 작품을 모으면 기회가 올 거예요.',
      color: '#88aac0',
    },
    fail: {
      title: '헌정 거부',
      emoji: '📦',
      desc: '박물관이 이번엔 받아들이지 않았어요. 그래도 도전한 것 자체가 의미 있어요.',
      color: '#888',
    },
  };

  // ── 결과 뽑기
  function rollOutcome() {
    const r = Math.random() * 100;
    if (r < OUTCOME_PROBS.success) return 'success';
    if (r < OUTCOME_PROBS.success + OUTCOME_PROBS.partial) return 'partial';
    return 'fail';
  }

  // ── 박물관 엔딩 버튼 렌더 (시작 메뉴·작업실 등 어느 화면에나 붙임)
  // container : 버튼을 붙일 DOM 요소
  // state     : 현재 게임 상태
  // onStart() : 버튼 클릭 시 콜백 (game.js가 화면 전환 처리)
  function renderMuseumButton(container, state, onStart) {
    if (!container) return;
    if (!state.unlocks || !state.unlocks.museumEnding) return;

    // 이미 버튼이 있으면 스킵
    if (container.querySelector('.museum8-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'museum8-btn';
    btn.innerHTML = `
      🏛 박물관 엔딩
      <span class="museum8-btn-sub">그라타주 4등급 헌정 — 자금 $${(state.money || 0).toLocaleString('en-US')}</span>
    `;
    btn.onclick = () => onStart && onStart();
    container.appendChild(btn);
  }

  // ── 박물관 엔딩 시퀀스 화면 렌더
  // container  : 화면 전체를 그려 넣을 DOM 요소
  // state      : 현재 게임 상태
  // callbacks  :
  //   onNewGame()  → 「새 게임」 버튼
  //   onContinue() → 「계속하기」 버튼
  function renderMuseumEnding(container, state, callbacks) {
    if (!container) return;

    // 헌정 가능한 그라타주 4등급 이상 그림 찾기
    const gratage4 = state.inventory.find(
      it => it.type === 'gratage' && (it.grade || 0) >= 4
    );

    if (!gratage4) {
      container.innerHTML = `
        <div class="museum8-outer">
          <div class="museum8-error">그라타주 4등급 이상 그림이 없어요.<br>조건을 다시 확인해주세요.</div>
        </div>
      `;
      return;
    }

    // 결과 뽑기 (아직 헌정 전 — 버튼 누를 때 실행)
    container.innerHTML = `
      <div class="museum8-outer">

        <div class="museum8-header">
          <div class="museum8-title">🏛 박물관 엔딩</div>
          <div class="museum8-subtitle">이 그림을 박물관에 영구 헌정합니다</div>
        </div>

        <!-- 헌정할 그림 -->
        <div class="museum8-painting">
          <img
            class="museum8-thumb"
            src="assets/paintings/${gratage4.filename}"
            alt="${gratage4.title}"
            onerror="this.style.display='none'"
          />
          <div class="museum8-painting-info">
            <div class="museum8-painting-title">${gratage4.title}</div>
            <div class="museum8-painting-meta">${gratage4.artist} · 원본 ${gratage4.grade}등급</div>
          </div>
        </div>

        <!-- 헌정 비용 안내 -->
        <div class="museum8-cost-info">
          <div class="museum8-cost-row">
            <span class="museum8-cost-label">헌정 후 자금</span>
            <span class="museum8-cost-value museum8-cost-zero">$0 (전액 사용)</span>
          </div>
          <div class="museum8-cost-row">
            <span class="museum8-cost-label">헌정 그림</span>
            <span class="museum8-cost-value">「${gratage4.title}」 1장 제출</span>
          </div>
          <div class="museum8-cost-hint">헌정 후에는 되돌릴 수 없어요</div>
        </div>

        <!-- 결과 대기 영역 -->
        <div id="museum8-result-area"></div>

        <!-- 헌정 버튼 -->
        <div class="museum8-actions" id="museum8-actions">
          <button class="primary museum8-btn-donate" id="museum8-btn-donate">
            🏛 헌정하기
            <span class="museum8-btn-sub">자금 전액 + 그림 1장 사용</span>
          </button>
          <button class="museum8-btn-back" id="museum8-btn-back">
            돌아가기
          </button>
        </div>

      </div>
    `;

    // 돌아가기
    container.querySelector('#museum8-btn-back').onclick = () => {
      callbacks && callbacks.onContinue && callbacks.onContinue();
    };

    // 헌정하기
    container.querySelector('#museum8-btn-donate').onclick = () => {
      _executeEnding(container, state, gratage4, callbacks);
    };
  }

  // ── 실제 헌정 실행 (버튼 누른 후)
  function _executeEnding(container, state, gratage4, callbacks) {
    const outcome = rollOutcome();
    const outcomeData = OUTCOME_TEXTS[outcome];

    // museumCollection 초기화
    if (!state.museumCollection) state.museumCollection = [];

    // 헌정 처리: 자금 전액 차감 + 그림 제거 + 컬렉션 추가
    const moneyBefore = state.money;
    state.money = 0;
    state.inventory = state.inventory.filter(it => it.id !== gratage4.id);
    state.museumCollection.push({
      ...gratage4,
      donatedAt: Date.now(),
      outcome,
    });
    state.museumOutcome = outcome;

    // 저장
    if (global.MN9_State) global.MN9_State.saveState(state);

    // 결과 화면 렌더
    const resultArea = container.querySelector('#museum8-result-area');
    const actions    = container.querySelector('#museum8-actions');

    if (resultArea) {
      resultArea.innerHTML = `
        <div class="museum8-result museum8-result-${outcome}">
          <div class="museum8-result-emoji">${outcomeData.emoji}</div>
          <div class="museum8-result-title" style="color:${outcomeData.color}">${outcomeData.title}</div>
          <div class="museum8-result-desc">${outcomeData.desc}</div>
          <div class="museum8-result-stats">
            <div class="museum8-stat-row">헌정 전 자금: $${moneyBefore.toLocaleString('en-US')}</div>
            <div class="museum8-stat-row">박물관 컬렉션: ${state.museumCollection.length}점</div>
          </div>
        </div>
      `;
    }

    // 버튼 교체
    if (actions) {
      actions.innerHTML = `
        <button class="primary museum8-btn-donate" id="museum8-btn-newgame">
          새 게임 시작
          <span class="museum8-btn-sub">처음부터 다시</span>
        </button>
        <button class="museum8-btn-back" id="museum8-btn-continue">
          계속하기
          <span class="museum8-btn-sub">현재 상태로 게임 계속</span>
        </button>
      `;

      container.querySelector('#museum8-btn-newgame').onclick = () => {
        callbacks && callbacks.onNewGame && callbacks.onNewGame();
      };
      container.querySelector('#museum8-btn-continue').onclick = () => {
        callbacks && callbacks.onContinue && callbacks.onContinue();
      };
    }
  }

  global.MN9_Museum = {
    renderMuseumEnding,
    renderMuseumButton,
    rollOutcome,
    OUTCOME_TEXTS,
  };

})(typeof window !== 'undefined' ? window : globalThis);
