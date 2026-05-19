/* ============================================================
   persist.js — 게임 기억을 브라우저 상자(localStorage)에 넣고 빼기
   ============================================================
   비유: 컴퓨터 안에 작은 메모 상자가 있어요. 이 파일은 그 상자에
   게임 상황(돈·그림·붓 레벨 등)을 통째로 넣고, 다음에 열면 다시
   꺼내주는 '창고 직원'입니다.

   저장 한계: 1MB까지만 허용. 캔버스 픽셀이나 드래그 좌표는
   절대 저장 안 함 — 숫자/등급/카운터 정보만 넣어야 해요.

   저장 키: muthernuts_v9_state  (v7과 섞이지 않게 별도 키 사용)
   ============================================================ */

(function (global) {
  'use strict';

  // 브라우저 상자(localStorage) 에서 쓸 이름표
  const STORAGE_KEY = 'muthernuts_v9_state';

  // 1MB 한계 (바이트 단위)
  const ONE_MB = 1024 * 1024;

  // ── 저장: 게임 상황을 글자로 바꿔서 상자에 넣음
  function saveState(state) {
    try {
      const json = JSON.stringify(state);
      if (json.length > ONE_MB) {
        // 1MB 넘으면 경고 — 캔버스 픽셀이 새어들어왔을 가능성
        alert('저장 데이터가 너무 큽니다 (1MB 초과). 그림 인벤토리 점검이 필요해요.');
        console.warn('[persist] state size exceeds 1MB:', json.length);
        return false;
      }
      localStorage.setItem(STORAGE_KEY, json);
      return true;
    } catch (e) {
      console.error('[persist] saveState failed:', e);
      return false;
    }
  }

  // ── 불러오기: 상자에서 글자 꺼내서 다시 객체로 풀어줌
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.error('[persist] loadState failed:', e);
      return null;
    }
  }

  // ── 전체 초기화: 상자 통째로 비움 (「새로 시작」 버튼이 이걸 부름)
  function resetAllData() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (e) {
      console.error('[persist] resetAllData failed:', e);
      return false;
    }
  }

  // ── 저장 크기 확인 (자체 검증 모드에서 디버그용)
  function getStorageSize() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? raw.length : 0;
  }

  global.MN9_Persist = { saveState, loadState, resetAllData, getStorageSize, STORAGE_KEY, ONE_MB };

})(typeof window !== 'undefined' ? window : globalThis);
