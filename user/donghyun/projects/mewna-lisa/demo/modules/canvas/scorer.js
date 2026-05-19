/* ============================================================
   scorer.js — 모작 완성 시 등급·가격 결정 (확률 + 물감레벨 보정)
   ============================================================
   비유: 그림이 완성되면 이 '심사위원'이 주사위를 굴려 등급을
   정하고, 물감을 얼마나 좋은 걸 썼는지에 따라 보정을 더합니다.

   락-인된 점수 산식 (feedback-v7-checklist.md §P0-7 + architect §3.6):
   - BASE_PROBS: 1~6등급 기본 확률 [30%, 25%, 20%, 15%, 8%, 2%]
   - 최종 등급 = min(weightedPick(BASE_PROBS) + round(paintLevel × 0.25), 10)
   - 물감레벨 0 → 보정 0, 레벨 4 → 보정 +1 (round(4 × 0.25) = 1)
   - 확률 표시 시점: 모작 시작 전 (architect §3.6 결정)

   등급 라벨:
   1 동별1 · 2 동별2 · 3 동별3 · 4 은별1 · 5 은별2 · 6 은별3
   7 금별1 · 8 금별2 · 9 금별3 · 10 다이아 (원본과 구별 불가)

   가격 공식 (Phase 4 갱신):
   basePrice × (counterfeitGrade / 10)
   — 다이아(10) = basePrice 100%, 동별1(1) = basePrice 10%
   ============================================================ */

(function (global) {
  'use strict';

  // 등급 라벨 (1~10)
  const GRADE_LABELS = {
    1: '동별1', 2: '동별2', 3: '동별3',
    4: '은별1', 5: '은별2', 6: '은별3',
    7: '금별1', 8: '금별2', 9: '금별3',
    10: '다이아',
  };

  // 1~6등급 기본 확률 배열 (합계 100%)
  // 인덱스 0 = 1등급(30%), 인덱스 5 = 6등급(2%)
  const BASE_PROBS = [30, 25, 20, 15, 8, 2];

  // 등급 라벨 반환
  function gradeLabel(g) {
    return GRADE_LABELS[Math.max(1, Math.min(10, g || 1))] || '?';
  }

  // 가중치 주사위 — BASE_PROBS 배열로 1~6 중 하나 뽑기
  // 비유: 주머니에서 무작위로 공 하나 꺼내는데, 동별1 공이 제일 많이 들어있음
  function weightedPick(probs) {
    const total = probs.reduce((a, b) => a + b, 0);
    let rand = Math.random() * total;
    for (let i = 0; i < probs.length; i++) {
      rand -= probs[i];
      if (rand <= 0) return i + 1; // 1부터 시작하는 등급
    }
    return probs.length; // 안전망
  }

  // 물감레벨 보정값 계산 (0~4 → 0~+1)
  function paintBonus(paintLevel) {
    const lvl = Math.max(0, Math.min(4, paintLevel || 0));
    return Math.round(lvl * 0.25);
  }

  // 최종 등급 결정
  // paintLevel: 0~4 (해당 그림 종류의 물감 레벨)
  // 반환: 1~10 사이 정수
  function rollGrade(paintLevel) {
    const base = weightedPick(BASE_PROBS);     // 1~6 기본 등급
    const bonus = paintBonus(paintLevel);       // 0 또는 +1
    return Math.min(10, base + bonus);          // 최대 10 (다이아)
  }

  // 가격 계산 (원본 기준가 × 모작등급 / 10)
  // 비유: 원본 가격을 100%라 할 때, 다이아(10등급)=100%, 동별1(1등급)=10%
  // basePrice: manifest의 원본 기준가 (없으면 $100 기본)
  function computePrice(originalGrade, counterfeitGrade, basePrice) {
    const cg = Math.max(1, Math.min(10, counterfeitGrade));
    return Math.round((basePrice || 100) * (cg / 10));
  }

  // 확률 미리보기 텍스트 (모작 시작 전 UI에 표시)
  // paintLevel을 넣으면 보정 후 실제 확률 분포를 텍스트로 만들어 줌
  function getProbabilityPreview(paintLevel) {
    const bonus = paintBonus(paintLevel);
    // bonus가 있으면 등급이 한 칸씩 위로 올라감
    // 예: bonus=1 → 30%가 2등급, 25%가 3등급, ... 2%가 7등급
    const lines = [];
    for (let i = 0; i < BASE_PROBS.length; i++) {
      const grade = Math.min(10, i + 1 + bonus);
      const prob  = BASE_PROBS[i];
      lines.push(`${gradeLabel(grade)} ${prob}%`);
    }
    if (bonus > 0) {
      lines.push(`(물감 레벨 ${paintLevel} → +${bonus} 보정 적용)`);
    }
    return lines;
  }

  global.MN9_Scorer = {
    rollGrade,
    computePrice,
    gradeLabel,
    paintBonus,
    getProbabilityPreview,
    BASE_PROBS,
    GRADE_LABELS,
  };

})(typeof window !== 'undefined' ? window : globalThis);
