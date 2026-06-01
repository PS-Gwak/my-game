;(function(global) {
  'use strict';

  /* ============================================================
     first-auction.js — 첫 경매 고정 모듈
     ============================================================
     비유: 처음 경매장에 들어온 손님에게는 무작위 그림이 아니라
           미리 준비해 둔 '2단계 수채화' 딱 1장을 경매합니다.
           시연 안정성 보장용입니다.

     락-인 결정:
       V6 — 첫 경매 = 2단계 수채화 고정 + 수채화만 필터
     ============================================================ */

  // 첫 경매 여부 판단
  // state = v6-engine.js 내부 state (unlocks 필드 포함 가능)
  // 비유: "아직 첫 경매를 치른 적 없나요?" 확인
  function isFirstAuction(state) {
    return !(state.unlocks && state.unlocks.firstAuctionDone);
  }

  // 2단계 수채화 1장 반환
  // paintings = loadManifest()가 반환한 그림 배열 (평탄화된 상태)
  // 비유: 카탈로그에서 '수채화 · 2단계' 딱지 붙은 그림을 찾아 건네주기
  function getFirstAuctionPainting(paintings) {
    if (!paintings || !paintings.length) {
      // MN9_MANIFEST 직접 참조 fallback
      if (window.MN9_MANIFEST && window.MN9_MANIFEST.paintings) {
        const all = window.MN9_MANIFEST.paintings;
        const list = Array.isArray(all) ? all : Object.values(all).flat();
        const found = list.find(function(p) { return p.type === 'watercolor' && p.grade === 2; });
        if (found) return found;
      }
      console.warn('[first-auction] 그림 목록 없음 — 첫 경매 고정 불가');
      return null;
    }
    var found = null;
    for (var i = 0; i < paintings.length; i++) {
      if (paintings[i].type === 'watercolor' && paintings[i].grade === 2) {
        found = paintings[i];
        break;
      }
    }
    if (!found) {
      console.warn('[first-auction] 2단계 수채화를 목록에서 찾지 못함');
    }
    return found;
  }

  // 첫 경매 완료 도장 찍기
  // 비유: 첫 경매가 끝나면 "시연 완료" 스탬프 — 다음부터는 자유 경매
  function markFirstAuctionDone(state) {
    if (!state.unlocks) state.unlocks = {};
    state.unlocks.firstAuctionDone = true;
  }

  global.MN9_FirstAuction = {
    isFirstAuction: isFirstAuction,
    getFirstAuctionPainting: getFirstAuctionPainting,
    markFirstAuctionDone: markFirstAuctionDone,
  };

})(typeof window !== 'undefined' ? window : globalThis);
