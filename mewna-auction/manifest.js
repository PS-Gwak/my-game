/* ============================================================
   manifest.js — 그림 20장 메타데이터 (file:// 에서 fetch 차단 우회용 인라인)
   ============================================================
   비유: 도서관 카탈로그를 외부 파일에서 가져오는 게 아니라
   책상에 미리 펼쳐 놓는 방식입니다. Safari가 로컬 파일에서
   외부 요청을 막아도 이건 항상 바로 읽을 수 있어요.

   그림 메타데이터 항목:
   - id       : 고유 식별 코드 (type_grade)
   - type     : 종류 (watercolor / pointillism / oilpainting / gratage)
   - grade    : 원본 희귀도 (1~5, 5가 제일 귀함)
   - filename : assets/paintings/ 안의 파일명
   - title    : 그림 제목
   - artist   : 화가 이름
   - basePrice: 원본 기준가 ($) — 모작 가격 = basePrice × 모작등급 × 0.2

   사용:
     window.MN9_MANIFEST.paintings[type] → 해당 종류 배열
   ============================================================ */

(function (global) {
  'use strict';

  global.MN9_MANIFEST = {
    paintings: {

      // ── 수채화 (watercolor) ──────────────────────────────────
      watercolor: [
        {
          id: 'watercolor_1', type: 'watercolor', grade: 1,
          filename: 'watercolor_1.jpg',
          title: '진주귀걸이를 한 소녀', artist: '베르메르',
          basePrice: 100,
        },
        {
          id: 'watercolor_2', type: 'watercolor', grade: 2,
          filename: 'watercolor_2.jpg',
          title: '안개바다 위의 방랑자', artist: '카스파 다비드 프리드리히',
          basePrice: 200,
        },
        {
          id: 'watercolor_3', type: 'watercolor', grade: 3,
          filename: 'watercolor_3.webp',
          title: '발레리나', artist: '드가',
          basePrice: 400,
        },
        {
          id: 'watercolor_4', type: 'watercolor', grade: 4,
          filename: 'watercolor_4.jpg',
          title: '수련', artist: '모네',
          basePrice: 800,
        },
        {
          id: 'watercolor_5', type: 'watercolor', grade: 5,
          filename: 'watercolor_5.jpg',
          title: '타히티의 여인들', artist: '고갱',
          basePrice: 1600,
        },
      ],

      // ── 점묘화 (pointillism) ─────────────────────────────────
      pointillism: [
        {
          id: 'pointillism_1', type: 'pointillism', grade: 1,
          filename: 'pointillism_1.jpeg',
          title: '춤', artist: '마티스',
          basePrice: 5000,
        },
        {
          id: 'pointillism_2', type: 'pointillism', grade: 2,
          filename: 'pointillism_2.jpeg',
          title: 'No. 14', artist: '로스코',
          basePrice: 10000,
        },
        {
          id: 'pointillism_3', type: 'pointillism', grade: 3,
          filename: 'pointillism_3.jpeg',
          title: '마릴린 먼로', artist: '워홀',
          basePrice: 20000,
        },
        {
          id: 'pointillism_4', type: 'pointillism', grade: 4,
          filename: 'pointillism_4.jpeg',
          title: '나와 마을', artist: '샤갈',
          basePrice: 40000,
        },
        {
          id: 'pointillism_5', type: 'pointillism', grade: 5,
          filename: 'pointillism_5.png',
          title: '아비뇽의 여인들', artist: '피카소',
          basePrice: 80000,
        },
      ],

      // ── 유화 (oilpainting) ───────────────────────────────────
      oilpainting: [
        {
          id: 'oilpainting_1', type: 'oilpainting', grade: 1,
          filename: 'oilpainting_1.jpeg',
          title: '아테네 학당', artist: '라파엘',
          basePrice: 40000,
        },
        {
          id: 'oilpainting_2', type: 'oilpainting', grade: 2,
          filename: 'oilpainting_2.jpeg',
          title: '천지창조', artist: '미켈란젤로',
          basePrice: 80000,
        },
        {
          id: 'oilpainting_3', type: 'oilpainting', grade: 3,
          filename: 'oilpainting_3.avif',
          title: '메두사', artist: '카라바조',
          basePrice: 160000,
        },
        {
          id: 'oilpainting_4', type: 'oilpainting', grade: 4,
          filename: 'oilpainting_4.jpg',
          title: '야경', artist: '렘브란트',
          basePrice: 320000,
        },
        {
          id: 'oilpainting_5', type: 'oilpainting', grade: 5,
          filename: 'oilpainting_5.jpg',
          title: '모나리자', artist: '다빈치',
          basePrice: 640000,
        },
      ],

      // ── 그라타주 (gratage) ───────────────────────────────────
      gratage: [
        {
          id: 'gratage_1', type: 'gratage', grade: 1,
          filename: 'gratage_1.jpg',
          title: '그네', artist: '프라고나르',
          basePrice: 100000,
        },
        {
          id: 'gratage_2', type: 'gratage', grade: 2,
          filename: 'gratage_2.jpeg',
          title: '1808년 5월 3일', artist: '고야',
          basePrice: 200000,
        },
        {
          id: 'gratage_3', type: 'gratage', grade: 3,
          filename: 'gratage_3.jpg',
          title: '기억의 지속', artist: '달리',
          basePrice: 400000,
        },
        {
          id: 'gratage_4', type: 'gratage', grade: 4,
          filename: 'gratage_4.jpg',
          title: '풍선 든 소녀', artist: '뱅크시',
          basePrice: 800000,
        },
        {
          id: 'gratage_5', type: 'gratage', grade: 5,
          filename: 'gratage_5.png',
          title: '피에타', artist: '미켈란젤로',
          basePrice: 1600000,
        },
      ],
    },
  };

})(typeof window !== 'undefined' ? window : globalThis);
