/* ============================================================
   guards.js — 경매장 입장 자동 차단 가드 (락-인 결정 15)
   ============================================================
   비유: 경매장 앞에 세워둔 '문지기'입니다.
   자금이 너무 적으면 문을 막고, 충분하면 통과시켜요.

   v8 룰:
   - 자금 < 경매 시작가 최솟값(기본 $3,000)의 1.2배 → 입장 거부
   - 0원이면 경매 입장 불가 모달 표시 + 「자체 검증 모드 진입」 링크
   - 자체 검증 모드(debug) 활성화 중이면 가드 무력화 (어떤 자금으로도 입장 가능)

   window._mn9Debug.bypassGuards = true 로 설정하면 가드 통과.
   ============================================================ */

(function (global) {
  'use strict';

  // 경매 입장에 필요한 최소 자금 배율
  // 시작가 $3,000 × 1.2 = $3,600 이상 있어야 입장 가능
  const MIN_START_PRICE = 3000;
  const MIN_ENTRY_RATIO = 1.2;
  const MIN_ENTRY_MONEY = MIN_START_PRICE * MIN_ENTRY_RATIO; // $3,600

  // ── 금액 포맷 헬퍼 ($1,000 형태)
  function fmt(v) {
    const n = Math.round(v);
    return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US');
  }

  // ── 자체 검증 모드(디버그) 가드 우회 여부 확인
  function _isDebugBypass() {
    return !!(global._mn9Debug && global._mn9Debug.bypassGuards);
  }

  // ── 자금 부족 모달 표시
  // onEnterDebug: 「자체 검증 모드 진입」 링크 클릭 시 호출할 콜백
  function _showInsufficientFundsModal(currentMoney, onEnterDebug) {
    // 기존 모달 제거
    const old = document.getElementById('mn9-guard-modal');
    if (old) old.remove();

    const isZero = currentMoney <= 0;

    const modal = document.createElement('div');
    modal.id = 'mn9-guard-modal';
    modal.innerHTML = `
      <div class="guard-backdrop"></div>
      <div class="guard-modal-box">
        <div class="guard-modal-icon">${isZero ? '💸' : '⚠️'}</div>
        <div class="guard-modal-title">
          ${isZero ? '자금 부족 — 경매 입장 불가' : '자금이 조금 부족해요'}
        </div>
        <div class="guard-modal-body">
          ${isZero
            ? `현재 자금이 <strong>$0</strong>이에요.<br>모작을 더 만들어 판매하거나<br>자체 검증 모드에서 자금을 조정해보세요.`
            : `현재 자금 <strong>${fmt(currentMoney)}</strong>으로는<br>경매 입장이 어려워요.<br>최소 <strong>${fmt(MIN_ENTRY_MONEY)}</strong> 이상 필요합니다.`
          }
        </div>
        <div class="guard-modal-actions">
          <button class="guard-btn-close" id="guard-btn-ok">확인 (모작 더 만들러 가기)</button>
          <button class="guard-btn-debug" id="guard-btn-debug">⚙ 자체 검증 모드 진입</button>
        </div>
      </div>
    `;

    // 모달 스타일 주입 (최초 1회)
    if (!document.getElementById('guard-modal-styles')) {
      const style = document.createElement('style');
      style.id = 'guard-modal-styles';
      style.textContent = `
        #mn9-guard-modal {
          position: fixed; inset: 0; z-index: 10000;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Noto Sans KR', sans-serif;
        }
        .guard-backdrop {
          position: absolute; inset: 0;
          background: rgba(0,0,0,0.7);
        }
        .guard-modal-box {
          position: relative; z-index: 1;
          background: #1c140a;
          border: 2px solid #c0391b;
          border-radius: 12px;
          padding: 32px 28px;
          max-width: 360px;
          width: 90%;
          text-align: center;
          box-shadow: 0 8px 40px rgba(0,0,0,0.8);
        }
        .guard-modal-icon { font-size: 48px; margin-bottom: 12px; }
        .guard-modal-title {
          font-size: 18px; font-weight: 700; color: #ff6b4a;
          margin-bottom: 12px;
        }
        .guard-modal-body {
          font-size: 14px; color: #e8d6a8; line-height: 1.7;
          margin-bottom: 24px;
        }
        .guard-modal-body strong { color: #f5a700; }
        .guard-modal-actions { display: flex; flex-direction: column; gap: 10px; }
        .guard-btn-close {
          background: #3a2a10; border: 1px solid #6a5030;
          color: #e8d6a8; border-radius: 8px;
          padding: 10px 16px; cursor: pointer; font-size: 14px;
          transition: background 0.15s;
        }
        .guard-btn-close:hover { background: #5a3e18; }
        .guard-btn-debug {
          background: none; border: 1px solid #5a4a28;
          color: #a08050; border-radius: 8px;
          padding: 8px 16px; cursor: pointer; font-size: 13px;
          transition: background 0.15s, color 0.15s;
        }
        .guard-btn-debug:hover { background: #2a1f0e; color: #f5a700; }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(modal);

    // 확인 버튼
    document.getElementById('guard-btn-ok').addEventListener('click', () => {
      modal.remove();
    });

    // 자체 검증 모드 진입 버튼
    document.getElementById('guard-btn-debug').addEventListener('click', () => {
      modal.remove();
      if (onEnterDebug) onEnterDebug();
    });
  }

  // ──────────────────────────────────────────────────────────
  // 핵심 공개 함수: canEnterAuction
  // ──────────────────────────────────────────────────────────
  // 반환값: true = 입장 가능, false = 차단됨 (모달 표시됨)
  // opts = {
  //   currentMoney    : number  — 현재 자금
  //   onEnterDebug    : fn()   — 자체 검증 모드 진입 콜백
  //   customMinMoney  : number? — 커스텀 최솟값 (없으면 $3,600 기본값)
  // }
  function canEnterAuction(opts) {
    // V5 픽스: 최소 자금 가드 제거 — 자금 무관 항상 입장 가능
    return true;
  }

  // ──────────────────────────────────────────────────────────
  // 가드 우회 토글 (자체 검증 모드에서 사용)
  // ──────────────────────────────────────────────────────────
  function setBypassGuards(enabled) {
    if (!global._mn9Debug) global._mn9Debug = {};
    global._mn9Debug.bypassGuards = !!enabled;
  }

  function isBypassActive() {
    return _isDebugBypass();
  }

  global.MN9_Guards = {
    canEnterAuction,
    setBypassGuards,
    isBypassActive,
    MIN_ENTRY_MONEY,
  };

})(typeof window !== 'undefined' ? window : globalThis);
