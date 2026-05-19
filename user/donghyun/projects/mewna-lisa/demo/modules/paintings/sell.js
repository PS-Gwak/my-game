/* ============================================================
   sell.js — 판매 UX (모작 완성 후 등급·원본가·받을 금액 → 판매 버튼)
   ============================================================
   비유: 그림이 완성되면 "이 그림 어떻게 할까요?" 창이 뜹니다.
   등급과 받을 금액을 먼저 보여주고, 「판매」 버튼을 눌러야 비로소
   돈이 들어와요. 보관하고 싶으면 「보관」을 누르면 인벤토리에 들어가요.

   락-인 결정 7: 판매 UX = 등급·원본가·받을 금액 먼저 보여주고 판매
   ============================================================ */

(function (global) {
  'use strict';

  // ── 판매/보관 선택 모달
  // item      : 방금 완성된 모작 결과 아이템
  //   { id, type, grade, filename, title, artist, counterfeitGrade, value }
  // callbacks :
  //   onSell(item)  → 판매 선택 시
  //   onKeep(item)  → 보관 선택 시
  function showSellDialog(item, callbacks) {
    const Scorer = global.MN9_Scorer;

    // 기존 모달 제거 (중복 방지)
    const old = document.querySelector('.sell8-overlay');
    if (old) old.remove();

    const gradeText  = Scorer ? Scorer.gradeLabel(item.counterfeitGrade) : `${item.counterfeitGrade}등급`;
    const valueText  = `$${item.value.toLocaleString('en-US')}`;
    const originalGradeText = `${item.grade}등급`;

    const overlay = document.createElement('div');
    overlay.className = 'sell8-overlay';

    overlay.innerHTML = `
      <div class="sell8-box">

        <!-- 모작 완성 타이틀 -->
        <div class="sell8-header">
          <div class="sell8-congrats">모작 완성!</div>
          <div class="sell8-painting-name">${item.title}</div>
        </div>

        <!-- V2 패치: 완성된 원본 그림 큰 미리보기 -->
        <div class="sell8-painting-img-wrap" style="text-align:center;margin:8px 0 12px;">
          <img src="assets/paintings/${item.filename}" alt="${item.title || '원본 그림'}"
               style="width:200px;max-width:100%;border-radius:8px;border:2px solid #c0a060;box-shadow:0 0 12px rgba(245,167,0,0.3);">
        </div>

        <!-- 결과 정보 (등급·원본가·받을 금액) -->
        <div class="sell8-result-rows">
          <div class="sell8-row">
            <span class="sell8-row-label">모작 등급</span>
            <span class="sell8-row-value sell8-grade">${gradeText}</span>
          </div>
          <div class="sell8-row">
            <span class="sell8-row-label">원본 희귀도</span>
            <span class="sell8-row-value">${originalGradeText}</span>
          </div>
          <div class="sell8-row sell8-row-highlight">
            <span class="sell8-row-label">받을 금액</span>
            <span class="sell8-row-value sell8-money">${valueText}</span>
          </div>
        </div>

        <!-- 선택 버튼 -->
        <div class="sell8-actions">
          <button class="primary sell8-btn" id="sell8-btn-sell">
            💰 판매하기
            <span class="sell8-btn-sub">${valueText} 즉시 수령</span>
          </button>
          <button class="sell8-btn" id="sell8-btn-keep">
            📦 보관하기
            <span class="sell8-btn-sub">인벤토리에 넣어두기 (나중에 팔거나 출품 가능)</span>
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);

    // 판매 버튼
    overlay.querySelector('#sell8-btn-sell').onclick = () => {
      overlay.remove();
      callbacks && callbacks.onSell && callbacks.onSell(item);
    };

    // 보관 버튼
    overlay.querySelector('#sell8-btn-keep').onclick = () => {
      overlay.remove();
      callbacks && callbacks.onKeep && callbacks.onKeep(item);
    };
  }

  global.MN9_Sell = { showSellDialog };

})(typeof window !== 'undefined' ? window : globalThis);
