/* ============================================================
   경매 게임 데모 v6 — v5 피드백 16개 통합
   P0 (5): 스크롤 반전 / 자유경매 2등 5초 버그 / 3·2·1 클릭 큐 / CPU 자산 광분포 / 자유1등 동적 2~3회
   P1 (8): 사회자 멘트 5종+인격 연관 / 자유10초 → 임의 5~15초 / ⏩×10 / 1회제한 휠 / 비밀경매 갭 다양화 / 막판 점프·포기 / 모든 경매 그림 설명 / CPU 파산 ↑
   P2 (3): 정산 5장 / 모든 화면 키보드 / 호가 단계 안내
   ============================================================ */

(function () {
  'use strict';

  // ============================================================
  // SECTION: config
  // ============================================================

  const CONFIG = {
    startMoney: 3000,
    cpuCount: 10,

    categories: [
      { name: 'A', min: 100,  max: 200  },
      { name: 'B', min: 200,  max: 400  },
      { name: 'C', min: 300,  max: 600  },
      { name: 'D', min: 500,  max: 1000 },
      { name: 'E', min: 1000, max: 2000 },
    ],

    // 8인격 (v5 유지) + v6 신규 1종: WTH (관망형 — 막판 점프 또는 막판 포기)
    personalityDistByRound: [
      { APP: 0.35, CON: 0.20, MAN: 0.05, BLF: 0.10, SHK: 0.05, TLT: 0.00, MIR: 0.15, SNI: 0.05, WTH: 0.05 },
      { APP: 0.30, CON: 0.15, MAN: 0.10, BLF: 0.10, SHK: 0.10, TLT: 0.05, MIR: 0.10, SNI: 0.05, WTH: 0.05 },
      { APP: 0.25, CON: 0.15, MAN: 0.10, BLF: 0.15, SHK: 0.10, TLT: 0.05, MIR: 0.10, SNI: 0.05, WTH: 0.05 },
      { APP: 0.20, CON: 0.10, MAN: 0.20, BLF: 0.15, SHK: 0.10, TLT: 0.10, MIR: 0.05, SNI: 0.05, WTH: 0.05 },
      { APP: 0.15, CON: 0.00, MAN: 0.25, BLF: 0.25, SHK: 0.10, TLT: 0.10, MIR: 0.05, SNI: 0.05, WTH: 0.05 },
    ],

    extremeDist: { APP: 0.12, CON: 0.05, MAN: 0.30, BLF: 0.20, SHK: 0.10, TLT: 0.10, MIR: 0.05, SNI: 0.03, WTH: 0.05 },

    personalities: {
      APP: {
        ceilingMean: 0.10, ceilingSigma: 0.30, ceilingClip: [-0.20, 1.50],
        probCurve: [[0.0, 0.70], [0.8, 0.70], [1.21, 0.50], [9999, 0.20]],
        retireThreshold: 3, jumpSteps: 1,
      },
      CON: {
        ceilingFixedRatio: 1 / 1.1,
        probCurve: [[0.0, 0.40], [0.77, 0.40], [0.91, 0.15], [9999, 0.00]],
        retireThreshold: 1, jumpSteps: 1,
      },
      MAN: {
        ceilingFixedRatio: 3.0,
        probCurve: [[0.0, 0.80], [1.0, 0.80], [2.0, 0.60], [3.0, 0.40], [9999, 0.00]],
        retireThreshold: 5, jumpStepsRange: [2, 3],
      },
      BLF: {
        ceilingMean: 0.50, ceilingSigma: 0.80, ceilingClip: [-0.10, 3.00],
        baseProb: 0.30, counterCpuBonus: 0.50, counterUserBonus: 0.70,
        counterDurationMs: 1000,
        checkRaiseAfterMs: 5000, checkRaiseProb: 0.80, checkRaiseJumpSteps: [2, 3],
        retireThreshold: 3, jumpSteps: 1,
      },
      SHK: {
        ceilingFixedRatio: 2.0,
        baseProb: 0.25,
        burstTimerWindowLo: 0.30, burstTimerWindowHi: 0.50,
        burstChance: 0.30, burstJumpSteps: 3,
        retireThreshold: 4, jumpSteps: 1,
      },
      TLT: {
        ceilingNormalRatio: 1.10, ceilingTiltedRatio: 2.50,
        baseProb: 0.40, tiltedProb: 0.70,
        retireThreshold: 3, jumpSteps: 1,
      },
      MIR: {
        ceilingFixedRatio: 1.50,
        baseProb: 0.20,
        triggerThresholdCpus: 3, triggeredBonus: 0.30,
        retireThreshold: 3, jumpSteps: 1,
      },
      SNI: {
        ceilingFixedRatio: 1.30,
        baseProb: 0.05,
        snipeWindowMs: 2000, snipeProb: 0.70,
        retireThreshold: 5, jumpSteps: 1,
      },
      // v6 신규: 관망형 (Watch & Threaten)
      // 평소엔 거의 입찰 안 함 → 막판(timerProgress >= 0.7)에 50% 확률로 큰 점프 또는 그냥 포기
      WTH: {
        ceilingFixedRatio: 1.40,
        baseProb: 0.08,
        lateWindow: 0.65,   // 65% 이상 진행 시 막판 모드
        latePunchProb: 0.55, // 막판 시 큰 점프 확률
        lateGiveUpProb: 0.30, // 막판 시 그냥 포기 (긴장감)
        punchJumpSteps: [3, 5],
        retireThreshold: 4, jumpSteps: 1,
      },
    },

    startPriceNormalMeanRatio: 1 / 2.5,
    startPriceNormalSigma: 0.50,
    startPriceClipRatio: [1 / 4, 1.50],
    extremeRoundCountWeights: [{ count: 1, w: 0.5 }, { count: 2, w: 0.5 }],
    extremeLowChance: 0.30,
    extremeLowRatio: 1 / 4,
    extremeHighRatioRange: [1.50, 3.00],

    playerFastBidMs: 5000,
    userFirstBidWindowMs: 1000,
    bigJumpStepsThreshold: 3,

    auctionWeights: {
      fixed: 1.0, free10_1st: 1.0, free10_2nd: 0.5,
      candle_1st: 0.5, candle_2nd: 0.25, sealed: 1.0,
      limited_1st: 0.75, limited_2nd: 0.25, dutch: 0.8,
    },

    fixedCountdownByCategory: { A: 3000, B: 4000, C: 5000, D: 8000, E: 12000 },
    fixedTimerMs: 30000,
    // v6: P1-7 자유경매 — 10초 타이머 폐기. 사회자 cooldown 5~15초 모델
    freeHostCooldownMin: 5000,
    freeHostCooldownMax: 15000,
    freeHostCooldownAvg: 10000,
    free10sHostStartMs: 3000, // 호환용
    candleMinMs: 30000, candleMaxMs: 60000,
    candleGreenPhaseMs: 10000, candleEndWarnMs: 4000,
    candleFakeYellowMin: 3000, candleFakeYellowMax: 4000,
    candleFakeYellowChance: 0.7, candleFakeYellowCount: [1, 2],
    sealedTimerMs: 30000,
    limitedTimerMs: 30000,
    dutchStepMs: 500, dutchStartRatio: 3.0, dutchExtraPerStep: 0.02,

    sealedPriceSigma: 0.30,
    sealedClipRatio: [0.527, 2.00],
    limitedPriceSigma: 0.30,
    limitedClipRatio: [0.714, 1.80],

    // v6: P1-10 비밀경매 호가 갭 풀 (비중 클로드 추천)
    // 가벼운 갭 ($100~$200) → 자주 / 중갭 ($500) → 보통 / 큰갭 ($1000) → 가끔
    sealedGapPool: [
      { gap: 100,  w: 0.30 },
      { gap: 200,  w: 0.25 },
      { gap: 250,  w: 0.10 },
      { gap: 500,  w: 0.20 },
      { gap: 750,  w: 0.05 },
      { gap: 1000, w: 0.10 },
    ],

    dutchProbCurve: [
      [-1.0, 0.90], [-0.5, 0.80], [-0.25, 0.70], [0.0, 0.50],
      [0.5, 0.15], [1.0, 0.05], [2.0, 0.005],
    ],

    afterAuctionDelayMs: 2000,
    fastForwardMul: 10,   // v6: P1-8 ×4 → ×10

    personaEmoji: {
      APP: '💼', CON: '🛡️', MAN: '🔥', BLF: '🎭',
      SHK: '🃏', TLT: '💢', MIR: '👯', SNI: '🎯',
      WTH: '🦅',
    },
    personaNameKo: {
      // v8 패치 2: v6 인격 라벨 → v7 라벨 일괄 치환
      APP: '시세형', CON: '절약형', MAN: '광기형', BLF: '고객형',
      SHK: '잠복형', TLT: '도박형', MIR: '추종형', SNI: '저격형',
      WTH: '관망형',
    },
    allPersonas: ['APP', 'CON', 'MAN', 'BLF', 'SHK', 'TLT', 'MIR', 'SNI', 'WTH'],

    auctionFriendlyName: {
      fixed: '지정가 거래',
      free10_1st: '자유경매 (1등가)',
      free10_2nd: '자유경매 (2등가)',
      candle_1st: '촛불 경매 (1등가)',
      candle_2nd: '촛불 경매 (2등가)',
      sealed: '비밀경매',
      limited_1st: '1회 제한 경매 (1등가)',
      limited_2nd: '1회 제한 경매 (2등가)',
      dutch: '네덜란드식 (내림경매)',
    },

    sealedPlaceholderByCategory: {
      A: '예: $80~250 적정',
      B: '예: $180~480',
      C: '예: $250~700',
      D: '예: $450~1200',
      E: '예: $900~2400',
    },

    // v6: P1-12 모든 경매 공용 그림 설명 풀 (카테고리별 4~6개씩)
    paintingFlavorByCategory: {
      A: [
        '📢 신인 작가의 작은 데뷔작이네요.',
        '📢 따뜻한 색감이 인상적입니다.',
        '📢 컬렉션 입문용으로 좋은 한 점.',
        '📢 화풍은 단순하지만 메시지가 분명합니다.',
        '📢 액자 상태도 깨끗하군요.',
      ],
      B: [
        '📢 차분한 정물 화풍이 돋보입니다.',
        '📢 보존 상태는 양호한 편입니다.',
        '📢 거실 한쪽에 잘 어울리겠네요.',
        '📢 작가 활동기 중반의 안정감 있는 작품.',
        '📢 색감의 균형이 좋습니다.',
        '📢 액자도 단정하게 마무리됐죠.',
      ],
      C: [
        '📢 19세기 인상파 화풍의 정수.',
        '📢 보존 상태도 매우 좋습니다.',
        '📢 캔버스 결이 살아있는 작품이네요.',
        '📢 컬렉터분들 관심 많은 시기의 작품입니다.',
        '📢 빛의 처리가 인상적이지요.',
        '📢 비슷한 사조의 시세도 오르는 중입니다.',
      ],
      D: [
        '📢 18세기 풍경화 거장의 손길이 느껴집니다.',
        '📢 컬렉션에 한 자리 마련해두실 만한 가치가 있죠.',
        '📢 보존 상태도 최상급입니다.',
        '📢 사조와 시대를 대표하는 작가의 한 점.',
        '📢 캔버스 뒷면 사인까지 깨끗하게 남아있죠.',
        '📢 액자 마감도 시대 그대로 보존돼 있네요.',
      ],
      E: [
        '📢 사조와 시대를 뛰어넘는 명작.',
        '📢 미술관에서도 탐낼 만한 수준입니다.',
        '📢 한번 놓치면 다시 보기 어려운 작품이에요.',
        '📢 컬렉터분들은 망설이지 마세요.',
        '📢 보존 상태·서명·도큐멘테이션 모두 완벽합니다.',
        '📢 경매장 역사에 남을 한 점이 될 겁니다.',
      ],
    },

    fixedCloseupShouts: {
      A: ['📢 지정가 거래입니다.', '📢 정말 아름다운 작품이죠.'],
      B: ['📢 지정가 거래입니다.', '📢 정말 아름다운 작품이죠.', '📢 따뜻한 색감이 인상적입니다.'],
      C: ['📢 지정가 거래입니다.', '📢 정말 아름다운 작품이죠.', '📢 19세기 인상파 화풍의 정수.', '📢 보존 상태도 매우 좋습니다.'],
      D: ['📢 지정가 거래입니다.', '📢 정말 아름다운 작품이죠.', '📢 18세기 풍경화 거장의 손길이 느껴집니다.', '📢 컬렉션에 한 자리 마련해두실 만한 가치가 있죠.', '📢 보존 상태도 최상급입니다.'],
      E: ['📢 지정가 거래입니다.', '📢 정말 아름다운 작품이죠.', '📢 사조와 시대를 뛰어넘는 명작.', '📢 미술관에서도 탐낼 만한 수준입니다.', '📢 한번 놓치면 다시 보기 어려운 작품이에요.', '📢 컬렉터분들은 망설이지 마세요.'],
    },

    paintingsDir: 'assets/paintings/',

    sliderDefaults: {
      s1_aggression: 50, s2_intensity: 50, s3_ceilingMean: 50,
      s4_ceilingSigma: 50, s5_cpuMoney: 50,
    },

    // v6: P0-4 CPU 자산 광분포 — 평균 슬라이더 50일 때 $1500, 단 분산이 매우 크게
    // 빈자 ($200~500) 20%, 중산층 ($800~2500) 60%, 부자 ($3000~5000) 20%
    cpuMoneyMin: 500, cpuMoneyMax: 5000, cpuMoneyDefault: 1500,
    // 3계층 비율 (슬라이더 50일 때)
    cpuMoneyTiers: {
      poor:   { ratio: 0.20, baseLo: 200,  baseHi: 600  },
      middle: { ratio: 0.60, baseLo: 800,  baseHi: 2500 },
      rich:   { ratio: 0.20, baseLo: 3000, baseHi: 5000 },
    },
    // 5라운드 ($1000~2000) 참여 보장: 매 사이클 부자/상위 중산층 최소 보장 수
    cpuRichGuaranteedMin: 2,   // 최소 2명은 $2000+
    cpuMidGuaranteedMin: 1,    // 최소 1명은 $1000~$2000 (레이지 따라올 수 있는)
  };

  // v8 패치 6: manifest 못 읽을 때 쓰는 비상용 그림 목록
  // v8 폴더에 있는 실제 파일 이름(watercolor_N.jpg 형식)으로 교체
  const PAINTINGS_FALLBACK = [
    { id: 1,  file: 'watercolor_1.jpg',    title: '수채화 1' },
    { id: 2,  file: 'watercolor_2.jpg',    title: '수채화 2' },
    { id: 3,  file: 'watercolor_3.webp',   title: '수채화 3' },
    { id: 4,  file: 'watercolor_4.jpg',    title: '수채화 4' },
    { id: 5,  file: 'watercolor_5.jpg',    title: '수채화 5' },
    { id: 6,  file: 'pointillism_1.jpeg',  title: '점묘화 1' },
    { id: 7,  file: 'pointillism_2.jpeg',  title: '점묘화 2' },
    { id: 8,  file: 'oilpainting_1.jpeg',  title: '유화 1'   },
    { id: 9,  file: 'oilpainting_2.jpeg',  title: '유화 2'   },
    { id: 10, file: 'gratage_1.jpg',       title: '그라타주 1'},
  ];

  // ============================================================
  // SECTION: v6 사회자 멘트 풀 (P1-6)
  // ============================================================
  // 카테고리별 트리거: cooldown / counter (직전 낙찰자 도발) / rally (3연속 입찰) / persona (인격 연관)
  // 각 멘트는 함수형 — 컨텍스트 받아 문자열 생성

  const HOST_LINES = {
    // 호가 안내 (직전 낙찰자가 cpu일 때)
    cooldown_cpu: [
      (ctx) => `📢 CPU ${ctx.lastBidderLabel} 그 다음 호가 낙찰하시겠습니까?`,
      (ctx) => `📢 다음은 ${ctx.fmt(ctx.nextPrice)}부터입니다.`,
      (ctx) => `📢 ${ctx.fmt(ctx.currentPrice)}, ${ctx.fmt(ctx.currentPrice)}, ${ctx.fmt(ctx.currentPrice)} — 더 부르실 분?`,
      (ctx) => `📢 다음 호가 ${ctx.fmt(ctx.nextPrice)} — 받으실 분 계신가요?`,
    ],
    cooldown_user: [
      (ctx) => `📢 다음 호가 ${ctx.fmt(ctx.nextPrice)} 받으시는 분?`,
      (ctx) => `📢 ${ctx.fmt(ctx.currentPrice)}, ${ctx.fmt(ctx.currentPrice)}, ${ctx.fmt(ctx.currentPrice)} — 더 부르실 분?`,
      (ctx) => `📢 더 부르실 분 안 계십니까?`,
    ],
    // 직전 낙찰자 도발 (cpu 또는 user)
    counter_cpu: [
      (ctx) => `📢 CPU ${ctx.lastBidderLabel} 관심 없으십니까?`,
      (ctx) => `📢 CPU ${ctx.lastBidderLabel} 지금 ${ctx.fmt(ctx.currentPrice)}인데 입찰하시겠습니까?`,
      (ctx) => `📢 CPU ${ctx.lastBidderLabel} 한번 더 가시죠?`,
    ],
    counter_user: [
      (ctx) => `📢 직전 낙찰자분, 한 번 더 가시겠습니까?`,
      (ctx) => `📢 ${ctx.fmt(ctx.currentPrice)}에 직전 입찰자분, 추가 입찰 의향 있으십니까?`,
    ],
    // 랠리 트리거 (3회 연속 입찰 이상)
    rally: [
      () => `📢 불이 붙기 시작했네요!`,
      () => `📢 분위기가 뜨거워지고 있습니다.`,
      () => `📢 경쟁이 치열해지는군요.`,
      () => `📢 호가가 줄지어 나오고 있습니다!`,
    ],
    // 인격 연관 멘트 — 특정 CPU가 큰 점프 / 입찰 시
    persona_man_big: [
      (ctx) => `📢 CPU ${ctx.actorLabel} — 또 폭주가 시작됐습니다!`,
      (ctx) => `📢 CPU ${ctx.actorLabel} ${ctx.fmt(ctx.currentPrice)}! 강한 한 방이네요.`,
    ],
    persona_app_steady: [
      (ctx) => `📢 CPU ${ctx.actorLabel} — 신중하게 검토 중입니다.`,
      (ctx) => `📢 CPU ${ctx.actorLabel} — 차분한 행보군요.`,
    ],
    persona_tlt_gamble: [
      (ctx) => `📢 CPU ${ctx.actorLabel} — 큰 판 노리는 분이 있네요.`,
      (ctx) => `📢 CPU ${ctx.actorLabel} — 한 번에 크게 가네요!`,
    ],
    persona_shk_burst: [
      (ctx) => `📢 CPU ${ctx.actorLabel} — 조용히 있다가 결국 끼어들었습니다!`,
    ],
    persona_blf_check: [
      (ctx) => `📢 CPU ${ctx.actorLabel} — 한참 침묵하다 갑자기 한 방!`,
    ],
    persona_sni_snipe: [
      (ctx) => `📢 CPU ${ctx.actorLabel} — 막판 저격이 들어왔습니다!`,
    ],
    persona_wth_late: [
      (ctx) => `📢 CPU ${ctx.actorLabel} — 관망하던 분이 막판에 움직였네요.`,
      (ctx) => `📢 CPU ${ctx.actorLabel} — 끝까지 지켜보다 들어옵니다!`,
    ],
    persona_wth_giveup: [
      // v8 패치 1: '포기' 단어 → '10배속 보기'로 일괄 변경 (사회자 멘트)
      (ctx) => `📢 CPU ${ctx.actorLabel} — 끝까지 보다가 결국 10배속 보기로 전환했네요.`,
    ],
    // 자유경매 시작 멘트
    free_start: [
      (ctx) => `📢 시작가 ${ctx.fmt(ctx.currentPrice)}으로 시작! 따라오실 분?`,
      (ctx) => `📢 ${ctx.fmt(ctx.currentPrice)} 부터 시작합니다.`,
    ],
    // 종료 임박 (cooldown 거의 만료)
    closing: [
      (ctx) => `📢 ${ctx.fmt(ctx.currentPrice)}, 마지막으로 부르실 분?`,
      (ctx) => `📢 더 부르실 분 안 계시면 ${ctx.fmt(ctx.currentPrice)}에 낙찰됩니다.`,
    ],
    // 파산 발생 알림
    bankrupt: [
      (ctx) => `📢 CPU ${ctx.actorLabel} 자금 소진. 이번 경매에서 빠집니다.`,
    ],
  };

  // ============================================================
  // SECTION: rng
  // ============================================================

  function mulberry32(seed) {
    let t = (seed >>> 0) || 1;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      let r = t;
      r = Math.imul(r ^ (r >>> 15), r | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(seed) {
    const next = (seed != null) ? mulberry32(seed) : Math.random;
    function normal(mean, sigma) {
      let u = 0, v = 0;
      while (u === 0) u = next();
      while (v === 0) v = next();
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      return mean + z * sigma;
    }
    function clipped(mean, sigma, lo, hi) {
      for (let i = 0; i < 20; i++) {
        const x = normal(mean, sigma);
        if (x >= lo && x <= hi) return x;
      }
      const x = normal(mean, sigma);
      return Math.max(lo, Math.min(hi, x));
    }
    function weighted(items) {
      let total = 0;
      for (const it of items) total += it.w;
      let r = next() * total;
      for (const it of items) {
        r -= it.w;
        if (r <= 0) return it;
      }
      return items[items.length - 1];
    }
    function pick(arr) { return arr[Math.floor(next() * arr.length)]; }
    function rangeFloat(lo, hi) { return lo + next() * (hi - lo); }
    function shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
    return { next, normal, clipped, weighted, pick, rangeFloat, shuffle };
  }

  // ============================================================
  // SECTION: price helpers
  // ============================================================

  function priceByPercent(expected, percent) {
    if (percent >= 0) return expected * (1 + percent);
    return expected / (1 + Math.abs(percent));
  }
  function priceByRatio(expected, ratio) { return expected * ratio; }

  // v8 패치 3 (수정): 호가는 그림 가격의 10% 근사. 5 단위로 반올림.
  // 비유: 경매에서 한 번 부를 때 올라가는 최소 금액 — 현재 가격의 약 10%씩 올라가는 규칙
  // 이전 수치(2/5/10/25/50)는 5% 근사였음 → 10% 근사 수치로 교체
  // 검증: price=200 → 20, price=500 → 50, price=1000 → 100
  function minTick(price) {
    if (price < 50)   return 5;
    if (price < 200)  return 10;
    if (price < 500)  return 25;
    if (price < 1000) return 50;
    if (price < 2000) return 100;
    return 200;
  }
  function roundToTick(price) {
    const t = minTick(price);
    return Math.round(price / t) * t;
  }
  function lerp(x, points) {
    if (x <= points[0][0]) return points[0][1];
    if (x >= points[points.length - 1][0]) return points[points.length - 1][1];
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[i + 1];
      if (x >= x1 && x <= x2) {
        const t = (x - x1) / (x2 - x1);
        return y1 + t * (y2 - y1);
      }
    }
    return points[points.length - 1][1];
  }
  function formatMoney(v) {
    const n = Math.round(v);
    const s = Math.abs(n).toLocaleString('en-US');
    return (n < 0 ? '-$' : '$') + s;
  }

  // ============================================================
  // SECTION: state
  // ============================================================

  const state = {
    cycle: 1,
    round: 1,
    money: CONFIG.startMoney,
    inventory: [],
    cycleResults: [],
    paintings: [],
    cpus: [],
    currentPainting: null,
    _hiddenExpected: 0,
    currentAuction: null,
    currentAuctionKey: null,
    saleQueue: [],
    rng: null,
    debugMode: false,
    forceAuction: [],
    bidLog: [],
    sliders: { ...CONFIG.sliderDefaults },
    extremeRoundSet: new Set(),
    lastResult: null,
    cycleAuctions: [],
    cpuTiltMemory: {},
    lastBidderId: null,
    fastForward: false,
    userTargetSteps: 1,
    lastMaxJump: 0,
    cpuMoneyMean: CONFIG.cpuMoneyDefault,
    _renderDirty: false,
    // v6: P0-3 카운트다운 중 클릭 큐잉
    _pendingBuyClick: false,
    // v6: P1-6 멘트 풀 — 최근 멘트 키 추적 (반복 방지)
    _recentHostKeys: [],
    // v6: P0-5 사이클 자유경매 1등 빈도 (디버그용)
    _free10Variant: null,
  };

  // ============================================================
  // SECTION: slider transforms
  // ============================================================

  function aggressionMul() {
    const s = state.sliders.s1_aggression;
    if (s <= 50) return 0.5 + (s / 50) * 0.5;
    return 1.0 + ((s - 50) / 50) * 1.0;
  }
  function intensityShift() {
    const s = state.sliders.s2_intensity;
    if (s <= 50) return -0.10 + (s / 50) * 0.10;
    return ((s - 50) / 50) * 0.30;
  }
  function ceilingMul() {
    const s = state.sliders.s3_ceilingMean;
    if (s <= 50) return 0.5 + (s / 50) * 0.5;
    return 1.0 + ((s - 50) / 50) * 1.0;
  }
  function extremeRoundForceFraction() {
    return state.sliders.s4_ceilingSigma / 100;
  }
  function cpuMoneyMean() {
    const s = state.sliders.s5_cpuMoney;
    if (s <= 50) {
      return CONFIG.cpuMoneyMin + (s / 50) * (CONFIG.cpuMoneyDefault - CONFIG.cpuMoneyMin);
    }
    return CONFIG.cpuMoneyDefault + ((s - 50) / 50) * (CONFIG.cpuMoneyMax - CONFIG.cpuMoneyDefault);
  }

  // ============================================================
  // SECTION: CPU personalities
  // ============================================================

  function assignPersonalities(rng, round, isExtreme) {
    let dist = isExtreme ? CONFIG.extremeDist : CONFIG.personalityDistByRound[round - 1];
    const shift = intensityShift();
    dist = applyIntensityShift(dist, shift);
    const keys = CONFIG.allPersonas;
    let total = 0;
    for (const k of keys) total += (dist[k] || 0);
    const norm = {};
    for (const k of keys) norm[k] = (dist[k] || 0) / total;

    const counts = {};
    for (const k of keys) counts[k] = Math.round(norm[k] * CONFIG.cpuCount);
    let totalCount = 0;
    for (const k of keys) totalCount += counts[k];
    while (totalCount !== CONFIG.cpuCount) {
      if (totalCount > CONFIG.cpuCount) {
        const maxK = keys.reduce((a, b) => counts[a] >= counts[b] ? a : b);
        counts[maxK]--;
      } else {
        const candidates = keys.filter(k => norm[k] > 0);
        const maxK = candidates.reduce((a, b) => norm[a] >= norm[b] ? a : b);
        counts[maxK]++;
      }
      totalCount = 0;
      for (const k of keys) totalCount += counts[k];
    }
    const types = [];
    for (const k of keys) for (let i = 0; i < counts[k]; i++) types.push(k);
    return rng.shuffle(types);
  }

  function applyIntensityShift(dist, shift) {
    if (shift === 0) return { ...dist };
    const halfShift = shift / 2;
    let MAN = Math.max(0, (dist.MAN || 0) + halfShift);
    let BLF = Math.max(0, (dist.BLF || 0) + halfShift);
    let APP = dist.APP || 0;
    let CON = dist.CON || 0;
    const SHK = dist.SHK || 0;
    const TLT = dist.TLT || 0;
    const MIR = dist.MIR || 0;
    const SNI = dist.SNI || 0;
    const WTH = dist.WTH || 0;
    const need = (MAN + BLF) - ((dist.MAN || 0) + (dist.BLF || 0));
    if (need > 0) {
      const apcoSum = APP + CON;
      if (apcoSum > 0) {
        APP = Math.max(0, APP - need * (APP / apcoSum));
        CON = Math.max(0, CON - need * (CON / apcoSum));
      }
    } else if (need < 0) {
      const apcoSum = APP + CON;
      if (apcoSum > 0) {
        APP -= need * (APP / apcoSum);
        CON -= need * (CON / apcoSum);
      } else {
        APP -= need;
      }
    }
    return { APP, CON, MAN, BLF, SHK, TLT, MIR, SNI, WTH };
  }

  function sampleCpuCeiling(cpu, rng) {
    const def = CONFIG.personalities[cpu.type];
    let ratio;
    if (def.ceilingFixedRatio != null) {
      ratio = def.ceilingFixedRatio;
    } else if (def.ceilingNormalRatio != null) {
      ratio = cpu.tilted ? def.ceilingTiltedRatio : def.ceilingNormalRatio;
    } else {
      const m = 1 + def.ceilingMean;
      ratio = rng.clipped(m, def.ceilingSigma, 1 + def.ceilingClip[0], 1 + def.ceilingClip[1]);
    }
    return ratio * ceilingMul();
  }

  // v6: P0-4 CPU 자산 광분포 + 5라운드 참여 보장
  // 평균 mean이 입력되면 그를 중심으로 3계층 분포 + 부자/중산층 최소 보장
  function sampleCpuMoneys(rng, mean) {
    // mean 비율로 tier 기준점 스케일
    const scale = mean / CONFIG.cpuMoneyDefault; // 50일 때 = 1
    const tiers = CONFIG.cpuMoneyTiers;
    const N = CONFIG.cpuCount;

    // 각 CPU별 tier 배정 (보장 + 비율)
    const slots = [];
    // 부자/중산층 최소 보장
    for (let i = 0; i < CONFIG.cpuRichGuaranteedMin; i++) slots.push('rich');
    for (let i = 0; i < CONFIG.cpuMidGuaranteedMin; i++) slots.push('middle');
    // 나머지는 비율로 분배
    while (slots.length < N) {
      const r = rng.next();
      let acc = 0;
      let chosen = 'middle';
      for (const t of ['poor', 'middle', 'rich']) {
        acc += tiers[t].ratio;
        if (r < acc) { chosen = t; break; }
      }
      slots.push(chosen);
    }
    // 셔플 (보장 슬롯도 위치 랜덤화)
    const shuffled = rng.shuffle(slots);

    // 각 슬롯에서 금액 샘플 (uniform 안에서)
    const moneys = [];
    for (const tier of shuffled) {
      const t = tiers[tier];
      const lo = t.baseLo * scale;
      const hi = t.baseHi * scale;
      const v = lo + rng.next() * (hi - lo);
      moneys.push(Math.max(0, Math.round(v)));
    }
    return moneys;
  }

  // 호환용 (단일 샘플 — 정산창 등에서 안 쓰지만 self-test 호환)
  function sampleCpuMoney(rng, mean) {
    const moneys = sampleCpuMoneys(rng, mean);
    return moneys[Math.floor(rng.next() * moneys.length)];
  }

  function makeCpus(rng, round, isExtreme, mean) {
    const types = assignPersonalities(rng, round, isExtreme);
    const usedMean = (mean != null) ? mean : cpuMoneyMean();
    const moneys = sampleCpuMoneys(rng, usedMean);
    // v8 패치 10: 디버그 모드일 때 CPU 자금에 배율 적용
    // 비유: 자체 검증 패널에서 CPU 자금 배율 슬라이더를 올리면 CPU가 더 많은 돈으로 입찰
    const dbgMult = (window._mn9Debug && typeof window._mn9Debug.cpuFundsMult === 'number')
      ? window._mn9Debug.cpuFundsMult
      : 1;
    const cpus = [];
    for (let i = 0; i < CONFIG.cpuCount; i++) {
      const money = moneys[i] * dbgMult;
      const cpu = {
        id: i + 1,
        type: types[i],
        skips: 0, retired: false, lastBid: null, hasBid: false, ceiling: 0,
        counterBonusUntil: 0, counterBonusValue: 0, lastActionAt: 0,
        tilted: state.cpuTiltMemory && state.cpuTiltMemory[i + 1] === 'lost',
        shkBurstUsed: false,
        wthActed: false,  // v6: WTH는 사이클 한 번 액션
        money, bankrupt: money <= 0,
      };
      cpu.ceiling = sampleCpuCeiling(cpu, rng);
      cpus.push(cpu);
    }
    return cpus;
  }

  function cpuActionProb(cpu, ctx) {
    const def = CONFIG.personalities[cpu.type];
    const ratio = ctx.priceRatio;
    if (ratio > cpu.ceiling) return 0;

    if (cpu.type === 'BLF') {
      let p = def.baseProb;
      if (cpu.counterBonusUntil > 0 && nowMs() < cpu.counterBonusUntil) {
        p += cpu.counterBonusValue;
      }
      return p;
    }
    if (cpu.type === 'SHK') {
      let p = def.baseProb;
      if (!cpu.shkBurstUsed && ctx.timerProgress != null &&
          ctx.timerProgress >= def.burstTimerWindowLo &&
          ctx.timerProgress <= def.burstTimerWindowHi) {
        return p;
      }
      return p;
    }
    if (cpu.type === 'TLT') {
      return cpu.tilted ? def.tiltedProb : def.baseProb;
    }
    if (cpu.type === 'MIR') {
      let p = def.baseProb;
      const bidderCount = ctx.activeCpus ? ctx.activeCpus.filter(c => c.hasBid && c.id !== cpu.id).length : 0;
      if (bidderCount >= def.triggerThresholdCpus) p += def.triggeredBonus;
      return p;
    }
    if (cpu.type === 'SNI') {
      if (ctx.snipeMode) return def.snipeProb;
      return def.baseProb;
    }
    if (cpu.type === 'WTH') {
      // v6: WTH는 막판(timerProgress >= lateWindow) 또는 ratio가 낮을 때만 활성
      if (ctx.timerProgress != null && ctx.timerProgress >= def.lateWindow && !cpu.wthActed) {
        return def.latePunchProb;
      }
      return def.baseProb;
    }
    return lerp(ratio, def.probCurve);
  }

  function dynamicJumpSteps(cpu, currentPrice, expected, rng) {
    const ceilingPrice = cpu.ceiling * expected;
    const gap = ceilingPrice - currentPrice;
    if (gap <= 0) return 1;
    const gapRatio = gap / Math.max(1, expected);
    let steps;
    if (gapRatio < 0.20) steps = 1;
    else if (gapRatio < 0.40) steps = 2;
    else if (gapRatio < 0.60) steps = 3 + Math.floor(rng.next() * 2);
    else steps = 4 + Math.floor(rng.next() * 2);
    const half = Math.floor(state.lastMaxJump / 2);
    if (half > 1 && steps < half) steps = half;
    return steps;
  }

  function cpuJumpSteps(cpu, rng, isCheckRaise, isShkBurst, currentPrice, expected, ctx) {
    const def = CONFIG.personalities[cpu.type];
    if (cpu.type === 'BLF' && isCheckRaise) {
      const [lo, hi] = def.checkRaiseJumpSteps;
      return lo + Math.floor(rng.next() * (hi - lo + 1));
    }
    if (cpu.type === 'SHK' && isShkBurst) {
      return def.burstJumpSteps;
    }
    // v6: WTH 막판 펀치 — 큰 점프
    if (cpu.type === 'WTH' && ctx && ctx.timerProgress != null && ctx.timerProgress >= def.lateWindow) {
      const [lo, hi] = def.punchJumpSteps;
      return lo + Math.floor(rng.next() * (hi - lo + 1));
    }
    if (currentPrice != null && expected != null && expected > 0) {
      const dyn = dynamicJumpSteps(cpu, currentPrice, expected, rng);
      if (cpu.type === 'MAN') {
        const [lo, hi] = def.jumpStepsRange;
        const base = lo + Math.floor(rng.next() * (hi - lo + 1));
        return Math.max(dyn, base);
      }
      return dyn;
    }
    if (cpu.type === 'MAN') {
      const [lo, hi] = def.jumpStepsRange;
      return lo + Math.floor(rng.next() * (hi - lo + 1));
    }
    return def.jumpSteps || 1;
  }

  function cpuRetireThreshold(cpu) {
    return CONFIG.personalities[cpu.type].retireThreshold;
  }

  function cpuCanAfford(cpu, nextPrice) {
    if (cpu.bankrupt) return false;
    if (cpu.money <= 0) { cpu.bankrupt = true; return false; }
    return nextPrice <= cpu.money;
  }

  // ============================================================
  // SECTION: player reactions
  // ============================================================

  function nowMs() { return Date.now(); }

  function onUserBidReaction(rng, bidTimeFromStartMs) {
    if (bidTimeFromStartMs <= CONFIG.playerFastBidMs) {
      const apps = state.cpus.filter(c => c.type === 'APP' && !c.retired && !c.bankrupt);
      if (apps.length > 0) {
        const target = rng.pick(apps);
        target.type = 'MAN';
        target.ceiling = sampleCpuCeiling(target, rng);
        logBid(`CPU #${target.id} 광기형으로 변환 (유저 빠른 입찰).`, 'warn');
      }
    }
    triggerBLFCounter('user');
  }

  function onUserFirstBidEarly(rng) {
    const blfs = state.cpus.filter(c => c.type === 'BLF' && !c.retired && !c.bankrupt);
    if (blfs.length > 0) {
      const target = rng.pick(blfs);
      target.type = 'MAN';
      target.ceiling = sampleCpuCeiling(target, state.rng);
      logBid(`CPU #${target.id} 광기형으로 변환 (유저 즉시 입찰).`, 'warn');
    }
  }

  function onUserPassReaction(rng) {
    const apps = state.cpus.filter(c => c.type === 'APP' && !c.retired && !c.bankrupt);
    if (apps.length > 0) {
      const target = rng.pick(apps);
      target.type = 'CON';
      target.ceiling = sampleCpuCeiling(target, rng);
      logBid(`CPU #${target.id} 절약형으로 변환 (유저 패스).`, 'sys');
    }
  }

  function onUserSealedBigBid() {
    const now = nowMs();
    for (const c of state.cpus) {
      if (c.type === 'BLF' && !c.retired && !c.bankrupt) {
        c.counterBonusUntil = now + CONFIG.personalities.BLF.counterDurationMs;
        c.counterBonusValue = CONFIG.personalities.BLF.counterUserBonus;
      }
    }
  }

  function triggerBLFCounter(source) {
    const bonus = source === 'user'
      ? CONFIG.personalities.BLF.counterUserBonus
      : CONFIG.personalities.BLF.counterCpuBonus;
    const until = nowMs() + CONFIG.personalities.BLF.counterDurationMs;
    for (const c of state.cpus) {
      if (c.type === 'BLF' && !c.retired && !c.bankrupt) {
        c.counterBonusUntil = until;
        c.counterBonusValue = bonus;
      }
    }
  }

  function onLargeJump(rng, jumpSteps) {
    if (jumpSteps < CONFIG.bigJumpStepsThreshold) return;
    const shks = state.cpus.filter(c => c.type === 'SHK' && !c.retired && !c.bankrupt);
    if (shks.length > 0) {
      const target = rng.pick(shks);
      target.type = 'MAN';
      target.ceiling = sampleCpuCeiling(target, rng);
      logBid(`CPU #${target.id} 광기형으로 변환 (큰 호가 점프).`, 'warn');
    }
  }

  // ============================================================
  // SECTION: extreme rounds
  // ============================================================

  function planExtremeRounds(rng) {
    state.extremeRoundSet = new Set();
    const force = extremeRoundForceFraction();
    if (force >= 0.95) {
      for (let i = 1; i <= 5; i++) state.extremeRoundSet.add(i);
      return;
    }
    const baseCount = rng.weighted([
      { count: 1, w: 0.5 }, { count: 2, w: 0.5 },
    ]).count;
    let count = baseCount;
    if (force > 0.5) {
      const extra = Math.floor((force - 0.5) / 0.1);
      count = Math.min(5, baseCount + extra);
    }
    const all = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle(all);
    for (let i = 0; i < count; i++) state.extremeRoundSet.add(shuffled[i]);
  }

  function isExtremeRound(round) { return state.extremeRoundSet.has(round); }

  function sampleStartRatio(rng, isExtreme) {
    if (isExtreme) {
      if (rng.next() < CONFIG.extremeLowChance) return CONFIG.extremeLowRatio;
      return rng.rangeFloat(CONFIG.extremeHighRatioRange[0], CONFIG.extremeHighRatioRange[1]);
    }
    return rng.clipped(
      CONFIG.startPriceNormalMeanRatio,
      CONFIG.startPriceNormalSigma,
      CONFIG.startPriceClipRatio[0],
      CONFIG.startPriceClipRatio[1]
    );
  }

  // ============================================================
  // SECTION: 사이클 구성 알고리즘 (v6: P0-5 자유1등 2~3회 동적)
  // ============================================================
  // 50% 확률: 자유1등 2번 (변주는 free10_2nd 또는 candle 중 1개)
  // 50% 확률: 자유1등 3번 + (변주는 free10_2nd 1개)
  // 특수경매는 남은 슬롯(5 - 자유1등 - 변주)에서 unique 채움.
  function buildCycle(rng) {
    // V6 단계별 분기: auctionCycleCount 기준으로 경매 풀·라운드 수 결정
    // 비유: 경매장을 몇 번째 방문하느냐에 따라 그림 종류와 라운드 수가 달라집니다.
    const cnt = (window.MN9_Game && typeof window.MN9_Game.state === 'function')
      ? (window.MN9_Game.state() ? (window.MN9_Game.state().auctionCycleCount || 0) : 0)
      : 0;

    // 1차 (cnt=0): v9 패치 — 2단계 수채화 1장 고정, 1라운드
    // 비유: 첫 방문 = 미리 정해둔 2단계 수채화 딱 1장
    if (cnt === 0) {
      if (window.MN9_FirstAuction && window.MN9_FirstAuction.isFirstAuction(state)) {
        const fixedPainting = window.MN9_FirstAuction.getFirstAuctionPainting(state.paintings);
        if (fixedPainting) {
          state._auctionPoolFilter = (ps) => ps.filter(p => p.type === 'watercolor' && p.grade === 2);
          return ['free10_1st'];
        }
      }
      // isFirstAuction이 false거나 fixedPainting 없을 때 fall-through 방지
      // P2 픽스: 이전 사이클 필터 잔존 방지 (디버그로 cnt=0 리셋 시 안전망)
      state._auctionPoolFilter = null;
      return ['free10_1st'];
    }

    // 2차 (cnt=1): 수채화 3·4등급 풀, 2라운드
    // 비유: 두 번째 방문 = 중급 수채화만 2번 경매
    if (cnt === 1) {
      state._auctionPoolFilter = (paintings) =>
        paintings.filter(p => p.type === 'watercolor' && (p.grade === 3 || p.grade === 4));
      return ['free10_1st', 'free10_2nd'];
    }

    // 3차 (cnt=2): 수채화 5등급 + 점묘 풀, 3라운드
    // 비유: 세 번째 방문 = 고급 수채화 + 점묘화 3번 경매
    if (cnt === 2) {
      state._auctionPoolFilter = (paintings) =>
        paintings.filter(p =>
          (p.type === 'watercolor' && p.grade === 5) || p.type === 'pointillism'
        );
      return ['free10_1st', 'free10_2nd', 'candle_1st'];
    }

    // 4차 이후 (cnt>=3): 기존 5라운드 무작위 로직
    // 비유: 네 번째 방문부터는 모든 그림 풀에서 무작위로 5라운드
    state._auctionPoolFilter = null;

    const twoOrThree = rng.next() < 0.5 ? 2 : 3;
    state._free10Variant = twoOrThree;  // 디버그
    const rounds = [];
    for (let i = 0; i < twoOrThree; i++) rounds.push('free10_1st');

    // 변주 추가 (자유2등 또는 촛불)
    let variantCount;
    if (twoOrThree === 2) {
      // 변주 1개 — pool: free10_2nd · candle_1st · candle_2nd
      variantCount = 1;
    } else {
      // 자유1등 3번 시: 변주 1개 (free10_2nd 우선 50% / candle 50%)
      variantCount = 1;
    }
    const variantPool = ['free10_2nd', 'candle_1st', 'candle_2nd'];
    for (let i = 0; i < variantCount; i++) {
      rounds.push(rng.pick(variantPool));
    }

    // 남은 슬롯 = 5 - rounds.length. 특수 풀에서 unique
    const remaining = 5 - rounds.length;
    const specialPool = ['dutch', 'sealed', 'fixed', 'limited_1st', 'limited_2nd'];
    const shuffled = rng.shuffle(specialPool);
    for (let i = 0; i < remaining; i++) rounds.push(shuffled[i]);

    // 첫 라운드는 자유1등 고정, 나머지 셔플
    const first = rounds[0];
    const rest = rng.shuffle(rounds.slice(1));
    return [first, ...rest];
  }

  // ============================================================
  // SECTION: 사회자 멘트 (v6: P1-6 풀 사용)
  // ============================================================

  // ctx = { currentPrice, nextPrice, fmt, lastBidderLabel, actorLabel }
  // 반복 방지: 최근 5개 키 추적
  function pickHostLine(keyGroup, ctx) {
    const pool = HOST_LINES[keyGroup];
    if (!pool || pool.length === 0) return null;
    // 최근 키 = "{group}:{idx}"
    let attempts = 0;
    let chosen;
    do {
      const idx = Math.floor(state.rng.next() * pool.length);
      const fullKey = `${keyGroup}:${idx}`;
      if (!state._recentHostKeys.includes(fullKey) || attempts >= 5) {
        chosen = { line: pool[idx], key: fullKey };
        break;
      }
      attempts++;
    } while (attempts < 10);
    if (!chosen) {
      const idx = Math.floor(state.rng.next() * pool.length);
      chosen = { line: pool[idx], key: `${keyGroup}:${idx}` };
    }
    state._recentHostKeys.push(chosen.key);
    if (state._recentHostKeys.length > 5) state._recentHostKeys.shift();
    return chosen.line(ctx);
  }

  // v6: 그림 설명 멘트 1개 뽑기 (카테고리별)
  function pickFlavorLine(painting) {
    if (!painting) return null;
    const cat = painting.category || 'C';
    const pool = CONFIG.paintingFlavorByCategory[cat] || CONFIG.paintingFlavorByCategory.C;
    return state.rng.pick(pool);
  }

  // 인격 타입 → host 키 그룹 매핑 (큰 액션 시)
  function personaHostKey(type, isCheckRaise, isShkBurst, isSnipe, isWthLate) {
    if (isCheckRaise) return 'persona_blf_check';
    if (isShkBurst) return 'persona_shk_burst';
    if (isSnipe) return 'persona_sni_snipe';
    if (isWthLate) return 'persona_wth_late';
    if (type === 'MAN') return 'persona_man_big';
    if (type === 'TLT') return 'persona_tlt_gamble';
    if (type === 'APP') return 'persona_app_steady';
    return null;
  }

  // ============================================================
  // SECTION: auctions — 공통 유틸
  // ============================================================

  function logBid(text, kind) {
    state.bidLog.push({ text, kind: kind || 'sys', t: Date.now() });
    if (state.bidLog.length > 200) state.bidLog.shift();
    state._renderDirty = true;
  }

  function canBidByActor(actorId) { return state.lastBidderId !== actorId; }

  function scaledDt(dtMs) {
    return state.fastForward ? dtMs * CONFIG.fastForwardMul : dtMs;
  }

  function computeTargetPrice(currentPrice, steps) {
    if (steps <= 0) return currentPrice;
    let p = currentPrice;
    for (let i = 0; i < steps; i++) p += minTick(p);
    return p;
  }

  function resyncUserTarget(currentPrice) {
    const my = computeTargetPrice(currentPrice, state.userTargetSteps);
    if (my <= currentPrice) state.userTargetSteps = 1;
  }


  // ---------- 지정가 (v6: P1-12 그림 설명 + P0-3 클릭 큐 호환) ----------
  function makeFixedPrice(ctx) {
    const { expected, cpus, rng, painting, startPriceOverride } = ctx;
    const percent = rng.rangeFloat(-1.0, 1.0);
    let price = roundToTick(priceByPercent(expected, percent));
    // v8 패치 6 추가: 자체 출품 시작가가 있으면 그 가격으로 시작
    if (startPriceOverride != null) { price = startPriceOverride; }

    let over = false;
    let winner = null;
    let timerMs = CONFIG.fixedTimerMs;
    let userGaveUp = false;
    let acc = 0;
    const tryIntervalMs = 1000;
    const catName = painting && painting.category ? painting.category : 'C';
    let countdownMs = CONFIG.fixedCountdownByCategory[catName] || 5000;
    let countdownDone = false;
    const shouts = (CONFIG.fixedCloseupShouts[catName] || CONFIG.fixedCloseupShouts.C).slice();
    let shoutTimerMs = 600;
    let lastCountdownSec = -1;

    const api = {
      name: '지정가 거래',
      ruleLine: `정해진 가격에 먼저 「산다」 누르는 사람이 낙찰. ${countdownMs/1000}초 카운트다운 후 30초 안에 결정.`,
      inputMode: 'buy',
      price, startedAt: 0, key: 'fixed',

      start() {
        this.startedAt = nowMs();
        state._pendingBuyClick = false;
        logBid(`📢 ${CONFIG.auctionFriendlyName.fixed} ${formatMoney(price)} 출품. ${countdownMs/1000}초 카운트다운!`, 'host');
      },
      step(dtMs) {
        if (over) return;
        const dt = scaledDt(dtMs);
        shoutTimerMs -= dt;
        if (shoutTimerMs <= 0 && shouts.length > 0) {
          logBid(shouts.shift(), 'host');
          const interval = catName === 'E' ? 1800 : (catName === 'D' ? 1500 : (catName === 'C' ? 1300 : (catName === 'B' ? 1200 : 1100)));
          shoutTimerMs = interval;
        }
        if (!countdownDone) {
          countdownMs -= dt;
          const sec = Math.ceil(countdownMs / 1000);
          if (sec !== lastCountdownSec && sec > 0) {
            lastCountdownSec = sec;
            if (sec <= 3) logBid(`📢 ${sec}`, 'host cd');
          }
          if (countdownMs <= 0) {
            countdownDone = true;
            logBid('📢 GO! 「지금 산다」 버튼 활성!', 'host');
            // v6: P0-3 클릭 큐 — 카운트다운 중 누른 클릭을 GO 즉시 실행
            if (state._pendingBuyClick) {
              state._pendingBuyClick = false;
              this._userBuy();
            }
          }
          return;
        }
        timerMs -= dt;
        if (timerMs <= 0) {
          over = true;
          timerMs = 0;
          logBid('📢 시간 종료. 낙찰자 없이 다음 라운드.', 'sys');
          return;
        }
        acc += dt;
        while (acc >= tryIntervalMs && !over) {
          acc -= tryIntervalMs;
          this._tryCpuBuy();
        }
      },
      _tryCpuBuy() {
        const ratio = price / expected;
        const ordered = rng.shuffle(cpus);
        const activeCpus = cpus.filter(c => !c.retired && !c.bankrupt);
        for (const c of ordered) {
          if (c.retired || c.bankrupt) continue;
          if (!canBidByActor(c.id)) continue;
          if (!cpuCanAfford(c, price)) continue;
          let p = cpuActionProb(c, { priceRatio: ratio, activeCpus }) * aggressionMul();
          if (rng.next() < p) {
            over = true;
            winner = c.id;
            c.hasBid = true;
            c.lastBid = price;
            state.lastBidderId = c.id;
            logBid(`CPU #${c.id} ${CONFIG.personaEmoji[c.type]} 가 ${formatMoney(price)} 에 구매.`, 'cpu');
            logBid(`📢 낙찰됐습니다. CPU #${c.id} ${formatMoney(price)} 낙찰!`, 'host cd');
            triggerBLFCounter('cpu');
            return;
          } else {
            c.skips++;
            if (c.skips >= cpuRetireThreshold(c)) {
              c.retired = true;
              // v8 패치 1: CPU 로그 '포기' → '10배속 보기'
              logBid(`CPU #${c.id} ${CONFIG.personaEmoji[c.type]} 10배속 보기.`, 'sys');
            }
          }
        }
      },
      _userBuy() {
        if (over) return;
        over = true;
        winner = 'user';
        state.lastBidderId = 'user';
        logBid(`나 가 ${formatMoney(price)} 에 구매.`, 'user');
        logBid(`📢 낙찰됐습니다. 나 ${formatMoney(price)} 낙찰!`, 'host cd');
        const elapsed = nowMs() - this.startedAt;
        onUserBidReaction(rng, elapsed);
      },
      onUserBid(payload) {
        if (over) return;
        if (payload && payload.giveUp) {
          userGaveUp = true;
          state.fastForward = true;
          // v8 패치 1: '입찰 포기' → '10배속 보기'
          logBid('10배속 보기 중 (⏩ ×10).', 'user');
          return;
        }
        // v6: P0-3 카운트다운 중 클릭 → 큐잉
        if (!countdownDone) {
          state._pendingBuyClick = true;
          logBid('나 입찰 대기 — GO 즉시 발사 예약.', 'user');
          return;
        }
        if (!canBidByActor('user')) return;
        this._userBuy();
      },
      isOver() { return over; },
      end() { return { winner, finalPrice: price, purchased: winner != null }; },
      getView() {
        return {
          currentPrice: price,
          topBidder: winner === 'user' ? '나' : (winner ? `CPU #${winner}` : '대기 중'),
          timerText: countdownDone ? (timerMs / 1000).toFixed(1) + 's' : `시작 대기`,
          candleOn: false,
          userGaveUp,
          countdownActive: !countdownDone,
          countdownLeft: countdownMs,
          allowGiveUp: !userGaveUp && !over,
          topBidderId: winner,
          pendingBuy: state._pendingBuyClick,
          tickInfo: `호가 단위: ${formatMoney(minTick(price))}`,
        };
      },
    };
    return api;
  }


  // ---------- 자유경매 (v6: P0-2 2등가 5초버그 픽스 + P1-7 cooldown 5~15초 모델 + P1-6 멘트 + P1-12 그림 설명) ----------
  // 변경 요약:
  //   - timerMs 폐기. 대신 hostCooldownMs (사회자 다음 멘트까지 남은 시간) + 마지막 멘트 이후 cooldown 만료되면 종료
  //   - 시작 시 hostCooldownMs = rangeFloat(5000, 15000), 평균 ~10초
  //   - 입찰 발생 시 hostCooldownMs 리셋 (다시 5~15초)
  //   - 시작 직후 lastBidderId = null 보장 (P0-2: 2등가 호가 직후 5초 종료 방지)
  //   - 멘트 풀에서 cooldown 안에 1~2번 추가 host shout (랠리 등) 트리거
  function makeFreeAuction(opts) {
    const secondPrice = !!(opts && opts.secondPrice);
    return function (ctx) {
      const { expected, cpus, rng, painting, startPriceOverride } = ctx;
      const startRatio = sampleStartRatio(rng, isExtremeRound(state.round));
      let currentPrice = roundToTick(expected * startRatio);
      if (currentPrice < 1) currentPrice = 1;
      // v8 패치 6 추가: 자체 출품 시작가가 있으면 그 가격으로 시작
      if (startPriceOverride != null) { currentPrice = startPriceOverride; }
      let topBidder = null;
      let secondTopPrice = currentPrice;
      let over = false;
      let bidIndex = 0;
      let bidCount = 0;
      let consecutiveBids = 0;       // v6: 랠리 트리거 (3 연속)
      let cpuNextDelayMs = -1;
      let cpuNextActor = null;
      let startedAt = 0;
      let userBidsCount = 0;
      let userGaveUp = false;
      const checkRaiseTriggered = {};
      let roundMaxJump = 0;
      // v6: P1-7 cooldown 모델
      let hostCooldownMs = 0;
      let hostCooldownMax = 0;
      let totalElapsedMs = 0;
      // 다음 host 멘트 발사까지 시간 (cooldown 내 중간 멘트)
      let nextHostShoutMs = 0;
      // P1-12 그림 설명 다음 발사까지 (15초 ~ 25초마다 1번)
      let nextFlavorMs = 0;
      // 종료 임박 알림 발사 여부 (cooldown 30% 미만 시 1번)
      let closingShouted = false;

      function rollCooldown() {
        const lo = CONFIG.freeHostCooldownMin;
        const hi = CONFIG.freeHostCooldownMax;
        return lo + rng.next() * (hi - lo);
      }

      function fmtCtx(actorCpu) {
        const lastId = state.lastBidderId;
        let lastBidderLabel = '—';
        if (lastId === 'user') lastBidderLabel = '나';
        else if (typeof lastId === 'number') lastBidderLabel = `#${lastId}`;
        let actorLabel = '';
        if (actorCpu) actorLabel = `#${actorCpu.id}`;
        return {
          currentPrice,
          nextPrice: currentPrice + minTick(currentPrice),
          fmt: formatMoney,
          lastBidderLabel,
          actorLabel,
        };
      }

      const api = {
        name: secondPrice ? '자유경매 (2등가격)' : '자유경매 (1등가격)',
        ruleLine: secondPrice
          ? '사회자가 임의로 5~15초 간격으로 호가를 부릅니다. 모두 침묵하면 종료, 2등 가격에 1등 낙찰. 휠/방향키로 N 조절.'
          : '사회자가 임의로 5~15초 간격으로 호가를 부릅니다. 모두 침묵하면 종료, 1등 가격에 1등 낙찰. 휠/방향키로 N 조절.',
        inputMode: 'next',
        key: secondPrice ? 'free10_2nd' : 'free10_1st',

        start() {
          startedAt = nowMs();
          state.userTargetSteps = 1;
          // v6: P0-2 시작 직후 lastBidderId 리셋 (이전 라운드 잔재 제거)
          state.lastBidderId = null;
          hostCooldownMs = rollCooldown();
          hostCooldownMax = hostCooldownMs;
          nextHostShoutMs = hostCooldownMs * 0.5;
          nextFlavorMs = 8000 + rng.next() * 6000;
          closingShouted = false;
          const ctx0 = fmtCtx(null);
          const startLine = pickHostLine('free_start', ctx0);
          if (startLine) logBid(startLine, 'host');
          this._scheduleNextCpu();
        },
        _scheduleNextCpu() {
          const N = bidIndex + 1;
          let lo, hi;
          if (N <= 10) { lo = (N - 1) * 1000; hi = N * 1000; }
          else { lo = 9900; hi = 10000; }
          const aggScale = 1.5 - (state.sliders.s1_aggression / 100) * 1.2;
          lo *= aggScale; hi *= aggScale;
          cpuNextDelayMs = lo + (hi - lo) * rng.next();
          const nextStepPrice = currentPrice + minTick(currentPrice);
          const active = cpus.filter(c => !c.retired && !c.bankrupt && cpuCanAfford(c, nextStepPrice));
          if (active.length === 0) {
            cpuNextActor = null;
            return;  // v6: 전원 포기여도 즉시 종료 아님 — 사회자 cooldown 만료에 의해 종료
          }
          cpuNextActor = rng.pick(active);
        },
        _checkRaiseScan() {
          const elapsed = nowMs() - startedAt;
          if (elapsed < CONFIG.personalities.BLF.checkRaiseAfterMs) return null;
          for (const c of cpus) {
            if (c.type === 'BLF' && !c.retired && !c.bankrupt && !c.hasBid && !checkRaiseTriggered[c.id]) {
              if (rng.next() < CONFIG.personalities.BLF.checkRaiseProb) {
                checkRaiseTriggered[c.id] = true;
                return c;
              } else { checkRaiseTriggered[c.id] = true; }
            }
          }
          return null;
        },
        _shkBurstScan() {
          const progress = hostCooldownMax > 0 ? (1 - (hostCooldownMs / hostCooldownMax)) : 0;
          for (const c of cpus) {
            if (c.type === 'SHK' && !c.retired && !c.bankrupt && !c.shkBurstUsed) {
              const def = CONFIG.personalities.SHK;
              if (progress >= def.burstTimerWindowLo && progress <= def.burstTimerWindowHi) {
                c.shkBurstUsed = true;
                if (rng.next() < def.burstChance) return c;
              }
            }
          }
          return null;
        },
        _wthScan() {
          // 막판 진입(cooldown 65%+ 소진)에 관망형 액션
          const progress = hostCooldownMax > 0 ? (1 - (hostCooldownMs / hostCooldownMax)) : 0;
          if (progress < CONFIG.personalities.WTH.lateWindow) return null;
          for (const c of cpus) {
            if (c.type !== 'WTH' || c.retired || c.bankrupt || c.wthActed) continue;
            // 막판 액션 결정
            const r = rng.next();
            if (r < CONFIG.personalities.WTH.lateGiveUpProb) {
              c.wthActed = true;
              c.retired = true;
              const flavor = pickHostLine('persona_wth_giveup', fmtCtx(c));
              if (flavor) logBid(flavor, 'host');
              // v8 패치 1: '막판 포기' → '막판 10배속'
              logBid(`CPU #${c.id} ${CONFIG.personaEmoji[c.type]} 막판 10배속.`, 'sys');
              continue;
            }
            if (r < CONFIG.personalities.WTH.lateGiveUpProb + CONFIG.personalities.WTH.latePunchProb) {
              c.wthActed = true;
              return c;
            }
          }
          return null;
        },
        _isSnipeMode() {
          // v6: cooldown 80% 이상 소진 시 저격 모드
          if (hostCooldownMax <= 0) return false;
          return hostCooldownMs <= hostCooldownMax * 0.20;
        },
        _hostCheck(dt) {
          // 중간 멘트 + 그림 설명
          nextHostShoutMs -= dt;
          nextFlavorMs -= dt;
          // 종료 임박 (cooldown 25% 이하) — 한 번
          if (!closingShouted && hostCooldownMs <= hostCooldownMax * 0.25 && hostCooldownMs > 0) {
            closingShouted = true;
            const line = pickHostLine('closing', fmtCtx(null));
            if (line) logBid(line, 'host');
            return;
          }
          if (nextFlavorMs <= 0) {
            const fl = pickFlavorLine(painting);
            if (fl) logBid(fl, 'host');
            nextFlavorMs = 10000 + rng.next() * 8000;
            return;
          }
          if (nextHostShoutMs <= 0) {
            // 멘트 풀 선택: 직전 낙찰자 도발 vs 호가 안내
            const lastId = state.lastBidderId;
            const r = rng.next();
            let line = null;
            if (bidCount === 0) {
              line = pickHostLine('cooldown_user', fmtCtx(null));
            } else if (lastId === 'user') {
              line = r < 0.4
                ? pickHostLine('counter_user', fmtCtx(null))
                : pickHostLine('cooldown_user', fmtCtx(null));
            } else if (typeof lastId === 'number') {
              line = r < 0.4
                ? pickHostLine('counter_cpu', fmtCtx(null))
                : pickHostLine('cooldown_cpu', fmtCtx(null));
            } else {
              line = pickHostLine('cooldown_user', fmtCtx(null));
            }
            if (line) logBid(line, 'host');
            nextHostShoutMs = 2500 + rng.next() * 2500;
          }
        },
        _trySniper() {
          if (!this._isSnipeMode()) return null;
          for (const c of cpus) {
            if (c.type !== 'SNI' || c.retired || c.bankrupt) continue;
            if (!canBidByActor(c.id)) continue;
            const next = currentPrice + minTick(currentPrice);
            if (!cpuCanAfford(c, next)) continue;
            const ratio = next / expected;
            if (ratio > c.ceiling) continue;
            const def = CONFIG.personalities.SNI;
            const frameP = 1 - Math.pow(1 - def.snipeProb, 0.1);
            if (rng.next() < frameP) return c;
          }
          return null;
        },
        step(dtMs) {
          if (over) return;
          const dt = scaledDt(dtMs);
          totalElapsedMs += dt;
          hostCooldownMs -= dt;
          if (hostCooldownMs <= 0) {
            // cooldown 만료 → 종료
            over = true;
            hostCooldownMs = 0;
            return;
          }
          this._hostCheck(dt);
          const checkRaiseCpu = this._checkRaiseScan();
          if (checkRaiseCpu) {
            this._tryCpu(checkRaiseCpu, true, false, false);
            if (over) return;
          }
          const shkCpu = this._shkBurstScan();
          if (shkCpu) {
            this._tryCpu(shkCpu, false, true, false);
            if (over) return;
          }
          const wthCpu = this._wthScan();
          if (wthCpu) {
            this._tryCpu(wthCpu, false, false, true);
            if (over) return;
          }
          const sniCpu = this._trySniper();
          if (sniCpu) {
            this._tryCpu(sniCpu, false, false, false);
            if (over) return;
          }
          if (cpuNextActor != null) {
            cpuNextDelayMs -= dt;
            if (cpuNextDelayMs <= 0) {
              this._tryCpu(cpuNextActor, false, false, false);
              if (over) return;
              this._scheduleNextCpu();
            }
          }
        },
        _tryCpu(cpu, isCheckRaise, isShkBurst, isWthLate) {
          if (cpu.retired || cpu.bankrupt) return;
          if (!canBidByActor(cpu.id)) return;
          const progress = hostCooldownMax > 0 ? (1 - (hostCooldownMs / hostCooldownMax)) : 0;
          const ctxJump = { timerProgress: progress };
          const jump = cpuJumpSteps(cpu, rng, isCheckRaise, isShkBurst, currentPrice, expected, ctxJump);
          let nextPrice = currentPrice;
          for (let j = 0; j < jump; j++) nextPrice += minTick(nextPrice);
          if (nextPrice <= currentPrice) {
            cpu.skips++;
            if (cpu.skips >= cpuRetireThreshold(cpu)) {
              cpu.retired = true;
              // v8 패치 1: '포기' → '10배속 보기'
              logBid(`CPU #${cpu.id} ${CONFIG.personaEmoji[cpu.type]} 10배속 보기.`, 'sys');
            }
            return;
          }
          if (!cpuCanAfford(cpu, nextPrice)) {
            cpu.skips++;
            if (cpu.skips >= cpuRetireThreshold(cpu)) {
              cpu.retired = true;
              // v8 패치 1: '자금 부족 포기' → '자금 부족 (10배속)'
              logBid(`CPU #${cpu.id} ${CONFIG.personaEmoji[cpu.type]} 자금 부족 (10배속).`, 'sys');
            }
            return;
          }
          const ratio = nextPrice / expected;
          const activeCpus = cpus.filter(c => !c.retired && !c.bankrupt);
          const ctx2 = { priceRatio: ratio, activeCpus, timerProgress: progress, snipeMode: this._isSnipeMode() };
          let prob = cpuActionProb(cpu, ctx2) * aggressionMul();
          if (isCheckRaise || isShkBurst || isWthLate) prob = Math.max(prob, 0.7);
          if (rng.next() < prob) {
            this._placeBid(cpu.id, nextPrice, isCheckRaise, isShkBurst, isWthLate, jump, cpu);
          } else {
            cpu.skips++;
            if (cpu.skips >= cpuRetireThreshold(cpu)) {
              cpu.retired = true;
              // v8 패치 1: '포기' → '10배속 보기'
              logBid(`CPU #${cpu.id} ${CONFIG.personaEmoji[cpu.type]} 10배속 보기.`, 'sys');
            }
          }
        },
        _placeBid(bidderId, price, isCheckRaise, isShkBurst, isWthLate, jump, cpuObj) {
          secondTopPrice = currentPrice;
          currentPrice = price;
          topBidder = bidderId;
          state.lastBidderId = bidderId;
          bidIndex++;
          bidCount++;
          consecutiveBids++;
          // v6: P1-7 입찰 시 cooldown 리셋 (다음 5~15초 새로)
          hostCooldownMs = rollCooldown();
          hostCooldownMax = hostCooldownMs;
          nextHostShoutMs = hostCooldownMs * 0.5;
          closingShouted = false;
          // v6: P1-8 입찰 발생 시 빨리감기 자동 해제
          if (state.fastForward) {
            state.fastForward = false;
            logBid('입찰 발생 — 1배속 복귀.', 'sys');
          }
          if (jump != null && jump > roundMaxJump) roundMaxJump = jump;
          resyncUserTarget(currentPrice);
          // 인격 연관 멘트 트리거 (50% 확률)
          if (bidderId !== 'user' && cpuObj) {
            const c = cpuObj;
            c.hasBid = true;
            c.lastBid = price;
            c.lastActionAt = nowMs();
            const persona = CONFIG.personaEmoji[c.type];
            let tag = '';
            if (isCheckRaise) tag = ' ⚡체크레이즈';
            else if (isShkBurst) tag = ' 🃏일격';
            else if (isWthLate) tag = ' 🦅막판';
            if (jump != null && jump >= 3) tag += ` (${jump}단계 점프)`;
            logBid(`CPU #${bidderId} ${persona} → ${formatMoney(price)}${tag}`, 'cpu');
            // 인격 멘트 (큰 점프 또는 특수 상황만)
            const isSnipe = this._isSnipeMode();
            if (jump >= 3 || isCheckRaise || isShkBurst || isWthLate || isSnipe) {
              const key = personaHostKey(c.type, isCheckRaise, isShkBurst, isSnipe, isWthLate);
              if (key && rng.next() < 0.7) {
                const line = pickHostLine(key, fmtCtx(c));
                if (line) logBid(line, 'host');
              }
            }
            triggerBLFCounter('cpu');
            if (jump != null) onLargeJump(rng, jump);
          } else {
            const stepsTag = (jump != null && jump > 1) ? ` (${jump}단계)` : '';
            logBid(`나 → ${formatMoney(price)}${stepsTag}`, 'user');
            triggerBLFCounter('user');
          }
          // 랠리 트리거 (3 연속 입찰)
          if (consecutiveBids >= 3) {
            const line = pickHostLine('rally', fmtCtx(cpuObj));
            if (line) logBid(line, 'host');
            consecutiveBids = 0;  // 다시 0부터
          }
        },
        onUserBid(payload) {
          if (over) return;
          if (payload && payload.giveUp) {
            userGaveUp = true;
            state.fastForward = true;
            // v8 패치 1: '입찰 포기' → '10배속 보기'
            logBid('10배속 보기 중 (⏩ ×10).', 'user');
            return;
          }
          if (!canBidByActor('user')) return;
          const steps = Math.max(1, state.userTargetSteps || 1);
          let nextPrice = currentPrice;
          for (let i = 0; i < steps; i++) nextPrice += minTick(nextPrice);
          const elapsedFromStart = nowMs() - startedAt;
          if (userBidsCount === 0 && elapsedFromStart <= CONFIG.userFirstBidWindowMs) {
            onUserFirstBidEarly(rng);
          }
          userBidsCount++;
          this._placeBid('user', nextPrice, false, false, false, steps, null);
          state.userTargetSteps = 1;
          onUserBidReaction(rng, elapsedFromStart);
        },
        isOver() { return over; },
        end() {
          let finalPrice;
          if (!topBidder) finalPrice = 0;
          else if (secondPrice) finalPrice = (bidCount >= 2) ? secondTopPrice : currentPrice;
          else finalPrice = currentPrice;
          state.lastMaxJump = roundMaxJump;
          return { winner: topBidder, finalPrice, purchased: topBidder != null };
        },
        getView() {
          const steps = Math.max(1, state.userTargetSteps || 1);
          let myTarget = currentPrice;
          for (let i = 0; i < steps; i++) myTarget += minTick(myTarget);
          return {
            currentPrice,
            topBidder: topBidder === 'user' ? '나' : (topBidder ? `CPU #${topBidder}` : '—'),
            // v6: P1-7 타이머 텍스트 숨김 (사회자에게 집중)
            timerText: '',
            candleOn: false,
            nextBidPrice: myTarget,
            userTargetSteps: steps,
            topBidderId: topBidder,
            allowGiveUp: !userGaveUp && !over,
            userGaveUp,
            tickInfo: `호가 단위: ${formatMoney(minTick(currentPrice))} · ${steps}단계 = ${formatMoney(myTarget - currentPrice)}`,
          };
        },
      };
      return api;
    };
  }


  // ---------- 자유경매 촛불 (v6: P1-6 멘트 + P1-12 그림 설명 + P1-11 막판) ----------
  function makeFreeAuctionCandle(opts) {
    const secondPrice = !!(opts && opts.secondPrice);
    return function (ctx) {
      const { expected, cpus, rng, painting, startPriceOverride } = ctx;
      const startRatio = sampleStartRatio(rng, isExtremeRound(state.round));
      let currentPrice = roundToTick(expected * startRatio);
      if (currentPrice < 1) currentPrice = 1;
      // v8 패치 6 추가: 자체 출품 시작가가 있으면 그 가격으로 시작
      if (startPriceOverride != null) { currentPrice = startPriceOverride; }

      let topBidder = null;
      let secondTopPrice = currentPrice;
      const candleTotalMs = CONFIG.candleMinMs + rng.next() * (CONFIG.candleMaxMs - CONFIG.candleMinMs);
      let elapsedMs = 0;
      let over = false;
      let bidIndex = 0;
      let bidCount = 0;
      let cpuNextDelayMs = -1;
      let cpuNextActor = null;
      let startedAt = 0;
      let userBidsCount = 0;
      let userGaveUp = false;
      const checkRaiseTriggered = {};
      let roundMaxJump = 0;
      let consecutiveBids = 0;

      let trafficState = 'green';
      let yellowMsLeft = 0;
      let yellowKind = null;
      const fakeYellowCount = CONFIG.candleFakeYellowCount[0]
        + Math.floor(rng.next() * (CONFIG.candleFakeYellowCount[1] - CONFIG.candleFakeYellowCount[0] + 1));
      const fakeYellowTimes = [];
      {
        const lo = CONFIG.candleGreenPhaseMs;
        const hi = Math.max(lo + 1000, candleTotalMs - CONFIG.candleEndWarnMs);
        for (let i = 0; i < fakeYellowCount; i++) {
          fakeYellowTimes.push(lo + rng.next() * (hi - lo));
        }
        fakeYellowTimes.sort((a, b) => a - b);
      }
      let fakeYellowIdx = 0;
      let finalYellowTriggered = false;
      let nextHostShoutMs = 3500;
      let nextFlavorMs = 8000 + rng.next() * 6000;

      function fmtCtx(actorCpu) {
        const lastId = state.lastBidderId;
        let lastBidderLabel = '—';
        if (lastId === 'user') lastBidderLabel = '나';
        else if (typeof lastId === 'number') lastBidderLabel = `#${lastId}`;
        let actorLabel = '';
        if (actorCpu) actorLabel = `#${actorCpu.id}`;
        return {
          currentPrice,
          nextPrice: currentPrice + minTick(currentPrice),
          fmt: formatMoney,
          lastBidderLabel,
          actorLabel,
        };
      }

      const api = {
        name: secondPrice ? '자유경매 촛불 (2등가격)' : '자유경매 촛불 (1등가격)',
        ruleLine: secondPrice
          ? '신호등 보고 입찰. 빨간불 = 촛불 꺼짐 (종료). 2등 가격에 1등 낙찰. 휠/방향키로 호가 단계 조절.'
          : '신호등 보고 입찰. 빨간불 = 촛불 꺼짐 (종료). 1등 가격에 1등 낙찰. 휠/방향키로 호가 단계 조절.',
        inputMode: 'next',
        key: secondPrice ? 'candle_2nd' : 'candle_1st',

        start() {
          startedAt = nowMs();
          state.userTargetSteps = 1;
          state.lastBidderId = null;
          const line = pickHostLine('free_start', fmtCtx(null));
          logBid(line || `📢 촛불 점등! 시작가 ${formatMoney(currentPrice)}.`, 'host');
          this._scheduleNextCpu();
        },
        _scheduleNextCpu() {
          const N = bidIndex + 1;
          let lo, hi;
          if (N <= 10) { lo = (N - 1) * 1000; hi = N * 1000; }
          else { lo = 9900; hi = 10000; }
          const aggScale = 1.5 - (state.sliders.s1_aggression / 100) * 1.2;
          lo *= aggScale; hi *= aggScale;
          cpuNextDelayMs = lo + (hi - lo) * rng.next();
          const nextStepPrice = currentPrice + minTick(currentPrice);
          const active = cpus.filter(c => !c.retired && !c.bankrupt && cpuCanAfford(c, nextStepPrice));
          if (active.length === 0) { cpuNextActor = null; return; }
          cpuNextActor = rng.pick(active);
        },
        _updateTraffic(dt) {
          const remainMs = candleTotalMs - elapsedMs;
          if (!finalYellowTriggered && remainMs <= CONFIG.candleEndWarnMs) {
            finalYellowTriggered = true;
            trafficState = 'yellow';
            yellowKind = 'final';
            yellowMsLeft = Math.max(0, remainMs);
            logBid('📢 촛불이 흔들립니다! 종료 임박!', 'host');
            return;
          }
          if (trafficState === 'green'
              && elapsedMs >= CONFIG.candleGreenPhaseMs
              && fakeYellowIdx < fakeYellowTimes.length
              && elapsedMs >= fakeYellowTimes[fakeYellowIdx]) {
            fakeYellowIdx++;
            trafficState = 'yellow';
            yellowKind = 'fake';
            yellowMsLeft = CONFIG.candleFakeYellowMin
              + rng.next() * (CONFIG.candleFakeYellowMax - CONFIG.candleFakeYellowMin);
            logBid('📢 촛불이 흔들립니다 (노란불).', 'host');
            return;
          }
          if (trafficState === 'yellow') {
            yellowMsLeft -= dt;
            if (yellowMsLeft <= 0) {
              if (yellowKind === 'fake') {
                if (rng.next() < CONFIG.candleFakeYellowChance) {
                  trafficState = 'green';
                  yellowKind = null;
                  logBid('📢 다시 안정. 촛불 초록.', 'host');
                } else {
                  trafficState = 'red';
                  yellowKind = null;
                  over = true;
                  logBid('📢 촛불이 꺼졌습니다! 경매 종료.', 'host cd');
                }
              } else {
                trafficState = 'red';
                yellowKind = null;
                over = true;
                logBid('📢 촛불이 꺼졌습니다! 경매 종료.', 'host cd');
              }
            }
          }
        },
        _checkRaiseScan() {
          const elapsed = nowMs() - startedAt;
          if (elapsed < CONFIG.personalities.BLF.checkRaiseAfterMs) return null;
          for (const c of cpus) {
            if (c.type === 'BLF' && !c.retired && !c.bankrupt && !c.hasBid && !checkRaiseTriggered[c.id]) {
              checkRaiseTriggered[c.id] = true;
              if (rng.next() < CONFIG.personalities.BLF.checkRaiseProb) return c;
            }
          }
          return null;
        },
        _wthScan() {
          const progress = elapsedMs / candleTotalMs;
          if (progress < CONFIG.personalities.WTH.lateWindow) return null;
          for (const c of cpus) {
            if (c.type !== 'WTH' || c.retired || c.bankrupt || c.wthActed) continue;
            const r = rng.next();
            if (r < CONFIG.personalities.WTH.lateGiveUpProb) {
              c.wthActed = true; c.retired = true;
              const fl = pickHostLine('persona_wth_giveup', fmtCtx(c));
              if (fl) logBid(fl, 'host');
              continue;
            }
            if (r < CONFIG.personalities.WTH.lateGiveUpProb + CONFIG.personalities.WTH.latePunchProb) {
              c.wthActed = true;
              return c;
            }
          }
          return null;
        },
        step(dtMs) {
          if (over) return;
          const dt = scaledDt(dtMs);
          elapsedMs += dt;
          this._updateTraffic(dt);
          if (over) return;
          if (elapsedMs >= candleTotalMs && trafficState !== 'red') {
            trafficState = 'red';
            over = true;
            logBid('📢 촛불이 꺼졌습니다! 경매 종료.', 'host cd');
            return;
          }
          nextHostShoutMs -= dt;
          nextFlavorMs -= dt;
          if (nextFlavorMs <= 0) {
            const fl = pickFlavorLine(painting);
            if (fl) logBid(fl, 'host');
            nextFlavorMs = 10000 + rng.next() * 8000;
          } else if (nextHostShoutMs <= 0 && bidCount > 0) {
            const lastId = state.lastBidderId;
            let line = null;
            if (lastId === 'user') {
              line = pickHostLine('counter_user', fmtCtx(null));
            } else if (typeof lastId === 'number') {
              line = pickHostLine(rng.next() < 0.4 ? 'counter_cpu' : 'cooldown_cpu', fmtCtx(null));
            } else {
              line = pickHostLine('cooldown_user', fmtCtx(null));
            }
            if (line) logBid(line, 'host');
            nextHostShoutMs = 3500 + rng.next() * 2000;
          } else if (nextHostShoutMs <= 0) {
            nextHostShoutMs = 3500;
          }
          const checkRaiseCpu = this._checkRaiseScan();
          if (checkRaiseCpu) {
            this._tryCpu(checkRaiseCpu, true, false, false);
            if (over) return;
          }
          const wthCpu = this._wthScan();
          if (wthCpu) {
            this._tryCpu(wthCpu, false, false, true);
            if (over) return;
          }
          if (cpuNextActor != null) {
            cpuNextDelayMs -= dt;
            if (cpuNextDelayMs <= 0) {
              this._tryCpu(cpuNextActor, false, false, false);
              if (over) return;
              this._scheduleNextCpu();
            }
          }
        },
        _tryCpu(cpu, isCheckRaise, isShkBurst, isWthLate) {
          if (cpu.retired || cpu.bankrupt) return;
          if (!canBidByActor(cpu.id)) return;
          const progress = elapsedMs / candleTotalMs;
          const ctxJump = { timerProgress: progress };
          const jump = cpuJumpSteps(cpu, rng, isCheckRaise, isShkBurst, currentPrice, expected, ctxJump);
          let nextPrice = currentPrice;
          for (let j = 0; j < jump; j++) nextPrice += minTick(nextPrice);
          if (nextPrice <= currentPrice) {
            cpu.skips++;
            if (cpu.skips >= cpuRetireThreshold(cpu)) cpu.retired = true;
            return;
          }
          if (!cpuCanAfford(cpu, nextPrice)) {
            cpu.skips++;
            if (cpu.skips >= cpuRetireThreshold(cpu)) {
              cpu.retired = true;
              // v8 패치 1: '자금 부족 포기' → '자금 부족 (10배속)'
              logBid(`CPU #${cpu.id} ${CONFIG.personaEmoji[cpu.type]} 자금 부족 (10배속).`, 'sys');
            }
            return;
          }
          const ratio = nextPrice / expected;
          const activeCpus = cpus.filter(c => !c.retired && !c.bankrupt);
          const ctx2 = { priceRatio: ratio, activeCpus, timerProgress: progress };
          let prob = cpuActionProb(cpu, ctx2) * aggressionMul();
          if (isCheckRaise || isWthLate) prob = Math.max(prob, 0.7);
          if (rng.next() < prob) {
            this._placeBid(cpu.id, nextPrice, isCheckRaise, isWthLate, jump, cpu);
          } else {
            cpu.skips++;
            if (cpu.skips >= cpuRetireThreshold(cpu)) {
              cpu.retired = true;
              // v8 패치 1: '포기' → '10배속 보기'
              logBid(`CPU #${cpu.id} ${CONFIG.personaEmoji[cpu.type]} 10배속 보기.`, 'sys');
            }
          }
        },
        _placeBid(bidderId, price, isCheckRaise, isWthLate, jump, cpuObj) {
          secondTopPrice = currentPrice;
          currentPrice = price;
          topBidder = bidderId;
          state.lastBidderId = bidderId;
          bidIndex++;
          bidCount++;
          consecutiveBids++;
          if (state.fastForward) {
            state.fastForward = false;
            logBid('입찰 발생 — 1배속 복귀.', 'sys');
          }
          if (jump != null && jump > roundMaxJump) roundMaxJump = jump;
          resyncUserTarget(currentPrice);
          if (bidderId !== 'user' && cpuObj) {
            const c = cpuObj;
            c.hasBid = true;
            c.lastBid = price;
            c.lastActionAt = nowMs();
            const persona = CONFIG.personaEmoji[c.type];
            let tag = isCheckRaise ? ' ⚡체크레이즈' : (isWthLate ? ' 🦅막판' : '');
            if (jump != null && jump >= 3) tag += ` (${jump}단계 점프)`;
            logBid(`CPU #${bidderId} ${persona} → ${formatMoney(price)}${tag}`, 'cpu');
            if (jump >= 3 || isCheckRaise || isWthLate) {
              const key = personaHostKey(c.type, isCheckRaise, false, false, isWthLate);
              if (key && rng.next() < 0.6) {
                const line = pickHostLine(key, fmtCtx(c));
                if (line) logBid(line, 'host');
              }
            }
            triggerBLFCounter('cpu');
            if (jump != null) onLargeJump(rng, jump);
          } else {
            const stepsTag = (jump != null && jump > 1) ? ` (${jump}단계)` : '';
            logBid(`나 → ${formatMoney(price)}${stepsTag}`, 'user');
            triggerBLFCounter('user');
          }
          if (consecutiveBids >= 3) {
            const line = pickHostLine('rally', fmtCtx(cpuObj));
            if (line) logBid(line, 'host');
            consecutiveBids = 0;
          }
        },
        onUserBid(payload) {
          if (over) return;
          if (payload && payload.giveUp) {
            userGaveUp = true;
            state.fastForward = true;
            // v8 패치 1: '입찰 포기' → '10배속 보기'
            logBid('10배속 보기 중 (⏩ ×10).', 'user');
            return;
          }
          if (!canBidByActor('user')) return;
          const steps = Math.max(1, state.userTargetSteps || 1);
          let nextPrice = currentPrice;
          for (let i = 0; i < steps; i++) nextPrice += minTick(nextPrice);
          const elapsedFromStart = nowMs() - startedAt;
          if (userBidsCount === 0 && elapsedFromStart <= CONFIG.userFirstBidWindowMs) {
            onUserFirstBidEarly(rng);
          }
          userBidsCount++;
          this._placeBid('user', nextPrice, false, false, steps, null);
          state.userTargetSteps = 1;
          onUserBidReaction(rng, elapsedFromStart);
        },
        isOver() { return over; },
        end() {
          let finalPrice;
          if (!topBidder) finalPrice = 0;
          else if (secondPrice) finalPrice = (bidCount >= 2) ? secondTopPrice : currentPrice;
          else finalPrice = currentPrice;
          state.lastMaxJump = roundMaxJump;
          return { winner: topBidder, finalPrice, purchased: topBidder != null };
        },
        getView() {
          const steps = Math.max(1, state.userTargetSteps || 1);
          let myTarget = currentPrice;
          for (let i = 0; i < steps; i++) myTarget += minTick(myTarget);
          return {
            currentPrice,
            topBidder: topBidder === 'user' ? '나' : (topBidder ? `CPU #${topBidder}` : '—'),
            timerText: '',
            candleOn: trafficState !== 'red',
            trafficState,
            nextBidPrice: myTarget,
            userTargetSteps: steps,
            topBidderId: topBidder,
            allowGiveUp: !userGaveUp && !over,
            userGaveUp,
            tickInfo: `호가 단위: ${formatMoney(minTick(currentPrice))} · ${steps}단계 = ${formatMoney(myTarget - currentPrice)}`,
          };
        },
      };
      return api;
    };
  }


  // ---------- 비밀경매 (v6: P1-10 호가 갭 다양화 + P1-12 그림 설명) ----------
  function makeSealedBid(ctx) {
    const { expected, cpus, rng, painting, startPriceOverride } = ctx;
    let bids = [];
    let over = false;
    let result = null;
    let phase = 'initial';
    let timerMs = CONFIG.sealedTimerMs;
    let userSubmitted = false;
    let userInTie = false;
    let tieWinners = [];
    let userMustSubmit = true;
    let userGaveUp = false;
    let _userSubmittedFlag = false;
    const submitPlans = [];
    const cpuPriceMap = {};
    let elapsedMs = 0;
    const catName = painting && painting.category ? painting.category : 'C';
    const shouts = (CONFIG.fixedCloseupShouts[catName] || CONFIG.fixedCloseupShouts.C).slice();
    let shoutTimerMs = 800;
    let nextFlavorMs = 6000;

    // v6: P1-10 매 비밀경매마다 호가 갭 1개 선택
    const gapPick = rng.weighted(CONFIG.sealedGapPool);
    const roundGap = gapPick.gap;
    // 입찰가는 roundGap 배수로 라운드 (작은 갭이면 minTick 사용, 큰 갭이면 갭 단위)
    function snapToGap(p) {
      const g = Math.max(roundGap, minTick(p));
      return Math.round(p / g) * g;
    }

    const api = {
      name: '비밀경매',
      ruleLine: `모두 비밀 입찰가 1회 제출. 30초 안에 안 내면 0$로 자동 제출. 이번 라운드 호가 갭 ${formatMoney(roundGap)}. 최고가 1등 낙찰.`,
      inputMode: 'sealed',
      key: 'sealed',
      sealedSecret: true,
      sealedCategory: catName,
      sealedRoundGap: roundGap,
      // v8 패치 6 추가: 자체 출품 시작가가 있으면 입력란 기본값으로 노출
      sealedStartHint: startPriceOverride != null ? startPriceOverride : null,
      get _userSubmitted() { return _userSubmittedFlag; },

      start() {
        logBid(`📢 비밀 입찰 시작. 30초 안에 입찰가 제출. 이번 라운드 호가 갭: ${formatMoney(roundGap)}.`, 'host');
        for (const c of cpus) {
          if (c.retired || c.bankrupt) continue;
          const ceiling = c.ceiling;
          let priceRatio;
          if (c.type === 'CON') priceRatio = rng.clipped(0.7, 0.20, 0.527, ceiling);
          else if (c.type === 'APP') priceRatio = rng.clipped(1.0, 0.15, 0.527, ceiling);
          else if (c.type === 'MAN') priceRatio = rng.clipped(1.5, 0.40, 0.7, Math.min(ceiling, 2.5));
          else if (c.type === 'BLF') priceRatio = rng.clipped(1.0, 0.50, 0.527, Math.min(ceiling, 2.5));
          else if (c.type === 'SHK') {
            const burst = rng.next() < 0.3;
            priceRatio = burst
              ? rng.clipped(1.5, 0.30, 0.9, Math.min(ceiling, 2.5))
              : rng.clipped(0.85, 0.20, 0.527, ceiling);
          } else if (c.type === 'TLT') {
            priceRatio = c.tilted
              ? rng.clipped(1.5, 0.40, 0.9, Math.min(ceiling, 2.5))
              : rng.clipped(1.0, 0.20, 0.6, ceiling);
          } else if (c.type === 'MIR') priceRatio = rng.clipped(1.0, 0.25, 0.6, ceiling);
          else if (c.type === 'SNI') priceRatio = rng.clipped(0.9, 0.20, 0.6, ceiling);
          else if (c.type === 'WTH') priceRatio = rng.clipped(1.1, 0.30, 0.6, ceiling);
          else priceRatio = rng.clipped(1.0, 0.30, 0.527, ceiling);
          let price = snapToGap(expected * priceRatio);
          if (price < 1) price = 1;
          if (price > c.money) price = snapToGap(c.money);
          if (price < 1) continue;
          cpuPriceMap[c.id] = price;
          c.lastBid = price;
          const t = rng.rangeFloat(500, 9500);
          submitPlans.push({ cpu: c, price, t });
        }
        submitPlans.sort((a, b) => a.t - b.t);
      },
      step(dtMs) {
        if (over) return;
        if (!userMustSubmit) return;
        const dt = scaledDt(dtMs);
        elapsedMs += dt;
        while (submitPlans.length > 0 && submitPlans[0].t <= elapsedMs) {
          const plan = submitPlans.shift();
          if (!plan.cpu.retired && !plan.cpu.bankrupt) {
            plan.cpu.hasBid = true;
            bids.push({ bidder: plan.cpu.id, price: plan.price });
            logBid(`📢 CPU #${plan.cpu.id} 봉투 제출!`, 'host');
          }
        }
        shoutTimerMs -= dt;
        nextFlavorMs -= dt;
        if (nextFlavorMs <= 0) {
          const fl = pickFlavorLine(painting);
          if (fl) logBid(fl, 'host');
          nextFlavorMs = 7000 + rng.next() * 4000;
        } else if (shoutTimerMs <= 0 && shouts.length > 0) {
          logBid(shouts.shift(), 'host');
          shoutTimerMs = catName === 'E' ? 1700 : (catName === 'D' ? 1500 : 1300);
        }
        timerMs -= dt;
        if (timerMs <= 0) {
          timerMs = 0;
          while (submitPlans.length > 0) {
            const plan = submitPlans.shift();
            if (!plan.cpu.retired && !plan.cpu.bankrupt) {
              plan.cpu.hasBid = true;
              bids.push({ bidder: plan.cpu.id, price: plan.price });
            }
          }
          if (!userSubmitted) {
            if (phase === 'initial') {
              logBid('시간 만료 — 자동 0$ 제출.', 'sys');
              bids.push({ bidder: 'user', price: 0 });
            } else if (phase === 'tie-rebid') {
              const myTie = tieWinners.find(w => w.bidder === 'user');
              const fallback = myTie ? myTie.price + roundGap : 0;
              logBid(`재경매 시간 만료 — 자동 ${formatMoney(fallback)} 제출.`, 'sys');
              bids.push({ bidder: 'user', price: fallback });
            }
            userSubmitted = true;
            _userSubmittedFlag = true;
            const sealedInput = $('bid-sealed-input');
            const sealedSubmit = $('bid-sealed-submit');
            if (sealedInput) sealedInput.disabled = true;
            if (sealedSubmit) sealedSubmit.disabled = true;
            this._resolve();
          }
        }
      },
      onUserBid(payload) {
        if (over) return;
        if (payload && payload.giveUp) {
          userGaveUp = true;
          state.fastForward = true;
          // v8 패치 1: '입찰 포기' → '10배속 보기' (비밀경매: 자동 0$ 제출 동작 보존)
          logBid('10배속 보기 중 (⏩ ×10). 자동 0$ 제출.', 'user');
          bids.push({ bidder: 'user', price: 0 });
          userSubmitted = true;
          _userSubmittedFlag = true;
          return;
        }
        if (!userMustSubmit) return;
        if (userSubmitted) return;
        const userPrice = snapToGap(Math.max(0, Number(payload.price) || 0));
        bids.push({ bidder: 'user', price: userPrice });
        userSubmitted = true;
        _userSubmittedFlag = true;
        state.lastBidderId = 'user';
        logBid(`📢 나 봉투 제출!`, 'host');
        if (userPrice >= expected * 1.2) onUserSealedBigBid();
        while (submitPlans.length > 0) {
          const plan = submitPlans.shift();
          if (!plan.cpu.retired && !plan.cpu.bankrupt) {
            plan.cpu.hasBid = true;
            bids.push({ bidder: plan.cpu.id, price: plan.price });
          }
        }
        this._resolve();
      },
      _resolve() {
        const maxPrice = bids.length > 0 ? Math.max(...bids.map(b => b.price)) : 0;
        const winners = bids.filter(b => b.price === maxPrice);
        if (winners.length === 1) {
          over = true;
          phase = 'done';
          result = { winner: winners[0].bidder, finalPrice: maxPrice, purchased: maxPrice > 0, allBids: bids };
          if (maxPrice > 0) {
            const label = winners[0].bidder === 'user' ? '나' : `CPU #${winners[0].bidder}`;
            logBid(`${label} 가 ${formatMoney(maxPrice)} 에 낙찰.`, winners[0].bidder === 'user' ? 'user' : 'cpu');
          }
          return;
        }
        if (phase === 'initial') {
          phase = 'tie-rebid';
          tieWinners = winners.slice();
          userInTie = tieWinners.some(w => w.bidder === 'user');
          logBid(`동점 발생 (${winners.length}명). 재경매 1회 시작.`, 'sys');
          bids = [];
          for (const w of tieWinners) {
            if (w.bidder === 'user') continue;
            const inc = roundGap * (1 + Math.floor(rng.next() * 3));
            const newPrice = w.price + inc;
            bids.push({ bidder: w.bidder, price: newPrice });
            logBid(`CPU #${w.bidder} 재입찰 → 비공개`, 'cpu');
          }
          if (userInTie) {
            userSubmitted = false;
            _userSubmittedFlag = false;
            timerMs = CONFIG.sealedTimerMs;
            userMustSubmit = true;
            const sealedInput = $('bid-sealed-input');
            const sealedSubmit = $('bid-sealed-submit');
            if (sealedInput) { sealedInput.disabled = false; sealedInput.value = ''; }
            if (sealedSubmit) { sealedSubmit.disabled = false; }
          } else {
            userMustSubmit = false;
            this._finalizeTieRebid();
          }
          return;
        }
        if (phase === 'tie-rebid') {
          this._finalizeTieRebid();
          return;
        }
      },
      _finalizeTieRebid() {
        const newMax = bids.length > 0 ? Math.max(...bids.map(b => b.price)) : 0;
        const newWinners = bids.filter(b => b.price === newMax);
        if (newWinners.length === 1) {
          over = true; phase = 'done';
          result = { winner: newWinners[0].bidder, finalPrice: newMax, purchased: newMax > 0, allBids: bids };
          const label = newWinners[0].bidder === 'user' ? '나' : `CPU #${newWinners[0].bidder}`;
          logBid(`${label} 가 ${formatMoney(newMax)} 에 낙찰. (재경매)`, newWinners[0].bidder === 'user' ? 'user' : 'cpu');
        } else {
          over = true; phase = 'done';
          const picked = rng.pick(newWinners);
          result = { winner: picked.bidder, finalPrice: picked.price, purchased: picked.price > 0, randomTie: true, allBids: bids };
          const label = picked.bidder === 'user' ? '나' : `CPU #${picked.bidder}`;
          logBid(`동점으로 인해 랜덤 낙찰됨. ${label} 가 ${formatMoney(picked.price)} 에 낙찰.`, picked.bidder === 'user' ? 'user' : 'cpu');
        }
      },
      isOver() { return over; },
      end() { return result || { winner: null, finalPrice: 0, purchased: false, allBids: bids }; },
      getView() {
        let timerText = '제출 대기';
        if (userMustSubmit && !over) timerText = `${(timerMs / 1000).toFixed(1)}s`;
        else if (phase === 'tie-rebid' && !userInTie) timerText = '재경매 중';
        return {
          currentPrice: 0,
          topBidder: '—',
          timerText,
          candleOn: false,
          sealedRemainMs: userMustSubmit && !over ? timerMs : null,
          sealedPhase: phase,
          sealedSecret: true,
          sealedRoundGap: roundGap,
          allowGiveUp: !userGaveUp && !over && !userSubmitted,
          userGaveUp,
          tickInfo: `이번 라운드 호가 갭: ${formatMoney(roundGap)}`,
        };
      },
    };
    return api;
  }

  // ---------- 1회 제한 (v6: P1-9 휠/키보드 + 패스 시 ⏩×10 + P1-12 그림 설명) ----------
  function makeLimitedOnce(opts) {
    const secondPrice = !!(opts && opts.secondPrice);
    return function (ctx) {
      const { expected, cpus, rng, painting, startPriceOverride } = ctx;
      const totalMs = CONFIG.limitedTimerMs;
      const cpuPlans = [];
      for (const c of cpus) {
        if (c.retired || c.bankrupt) continue;
        const t = rng.next() * totalMs;
        let priceRatio, bidIntent;
        if (c.type === 'CON') { priceRatio = rng.clipped(0.85, 0.15, 0.6, c.ceiling); bidIntent = 0.50; }
        else if (c.type === 'APP') { priceRatio = rng.clipped(1.0, 0.20, 0.7, c.ceiling); bidIntent = 0.80; }
        else if (c.type === 'MAN') { priceRatio = rng.clipped(1.4, 0.40, 0.9, Math.min(c.ceiling, 2.5)); bidIntent = 0.90; }
        else if (c.type === 'BLF') { priceRatio = rng.clipped(1.0, 0.45, 0.7, Math.min(c.ceiling, 2.5)); bidIntent = 0.70; }
        else if (c.type === 'SHK') { priceRatio = rng.clipped(1.05, 0.30, 0.8, Math.min(c.ceiling, 2.0)); bidIntent = 0.55; }
        else if (c.type === 'TLT') {
          priceRatio = c.tilted
            ? rng.clipped(1.4, 0.40, 0.9, Math.min(c.ceiling, 2.5))
            : rng.clipped(1.0, 0.20, 0.7, c.ceiling);
          bidIntent = c.tilted ? 0.85 : 0.55;
        }
        else if (c.type === 'MIR') { priceRatio = rng.clipped(1.0, 0.25, 0.7, c.ceiling); bidIntent = 0.50; }
        else if (c.type === 'SNI') { priceRatio = rng.clipped(1.1, 0.20, 0.8, Math.min(c.ceiling, 1.3)); bidIntent = 0.65; }
        else if (c.type === 'WTH') { priceRatio = rng.clipped(1.2, 0.40, 0.8, Math.min(c.ceiling, 1.5)); bidIntent = 0.40; }
        else { priceRatio = rng.clipped(1.0, 0.30, 0.6, c.ceiling); bidIntent = 0.60; }
        let price = roundToTick(expected * priceRatio);
        if (price < 1) price = 1;
        if (price > c.money) price = roundToTick(c.money);
        if (price < 1) continue;
        let actualT = t;
        if (c.type === 'SNI') actualT = totalMs * (0.90 + rng.next() * 0.09);
        if (c.type === 'WTH') actualT = totalMs * (0.70 + rng.next() * 0.25);  // v6: WTH 막판 액션
        const willBid = rng.next() < (bidIntent * aggressionMul());
        cpuPlans.push({ cpu: c, t: actualT, price: willBid ? price : null, baseRatio: priceRatio });
      }
      cpuPlans.sort((a, b) => a.t - b.t);

      let elapsedMs = 0;
      let over = false;
      let result = null;
      const bids = [];
      let userActed = false;
      let userBid = null;
      let userPassed = false;
      let userGaveUp = false;
      let startedAt = 0;
      let currentTop = 0;
      let nextFlavorMs = 6000;
      let nextHostShoutMs = 4000;

      const api = {
        name: secondPrice ? '1회 제한 경매 (2등가격)' : '1회 제한 경매 (1등가격)',
        ruleLine: secondPrice
          ? '선착순 30초. 한 명당 1회 입찰 또는 패스. 「패스」 누르면 ⏩×10 가속. 2등 가격에 1등 낙찰. 휠/↑↓로 호가 조절.'
          : '선착순 30초. 한 명당 1회 입찰 또는 패스. 「패스」 누르면 ⏩×10 가속. 1등 가격에 1등 낙찰. 휠/↑↓로 호가 조절.',
        inputMode: 'limited',
        key: secondPrice ? 'limited_2nd' : 'limited_1st',
        // v8 패치 6 추가: 자체 출품 시작가가 있으면 입력란 기본값으로 노출
        limitedStartHint: startPriceOverride != null ? startPriceOverride : null,

        start() {
          startedAt = nowMs();
          state.userTargetSteps = 1;
          logBid('📢 1회 제한 경매 시작! 따라오실 분?', 'host');
        },
        _advanceTo(targetMs) {
          while (cpuPlans.length > 0 && cpuPlans[0].t <= targetMs && !over) {
            const plan = cpuPlans.shift();
            this._processCpuPlan(plan);
          }
          elapsedMs = Math.max(elapsedMs, targetMs);
        },
        _processCpuPlan(plan) {
          const c = plan.cpu;
          if (c.bankrupt) {
            bids.push({ bidder: c.id, price: null });
            return;
          }
          if (!canBidByActor(c.id)) {
            bids.push({ bidder: c.id, price: null });
            c.skips++;
            logBid(`CPU #${c.id} ${CONFIG.personaEmoji[c.type]} 패스`, 'sys');
            if (c.skips >= cpuRetireThreshold(c)) c.retired = true;
            return;
          }
          if (plan.price != null) {
            if (plan.price <= currentTop) {
              bids.push({ bidder: c.id, price: null });
              c.skips++;
              logBid(`CPU #${c.id} ${CONFIG.personaEmoji[c.type]} 패스 (현재가 이하)`, 'sys');
              if (c.skips >= cpuRetireThreshold(c)) c.retired = true;
              return;
            }
            if (!cpuCanAfford(c, plan.price)) {
              bids.push({ bidder: c.id, price: null });
              c.skips++;
              logBid(`CPU #${c.id} ${CONFIG.personaEmoji[c.type]} 자금 부족 패스`, 'sys');
              if (c.skips >= cpuRetireThreshold(c)) c.retired = true;
              return;
            }
            bids.push({ bidder: c.id, price: plan.price });
            c.hasBid = true;
            c.lastBid = plan.price;
            currentTop = plan.price;
            state.lastBidderId = c.id;
            const persona = CONFIG.personaEmoji[c.type];
            logBid(`CPU #${c.id} ${persona} → ${formatMoney(plan.price)}`, 'cpu');
            triggerBLFCounter('cpu');
          } else {
            bids.push({ bidder: c.id, price: null });
            c.skips++;
            logBid(`CPU #${c.id} ${CONFIG.personaEmoji[c.type]} 패스`, 'sys');
            if (c.skips >= cpuRetireThreshold(c)) c.retired = true;
          }
        },
        step(dtMs) {
          if (over) return;
          const dt = scaledDt(dtMs);
          this._advanceTo(elapsedMs + dt);
          nextFlavorMs -= dt;
          nextHostShoutMs -= dt;
          if (nextFlavorMs <= 0) {
            const fl = pickFlavorLine(painting);
            if (fl) logBid(fl, 'host');
            nextFlavorMs = 8000 + rng.next() * 5000;
          } else if (nextHostShoutMs <= 0) {
            if (currentTop > 0) {
              const line = pickHostLine('cooldown_cpu', { currentPrice: currentTop, nextPrice: currentTop + minTick(currentTop), fmt: formatMoney, lastBidderLabel: '', actorLabel: '' });
              if (line) logBid(line, 'host');
            } else {
              logBid(`📢 아직 입찰 없습니다. 따라오실 분?`, 'host');
            }
            nextHostShoutMs = 4500;
          }
          if (elapsedMs >= totalMs) this._resolve();
        },
        onUserBid(payload) {
          if (over) return;
          if (payload && payload.giveUp) {
            userGaveUp = true;
            state.fastForward = true;
            // v8 패치 1: '입찰 포기' → '10배속 보기'
            logBid('10배속 보기 중 (⏩ ×10).', 'user');
            return;
          }
          if (userActed) return;
          if (payload && payload.pass) {
            userActed = true;
            userPassed = true;
            bids.push({ bidder: 'user', price: null });
            // v6: P1-9 패스 → 즉시 종료가 아니라 ⏩×10으로 남은 30초 가속
            state.fastForward = true;
            logBid('나 패스. ⏩×10 가속 진행.', 'user');
            onUserPassReaction(rng);
            return;
          }
          // v6: P1-9 휠/키보드 입찰 — userTargetSteps 사용
          let nextPrice;
          if (payload && typeof payload.price === 'number') {
            nextPrice = roundToTick(Math.max(1, payload.price));
          } else {
            const baseline = Math.max(currentTop, 1);
            const steps = Math.max(1, state.userTargetSteps || 1);
            nextPrice = baseline;
            for (let i = 0; i < steps; i++) nextPrice += minTick(nextPrice);
            // 최소 currentTop + 1 minTick 보장
            if (nextPrice <= currentTop) nextPrice = currentTop + minTick(currentTop);
          }
          if (nextPrice <= currentTop) {
            alert(`현재 최고가(${formatMoney(currentTop)}) 보다 높은 금액을 입력하세요.`);
            return;
          }
          if (!canBidByActor('user')) return;
          userActed = true;
          userBid = nextPrice;
          currentTop = nextPrice;
          state.lastBidderId = 'user';
          bids.push({ bidder: 'user', price: nextPrice });
          state.userTargetSteps = 1;
          logBid(`나 → ${formatMoney(nextPrice)}`, 'user');
          const elapsedFromStart = nowMs() - startedAt;
          onUserBidReaction(rng, elapsedFromStart);
        },
        _resolve() {
          if (over) return;
          const valid = bids.filter(b => b.price != null);
          if (valid.length === 0) {
            over = true;
            result = { winner: null, finalPrice: 0, purchased: false, allBids: bids };
            logBid('전원 패스. 유찰.', 'sys');
            return;
          }
          valid.sort((a, b) => b.price - a.price);
          const topPrice = valid[0].price;
          const tops = valid.filter(b => b.price === topPrice);
          let winnerEntry;
          if (tops.length === 1) winnerEntry = tops[0];
          else {
            winnerEntry = rng.pick(tops);
            logBid('동점으로 인해 랜덤 낙찰됨.', 'sys');
          }
          let finalPrice;
          if (secondPrice) {
            if (tops.length > 1) finalPrice = topPrice;
            else {
              const seconds = valid.filter(b => b.price < topPrice);
              finalPrice = seconds.length > 0 ? seconds[0].price : topPrice;
            }
          } else finalPrice = topPrice;
          over = true;
          result = { winner: winnerEntry.bidder, finalPrice, purchased: true, allBids: bids };
          const label = winnerEntry.bidder === 'user' ? '나' : `CPU #${winnerEntry.bidder}`;
          logBid(`${label} 가 ${formatMoney(finalPrice)} 에 낙찰.`, winnerEntry.bidder === 'user' ? 'user' : 'cpu');
        },
        isOver() { return over; },
        end() { return result || { winner: null, finalPrice: 0, purchased: false, allBids: bids }; },
        getView() {
          const valids = bids.filter(b => b.price != null);
          let cur = 0, topL = '—', topId = null;
          if (valids.length > 0) {
            valids.sort((a, b) => b.price - a.price);
            cur = valids[0].price;
            topL = valids[0].bidder === 'user' ? '나' : `CPU #${valids[0].bidder}`;
            topId = valids[0].bidder;
          }
          const remainMs = Math.max(0, totalMs - elapsedMs);
          const steps = Math.max(1, state.userTargetSteps || 1);
          const baseline = Math.max(cur, 1);
          let myTarget = baseline;
          for (let i = 0; i < steps; i++) myTarget += minTick(myTarget);
          if (myTarget <= cur) myTarget = cur + minTick(cur || 1);
          return {
            currentPrice: cur,
            topBidder: topL,
            timerText: (remainMs / 1000).toFixed(1) + 's',
            candleOn: false,
            waitingForUser: !userActed && !over,
            userActed,
            turnLabel: userActed ? (userPassed ? '패스함 (⏩×10 진행 중)' : '입찰함') : '선착순 — 입찰 또는 패스',
            topBidderId: topId,
            allowGiveUp: !userGaveUp && !over && !userActed,
            userGaveUp,
            nextBidPrice: myTarget,
            userTargetSteps: steps,
            tickInfo: `호가 단위: ${formatMoney(minTick(cur || 1))} · ${steps}단계`,
          };
        },
      };
      return api;
    };
  }

  // ---------- 네덜란드식 (v6: P1-12 그림 설명) ----------
  function makeDutchAuction(ctx) {
    const { expected, cpus, rng, painting, startPriceOverride } = ctx;
    let currentPrice = roundToTick(expected * CONFIG.dutchStartRatio);
    // v8 패치 6 추가: 자체 출품 시작가가 있으면 그 가격으로 시작
    if (startPriceOverride != null) { currentPrice = startPriceOverride; }
    let over = false;
    let winner = null;
    let stepAcc = 0;
    let extraBonus = 0;
    let userGaveUp = false;
    const catName = painting && painting.category ? painting.category : 'C';
    const shouts = (CONFIG.fixedCloseupShouts[catName] || CONFIG.fixedCloseupShouts.C).slice();
    let shoutTimerMs = 700;
    let extraShouts = ['📢 아직 낙찰되지 않았습니다.', '📢 네덜란드식 경매입니다 — 먼저 누르는 사람이 임자!'];
    let nextFlavorMs = 6000;

    const api = {
      name: '네덜란드식 경매',
      ruleLine: '가격이 0.5초마다 한 단계씩 내려간다. 먼저 「산다」 누르면 즉시 그 가격에 낙찰.',
      inputMode: 'buy-dutch',
      key: 'dutch',

      start() { logBid(`📢 네덜란드식 경매 시작! 시작가 ${formatMoney(currentPrice)}.`, 'host'); },
      step(dtMs) {
        if (over) return;
        const dt = scaledDt(dtMs);
        shoutTimerMs -= dt;
        nextFlavorMs -= dt;
        if (nextFlavorMs <= 0) {
          const fl = pickFlavorLine(painting);
          if (fl) logBid(fl, 'host');
          nextFlavorMs = 8000 + rng.next() * 4000;
        } else if (shoutTimerMs <= 0) {
          let msg = null;
          if (shouts.length > 0) msg = shouts.shift();
          else if (extraShouts.length > 0) msg = extraShouts.shift();
          if (msg) logBid(msg, 'host');
          shoutTimerMs = catName === 'E' ? 2000 : (catName === 'D' ? 1800 : 1500);
        }
        this._tryCpuBuyFrame(dt);
        if (over) return;
        stepAcc += dt;
        while (stepAcc >= CONFIG.dutchStepMs && !over) {
          stepAcc -= CONFIG.dutchStepMs;
          const tick = minTick(currentPrice);
          const next = currentPrice - tick;
          const nextRatio = next / expected;
          if (nextRatio < 0) extraBonus += CONFIG.dutchExtraPerStep;
          if (next < 1) {
            currentPrice = 1;
            const active = cpus.filter(c => !c.retired && !c.bankrupt && cpuCanAfford(c, currentPrice));
            if (active.length > 0) {
              const pick = rng.pick(active);
              over = true;
              winner = pick.id;
              state.lastBidderId = pick.id;
              logBid(`CPU #${pick.id} ${CONFIG.personaEmoji[pick.type]} 가 ${formatMoney(currentPrice)} 에 구매. (최저가)`, 'cpu');
            } else over = true;
            return;
          }
          currentPrice = next;
        }
      },
      _tryCpuBuyFrame(dt) {
        const ratio = currentPrice / expected;
        const percent = ratio - 1;
        let stepProb = lerp(percent, CONFIG.dutchProbCurve);
        if (percent < -1.0) stepProb = Math.min(1.0, stepProb + extraBonus);
        stepProb *= aggressionMul();
        const frameP = 1 - Math.pow(1 - stepProb, dt / CONFIG.dutchStepMs);
        let activeCount = 0;
        for (const c of cpus) { if (!c.retired && !c.bankrupt) activeCount++; }
        if (activeCount === 0) return;
        const ordered = rng.shuffle(cpus);
        for (const c of ordered) {
          if (c.retired || c.bankrupt) continue;
          if (!canBidByActor(c.id)) continue;
          if (!cpuCanAfford(c, currentPrice)) continue;
          if (ratio > c.ceiling) continue;
          let personalityMul = 1.0;
          if (c.type === 'MAN') personalityMul = 1.5;
          else if (c.type === 'CON') personalityMul = ratio < 0.95 ? 1.2 : 0.4;
          else if (c.type === 'BLF') {
            personalityMul = 1.0;
            if (c.counterBonusUntil > 0 && nowMs() < c.counterBonusUntil) personalityMul = 1.5;
          }
          else if (c.type === 'SHK') personalityMul = 0.9;
          else if (c.type === 'TLT') personalityMul = c.tilted ? 1.4 : 1.0;
          else if (c.type === 'MIR') personalityMul = 1.0;
          else if (c.type === 'SNI') personalityMul = ratio < 0.7 ? 1.3 : 0.6;
          else if (c.type === 'WTH') personalityMul = ratio < 0.7 ? 1.2 : 0.5;
          const p = (frameP * personalityMul) / activeCount;
          if (rng.next() < p) {
            over = true;
            winner = c.id;
            c.hasBid = true;
            c.lastBid = currentPrice;
            state.lastBidderId = c.id;
            logBid(`CPU #${c.id} ${CONFIG.personaEmoji[c.type]} 가 ${formatMoney(currentPrice)} 에 구매.`, 'cpu');
            return;
          }
        }
      },
      onUserBid(payload) {
        if (over) return;
        if (payload && payload.giveUp) {
          userGaveUp = true;
          state.fastForward = true;
          // v8 패치 1: '입찰 포기' → '10배속 보기' (네덜란드 경매)
          logBid('10배속 보기 중 (⏩ ×10).', 'user');
          return;
        }
        if (!canBidByActor('user')) return;
        over = true;
        winner = 'user';
        state.lastBidderId = 'user';
        logBid(`나 가 ${formatMoney(currentPrice)} 에 구매.`, 'user');
      },
      isOver() { return over; },
      end() { return { winner, finalPrice: currentPrice, purchased: winner != null }; },
      getView() {
        return {
          currentPrice,
          topBidder: winner === 'user' ? '나' : (winner ? `CPU #${winner}` : '하락 중'),
          timerText: '↓ 0.5초',
          candleOn: false,
          topBidderId: winner,
          allowGiveUp: !userGaveUp && !over,
          userGaveUp,
          tickInfo: `호가 단위: ${formatMoney(minTick(currentPrice))} (하락 단위 동일)`,
        };
      },
    };
    return api;
  }


  // ============================================================
  // SECTION: UI helpers
  // ============================================================

  const $ = (id) => document.getElementById(id);

  function showScreen(id) {
    // v9.1 호환: v6 화면(.active 토글)과 v9.1 화면(.hidden 토글) CSS 룰 둘 다 만족시킴
    // 비유: 무대 조명(.active)뿐 아니라 무대 커튼(.hidden)도 같이 닫아서 v9.1 본채 UI가 안 가려지게
    // screen-auction-engine 안의 v6 화면만 스코프 한정 (외부 v9.1 screen 영향 0)
    const v6Container = document.getElementById('screen-auction-engine');
    if (v6Container) {
      v6Container.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
      });
    } else {
      // fallback: 전체 (예전 동작)
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    }
    const el = $(id);
    if (el) {
      el.classList.add('active');
      el.classList.remove('hidden');
    }
  }

  function renderCpus() {
    const list = $('cpu-list');
    if (!list) return;
    list.innerHTML = '';
    const isSealed = state.currentAuction && state.currentAuction.sealedSecret && !state.currentAuction.isOver();
    const view = state.currentAuction ? state.currentAuction.getView() : null;
    const topId = view ? view.topBidderId : null;
    for (const c of state.cpus) {
      const card = document.createElement('div');
      let statusIcon, statusLabel;
      if (c.bankrupt) { statusIcon = '💸'; statusLabel = '파산'; }
      // v8 패치 1: CPU 상태 라벨 '포기' → '10배속 보기'
      else if (c.retired) { statusIcon = '❌'; statusLabel = '10배속 보기'; }
      else if (isSealed && c.hasBid) { statusIcon = '🤐'; statusLabel = '봉투제출'; }
      else if (c.hasBid) { statusIcon = '⏳'; statusLabel = '입찰 후 대기'; }
      else if (isSealed) { statusIcon = '...'; statusLabel = '대기'; }
      else { statusIcon = '⏳'; statusLabel = '보류'; }
      const cls = ['cpu-card'];
      if (c.bankrupt) cls.push('bankrupt');
      else if (c.retired) cls.push('retired');
      else if (topId === c.id && !isSealed) cls.push('top');
      else if (c.hasBid && !isSealed) cls.push('bid');
      card.className = cls.join(' ');
      let lastBidLine;
      // v8 패치 1: 입찰 로그 '포기' → '10배속 보기'
      if (isSealed) lastBidLine = c.hasBid ? '🤐 봉투제출' : (c.retired ? '10배속 보기' : (c.bankrupt ? '파산' : '…'));
      else lastBidLine = c.lastBid != null ? formatMoney(c.lastBid) : (c.retired ? '10배속 보기' : (c.bankrupt ? '파산' : '…'));
      const personaEmoji = CONFIG.personaEmoji[c.type] || '';
      const personaName = CONFIG.personaNameKo[c.type] || '';
      let moneyClass = 'cpu-money';
      if (c.bankrupt || c.money <= 0) moneyClass += ' broke';
      else if (c.money < 500) moneyClass += ' low';
      card.innerHTML = `
        <div class="cpu-num">CPU #${c.id} <span class="cpu-persona-emoji">${personaEmoji}</span></div>
        <div class="cpu-emoji" title="${statusLabel}">${statusIcon}</div>
        <div class="cpu-bid">${lastBidLine}</div>
        <div class="${moneyClass}">💰 ${formatMoney(c.money)}</div>
        <div class="cpu-type">${personaName}${state.debugMode ? ` (${c.type})` : ''}</div>
      `;
      list.appendChild(card);
    }
  }

  function renderBidLog() {
    const box = $('auc-bid-log');
    if (!box) return;
    box.innerHTML = '';
    const recent = state.bidLog.slice(-60);
    for (const e of recent) {
      const div = document.createElement('div');
      const k = e.kind || 'sys';
      div.className = `log-msg ${k}`;
      div.textContent = e.text;
      box.appendChild(div);
    }
    box.scrollTop = box.scrollHeight;
  }

  function renderIntermission(painting, auctionName, ruleLine) {
    $('inter-cycle-round').textContent = `라운드 ${state.round}/${state.cycleAuctions.length}`;
    $('inter-money').textContent = `자금: ${formatMoney(state.money)}`;
    $('inter-painting-img').src = CONFIG.paintingsDir + painting.file;
    $('inter-painting-title').textContent = painting.title;
    $('inter-painting-category').textContent = `카테고리 ${painting.category}`;
    $('inter-auction-name').textContent = auctionName;
    $('inter-auction-rule').textContent = ruleLine;
  }

  function renderCyclePreview() {
    $('preview-cycle-title').textContent = '경매 라인업';
    const table = $('preview-table');
    table.innerHTML = '';
    for (let i = 0; i < state.cycleAuctions.length; i++) {
      const key = state.cycleAuctions[i];
      const friendly = CONFIG.auctionFriendlyName[key] || key;
      const cat = CONFIG.categories[i].name;
      const row = document.createElement('div');
      row.className = 'preview-row';
      row.innerHTML = `
        <span class="preview-round">Round ${i + 1}</span>
        <span class="preview-cat">카테고리 ${cat}</span>
        <span class="preview-auction">${friendly}</span>
      `;
      table.appendChild(row);
    }
  }

  function renderAuctionFrame() {
    if (!state.currentAuction) return;
    const v = state.currentAuction.getView();
    $('auc-round-num').textContent = `${state.round}/${state.cycleAuctions.length}`;
    $('auc-money').textContent = formatMoney(state.money);
    $('auc-auction-name').textContent = state.currentAuction.name;
    // v8 패치 4: 예상가 공개 — 화면 상단 topbar에 실시간 표시
    const expectedEl = $('bid-expected');
    if (expectedEl) expectedEl.textContent = formatMoney(state._hiddenExpected);

    if (v.sealedSecret || (state.currentAuction.name === '비밀경매' && (v.currentPrice == null || v.currentPrice === 0))) {
      $('auc-current-price').textContent = '???';
    } else {
      $('auc-current-price').textContent = formatMoney(v.currentPrice);
    }
    if (state.currentPainting) {
      $('auc-painting-img').src = CONFIG.paintingsDir + state.currentPainting.file;
      $('auc-painting-title').textContent = state.currentPainting.title;
      $('auc-painting-category').textContent = `카테고리 ${state.currentPainting.category}`;
    }
    $('auc-top-bidder').textContent = v.topBidder;
    $('auc-timer').textContent = v.timerText || '—';

    const trafficWrap = $('auc-traffic-wrap');
    if (state.currentAuction.name.includes('촛불')) {
      trafficWrap.classList.remove('hidden');
      const st = v.trafficState || 'green';
      $('traffic-red').classList.toggle('on', st === 'red');
      $('traffic-yellow').classList.toggle('on', st === 'yellow');
      $('traffic-green').classList.toggle('on', st === 'green');
    } else {
      trafficWrap.classList.add('hidden');
    }

    const cdOverlay = $('countdown-overlay');
    const cdNum = $('countdown-number');
    if (v.countdownActive) {
      cdOverlay.classList.remove('hidden');
      const sec = Math.ceil(v.countdownLeft / 1000);
      if (sec > 0) {
        cdNum.textContent = String(sec);
        cdNum.classList.remove('go');
      }
    } else if (state.currentAuction.key === 'fixed' && v.countdownLeft != null && v.countdownLeft > -700) {
      cdOverlay.classList.remove('hidden');
      cdNum.textContent = 'GO!';
      cdNum.classList.add('go');
    } else {
      cdOverlay.classList.add('hidden');
    }

    const ffBadge = $('fast-forward-badge');
    if (ffBadge) {
      ffBadge.classList.toggle('hidden', !state.fastForward);
    }

    const timerEl = $('auc-timer');
    if (v.timerText && v.timerText.includes('s')) {
      const sec = parseFloat(v.timerText);
      timerEl.classList.toggle('warn', sec <= 3.0);
    } else {
      timerEl.classList.remove('warn');
    }

    // v6: P2-16 호가 단계 안내 — 모든 모드에서 표시
    const tickInfoEl = $('auc-tick-info');
    if (tickInfoEl) {
      tickInfoEl.textContent = v.tickInfo || `호가 단위: ${formatMoney(minTick(v.currentPrice || 100))}`;
    }

    const mode = state.currentAuction.inputMode;
    $('bid-buy').classList.toggle('hidden', mode !== 'buy');
    $('bid-btn-next-wrap').classList.toggle('hidden', mode !== 'next');
    $('bid-sealed').classList.toggle('hidden', mode !== 'sealed');
    $('bid-limited').classList.toggle('hidden', mode !== 'limited');
    $('bid-btn-dutch-wrap').classList.toggle('hidden', mode !== 'buy-dutch');

    if (mode === 'buy') {
      const buyBtn = $('bid-btn-buy');
      const giveUpBtn = $('bid-btn-give-up');
      const labelPrice = `지금 산다 (${formatMoney(v.currentPrice)})`;
      // v6: 큐잉 상태 표시
      buyBtn.querySelector('.bid-btn-main').textContent = v.pendingBuy ? '⏳ GO 즉시 입찰 예약됨' : labelPrice;
      if (v.userGaveUp) {
        buyBtn.disabled = true;
        giveUpBtn.disabled = true;
        // v8 패치 1: '입찰 포기됨' → '10배속 보기 중'
        giveUpBtn.textContent = '10배속 보기 중 (⏩ ×10)';
      } else {
        // v6: P0-3 카운트다운 중에도 클릭 가능 (큐잉)
        buyBtn.disabled = false;
        giveUpBtn.disabled = false;
        // v8 패치 1: '입찰 포기' → '10배속 보기'
        giveUpBtn.textContent = '10배속 보기 (⏩ ×10)';
      }
    } else if (mode === 'buy-dutch') {
      const d = $('bid-btn-dutch');
      d.querySelector('.bid-btn-main').textContent = `지금 산다 (${formatMoney(v.currentPrice)})`;
      const giveUp = $('bid-btn-dutch-giveup');
      if (giveUp) {
        if (v.userGaveUp) {
          giveUp.disabled = true;
          // v8 패치 1: '입찰 포기됨' → '10배속 보기 중' (네덜란드)
          giveUp.textContent = '10배속 보기 중 (⏩ ×10)';
        } else {
          giveUp.disabled = false;
          // v8 패치 1: '입찰 포기' → '10배속 보기' (네덜란드)
          giveUp.textContent = '10배속 보기 (⏩ ×10)';
        }
      }
    } else if (mode === 'next') {
      const nextBtn = $('bid-btn-next');
      const np = v.nextBidPrice || (v.currentPrice + minTick(v.currentPrice));
      const steps = v.userTargetSteps || 1;
      const stepText = steps > 1 ? ` · ${steps}단계` : '';
      nextBtn.querySelector('.bid-btn-main').textContent = `다음 가격 입찰 (${formatMoney(np)})`;
      const isMyTurn = state.lastBidderId !== 'user';
      nextBtn.disabled = !isMyTurn;
      if (!isMyTurn) nextBtn.querySelector('.bid-btn-sub').textContent = '본인 재입찰 불가 — 누군가 부르면 활성';
      else nextBtn.querySelector('.bid-btn-sub').textContent = `현재가 + 호가${stepText}`;
      const giveUp = $('bid-btn-next-giveup');
      if (giveUp) {
        if (v.userGaveUp) {
          giveUp.disabled = true;
          // v8 패치 1: '입찰 포기됨' → '10배속 보기 중' (자유경매)
          giveUp.textContent = '10배속 보기 중 (⏩ ×10)';
        } else {
          giveUp.disabled = false;
          // v8 패치 1: '입찰 포기' → '10배속 보기' (자유경매)
          giveUp.textContent = '10배속 보기 (⏩ ×10)';
        }
      }
    } else if (mode === 'sealed') {
      const submittedFlag = state.currentAuction && state.currentAuction._userSubmitted;
      const sealedInput = $('bid-sealed-input');
      const sealedSubmit = $('bid-sealed-submit');
      if (!submittedFlag) {
        sealedInput.disabled = false;
        sealedSubmit.disabled = false;
      }
      const catName = state.currentAuction.sealedCategory || 'C';
      const placeholder = CONFIG.sealedPlaceholderByCategory[catName] || '비밀 입찰가 입력';
      sealedInput.placeholder = placeholder;
      const sealedTimerEl = $('sealed-timer');
      const remain = v.sealedRemainMs;
      if (typeof remain === 'number') {
        const sec = Math.max(0, remain / 1000).toFixed(1);
        sealedTimerEl.textContent = `남은 시간: ${sec}초`;
        sealedTimerEl.classList.toggle('warn', remain <= 5000);
      } else {
        sealedTimerEl.textContent = '재경매 진행 중';
        sealedTimerEl.classList.remove('warn');
      }
      const giveUp = $('bid-sealed-giveup');
      if (giveUp) {
        if (v.userGaveUp || submittedFlag) {
          giveUp.disabled = true;
          // v8 패치 1: '입찰 포기됨' → '10배속 보기 중' (비밀경매)
          giveUp.textContent = v.userGaveUp ? '10배속 보기 중 (⏩ ×10)' : '제출 완료';
        } else {
          giveUp.disabled = false;
          // v8 패치 1: '입찰 포기' → '10배속 보기' (비밀경매)
          giveUp.textContent = '10배속 보기 (⏩ ×10)';
        }
      }
    } else if (mode === 'limited') {
      const turn = $('bid-limited-turn');
      turn.textContent = v.turnLabel || '선착순 30초';
      const canAct = !!v.waitingForUser;
      $('bid-limited-input').disabled = !canAct;
      $('bid-limited-submit').disabled = !canAct;
      $('bid-limited-pass').disabled = !canAct;
      // v6: 휠 기준가 표시 (placeholder)
      const inputEl = $('bid-limited-input');
      const steps = v.userTargetSteps || 1;
      const np = v.nextBidPrice;
      if (np && inputEl) inputEl.placeholder = `휠로 ${steps}단계 → ${formatMoney(np)} (또는 직접 입력)`;
      const giveUp = $('bid-limited-giveup');
      if (giveUp) {
        if (v.userGaveUp || v.userActed) {
          giveUp.disabled = true;
          // v8 패치 1: '입찰 포기됨' → '10배속 보기 중' (1회제한)
          giveUp.textContent = v.userGaveUp ? '10배속 보기 중 (⏩ ×10)' : '액션 완료';
        } else {
          giveUp.disabled = false;
          // v8 패치 1: '입찰 포기' → '10배속 보기' (1회제한)
          giveUp.textContent = '10배속 보기 (⏩ ×10)';
        }
      }
    }

    renderCpus();
    renderBidLog();
    updateDebugInfo();
  }

  function renderSaleItem(item, idx, total) {
    $('sale-progress').textContent = `판매 ${idx + 1}/${total}`;
    $('sale-money').textContent = `자금: ${formatMoney(state.money)}`;
    $('sale-painting-img').src = CONFIG.paintingsDir + item.painting.file;
    $('sale-painting-title').textContent = item.painting.title;
    $('sale-painting-category').textContent = `낙찰: 나`;
    $('sale-expected').textContent = formatMoney(item.expected);
    $('sale-bought').textContent = formatMoney(item.boughtAt);
    const diff = item.expected - item.boughtAt;
    const diffEl = $('sale-diff');
    if (diff >= 0) { diffEl.textContent = '+' + formatMoney(diff); diffEl.className = 'gain'; }
    else { diffEl.textContent = formatMoney(diff); diffEl.className = 'loss'; }
    diffEl.id = 'sale-diff';
    renderCpuLedger();
    renderPaintingsLedger();
  }

  function renderCpuLedger() {
    const ledger = {};
    function getRow(id) {
      if (!ledger[id]) ledger[id] = { bought: 0, totalCost: 0, totalSell: 0, paintings: [] };
      return ledger[id];
    }
    for (const r of state.cycleResults) {
      if (!r.purchased || r.winner == null) continue;
      const row = getRow(r.winner);
      row.bought++;
      row.totalCost += r.finalPrice;
      row.totalSell += r.expected;
      row.paintings.push({ painting: r.painting, price: r.finalPrice });
    }
    const list = $('cpu-ledger');
    list.innerHTML = '';
    const sortedIds = ['user'].concat(state.cpus.map(c => c.id));
    for (const id of sortedIds) {
      if (!ledger[id]) continue;
      const r = ledger[id];
      const profit = r.totalSell - r.totalCost;
      const name = id === 'user' ? '👤 나' : `CPU #${id}`;
      const cpu = state.cpus.find(c => c.id === id);
      const personaEmoji = cpu ? CONFIG.personaEmoji[cpu.type] : '';
      const row = document.createElement('div');
      row.className = id === 'user' ? 'ledger-row user-row' : 'ledger-row';
      const profitClass = profit > 0 ? 'gain' : (profit < 0 ? 'loss' : 'zero');
      const profitSign = profit >= 0 ? '+' : '';
      row.innerHTML = `
        <div class="ledger-name">${name} ${personaEmoji}</div>
        <div class="ledger-stats">산 그림 ${r.bought}장 · 총 매수 ${formatMoney(r.totalCost)} · 매도 ${formatMoney(r.totalSell)}</div>
        <div class="ledger-stats">수익 <span class="ledger-profit ${profitClass}">${profitSign}${formatMoney(profit)}</span></div>
      `;
      list.appendChild(row);
    }
    if (Object.keys(ledger).length === 0) {
      list.innerHTML = '<div class="ledger-stats">이번 경매 낙찰자 없음.</div>';
    }
  }

  // v6: P2-14 정산창 5장 모두 표시 명확화 — 유찰까지 5줄 출력
  function renderPaintingsLedger() {
    const list = $('paintings-ledger-list');
    list.innerHTML = '';
    for (const r of state.cycleResults) {
      const row = document.createElement('div');
      row.className = 'painting-row';
      if (!r.purchased || r.winner == null) {
        row.innerHTML = `<span class="pl-cat">[${r.painting.category}]</span> 🖼 <b>${r.painting.title}</b> → <span class="pl-loss">유찰</span> <span class="pl-exp">(예상 ${formatMoney(r.expected)})</span>`;
      } else {
        const name = r.winner === 'user' ? '나' : `CPU #${r.winner}`;
        const isMe = r.winner === 'user';
        const diff = r.expected - r.finalPrice;
        const diffStr = diff >= 0 ? `+${formatMoney(diff)}` : `${formatMoney(diff)}`;
        const diffCls = diff > 0 ? 'pl-gain' : (diff < 0 ? 'pl-loss' : '');
        row.innerHTML = `<span class="pl-cat">[${r.painting.category}]</span> 🖼 <b>${r.painting.title}</b> → ${isMe ? '<b class="pl-me">' + name + '</b>' : name} / ${formatMoney(r.finalPrice)} <span class="pl-exp">(예상 ${formatMoney(r.expected)} · 차익 <span class="${diffCls}">${diffStr}</span>)</span>`;
      }
      list.appendChild(row);
    }
  }

  function updateDebugInfo() {
    if (!state.debugMode) return;
    const info = $('debug-info');
    if (!info) return;
    const counts = { APP: 0, CON: 0, MAN: 0, BLF: 0, SHK: 0, TLT: 0, MIR: 0, SNI: 0, WTH: 0 };
    let bankruptCount = 0;
    let totalMoney = 0;
    for (const c of state.cpus) {
      if (!c.retired && !c.bankrupt) counts[c.type]++;
      if (c.bankrupt) bankruptCount++;
      totalMoney += c.money || 0;
    }
    const ext = state.extremeRoundSet.has(state.round) ? 'YES' : 'no';
    const extList = Array.from(state.extremeRoundSet).sort().join(',');
    const meanCpu = state.cpus.length > 0 ? Math.round(totalMoney / state.cpus.length) : 0;
    info.textContent =
      `expected=${formatMoney(state._hiddenExpected)}\n` +
      `extreme=${ext} (set:[${extList}])\n` +
      `APP=${counts.APP} CON=${counts.CON} MAN=${counts.MAN} BLF=${counts.BLF}\n` +
      `SHK=${counts.SHK} TLT=${counts.TLT} MIR=${counts.MIR} SNI=${counts.SNI} WTH=${counts.WTH}\n` +
      `cpu$=avg${formatMoney(meanCpu)} broke=${bankruptCount}/10 lastMaxJump=${state.lastMaxJump}\n` +
      `agg=${aggressionMul().toFixed(2)} ceil=${ceilingMul().toFixed(2)} lastBidder=${state.lastBidderId} ff=${state.fastForward} f10v=${state._free10Variant}`;
  }


  // ============================================================
  // SECTION: main / game loop
  // ============================================================

  function buildAuctionVariants() {
    return [
      { key: 'fixed',         w: CONFIG.auctionWeights.fixed,        factory: makeFixedPrice },
      { key: 'free10_1st',    w: CONFIG.auctionWeights.free10_1st,   factory: makeFreeAuction({ secondPrice: false }) },
      { key: 'free10_2nd',    w: CONFIG.auctionWeights.free10_2nd,   factory: makeFreeAuction({ secondPrice: true  }) },
      { key: 'candle_1st',    w: CONFIG.auctionWeights.candle_1st,   factory: makeFreeAuctionCandle({ secondPrice: false }) },
      { key: 'candle_2nd',    w: CONFIG.auctionWeights.candle_2nd,   factory: makeFreeAuctionCandle({ secondPrice: true  }) },
      { key: 'sealed',        w: CONFIG.auctionWeights.sealed,       factory: makeSealedBid },
      { key: 'limited_1st',   w: CONFIG.auctionWeights.limited_1st,  factory: makeLimitedOnce({ secondPrice: false }) },
      { key: 'limited_2nd',   w: CONFIG.auctionWeights.limited_2nd,  factory: makeLimitedOnce({ secondPrice: true  }) },
      { key: 'dutch',         w: CONFIG.auctionWeights.dutch,        factory: makeDutchAuction },
    ];
  }
  let AUCTION_VARIANTS = null;

  function pickCycleKeys(rng) {
    if (state.forceAuction.length > 0) {
      const keys = [];
      for (let i = 0; i < 5; i++) keys.push(state.forceAuction[i % state.forceAuction.length]);
      return keys;
    }
    return buildCycle(rng);
  }

  function getVariantByKey(key) {
    return AUCTION_VARIANTS.find(v => v.key === key);
  }

  function pickPaintingForRound() {
    const category = CONFIG.categories[state.round - 1];
    // V6 단계별: _auctionPoolFilter가 있으면 해당 풀에서 뽑음, 없으면 전체 풀
    // 비유: 단계별 경매 시 지정된 그림 종류 바구니에서만 뽑고, 아니면 모든 바구니에서
    let pool = state.paintings;
    if (typeof state._auctionPoolFilter === 'function') {
      const filtered = state._auctionPoolFilter(state.paintings);
      if (filtered && filtered.length > 0) pool = filtered;
    }
    const painting = state.rng.pick(pool);
    return { id: painting.id, file: painting.file, title: painting.title, category: category.name };
  }

  function rollExpectedPrice() {
    // v8 패치 10: 디버그 모드일 때 예상가 강제 설정
    // 비유: 자체 검증 패널에서 예상가를 직접 입력하면 그 값으로 고정
    if (window._mn9Debug && typeof window._mn9Debug.forceEstimatedPrice === 'number') {
      return window._mn9Debug.forceEstimatedPrice;
    }
    const cat = CONFIG.categories[state.round - 1];
    const raw = cat.min + state.rng.next() * (cat.max - cat.min);
    return roundToTick(raw);
  }

  let _lastFrameTs = 0;
  let _rafId = 0;

  // v8 패치 5: 경매 진입 자금 부족 차단 가드
  // 비유: 경매장 입구에서 돈이 너무 적으면 아예 들어오지 못하게 막는 문지기
  function enterAuction(startPrice, showCenterModal) {
    if (state.money < startPrice * 1.2) {
      if (typeof showCenterModal === 'function') {
        showCenterModal('자금 부족 — 경매 입장 불가. 모작 더 만들어주세요.');
      }
      return false; // 진입 차단
    }
    return true; // 진입 허가
  }
  // v8 패치 5 끝 — v8 game.js에서 enterAuction()을 호출해 진입 여부 확인

  function startCycle() {
    state.cycle = 1;
    state.round = 1;
    // v9 패치: v9 작업실에서 모은 자금을 경매 시작 시 가져옴
    // 비유: 경매장 입장 전에 지갑(v9 game state)에서 현금(자금)을 꺼내는 것
    if (window.MN9_Game && typeof window.MN9_Game.state === 'function') {
      const v9State = window.MN9_Game.state();
      state.money = (v9State && typeof v9State.money === 'number') ? v9State.money : CONFIG.startMoney;
    } else {
      state.money = CONFIG.startMoney;
    }
    state.inventory = [];
    state.cycleResults = [];
    state.bidLog = [];
    state.cpuTiltMemory = {};
    state.lastBidderId = null;
    state.fastForward = false;
    state.lastMaxJump = 0;
    state._recentHostKeys = [];
    state.cpuMoneyMean = cpuMoneyMean();
    planExtremeRounds(state.rng);
    state.cycleAuctions = pickCycleKeys(state.rng);
    renderCyclePreview();
    showScreen('screen-cycle-preview');
  }

  function beginCycleAfterPreview() { nextRound(); }

  function nextRound() {
    state.bidLog = [];
    state.lastBidderId = null;
    state.fastForward = false;
    state.userTargetSteps = 1;
    state._pendingBuyClick = false;

    // v8 패치 9: 자체 출품 어댑터
    // 비유: 작업실에서 내 그림을 직접 경매에 올릴 때,
    //       경매장(v6)이 그 그림과 가격 정보를 올바르게 받아서 쓰도록 연결하는 다리
    const selfSubmit = window._mn9SelfSubmit || null;
    if (selfSubmit) {
      // 첫 번째 라운드에서만 자체 출품 그림 사용 (이후 라운드는 일반 그림)
      window._mn9SelfSubmit = null; // 한 번 쓰고 바로 초기화 (재사용 방지)
      const it = selfSubmit.item;
      // v6 경매가 기대하는 painting 객체 형태로 변환
      state.currentPainting = {
        id: it.id || 'self_0',
        file: it.filename || it.file || 'watercolor_1.jpg',
        title: it.title || '내 작품',
        category: CONFIG.categories[state.round - 1].name,
        isSelfSubmit: true, // 자체 출품 표시 (결과 처리 분기용)
      };
      state._hiddenExpected = selfSubmit.estimatedPrice || selfSubmit.startPrice || 100;
      state._selfSubmitStartPrice = selfSubmit.startPrice || null; // 시작가 오버라이드
    } else {
      const painting = pickPaintingForRound();
      const expected = rollExpectedPrice();
      state.currentPainting = painting;
      state._hiddenExpected = expected;
      // v8 패치 10: 디버그 시작가 강제값이 있으면 그걸 사용, 없으면 null (자동 계산)
      // 비유: 자체 검증 패널에서 시작가를 직접 입력하면 그 값으로 경매 시작
      state._selfSubmitStartPrice = (window._mn9Debug && typeof window._mn9Debug.forceStartPrice === 'number')
        ? window._mn9Debug.forceStartPrice
        : null;
    }

    const extreme = isExtremeRound(state.round);
    const prevMoneys = (state.cpus || []).map(c => c.money);
    state.cpus = makeCpus(state.rng, state.round, extreme, state.cpuMoneyMean);
    state.cpus.forEach((c, i) => { if (prevMoneys[i] != null) c.money = prevMoneys[i]; });
    const key = state.cycleAuctions[state.round - 1];
    state.currentAuctionKey = key;
    const variant = getVariantByKey(key);
    const auction = variant.factory({
      state,
      painting: state.currentPainting,
      expected: state._hiddenExpected,
      startPriceOverride: state._selfSubmitStartPrice, // 자체 출품 시작가 (없으면 null)
      cpus: state.cpus, rng: state.rng,
    });
    state.currentAuction = auction;

    // B2 진짜 원인 픽스: painting은 line 3123 else 블록 안 const 로컬 변수라
    // 블록 밖에서 ReferenceError. state.currentPainting은 어느 분기에서든 설정됨.
    renderIntermission(state.currentPainting, auction.name, auction.ruleLine);
    showScreen('screen-intermission');
    state._intermissionReadyAt = Date.now() + 400;

    const sealedInputEl = $('bid-sealed-input');
    const sealedSubmitEl = $('bid-sealed-submit');
    if (sealedInputEl) {
      // v8 패치 6 추가: 자체 출품 시작가가 있으면 입력란에 기본값으로 채움
      sealedInputEl.value = auction.sealedStartHint != null ? String(auction.sealedStartHint) : '';
      sealedInputEl.disabled = false;
    }
    if (sealedSubmitEl) { sealedSubmitEl.disabled = false; }
    const limitedInputEl = $('bid-limited-input');
    if (limitedInputEl) {
      // v8 패치 6 추가: 자체 출품 시작가가 있으면 입력란에 기본값으로 채움
      limitedInputEl.value = auction.limitedStartHint != null ? String(auction.limitedStartHint) : '';
    }
  }

  function startAuctionRun() {
    state.currentAuction.start();
    showScreen('screen-auction');
    state._renderDirty = true;
    renderAuctionFrame();
    _lastFrameTs = performance.now();
    _rafId = requestAnimationFrame(tick);
  }

  function tick(ts) {
    const dt = Math.min(100, ts - _lastFrameTs);
    _lastFrameTs = ts;
    if (state.currentAuction) {
      state.currentAuction.step(dt);
      if (state.currentAuction.isOver()) {
        finishAuction();
        return;
      }
      renderAuctionFrame();
      state._renderDirty = false;
    }
    _rafId = requestAnimationFrame(tick);
  }

  function finishAuction() {
    if (_rafId) cancelAnimationFrame(_rafId);
    _rafId = 0;
    let res = state.currentAuction.end();
    // v8 패치 10: 디버그 모드일 때 강제 본인 낙찰
    // 비유: 자체 검증 패널에서 "강제 본인 낙찰" ON 상태면 결과를 내 낙찰로 덮어씀. 평소엔 그냥 무시
    if (window._mn9Debug && window._mn9Debug.forceWin) {
      res = { ...res, winner: 'user', purchased: true };
    }
    if (res.purchased && res.winner != null) {
      const label = res.winner === 'user' ? '나' : `CPU #${res.winner}`;
      logBid(`📢 낙찰됐습니다. ${label} ${formatMoney(res.finalPrice)} 낙찰!`, 'host cd');
    } else {
      logBid(`📢 유찰. 낙찰자 없습니다.`, 'host cd');
    }
    renderAuctionFrame();

    // v8 패치 9: 자체 출품 낙찰 결과 처리
    // 비유: 내 그림을 경매에 올렸을 때 — 내가 다시 사면 돈 0 차감, CPU가 사면 돈이 들어옴
    const isSelf = !!(state.currentPainting && state.currentPainting.isSelfSubmit);
    if (res.purchased && res.winner === 'user') {
      if (isSelf) {
        // 자체 출품 → 본인 낙찰: 자기 작품을 회수하는 것이므로 돈 차감 없음 (락-인 결정 9번)
        // 인벤토리에는 추가 안 함 (판매 목적으로 올린 것이므로)
      } else {
        state.money -= res.finalPrice;
        state.inventory.push({
          painting: state.currentPainting,
          expected: state._hiddenExpected,
          boughtAt: res.finalPrice,
        });
      }
    } else if (res.purchased && res.winner != null && typeof res.winner === 'number') {
      const c = state.cpus.find(cc => cc.id === res.winner);
      if (c) {
        c.money -= res.finalPrice;
        if (c.money <= 0) c.bankrupt = true;
      }
      if (isSelf) {
        // 자체 출품 → CPU 낙찰: 판매 성공! 낙찰가를 내 자금에 추가
        state.money += res.finalPrice;
      }
    }
    state.cycleResults.push({
      round: state.round,
      auctionKey: state.currentAuctionKey,
      auctionName: state.currentAuction.name,
      painting: state.currentPainting,
      expected: state._hiddenExpected,
      finalPrice: res.finalPrice,
      winner: res.winner,
      purchased: res.purchased,
    });
    const newTilt = {};
    for (const c of state.cpus) {
      if (c.hasBid && res.winner !== c.id) newTilt[c.id] = 'lost';
      else if (c.hasBid && res.winner === c.id) newTilt[c.id] = 'won';
      else newTilt[c.id] = null;
    }
    state.cpuTiltMemory = newTilt;

    state.lastResult = {
      winner: res.winner,
      finalPrice: res.finalPrice,
      purchased: res.purchased,
      auctionName: state.currentAuction.name,
      isLastRound: state.round >= state.cycleAuctions.length,
    };

    setTimeout(() => {
      state.fastForward = false;
      showRoundResult();
    }, CONFIG.afterAuctionDelayMs);
  }

  function showRoundResult() {
    const r = state.lastResult;
    if (!r) return;
    let winnerLabel;
    if (!r.purchased) winnerLabel = '낙찰자 없음';
    else if (r.winner === 'user') winnerLabel = '나';
    else winnerLabel = `CPU #${r.winner}`;
    $('result-winner').textContent = winnerLabel;
    $('result-price').textContent = r.purchased ? formatMoney(r.finalPrice) : '—';
    $('result-auction').textContent = r.auctionName;
    $('result-title').textContent = r.isLastRound ? `라운드 ${state.cycleAuctions.length}/${state.cycleAuctions.length} 결과` : `라운드 ${state.round}/${state.cycleAuctions.length} 결과`;
    $('btn-next-round').textContent = r.isLastRound ? '판매 세션으로' : '다음 라운드';
    showScreen('screen-round-result');
  }

  function proceedAfterResult() {
    const r = state.lastResult;
    if (!r) {
      console.warn('[v10] lastResult missing — fallback');
      if (state.cycleResults && state.cycleResults.length > 0) {
        state.lastResult = state.cycleResults[state.cycleResults.length - 1];
        showRoundResult();
        return;
      }
      if (state.round < state.cycleAuctions.length) { state.round++; nextRound(); }
      else { startSaleSession(); }
      return;
    }
    state.lastResult = null;
    if (r.isLastRound) startSaleSession();
    else { state.round++; nextRound(); }
  }

  function startSaleSession() {
    if (state.inventory.length === 0) {
      // v6: P2-14 — 본인 낙찰 없어도 정산창은 봐야 함. 가짜 saleQueue 없으면 사이클 종료 화면이지만,
      // CPU 정산 패널은 cycle-end 화면에 표시
      endCycle();
      return;
    }
    state.saleQueue = state.inventory.slice();
    showSaleNext();
  }

  function showSaleNext() {
    if (state.saleQueue.length === 0) { endCycle(); return; }
    const idx = state.inventory.length - state.saleQueue.length;
    const item = state.saleQueue[0];
    renderSaleItem(item, idx, state.inventory.length);
    showScreen('screen-sale');
  }

  function handleSell() {
    if (state.saleQueue.length === 0) return;
    const item = state.saleQueue.shift();
    state.money += item.expected;
    showSaleNext();
  }

  function handleKeep() {
    if (!state.saleQueue || state.saleQueue.length === 0) return;
    const item = state.saleQueue.shift();
    // v9 작업실 inventory로 이전
    if (window.MN9_Game && typeof window.MN9_Game.state === 'function') {
      const v9State = window.MN9_Game.state();
      if (v9State) {
        v9State.inventory = v9State.inventory || [];
        v9State.inventory.push({
          id: item.id || 'auc_' + Date.now(),
          type: item.type || 'watercolor',
          grade: item.grade || 1,
          filename: item.file || 'watercolor_1.jpg',
          title: item.title || '경매 낙찰 그림',
          isOriginal: true,
          counterfeitGrade: 0,
          value: 0,
          createdAt: Date.now(),
        });
        if (typeof window.MN9_Game.autosave === 'function') window.MN9_Game.autosave();
      }
    }
    // 다음 그림 또는 경매 종료
    if (state.saleQueue.length === 0) { endCycle(); return; }
    showSaleNext();
  }

  const gameOverTaunts = [
    '당신은 파산했습니다.',
    '당신, 보는 눈이 없네요.',
    '다시 도전하시겠습니까?',
    '경매장 단골이 될 뻔하셨군요.',
    '그림 한 점도 값을 못 했네요…',
    '컬렉터의 안목은 다음 생에 다시.',
  ];

  function endCycle() {
    // V6 패치: 사이클 카운터 증가 — 다음 경매 단계 결정에 사용
    // 비유: 경매장에서 나올 때마다 "몇 번째 방문이었나" 카운터를 하나 올림
    if (window.MN9_Game && typeof window.MN9_Game.state === 'function') {
      const v9State = window.MN9_Game.state();
      if (v9State) {
        v9State.auctionCycleCount = (v9State.auctionCycleCount || 0) + 1;
      }
    }

    // v9 패치: 첫 경매 완료 마킹 — 다음부터는 무작위 풀로 경매 진행
    // 비유: 첫 번째 경매가 끝나면 "이제 시연 완료" 도장을 찍고 자유 이용 모드로 전환
    if (window.MN9_FirstAuction && window.MN9_FirstAuction.isFirstAuction(state)) {
      window.MN9_FirstAuction.markFirstAuctionDone(state);
      if (window.MN9_Game && window.MN9_Game.autosave) {
        window.MN9_Game.autosave();
      }
      if (window.MN9_Game && window.MN9_Game.toast) {
        window.MN9_Game.toast('경매장 자유 이용 잠금 해제!');
      }
    }
    state.inventory = [];
    state.cycleResults = [];
    // v9 패치: 경매 끝난 뒤 최종 자금을 v9 작업실에 돌려줌
    // 비유: 경매장에서 나올 때 지갑(v9 game state)에 남은 현금을 다시 넣는 것
    if (window.MN9_Game && typeof window.MN9_Game.state === 'function') {
      const v9State = window.MN9_Game.state();
      if (v9State) {
        v9State.money = state.money;
        if (typeof window.MN9_Game.autosave === 'function') {
          window.MN9_Game.autosave();
        }
      }
    }
    if (state.money < 0) {
      $('go-cycle').textContent = state.cycle;
      $('go-money').textContent = formatMoney(state.money);
      const tauntEl = $('go-taunt');
      if (tauntEl) {
        const t1 = state.rng.pick(gameOverTaunts);
        let t2 = state.rng.pick(gameOverTaunts);
        while (t2 === t1 && gameOverTaunts.length > 1) t2 = state.rng.pick(gameOverTaunts);
        tauntEl.innerHTML = `<div class="taunt-line">${t1}</div><div class="taunt-line">${t2}</div>`;
      }
      showScreen('screen-gameover');
    } else {
      $('ce-money').textContent = formatMoney(state.money);
      showScreen('screen-final-summary');
    }
  }

  function restartGame() { startCycle(); }

  // ============================================================
  // SECTION: input bindings (v6: P0-1 휠 반전 + P1-9 1회제한 휠 + P2-15 전역 키)
  // ============================================================

  function bindInputs() {
    $('btn-start').addEventListener('click', () => startCycle());
    $('btn-start-cycle').addEventListener('click', () => beginCycleAfterPreview());

    // P2-15: 인터미션 화면 어디든 클릭/키로 시작
    $('screen-intermission').addEventListener('click', () => {
      if (Date.now() < (state._intermissionReadyAt || 0)) return;
      startAuctionRun();
    });

    $('bid-btn-buy').addEventListener('click', () => {
      if (state.currentAuction) state.currentAuction.onUserBid();
    });
    $('bid-btn-give-up').addEventListener('click', () => {
      if (state.currentAuction) state.currentAuction.onUserBid({ giveUp: true });
    });
    $('bid-btn-dutch').addEventListener('click', () => {
      if (state.currentAuction) state.currentAuction.onUserBid();
    });
    $('bid-btn-dutch-giveup').addEventListener('click', () => {
      if (state.currentAuction) state.currentAuction.onUserBid({ giveUp: true });
    });
    $('bid-btn-next').addEventListener('click', () => {
      if (state.currentAuction) state.currentAuction.onUserBid();
    });
    $('bid-btn-next-giveup').addEventListener('click', () => {
      if (state.currentAuction) state.currentAuction.onUserBid({ giveUp: true });
    });

    // v6: P0-1 휠 — deltaY < 0 (위로 굴림) → 가격 ↑ [반전]
    function attachWheel(elId, modes) {
      const el = $(elId);
      if (!el) return;
      el.addEventListener('wheel', (e) => {
        if (!state.currentAuction) return;
        const mode = state.currentAuction.inputMode;
        if (!modes.includes(mode)) return;
        e.preventDefault();
        // v6: P0-1 반전 — 위로 굴림(deltaY < 0) = 가격 ↑
        if (e.deltaY < 0) {
          state.userTargetSteps = Math.min(20, (state.userTargetSteps || 1) + 1);
        } else if (e.deltaY > 0) {
          state.userTargetSteps = Math.max(1, (state.userTargetSteps || 1) - 1);
        }
        state._renderDirty = true;
        renderAuctionFrame();
      }, { passive: false });
    }
    attachWheel('bid-btn-next-wrap', ['next']);
    // v6: P1-9 1회제한도 휠 — bid-limited 컨테이너에 부착
    attachWheel('bid-limited', ['limited']);

    // v6: P2-15 전역 키보드
    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      // 입력창 포커스 중에는 Enter만 허용 (제출 핸들러가 처리)
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // === 화면별 처리 ===
      // 인터미션: 아무 키 → 경매 시작
      const interScreen = $('screen-intermission');
      if (interScreen && interScreen.classList.contains('active')) {
        if (Date.now() < (state._intermissionReadyAt || 0)) return;
        e.preventDefault();
        startAuctionRun();
        return;
      }
      // 라운드 결과: 아무 키 → 다음
      const resultScreen = $('screen-round-result');
      if (resultScreen && resultScreen.classList.contains('active')) {
        e.preventDefault();
        proceedAfterResult();
        return;
      }
      // 사이클 미리보기: 아무 키 → 시작
      const previewScreen = $('screen-cycle-preview');
      if (previewScreen && previewScreen.classList.contains('active')) {
        e.preventDefault();
        beginCycleAfterPreview();
        return;
      }
      // 판매 화면: Enter/Space → 판매
      const saleScreen = $('screen-sale');
      if (saleScreen && saleScreen.classList.contains('active')) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          handleSell();
          return;
        }
      }
      // 게임오버: 아무 키 → 재시작
      const goScreen = $('screen-gameover');
      if (goScreen && goScreen.classList.contains('active')) {
        e.preventDefault();
        restartGame();
        return;
      }
      // 시작 화면: 아무 키 → 시작
      const startScreen = $('screen-start');
      if (startScreen && startScreen.classList.contains('active')) {
        e.preventDefault();
        startCycle();
        return;
      }

      // === 경매 화면 ===
      const aucScreen = $('screen-auction');
      if (!aucScreen || !aucScreen.classList.contains('active')) return;
      if (!state.currentAuction) return;
      const mode = state.currentAuction.inputMode;

      if (mode === 'next' || mode === 'limited') {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          state.userTargetSteps = Math.min(20, (state.userTargetSteps || 1) + 1);
          state._renderDirty = true;
          renderAuctionFrame();
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          state.userTargetSteps = Math.max(1, (state.userTargetSteps || 1) - 1);
          state._renderDirty = true;
          renderAuctionFrame();
          return;
        }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          state.currentAuction.onUserBid();
          return;
        }
      }
      if (mode === 'buy' || mode === 'buy-dutch') {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          state.currentAuction.onUserBid();
          return;
        }
      }
    });

    // 비밀경매 Enter
    const sealedInput = $('bid-sealed-input');
    sealedInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        $('bid-sealed-submit').click();
      }
    });
    $('bid-sealed-submit').addEventListener('click', () => {
      const val = Number($('bid-sealed-input').value);
      if (!Number.isFinite(val) || val < 0) {
        alert('0$ 이상의 입찰가를 입력하세요.');
        return;
      }
      $('bid-sealed-input').disabled = true;
      $('bid-sealed-submit').disabled = true;
      if (state.currentAuction) state.currentAuction.onUserBid({ price: val });
    });
    $('bid-sealed-giveup').addEventListener('click', () => {
      if (state.currentAuction) state.currentAuction.onUserBid({ giveUp: true });
    });
    $('bid-limited-submit').addEventListener('click', () => {
      const val = Number($('bid-limited-input').value);
      // 빈 입력: 휠 기준으로 자동 입찰 가능 (price 안 넘기면 currentAuction이 휠 단계로 계산)
      if ($('bid-limited-input').value === '') {
        if (state.currentAuction) state.currentAuction.onUserBid({});
        return;
      }
      if (!Number.isFinite(val) || val < 1) {
        alert('1$ 이상의 입찰가를 입력하세요.');
        return;
      }
      $('bid-limited-input').value = '';
      if (state.currentAuction) state.currentAuction.onUserBid({ price: val });
    });
    $('bid-limited-pass').addEventListener('click', () => {
      if (state.currentAuction) state.currentAuction.onUserBid({ pass: true });
    });
    $('bid-limited-giveup').addEventListener('click', () => {
      if (state.currentAuction) state.currentAuction.onUserBid({ giveUp: true });
    });
    $('btn-next-round').addEventListener('click', () => proceedAfterResult());
    $('btn-sell').addEventListener('click', handleSell);
    $('btn-keep').addEventListener('click', handleKeep);
    $('btn-restart').addEventListener('click', restartGame);
    // v8 패치 8: 게임오버 화면에서 작업실로 돌아가기
    const backStudioGo = $('btn-back-studio-go');
    if (backStudioGo) {
      backStudioGo.addEventListener('click', () => {
        if (window.MN9_Game && typeof window.MN9_Game.switchScreen === 'function') {
          window.MN9_Game.switchScreen('screen-studio');
        }
      });
    }
    // Phase 3: 경매 종료(최종 요약) 화면에서 작업실로 돌아가기
    const backStudioFs = $('btn-back-studio-fs');
    if (backStudioFs) {
      backStudioFs.addEventListener('click', () => {
        if (window.MN9_Game && typeof window.MN9_Game.switchScreen === 'function') {
          window.MN9_Game.switchScreen('screen-studio');
        }
      });
    }
    bindSliders();
  }

  function bindSliders() {
    const sliders = [
      { id: 'slider-1', key: 's1_aggression', valId: 's1-val' },
      { id: 'slider-2', key: 's2_intensity', valId: 's2-val' },
      { id: 'slider-3', key: 's3_ceilingMean', valId: 's3-val' },
      { id: 'slider-4', key: 's4_ceilingSigma', valId: 's4-val' },
      { id: 'slider-5', key: 's5_cpuMoney', valId: 's5-val' },
    ];
    for (const s of sliders) {
      const el = $(s.id);
      if (!el) continue;
      el.value = state.sliders[s.key];
      const valEl = $(s.valId);
      if (valEl) valEl.textContent = `${state.sliders[s.key]} / 100`;
      el.addEventListener('input', () => {
        const v = parseInt(el.value, 10);
        state.sliders[s.key] = isFinite(v) ? v : 50;
        if (valEl) valEl.textContent = `${state.sliders[s.key]} / 100`;
      });
    }
  }

  // ============================================================
  // SECTION: URL params
  // ============================================================

  function parseUrlParams() {
    const sp = new URLSearchParams(location.search);
    const seedStr = sp.get('seed');
    const seed = seedStr ? parseInt(seedStr, 10) : null;
    state.rng = makeRng(Number.isFinite(seed) ? seed : null);

    const dbg = sp.get('debug');
    state.debugMode = dbg === '1';
    if (state.debugMode) $('debug-panel').classList.add('show');

    const force = sp.get('forceAuction');
    if (force) state.forceAuction = force.split(',').map(s => s.trim()).filter(Boolean);
  }

  // ============================================================
  // SECTION: manifest load
  // ============================================================

  async function loadManifest() {
    // v9 패치: file:// 환경 대응 — MN9_MANIFEST 인라인 manifest 직접 사용
    // 비유: 이미 책상에 펼쳐진 카탈로그(manifest.js)가 있으면 외부에 가지러 가지 않고 그걸 씁니다.
    if (window.MN9_MANIFEST && window.MN9_MANIFEST.paintings) {
      // paintings 객체를 배열로 평탄화 (watercolor: [...], pointillism: [...] 형태)
      const all = window.MN9_MANIFEST.paintings;
      const list = Array.isArray(all) ? all : Object.values(all).flat();
      console.log('[v9] MN9_MANIFEST 인라인 사용:', list.length, '장');
      return list;
    }
    // fallback: fetch 시도 (HTTP 서버 환경)
    try {
      const res = await fetch(CONFIG.paintingsDir + 'manifest.json');
      if (!res.ok) throw new Error('no manifest');
      const j = await res.json();
      return j.paintings;
    } catch (e) {
      console.warn('manifest fetch 실패. fallback 사용.', e);
      return PAINTINGS_FALLBACK;
    }
  }


  // ============================================================
  // SECTION: self-test
  // ============================================================

  function runSelfTest() {
    const tests = [];
    function expect(name, cond) { tests.push({ name, ok: !!cond }); }

    expect('priceByPercent(100, -1) === 50', priceByPercent(100, -1) === 50);
    expect('priceByPercent(100, 1) === 200', priceByPercent(100, 1) === 200);
    // v8 패치 3 수정: 10% 근사로 바뀐 새 수치로 기댓값 업데이트
    expect('minTick(0) === 5', minTick(0) === 5);
    expect('minTick(199.9) === 10', minTick(199.9) === 10);
    expect('minTick(500) === 50', minTick(500) === 50);
    expect('minTick(2000) === 200', minTick(2000) === 200);
    expect('roundToTick(909) === 900', roundToTick(909) === 900);

    state.sliders = { ...CONFIG.sliderDefaults };
    expect('aggressionMul(50) === 1.0', Math.abs(aggressionMul() - 1.0) < 1e-6);
    expect('cpuMoneyMean(50) === 1500', Math.abs(cpuMoneyMean() - 1500) < 1e-6);

    // v6: P0-5 사이클 빌더 — 자유1등 평균이 2~3 사이
    let f1Total = 0;
    let cycles = 100;
    for (let i = 0; i < cycles; i++) {
      const rng = makeRng(i * 13 + 7);
      const c = buildCycle(rng);
      f1Total += c.filter(k => k === 'free10_1st').length;
    }
    const f1Avg = f1Total / cycles;
    expect(`자유1등 평균 ${f1Avg.toFixed(2)} (2~3 기대)`, f1Avg >= 2.0 && f1Avg <= 3.0);

    // v6: 사이클 모두 5개 라운드인지
    let allFive = true;
    for (let i = 0; i < 50; i++) {
      const c = buildCycle(makeRng(i + 9));
      if (c.length !== 5) { allFive = false; break; }
    }
    expect('사이클은 모두 5라운드', allFive);

    // v6: 라운드1은 항상 free10_1st
    let r1OK = true;
    for (let i = 0; i < 50; i++) {
      const c = buildCycle(makeRng(i + 33));
      if (c[0] !== 'free10_1st') { r1OK = false; break; }
    }
    expect('라운드1은 항상 free10_1st', r1OK);

    // v6: P0-4 CPU 자산 분포 — 부자/중산 보장
    {
      const rng = makeRng(42);
      const moneys = sampleCpuMoneys(rng, CONFIG.cpuMoneyDefault);
      const rich = moneys.filter(m => m >= 2000).length;
      const mid  = moneys.filter(m => m >= 800 && m < 2000).length;
      expect(`부자 보장 ${rich}명 (>=2)`, rich >= 2);
      expect(`중산 보장 ${mid}명 (>=1)`, mid >= 1);
      expect(`자산 범위 max ${Math.max(...moneys)}`, Math.max(...moneys) <= 5500);
    }

    // v6: P1-10 비밀경매 갭 풀 정상 (sum w ≈ 1)
    {
      let s = 0;
      for (const it of CONFIG.sealedGapPool) s += it.w;
      expect(`비밀경매 갭 풀 합 ${s.toFixed(2)} (≈1)`, Math.abs(s - 1.0) < 0.01);
    }

    // v6: WTH 신규 인격 정상
    expect('WTH 이모지=🦅', CONFIG.personaEmoji.WTH === '🦅');
    // v8 패치 2: v7 라벨로 검증값 변경 (WTH=관망형은 동일 유지)
    expect('WTH 한국어=관망형', CONFIG.personaNameKo.WTH === '관망형');
    expect('allPersonas 9개', CONFIG.allPersonas.length === 9);

    // v6: P1-8 ×10
    expect('fastForwardMul === 10', CONFIG.fastForwardMul === 10);

    // v8 패치 2: 한국어 인격 매핑 검증 — v7 라벨 기준
    expect('APP=시세형', CONFIG.personaNameKo.APP === '시세형');
    expect('MAN=광기형', CONFIG.personaNameKo.MAN === '광기형');

    // 자유경매 시뮬 — cooldown 모델
    const freeStats = runFreeAuctionSimulation(1000);
    expect(`자유경매 1000회 평균 종료 ${freeStats.avgEndSec.toFixed(1)}s (5~25 기대)`,
      freeStats.avgEndSec >= 5 && freeStats.avgEndSec <= 25);
    expect(`자유경매 5라운드 참여 CPU 평균 ${freeStats.avgR5Active.toFixed(1)} (>=2 기대)`,
      freeStats.avgR5Active >= 2.0);
    expect(`자유경매 사이클당 파산 평균 ${freeStats.avgBankruptPerCycle.toFixed(2)} (0.3~2 기대)`,
      freeStats.avgBankruptPerCycle >= 0.3 && freeStats.avgBankruptPerCycle <= 2.5);

    const ok = tests.filter(t => t.ok).length;
    const total = tests.length;
    console.log(`[v6 self-test] ${ok}/${total} pass`);
    for (const t of tests) {
      if (!t.ok) console.log(`  FAIL - ${t.name}`);
    }
    return ok === total;
  }

  // ============================================================
  // SECTION: v6 자유경매 시뮬 (cooldown 모델 + 5라운드 참여 + 파산)
  // ============================================================
  function runFreeAuctionSimulation(N) {
    const oldState = { ...state };
    let totalEndSec = 0;
    let totalR5Active = 0;
    let totalBankrupt = 0;
    let totalRounds = 0;

    for (let i = 0; i < N; i++) {
      const rng = makeRng(i * 31 + 11);
      state.rng = rng;
      state.sliders = { ...CONFIG.sliderDefaults };
      state.lastMaxJump = 0;
      state.cpuMoneyMean = CONFIG.cpuMoneyDefault;
      state.cpuTiltMemory = {};
      state.lastBidderId = null;
      state.round = 1;
      planExtremeRounds(rng);
      const extreme = isExtremeRound(state.round);
      const cpus = makeCpus(rng, state.round, extreme, CONFIG.cpuMoneyDefault);

      // 5라운드 참여 가능 CPU 카운트 (E 카테고리 $1000~$2000)
      const e_thresh = 1500;
      const r5Active = cpus.filter(c => !c.bankrupt && c.money >= e_thresh).length;
      totalR5Active += r5Active;

      // 자유경매 cooldown 시뮬 (simplified)
      const expCat = CONFIG.categories[0]; // round 1 = A
      const expected = expCat.min + rng.next() * (expCat.max - expCat.min);
      const startRatio = sampleStartRatio(rng, extreme);
      let currentPrice = roundToTick(expected * startRatio);
      if (currentPrice < 1) currentPrice = 1;

      let cooldownMs = CONFIG.freeHostCooldownMin + rng.next() * (CONFIG.freeHostCooldownMax - CONFIG.freeHostCooldownMin);
      let totalSec = 0;
      let lastBidderId = null;
      const stepMs = 100;
      const maxIterations = 600;  // 60초 한도
      for (let s = 0; s < maxIterations; s++) {
        totalSec += stepMs / 1000;
        cooldownMs -= stepMs;
        if (cooldownMs <= 0) break;
        // CPU 시도
        const active = cpus.filter(c => !c.retired && !c.bankrupt && c.id !== lastBidderId);
        if (active.length === 0) continue;
        // 매 1초마다 한 명 시도
        if (s % 10 !== 0) continue;
        const actor = active[Math.floor(rng.next() * active.length)];
        const jump = cpuJumpSteps(actor, rng, false, false, currentPrice, expected, null);
        let nextPrice = currentPrice;
        for (let j = 0; j < jump; j++) nextPrice += minTick(nextPrice);
        if (nextPrice <= currentPrice) continue;
        if (nextPrice > actor.money) {
          actor.skips++;
          if (actor.skips >= cpuRetireThreshold(actor)) actor.retired = true;
          continue;
        }
        const ratio = nextPrice / expected;
        if (ratio > actor.ceiling) continue;
        const ctx2 = { priceRatio: ratio, activeCpus: active, timerProgress: 0.5 };
        const prob = cpuActionProb(actor, ctx2);
        if (rng.next() < prob) {
          currentPrice = nextPrice;
          actor.money -= nextPrice * 0.1; // 가벼운 차감 (실제는 낙찰 시만)
          lastBidderId = actor.id;
          cooldownMs = CONFIG.freeHostCooldownMin + rng.next() * (CONFIG.freeHostCooldownMax - CONFIG.freeHostCooldownMin);
        } else {
          actor.skips++;
          if (actor.skips >= cpuRetireThreshold(actor)) actor.retired = true;
        }
      }
      totalEndSec += totalSec;
      const bankruptCount = cpus.filter(c => c.bankrupt).length;
      totalBankrupt += bankruptCount;
      totalRounds++;
    }
    Object.assign(state, oldState);
    return {
      avgEndSec: totalEndSec / totalRounds,
      avgR5Active: totalR5Active / totalRounds,
      avgBankruptPerCycle: totalBankrupt / totalRounds,
    };
  }

  // CPU 잔고 분포 시뮬
  function runCpuMoneySimulation(N) {
    const oldState = { ...state };
    const cycleMeans = [];
    let bankruptCount = 0;
    let totalCpus = 0;
    let allMoneys = [];
    for (let cy = 0; cy < N; cy++) {
      const rng = makeRng(cy * 41 + 17);
      state.rng = rng;
      state.sliders = { ...CONFIG.sliderDefaults };
      const cpus = makeCpus(rng, 1, false, CONFIG.cpuMoneyDefault);
      const moneys = cpus.map(c => c.money);
      const sum = moneys.reduce((a, b) => a + b, 0);
      cycleMeans.push(sum / moneys.length);
      for (const c of cpus) {
        totalCpus++;
        if (c.bankrupt) bankruptCount++;
        allMoneys.push(c.money);
      }
    }
    Object.assign(state, oldState);
    allMoneys.sort((a, b) => a - b);
    return {
      N,
      avgCycleMean: Math.round(cycleMeans.reduce((a, b) => a + b, 0) / cycleMeans.length),
      bankruptPct: ((bankruptCount / totalCpus) * 100).toFixed(2) + '%',
      min: allMoneys[0],
      p25: allMoneys[Math.floor(allMoneys.length * 0.25)],
      p50: allMoneys[Math.floor(allMoneys.length * 0.50)],
      p75: allMoneys[Math.floor(allMoneys.length * 0.75)],
      max: allMoneys[allMoneys.length - 1],
    };
  }

  // ============================================================
  // SECTION: entry
  // ============================================================

  async function main() {
    AUCTION_VARIANTS = buildAuctionVariants();
    parseUrlParams();
    bindInputs();
    state.paintings = await loadManifest();
    runSelfTest();
    if (state.debugMode) {
      console.log('[v6 자유경매 시뮬 1000회 — cooldown 모델]');
      const fs = runFreeAuctionSimulation(1000);
      console.log(fs);
      console.log('[v6 CPU 잔고 분포 시뮬 100 사이클]');
      const ms = runCpuMoneySimulation(100);
      console.log(ms);
      console.log('[v6 사이클 빌더 — 자유1등 분포 (100사이클)]');
      let count2 = 0, count3 = 0;
      for (let i = 0; i < 100; i++) {
        const c = buildCycle(makeRng(i * 17 + 5));
        const n = c.filter(k => k === 'free10_1st').length;
        if (n === 2) count2++; else if (n === 3) count3++;
      }
      console.log({ '자유1등 2번': count2, '자유1등 3번': count3 });
    }
    showScreen('screen-start');
  }

  // v9 패치: 자동 실행 제거 — bootForV9()으로만 시동
  // 비유: 예전엔 스크립트 로드만 해도 엔진이 켜졌지만
  //       이제는 총감독(game.js)이 직접 "켜" 신호를 줘야 작동합니다.
  // (원본 즉시실행 블록 주석 처리)
  // if (document.readyState === 'loading') {
  //   document.addEventListener('DOMContentLoaded', main);
  // } else {
  //   main();
  // }

  window.__AUCTION_V6_DEBUG__ = {
    state, CONFIG, priceByPercent, minTick, roundToTick, lerp,
    runSelfTest, buildCycle, makeRng,
    runFreeAuctionSimulation, runCpuMoneySimulation,
    sampleCpuMoney, sampleCpuMoneys,
    dynamicJumpSteps, cpuJumpSteps,
    HOST_LINES, pickHostLine, pickFlavorLine,
  };

  // v8 패치 5: enterAuction 함수를 v8 game.js에서 호출할 수 있게 전역 노출
  // 비유: 경매장 문지기 함수를 v8 총감독(game.js)이 부를 수 있게 명패를 달아두는 것
  // v8 패치 11: resetState도 함께 노출 — game.js 재진입 시 경매 시작 화면으로 되돌림
  // 비유: 경매장 문을 다시 열 때 내부를 깨끗이 청소해주는 리셋 버튼
  function resetState() {
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = 0; }
    showScreen('screen-start');
  }

  // v9 패치: 강제 부팅 진입점 — game.js가 화면 전환 후 직접 호출
  // 비유: 경매장 전원 스위치를 game.js 총감독이 직접 눌러주는 것
  //       DOMContentLoaded 이벤트를 기다리지 않고 바로 시동 걸기
  let _v9Booted = false;
  function bootForV9() {
    if (_v9Booted) return;  // 다중 호출 방지
    _v9Booted = true;
    main();
  }

  window.MN9_AuctionEngine = {
    enterAuction,
    state,
    resetState,
    bootForV9,
    resetForV9: function() { _v9Booted = false; },  // 재진입 시 리셋용
  };

})();
