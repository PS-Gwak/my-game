/* ============================================================
   brush.js — 붓 레벨 1~5 → 포인터(마우스 커서) 크기 변환
   ============================================================
   비유: 실제 붓처럼 레벨이 높을수록 붓 끝이 굵어집니다.
   붓 레벨은 캔버스 위에서 그려지는 원의 크기(픽셀)만 바꾸고,
   게임 점수나 등급에는 영향이 없어요.

   붓 레벨 → 포인터 반지름 (px):
     1단계 →  8 px  (가는 붓)
     2단계 → 12 px
     3단계 → 16 px
     4단계 → 24 px
     5단계 → 32 px  (두꺼운 붓)
   ============================================================ */

(function (global) {
  'use strict';

  // 붓 레벨별 포인터 반지름 (픽셀). 인덱스 0은 사용 안 함 (레벨 1부터 시작)
  const BRUSH_RADIUS = [0, 8, 12, 16, 24, 32];

  // 붓 레벨 → 반지름 반환. 범위 벗어나면 가장 가까운 끝값 반환
  function getRadius(brushLevel) {
    const lvl = Math.max(1, Math.min(5, brushLevel || 1));
    return BRUSH_RADIUS[lvl];
  }

  // 붓 레벨 한글 설명 (UI 표시용)
  function getLabel(brushLevel) {
    const lvl = Math.max(1, Math.min(5, brushLevel || 1));
    const r = BRUSH_RADIUS[lvl];
    const names = ['', '가는 붓', '보통 붓', '굵은 붓', '넓은 붓', '평붓'];
    return `${names[lvl]} (${r}px)`;
  }

  global.MN9_Brush = { getRadius, getLabel, BRUSH_RADIUS };

})(typeof window !== 'undefined' ? window : globalThis);
