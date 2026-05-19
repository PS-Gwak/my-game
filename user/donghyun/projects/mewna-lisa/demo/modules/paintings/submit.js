/* ============================================================
   submit.js — 자체 출품 (보유 그림을 경매에 직접 내놓기)
   ============================================================
   비유: 내가 만든 모작을 경매장에 직접 내놓는 기능입니다.
   시작가와 예상가를 내가 정하고, 경매가 끝나면 결과에 따라
   돈을 받거나 내 그림을 그대로 돌려받아요.

   락-인 결정:
   - 결정 8: 금별1 이상 모작 1개 보유 후 자체 출품 해금
   - 결정 9: 본인 낙찰 시 차감 0 (자기 그림 회수 = 시작가 차감 없음)

   흐름:
   1. 보유 그림 클릭 → 「자체 출품」 버튼 표시 (해금 후)
   2. 시작가 + 예상가 입력 (사용자 결정)
   3. v6 경매 엔진에 등록 파라미터 전달
   4. 경매 후 결과 처리 (낙찰자 판정)

   본인 낙찰: 인벤토리 유지 (차감 없음)
   타인 낙찰: 낙찰가 자금 추가 + 인벤토리에서 제거
   ============================================================ */

(function (global) {
  'use strict';

  // ── 자체 출품 다이얼로그 표시
  // item      : 출품할 그림 아이템 (state.inventory 항목)
  // state     : 현재 게임 상태
  // callbacks :
  //   onSubmit({ item, startPrice, estimatedPrice }) → 출품 확정 시
  //   onCancel()                                     → 취소 시
  function showSubmitDialog(item, state, callbacks) {
    const Scorer = global.MN9_Scorer;

    // 자체 출품 해금 체크
    if (!state.unlocks || !state.unlocks.selfListing) {
      alert('자체 출품은 금별1 이상 모작을 보유한 후 열려요!');
      return;
    }

    // 기존 모달 제거
    const old = document.querySelector('.submit8-overlay');
    if (old) old.remove();

    const gradeText = Scorer ? Scorer.gradeLabel(item.counterfeitGrade) : `${item.counterfeitGrade}등급`;
    const suggestedStart = item.value;               // 추정가 = 시작가 기본 제안
    const suggestedEst   = Math.round(item.value * 2); // 예상가 = 2배 기본 제안

    const overlay = document.createElement('div');
    overlay.className = 'submit8-overlay';

    overlay.innerHTML = `
      <div class="submit8-box">

        <div class="submit8-header">
          <div class="submit8-title">자체 출품</div>
          <div class="submit8-subtitle">내 그림을 직접 경매에 내놓아요</div>
        </div>

        <!-- 출품할 그림 정보 -->
        <div class="submit8-item-info">
          <img
            class="submit8-thumb"
            src="assets/paintings/${item.filename}"
            alt="${item.title}"
            onerror="this.style.display='none'"
          />
          <div class="submit8-item-text">
            <div class="submit8-item-title">${item.title}</div>
            <div class="submit8-item-meta">${item.artist} · ${gradeText} 모작</div>
            <div class="submit8-item-value">추정가 $${item.value.toLocaleString('en-US')}</div>
          </div>
        </div>

        <!-- 가격 입력 -->
        <div class="submit8-form">
          <div class="submit8-form-row">
            <label class="submit8-label" for="submit8-start-price">
              시작가 (경매 최저가)
              <span class="submit8-label-hint">이 금액보다 낮으면 낙찰 안 됩니다</span>
            </label>
            <div class="submit8-input-wrap">
              <span class="submit8-dollar">$</span>
              <input
                type="number"
                id="submit8-start-price"
                class="submit8-input"
                value="${suggestedStart}"
                min="1"
                step="100"
              />
            </div>
          </div>

          <div class="submit8-form-row">
            <label class="submit8-label" for="submit8-est-price">
              예상가 (참가자들이 보는 참고 금액)
              <span class="submit8-label-hint">실제 낙찰가와 달라도 괜찮아요</span>
            </label>
            <div class="submit8-input-wrap">
              <span class="submit8-dollar">$</span>
              <input
                type="number"
                id="submit8-est-price"
                class="submit8-input"
                value="${suggestedEst}"
                min="1"
                step="100"
              />
            </div>
          </div>
        </div>

        <!-- 규칙 안내 -->
        <div class="submit8-rules">
          <div class="submit8-rule-row">내가 최고가를 써도 차감 없음 — 그림 그대로 돌려받아요</div>
          <div class="submit8-rule-row">다른 참가자가 낙찰하면 낙찰가가 내 지갑에 들어와요</div>
        </div>

        <!-- 버튼 -->
        <div class="submit8-actions">
          <button class="primary submit8-btn" id="submit8-btn-ok">
            출품하기
            <span class="submit8-btn-sub">경매에 이 그림 등록</span>
          </button>
          <button class="submit8-btn" id="submit8-btn-cancel">
            취소
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);

    // 취소
    overlay.querySelector('#submit8-btn-cancel').onclick = () => {
      overlay.remove();
      callbacks && callbacks.onCancel && callbacks.onCancel();
    };
    overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); callbacks && callbacks.onCancel && callbacks.onCancel(); } };

    // 출품 확정
    overlay.querySelector('#submit8-btn-ok').onclick = () => {
      const startPrice     = parseInt(overlay.querySelector('#submit8-start-price').value, 10) || suggestedStart;
      const estimatedPrice = parseInt(overlay.querySelector('#submit8-est-price').value, 10)   || suggestedEst;

      if (startPrice < 1) {
        alert('시작가는 최소 $1 이상이어야 해요');
        return;
      }

      overlay.remove();
      callbacks && callbacks.onSubmit && callbacks.onSubmit({
        item,
        startPrice,
        estimatedPrice,
      });
    };
  }

  // ── 자체 출품 경매 결과 처리
  // selfItem    : 출품한 그림 아이템
  // winnerLabel : 낙찰자 문자열 ('me' 또는 CPU 참가자 이름)
  // finalPrice  : 최종 낙찰가
  // state       : 현재 게임 상태
  // 반환: { selfWon: bool, earnedMoney: number }
  function handleAuctionResult(selfItem, winnerLabel, finalPrice, state) {
    const selfWon = winnerLabel === 'me';

    if (selfWon) {
      // 본인 낙찰: 차감 0, 인벤토리 그대로 유지 (락-인 결정 9)
      return { selfWon: true, earnedMoney: 0 };
    } else {
      // 타인 낙찰: 낙찰가 지급 + 인벤토리에서 제거
      state.inventory = state.inventory.filter(it => it.id !== selfItem.id);
      state.money += finalPrice;
      return { selfWon: false, earnedMoney: finalPrice };
    }
  }

  global.MN9_Submit = { showSubmitDialog, handleAuctionResult };

})(typeof window !== 'undefined' ? window : globalThis);
