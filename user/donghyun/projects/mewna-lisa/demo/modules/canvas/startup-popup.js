;(function(global) {
  'use strict';

  // 비개발자 메모: 새 게임 첫 진입 시 1회만 뜨는 조작 방식 선택 모달.
  // 「기본(클릭+드래그)」 vs 「손목 보호 모드(호버만)」 둘 중 하나.

  function showPopup(onSelected) {
    const overlay = document.createElement('div');
    overlay.id = 'mn9-startup-popup-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(20,15,8,0.85);
      z-index:9999;display:flex;align-items:center;justify-content:center;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background:#2c2010;border:2px solid #806038;border-radius:12px;
      padding:32px;max-width:520px;color:#e9d6a4;text-align:center;
      box-shadow:0 0 40px rgba(0,0,0,0.6);
    `;
    modal.innerHTML = `
      <h2 style="margin:0 0 20px;font-size:22px;color:#f5a700;">조작 방식을 선택해주세요</h2>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;opacity:0.85;">
        모작 작업을 어떻게 하시겠어요?<br>
        나중에 설정에서 바꿀 수 있어요.
      </p>
      <div style="display:flex;gap:16px;justify-content:center;">
        <button id="mn9-mode-normal" style="
          flex:1;padding:20px;background:#3d2c18;border:1px solid #806038;
          border-radius:8px;color:#e9d6a4;cursor:pointer;font-size:14px;
        ">
          🖱 <strong>기본 모드</strong><br>
          <span style="font-size:12px;opacity:0.7;">마우스를 누르고 그어요</span>
        </button>
        <button id="mn9-mode-wrist" style="
          flex:1;padding:20px;background:#3d2c18;border:1px solid #806038;
          border-radius:8px;color:#e9d6a4;cursor:pointer;font-size:14px;
        ">
          🤚 <strong>손목 보호 모드</strong><br>
          <span style="font-size:12px;opacity:0.7;">마우스를 움직이기만 하면 돼요</span>
        </button>
      </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    modal.querySelector('#mn9-mode-normal').onclick = () => {
      overlay.remove();
      onSelected(false);
    };
    modal.querySelector('#mn9-mode-wrist').onclick = () => {
      overlay.remove();
      onSelected(true);
    };
  }

  global.MN9_StartupPopup = { showPopup };

})(typeof window !== 'undefined' ? window : globalThis);
