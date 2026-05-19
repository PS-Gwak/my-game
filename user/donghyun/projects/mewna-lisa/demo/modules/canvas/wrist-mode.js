;(function(global) {
  'use strict';

  // 비개발자 메모: 손목 보호 모드 = 마우스 누르지 않고 움직이기만 해도 그림 칠해지는 모드.
  // 시작 시 1회 묻고 state.unlocks.wristMode에 저장. 설정에서 토글 가능.

  function isWristMode(state) {
    return state.unlocks && state.unlocks.wristMode === true;
  }

  function setWristMode(state, enabled) {
    if (!state.unlocks) state.unlocks = {};
    state.unlocks.wristMode = !!enabled;
  }

  function hasBeenAsked(state) {
    return state.unlocks && state.unlocks.wristMode !== null && state.unlocks.wristMode !== undefined;
  }

  global.MN9_WristMode = { isWristMode, setWristMode, hasBeenAsked };

})(typeof window !== 'undefined' ? window : globalThis);
