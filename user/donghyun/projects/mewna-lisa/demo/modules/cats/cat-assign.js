/* ============================================================
   cat-assign.js — 원본 그림에 고양이 배치 UI
   ============================================================
   비유: 내가 가진 원본 그림에 '담당 알바생(고양이)'을 붙여주는
   배치 담당 창구입니다. 배치된 고양이는 그 그림만 전문으로 모작하고
   완성되면 자동으로 팔아줘요.

   규칙:
   - 원본 그림에만 배치 가능 (모작에는 배치 X)
   - 고양이와 그림의 전문 종류(type)가 같아야 배치 가능
   - 고양이 1마리 = 그림 1장만 담당 (다른 그림에 배치하면 기존 해제)
   - 배치 해제 버튼으로 언제든 다시 뗄 수 있음
   ============================================================ */

;(function(global) {
  'use strict';

  // 그림 종류 한글 라벨
  function _typeLabel(type) {
    const MAP = {
      watercolor:  '수채화',
      pointillism: '점묘화',
      oilpainting: '유화',
      gratage:     '그라타주',
    };
    return MAP[type] || type;
  }

  // ── 고양이 배치 다이얼로그 열기
  // paintingItem : 인벤토리 아이템 (isOriginal === true 인 것)
  // state        : 현재 게임 상태
  // callbacks    : { onChange() } — 배치/해제 완료 후 화면 갱신용
  function showAssignDialog(paintingItem, state, callbacks) {
    const Cats = global.MN9_Cats;
    if (!Cats) return;

    // 원본만 배치 가능
    if (!paintingItem.isOriginal) {
      if (global.MN9_Game && global.MN9_Game.toast) {
        global.MN9_Game.toast('모작에는 고양이를 배치할 수 없어요 (원본만 가능)');
      }
      return;
    }

    // 영입했고 아직 다른 그림에 배치 안 된 고양이 중 type이 일치하는 것만
    const candidates = Object.entries(state.cats || {})
      .filter(([id, data]) => data.hired && !data.assignedPaintingId)
      .map(([id]) => Cats.CAT_DEFS[id])
      .filter(cat => cat && (cat.type === paintingItem.type || cat.id === 'gongja'));

    // 이미 이 그림에 배치된 고양이 (해제용)
    const currentEntry = Object.entries(state.cats || {})
      .find(([id, data]) => data.assignedPaintingId === paintingItem.id);
    const currentCat = currentEntry ? Cats.CAT_DEFS[currentEntry[0]] : null;

    // 기존 모달 제거
    const oldOverlay = document.querySelector('.catassign-overlay');
    if (oldOverlay) oldOverlay.remove();

    // 모달 생성
    const overlay = document.createElement('div');
    overlay.className = 'catassign-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'background:rgba(20,15,8,0.88)',
      'z-index:9999', 'display:flex', 'align-items:center', 'justify-content:center',
    ].join(';');

    let html = `
      <div class="catassign-box" style="
        background:#2c2010;border:2px solid #806038;border-radius:12px;
        padding:32px;max-width:540px;width:90%;color:#e9d6a4;
        max-height:80vh;overflow-y:auto;
      ">
        <h2 style="margin:0 0 8px;color:#f5a700;font-size:1.2em;">
          🐱 「${paintingItem.title}」에 고양이 배치
        </h2>
        <p style="margin:0 0 16px;font-size:0.9em;color:#b8a070;">
          ${_typeLabel(paintingItem.type)} 전문 고양이가 이 그림을 전담해서 모작하고 자동으로 팔아줘요.
        </p>
    `;

    // 현재 배치된 고양이 표시 + 해제 버튼
    if (currentCat) {
      html += `
        <div style="background:#3d2c18;border:1px solid #806038;border-radius:8px;padding:14px;margin-bottom:16px;">
          <div style="font-size:0.85em;color:#b8a070;margin-bottom:6px;">현재 배치된 고양이</div>
          <div style="font-size:1.1em;font-weight:bold;">${currentCat.emoji} ${currentCat.name}</div>
          <div style="font-size:0.82em;color:#b8a070;margin-top:4px;">
            ${currentCat.autoIntervalSec}초마다 모작 / 등급 보정 +${currentCat.gradeBonus || 0}
          </div>
          <button id="catassign-unassign" style="
            margin-top:12px;background:#553e25;color:#e9d6a4;
            padding:8px 18px;border:none;border-radius:6px;cursor:pointer;font-size:0.9em;
          ">배치 해제</button>
        </div>
      `;
    }

    // 배치 가능한 고양이 목록
    if (candidates.length === 0 && !currentCat) {
      html += `
        <p style="color:#b8a070;font-size:0.9em;">
          배치 가능한 ${_typeLabel(paintingItem.type)} 전문 고양이가 없어요.<br>
          고양이 시장에서 영입하거나, 이미 다른 그림에 배치된 고양이를 해제해보세요.
        </p>
      `;
    } else if (candidates.length > 0) {
      html += `<p style="font-size:0.9em;margin:0 0 10px;color:#c8b880;">배치할 고양이를 선택하세요:</p>`;
      candidates.forEach(cat => {
        html += `
          <button class="catassign-pick" data-cat-id="${cat.id}" style="
            display:block;width:100%;text-align:left;
            padding:14px 16px;margin:6px 0;
            background:#3d2c18;border:1px solid #806038;border-radius:8px;
            color:#e9d6a4;cursor:pointer;
          ">
            <span style="font-size:1.2em;">${cat.emoji}</span>
            <strong style="margin-left:6px;">${cat.name}</strong><br>
            <small style="color:#b8a070;margin-left:2px;">
              ${cat.autoIntervalSec}초마다 1장 / 등급 보정 +${cat.gradeBonus || 0}
            </small>
          </button>
        `;
      });
    }

    html += `
      <button id="catassign-close" style="
        margin-top:18px;background:#444;color:#fff;
        padding:10px 22px;border:none;border-radius:6px;cursor:pointer;
      ">닫기</button>
      </div>
    `;

    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    // 닫기
    overlay.querySelector('#catassign-close').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    // 배치 해제
    const btnUnassign = overlay.querySelector('#catassign-unassign');
    if (btnUnassign) {
      btnUnassign.onclick = () => {
        if (currentEntry) {
          state.cats[currentEntry[0]].assignedPaintingId = null;
        }
        if (global.MN9_State) global.MN9_State.saveState(state);
        overlay.remove();
        callbacks && callbacks.onChange && callbacks.onChange();
      };
    }

    // 고양이 선택 → 배치
    overlay.querySelectorAll('.catassign-pick').forEach(btn => {
      btn.onclick = () => {
        const catId = btn.dataset.catId;

        // 이 고양이가 혹시 다른 그림에 배치돼 있으면 먼저 해제 (방어 처리)
        Object.entries(state.cats).forEach(([id, data]) => {
          if (id === catId && data.assignedPaintingId) {
            data.assignedPaintingId = null;
          }
        });

        // 배치
        state.cats[catId].assignedPaintingId = paintingItem.id;
        state.cats[catId].lastCopyAt = Date.now();

        if (global.MN9_State) global.MN9_State.saveState(state);
        overlay.remove();
        callbacks && callbacks.onChange && callbacks.onChange();
      };
    });
  }

  global.MN9_CatAssign = { showAssignDialog };

})(typeof window !== 'undefined' ? window : globalThis);
