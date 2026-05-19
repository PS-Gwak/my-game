/* ============================================================
   cats.js — 고양이 도우미 데이터 (6마리 정의 + 자동 모작 로직)
   ============================================================
   비유: 고양이 도우미들은 '아르바이트생'입니다.
   영입하면 자동으로 모작 1장을 만들어줘요.
   단계별로 새 도우미가 시장에 등장합니다.

   6마리 단계별 게이팅 (락-인 결정 10 + Phase 4 V8 갱신):
   - 도롬 꼼꼼이 (수채화) → 게임 시작부터 등장 / 30초 / 등급 +1
   - 도롬 날렵이 (수채화) → 게임 시작부터 등장 / 20초 / 등급 보정 없음
   - 아티 (점묘화) → 점묘화 도구 해금 시
   - 오일 (유화)   → 유화 도구 해금 시
   - 골드 (그라타주) → 그라타주 도구 해금 시
   - 공작 (박물관) → 박물관 엔딩 해금 시

   자동 도우미 동작:
   - 영입 후 autoIntervalSec마다 그림 1장 자동 모작
   - gradeBonus: 만드는 그림 등급에 보정치 적용
   - 타이머는 게임 로드 시 재시작 (페이지 새로고침 = 타이머 리셋)

   영입 비용:
   - 도롬 꼼꼼이: $1,000
   - 도롬 날렵이: $800
   - 아티: $1,700
   - 오일: $2,700
   - 골드: $4,300
   - 공작: $6,700
   ============================================================ */

