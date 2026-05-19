/* ============================================================
   inventory.js — 보유 그림 화면
   ============================================================
   비유: 지금까지 만든 모작들을 한 눈에 볼 수 있는 '그림 보관함'입니다.
   클릭하면 화면 중앙에 크게 보여주고, 그림 종류에 따라 다른 선택지를
   보여줘요.
   - 원본 그림: 「모작 그리기」 + 「고양이 배치」
   - 내가 만든 모작: 「팔기」 (금별1 이상 + 해금 시 「자체 출품」)

   락-인 결정 12: 보유 그림 UI = 화면 중앙 가장 크게 + 이미지 +
   종류별 선택지 (Phase 4 D1~D5 적용)
   ============================================================ */

(function (global) {
  'use strict';

  // ── Phase 4 D5: 금별1 = 7등급 (scorer.js 기준, 라인 29 확인)
  var GOLD_1_GRADE = 7;

  // ── D2·D3·D4·D5: 그림 종류에 따라 버튼 HTML 결정
  // item               : 그림 데이터 객체
  // selfListingUnlocked: 자체 출품 해금 여부 (bool)
  function renderActions(item, selfListingUnlocked) {
    if (item.isOriginal) {
      // D2: 원본 그림 → 모작 그리기 + 고양이 배치 (팔기 X)
      return `
        <button class="primary inv8-action-btn" id="inv8-btn-copy">
          🖌 모작 그리기
          <span class="inv8-action-sub">이 그림을 보고 붓질 시작</span>
        </button>
        <button class="inv8-action-btn" id="inv8-btn-assign-cat">
          🐱 고양이 배치
          <span class="inv8-action-sub">고양이가 자동으로 모작을 만들어요 (Phase 5에서 연결)</span>
        </button>
      `;
    } else {
      // D3·D4: 모작 → 팔기
      // D5: 금별1 이상 + 해금 시 자체 출품 추가
      var isGoldOrHigher = (item.counterfeitGrade || 0) >= GOLD_1_GRADE;
      var html = `
        <button class="primary inv8-action-btn" id="inv8-btn-sell">
          💰 팔기
          <span class="inv8-action-sub">$${item.value ? item.value.toLocaleString('en-US') : 0} 즉시 수령</span>
        </button>
      `;
      if (selfListingUnlocked && isGoldOrHigher) {
        html += `
          <button class="inv8-action-btn inv8-action-submit" id="inv8-btn-submit">
            🏛 자체 출품
            <span class="inv8-action-sub">경매에 직접 내놓기 — 시작가·예상가 내가 결정</span>
          </button>
        `;
      }
      return html;
    }
  }

  // ── 인벤토리 목록 렌더
  // container  : 그림 목록을 넣을 DOM 요소
  // inventory  : state.inventory 배열
  // callbacks  :
  //   onMakeCopy(item)       → 이 그림 모작 그리기 선택 시
  //   onSell(item)           → 모작 팔기 선택 시
  //   onSelfSubmit(item)     → 자체 출품 선택 시 (해금 후)
  //   selfListingUnlocked    → 자체 출품 해금 여부 (bool)
  function renderInventory(container, inventory, callbacks) {
    if (!container) return;

    if (!inventory || inventory.length === 0) {
      container.innerHTML = '<div class="inv8-empty">아직 그림이 없어요.<br>작업실에서 원본을 골라 붓질을 시작해보세요!</div>';
      return;
    }

    const Scorer = global.MN9_Scorer;

    // D1: 원본 / 모작 두 그룹으로 분리
    var originals    = inventory.filter(function(it) { return it.isOriginal; });
    var counterfeits = inventory.filter(function(it) { return !it.isOriginal; });

    function renderCardList(list, startIdx) {
      return list.map(function(item, i) {
        var idx = startIdx + i;
        var gradeText = item.isOriginal
          ? '원본'
          : (Scorer ? Scorer.gradeLabel(item.counterfeitGrade) : item.counterfeitGrade) + '등급 모작';
        var valueText = item.isOriginal
          ? '원본 (모작 만들기용)'
          : '추정가 $' + (item.value ? item.value.toLocaleString('en-US') : 0);
        return `
          <div class="inv8-card" data-idx="${idx}">
            <img
              class="inv8-thumb"
              src="assets/paintings/${item.filename}"
              alt="${item.title}"
              onerror="this.style.display='none'"
            />
            <div class="inv8-info">
              <div class="inv8-title">${item.title}</div>
              <div class="inv8-grade">${gradeText}</div>
              <div class="inv8-value">${valueText}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    // D1: 두 섹션으로 렌더
    var originalsSection = originals.length > 0 ? `
      <div class="inv8-section">
        <h3 class="inv8-section-title">📜 원본 그림 (모작 만들기용)</h3>
        <div class="inv8-grid">${renderCardList(originals, 0)}</div>
      </div>
    ` : '';

    var counterfeitsSection = counterfeits.length > 0 ? `
      <div class="inv8-section">
        <h3 class="inv8-section-title">🎨 내가 만든 모작 (판매·출품용)</h3>
        <div class="inv8-grid">${renderCardList(counterfeits, originals.length)}</div>
      </div>
    ` : '';

    var emptyCounterfeits = counterfeits.length === 0 ? `
      <div class="inv8-section">
        <h3 class="inv8-section-title">🎨 내가 만든 모작 (판매·출품용)</h3>
        <div class="inv8-empty" style="padding:24px 0;">아직 만든 모작이 없어요. 위 원본을 클릭해 붓질을 시작해보세요!</div>
      </div>
    ` : '';

    container.innerHTML = originalsSection + (counterfeits.length > 0 ? counterfeitsSection : emptyCounterfeits);

    // 카드 클릭 → 상세 모달 띄우기
    container.querySelectorAll('.inv8-card').forEach(function(card) {
      card.onclick = function() {
        var idx = parseInt(card.getAttribute('data-idx'), 10);
        var item = inventory[idx];
        if (item) showDetailModal(item, callbacks);
      };
    });
  }

  // ── 그림 상세 모달 (화면 중앙에 크게)
  function showDetailModal(item, callbacks) {
    var Scorer = global.MN9_Scorer;
    var selfListingUnlocked = !!(callbacks && callbacks.selfListingUnlocked);

    // 기존 모달 제거
    var old = document.querySelector('.inv8-modal-overlay');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.className = 'inv8-modal-overlay';

    // 모달 상단 배지: 원본이면 「원본」, 모작이면 등급 표시
    var gradeBadge = item.isOriginal
      ? '<span class="inv8-badge inv8-badge-gold">📜 원본 그림</span>'
      : '<span class="inv8-badge">' + (Scorer ? Scorer.gradeLabel(item.counterfeitGrade) : item.counterfeitGrade) + ' 모작</span>' +
        '<span class="inv8-badge inv8-badge-gold">원본 ' + (item.grade || '') + '등급</span>';

    var valueLine = item.isOriginal
      ? ''
      : '<div class="inv8-modal-value">추정 판매가: <strong>$' + (item.value ? item.value.toLocaleString('en-US') : 0) + '</strong></div>';

    var catBadge = item.bycat
      ? '<span class="inv8-badge inv8-badge-cat">🐱 ' + item.bycat + ' 자동 모작</span>'
      : '';

    overlay.innerHTML = `
      <div class="inv8-modal-box">
        <button class="inv8-modal-close" id="inv8-close">✕ 닫기</button>

        <!-- 그림 크게 표시 -->
        <div class="inv8-modal-img-wrap">
          <img
            class="inv8-modal-img"
            src="assets/paintings/${item.filename}"
            alt="${item.title}"
            onerror="this.style.display='none'; document.getElementById('inv8-img-fallback').style.display='flex'"
          />
          <div class="inv8-modal-img-fallback" id="inv8-img-fallback" style="display:none;">
            그림을 불러올 수 없어요
          </div>
        </div>

        <!-- 그림 정보 -->
        <div class="inv8-modal-info">
          <div class="inv8-modal-title">${item.title}</div>
          <div class="inv8-modal-artist">${item.artist || ''}</div>
          <div class="inv8-modal-meta">
            ${gradeBadge}
            ${catBadge}
          </div>
          ${valueLine}
        </div>

        <!-- D2·D3·D4·D5: 종류별 선택지 버튼 -->
        <div class="inv8-modal-actions">
          ${renderActions(item, selfListingUnlocked)}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // 닫기
    overlay.querySelector('#inv8-close').onclick = function() { overlay.remove(); };
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    // D2: 원본 → 모작 그리기
    var btnCopy = overlay.querySelector('#inv8-btn-copy');
    if (btnCopy) {
      btnCopy.onclick = function() {
        overlay.remove();
        callbacks && callbacks.onMakeCopy && callbacks.onMakeCopy(item);
      };
    }

    // D2: 원본 → 고양이 배치 (Phase 5: cat-assign 모듈 연결)
    var btnCat = overlay.querySelector('#inv8-btn-assign-cat');
    if (btnCat) {
      btnCat.onclick = function() {
        overlay.remove();
        var CatAssign = global.MN9_CatAssign;
        var state = callbacks && callbacks.getState && callbacks.getState();
        if (CatAssign && state) {
          CatAssign.showAssignDialog(item, state, {
            onChange: function() {
              callbacks && callbacks.onAssignChanged && callbacks.onAssignChanged();
            },
          });
        } else if (global.MN9_Game && global.MN9_Game.toast) {
          global.MN9_Game.toast('고양이 배치 모듈을 불러오는 중이에요');
        }
      };
    }

    // D3·D4: 모작 → 팔기
    var btnSell = overlay.querySelector('#inv8-btn-sell');
    if (btnSell) {
      btnSell.onclick = function() {
        overlay.remove();
        callbacks && callbacks.onSell && callbacks.onSell(item);
      };
    }

    // D5: 자체 출품 (금별1+ + 해금 시만)
    var btnSubmit = overlay.querySelector('#inv8-btn-submit');
    if (btnSubmit) {
      btnSubmit.onclick = function() {
        overlay.remove();
        callbacks && callbacks.onSelfSubmit && callbacks.onSelfSubmit(item);
      };
    }
  }

  global.MN9_Inventory = { renderInventory, showDetailModal };

})(typeof window !== 'undefined' ? window : globalThis);
