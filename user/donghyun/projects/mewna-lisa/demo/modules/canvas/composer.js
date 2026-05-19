/* ============================================================
   composer.js — 모작 긁기 엔진 v9 (Phase 2 B3·B4·V1·A1 통합)
   ============================================================
   비유: 원본 그림 위에 회색 안개막을 덮어두고,
   마우스로 문질러 안개막을 걷어내면 그림이 드러남.
   90% 이상 걷어내면 "완성!" 처리.
   시작 시 캔버스는 항상 1단계(blur 20px + sat 0.2) 고정.
   완성 후에만 물감 레벨에 맞는 필터로 부드럽게 전환.
   ============================================================ */

;(function(global) {
  'use strict';

  // 물감 레벨(0~4)별 흐림 강도(px) — 높을수록 또렷
  const BLUR_BY_PAINT = [20, 15, 10, 5, 0];
  // 물감 레벨(0~4)별 채도 — 높을수록 컬러풀
  const SAT_BY_PAINT  = [0.2, 0.4, 0.6, 0.8, 1.0];
  // 완성 임계 기본값: 90% (V1)
  const COMPLETE_THRESHOLD_DEFAULT = 0.90;

  // V1: 디버그 패널 슬라이더 값 반영 (state.debug.completeThreshold)
  function getThreshold() {
    const d = (global.MN9_Game && global.MN9_Game.state && global.MN9_Game.state()) || {};
    const t = d.debug && d.debug.completeThreshold;
    return (typeof t === 'number' && t >= 0.5 && t <= 0.99) ? t : COMPLETE_THRESHOLD_DEFAULT;
  }

  // A1: 붓 끝 색상 (기법별)
  const TIP_COLORS = {
    watercolor:  '#4a90d9',
    pointillism: '#f5a700',
    oilpainting: '#d9534f',
    gratage:     '#666',
  };

  function createComposer({
    type, brushRadius, paintLevel, paintingEntry,
    wristMode = false,
    onProgress, onComplete
  }) {
    const W = 640, H = 480;

    // 컨테이너 박스 (이미지 + 덮개 캔버스를 겹치게 담는 그릇)
    const box = document.createElement('div');
    box.className = 'mn9-canvas-box';
    box.style.cssText = 'position:relative;width:640px;height:480px;border:2px solid #553e25;border-radius:8px;overflow:hidden;background:#1a1208;';

    // 레이어 0: 원본 이미지 — B4: 시작 시 항상 blur(20px) saturate(0.2) 고정
    const bgImg = document.createElement('img');
    bgImg.src = `assets/paintings/${paintingEntry.filename}`;
    bgImg.alt = paintingEntry.title || '원본 그림';
    bgImg.style.cssText = `
      position:absolute;top:0;left:0;
      width:640px;height:480px;object-fit:cover;
      filter:blur(20px) saturate(0.2);
      transition: filter 1.0s linear;
      pointer-events:none;
    `;
    box.appendChild(bgImg);

    // 레이어 1: 덮개 캔버스 (회색 반투명 안개막)
    const cover = document.createElement('canvas');
    cover.width = W; cover.height = H;
    cover.className = 'mn9-cover';
    cover.style.cssText = `
      position:absolute;top:0;left:0;
      width:640px;height:480px;
      cursor:none;
      touch-action:none;
    `;
    const ctx = cover.getContext('2d');
    // 시작 시 캔버스 전체를 흰색으로 채움 (B4 명세: 초기 상태 = 흰색)
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillRect(0, 0, W, H);
    box.appendChild(cover);

    let done = false;
    let isDrawing = false;
    let lastProgressTime = 0;

    // 마우스/터치 좌표를 캔버스 내부 좌표로 변환
    function getPos(e) {
      const rect = cover.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      const touch = e.touches && e.touches[0];
      const clientX = touch ? touch.clientX : e.clientX;
      const clientY = touch ? touch.clientY : e.clientY;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    }

    // 안개막에 구멍 뚫기 — destination-out 합성 모드 사용
    function rub(x, y) {
      if (done) return;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, brushRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 60ms 단위로만 진행률 계산 (성능 보호)
      const now = performance.now();
      if (now - lastProgressTime > 60) {
        lastProgressTime = now;
        const coverage = calcErased(ctx, W, H);
        onProgress && onProgress(coverage);
        // V1: getThreshold()로 임계 읽기 / B4: 완성 시 물감 레벨 필터로 전환
        if (coverage >= getThreshold() && !done) {
          done = true;
          const lv = Math.max(0, Math.min(4, paintLevel || 0));
          bgImg.style.filter = `blur(${BLUR_BY_PAINT[lv]}px) saturate(${SAT_BY_PAINT[lv]})`;
          ctx.clearRect(0, 0, W, H);
          cover.style.outline = '4px solid #f5a700';
          setTimeout(() => onComplete && onComplete(), 1200);
        }
      }
    }

    // B3: 손목/일반 모드 기능 격리
    if (wristMode) {
      // 손목 보호 모드: mousemove만 등록. mousedown은 무시 (등록 안 함)
      // B3: mousedown suppress 로직 제거 — mousemove만으로 격리
      cover.addEventListener('mousemove', e => {
        const {x, y} = getPos(e); rub(x, y);
      });
      cover.addEventListener('touchmove', e => {
        e.preventDefault();
        const {x, y} = getPos(e); rub(x, y);
      }, { passive: false });
    } else {
      // 기본 모드: 클릭+드래그
      cover.addEventListener('mousedown', e => {
        isDrawing = true;
        const {x, y} = getPos(e); rub(x, y);
      });
      cover.addEventListener('mousemove', e => {
        if (!isDrawing) return;
        const {x, y} = getPos(e); rub(x, y);
      });
      cover.addEventListener('mouseup',    () => { isDrawing = false; });
      cover.addEventListener('mouseleave', () => { isDrawing = false; });
      cover.addEventListener('touchstart', e => {
        e.preventDefault();
        isDrawing = true;
        const {x, y} = getPos(e); rub(x, y);
      }, { passive: false });
      cover.addEventListener('touchmove', e => {
        e.preventDefault();
        if (!isDrawing) return;
        const {x, y} = getPos(e); rub(x, y);
      }, { passive: false });
      cover.addEventListener('touchend', () => { isDrawing = false; });
    }

    // A1: 붓 커서 (인라인 SVG)
    const brush = document.createElement('div');
    brush.className = 'mn9-brush-cursor';
    const tipColor = TIP_COLORS[type] || '#f5a700';
    brush.innerHTML = `
      <svg width="32" height="40" viewBox="0 0 32 40" style="overflow:visible;">
        <rect x="14" y="0" width="4" height="22" fill="#553e25" rx="1"/>
        <rect x="12" y="20" width="8" height="4" fill="#c0a060"/>
        <path d="M13 24 L19 24 L17 38 L15 38 Z" fill="#3a2a14"/>
        <ellipse cx="16" cy="38" rx="2" ry="1.2" fill="${tipColor}"/>
      </svg>
    `;
    brush.style.cssText = `
      position:absolute; pointer-events:none;
      width:32px; height:40px;
      transform: translate(-16px, -38px) rotate(0deg);
      z-index:20;
      filter: drop-shadow(2px 4px 3px rgba(0,0,0,0.4));
      opacity:0;
    `;
    box.appendChild(brush);

    cover.addEventListener('mouseenter', () => { brush.style.opacity = '1'; });
    cover.addEventListener('mouseleave', () => {
      // wristMode에서는 그림 영역을 벗어나도 붓 항상 표시
      if (!wristMode) brush.style.opacity = '0';
    });
    cover.addEventListener('mousemove', e => {
      const rect = cover.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const tilt = (isDrawing || wristMode) ? -12 : 0;
      brush.style.transform = `translate(${px - 16}px, ${py - 38}px) rotate(${tilt}deg)`;
    });

    function destroy() {
      // 리스너 해제는 box 통째 DOM 제거로 처리
      box.remove();
    }

    return { canvas: box, destroy };
  }

  // 안개막 중 지워진(알파 < 50) 픽셀 비율 계산
  function calcErased(ctx, W, H) {
    const data = ctx.getImageData(0, 0, W, H).data;
    let erased = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 50) erased++;
    }
    return erased / (W * H);
  }

  global.MN9_Composer = {
    createComposer,
    COMPLETE_THRESHOLD_DEFAULT,
    getThreshold,
    BLUR_BY_PAINT,
    SAT_BY_PAINT,
  };

})(typeof window !== 'undefined' ? window : globalThis);
