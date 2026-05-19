/* ============================================================
   unlock.js — 해금 조건 확인 단일 창구
   ============================================================
   비유: 게임 안에 '문지기' 한 명만 두기로 약속했어요.
   어디서든 "그림 하나 추가됐어요"라고 알려주면, 이 문지기가
   조건을 확인하고 맞는 문을 열어줍니다.

   v8 해금 트리거 (Phase 4 보강, feedback-v7-checklist.md 계승):
   - 수채화 누적 4개   → 경매 1라운드 해금
   - 보유 그림 3개     → 점묘화 도구 등장 + 경매 3라운드
   - 보유 그림 5개     → 유화 도구 등장 + 경매 5라운드
   - 보유 그림 7개     → 그라타주 도구 등장
   - 금별1(7등급) 이상 모작 보유 → 자체 출품 해금
   - 그라타주 4등급 보유 + $30,000 → 박물관 엔딩 해금
   - 점묘 도구 해금    → 고양이 아티 등장
   - 유화 도구 해금    → 고양이 오일 등장
   - 그라타주 도구 해금 → 고양이 골드 등장
   - 박물관 엔딩 해금  → 고양이 공작 등장
   ============================================================ */

(function (global) {
  'use strict';

  // 토스트 메시지 콜백 (game.js가 주입)
  let _toastCallback = null;
  function setToastCallback(cb) { _toastCallback = cb; }
  function toast(msg) {
    if (_toastCallback) _toastCallback(msg);
    else console.log('[unlock]', msg);
  }

  // 가운데 빵 알림 콜백 (game.js가 주입) — Phase 4 언락 알림용
  let _centerNotifyCallback = null;
  function setCenterNotifyCallback(cb) { _centerNotifyCallback = cb; }

  // 가운데 빵 알림 + 토스트 동시 표시
  function notify(msg) {
    toast(msg);
    if (_centerNotifyCallback) _centerNotifyCallback(msg);
  }

  // ── 해금 조건 일괄 점검 (멱등성 보장 — 이미 열린 건 다시 안 열음)
  function checkUnlocks(state) {
    const u   = state.unlocks;
    const c   = state.counters;
    const inv = state.inventory.length;

    // cats 객체 없으면 초기화 (이전 저장 데이터 호환)
    if (!state.cats) {
      state.cats = {
        dorom_a: { hired: false }, // 수채화 A 단계 (시작부터)
        dorom_b: { hired: false }, // 수채화 B 단계
        ati:     { hired: false }, // 점묘 단계
        oil:     { hired: false }, // 유화 단계
        gold:    { hired: false }, // 그라타주 단계
        gongja:  { hired: false }, // 박물관 단계
      };
    }
    if (!u.catsUnlocked) {
      u.catsUnlocked = {
        dorom_a: true,  // 수채화 A는 처음부터 해금
        dorom_b: false,
        ati:     false,
        oil:     false,
        gold:    false,
        gongja:  false,
      };
    }

    const newlyUnlocked = [];

    // 1. 경매 해금 (수채화 누적 4)
    if (!u.auctionOpen && c.watercolorMade >= 4) {
      u.auctionOpen = true;
      u.auctionRounds = Math.max(u.auctionRounds || 1, 1);
      newlyUnlocked.push('경매장이 열렸어요! (수채화 4개 완성)');
    }

    // 2. 점묘화 도구 + 경매 3라운드 (보유 그림 3개)
    if (!state.unlockedTypes.pointillism && inv >= 3) {
      state.unlockedTypes.pointillism = true;
      u.auctionRounds = Math.max(u.auctionRounds || 1, 3);
      // 고양이 아티 해금
      u.catsUnlocked.ati = true;
      newlyUnlocked.push('점묘화 도구 등장! 경매도 3라운드로 확장됐어요');
      newlyUnlocked.push('고양이 도우미 「아티」가 고양이 시장에 나타났어요!');
    }

    // 3. 유화 도구 + 경매 5라운드 (보유 그림 5개)
    if (!state.unlockedTypes.oilpainting && inv >= 5) {
      state.unlockedTypes.oilpainting = true;
      u.auctionRounds = Math.max(u.auctionRounds || 1, 5);
      // 고양이 오일 해금
      u.catsUnlocked.oil = true;
      newlyUnlocked.push('유화 도구 등장! 경매도 5라운드로 확장됐어요');
      newlyUnlocked.push('고양이 도우미 「오일」이 고양이 시장에 나타났어요!');
    }

    // 4. 그라타주 도구 (보유 그림 7개)
    if (!state.unlockedTypes.gratage && inv >= 7) {
      state.unlockedTypes.gratage = true;
      // 고양이 골드 해금
      u.catsUnlocked.gold = true;
      newlyUnlocked.push('그라타주 도구 등장!');
      newlyUnlocked.push('고양이 도우미 「골드」가 고양이 시장에 나타났어요!');
    }

    // 5. 자체 출품 (금별1 이상 모작 보유)
    if (!u.selfListing) {
      const hasGold = state.inventory.some(it => (it.counterfeitGrade || 0) >= 7);
      if (hasGold) {
        u.selfListing = true;
        newlyUnlocked.push('자체 출품이 열렸어요! (금별1 이상 모작 보유)');
      }
    }

    // 6. 박물관 엔딩 (그라타주 4등급 이상 보유 + $1,000,000)
    //    그라타주 4등급 새 가격 $800,000 기준 + 여유분 $200,000
    if (!u.museumEnding) {
      const hasGratage4 = state.inventory.some(
        it => it.type === 'gratage' && (it.grade || 0) >= 4
      );
      if (hasGratage4 && state.money >= 1000000) {
        u.museumEnding = true;
        // 고양이 공작 해금
        u.catsUnlocked.gongja = true;
        newlyUnlocked.push('박물관 엔딩 도전 가능! (그라타주 4등급 + $1,000,000)');
        newlyUnlocked.push('고양이 도우미 「공작」이 고양이 시장에 나타났어요!');
      }
    }

    // 7. V3: 등급별 가격표 순차 공개
    if (!u.unlockedGrades) u.unlockedGrades = { bronze: true, silver: false, gold: false };
    const hasSilver = state.inventory.some(it => (it.counterfeitGrade || 0) >= 4);
    const hasGold   = state.inventory.some(it => (it.counterfeitGrade || 0) >= 7);
    if (!u.unlockedGrades.silver && hasSilver) {
      u.unlockedGrades.silver = true;
      newlyUnlocked.push('은별 등급 가격표가 열렸어요! (은별1 이상 모작 달성)');
    }
    if (!u.unlockedGrades.gold && hasGold) {
      u.unlockedGrades.gold = true;
      newlyUnlocked.push('금별·다이아 등급 가격표가 열렸어요! (금별1 이상 모작 달성)');
    }

    // 새로 열린 항목마다 가운데 빵 알림
    for (const msg of newlyUnlocked) notify(msg);
    return newlyUnlocked;
  }

  global.MN9_Unlock = { checkUnlocks, setToastCallback, setCenterNotifyCallback };

})(typeof window !== 'undefined' ? window : globalThis);
