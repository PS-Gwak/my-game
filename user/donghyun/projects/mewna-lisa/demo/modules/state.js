/* ============================================================
   state.js — 게임 상황 메모지 (모든 숫자·상태 한 곳에 모음)
   ============================================================
   비유: 게임의 '현재 상황 카드' 한 장입니다. 돈·그림 인벤토리·
   붓 레벨·물감 레벨·해금 상태 등 게임에 필요한 모든 숫자가
   이 카드 한 장에 적혀 있어요. 게임 중엔 이 카드만 계속 고치고,
   페이지 닫기 전에 persist.js가 상자에 넣어 기억합니다.

   주의: 캔버스 픽셀이나 드래그 좌표는 절대 여기 넣지 마세요
   (1MB 상자가 꽉 찹니다). 그림 인벤토리도 '등급·종류·파일명' 같은
   숫자·문자 정보만 보관 — 그림 이미지는 manifest.js 보고 다시 불러옴.

   v8 새 필드:
   - brushLevel  : 붓 레벨 1~5 (포인터 크기 결정)
   - paintLevels : 물감 레벨 { watercolor/pointillism/oilpainting/gratage } 각 0~4
   ============================================================ */

(function (global) {
  'use strict';

  // 마이그레이션(버전 올릴 때 옛 데이터 변환)용 버전 번호
  const STATE_VERSION = 10;

  // ── 새 게임 시작 시 기본값
  function createInitialState() {
    return {
      version: STATE_VERSION,

      // 자금 (단일 지갑). 시작 자금 $100.
      money: 100,

      // 보유 그림 목록. 각 항목 = {
      //   id, type, grade, filename, title, artist,
      //   counterfeitGrade, value, createdAt
      // }
      inventory: [{
        id: 'starter_watercolor_1', type: 'watercolor', grade: 1,
        filename: 'watercolor_1.jpg',
        title: '진주귀걸이를 한 소녀', artist: '베르메르',
        counterfeitGrade: 0, value: 0, isOriginal: true,
        createdAt: Date.now(),
      }],

      // 붓 레벨 1~5. 포인터 크기만 변함 (게임플레이 영향 없음).
      // 상점에서 업그레이드 가능.
      brushLevel: 1,

      // 물감 레벨 (4종 그림 각각 별도). 0~4단계.
      // 레벨이 높을수록 채도가 진해지고 등급 보정도 올라감.
      // 상점에서 구입.
      paintLevels: {
        watercolor:  1,
        pointillism: 0,
        oilpainting: 0,
        gratage:     0,
      },

      // 어떤 그림 종류를 모작할 수 있는지 (해금 상태)
      // watercolor는 처음부터 가능, 나머지는 게임 진행으로 열림
      unlockedTypes: {
        watercolor:  true,
        pointillism: false,
        oilpainting: false,
        gratage:     false,
      },

      // 카운터 — 해금 조건 확인용
      counters: {
        watercolorMade: 0, // 수채화 누적 모작 수 (4개 → 경매 해금)
        totalMade:      0, // 전체 누적 모작 수
      },

      // 해금 상태 (true/false 스위치)
      unlocks: {
        auctionOpen:  false, // 경매장 (수채화 4개 누적 후 열림)
        selfListing:  false, // 자체 출품 (금별1 이상 보유 후 열림)
        museumEnding: false, // 박물관 엔딩 (붓 4레벨 + $30,000 후 열림)
        auctionRounds: 1,   // 경매 라운드 수 (1·3·5 단계로 확장)
        wristMode: null,    // 손목 모드 여부 (null=아직 안 물어봄, true/false)
        // V3: 등급별 가격표 순차 공개 (처음엔 동별만, 은별·금별은 달성 후)
        unlockedGrades: {
          bronze: true,  // 동별1~3 (처음부터 공개)
          silver: false, // 은별1~3 (모작 등급 4 이상 달성 시 공개)
          gold:   false, // 금별1~3·다이아 (모작 등급 7 이상 달성 시 공개)
        },
      },

      // 현재 작업 중인 그림 정보 (null = 쉬는 중)
      // 여기엔 어떤 그림을 그리는지 메타 정보만. 캔버스 픽셀은 저장 안 함.
      currentCanvas: null,

      // 경매 런타임 정보 (저장 안 함, 페이지 로드 시 초기화)
      auction: {
        active: false,
        cycleRound: 0,
        results: [],
      },

      // 박물관 엔딩 결과 (한 번만 발생)
      museumOutcome: null, // null | 'success' | 'fail'

      // 디버그 설정 (자체 검증 모드 전용 — 실제 게임 저장 안 됨)
      debug: {
        completeThreshold: 0.90,
      },

      // V6 단계별 경매 카운터 (0=첫 경매, 1=2차, 2=3차, 3+=기존 5라운드)
      auctionCycleCount: 0,

      // 고양이 직원 상태 (분신술 시스템 v10)
      // assignedPaintingId: 현재 맡긴 그림 ID (null=쉬는 중)
      // lastCopyAt: 마지막으로 모작 완료한 시각 (타임스탬프)
      cats: {
        dorom_a: { hired: false, assignedPaintingId: null, lastCopyAt: null },
        dorom_b: { hired: false, assignedPaintingId: null, lastCopyAt: null },
        ati:     { hired: false, assignedPaintingId: null, lastCopyAt: null },
        oil:     { hired: false, assignedPaintingId: null, lastCopyAt: null },
        gold:    { hired: false, assignedPaintingId: null, lastCopyAt: null },
        gongjak: { hired: false, assignedPaintingId: null, lastCopyAt: null },
      },

      // 타임스탬프
      createdAt:   Date.now(),
      lastSavedAt: Date.now(),
    };
  }

  // ── 옛 버전 데이터 → 새 버전으로 변환
  // 버전 번호가 다르면 처음부터 시작 (v7 데이터는 키 구조가 달라서 변환 없이 리셋)
  function migrateOldVersion(oldState) {
    if (!oldState || typeof oldState !== 'object') return createInitialState();
    if (oldState.version === STATE_VERSION) return oldState;
    console.warn('[state] version mismatch, resetting to initial. old version:', oldState.version);
    return createInitialState();
  }

  // ── 저장된 데이터 불러오기 + 버전 변환 + 런타임 키 복구
  function loadState() {
    const raw = global.MN9_Persist ? global.MN9_Persist.loadState() : null;
    if (!raw) return createInitialState();
    const migrated = migrateOldVersion(raw);
    // 런타임 전용 키는 저장 안 됐을 수 있으니 초기화
    if (!migrated.auction) migrated.auction = { active: false, cycleRound: 0, results: [] };
    migrated.auction.active = false;
    migrated.currentCanvas = null;
    return migrated;
  }

  // ── 저장 (lastSavedAt 갱신, 런타임 전용 키 제외)
  function saveState(state) {
    if (!global.MN9_Persist) return false;
    const cleanState = {
      ...state,
      lastSavedAt: Date.now(),
      currentCanvas: null, // 캔버스 픽셀 저장 방지
      auction: { active: false, cycleRound: 0, results: [] }, // 경매 런타임 제거
    };
    return global.MN9_Persist.saveState(cleanState);
  }

  // ── 전체 리셋 (「새로 시작」 버튼)
  function resetAllData() {
    if (global.MN9_Persist) global.MN9_Persist.resetAllData();
    return createInitialState();
  }

  global.MN9_State = {
    createInitialState,
    migrateOldVersion,
    loadState,
    saveState,
    resetAllData,
    STATE_VERSION,
  };

})(typeof window !== 'undefined' ? window : globalThis);
