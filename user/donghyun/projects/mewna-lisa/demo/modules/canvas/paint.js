/* ============================================================
   paint.js — 물감 레벨 0~4 → 채도(색 진함) + 4종 팔레트
   ============================================================
   비유: 실제 물감처럼 레벨이 높을수록 색이 진해집니다.
   레벨 0 = 거의 흑백, 레벨 4 = 원본 그림 색 그대로.
   물감은 그림 종류별로 따로 구입해야 해요.

   물감 레벨 → saturation(채도):
     0단계 →   0% (흑백)
     1단계 →  25%
     2단계 →  50%
     3단계 →  75%
     4단계 → 100% (풀컬러)

   팔레트 (그림 종류별 어울리는 색 조합):
   - watercolor  : 파스텔 계열 (연한 파랑·분홍·연두)
   - pointillism : 원색 점 (빨강·파랑·노랑·초록)
   - oilpainting : 흙빛 고전 (황토·갈색·진한 빨강·군청)
   - gratage     : 어두운 스크래치 (검정 바탕 + 원색 노출)
   ============================================================ */

(function (global) {
  'use strict';

  // 물감 레벨 → CSS filter saturation 값 (0~1 사이 소수)
  const SATURATION_TABLE = [0, 0.25, 0.50, 0.75, 1.00];

  // 그림 종류별 팔레트 (붓질에 사용할 색 목록. HSL 형식)
  const PALETTES = {
    watercolor: [
      'hsl(200, 70%, 70%)',  // 하늘파랑
      'hsl(330, 60%, 75%)',  // 연분홍
      'hsl(120, 50%, 70%)',  // 연두
      'hsl(50,  65%, 75%)',  // 연노랑
      'hsl(270, 50%, 75%)',  // 라벤더
    ],
    pointillism: [
      'hsl(0,   90%, 55%)',  // 빨강
      'hsl(220, 85%, 55%)',  // 파랑
      'hsl(50,  90%, 50%)',  // 노랑
      'hsl(120, 70%, 45%)',  // 초록
      'hsl(300, 70%, 55%)',  // 보라
    ],
    oilpainting: [
      'hsl(35,  70%, 45%)',  // 황토
      'hsl(20,  60%, 35%)',  // 갈색
      'hsl(0,   65%, 40%)',  // 진한 빨강
      'hsl(210, 55%, 35%)',  // 군청
      'hsl(45,  50%, 55%)',  // 금빛
    ],
    gratage: [
      'hsl(0,   90%, 60%)',  // 스크래치 빨강
      'hsl(50,  95%, 60%)',  // 스크래치 노랑
      'hsl(200, 80%, 65%)',  // 스크래치 파랑
      'hsl(120, 75%, 55%)',  // 스크래치 초록
      'hsl(280, 80%, 65%)',  // 스크래치 보라
    ],
  };

  // 기본 팔레트 (알 수 없는 종류일 때 폴백)
  const DEFAULT_PALETTE = PALETTES.watercolor;

  // 물감 레벨 → saturation 값 반환 (0~1)
  function getSaturation(paintLevel) {
    const lvl = Math.max(0, Math.min(4, paintLevel || 0));
    return SATURATION_TABLE[lvl];
  }

  // 그림 종류 → 팔레트 배열 반환
  function getPalette(type) {
    return PALETTES[type] || DEFAULT_PALETTE;
  }

  // 팔레트에서 색 하나 랜덤 선택
  function pickColor(type) {
    const palette = getPalette(type);
    return palette[Math.floor(Math.random() * palette.length)];
  }

  // 물감 레벨 한글 설명 (UI 표시용)
  function getLabel(paintLevel) {
    const lvl = Math.max(0, Math.min(4, paintLevel || 0));
    const sat = Math.round(SATURATION_TABLE[lvl] * 100);
    const names = ['미구입 (흑백)', '1단계 (연한 색)', '2단계 (보통)', '3단계 (진한 색)', '4단계 (풀컬러)'];
    return `${names[lvl]} — 채도 ${sat}%`;
  }

  global.MN9_Paint = { getSaturation, getPalette, pickColor, getLabel, PALETTES, SATURATION_TABLE };

})(typeof window !== 'undefined' ? window : globalThis);