(function (global) {
  'use strict';

  // 고양이 6마리 정의 (도롬은 꼼꼼이·날렵이 2변종)
  const CAT_DEFS = {
    dorom_a: {
      id: 'dorom_a',
      name: '도롬 (꼼꼼이)',
      emoji: '🐱',
      type: 'watercolor',         // 담당 그림 종류
      unlockKey: 'dorom_a',       // unlocks.catsUnlocked 키
      hireCost: 1000,
      desc: '수채화 꼼꼼이 도롬. 30초마다 1장, 등급 +1 보정.',
      autoIntervalSec: 30,        // 자동 모작 주기 (초)
      gradeBonus: 1,              // 완성 그림 등급에 더해지는 보정치
    },
    dorom_b: {
      id: 'dorom_b',
      name: '도롬 (날렵이)',
      emoji: '😺',
      type: 'watercolor',
      unlockKey: 'dorom_b',
      hireCost: 800,
      desc: '수채화 날렵이 도롬. 20초마다 1장, 등급 보정 없음.',
      autoIntervalSec: 20,
      gradeBonus: 0,
    },
    ati: {
      id: 'ati',
      name: '아티',
      emoji: '🐈',
      type: 'pointillism',
      unlockKey: 'ati',
      hireCost: 1700,
      desc: '점묘화 전문 고양이. 점 하나하나 찍어줘요.',
      autoIntervalSec: 30,
    },
    oil: {
      id: 'oil',
      name: '오일',
      emoji: '🐈‍⬛',
      type: 'oilpainting',
      unlockKey: 'oil',
      hireCost: 2700,
      desc: '유화 전문 고양이. 진한 색으로 그려줘요.',
      autoIntervalSec: 30,
    },
    gold: {
      id: 'gold',
      name: '골드',
      emoji: '🦁',
      type: 'gratage',
      unlockKey: 'gold',
      hireCost: 4300,
      desc: '그라타주 전문 고양이. 검정 배경을 긁어줘요.',
      autoIntervalSec: 30,
    },
    gongja: {
      id: 'gongja',
      name: '공작',
      emoji: '🦚',
      type: 'watercolor',         // 박물관 단계 — 수채화·점묘화 모두 가능 (랜덤)
      unlockKey: 'gongja',
      hireCost: 6700,
      desc: '박물관급 고양이. 모든 종류 그림을 그려줘요.',
      autoIntervalSec: 30,
    },
  };

  // 활성 타이머 목록 (catId → intervalId)
  const _timers = {};

  // 토스트 콜백 (game.js가 주입)
  let _toastCallback = null;
  function setToastCallback(cb) { _toastCallback = cb; }
  function toast(msg) {
    if (_toastCallback) _toastCallback(msg);
  }

  // ── 자동 모작 1회 실행
  // 비유: 고양이가 "짠!" 하고 배치된 원본 그림의 모작을 자동으로 팔아줍니다.
  function autoCopy(catDef, state) {
    const Scorer   = global.MN9_Scorer;
    const MANIFEST = global.MN9_MANIFEST;
    if (!Scorer || !MANIFEST) return;

    // E5: 배치된 그림 없으면 자동 모작 X
    const catData = state.cats && state.cats[catDef.id];
    if (!catData || !catData.assignedPaintingId) return;

    // E6: 배치된 그림이 원본(isOriginal)인지 확인
    const original = (state.inventory || []).find(
      it => it.id === catData.assignedPaintingId && it.isOriginal
    );
    if (!original) {
      // 원본 사라졌으면 배치 해제
      catData.assignedPaintingId = null;
      return;
    }

    // 배치된 원본 type에 맞춰 모작 생성 (기존 무작위 X)
    const type = original.type;

    // 등급 결정 (gradeBonus 있으면 더하기, 최대 10등급)
    const paintLevel = (state.paintLevels || {})[type] || 0;
    const baseGrade = Scorer.rollGrade(paintLevel);
    const grade = Math.min(10, baseGrade + (catDef.gradeBonus || 0));

    // E8: inventory에 쌓지 않고 즉시 money += value (자동 판매)
    const value = Scorer.computePrice(original.grade, grade, original.basePrice || 100);
    state.money += value;

    // 토스트
    toast(`${catDef.emoji} ${catDef.name}이(가) 「${original.title}」 모작 완성 → 자동 판매 +$${value.toLocaleString('en-US')}`);

    // 카운터 갱신
    state.counters = state.counters || {};
    state.counters.totalMade = (state.counters.totalMade || 0) + 1;
    state.counters[type + 'Made'] = (state.counters[type + 'Made'] || 0) + 1;

    // E4: lastCopyAt 갱신
    catData.lastCopyAt = Date.now();

    // 해금 조건 점검 + 자동 저장
    if (global.MN9_Unlock) global.MN9_Unlock.checkUnlocks(state);
    if (global.MN9_State)  global.MN9_State.saveState(state);
  }

  // ── 고양이 타이머 시작
  function startCatTimer(catId, state) {
    const cat = CAT_DEFS[catId];
    if (!cat) return;
    if (_timers[catId]) return; // 이미 동작 중

    _timers[catId] = setInterval(() => {
      autoCopy(cat, state);
    }, cat.autoIntervalSec * 1000);
  }

  // ── 고양이 타이머 정지
  function stopCatTimer(catId) {
    if (_timers[catId]) {
      clearInterval(_timers[catId]);
      delete _timers[catId];
    }
  }

  // ── 영입된 고양이 타이머 전체 복구 (페이지 로드 시 호출)
  function resumeHiredCats(state) {
    if (!state.cats) return;
    Object.keys(state.cats).forEach(catId => {
      if (state.cats[catId].hired) {
        startCatTimer(catId, state);
      }
    });
  }

  // ── 고양이 영입 처리
  // 반환: { ok: true } | { ok: false, reason: string }
  function hireCat(catId, state) {
    const cat = CAT_DEFS[catId];
    if (!cat) return { ok: false, reason: '고양이 정보를 찾을 수 없어요' };

    // 해금 체크 (dorom_a, dorom_b는 게임 시작부터 해금)
    const catsUnlocked = (state.unlocks && state.unlocks.catsUnlocked) || {};
    const isStarterCat = catId === 'dorom_a' || catId === 'dorom_b';
    if (!catsUnlocked[catId] && !isStarterCat) {
      return { ok: false, reason: '아직 해금되지 않은 고양이예요' };
    }

    // cats 객체 없으면 초기화
    if (!state.cats) state.cats = {};
    if (!state.cats[catId]) state.cats[catId] = { hired: false };

    if (state.cats[catId].hired) {
      return { ok: false, reason: '이미 영입된 고양이예요' };
    }

    if (state.money < cat.hireCost) {
      return { ok: false, reason: `자금 부족 (${cat.hireCost.toLocaleString('en-US')} 필요)` };
    }

    // 영입 처리
    state.money -= cat.hireCost;
    state.cats[catId].hired = true;
    startCatTimer(catId, state);

    return { ok: true };
  }

  global.MN9_Cats = {
    CAT_DEFS,
    hireCat,
    startCatTimer,
    stopCatTimer,
    resumeHiredCats,
    setToastCallback,
  };

})(typeof window !== 'undefined' ? window : globalThis);
