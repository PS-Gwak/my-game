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
    cpuCount: 4,

    // 사회자 멘트 페이싱 (디렉터 사이클 #2: 동시 등장 + 과다 발사 해결)
    // 비유: 사회자가 메모 카드 손에 쥐고 800ms마다 한 장씩 읽음. "따라잡혔다"는 한 경매당 최대 4번.
    hostMsgIntervalMs: 800,        // 큐에서 한 줄씩 출력하는 최소 간격(ms). 디버그 슬라이더로 조절 가능
    rivalryCapPerAuction: 4,       // "따라잡혔다" 류 멘트 한 경매당 최대 발사 횟수
    rivalryBigJumpThreshold: 0.15, // 직전 가격 대비 +15% 이상 점프면 무조건 발사
    rivalrySmallJumpProb: 0.4,     // 작은 점프일 땐 40% 확률로만 발사

    // v11.04 멘트 확정안 (사용자 컨펌). 근거 약한 임계값은 여기서 조정.
    // WTH(왔다갔다형) 물러남/복귀 드라마 발동 조건 — 한 경매(라운드) 안에서만 발생, 매 경매 리셋.
    // 비유: 손님이 "두 번 이상 손 든 뒤 망설이는지 / 한참 쉬다 다시 손 드는지"를 사회자가 알아채는 기준선.
    wthMin: {
      bidsToDrama: 2,            // 물러남·복귀 멘트가 나오려면 이번 경매에서 최소 이만큼 입찰했어야 함
      retreatProgress: 0.40,    // 물러남 멘트 최소 경매 진행률 (40%)
      comebackProgress: 0.55,   // 복귀 멘트 최소 경매 진행률 (55%)
      retreatSilenceMs: 4200,   // 경쟁자가 앞선 뒤 WTH가 1사이클(쿨다운 주기) 무응답으로 볼 시간
      comebackSilenceMs: 8400,  // 복귀 판정 — 마지막 WTH 입찰 후 2사이클 이상 침묵
      retreatCheckEveryMs: 2500,// 물러남 멘트 재검사 최소 간격 (난사 방지)
      // v11.04 코드리뷰 2차 #2: "오래 1위였다 밀림" 드라마 게이트.
      // WTH가 1위(최고가)를 이 시간 이상 유지하다 밀렸을 때만 물러남·복귀 드라마 발동.
      // 4초 미만 유지 후 밀림은 침묵 시작(wthSilenceStartMs)을 기록하지 않아 멘트가 안 나옴.
      // 비유: 한참 선두를 지키던 손님이 밀려야 "어, 멈추시나요?"가 드라마가 되는 것.
      aheadMinMs: 4000,
    },

    // MSG-3 정적(교착) 멘트 — 마지막 입찰 후 이 시간 넘게 멘트 없으면 1회 발사
    silenceMentMs: 2000,

    // MSG-4 자유경매 마무리 정형 시퀀스 타이밍 (경고→망치→3·2·1, 각 줄 사이 간격)
    // 쿨다운이 자연 만료된 뒤(=모두 침묵) 시퀀스가 시작되고, 각 줄은 stepGapMs 간격으로 출력.
    closingSeq: {
      stepGapMs: 650,           // 경고·망치·카운트다운 각 줄 사이 간격 (0.5~0.8초 범위)
    },

    // MSG-6 "신중하시네요"(천천히) — 1:1 경쟁에서 추격자가 이 시간 이상 망설이면 발사
    takeYourTimeMs: 1500,
    // 1대1 클라이맥스: 나와 CPU 모두 같은 5초 모래시계를 쓴다.
    // 비유: 권투 링의 라운드 벨을 매번 같은 길이로 울려, 막판에도 규칙이 갑자기 빨라지지 않게 한다.
    duelTurnLimitMs: 5000,
    duelIntroPauseMs: 1300,
    // A안 2번: 내 차례 선택 제한시간(밀리초). 5초 안에 입찰/패스 안 하면 자동으로 패스 처리.
    userTurnLimitMs: 5000,

    categories: [
      { name: 'A', min: 100,  max: 200  },
      { name: 'B', min: 200,  max: 400  },
      { name: 'C', min: 300,  max: 600  },
      { name: 'D', min: 500,  max: 1000 },
      { name: 'E', min: 1000, max: 2000 },
    ],

    // v7: 기존 9인격 + FSP(불꽃 스프린터) + APP_ROP(줄다리기)
    // 디렉터 사이클 #5 (#3.5 콤보): MAN(광기형)·BLF(고객형) 비율 절반으로 (낙찰가 폭주 극단 케이스 감소).
    // 정규화는 assignPersonalities에서 자동 처리되므로 나머지 인격이 비례적으로 상승.
    personalityDistByRound: [
      { APP: 0.23, APP_ROP: 0.10, CON: 0.14, MAN: 0.02, BLF: 0.04, SHK: 0.04, TLT: 0.00, MIR: 0.13, SNI: 0.04, WTH: 0.07, FSP: 0.13 },
      { APP: 0.20, APP_ROP: 0.10, CON: 0.11, MAN: 0.04, BLF: 0.045, SHK: 0.08, TLT: 0.04, MIR: 0.08, SNI: 0.04, WTH: 0.08, FSP: 0.10 },
      { APP: 0.17, APP_ROP: 0.12, CON: 0.10, MAN: 0.04, BLF: 0.06, SHK: 0.08, TLT: 0.04, MIR: 0.08, SNI: 0.04, WTH: 0.08, FSP: 0.09 },
      { APP: 0.14, APP_ROP: 0.13, CON: 0.07, MAN: 0.08, BLF: 0.06, SHK: 0.08, TLT: 0.08, MIR: 0.04, SNI: 0.04, WTH: 0.08, FSP: 0.06 },
      { APP: 0.10, APP_ROP: 0.15, CON: 0.00, MAN: 0.10, BLF: 0.10, SHK: 0.08, TLT: 0.08, MIR: 0.04, SNI: 0.04, WTH: 0.07, FSP: 0.04 },
    ],

    extremeDist: { APP: 0.08, APP_ROP: 0.14, CON: 0.03, MAN: 0.13, BLF: 0.08, SHK: 0.08, TLT: 0.08, MIR: 0.04, SNI: 0.03, WTH: 0.06, FSP: 0.04 },

    // 디렉터 사이클 #5 (#4): 라운드 성격 3종. 매 라운드마다 분위기 태그가 붙음.
    // 비유: 같은 코스 요리 5접시를 다 비슷한 맛으로 내지 않고, 매운맛/담백/풍미 변주 주는 것.
    // 적용 방식: personalityBoost는 분포 가중치, startPriceMul은 시작가, hostCooldownMul은 사회자 호가 간격에 곱함.
    roundFlavors: {
      rush:     { label: '🔥 폭주', personalityBoost: { MAN: 1.8, FSP: 1.4, BLF: 1.3 },     startPriceMul: 0.85, hostCooldownMul: 0.7 },
      quiet:    { label: '😴 잠잠', personalityBoost: { CON: 1.8, WTH: 1.4, MIR: 1.3 },     startPriceMul: 1.00, hostCooldownMul: 1.4 },
      balanced: { label: '⚖️ 균형', personalityBoost: {},                                   startPriceMul: 1.00, hostCooldownMul: 1.0 },
    },

    personalities: {
      APP: {
        ceilingMean: 0.10, ceilingSigma: 0.30, ceilingClip: [-0.20, 1.50],
        probCurve: [[0.0, 0.70], [0.8, 0.70], [1.21, 0.50], [9999, 0.20]],
        retireThreshold: 3, jumpSteps: 1,
      },
      APP_ROP: {
        ceilingMean: 0.70, ceilingSigma: 0.18, ceilingClip: [0.50, 1.00],
        probCurve: [[0.0, 0.74], [1.0, 0.66], [1.55, 0.48], [2.0, 0.28], [9999, 0.10]],
        retireThreshold: 7, jumpSteps: 1,
      },
      CON: {
        ceilingFixedRatio: 1 / 1.1,
        probCurve: [[0.0, 0.40], [0.77, 0.40], [0.91, 0.15], [9999, 0.00]],
        retireThreshold: 1, jumpSteps: 1,
      },
      MAN: {
        // 디렉터 사이클 #5 hotfix v3 (Phase 3): 광기 천장 3.0 → 2.0 (낙찰가 6배 폭주 방지)
        ceilingFixedRatio: 2.0,
        probCurve: [[0.0, 0.80], [1.0, 0.80], [2.0, 0.60], [3.0, 0.40], [9999, 0.00]],
        retireThreshold: 5, jumpStepsRange: [2, 3],
      },
      BLF: {
        // 디렉터 사이클 #5 hotfix v3 (Phase 3): clip max 3.0 → 1.0 (천장 최대 4배 → 2배)
        ceilingMean: 0.50, ceilingSigma: 0.80, ceilingClip: [-0.10, 1.00],
        baseProb: 0.30, counterCpuBonus: 0.50, counterUserBonus: 0.70,
        counterDurationMs: 1000,
        checkRaiseAfterMs: 5000, checkRaiseProb: 0.80, checkRaiseJumpSteps: [2, 3],
        retireThreshold: 3, jumpSteps: 1,
      },
      SHK: {
        // 디렉터 사이클 #5 hotfix v3 (Phase 3): 잠복 천장 2.0 → 1.7
        ceilingFixedRatio: 1.7,
        baseProb: 0.25,
        burstTimerWindowLo: 0.30, burstTimerWindowHi: 0.50,
        burstChance: 0.30, burstJumpSteps: 3,
        retireThreshold: 4, jumpSteps: 1,
      },
      TLT: {
        // 디렉터 사이클 #5 hotfix v3 (Phase 3): tilted 천장 2.5 → 1.8
        ceilingNormalRatio: 1.10, ceilingTiltedRatio: 1.80,
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
      FSP: {
        ceilingFixedRatio: 1.45,
        earlyProb: 0.88,
        middleProb: 0.24,
        lateProb: 0.06,
        earlyJumpSteps: [2, 3],
        retireThreshold: 2, jumpSteps: 1,
      },
      // v7: 왔다갔다형. 입찰장을 완전히 떠나는 게 아니라, 문가에서 몇 번 빠졌다 들어오는 손님.
      // 디렉터 사이클 #6 (P1-6): 재진입 2~3 → 4~6으로 늘려서 "왔다갔다" 패턴 더 살림
      WTH: {
        ceilingFixedRatio: 1.55,
        baseProb: 0.10,
        reentryProb: 0.70,
        leaveProb: 0.45,
        minComebacks: 2,
        maxComebacks: 3,
        reentryCooldownMs: [1800, 4200],
        punchJumpSteps: [1, 2],
        retireThreshold: 6, jumpSteps: 1,
      },
    },

    // 디렉터 사이클 #3 (가1): 시작가가 예상가의 30~70% 사이에서 결정 (평균 50%).
    // 이전: 25%~150% (시작가가 예상가 넘는 비상식 케이스 발생) → 70% 상한으로 잡음.
    startPriceNormalMeanRatio: 1 / 2.0,    // 평균 50% (예상가 절반)
    startPriceNormalSigma: 0.50,
    startPriceClipRatio: [0.30, 0.70],     // 하한 30% / 상한 70%
    extremeRoundCountWeights: [{ count: 1, w: 0.5 }, { count: 2, w: 0.5 }],
    extremeLowChance: 0.30,
    extremeLowRatio: 1 / 4,            // 시작가 25% (낮은 출발)
    // 디렉터 사이클 #5 v2: 감정가 안 넘게 캡. 이전 [1.50, 3.00] (시작가 > 감정가 발생) → [0.55, 0.70].
    // 변주는 살리되 "시작가 ≤ 감정가" 룰 보존 — 일반(30~70%)과 비교해 약간 위쪽에 머무름.
    extremeHighRatioRange: [0.55, 0.70],

    playerFastBidMs: 5000,
    userFirstBidWindowMs: 1000,
    bigJumpStepsThreshold: 3,
    // 디렉터 사이클 #7: 속사포 오프닝 구간 길이 (경매 시작 후 이 시간 동안 빠른 연타 + 1단계 점프)
    sprintOpeningMs: 5000,

    auctionWeights: {
      fixed: 1.0, free10_1st: 1.0, free10_2nd: 0.5,
      candle_1st: 0.5, candle_2nd: 0.25, sealed: 1.0,
      limited_1st: 0.75, limited_2nd: 0.25, dutch: 0.8,
    },

    fixedCountdownByCategory: { A: 3000, B: 4000, C: 5000, D: 8000, E: 12000 },
    fixedTimerMs: 30000,
    // v11.04 확정안 AUC-1: 지정가 거래 — 그림 설명을 먼저 이만큼(3~5초) 들려준 뒤 카운트다운(3·2·1) 시작.
    // 카운트다운 진행 중에는 작품 설명 멘트를 쏘지 않음 (섞임 방지).
    fixedDescPhaseMs: 4000,
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
    // BUG-2 ③: 큰 갭(500/750/1000)은 거친 격자라 동일가 수렴 주범 → 가중치 ↓, 작은 갭(100/200) ↑.
    //   합은 ≈1.0 유지 (셀프테스트 비밀경매 갭 풀 합 검사 통과용).
    sealedGapPool: [
      { gap: 100,  w: 0.40 },
      { gap: 200,  w: 0.30 },
      { gap: 250,  w: 0.10 },
      { gap: 500,  w: 0.12 },
      { gap: 750,  w: 0.03 },
      { gap: 1000, w: 0.05 },
    ],

    dutchProbCurve: [
      [-1.0, 0.90], [-0.5, 0.80], [-0.25, 0.70], [0.0, 0.50],
      [0.5, 0.15], [1.0, 0.05], [2.0, 0.005],
    ],

    afterAuctionDelayMs: 2000,
    fastForwardMul: 10,   // v6: P1-8 ×4 → ×10
    auctionHardCapMs: 120000,
    flowStage: {
      sprintToContestMs: 15000,
      contestToClosingMs: 42000,
      sprintBidCount: 4,
      closingBidCount: 10,
      sprintPriceRatio: 0.72,
      closingPriceRatio: 1.08,
    },

    personaEmoji: {
      APP: '💼', APP_ROP: '🪢', CON: '🛡️', MAN: '🔥', BLF: '🎭',
      SHK: '🃏', TLT: '💢', MIR: '👯', SNI: '🎯',
      WTH: '↩️', FSP: '⚡',
    },
    personaNameKo: {
      // v8 패치 2: v6 인격 라벨 → v7 라벨 일괄 치환
      APP: '시세형', APP_ROP: '줄다리기형', CON: '절약형', MAN: '광기형', BLF: '고객형',
      SHK: '잠복형', TLT: '도박형', MIR: '추종형', SNI: '저격형',
      WTH: '왔다갔다형', FSP: '불꽃 스프린터',
    },
    allPersonas: ['APP', 'APP_ROP', 'CON', 'MAN', 'BLF', 'SHK', 'TLT', 'MIR', 'SNI', 'WTH', 'FSP'],

    cpuNamePool: [
      '모네집사', '피카소캣', '고흐상회', '다빈치냥 컬렉터', '소더비수염',
      '캔버스백작', '붓끝남작', '팔레트여사', '액자공작', '경매장단골',
      '미술상나비', '호가올리버', '망치소리킴', '도슨트루나', '작품사냥꾼',
      '샴고양이딜러', '루브르손님', '갤러리초코', '명화수집가밀크', '큐레이터치즈',
      '아틀리에밤비', '낙찰왕마로', '사인감정사', '캣워크화상',
    ],
    participantCats: {
      user: { name: '옐로', color: 'yellow', src: 'assets/cats/cat-yellow.png' },
      cpuOrder: [
        { name: '레드', color: 'red', src: 'assets/cats/cat-red.png' },
        { name: '블루', color: 'blue', src: 'assets/cats/cat-blue.png' },
        { name: '그린', color: 'green', src: 'assets/cats/cat-green.png' },
        { name: '블랙', color: 'black', src: 'assets/cats/cat-black.png' },
      ],
      fallback: { name: '핑크', color: 'pink', src: 'assets/cats/cat-pink.png' },
    },

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
      s4_ceilingSigma: 50, s5_cpuMoney: 50, s6_flowTiming: 50,
      s7_hostMsgPace: 50,
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
    cooldown_cpu: [
      // 멘트 정밀화 P2: 재촉 대상은 현재 1위가 아니라 추격해야 할 사람(prevBidderLabel).
      (ctx) => `📢 ${ctx.prevBidderLabel}, 다음 호가 가시겠습니까?`,
      (ctx) => `📢 다음은 ${ctx.fmt(ctx.nextPrice)}부터입니다.`,
      (ctx) => `📢 ${ctx.fmt(ctx.currentPrice)}, ${ctx.fmt(ctx.currentPrice)}, ${ctx.fmt(ctx.currentPrice)} — 더 없으십니까?`,
      (ctx) => `📢 다음 호가 ${ctx.fmt(ctx.nextPrice)} — 받으실 분 계신가요?`,
      // 긴장 곡선(항목 C): 추격자 지목 호가 안내 확장 (prevBidderLabel 사용).
      (ctx) => `📢 ${ctx.prevBidderLabel}, ${ctx.fmt(ctx.nextPrice)} 받으시겠습니까?`,
      (ctx) => `📢 ${ctx.prevBidderLabel}, 지금 ${ctx.fmt(ctx.currentPrice)}입니다. 따라오세요.`,
      (ctx) => `📢 ${ctx.prevBidderLabel}, 다음은 ${ctx.fmt(ctx.nextPrice)}입니다.`,
      (ctx) => `📢 ${ctx.prevBidderLabel}, 한 단계만 올리면 되십니다.`,
      (ctx) => `📢 ${ctx.prevBidderLabel}, ${ctx.fmt(ctx.nextPrice)} — 어떠십니까?`,
      (ctx) => `📢 ${ctx.prevBidderLabel}, 아직 늦지 않았습니다. ${ctx.fmt(ctx.nextPrice)}.`,
    ],
    cooldown_user: [
      (ctx) => `📢 다음 호가 ${ctx.fmt(ctx.nextPrice)} 받으시는 분?`,
      (ctx) => `📢 ${ctx.fmt(ctx.currentPrice)}, ${ctx.fmt(ctx.currentPrice)}, ${ctx.fmt(ctx.currentPrice)} — 더 없으십니까?`,
      () => `📢 더 부르실 분 안 계십니까?`,
      // 긴장 곡선(항목 C): 이름 없는 호가 안내·분위기 멘트 확장. 초반·무드별 대체 풀로 쓰임.
      (ctx) => `📢 다음은 ${ctx.fmt(ctx.nextPrice)}부터입니다.`,
      (ctx) => `📢 ${ctx.fmt(ctx.currentPrice)} 들어왔습니다. ${ctx.fmt(ctx.nextPrice)} 받습니다.`,
      (ctx) => `📢 ${ctx.fmt(ctx.nextPrice)}, 도전하실 분 계신가요?`,
      (ctx) => `📢 현재 ${ctx.fmt(ctx.currentPrice)}. 이 가격이면 끝인가요?`,
      () => `📢 깔끔한 숫자네요. 한 분 더 안 계십니까?`,
      (ctx) => `📢 ${ctx.fmt(ctx.currentPrice)}, 여기서 멈추기엔 아쉽습니다.`,
      (ctx) => `📢 자, ${ctx.fmt(ctx.nextPrice)} 받겠습니다. 손드세요.`,
      () => `📢 더 없으십니까? 한 번 더 여쭙겠습니다.`,
    ],
    counter_cpu: [
      // 멘트 정밀화 P2: 도발 대상은 추격해야 할 사람(prevBidderLabel) — 현재 1위에게 "따라오라"는 모순 제거.
      (ctx) => `📢 ${ctx.prevBidderLabel}, 관심 없으십니까?`,
      (ctx) => `📢 ${ctx.prevBidderLabel}, 지금 ${ctx.fmt(ctx.currentPrice)}입니다. 따라오시겠습니까?`,
      (ctx) => `📢 ${ctx.prevBidderLabel}, 한 번 더 가시죠?`,
      // 긴장 곡선(항목 C): 추격자 도발 확장 (prevBidderLabel 사용).
      (ctx) => `📢 ${ctx.prevBidderLabel}, 이대로 보내시겠습니까?`,
      (ctx) => `📢 ${ctx.prevBidderLabel}, 여기서 멈추시려고요?`,
      (ctx) => `📢 ${ctx.prevBidderLabel}, 방금 빼앗기셨는데 — 가만 계실 겁니까?`,
      (ctx) => `📢 ${ctx.prevBidderLabel}, 아쉽지 않으십니까?`,
      (ctx) => `📢 ${ctx.prevBidderLabel}, 한 방 남으셨죠?`,
      (ctx) => `📢 ${ctx.prevBidderLabel}, 지금 안 움직이면 끝납니다.`,
    ],
    counter_user: [
      // 멘트 정밀화 P2: 유저가 1위일 때도 도발 대상은 추격자(prevBidderLabel). 호출부에서 chaserIsActive() 게이트.
      (ctx) => `📢 ${ctx.prevBidderLabel}, 한 번 더 가시겠습니까?`,
      (ctx) => `📢 ${ctx.prevBidderLabel}, ${ctx.fmt(ctx.currentPrice)}에서 멈추시겠습니까? 한 번 더 기회 있습니다.`,
    ],
    rivalry: [
      (ctx) => `📢 ${ctx.targetLabel}, 따라잡혔습니다!`,
      (ctx) => `📢 ${ctx.targetLabel}, 역전당했습니다!`,
      (ctx) => `📢 ${ctx.targetLabel}, 방금 빼앗겼습니다.`,
      (ctx) => `📢 ${ctx.targetLabel}, 아쉽지만 지금은 다른 분의 것입니다.`,
      (ctx) => `📢 현재 ${ctx.actorLabel}이 리드하고 있습니다.`,
      (ctx) => `📢 ${ctx.actorLabel}, 다시 돌아왔네요!`,
      () => `📢 새로운 분이 끼어들었습니다!`,
      (ctx) => `📢 ${ctx.actorLabel}, 참전합니다!`,
    ],
    fair_warning: [
      () => `📢 마감 안내!`,
      () => `📢 모든 분께 마감 안내드립니다.`,
      () => `📢 마지막 기회입니다!`,
      () => `📢 진짜 마지막입니다.`,
      () => `📢 더 없으시면 마감합니다.`,
      () => `📢 자, 망치를 올립니다.`,
      (ctx) => `📢 ${ctx.lastBidderLabel}, 망치 올렸습니다. 마지막 기회예요.`,
    ],
    persuasion: [
      () => `📢 딱 한 번만 더.`,
      (ctx) => `📢 ${ctx.fmt(ctx.nextPrice)} 한번 가보실까요?`,
      () => `📢 이 급 작품이 또 나올까요? 솔직히 어렵습니다.`,
      () => `📢 지금 아니면 없습니다.`,
      () => `📢 좋은 작품인 거, 다들 아시잖아요.`,
      // 멘트 정밀화 P6: 후반 1:1에서만, 추격자 이름을 붙여 발사 (firing 게이트에서 별도 처리)
      (ctx) => `📢 ${ctx.prevBidderLabel}, 여기까지 오셨는데 진짜 한 번 더 안 하십니까?`,
      () => `📢 겁내지 마세요. 좋은 건 비싼 법이니까요.`,
      () => `📢 모두가 기다리고 있습니다. 편하게 결정하세요.`,
      // 긴장 곡선(항목 C): 이름 없는 일반 설득 멘트 확장 (idx 8~). PERSUASION_GENERIC_IDX에 추가됨.
      () => `📢 이 가격이면 남는 장사입니다.`,
      () => `📢 여기까지 왔으면 갈 데까지 가야죠.`,
      () => `📢 이건 돈이 있어도 다시 못 삽니다.`,
      () => `📢 평생에 한 번 올까 말까 한 기회입니다.`,
      (ctx) => `📢 ${ctx.fmt(ctx.nextPrice)} 하나만 더요.`,
      () => `📢 딱 한 단계만 더 가보시죠.`,
      () => `📢 다시 안 나옵니다. 이건 장담합니다.`,
    ],
    humor: [
      () => `📢 다들 숨 좀 쉬세요. 방금 건 좀 뜨거웠습니다.`,
      () => `📢 이 정도면 샴페인 터뜨려야 하는 거 아닙니까?`,
      () => `📢 아, 죄송합니다. 제가 좀 흥분했네요.`,
      () => `📢 거의 동시에 들어왔네요! 박빙입니다.`,
      (ctx) => `📢 ${ctx.actorLabel}, 입찰 센스가 좋으시네요. 경험자이신가요?`,
    ],
    dropout: [
      // 디렉터 사이클 #8: retire 시점에 즉시 출력되므로 '빠짐 확정' 톤으로 (재촉 문구 제거).
      (ctx) => `📢 ${ctx.actorLabel}, 여기서 물러나시는군요.`,
      (ctx) => `📢 ${ctx.actorLabel}, 수고하셨습니다.`,
      (ctx) => `📢 ${ctx.actorLabel} 빠집니다. 다음 기회에.`,
      (ctx) => `📢 ${ctx.actorLabel}, 여기까지군요.`,
      (ctx) => `📢 아쉽지만 ${ctx.actorLabel}, 다음을 기약하죠.`,
    ],
    sold: [
      (ctx) => `📢 ${ctx.fmt(ctx.currentPrice)}에 낙찰! 축하합니다!`,
      (ctx) => `📢 ${ctx.name}, 당신의 작품입니다. 축하드립니다!`,
      () => `📢 멋진 입찰이었습니다.`,
      () => `📢 낙찰자 축하드리고, 경쟁해 주신 모든 분 감사합니다.`,
      (ctx) => `📢 ${ctx.name}, 축하합니다. 끝까지 가신 보람이 있네요.`,
    ],
    transition: [
      // 디렉터 사이클 #8: 경매 진행 중 단계 상승(sprint→contest)에 발사됨. '다음 작품'·'서론' 같은 라운드 전환 문구 제거.
      () => `📢 자, 경쟁이 본격적으로 달아오릅니다.`,
      () => `📢 분위기가 한층 뜨거워졌습니다.`,
      () => `📢 슬슬 진짜 승부가 시작되는군요.`,
      () => `📢 호가에 가속이 붙습니다.`,
    ],
    rally: [
      () => `📢 불이 붙기 시작했네요!`,
      () => `📢 분위기가 뜨거워지고 있습니다.`,
      () => `📢 경쟁이 치열해지는군요.`,
      () => `📢 호가가 줄지어 나오고 있습니다!`,
      // v11.04 확정안 MSG-1: 흥분 고조 멘트 추가 (다양화 — 반복 체감 감소)
      () => `📢 결단이 빠르군요!`,
      () => `📢 망설임이 없습니다!`,
      () => `📢 한 발도 안 물러섭니다!`,
      () => `📢 속도가 붙고 있습니다!`,
      () => `📢 멈출 생각이 없어 보입니다.`,
      () => `📢 팽팽합니다, 팽팽해요.`,
      () => `📢 좀처럼 간격이 안 벌어지는군요.`,
      () => `📢 이 속도면 어디까지 갈지 모르겠습니다.`,
      () => `📢 오늘 이 경매, 기억하게 될 겁니다.`,
      () => `📢 물러설 기색이 없습니다!`,
    ],
    persona_man_big: [
      (ctx) => `📢 ${ctx.actorLabel} — 또 폭주가 시작됐습니다!`,
      (ctx) => `📢 ${ctx.actorLabel} ${ctx.fmt(ctx.currentPrice)}! 강력한 한 방입니다.`,
    ],
    // v11.04 확정안 MSG-6: persona_app_steady("신중하시네요") 폐기 — take_your_time로 이동.
    persona_app_rop: [
      (ctx) => `📢 ${ctx.actorLabel}, 한 단계씩 단단히 붙습니다.`,
      (ctx) => `📢 ${ctx.actorLabel}, 줄을 놓지 않네요.`,
    ],
    persona_fsp_sprint: [
      (ctx) => `📢 ${ctx.actorLabel}, 초반부터 불꽃처럼 달립니다!`,
      (ctx) => `📢 ${ctx.actorLabel}, 시작하자마자 속도를 올리네요.`,
    ],
    persona_tlt_gamble: [
      (ctx) => `📢 ${ctx.actorLabel} — 큰 판 노리는 분이 있네요.`,
      (ctx) => `📢 ${ctx.actorLabel} — 한 번에 크게 가네요!`,
    ],
    persona_shk_burst: [
      (ctx) => `📢 ${ctx.actorLabel} — 조용히 있다가 결국 끼어들었습니다!`,
    ],
    persona_blf_check: [
      (ctx) => `📢 ${ctx.actorLabel} — 한참 침묵하다 갑자기 한 방!`,
    ],
    persona_sni_snipe: [
      (ctx) => `📢 ${ctx.actorLabel} — 막판 저격이 들어왔습니다!`,
    ],
    // v11.04 확정안: WTH 물러남 풀 (이름 호명). WTH가 2회 이상 입찰 뒤 경쟁자에 밀리고 한동안 응수 안 할 때만.
    persona_wth_retreat: [
      (ctx) => `📢 ${ctx.actorLabel}, 여기서 멈추시나요?`,
      (ctx) => `📢 ${ctx.actorLabel}, 아직 안 빠지셨죠?`,
      (ctx) => `📢 ${ctx.actorLabel}, 한숨 돌리시는 건가요?`,
      (ctx) => `📢 ${ctx.actorLabel}, 여기까지인가요? 아니면 한 번 더?`,
    ],
    // 디렉터 사이클 #6 (P1-4): SNI(저격형)이 처음 입찰 시 — '늦둥이' 새 등장 환영
    persona_sni_first: [
      (ctx) => `📢 어, ${ctx.actorLabel}이 오셨군요!`,
      (ctx) => `📢 ${ctx.actorLabel}, 늦었지만 참전합니다!`,
      () => `📢 새로운 분이 끼어들었습니다!`,
      (ctx) => `📢 막판에 ${ctx.actorLabel}이 손 들었습니다!`,
    ],
    // v11.04 확정안: WTH 복귀 풀 (이름 호명). WTH가 2회 이상 입찰 + 2사이클+ 침묵 후 다시 입찰할 때만.
    persona_wth_return: [
      (ctx) => `📢 ${ctx.actorLabel}, 포기 안 하셨네요. 끝까지 가십니다!`,
      (ctx) => `📢 ${ctx.actorLabel}, 물러나는 줄 알았는데 — 다시 한 방!`,
      (ctx) => `📢 어, ${ctx.actorLabel}이 다시 들어오시네요!`,
    ],
    // 디렉터 사이클 #6: 기록 갱신 (낙찰가 신기록 등)
    record: [
      () => `📢 신기록입니다! 이 경매장 역대 최고가!`,
      (ctx) => `📢 와, ${ctx.fmt(ctx.currentPrice)}! 오늘 경매장 최고 기록입니다!`,
    ],
    free_start: [
      (ctx) => `📢 시작가 ${ctx.fmt(ctx.currentPrice)}으로 시작! 따라오실 분?`,
      (ctx) => `📢 ${ctx.fmt(ctx.currentPrice)}부터 시작합니다.`,
      (ctx) => `📢 자, ${ctx.fmt(ctx.currentPrice)}에서 문 엽니다. 빠르게 갑니다.`,
    ],
    // v11.04 확정안: 촛불 경매 전용 점등 멘트(🕯). free_start를 쓰면 🕯 점등 연출이 안 나오므로 분리.
    candle_start: [
      (ctx) => `🕯 촛불 점등! 시작가 ${ctx.fmt(ctx.currentPrice)}으로 시작합니다.`,
      (ctx) => `🕯 불을 붙입니다. ${ctx.fmt(ctx.currentPrice)}부터, 꺼지기 전에 부르세요!`,
      (ctx) => `🕯 촛불에 불이 들어왔습니다. ${ctx.fmt(ctx.currentPrice)}에서 시작!`,
    ],
    closing: [
      (ctx) => `📢 ${ctx.fmt(ctx.currentPrice)}, 마지막으로 부르실 분?`,
      (ctx) => `📢 더 부르실 분 안 계시면 ${ctx.fmt(ctx.currentPrice)}에 낙찰됩니다.`,
    ],
    bankrupt: [
      (ctx) => `📢 ${ctx.actorLabel}, 자금이 모자랍니다. 이번 경매에서는 빠집니다.`,
    ],

    // v11.04 확정안 MSG-3: 정적 멘트 (마지막 입찰 후 약 2초+ 멘트 없을 때, 이름 호명).
    // 주의: "모두가 기다리고 있습니다"는 지목형(다음 호가 가시겠습니까)보다 먼저 나와야 함 — 호출부에서 순서 보장.
    silence_ment: [
      (ctx) => `📢 ${ctx.prevBidderLabel}, 모두가 기다리고 있습니다. 편하게 결정하세요.`,
      () => `📢 경매장 전체가 숨을 죽이고 있군요.`,
      () => `📢 잠시 정적이 흐르네요.`,
      // 수정2(spotlight): "다들 {1위}만 보고 있습니다" — 현재 1위(lastBidderLabel) 지목. drain 시 1위 바뀌면 재렌더.
      (ctx) => `📢 다들 ${ctx.lastBidderLabel}만 보고 있습니다.`,
      () => `📢 고요합니다… 누가 이 침묵을 깰까요?`,
      (ctx) => `📢 ${ctx.prevBidderLabel}, 지금이 기회입니다.`,
      // 긴장 곡선(항목 C): 정적 멘트 확장. 이름 없는 분위기 + 추격자 지목 혼합.
      () => `📢 시간은 충분합니다. 천천히 결정하세요.`,
      () => `📢 숨소리까지 들리는군요.`,
      () => `📢 이 정적, 누군가 깨주시겠죠.`,
      (ctx) => `📢 ${ctx.prevBidderLabel}, 재고 계신 거죠?`,
      () => `📢 다들 신중하시네요. 좋습니다.`,
      (ctx) => `📢 ${ctx.prevBidderLabel}, 마음 정하셨습니까?`,
    ],

    // v11.04 확정안 MSG-5: "딱 한 번만 더" 대체 — 지목 추격자 대상에게만.
    chaser_more: [
      (ctx) => `📢 ${ctx.prevBidderLabel}, 한 번 더 도전해 보시죠?`,
      (ctx) => `📢 ${ctx.prevBidderLabel}, 거기서 멈추시려는 건 아니죠?`,
      (ctx) => `📢 ${ctx.prevBidderLabel}, 한 번 더 어떠세요?`,
      (ctx) => `📢 ${ctx.prevBidderLabel}, 한 단계만 더 올려보시겠습니까?`,
    ],

    // v11.04 확정안 MSG-6: "신중하시네요" 대체 — 1:1 경쟁에서 추격자가 망설일 때만 (이름 호명).
    take_your_time: [
      (ctx) => `📢 ${ctx.prevBidderLabel}, 천천히 생각하세요. 기다리겠습니다.`,
      (ctx) => `📢 ${ctx.prevBidderLabel}, 재고 계신 거죠?`,
      (ctx) => `📢 ${ctx.prevBidderLabel}, 여유롭게 가시는군요.`,
    ],

    // v11.04 확정안 MSG-4: 자유경매 마무리 정형 시퀀스 줄들 (경고 1회 + 망치 + 낙찰).
    // 카운트다운 3·2·1은 별도 라인으로 큐잉되므로 풀에 두지 않음.
    closing_warn: [
      () => `📢 마지막 기회입니다!`,
    ],
    closing_hammer: [
      () => `🔨 망치 올라갑니다!`,
    ],
    closing_sold: [
      (ctx) => `📢 ${ctx.fmt(ctx.currentPrice)}에 낙찰! ${ctx.name}, 축하합니다!`,
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
    usedPaintingIds: [],
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
    userLastBid: null,
    lastBidFlashId: null,
    lastBidFlashAt: 0,
    // 멘트 정밀화: 직전 1위(=방금 빼앗긴 추격자) id. setLastBidder로만 갱신.
    prevBidderId: null,
    // 멘트 정밀화: 낙찰/종료 확정 후 사회자 진행 멘트·입찰 차단 플래그 (N3)
    auctionResolved: false,
    fastForward: false,
    userTargetSteps: 1,
    lastMaxJump: 0,
    cpuMoneyMean: CONFIG.cpuMoneyDefault,
    _renderDirty: false,
    // 사회자 멘트 페이싱 (디렉터 사이클 #2): host 류 멘트는 큐로 받아 800ms마다 한 줄씩 출력
    hostQueue: [],
    lastHostEmitAt: 0,
    // 멘트 정밀화: 직전 배출 멘트 대분류 (연속 중복 스킵용)
    _lastDrainedCat: null,
    // 멘트 정밀화 N2: 직전 flavor(그림 설명) 문구 (연속 중복 방지)
    _lastFlavorLine: null,
    rivalryCount: 0,                // "따라잡혔다" 발사 횟수 (경매 시작 시 0으로 리셋)
    // 디렉터 사이클 #3: 현재 경매 시작가 (topbar·intermission UI 표시용)
    currentStartPrice: 0,
    // 디렉터 사이클 #5 (#4): 라운드 성격 — startCycle에서 5라운드 분량 미리 계획, nextRound에서 현재 라운드 성격 세팅
    roundFlavorPlan: [],            // 예: ['balanced','rush','balanced','quiet','balanced']
    currentFlavor: 'balanced',      // 'rush' | 'quiet' | 'balanced'
    // 디렉터 사이클 #6 (P1-2): 속사포 오프닝 — 새 라운드 시작 시각 기록 (rollCooldown이 첫 4초간 짧게 처리)
    roundStartMs: 0,
    // v6: P0-3 카운트다운 중 클릭 큐잉
    _pendingBuyClick: false,
    // 긴장 방향1: 순위 바와 낙찰 망치는 판정이 아니라 화면용 계기판이다.
    // 비유: 경매 진행표 옆에 붙은 전광판이라, 입찰 규칙 자체는 바꾸지 않는다.
    _rankBarLastOrder: [],
    lastSoldHammer: null,
    _soldHammerTimer: 0,
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

  function flowTimingMul() {
    const s = state.sliders.s6_flowTiming == null ? 50 : state.sliders.s6_flowTiming;
    if (s <= 50) return 0.65 + (s / 50) * 0.35;
    return 1.0 + ((s - 50) / 50) * 0.60;
  }

  function auctionFlowStage(elapsedMs, bidCount, priceRatio) {
    const mul = flowTimingMul();
    const flow = CONFIG.flowStage;
    const contestScore = [
      elapsedMs >= flow.sprintToContestMs * mul,
      bidCount >= flow.sprintBidCount,
      priceRatio >= flow.sprintPriceRatio,
    ].filter(Boolean).length;
    const closingScore = [
      elapsedMs >= flow.contestToClosingMs * mul,
      bidCount >= flow.closingBidCount,
      priceRatio >= flow.closingPriceRatio,
    ].filter(Boolean).length;
    if (closingScore >= 2) return 'closing';
    if (contestScore >= 2) return 'contest';
    return 'sprint';
  }

  function participantCatInfo(idOrCpu) {
    const id = (idOrCpu && typeof idOrCpu === 'object') ? idOrCpu.id : idOrCpu;
    if (id === 'user') return CONFIG.participantCats.user;
    const numericId = Number(id);
    if (Number.isFinite(numericId) && numericId > 0) {
      return CONFIG.participantCats.cpuOrder[numericId - 1] || CONFIG.participantCats.fallback;
    }
    return CONFIG.participantCats.fallback;
  }

  function participantCatIconHtml(idOrCpu, extraClass) {
    const cat = participantCatInfo(idOrCpu);
    const classes = ['participant-cat-icon', `cat-${cat.color}`];
    if (extraClass) classes.push(extraClass);
    return `<img class="${escapeHtmlForLog(classes.join(' '))}" src="${escapeHtmlForLog(cat.src)}" alt="${escapeHtmlForLog(cat.name)}">`;
  }

  function participantInlineHtml(idOrCpu, extraClass) {
    const cat = participantCatInfo(idOrCpu);
    const classes = ['participant-inline'];
    if (extraClass) classes.push(extraClass);
    return `<span class="${escapeHtmlForLog(classes.join(' '))}">${participantCatIconHtml(idOrCpu, 'participant-inline-icon')}<span class="participant-inline-name">${escapeHtmlForLog(cat.name)}</span></span>`;
  }

  function participantDisplayNames() {
    return CONFIG.participantCats.cpuOrder.concat([CONFIG.participantCats.user, CONFIG.participantCats.fallback]).map(c => c.name);
  }

  function cpuDisplayName(cpuOrId) {
    let cpu = cpuOrId;
    if (typeof cpuOrId === 'number') cpu = state.cpus.find(c => c.id === cpuOrId);
    if (!cpu) return '—';
    return cpu.displayName || `CPU${cpu.id}`;
  }

  function bidderDisplayName(id) {
    if (id === 'user') return participantCatInfo('user').name;
    if (typeof id === 'number') return cpuDisplayName(id);
    return '—';
  }

  // 멘트 정밀화 토대: 1위 갱신 헬퍼. 새 입찰자가 들어오면 이전 1위를 prevBidderId(추격자)로 보존.
  // 같은 사람이 또 부르면 prevBidderId는 유지(자기 자신을 추격자로 만들지 않음).
  function setLastBidder(id) {
    if (state.lastBidderId !== id) {
      state.prevBidderId = state.lastBidderId;
    }
    state.lastBidderId = id;
    state.lastBidFlashId = id;
    state.lastBidFlashAt = nowMs();
  }

  function bidPicketFlashClass(id) {
    const ageMs = nowMs() - (state.lastBidFlashAt || 0);
    return state.lastBidFlashId === id && ageMs >= 0 && ageMs <= 760 ? ' just-bid' : '';
  }

  // 멘트 정밀화 토대: 활성 CPU(retired·bankrupt 아닌) 수
  // v11.04 코드리뷰 2차 #4: wthIsAway(잠깐 자리 비운 WTH)도 참가자에서 제외.
  // 나간 동안엔 남은 둘이 1:1로 잡혀 take_your_time 등 1:1 멘트가 정상 발사된다.
  function activeCpuCount() {
    if (!state.cpus) return 0;
    return state.cpus.filter(c => !c.retired && !c.bankrupt && !c.wthIsAway).length;
  }

  // 멘트 정밀화 토대: 후반 판단 — 활성 CPU 3명 이하
  function isLateGame() {
    return activeCpuCount() <= 3;
  }

  // 항목 A(긴장 곡선): "이름 호명" 멘트 허용 게이트.
  //   후반(활성 CPU ≤ 3)이거나, 남은 참가자가 정확히 2명(1:1, 유저 포함)일 때만 이름을 부른다.
  //   초반(활성 CPU 4명+)에는 false → 호출부가 이름 없는 분위기·호가 안내로 대체.
  //   userGaveUp은 자유경매 루프 지역 변수라 인자로 받는다.
  function namedCallAllowed(userGaveUp) {
    return isLateGame() || (activeCpuCount() + (userGaveUp ? 0 : 1)) === 2;
  }

  // 멘트 정밀화: prevBidderId가 아직 활성(추격 가능)인지
  function chaserIsActive() {
    const id = state.prevBidderId;
    if (id == null) return false;
    if (id === 'user') return true;
    const c = state.cpus ? state.cpus.find(cc => cc.id === id) : null;
    // v11.04 코드리뷰 3차 #2: 잠깐 나간 WTH(wthIsAway)는 추격자 아님 (activeCpuCount와 동일 기준).
    //   안 그러면 나간 WTH에게 take_your_time·chaser_more·counter_* 멘트가 갈 수 있음.
    return !!(c && !c.retired && !c.bankrupt && !c.wthIsAway);
  }

  // v11.04 확정안 WTH 물러남 멘트 스캔 (두 자유경매 루프 공용).
  // 발동: WTH 이번 경매 입찰 ≥ wthMin.bidsToDrama AND 1위에서 밀린 시점부터 1사이클(retreatSilenceMs) 무응답
  //       AND 경매 진행률 ≥ retreatProgress. 한 WTH당 1회만, retreatCheckEveryMs 간격으로 재검사.
  // 비유: 두 번 이상 손 든 손님이 (방금이 아니라) 밀린 그 순간부터 한동안 잠잠하면 사회자가 "여기서 멈추시나요?" 하고 콕 집는 것.
  function wthDramaRetreatScan(cpus, elapsed, progress, fmtCtx) {
    const cfg = CONFIG.wthMin;
    if (progress < cfg.retreatProgress) return;
    for (const c of cpus) {
      if (c.type !== 'WTH' || c.retired || c.bankrupt || c.wthIsAway) continue;
      if (c.wthRetreatMentDone) continue;
      if (c.wthBidCount < cfg.bidsToDrama) continue;
      // 현재 1위면(아직 앞서면) 물러남 아님
      if (state.lastBidderId === c.id) continue;
      // 1위에서 밀린 시점이 기록돼 있어야 함 (마지막 입찰 시점이 아니라 "밀린 시점" 기준)
      if (c.wthSilenceStartMs < 0) continue;
      // 밀린 시점부터 1사이클(retreatSilenceMs) 이상 무응답인지
      if (elapsed - c.wthSilenceStartMs < cfg.retreatSilenceMs) continue;
      if (elapsed < c.wthRetreatScanAt) continue;
      c.wthRetreatScanAt = elapsed + cfg.retreatCheckEveryMs;
      c.wthRetreatMentDone = true;
      const line = pickHostLine('persona_wth_retreat', fmtCtx(c));
      if (line) logBid(line, 'host', false, { cat: 'persona', cpuId: c.id });
      return;
    }
  }

  // v11.04 확정안 WTH 복귀 멘트 발동 판정 (재입찰 직후 _placeBid에서 호출).
  // 조건: WTH 이번 경매 입찰 ≥ bidsToDrama AND "1위에서 밀려 침묵이 시작된 시점"(wthSilenceStartMs)부터
  //       comebackSilenceMs(2사이클+) 이상 침묵하다 재입찰 AND 진행률 ≥ comebackProgress.
  // 중요: 침묵 시간은 wthLastBidAt(복귀 직후 _wthScan에서 현재 시각으로 덮어써짐 — P5 가드)이 아니라
  //       wthSilenceStartMs(밀린 시점)로 잰다. 그래야 복귀 멘트가 실제로 나온다. (입찰 횟수 갱신 전 시점으로 판정.)
  function wthShouldFireReturn(cpu, prevBidCount, elapsed, progress) {
    const cfg = CONFIG.wthMin;
    if (!cpu || cpu.type !== 'WTH') return false;
    if (prevBidCount < cfg.bidsToDrama) return false;
    if (cpu.wthSilenceStartMs < 0) return false;
    if (elapsed - cpu.wthSilenceStartMs < cfg.comebackSilenceMs) return false;
    if (progress < cfg.comebackProgress) return false;
    return true;
  }

  function makeHostCtx(base) {
    const ctx = base || {};
    const lastId = ctx.lastBidderId != null ? ctx.lastBidderId : state.lastBidderId;
    const prevId = ctx.prevBidderId != null ? ctx.prevBidderId : state.prevBidderId;
    const actorCpu = ctx.actorCpu || (typeof ctx.actorId === 'number' ? state.cpus.find(c => c.id === ctx.actorId) : null);
    const targetCpu = ctx.targetCpu || (typeof ctx.targetId === 'number' ? state.cpus.find(c => c.id === ctx.targetId) : null);
    return {
      ...ctx,
      fmt: ctx.fmt || formatMoney,
      lastBidderLabel: ctx.lastBidderLabel || bidderDisplayName(lastId),
      // 멘트 정밀화: 추격자(직전 1위) 이름. cooldown 재촉 대상.
      prevBidderLabel: ctx.prevBidderLabel || bidderDisplayName(prevId),
      actorLabel: ctx.actorLabel || (actorCpu ? cpuDisplayName(actorCpu) : bidderDisplayName(ctx.actorId)),
      targetLabel: ctx.targetLabel || (targetCpu ? cpuDisplayName(targetCpu) : bidderDisplayName(ctx.targetId)),
      name: ctx.name || (targetCpu ? cpuDisplayName(targetCpu) : (actorCpu ? cpuDisplayName(actorCpu) : bidderDisplayName(lastId))),
    };
  }

  // ============================================================
  // SECTION: CPU personalities
  // ============================================================

  function assignPersonalities(rng, round, isExtreme) {
    let dist = isExtreme ? CONFIG.extremeDist : CONFIG.personalityDistByRound[round - 1];
    const shift = intensityShift();
    dist = applyIntensityShift(dist, shift);
    // 디렉터 사이클 #5 (#4): 라운드 성격에 따라 특정 인격에 가중치 곱하기
    // 비유: 폭주 라운드면 광기형 친구 등장 확률 2배, 잠잠 라운드면 절약형이 잘 등장.
    const flavorBoost = getCurrentFlavor().personalityBoost;
    if (flavorBoost && Object.keys(flavorBoost).length > 0) {
      const boosted = { ...dist };
      for (const k of Object.keys(flavorBoost)) {
        if (boosted[k] != null) boosted[k] = boosted[k] * flavorBoost[k];
      }
      dist = boosted;
    }
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
    const APP_ROP = dist.APP_ROP || 0;
    const TLT = dist.TLT || 0;
    const MIR = dist.MIR || 0;
    const SNI = dist.SNI || 0;
    const WTH = dist.WTH || 0;
    const FSP = dist.FSP || 0;
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
    return { APP, APP_ROP, CON, MAN, BLF, SHK, TLT, MIR, SNI, WTH, FSP };
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
        displayName: participantCatInfo(i + 1).name,
        type: types[i],
        skips: 0, retired: false, lastBid: null, hasBid: false, ceiling: 0,
        counterBonusUntil: 0, counterBonusValue: 0, lastActionAt: 0,
        tilted: state.cpuTiltMemory && state.cpuTiltMemory[i + 1] === 'lost',
        shkBurstUsed: false,
        wthActed: false,
        wthComebacksLeft: 0,
        wthAwayUntil: 0,
        wthIsAway: false,
        // 멘트 정밀화 P5: WTH 마지막 입찰 시각. 이탈 선언이 입찰 직후 나오지 않도록 _wthLeaveScan에서 사용.
        wthLastBidAt: -99999,
        wthLeaveCheckAt: 0,
        // v11.04 확정안 WTH 드라마 멘트용 (매 경매 makeCpus 재생성 → 자동 리셋).
        // wthBidCount: 이번 경매 WTH 입찰 횟수. wthRetreatMentDone: 물러남 멘트 1회 발사 여부.
        // wthRetreatScanAt: 물러남 멘트 재검사 가능 시각.
        // wthAheadSinceMs: 이 WTH가 1위가 된 시각(-1=현재 1위 아님). _placeBid에서 갱신.
        // wthSilenceStartMs: 이 WTH가 1위에서 밀려 침묵이 시작된 시각(-1=침묵 아님). 물러남·복귀 판정의 단일 기준.
        wthBidCount: 0,
        wthRetreatMentDone: false,
        wthRetreatScanAt: 0,
        wthAheadSinceMs: -1,
        wthSilenceStartMs: -1,
        money, bankrupt: money <= 0,
      };
      if (cpu.type === 'WTH') {
        const def = CONFIG.personalities.WTH;
        cpu.wthComebacksLeft = def.minComebacks + Math.floor(rng.next() * (def.maxComebacks - def.minComebacks + 1));
      }
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
    if (cpu.type === 'FSP') {
      if (ctx.flowStage === 'sprint') return def.earlyProb;
      if (ctx.flowStage === 'contest') return def.middleProb;
      if (ctx.flowStage === 'closing') return def.lateProb;
      return def.middleProb;
    }
    if (cpu.type === 'APP_ROP') {
      return lerp(ratio, def.probCurve);
    }
    if (cpu.type === 'WTH') {
      if (cpu.wthIsAway) return ctx.wthReentry ? def.reentryProb : 0;
      if (ctx.flowStage === 'sprint') return def.baseProb * 0.4;
      if (ctx.flowStage === 'closing') return def.baseProb * 1.8;
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
    // 디렉터 사이클 #7: 속사포 오프닝 — 경매 시작 직후엔 모든 입찰을 1단계(최소 금액)로 (착착착 쌓임)
    if (ctx && ctx.sprintOpening) return 1;
    if (cpu.type === 'APP_ROP') return 1;
    if (cpu.type === 'FSP') {
      if (ctx && ctx.flowStage === 'sprint') {
        const [lo, hi] = def.earlyJumpSteps;
        return lo + Math.floor(rng.next() * (hi - lo + 1));
      }
      return 1;
    }
    if (cpu.type === 'BLF' && isCheckRaise) {
      const [lo, hi] = def.checkRaiseJumpSteps;
      return lo + Math.floor(rng.next() * (hi - lo + 1));
    }
    if (cpu.type === 'SHK' && isShkBurst) {
      return def.burstJumpSteps;
    }
    // v7: WTH 복귀 입찰은 큰 망치질보다 "다시 끼어드는" 느낌을 우선한다.
    if (cpu.type === 'WTH' && ctx && ctx.wthReentry) {
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
        logBid(`${cpuDisplayName(target)} 광기형으로 변환 (유저 빠른 입찰).`, 'warn');
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
      logBid(`${cpuDisplayName(target)} 광기형으로 변환 (유저 즉시 입찰).`, 'warn');
    }
  }

  function onUserPassReaction(rng) {
    const apps = state.cpus.filter(c => c.type === 'APP' && !c.retired && !c.bankrupt);
    if (apps.length > 0) {
      const target = rng.pick(apps);
      target.type = 'CON';
      target.ceiling = sampleCpuCeiling(target, rng);
      logBid(`${cpuDisplayName(target)} 절약형으로 변환 (유저 패스).`, 'sys');
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

  // 멘트 정밀화 P4: actorCpu = 방금 큰 점프한 본인. 변환 대상이 본인과 같으면 경고 멘트 숨김(중복).
  function onLargeJump(rng, jumpSteps, actorCpu) {
    if (jumpSteps < CONFIG.bigJumpStepsThreshold) return;
    const shks = state.cpus.filter(c => c.type === 'SHK' && !c.retired && !c.bankrupt);
    if (shks.length > 0) {
      const target = rng.pick(shks);
      target.type = 'MAN';
      target.ceiling = sampleCpuCeiling(target, rng);
      // 변환 대상이 방금 점프한 본인과 다를 때만 경고 멘트 출력 (같으면 중복이라 숨김).
      if (!(actorCpu && target.id === actorCpu.id)) {
        logBid(`${cpuDisplayName(target)} 광기형으로 변환 (큰 호가 점프).`, 'warn');
      }
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
    let ratio;
    if (isExtreme) {
      if (rng.next() < CONFIG.extremeLowChance) ratio = CONFIG.extremeLowRatio;
      else ratio = rng.rangeFloat(CONFIG.extremeHighRatioRange[0], CONFIG.extremeHighRatioRange[1]);
    } else {
      ratio = rng.clipped(
        CONFIG.startPriceNormalMeanRatio,
        CONFIG.startPriceNormalSigma,
        CONFIG.startPriceClipRatio[0],
        CONFIG.startPriceClipRatio[1]
      );
    }
    // 디렉터 사이클 #5 (#4): 라운드 성격이 폭주면 시작가 약간 낮춤 (호가 올릴 여유 ↑)
    const mul = getCurrentFlavor().startPriceMul;
    if (typeof mul === 'number' && mul !== 1.0) ratio = ratio * mul;
    return ratio;
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
      if (!state._recentHostKeys.includes(fullKey) || attempts >= 7) {
        chosen = { line: pool[idx], key: fullKey };
        break;
      }
      attempts++;
    } while (attempts < 12);
    if (!chosen) {
      const idx = Math.floor(state.rng.next() * pool.length);
      chosen = { line: pool[idx], key: `${keyGroup}:${idx}` };
    }
    state._recentHostKeys.push(chosen.key);
    // 항목 C: 같은 라운드 안 중복 금지 링버퍼 (최근 7개 기억). 라운드 전환 시 nextRound에서 초기화.
    if (state._recentHostKeys.length > 7) state._recentHostKeys.shift();
    return chosen.line(ctx);
  }

  // 항목 수정2: 멘트 종류별 재렌더/폐기를 위해 "뽑힌 템플릿 함수"까지 함께 돌려주는 변형.
  //   pickHostLine과 동일한 라운드 중복 회피 로직을 쓰되, { text, fn } 를 반환한다.
  //   spotlight(재렌더)·chaser(폐기) 호명 멘트 발사부에서만 사용.
  function pickHostLineEx(keyGroup, ctx) {
    const pool = HOST_LINES[keyGroup];
    if (!pool || pool.length === 0) return null;
    let attempts = 0;
    let chosen;
    do {
      const idx = Math.floor(state.rng.next() * pool.length);
      const fullKey = `${keyGroup}:${idx}`;
      if (!state._recentHostKeys.includes(fullKey) || attempts >= 7) {
        chosen = { fn: pool[idx], key: fullKey };
        break;
      }
      attempts++;
    } while (attempts < 12);
    if (!chosen) {
      const idx = Math.floor(state.rng.next() * pool.length);
      chosen = { fn: pool[idx], key: `${keyGroup}:${idx}` };
    }
    state._recentHostKeys.push(chosen.key);
    if (state._recentHostKeys.length > 7) state._recentHostKeys.shift();
    return { text: chosen.fn(ctx), fn: chosen.fn };
  }

  // 항목 C 보강: 인덱스 제한 풀도 같은 라운드 중복 방지 링버퍼를 탄다.
  // 비유: "이 줄들 중에서만 골라"라고 해도, 방금 한 말을 또 하지 않도록 같은 장부를 같이 본다.
  function pickHostLineFromIndexesEx(keyGroup, indexes, ctx) {
    const pool = HOST_LINES[keyGroup];
    if (!pool || pool.length === 0) return null;
    const validIndexes = (indexes || []).filter(i => pool[i]);
    if (validIndexes.length === 0) return pickHostLineEx(keyGroup, ctx);

    let attempts = 0;
    let chosen;
    do {
      const idx = validIndexes[Math.floor(state.rng.next() * validIndexes.length)];
      const fullKey = `${keyGroup}:${idx}`;
      if (!state._recentHostKeys.includes(fullKey) || attempts >= 7) {
        chosen = { fn: pool[idx], key: fullKey };
        break;
      }
      attempts++;
    } while (attempts < 12);

    if (!chosen) {
      const idx = validIndexes[Math.floor(state.rng.next() * validIndexes.length)];
      chosen = { fn: pool[idx], key: `${keyGroup}:${idx}` };
    }
    state._recentHostKeys.push(chosen.key);
    if (state._recentHostKeys.length > 7) state._recentHostKeys.shift();
    return { text: chosen.fn(ctx), fn: chosen.fn };
  }

  function pickHostLineFromIndexes(keyGroup, indexes, ctx) {
    const ex = pickHostLineFromIndexesEx(keyGroup, indexes, ctx);
    return ex ? ex.text : null;
  }

  // 멘트 정밀화 P6: persuasion 풀에서 "여기까지 오셨는데 한 번 더"(index 5)는 후반 1:1 전용 → 일반 호출에선 제외.
  // v11.04 확정안: idx0("딱 한 번만 더" — MSG-5로 폐기)·idx8("모두가 기다리고" — MSG-3 silence_ment로 이동)도 일반 풀에서 제외.
  const PERSUASION_GENERIC_IDX = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  // 항목 A 보강: 초반 정적 멘트는 이름 없는 줄만 사용. 후반/1:1일 때만 spotlight/chaser 호명 줄을 허용.
  const SILENCE_GENERIC_IDX = [1, 2, 4, 6, 7, 8, 10];
  function pickPersuasionGeneric(ctx) {
    return pickHostLineFromIndexes('persuasion', PERSUASION_GENERIC_IDX, ctx);
  }

  // 항목 수정2: silence_ment 안에서 "다들 {1위}만 보고 있습니다" 한 줄만 1위 지목형(spotlight).
  //   이 함수만 leaderAtIssue 기준 재렌더 대상. 나머지(추격자 지목·이름없는)는 일반/추격자 취급.
  const SPOTLIGHT_SILENCE_FN = HOST_LINES.silence_ment[3];
  // silence_ment 안에서 prevBidderLabel(추격자)을 부르는 줄들 (구도 깨지면 폐기 대상).
  const CHASER_SILENCE_FNS = [
    HOST_LINES.silence_ment[0], HOST_LINES.silence_ment[5],
    HOST_LINES.silence_ment[9], HOST_LINES.silence_ment[11],
  ];

  // 항목 수정2: 뽑힌 silence_ment 라인 함수(fn)에 맞는 meta를 만든다.
  //   spotlight 줄 → role:'spotlight' + render(재렌더용). 추격자 줄 → role:'chaser'. 그 외 → 일반(meta 없음).
  function silenceMentMeta(fn) {
    if (fn === SPOTLIGHT_SILENCE_FN) {
      return { role: 'spotlight', render: fn, leaderAtIssue: state.lastBidderId };
    }
    if (CHASER_SILENCE_FNS.indexOf(fn) >= 0) {
      return { role: 'chaser', chaserAtIssue: state.prevBidderId, leaderAtIssue: state.lastBidderId };
    }
    return null;
  }

  // 항목 수정2: 추격자(prevBidderLabel)를 실제로 호명하는 라인 함수만 식별.
  //   probe: 추격자/1위 라벨에 고유 센티넬을 넣고 렌더 → 추격자 센티넬이 들어간 라인만 chaser 취급.
  //   cooldown_cpu처럼 이름 줄·이름없는 줄이 섞인 풀에서, 이름없는 줄을 잘못 폐기하지 않게 한다.
  const CHASER_LINE_FNS = (function () {
    const set = new Set();
    const probe = { fmt: (n) => '$' + n, currentPrice: 1, nextPrice: 1,
      prevBidderLabel: 'CHASER', lastBidderLabel: 'LEADER',
      actorLabel: 'A', targetLabel: 'T', name: 'N', lastBidderId: null };
    const groups = ['counter_cpu', 'cooldown_cpu', 'counter_user', 'chaser_more', 'take_your_time'];
    for (const g of groups) {
      for (const fn of (HOST_LINES[g] || [])) {
        let s = '';
        try { s = fn(probe); } catch (e) { s = ''; }
        if (s.indexOf('CHASER') >= 0) set.add(fn);
      }
    }
    return set;
  })();

  // 항목 수정2: 추격자 1:1 재촉 멘트(counter_*·chaser_more·take_your_time·cooldown_cpu 지목줄)용 meta.
  //   push 당시 추격자(prevBidderId)·1위(lastBidderId)를 박아, drain 때 구도 깨졌으면 폐기되게 한다.
  //   fn이 실제로 추격자를 호명하는 줄일 때만 chaser meta. 이름없는 줄이면 null(일반 멘트).
  function chaserMetaFor(fn) {
    if (!CHASER_LINE_FNS.has(fn)) return null;
    return { role: 'chaser', chaserAtIssue: state.prevBidderId, leaderAtIssue: state.lastBidderId };
  }

  // v6: 그림 설명 멘트 1개 뽑기 (카테고리별)
  // 멘트 정밀화 N2: 직전 문구를 후보에서 완전 제외한 풀에서 뽑음 (연속 중복 100% 차단). 후보가 1개뿐이면 그대로.
  function pickFlavorLine(painting) {
    if (!painting) return null;
    const cat = painting.category || 'C';
    const pool = CONFIG.paintingFlavorByCategory[cat] || CONFIG.paintingFlavorByCategory.C;
    const candidates = pool.filter(line => line !== state._lastFlavorLine);
    const pick = state.rng.pick(candidates.length > 0 ? candidates : pool);
    state._lastFlavorLine = pick;
    return pick;
  }

  // 인격 타입 → host 키 그룹 매핑 (큰 액션 시)
  function personaHostKey(type, isCheckRaise, isShkBurst, isSnipe, isWthLate) {
    if (isCheckRaise) return 'persona_blf_check';
    if (isShkBurst) return 'persona_shk_burst';
    if (isSnipe) return 'persona_sni_snipe';
    // 디렉터 사이클 #6 (P1-4): isWthLate은 'WTH 막판 복귀' — 환영 멘트 발사. persona_wth_late보다 의미 명확.
    if (isWthLate) return 'persona_wth_return';
    if (type === 'MAN') return 'persona_man_big';
    if (type === 'TLT') return 'persona_tlt_gamble';
    if (type === 'FSP') return 'persona_fsp_sprint';
    if (type === 'APP_ROP') return 'persona_app_rop';
    // v11.04 확정안 MSG-6: APP 입찰 시 "신중하시네요"(persona_app_steady) 자동 발동 폐기 → take_your_time(1:1 망설임)으로 대체.
    return null;
  }

  // ============================================================
  // SECTION: auctions — 공통 유틸
  // ============================================================

  // 디렉터 사이클 #7: 점검용 누적 로그 (화면 bidLog와 별개 — 안 지워지고 상한 없음. 비딩·멘트 순서 점검용)
  let inspectionLog = [];
  let inspectionGameNo = 0;

  // 멘트 정밀화: logBid(text, kind, immediate, meta).
  //   meta = { cat, cpuId, leaderAtIssue, role, chaserAtIssue, render } — 큐 배출 직전 검증 게이트(drainHostQueue)에서 사용.
  //   cat: 'rivalry' | 'cooldown' | 'persona' | 'dropout' 등 대분류 (연속 중복 스킵용)
  //   cpuId: 멘트 대상 CPU id (retired면 일부 멘트 스킵)
  //   leaderAtIssue: push 시점 1위(lastBidderId). 배출 시 현재 1위와 다르면 rivalry류 폐기.
  //   항목 수정2(선입력 버그) 추가 필드 — 호명 멘트에만 실음:
  //   role: 'spotlight'(1위 지목 — 1위 바뀌면 재렌더) | 'chaser'(추격자 1:1 재촉 — 구도 깨지면 폐기)
  //   chaserAtIssue: push 당시 추격자(state.prevBidderId). chaser 폐기 판정용.
  //   render: (ctx)=>string. 해당 멘트의 원래 라인 함수. spotlight 재렌더용.
  function logBid(text, kind, immediate, meta) {
    // 디렉터 사이클 #2: host 류 멘트는 큐로 보내서 800ms마다 한 줄씩 출력. 입찰 로그·sys는 즉시.
    // 디렉터 사이클 #8: immediate=true면 큐 우회 즉시 출력 (dropout 등 타이밍이 중요한 멘트용)
    if (!immediate && kind && typeof kind === 'string' && kind.indexOf('host') === 0) {
      // 멘트 정밀화 N3: 낙찰/종료 확정 후엔 진행 멘트를 큐에 더 넣지 않음 ('host cd' 낙찰 멘트는 immediate로 우회).
      if (state.auctionResolved) return;
      state.hostQueue.push({ text, kind, meta: meta || null });
      // 디렉터 사이클 #8: 큐 상한 — 너무 쌓이면 오래된 멘트 드롭 (멘트 폭주·이중발사 방지)
      if (state.hostQueue.length > 4) state.hostQueue.shift();
      state._renderDirty = true;
      return;
    }
    state.bidLog.push({ text, kind: kind || 'sys', t: Date.now() });
    if (state.bidLog.length > 200) state.bidLog.shift();
    // 디렉터 사이클 #7: 점검용 로그에도 (host는 위에서 return되므로 여기는 cpu/user/sys/warn만)
    inspectionLog.push({ kind: kind || 'sys', text, t: Date.now() });
    state._renderDirty = true;
  }

  // 사회자 큐에서 한 줄 꺼내 화면 로그에 꽂기 (시간 간격 충족 시 + 검증 게이트)
  function drainHostQueue() {
    if (!state.hostQueue || state.hostQueue.length === 0) return;
    const now = Date.now();
    const intervalMs = getHostMsgIntervalMs();
    if (now - (state.lastHostEmitAt || 0) < intervalMs) return;

    // 멘트 정밀화: 배출 직전 검증 게이트 — 상황이 변한 굳은 멘트는 폐기하고 다음 후보로.
    // 무한 폐기 방지를 위해 큐 한 바퀴(최대 길이)만 검사.
    let msg = null;
    let guard = state.hostQueue.length;
    while (guard-- > 0 && state.hostQueue.length > 0) {
      const cand = state.hostQueue.shift();
      const meta = cand.meta;
      if (meta) {
        // P1: rivalry는 push 당시 1위(leaderAtIssue)가 지금도 1위가 아니면 이미 상황이 바뀐 것 → 폐기
        if (meta.cat === 'rivalry' && meta.leaderAtIssue != null
            && meta.leaderAtIssue !== state.lastBidderId) {
          continue;
        }
        // 항목 수정2(선입력 버그): 호명 멘트 종류별 분기.
        //   role==='spotlight'(1위 지목, 예: "다들 {X}만 보고 있습니다"):
        //     drain 시점에 1위가 바뀌었으면(=leaderAtIssue ≠ 현재 1위) 현재 1위 이름으로 재렌더해 출력(폐기 아님).
        if (meta.role === 'spotlight' && typeof meta.render === 'function'
            && meta.leaderAtIssue != null && meta.leaderAtIssue !== state.lastBidderId) {
          try { cand.text = meta.render(makeHostCtx({})); } catch (e) { /* 렌더 실패 시 굳은 텍스트 유지 */ }
        }
        //   role==='chaser'(추격자 1:1 재촉, 예: counter_*·chaser_more·take_your_time):
        //     추격 구도가 깨졌으면(추격자가 바뀜 OR 1위가 또 바뀜) 폐기. 엉뚱한 사람 부르는 것 방지.
        if (meta.role === 'chaser'
            && ((meta.chaserAtIssue != null && state.prevBidderId !== meta.chaserAtIssue)
                || (meta.leaderAtIssue != null && meta.leaderAtIssue !== state.lastBidderId))) {
          continue;
        }
        // 대상 CPU가 이미 빠졌으면(dropout 확정 멘트 제외) 폐기
        if (meta.cpuId != null && meta.cat !== 'dropout') {
          const tc = state.cpus ? state.cpus.find(c => c.id === meta.cpuId) : null;
          if (tc && (tc.retired || tc.bankrupt)) continue;
        }
        // P4·문제6: 직전 배출 멘트와 같은 대분류면 1회 스킵 (rivalry/persona 연달아 방지)
        if (meta.cat && state._lastDrainedCat && meta.cat === state._lastDrainedCat
            && (meta.cat === 'rivalry' || meta.cat === 'persona')) {
          continue;
        }
      }
      msg = cand;
      break;
    }
    if (!msg) return;

    state._lastDrainedCat = (msg.meta && msg.meta.cat) || null;
    state.bidLog.push({ text: msg.text, kind: msg.kind, t: now });
    if (state.bidLog.length > 200) state.bidLog.shift();
    // 디렉터 사이클 #7: 점검용 로그 — 사회자 멘트는 실제 화면 출력 시점에 기록 (출력 순서 점검)
    inspectionLog.push({ kind: msg.kind, text: msg.text, t: now });
    state.lastHostEmitAt = now;
    state._renderDirty = true;
  }

  // 디버그 슬라이더 7 값(0~100)을 200~1400ms로 매핑. 슬라이더 없으면 CONFIG 기본값.
  function getHostMsgIntervalMs() {
    const s = state.sliders && state.sliders.s7_hostMsgPace;
    if (typeof s === 'number') return Math.max(100, 200 + s * 12);
    return CONFIG.hostMsgIntervalMs;
  }

  // 디렉터 사이클 #5 (#4): 라운드 성격 plan/helper
  // 5라운드 분량 분위기 배열을 만든다. 균형 2~3, 폭주 1~2, 잠잠 1~2.
  function planRoundFlavors(rng) {
    const n = CONFIG.categories.length; // 5
    const slots = [];
    slots.push('rush');
    slots.push('quiet');
    while (slots.length < n) slots.push('balanced');
    return rng.shuffle(slots);
  }

  // 현재 라운드 성격 객체 반환 (없으면 balanced)
  function getCurrentFlavor() {
    const key = state.currentFlavor || 'balanced';
    return CONFIG.roundFlavors[key] || CONFIG.roundFlavors.balanced;
  }

  // 항목 B(무드별 사회자 색깔): 현재 라운드 무드에 따른 멘트 결 파라미터.
  //   rush(폭주): 호명·긴박 비중↑, flavor(작품설명) 비중↓ → counterProb↑, flavorMul↑(간격 길게=설명 덜).
  //   quiet(잠잠): 작품설명↑, 호명 자제 → counterProb↓, flavorMul↓(간격 짧게=설명 더).
  //   balanced: 현행 그대로.
  //   counterProb = 추격자 도발/호명 멘트를 고를 확률(기존 0.4 기준 변주).
  //   flavorIntervalMul = 다음 flavor 멘트까지 간격에 곱함(>1=설명 뜸하게, <1=잦게).
  function getFlavorMood() {
    const key = state.currentFlavor || 'balanced';
    if (key === 'rush')  return { counterProb: 0.55, flavorIntervalMul: 1.6 };
    if (key === 'quiet') return { counterProb: 0.25, flavorIntervalMul: 0.6 };
    return { counterProb: 0.4, flavorIntervalMul: 1.0 };
  }

  // "따라잡혔다" 류 발사 판정: 경매당 cap + 점프 크기 별 확률
  function shouldFireRivalry(prevPrice, newPrice, rng) {
    if (state.rivalryCount >= CONFIG.rivalryCapPerAuction) return false;
    const jumpRatio = prevPrice > 0 ? (newPrice - prevPrice) / prevPrice : 0;
    const prob = jumpRatio >= CONFIG.rivalryBigJumpThreshold ? 1.0 : CONFIG.rivalrySmallJumpProb;
    const r = (rng && typeof rng.next === 'function') ? rng.next() : Math.random();
    if (r >= prob) return false;
    state.rivalryCount++;
    return true;
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
    // v11.04 확정안 AUC-1: 그림 설명 단계 — 이 시간 동안만 작품 설명을 들려주고, 끝나면 카운트다운 시작.
    let descPhaseMs = CONFIG.fixedDescPhaseMs;
    let descPhaseDone = false;

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
        // v11.04 확정안 AUC-1: 1단계 = 그림 설명만 (카운트다운 정지). 2단계 = 카운트다운만 (설명 정지).
        if (!descPhaseDone) {
          shoutTimerMs -= dt;
          if (shoutTimerMs <= 0 && shouts.length > 0) {
            logBid(shouts.shift(), 'host');
            const interval = catName === 'E' ? 1800 : (catName === 'D' ? 1500 : (catName === 'C' ? 1300 : (catName === 'B' ? 1200 : 1100)));
            shoutTimerMs = interval;
          }
          descPhaseMs -= dt;
          if (descPhaseMs <= 0) {
            descPhaseDone = true;
            logBid('📢 자, 이제 카운트다운 들어갑니다!', 'host');
          }
          return;
        }
        if (!countdownDone) {
          countdownMs -= dt;
          const sec = Math.ceil(countdownMs / 1000);
          if (sec !== lastCountdownSec && sec > 0) {
            lastCountdownSec = sec;
            if (sec <= 3) logBid(`📢 ${sec}…`, 'host cd');
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
          let p = cpuActionProb(c, { priceRatio: ratio, activeCpus, flowStage: 'contest' }) * aggressionMul();
          if (rng.next() < p) {
            over = true;
            winner = c.id;
            c.hasBid = true;
            c.lastBid = price;
            setLastBidder(c.id);
            logBid(`${cpuDisplayName(c)} ${CONFIG.personaEmoji[c.type]} 가 ${formatMoney(price)} 에 구매.`, 'cpu');
            const sold = pickHostLine('sold', makeHostCtx({ currentPrice: price, name: cpuDisplayName(c) }));
            logBid(sold || `📢 ${formatMoney(price)}에 낙찰! 축하합니다!`, 'host cd');
            triggerBLFCounter('cpu');
            return;
          } else {
            c.skips++;
            if (c.skips >= cpuRetireThreshold(c)) {
              // 멘트 정밀화 P3 (전체 경매 통일): 이 CPU가 빠진 뒤 활성 수(activeCpuCount-1)로 후반 판정 → free/candle과 동일하게 4→3 경계 순간에도 dropout 멘트 정상 발사.
              const lateGame = (activeCpuCount() - 1) <= 3;
              c.retired = true;
              logBid(`${cpuDisplayName(c)} ${CONFIG.personaEmoji[c.type]} 이번 경매에서 빠집니다.`, 'sys');
              if (lateGame) {
                const line = pickHostLine('dropout', makeHostCtx({ currentPrice: price, actorCpu: c }));
                if (line) logBid(line, 'host', false, { cat: 'dropout', cpuId: c.id });
              }
            }
          }
        }
      },
      _userBuy() {
        if (over) return;
        over = true;
        winner = 'user';
        state.userLastBid = price;
        setLastBidder('user');
        const _playerName = bidderDisplayName('user');
        logBid(`${_playerName} 가 ${formatMoney(price)} 에 구매.`, 'user');
        const sold = pickHostLine('sold', makeHostCtx({ currentPrice: price, name: _playerName }));
        logBid(sold || `📢 ${formatMoney(price)}에 낙찰! 축하합니다!`, 'host cd');
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
          topBidder: winner ? bidderDisplayName(winner) : '대기 중',
          timerText: countdownDone ? (timerMs / 1000).toFixed(1) + 's' : (descPhaseDone ? `시작 대기` : `작품 소개 중`),
          candleOn: false,
          userGaveUp,
          // v11.04 확정안 AUC-1: 카운트다운 오버레이는 그림 설명 단계가 끝난 뒤에만 표시.
          countdownActive: descPhaseDone && !countdownDone,
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
      let cpuNextDelayTotalMs = -1;
      let cpuNextActor = null;       // 예전 실시간 스케줄러 호환용. v12 순차 자유경매에서는 activeTurnCpuId를 쓴다.
      let activeTurnCpuId = null;
      let sequentialTurnMode = true;
      let waitingForUser = false;
      let turnSlot = 0;
      let lapBidCount = 0;
      const hasPassedThisLap = {};
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
      let lastBidAtMs = 0;
      let lastPersuasionAtMs = -99999;
      let fairWarningLevel = 0;
      let silentMsLeft = 0;
      let silenceArmed = false;
      let flowStage = 'sprint';
      // v11.04 확정안 MSG-3: 정적 멘트 마지막 발사 시각 (난사 방지)
      let lastSilenceMentAtMs = -99999;
      // v11.04 확정안 MSG-6: "신중하시네요"(천천히) 마지막 발사 시각 (1:1 한정, 난사 방지)
      let lastTakeYourTimeAtMs = -99999;
      // v11.04 확정안 MSG-4: 마무리 정형 시퀀스 — 발사 단계 인덱스(-1=미시작)와 다음 줄 발사 시각
      let closingSeqStep = -1;
      let closingSeqNextAtMs = 0;
      let duelClimaxActive = false;
      let duelParticipantIds = [];
      let duelTurnElapsedMs = 0;
      let duelBidExchangeCount = 0;
      let duelPassStreak = 0;
      let duelFinalPriceOverride = null;
      let duelIntroPauseMs = 0;
      // A안 2번: 내 차례 선택 제한시간(5초). 멈춰서 기다리는 동안 흐른 시간 누적, 초과 시 자동 패스.
      let userTurnElapsedMs = 0;

      function updateFlowStage() {
        const nextStage = auctionFlowStage(totalElapsedMs, bidCount, currentPrice / expected);
        if (nextStage !== flowStage) {
          flowStage = nextStage;
          if (flowStage !== 'sprint') {
            const line = pickHostLine('transition', fmtCtx(null));
            if (line) logBid(line, 'host');
          }
        }
        return flowStage;
      }

      // v11.04 확정안: 자유경매는 고정 길이가 없어 진행률을 단계(flowStage)로 환산.
      // sprint=초반(0.2) / contest=중반(0.55) / closing=막판(0.85). WTH 40%/55% 게이트 판정용.
      function flowProgress() {
        if (flowStage === 'closing') return 0.85;
        if (flowStage === 'contest') return 0.55;
        return 0.20;
      }

      function cpuDelayRange() {
        const stage = updateFlowStage();
        if (stage === 'sprint') {
          // 디렉터 사이클 #7: 속사포 오프닝 — 경매 시작 첫 N초간 CPU 입찰 간격을 짧게 (착착착 빠른 연타)
          if ((nowMs() - startedAt) < CONFIG.sprintOpeningMs) return [400, 900];
          return [1000, 2000];
        }
        // 디렉터 사이클 #7: 긴박감 — 중·후반 입찰 간격 단축 (전반 속도감 ↑)
        if (stage === 'contest') return [2000, 3500];
        return [3500, 5000];
      }

      function rollCooldown() {
        const stage = updateFlowStage();
        let lo = CONFIG.freeHostCooldownMin;
        let hi = CONFIG.freeHostCooldownMax;
        if (stage === 'sprint') { lo = 9000; hi = 12000; }
        else if (stage === 'contest') { lo = 10000; hi = 15000; }
        else { lo = 14000; hi = 20000; }
        // 디렉터 사이클 #5 (#4): 라운드 성격이 폭주면 사회자 호가 간격 ×0.7 (빠르게), 잠잠이면 ×1.4 (천천)
        const mul = getCurrentFlavor().hostCooldownMul;
        if (typeof mul === 'number' && mul !== 1.0) { lo = lo * mul; hi = hi * mul; }
        return lo + rng.next() * (hi - lo);
      }

      function fmtCtx(actorCpu, extra) {
        return makeHostCtx({
          currentPrice,
          nextPrice: currentPrice + minTick(currentPrice),
          actorCpu,
          ...(extra || {}),
        });
      }

      function orderedTurnCpus() {
        return cpus.slice().sort((a, b) => a.id - b.id);
      }

      function buildSeatTurnOrder() {
        const ordered = orderedTurnCpus();
        const playerSeatIndex = Math.min(2, ordered.length);
        return ordered.slice(0, playerSeatIndex)
          .map(c => ({ id: c.id, type: 'cpu', cpu: c }))
          .concat([{ id: 'user', type: 'user' }])
          .concat(ordered.slice(playerSeatIndex).map(c => ({ id: c.id, type: 'cpu', cpu: c })));
      }

      function clearLapPasses() {
        for (const k of Object.keys(hasPassedThisLap)) delete hasPassedThisLap[k];
      }

      function rollSequentialDelay() {
        const stage = updateFlowStage();
        let lo = 650;
        let hi = 1050;
        if (stage === 'contest') { lo = 800; hi = 1300; }
        else if (stage === 'closing') { lo = 950; hi = 1500; }
        const aggScale = 1.25 - (state.sliders.s1_aggression / 100) * 0.65;
        return Math.max(220, (lo + (hi - lo) * rng.next()) * aggScale);
      }

      function cpuDecisionDelayForCurrentTurn() {
        return duelClimaxActive ? currentDuelTurnLimitMs() : rollSequentialDelay();
      }

      function clearCpuDecisionDelay() {
        cpuNextDelayMs = -1;
        cpuNextDelayTotalMs = -1;
      }

      function armCpuDecisionDelay(delayMs) {
        cpuNextDelayMs = Math.max(0, delayMs || 0);
        cpuNextDelayTotalMs = cpuNextDelayMs;
      }

      function armDuelIntroPause() {
        duelIntroPauseMs = CONFIG.duelIntroPauseMs;
        activeTurnCpuId = null;
        waitingForUser = false;
        resetDuelTurnTimer();
        clearCpuDecisionDelay();
      }

      function markTurnPass(actorId, cpu, label) {
        hasPassedThisLap[actorId] = true;
        if (cpu) cpu.lastTurnAction = label || '패스';
      }

      function startNewLap() {
        turnSlot = 0;
        lapBidCount = 0;
        clearLapPasses();
        advanceTurn();
      }

      function finishIfLapSilent() {
        if (lapBidCount > 0) {
          startNewLap();
          return;
        }
        if (duelClimaxActive && topBidder != null) {
          finishDuelByStalemate();
          return;
        }
        over = true;
        activeTurnCpuId = null;
        waitingForUser = false;
        clearCpuDecisionDelay();
        const line = topBidder
          ? `📢 한 바퀴 더 불렀지만 추가 입찰이 없습니다. ${formatMoney(currentPrice)}에서 마감합니다.`
          : '📢 한 바퀴 동안 입찰이 없어 유찰입니다.';
        logBid(line, 'host cd', true);
      }

      function advanceTurn() {
        if (over) return;
        activeTurnCpuId = null;
        waitingForUser = false;
        clearCpuDecisionDelay();
        if (duelClimaxActive && duelIntroPauseMs > 0) {
          resetDuelTurnTimer();
          return;
        }
        const ordered = buildSeatTurnOrder();
        while (turnSlot < ordered.length) {
          const actor = ordered[turnSlot++];
          if (actor && actor.type === 'user') {
            // 플레이어 좌석은 가운데라서, 차례표에도 CPU2와 CPU3 사이에 끼운다.
            // 비유: 줄 서는 순서표만 좌석 배치대로 다시 쓴 것이고, 입찰 계산법은 그대로 둔다.
            if (!canBidByActor('user') && !duelActorCanTakeTurn('user')) {
              markTurnPass('user', null, '선두라 대기');
              continue;
            }
            waitingForUser = true;
            userTurnElapsedMs = 0; // A안 2번: 내 선택 제한시간 타이머 시작점 리셋
            duelTurnElapsedMs = 0;
            if (state.fastForward) state.fastForward = false;
            return;
          }
          const c = actor ? actor.cpu : null;
          if (!c || c.retired || c.bankrupt || c.wthIsAway) continue;
          activeTurnCpuId = c.id;
          c.lastTurnAction = '차례';
          duelTurnElapsedMs = 0;
          armCpuDecisionDelay(cpuDecisionDelayForCurrentTurn());
          return;
        }
        finishIfLapSilent();
      }

      function completePlayerTurn() {
        waitingForUser = false;
        activeTurnCpuId = null;
        clearCpuDecisionDelay();
        advanceTurn();
      }

      function activeDuelParticipantIds() {
        const ids = [];
        const nextPrice = currentPrice + minTick(currentPrice);
        for (const c of cpus) {
          if (!c || c.retired || c.bankrupt || c.wthIsAway) continue;
          if (c.id === topBidder || cpuCanAfford(c, nextPrice)) ids.push(c.id);
        }
        // 플레이어는 빚 비딩이 가능하므로, 명시적으로 빠진 상태가 아니라면 계속 입찰 가능한 참가자다.
        if (!userGaveUp) ids.push('user');
        return ids;
      }

      function sameParticipantIds(a, b) {
        if (!a || !b || a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
          if (a[i] !== b[i]) return false;
        }
        return true;
      }

      function duelNames(ids) {
        return ids.map(id => bidderDisplayName(id)).join(' vs ');
      }

      function currentDuelTurnLimitMs() {
        return 5000;
      }

      function duelActorCanTakeTurn(actorId) {
        return duelClimaxActive && duelParticipantIds.indexOf(actorId) >= 0;
      }

      function resetDuelTurnTimer() {
        duelTurnElapsedMs = 0;
      }

      function exitDuelClimax() {
        duelClimaxActive = false;
        duelParticipantIds = [];
        duelBidExchangeCount = 0;
        duelPassStreak = 0;
        duelIntroPauseMs = 0;
        resetDuelTurnTimer();
      }

      function syncDuelClimax() {
        const nextIds = activeDuelParticipantIds();
        const shouldEnter = topBidder != null
          && nextIds.length === 2
          && nextIds.indexOf(topBidder) >= 0;
        if (!shouldEnter) {
          if (duelClimaxActive) exitDuelClimax();
          return false;
        }
        const changed = !duelClimaxActive || !sameParticipantIds(nextIds, duelParticipantIds);
        duelParticipantIds = nextIds.slice();
        if (changed) {
          duelClimaxActive = true;
          duelBidExchangeCount = 0;
          duelPassStreak = 0;
          armDuelIntroPause();
          state.hostQueue = [];
          logBid(`⚔️ 최후의 2인 — ${duelNames(duelParticipantIds)}. 이제 포기 버튼을 눌러야 끝납니다.`, 'host cd', true);
        }
        return true;
      }

      function syncDuelClimaxAfterBid() {
        const wasActive = duelClimaxActive;
        const wasIds = duelParticipantIds.slice();
        if (!syncDuelClimax()) return;
        duelPassStreak = 0;
        resetDuelTurnTimer();
        if (wasActive && sameParticipantIds(wasIds, duelParticipantIds)) {
          duelBidExchangeCount++;
          state.hostQueue = [];
          logBid(`📢 맞받아쳤습니다. 다음 차례는 ${Math.ceil(currentDuelTurnLimitMs() / 1000)}초입니다.`, 'host cd', true);
        }
      }

      function finishDuelByExplicitGiveUp(actorId) {
        if (!duelClimaxActive || topBidder == null) return false;
        const winnerId = duelParticipantIds.find(id => id !== actorId);
        if (winnerId == null) return false;
        if (actorId === 'user') userGaveUp = true;
        const cpu = cpus.find(c => c.id === actorId);
        if (cpu) {
          cpu.retired = true;
          cpu.lastTurnAction = '포기';
        }
        topBidder = winnerId;
        setLastBidder(winnerId);
        duelFinalPriceOverride = currentPrice;
        over = true;
        activeTurnCpuId = null;
        waitingForUser = false;
        clearCpuDecisionDelay();
        hostCooldownMs = 0;
        state.hostQueue = [];
        logBid(`📢 ${bidderDisplayName(actorId)} 포기. ${bidderDisplayName(winnerId)} ${formatMoney(currentPrice)}에 낙찰입니다.`, 'host cd', true);
        return true;
      }

      function finishDuelByStalemate() {
        if (!duelClimaxActive || topBidder == null) return false;
        duelFinalPriceOverride = currentPrice;
        over = true;
        activeTurnCpuId = null;
        waitingForUser = false;
        clearCpuDecisionDelay();
        hostCooldownMs = 0;
        state.hostQueue = [];
        logBid(`📢 1대1 교착 — 양쪽 모두 한 바퀴 안 질렀습니다. 현재 1등 ${bidderDisplayName(topBidder)} ${formatMoney(currentPrice)}에 낙찰입니다.`, 'host cd', true);
        return true;
      }

      function finishDuelByChallengerPass(actorId, label) {
        if (!duelClimaxActive || topBidder == null) return false;
        if (actorId === topBidder) return false;
        if (duelParticipantIds.indexOf(actorId) < 0) return false;
        duelFinalPriceOverride = currentPrice;
        over = true;
        activeTurnCpuId = null;
        waitingForUser = false;
        clearCpuDecisionDelay();
        hostCooldownMs = 0;
        state.hostQueue = [];
        setLastBidder(topBidder);
        const passText = label || '패스';
        logBid(`📢 ${bidderDisplayName(actorId)} ${passText}. 도전자 패스 — 현재 1등 ${bidderDisplayName(topBidder)} ${formatMoney(currentPrice)}에 즉시 낙찰입니다.`, 'host cd', true);
        return true;
      }

      function markDuelTurnPass(actorId, cpu, label) {
        markTurnPass(actorId, cpu, label || '1대1 패스');
        if (!duelClimaxActive || topBidder == null || duelParticipantIds.indexOf(actorId) < 0) return false;
        if (actorId !== topBidder) {
          return finishDuelByChallengerPass(actorId, label);
        }
        duelPassStreak++;
        return false;
      }

      function retireCpu(cpu, reason) {
        if (!cpu || cpu.retired) return;
        // 멘트 정밀화 P3: 이 CPU가 빠진 뒤 활성 수(activeCpuCount-1)로 후반 판정 → 4→3 경계 순간에도 dropout 멘트 정상 발사.
        const lateGame = (activeCpuCount() - 1) <= 3;
        cpu.retired = true;
        cpu.lastTurnAction = '빠짐';
        // 순서: 시스템 '빠집니다' 먼저 (즉시), 사회자 멘트는 큐로 나중에 (간격 확보). 초반엔 사회자 멘트 생략.
        logBid(`${cpuDisplayName(cpu)} ${CONFIG.personaEmoji[cpu.type]} ${reason}`, 'sys');
        if (lateGame) {
          const line = pickHostLine('dropout', fmtCtx(cpu));
          if (line) logBid(line, 'host', false, { cat: 'dropout', cpuId: cpu.id });
        }
        syncDuelClimax();
      }

      function startWthAway(cpu) {
        const def = CONFIG.personalities.WTH;
        if (!cpu || cpu.type !== 'WTH' || cpu.wthComebacksLeft <= 0) return;
        const [lo, hi] = def.reentryCooldownMs;
        cpu.wthIsAway = true;
        cpu.wthComebacksLeft--;
        cpu.wthAwayUntil = totalElapsedMs + lo + rng.next() * (hi - lo);
        // v11.04 코드리뷰 3차 #1: 자발적 이탈 시 침묵 시작은 "오래 1위였던 경우"에만 찍는다.
        //   현재 1위(lastBidderId===cpu.id)이고 1위를 aheadMinMs(4초) 이상 유지했어야 드라마(물러남·복귀) 자격.
        //   짧게 1위였다 밀린 뒤 자발 이탈로 aheadMinMs 게이트를 우회하던 경로를 차단.
        //   이미 밀림 경로에서 wthSilenceStartMs가 찍혀 있으면 그 값을 보존(덮어쓰지 않음).
        if (cpu.wthSilenceStartMs < 0
            && state.lastBidderId === cpu.id
            && cpu.wthAheadSinceMs >= 0
            && (totalElapsedMs - cpu.wthAheadSinceMs) >= CONFIG.wthMin.aheadMinMs) {
          cpu.wthSilenceStartMs = totalElapsedMs;
        }
        // v11.04 확정안: 물러남 멘트는 startWthAway가 아니라 wthDramaRetreatScan에서 (조건 충족 시에만) 발사.
        // 여기서는 WTH의 실제 이탈(입찰 행동)만 처리하고 멘트는 내보내지 않는다.
      }

      function emitFairWarning(level) {
        if (level <= fairWarningLevel) return;
        fairWarningLevel = level;
        const byLevel = {
          70: '📢 마감 안내!',
          80: '📢 마지막 기회입니다!',
          90: '📢 진짜 마지막입니다.',
        };
        const msg = byLevel[level] || (pickHostLine('fair_warning', fmtCtx(null)) || '📢 마감 안내!');
        // v11.04 코드리뷰 2차 #5: 무입찰(topBidder 없음) 유찰 경매에선 경고를 즉시 출력(immediate).
        //   일반 host 큐로 넣으면 finishAuction이 큐를 비워 화면에 안 보일 수 있어, 종료 직전에도 마감 안내가 보이게 한다.
        const immediate = (topBidder == null);
        logBid(msg, immediate ? 'host cd' : 'host', immediate);
      }

      const api = {
        name: secondPrice ? '자유경매 (2등가격)' : '자유경매 (1등가격)',
        ruleLine: secondPrice
          ? 'CPU가 번호순으로 한 명씩 입찰/패스합니다. 한 바퀴 뒤 내 차례에서 멈추며, 모두 패스한 바퀴가 나오면 2등 가격에 1등 낙찰.'
          : 'CPU가 번호순으로 한 명씩 입찰/패스합니다. 한 바퀴 뒤 내 차례에서 멈추며, 모두 패스한 바퀴가 나오면 1등 가격에 1등 낙찰.',
        inputMode: 'next',
        key: secondPrice ? 'free10_2nd' : 'free10_1st',

        start() {
          startedAt = nowMs();
          state.userTargetSteps = 1;
          // v6: P0-2 시작 직후 lastBidderId 리셋 (이전 라운드 잔재 제거)
          state.lastBidderId = null;
          state.prevBidderId = null;
          state.auctionResolved = false;
          hostCooldownMs = rollCooldown();
          hostCooldownMax = hostCooldownMs;
          nextHostShoutMs = hostCooldownMs * 0.5;
          nextFlavorMs = 8000 + rng.next() * 6000;
          closingShouted = false;
          lastBidAtMs = 0;
          lastPersuasionAtMs = -99999;
          fairWarningLevel = 0;
          silentMsLeft = 0;
          silenceArmed = false;
          flowStage = 'sprint';
          sequentialTurnMode = true;
          waitingForUser = false;
          activeTurnCpuId = null;
          turnSlot = 0;
          lapBidCount = 0;
          duelClimaxActive = false;
          duelParticipantIds = [];
          duelBidExchangeCount = 0;
          duelPassStreak = 0;
          duelFinalPriceOverride = null;
          duelIntroPauseMs = 0;
          resetDuelTurnTimer();
          clearLapPasses();
          const ctx0 = fmtCtx(null);
          const startLine = pickHostLine('free_start', ctx0);
          if (startLine) logBid(startLine, 'host');
          startNewLap();
        },
        _scheduleNextCpu() {
          let [lo, hi] = cpuDelayRange();
          const aggScale = 1.5 - (state.sliders.s1_aggression / 100) * 1.2;
          lo *= aggScale; hi *= aggScale;
          armCpuDecisionDelay(lo + (hi - lo) * rng.next());
          const nextStepPrice = currentPrice + minTick(currentPrice);
          const active = cpus.filter(c => !c.retired && !c.bankrupt && !c.wthIsAway && cpuCanAfford(c, nextStepPrice));
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
          for (const c of cpus) {
            if (c.type !== 'WTH' || c.retired || c.bankrupt || !c.wthIsAway) continue;
            if (c.wthComebacksLeft >= 0 && totalElapsedMs >= c.wthAwayUntil) {
              c.wthIsAway = false;
              // 멘트 정밀화 P5 (Codex 재리뷰): 복귀 직후 가드. 입찰 성공·실패 무관하게 wthLastBidAt을 복귀 시각으로 갱신해, 같은/직후 프레임의 _wthLeaveScan이 startWthAway를 바로 터뜨리지 못하게 한다.
              c.wthLastBidAt = totalElapsedMs;
              return c;
            }
          }
          return null;
        },
        // 멘트 정밀화 P5: WTH 순수 이탈 — 입찰 안 한 채 마지막 입찰 후 충분히 지난 WTH가 leaveProb로 떠남(입찰 직후 멘트 차단).
        _wthLeaveScan() {
          const def = CONFIG.personalities.WTH;
          for (const c of cpus) {
            if (c.type !== 'WTH' || c.retired || c.bankrupt || c.wthIsAway) continue;
            if (c.wthComebacksLeft <= 0) continue;
            if (totalElapsedMs - c.wthLastBidAt < 2500) continue;  // 방금 입찰/복귀 직후 제외
            if (totalElapsedMs < c.wthLeaveCheckAt) continue;
            c.wthLeaveCheckAt = totalElapsedMs + 2000;
            if (rng.next() < def.leaveProb) { startWthAway(c); return; }
          }
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
          const progress = hostCooldownMax > 0 ? (1 - (hostCooldownMs / hostCooldownMax)) : 0;
          if (!silenceArmed && flowStage === 'closing' && progress >= 0.62) {
            silenceArmed = true;
            silentMsLeft = 2000 + rng.next() * 2000;
            return true;
          }
          if (silentMsLeft > 0) {
            silentMsLeft = Math.max(0, silentMsLeft - dt);
            return true;
          }
          // 디렉터 사이클 #4 G안: fair_warning 90%만 발사 (70/80 생략). "진짜 마지막" 한 방으로 임팩트 강화.
          // v11.04 경고 1회 통합: 입찰이 있어(topBidder!=null) cooldown 만료 시 마무리 시퀀스(closing_warn→망치→3·2·1)가
          //   반드시 도는 경우엔, 여기서 fair_warning을 또 내면 "진짜 마지막"+"마지막 기회" 경고가 중복된다.
          //   따라서 topBidder가 있으면(=시퀀스가 경고를 책임짐) 90% fair_warning을 생략하고, 무입찰일 때만 발사.
          if (progress >= 0.90 && topBidder == null) emitFairWarning(90);
          if (bidCount > 0
              && totalElapsedMs - lastBidAtMs >= 3000
              // 디렉터 사이클 #4 G안: persuasion 발사 간격 4.5초 → 9초 (마무리 잔소리 절반으로)
              // 디렉터 사이클 #6 (P1-5): 교착 시 설득 모드 — 입찰 멈춘 지 7초+면 persuasion 간격 9→5초 강화
              && totalElapsedMs - lastPersuasionAtMs >= ((totalElapsedMs - lastBidAtMs >= 7000) ? 5000 : 9000)) {
            lastPersuasionAtMs = totalElapsedMs;
            // 멘트 정밀화 P6: 진짜 1:1 = 남은 참가자 2명(유저 포함). 활성 CPU + (유저 참여중 1) === 2 일 때만 이름 멘트.
            const remaining1v1 = (activeCpuCount() + (userGaveUp ? 0 : 1)) === 2;
            // 항목 A: 초반엔 이름 호명 억제 → chaser_more(추격자 지목) 대신 이름 없는 일반 설득.
            if (remaining1v1 && chaserIsActive() && namedCallAllowed(userGaveUp) && rng.next() < 0.5) {
              // v11.04 확정안 MSG-5: 지목 추격자 대상 — chaser_more 풀. 수정2: chaser 폐기 meta 부착.
              const ex = pickHostLineEx('chaser_more', fmtCtx(null));
              if (ex && ex.text) logBid(ex.text, 'host', false, chaserMetaFor(ex.fn));
            } else {
              const line = pickPersuasionGeneric(fmtCtx(null));
              if (line) logBid(line, 'host');
            }
            // 디렉터 사이클 #8: persuasion 발사 시 cooldown 타이머도 리셋 (두 경로가 같은 구간에 중복 발화 방지)
            nextHostShoutMs = 1500 + rng.next() * 1500;
            return false;
          }
          // 종료 임박 (cooldown 25% 이하) — 한 번
          if (!closingShouted && hostCooldownMs <= hostCooldownMax * 0.25 && hostCooldownMs > 0) {
            closingShouted = true;
            const line = pickHostLine('closing', fmtCtx(null));
            if (line) logBid(line, 'host');
            return false;
          }
          if (nextFlavorMs <= 0) {
            const fl = pickFlavorLine(painting);
            if (fl) logBid(fl, 'host');
            // 항목 B: 무드별 flavor(작품설명) 간격 — rush는 뜸하게(×1.6), quiet는 잦게(×0.6).
            nextFlavorMs = (10000 + rng.next() * 8000) * getFlavorMood().flavorIntervalMul;
            return false;
          }
          // v11.04 확정안 MSG-6: "신중하시네요"(천천히) — 활성 참가자 정확히 2명(1:1)이고 추격자가 takeYourTimeMs(약 1.5초)+ 망설일 때만.
          // 3명 이상 혼재 경쟁 시 발동 안 함. MSG-3(2초)보다 짧은 창에서 한 번 — 한 침묵 구간당 1회.
          if (bidCount > 0
              && (activeCpuCount() + (userGaveUp ? 0 : 1)) === 2
              && chaserIsActive()
              && totalElapsedMs - lastBidAtMs >= CONFIG.takeYourTimeMs
              && totalElapsedMs - lastBidAtMs < CONFIG.silenceMentMs
              && lastTakeYourTimeAtMs < lastBidAtMs) {
            lastTakeYourTimeAtMs = totalElapsedMs;
            // 수정2: take_your_time는 추격자 1:1 재촉 → chaser 폐기 meta 부착.
            const tex = pickHostLineEx('take_your_time', fmtCtx(null));
            if (tex && tex.text) logBid(tex.text, 'host', false, chaserMetaFor(tex.fn));
            return false;
          }
          // v11.04 확정안 MSG-3: 정적(교착) 멘트 — 마지막 입찰 후 silenceMentMs(약 2초)+ 멘트 없을 때.
          // 반드시 지목형("다음 호가 가시겠습니까") 블록보다 먼저 검사해 순서 역전 방지. 한 침묵 구간당 1회.
          if (bidCount > 0
              && totalElapsedMs - lastBidAtMs >= CONFIG.silenceMentMs
              && lastSilenceMentAtMs < lastBidAtMs) {
            lastSilenceMentAtMs = totalElapsedMs;
            // 수정2: silence_ment는 spotlight("다들 {1위}만")·chaser(추격자 지목)·일반 혼합.
            // 항목 A 보강: 초반엔 이름 없는 정적 줄만 뽑아 직접 호명을 막는다.
            const sex = namedCallAllowed(userGaveUp)
              ? pickHostLineEx('silence_ment', fmtCtx(null))
              : pickHostLineFromIndexesEx('silence_ment', SILENCE_GENERIC_IDX, fmtCtx(null));
            if (sex && sex.text) logBid(sex.text, 'host', false, silenceMentMeta(sex.fn));
            // 지목형이 바로 뒤따르지 않도록 다음 호가 멘트 타이머를 살짝 뒤로.
            nextHostShoutMs = 1500 + rng.next() * 1500;
            return false;
          }
          if (nextHostShoutMs <= 0) {
            // 멘트 풀 선택: 추격자 도발 vs 호가 안내
            const lastId = state.lastBidderId;
            const r = rng.next();
            // 항목 A: 초반(이름 호명 미허용)엔 호명 멘트 대신 이름 없는 cooldown_user 풀로.
            // 항목 B: 무드별 호명 확률(rush↑/quiet↓). 기존 0.4 → getFlavorMood().counterProb.
            const allowNamed = namedCallAllowed(userGaveUp);
            const counterProb = getFlavorMood().counterProb;
            let line = null;
            if (bidCount === 0) {
              line = pickHostLine('cooldown_user', fmtCtx(null));
            } else if (lastId === 'user') {
              // 멘트 정밀화 P2: 추격자(prevBidder) 있을 때만 도발. 항목 A: 초반엔 억제.
              if (allowNamed && r < counterProb && chaserIsActive()) {
                const ex = pickHostLineEx('counter_user', fmtCtx(null));
                if (ex && ex.text) logBid(ex.text, 'host', false, chaserMetaFor(ex.fn));
              } else {
                line = pickHostLine('cooldown_user', fmtCtx(null));
              }
            } else if (typeof lastId === 'number') {
              // 멘트 정밀화 P2: counter_cpu/cooldown_cpu 첫 줄은 prevBidderLabel(추격자) 대상.
              // 항목 A: 추격자 없거나/retired거나/초반(미허용)이면 이름 없는 cooldown_user 풀로 대체.
              if (allowNamed && chaserIsActive()) {
                const grp = r < counterProb ? 'counter_cpu' : 'cooldown_cpu';
                const ex = pickHostLineEx(grp, fmtCtx(null));
                if (ex && ex.text) logBid(ex.text, 'host', false, chaserMetaFor(ex.fn));
              } else {
                line = pickHostLine('cooldown_user', fmtCtx(null));
              }
            } else {
              line = pickHostLine('cooldown_user', fmtCtx(null));
            }
            if (line) logBid(line, 'host');
            // 디렉터 사이클 #7: 긴박감 — 사회자 멘트 간격 단축 (촘촘하게)
            nextHostShoutMs = 1500 + rng.next() * 1500;
          }
          return false;
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
        // v11.04 확정안 MSG-4: 자유경매 마무리 정형 시퀀스.
        // 경고("마지막 기회입니다!") → 🔨 망치 → 카운트다운 3·2·1 (각 줄 따로, stepGapMs 간격) → over.
        // 낙찰 멘트("{price}에 낙찰! {name}, 축하합니다!")는 finishAuction에서 closing_sold 풀로 출력.
        // 즉시(immediate) 출력으로 800ms 큐 간격이 아니라 stepGapMs로 카운트다운 박자를 직접 통제.
        _runClosingSeq(dt) {
          closingSeqNextAtMs -= dt;
          if (closingSeqNextAtMs > 0) return;
          const gap = CONFIG.closingSeq.stepGapMs;
          closingSeqStep++;
          if (closingSeqStep === 0) {
            const w = pickHostLine('closing_warn', fmtCtx(null)) || '📢 마지막 기회입니다!';
            logBid(w, 'host cd', true);
            closingSeqNextAtMs = gap;
          } else if (closingSeqStep === 1) {
            const h = pickHostLine('closing_hammer', fmtCtx(null)) || '🔨 망치 올라갑니다!';
            logBid(h, 'host cd', true);
            closingSeqNextAtMs = gap;
          } else if (closingSeqStep === 2) {
            logBid('📢 3…', 'host cd', true);
            closingSeqNextAtMs = gap;
          } else if (closingSeqStep === 3) {
            logBid('📢 2…', 'host cd', true);
            closingSeqNextAtMs = gap;
          } else if (closingSeqStep === 4) {
            logBid('📢 1!', 'host cd', true);
            closingSeqNextAtMs = gap;
          } else {
            // 시퀀스 끝 → 종료. 낙찰 멘트는 finishAuction이 처리.
            over = true;
            hostCooldownMs = 0;
          }
        },
        // v11.04 코드리뷰 2차 #3: "마지막 기회!"라 했으니 막판 입찰 허용(실제 경매식).
        // 시퀀스(경고·망치·3·2·1) 도중 CPU·유저가 입찰하면 마감을 취소하고 경매를 재개한다.
        // _placeBid에서 cooldown은 이미 새로 굴려지므로 여기서는 시퀀스 인덱스·남은 카운트다운만 초기화.
        _cancelClosingSeq() {
          if (closingSeqStep < 0) return;
          closingSeqStep = -1;
          closingSeqNextAtMs = 0;
          // 큐에 남은 카운트다운 잔여(즉시출력 줄은 이미 표시됨)는 host 큐를 비워 제거.
          state.hostQueue = [];
          logBid('📢 입찰이 들어왔습니다! 경매 계속됩니다.', 'host cd', true);
        },
        step(dtMs) {
          if (over) return;
          const dt = scaledDt(dtMs);
          if (waitingForUser) {
            if (duelClimaxActive) {
              duelTurnElapsedMs += dt;
              if (duelTurnElapsedMs >= currentDuelTurnLimitMs()) {
                logBid('⏰ 1대1 제한시간 초과 — 나 → 이번 차례 패스', 'user');
                markDuelTurnPass('user', null, '시간 초과 패스');
                if (!over) completePlayerTurn();
              }
            } else {
              // A안 2번: 내 차례 선택 제한시간. 5초 흐르면 자동 패스.
              // (4번 수정으로 "내가 1등이라 멈추는" 경우는 이미 자동 통과되므로,
              //  여기서 멈춰 있는 건 항상 "아직 1등이 아닌 = 입찰 가능한" 상황뿐 → 자동 패스로 손해 볼 일 없음.)
              userTurnElapsedMs += dt;
              if (userTurnElapsedMs >= CONFIG.userTurnLimitMs) {
                logBid('⏰ 제한시간 초과 — 나 → 자동 패스', 'user');
                this.onUserBid({ giveUp: true });
              }
            }
            return;
          }
          totalElapsedMs += dt;
          updateFlowStage();
          if (totalElapsedMs >= CONFIG.auctionHardCapMs) {
            over = true;
            // 멘트 정밀화 N3 (종료 연출 즉시출력): immediate=true로 큐 우회 → finishAuction이 큐를 비워도 살아남음. 종료 연출 → 낙찰/유찰 멘트 순서 보존.
            logBid('📢 120초 안전장치 발동. 여기서 마감합니다.', 'host cd', true);
            return;
          }
          syncDuelClimax();
          if (duelClimaxActive && duelIntroPauseMs > 0) {
            activeTurnCpuId = null;
            waitingForUser = false;
            clearCpuDecisionDelay();
            resetDuelTurnTimer();
            duelIntroPauseMs = Math.max(0, duelIntroPauseMs - dt);
            if (duelIntroPauseMs > 0) return;
            advanceTurn();
            return;
          }
          // v12 1단계: 자유경매 종료 기준은 타이머가 아니라 "한 바퀴 무입찰"이다.
          // 그래도 사회자 잡담 시계는 남겨 두어 기존 멘트 맛은 유지한다.
          hostCooldownMs -= dt;
          this._hostCheck(dt);
          if (hostCooldownMs <= 0) {
            hostCooldownMs = rollCooldown();
            hostCooldownMax = hostCooldownMs;
            closingShouted = false;
          }
          const wthCpu = this._wthScan();
          if (wthCpu) {
            wthCpu.lastTurnAction = '복귀 대기';
          }
          this._wthLeaveScan();
          if (over) return;
          // v11.04 확정안: WTH 물러남 멘트 스캔 (조건 충족 시 1회 발사).
          wthDramaRetreatScan(cpus, totalElapsedMs, flowProgress(), fmtCtx);
          if (over) return;
          if (activeTurnCpuId == null) advanceTurn();
          if (waitingForUser || over) return;
          const actor = cpus.find(c => c.id === activeTurnCpuId);
          if (!actor || actor.retired || actor.bankrupt || actor.wthIsAway) {
            advanceTurn();
            return;
          }
          if (duelClimaxActive) {
            duelTurnElapsedMs += dt;
          }
          cpuNextDelayMs -= dt;
          if (cpuNextDelayMs <= 0) {
            const didBid = this._tryCpu(actor, false, false, false);
            if (!didBid && !actor.retired && !actor.bankrupt) {
              if (duelClimaxActive && duelParticipantIds.indexOf(actor.id) >= 0) markDuelTurnPass(actor.id, actor, '1대1 패스');
              else markTurnPass(actor.id, actor, '패스');
            }
            activeTurnCpuId = null;
            if (over) return;
            advanceTurn();
            return;
          }
          if (duelClimaxActive && duelTurnElapsedMs >= currentDuelTurnLimitMs()) {
            logBid(`⏰ 1대1 제한시간 초과 — ${cpuDisplayName(actor)} → 이번 차례 패스`, 'sys');
            markDuelTurnPass(actor.id, actor, '시간 초과 패스');
            activeTurnCpuId = null;
            if (!over) advanceTurn();
          }
        },
        _tryCpu(cpu, isCheckRaise, isShkBurst, isWthLate) {
          if (cpu.retired || cpu.bankrupt) return false;
          if (cpu.wthIsAway && !isWthLate) return false;
          if (!canBidByActor(cpu.id)) {
            if (duelClimaxActive && duelParticipantIds.indexOf(cpu.id) >= 0) return false;
            else markTurnPass(cpu.id, cpu, '선두라 대기');
            return false;
          }
          const progress = hostCooldownMax > 0 ? (1 - (hostCooldownMs / hostCooldownMax)) : 0;
          // 디렉터 사이클 #7: 속사포 오프닝 — 경매 시작 첫 N초간(sprint) 점프 1단계 억제 플래그
          const sprintOpening = (flowStage === 'sprint') && ((nowMs() - startedAt) < CONFIG.sprintOpeningMs);
          const ctxJump = { timerProgress: progress, flowStage, wthReentry: !!isWthLate, sprintOpening };
          const jump = cpuJumpSteps(cpu, rng, isCheckRaise, isShkBurst, currentPrice, expected, ctxJump);
          let nextPrice = currentPrice;
          for (let j = 0; j < jump; j++) nextPrice += minTick(nextPrice);
          if (nextPrice <= currentPrice) {
            if (duelClimaxActive && duelParticipantIds.indexOf(cpu.id) >= 0) return false;
            cpu.skips++;
            if (cpu.skips >= cpuRetireThreshold(cpu)) {
              retireCpu(cpu, '이번 경매에서 빠집니다.');
            } else {
              markTurnPass(cpu.id, cpu, '패스');
            }
            return false;
          }
          if (!cpuCanAfford(cpu, nextPrice)) {
            if (duelClimaxActive && duelParticipantIds.indexOf(cpu.id) >= 0) return false;
            cpu.skips++;
            if (cpu.skips >= cpuRetireThreshold(cpu)) {
              retireCpu(cpu, '자금 부족으로 빠집니다.');
            } else {
              markTurnPass(cpu.id, cpu, '자금 부족');
            }
            return false;
          }
          const ratio = nextPrice / expected;
          const activeCpus = cpus.filter(c => !c.retired && !c.bankrupt);
          const ctx2 = { priceRatio: ratio, activeCpus, timerProgress: progress, snipeMode: this._isSnipeMode(), flowStage, wthReentry: !!isWthLate };
          let prob = cpuActionProb(cpu, ctx2) * aggressionMul();
          if (isCheckRaise || isShkBurst || isWthLate) prob = Math.max(prob, 0.7);
          if (rng.next() < prob) {
            this._placeBid(cpu.id, nextPrice, isCheckRaise, isShkBurst, isWthLate, jump, cpu);
            return true;
          } else {
            if (duelClimaxActive && duelParticipantIds.indexOf(cpu.id) >= 0) return false;
            cpu.skips++;
            if (cpu.skips >= cpuRetireThreshold(cpu)) {
              retireCpu(cpu, '이번 경매에서 빠집니다.');
            } else {
              markTurnPass(cpu.id, cpu, '패스');
            }
            return false;
          }
        },
        _placeBid(bidderId, price, isCheckRaise, isShkBurst, isWthLate, jump, cpuObj) {
          // v11.04 코드리뷰 2차 #3: 마감 시퀀스 도중 입찰이 들어오면 마감을 취소하고 경매를 재개.
          if (closingSeqStep >= 0) this._cancelClosingSeq();
          const previousTopBidder = topBidder;
          secondTopPrice = currentPrice;
          currentPrice = price;
          topBidder = bidderId;
          setLastBidder(bidderId);
          // v11.04 WTH 드라마: 1위 자리 교체 추적. 밀린 시점·1위 등극 시점을 별도 필드로 기록.
          // - 직전 1위가 WTH였고 다른 입찰자에게 밀렸으면: 침묵 시작(밀린 시점) 기록 → 물러남·복귀 판정 기준.
          // - 새 1위가 WTH면: 1위 등극 시각 기록 + 침묵 해제.
          if (previousTopBidder != null && previousTopBidder !== bidderId) {
            const prevC = cpus.find(cc => cc.id === previousTopBidder);
            if (prevC && prevC.type === 'WTH' && prevC.wthSilenceStartMs < 0) {
              // v11.04 코드리뷰 2차 #2: "오래 1위였다 밀림"만 드라마. 1위 유지 시간이 aheadMinMs(4초) 이상이어야
              //   침묵(=드라마) 시작. 짧게 1위였다 밀린 경우는 wthSilenceStartMs를 안 찍어 물러남·복귀 멘트가 안 나온다.
              const heldMs = (prevC.wthAheadSinceMs >= 0) ? (totalElapsedMs - prevC.wthAheadSinceMs) : -1;
              if (heldMs >= CONFIG.wthMin.aheadMinMs) {
                prevC.wthSilenceStartMs = totalElapsedMs;
              }
              prevC.wthAheadSinceMs = -1;
            }
          }
          bidIndex++;
          bidCount++;
          lapBidCount++;
          if (duelClimaxActive && duelParticipantIds.indexOf(bidderId) >= 0) duelPassStreak = 0;
          hasPassedThisLap[bidderId] = false;
          consecutiveBids++;
          lastBidAtMs = totalElapsedMs;
          // v6: P1-7 입찰 시 cooldown 리셋 (다음 5~15초 새로)
          hostCooldownMs = rollCooldown();
          hostCooldownMax = hostCooldownMs;
          nextHostShoutMs = hostCooldownMs * 0.5;
          closingShouted = false;
          fairWarningLevel = 0;
          silentMsLeft = 0;
          silenceArmed = false;
          // v6: P1-8 입찰 발생 시 빨리감기 자동 해제
          if (state.fastForward) {
            state.fastForward = false;
            logBid('입찰 발생 — 1배속 복귀.', 'sys');
          }
          if (jump != null && jump > roundMaxJump) roundMaxJump = jump;
          resyncUserTarget(currentPrice);
          // 멘트 정밀화 P1: rivalry("빼앗겼다")는 후반(활성 CPU ≤ 3)에서만, 방금 빼앗긴 직전 1위(previousTopBidder=prevBidderId)를 targetLabel로.
          // 큐 배출 시 leaderAtIssue가 현재 1위와 다르면 폐기되도록 meta 부착.
          if (previousTopBidder != null && previousTopBidder !== bidderId) {
            if (isLateGame() && shouldFireRivalry(secondTopPrice, currentPrice, rng)) {
              const line = pickHostLineFromIndexes('rivalry', [0, 1, 2, 3], fmtCtx(cpuObj, {
                actorId: bidderId,
                targetId: previousTopBidder,
              }));
              if (line) logBid(line, 'host', false, { cat: 'rivalry', leaderAtIssue: bidderId });
            }
          } else if (bidderId !== 'user' && cpuObj && !cpuObj.hasBid && bidCount > 1) {
            if (isLateGame() && shouldFireRivalry(secondTopPrice, currentPrice, rng)) {
              const line = pickHostLine('rivalry', fmtCtx(cpuObj, { actorId: bidderId }));
              if (line) logBid(line, 'host', false, { cat: 'rivalry', leaderAtIssue: bidderId });
            }
          }
          // 인격 연관 멘트 트리거 (50% 확률)
          if (bidderId !== 'user' && cpuObj) {
            const c = cpuObj;
            c.hasBid = true;
            c.lastBid = price;
            c.lastTurnAction = '입찰';
            c.lastActionAt = nowMs();
            // v11.04 확정안: WTH 복귀 멘트 게이트 — 입찰 횟수·침묵·진행률 갱신 전 시점으로 판정.
            // v11.04 코드리뷰 2차 #1: 복귀 인정 범위 확대 — 완전 이탈(wthIsAway→isWthLate) 복귀뿐 아니라,
            //   밀려서 침묵하다 직접 재입찰하는 경우(isWthLate=false)도 wthShouldFireReturn이 참이면 복귀로 인정.
            const wthReturnOk = (c.type === 'WTH')
              && wthShouldFireReturn(c, c.wthBidCount, totalElapsedMs, flowProgress());
            const persona = CONFIG.personaEmoji[c.type];
            let tag = '';
            if (isCheckRaise) tag = ' ⚡체크레이즈';
            else if (isShkBurst) tag = ' 🃏일격';
            else if (isWthLate || wthReturnOk) tag = ' ↩️복귀';
            if (jump != null && jump >= 3) tag += ` (${jump}단계 점프)`;
            logBid(`${cpuDisplayName(c)} ${persona} → ${formatMoney(price)}${tag}`, 'cpu');
            // 인격 멘트 (큰 점프 또는 특수 상황만). v11.04: WTH 복귀 멘트는 조건 충족 시에만.
            const isSnipe = this._isSnipeMode();
            const wthLateForMent = wthReturnOk;
            if (jump >= 3 || isCheckRaise || isShkBurst || wthLateForMent || isSnipe) {
              const key = personaHostKey(c.type, isCheckRaise, isShkBurst, isSnipe, wthLateForMent);
              if (key && rng.next() < 0.7) {
                const line = pickHostLine(key, fmtCtx(c));
                if (line) logBid(line, 'host', false, { cat: 'persona', cpuId: c.id });
              }
            }
            triggerBLFCounter('cpu');
            if (jump != null) onLargeJump(rng, jump, c);
            // 멘트 정밀화 P5: WTH가 방금 입찰/복귀한 직후엔 이탈 선언 금지. 입찰 시각만 기록하고, 실제 이탈은 _wthLeaveScan에서.
            // v11.04: 이번 경매 WTH 입찰 횟수 누적 + 물러남 멘트 1회 잠금 해제(재입찰했으니 다시 물러남 가능).
            if (c.type === 'WTH') {
              c.wthLastBidAt = totalElapsedMs;
              c.wthBidCount++;
              c.wthRetreatMentDone = false;
              // 방금 1위가 됐으니 침묵 종료, 1위 등극 시각 기록. (다음에 밀리면 그때 침묵 재시작.)
              c.wthAheadSinceMs = totalElapsedMs;
              c.wthSilenceStartMs = -1;
            }
          } else {
            const stepsTag = (jump != null && jump > 1) ? ` (${jump}단계)` : '';
            state.userLastBid = price;
            logBid(`나 → ${formatMoney(price)}${stepsTag}`, 'user');
            triggerBLFCounter('user');
          }
          syncDuelClimaxAfterBid();
          // 랠리 트리거 (3 연속 입찰)
          if (consecutiveBids >= 3) {
            const line = pickHostLine('rally', fmtCtx(cpuObj));
            if (line) logBid(line, 'host');
            consecutiveBids = 0;  // 다시 0부터
          }
        },
        onUserBid(payload) {
          if (over) return;
          if (sequentialTurnMode && !waitingForUser) return;
          if (payload && payload.skipTurn) {
            if (duelClimaxActive) {
              logBid('나 → 1대1 이번 차례 패스', 'user');
              markDuelTurnPass('user', null, '1대1 패스');
            } else {
              markTurnPass('user', null, '이번 턴 넘기기');
              logBid('나 → 이번 턴 넘기기', 'user');
            }
            if (!over) completePlayerTurn();
            return;
          }
          if (payload && payload.giveUp) {
            if (duelClimaxActive) {
              finishDuelByExplicitGiveUp('user');
              return;
            }
            markTurnPass('user', null, '패스');
            state.fastForward = true;
            logBid('나 → 패스 · 10배속 보기', 'user');
            completePlayerTurn();
            return;
          }
          // v11.04 코드리뷰 2차 #3: 마무리 시퀀스 중에도 유저 입찰 허용("마지막 기회!"라 했으니).
          //   유저가 입찰하면 _placeBid가 _cancelClosingSeq로 마감을 취소하고 경매를 재개한다.
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
          completePlayerTurn();
        },
        isOver() { return over; },
        end() {
          let finalPrice;
          if (!topBidder) finalPrice = 0;
          else if (duelFinalPriceOverride != null) finalPrice = duelFinalPriceOverride;
          else if (secondPrice) finalPrice = (bidCount >= 2) ? secondTopPrice : currentPrice;
          else finalPrice = currentPrice;
          state.lastMaxJump = roundMaxJump;
          return { winner: topBidder, finalPrice, purchased: topBidder != null };
        },
        getView() {
          const steps = Math.max(1, state.userTargetSteps || 1);
          let myTarget = currentPrice;
          for (let i = 0; i < steps; i++) myTarget += minTick(myTarget);
          const minBidIncrement = minTick(currentPrice);
          const duelTurnLimit = currentDuelTurnLimitMs();
          const duelTurnLeft = Math.max(0, duelTurnLimit - duelTurnElapsedMs);
          const duelSecText = duelClimaxActive ? Math.ceil(duelTurnLeft / 1000) + '초' : '';
          const duelIntroPauseActive = !!(duelClimaxActive && duelIntroPauseMs > 0 && !over);
          const cpuDecisionTimerActive = !!(duelClimaxActive && activeTurnCpuId != null && !over && cpuNextDelayTotalMs > 0 && cpuNextDelayMs >= 0);
          const cpuDecisionTimerTotal = cpuDecisionTimerActive ? Math.max(1, Math.min(cpuNextDelayTotalMs, duelTurnLimit)) : 0;
          const cpuDecisionTimerLeft = cpuDecisionTimerActive ? Math.max(0, Math.min(cpuNextDelayMs, duelTurnLeft)) : 0;
          let turnLabel = 'CPU 차례 진행 중';
          if (duelIntroPauseActive) {
            turnLabel = '⚔️ 최후의 2인 — 곧 첫 차례 시작';
          } else if (duelClimaxActive && waitingForUser) {
            turnLabel = canBidByActor('user')
              ? `⚔️ 최후의 2인 — 내 차례 · ${duelSecText}`
              : `⚔️ 최후의 2인 — 현재 1위 · 넘기기/포기 선택`;
          } else if (duelClimaxActive && activeTurnCpuId != null) {
            turnLabel = `⚔️ 최후의 2인 — ${bidderDisplayName(activeTurnCpuId)} 고민 중 · ${duelSecText}`;
          } else if (duelClimaxActive) {
            turnLabel = `⚔️ 최후의 2인 — 포기해야 끝`;
          } else if (waitingForUser) {
            turnLabel = canBidByActor('user')
              ? '내 차례 — 입찰하거나 패스하세요'
              : '내 차례 — 현재 1위라 패스하면 마감 여부를 봅니다';
          } else if (activeTurnCpuId != null) {
            turnLabel = `${bidderDisplayName(activeTurnCpuId)} 차례`;
          }
          return {
            currentPrice,
            topBidder: bidderDisplayName(topBidder),
            // v6: P1-7 타이머 텍스트 숨김 (사회자에게 집중)
            timerText: '',
            candleOn: false,
            nextBidPrice: myTarget,
            userTargetSteps: steps,
            topBidderId: topBidder,
            allowGiveUp: waitingForUser && !over,
            userGaveUp,
            sequentialTurnMode,
            waitingForUser,
            activeTurnCpuId,
            cpuDecisionTimerActive,
            cpuDecisionTimerLeftMs: cpuDecisionTimerLeft,
            cpuDecisionTimerTotalMs: cpuDecisionTimerTotal,
            cpuDecisionTimerUrgent: cpuDecisionTimerActive && (duelTurnLimit <= 3000 || cpuDecisionTimerLeft <= 900),
            seatTurnOrder: buildSeatTurnOrder().map(actor => actor.id),
            hasPassedThisLap: { ...hasPassedThisLap },
            lapBidCount,
            minBidIncrement,
            canUserBid: waitingForUser && canBidByActor('user'),
            canUserPass: waitingForUser,
            userTurnLimitActive: waitingForUser && !over,
            userTurnLeftMs: duelClimaxActive ? duelTurnLeft : Math.max(0, CONFIG.userTurnLimitMs - userTurnElapsedMs),
            userTurnLimitTotalMs: duelClimaxActive ? duelTurnLimit : CONFIG.userTurnLimitMs,
            turnLabel,
            duelClimaxActive,
            duelParticipantIds: duelParticipantIds.slice(),
            duelIntroPauseActive,
            duelIntroPauseLeftMs: Math.max(0, duelIntroPauseMs),
            duelTurnLeftMs: duelTurnLeft,
            duelTurnLimitMs: duelTurnLimit,
            duelPassStreak,
            duelSpotlightActive: duelClimaxActive && !over,
            countdownActive: false,
            countdownLeft: null,
            countdownLabel: '',
            // v11.04 코드리뷰 2차 #3: 막판 입찰 허용으로 잠금 해제됨 → closingSeq는 항상 false 고정. (UI 잠금 분기는 3차 #3에서 dead code로 제거.)
            closingSeq: false,
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
      let lastBidAtMs = 0;
      let lastPersuasionAtMs = -99999;
      let fairWarningLevel = 0;
      let silentMsLeft = 0;
      let silenceArmed = false;
      let flowStage = 'sprint';
      // v11.04 확정안 MSG-3: 정적 멘트 마지막 발사 시각 (난사 방지)
      let lastSilenceMentAtMs = -99999;
      // v11.04 확정안 MSG-6: "신중하시네요"(천천히) 마지막 발사 시각 (1:1 한정, 난사 방지)
      let lastTakeYourTimeAtMs = -99999;

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

      function updateFlowStage() {
        flowStage = auctionFlowStage(elapsedMs, bidCount, currentPrice / expected);
        return flowStage;
      }

      // v11.04 확정안: 촛불경매는 고정 길이(candleTotalMs)가 있어 실제 진행률 사용. WTH 40%/55% 게이트 판정용.
      function flowProgress() {
        return candleTotalMs > 0 ? Math.min(1, elapsedMs / candleTotalMs) : 0;
      }

      function cpuDelayRange() {
        const stage = updateFlowStage();
        if (stage === 'sprint') return [1000, 2000];
        if (stage === 'contest') return [3000, 5000];
        return [5200, 8200];
      }

      function fmtCtx(actorCpu, extra) {
        return makeHostCtx({
          currentPrice,
          nextPrice: currentPrice + minTick(currentPrice),
          actorCpu,
          ...(extra || {}),
        });
      }

      function retireCpu(cpu, reason) {
        if (!cpu || cpu.retired) return;
        // 멘트 정밀화 P3: 이 CPU가 빠진 뒤 활성 수(activeCpuCount-1)로 후반 판정 → 4→3 경계 순간에도 dropout 멘트 정상 발사.
        const lateGame = (activeCpuCount() - 1) <= 3;
        cpu.retired = true;
        logBid(`${cpuDisplayName(cpu)} ${CONFIG.personaEmoji[cpu.type]} ${reason}`, 'sys');
        if (lateGame) {
          const line = pickHostLine('dropout', fmtCtx(cpu));
          if (line) logBid(line, 'host', false, { cat: 'dropout', cpuId: cpu.id });
        }
      }

      function startWthAway(cpu) {
        const def = CONFIG.personalities.WTH;
        if (!cpu || cpu.type !== 'WTH' || cpu.wthComebacksLeft <= 0) return;
        const [lo, hi] = def.reentryCooldownMs;
        cpu.wthIsAway = true;
        cpu.wthComebacksLeft--;
        cpu.wthAwayUntil = elapsedMs + lo + rng.next() * (hi - lo);
        // v11.04 코드리뷰 3차 #1: 자발적 이탈 시 침묵 시작은 "오래 1위였던 경우"에만 찍는다 (자유경매와 동일).
        //   현재 1위(lastBidderId===cpu.id)이고 1위를 aheadMinMs(4초) 이상 유지했어야 드라마 자격. 짧게 1위였다
        //   밀린 뒤 자발 이탈로 게이트를 우회하던 경로 차단. 밀림 경로에서 이미 찍힌 값이 있으면 보존.
        if (cpu.wthSilenceStartMs < 0
            && state.lastBidderId === cpu.id
            && cpu.wthAheadSinceMs >= 0
            && (elapsedMs - cpu.wthAheadSinceMs) >= CONFIG.wthMin.aheadMinMs) {
          cpu.wthSilenceStartMs = elapsedMs;
        }
        // v11.04 확정안: 물러남 멘트는 startWthAway가 아니라 wthDramaRetreatScan에서 (조건 충족 시에만) 발사.
        // 여기서는 WTH의 실제 이탈(입찰 행동)만 처리하고 멘트는 내보내지 않는다.
      }

      function emitFairWarning(level) {
        if (level <= fairWarningLevel) return;
        fairWarningLevel = level;
        const byLevel = {
          70: '📢 마감 안내!',
          80: '📢 마지막 기회입니다!',
          90: '📢 진짜 마지막입니다.',
        };
        const msg = byLevel[level] || (pickHostLine('fair_warning', fmtCtx(null)) || '📢 마감 안내!');
        // v11.04 코드리뷰 2차 #5: 무입찰(topBidder 없음) 유찰 경매에선 경고를 즉시 출력(immediate) → 종료 시 큐 비움에도 마감 안내가 보이게.
        const immediate = (topBidder == null);
        logBid(msg, immediate ? 'host cd' : 'host', immediate);
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
          state.prevBidderId = null;
          state.auctionResolved = false;
          lastBidAtMs = 0;
          lastPersuasionAtMs = -99999;
          fairWarningLevel = 0;
          silentMsLeft = 0;
          silenceArmed = false;
          flowStage = 'sprint';
          // v11.04 확정안: 촛불 경매는 free_start가 아니라 🕯 전용 점등 멘트로 시작 (점등 연출 보장).
          const line = pickHostLine('candle_start', fmtCtx(null));
          logBid(line || `🕯 촛불 점등! 시작가 ${formatMoney(currentPrice)}.`, 'host');
          this._scheduleNextCpu();
        },
        _scheduleNextCpu() {
          let [lo, hi] = cpuDelayRange();
          const aggScale = 1.5 - (state.sliders.s1_aggression / 100) * 1.2;
          lo *= aggScale; hi *= aggScale;
          cpuNextDelayMs = lo + (hi - lo) * rng.next();
          const nextStepPrice = currentPrice + minTick(currentPrice);
          const active = cpus.filter(c => !c.retired && !c.bankrupt && !c.wthIsAway && cpuCanAfford(c, nextStepPrice));
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
            logBid('🕯 어이쿠, 촛불이 크게 흔들립니다! 곧 꺼질지도 몰라요.', 'host');
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
            // 디렉터 사이클 #4 (가)안: 촛불 멘트를 자연어 구어체로
            logBid('🕯 어, 촛불이 살짝 흔들리네요. 조심하세요.', 'host');
            return;
          }
          if (trafficState === 'yellow') {
            yellowMsLeft -= dt;
            if (yellowMsLeft <= 0) {
              if (yellowKind === 'fake') {
                if (rng.next() < CONFIG.candleFakeYellowChance) {
                  trafficState = 'green';
                  yellowKind = null;
                  logBid('📢 휴, 다시 안정됐습니다.', 'host');
                } else {
                  trafficState = 'red';
                  yellowKind = null;
                  over = true;
                  // 멘트 정밀화 N3 (종료 연출 즉시출력): immediate=true로 큐 우회 → finishAuction이 큐를 비워도 살아남음.
                  logBid('📢 촛불 꺼졌습니다! 마감하겠습니다.', 'host cd', true);
                }
              } else {
                trafficState = 'red';
                yellowKind = null;
                over = true;
                // 디렉터 사이클 #4 (가)안: 자연어 구어체로 / N3: immediate=true 큐 우회
                logBid('📢 촛불이 꺼졌네요. 여기서 마감합니다.', 'host cd', true);
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
          for (const c of cpus) {
            if (c.type !== 'WTH' || c.retired || c.bankrupt || !c.wthIsAway) continue;
            if (c.wthComebacksLeft >= 0 && elapsedMs >= c.wthAwayUntil) {
              c.wthIsAway = false;
              // 멘트 정밀화 P5 (Codex 재리뷰): 복귀 직후 가드. 입찰 성공·실패 무관하게 wthLastBidAt을 복귀 시각으로 갱신해, 같은/직후 프레임의 _wthLeaveScan이 startWthAway를 바로 터뜨리지 못하게 한다.
              c.wthLastBidAt = elapsedMs;
              return c;
            }
          }
          return null;
        },
        // 멘트 정밀화 P5: WTH 순수 이탈 — 입찰 안 한 채 마지막 입찰 후 충분히 지난 WTH가 leaveProb로 떠남(입찰 직후 멘트 차단).
        _wthLeaveScan() {
          const def = CONFIG.personalities.WTH;
          for (const c of cpus) {
            if (c.type !== 'WTH' || c.retired || c.bankrupt || c.wthIsAway) continue;
            if (c.wthComebacksLeft <= 0) continue;
            if (elapsedMs - c.wthLastBidAt < 2500) continue;  // 방금 입찰/복귀 직후 제외
            if (elapsedMs < c.wthLeaveCheckAt) continue;
            c.wthLeaveCheckAt = elapsedMs + 2000;
            if (rng.next() < def.leaveProb) { startWthAway(c); return; }
          }
        },
        _hostCheck(dt) {
          nextHostShoutMs -= dt;
          nextFlavorMs -= dt;
          const progress = candleTotalMs > 0 ? elapsedMs / candleTotalMs : 0;
          if (!silenceArmed && flowStage === 'closing' && progress >= 0.62) {
            silenceArmed = true;
            silentMsLeft = 2000 + rng.next() * 2000;
            return true;
          }
          if (silentMsLeft > 0) {
            silentMsLeft = Math.max(0, silentMsLeft - dt);
            return true;
          }
          // 디렉터 사이클 #4 G안: fair_warning 90%만, persuasion 4.5초 → 9초
          if (progress >= 0.90) emitFairWarning(90);
          if (bidCount > 0
              && elapsedMs - lastBidAtMs >= 3000
              // 디렉터 사이클 #6 (P1-5): 촛불경매도 교착 시 설득 강화 (입찰 멈춘 지 7초+면 9→5초)
              && elapsedMs - lastPersuasionAtMs >= ((elapsedMs - lastBidAtMs >= 7000) ? 5000 : 9000)) {
            lastPersuasionAtMs = elapsedMs;
            // 멘트 정밀화 P6: 진짜 1:1 = 남은 참가자 2명(유저 포함). 활성 CPU + (유저 참여중 1) === 2 일 때만 이름 멘트.
            const remaining1v1 = (activeCpuCount() + (userGaveUp ? 0 : 1)) === 2;
            // 항목 A: 초반엔 이름 호명 억제 → chaser_more 대신 이름 없는 일반 설득.
            if (remaining1v1 && chaserIsActive() && namedCallAllowed(userGaveUp) && rng.next() < 0.5) {
              // v11.04 확정안 MSG-5: 지목 추격자 대상 — chaser_more 풀. 수정2: chaser 폐기 meta.
              const ex = pickHostLineEx('chaser_more', fmtCtx(null));
              if (ex && ex.text) logBid(ex.text, 'host', false, chaserMetaFor(ex.fn));
            } else {
              const pline = pickPersuasionGeneric(fmtCtx(null));
              if (pline) logBid(pline, 'host');
            }
            return false;
          }
          // v11.04 확정안 MSG-6: "신중하시네요"(천천히) — 활성 참가자 정확히 2명(1:1)이고 추격자가 takeYourTimeMs+ 망설일 때만.
          if (bidCount > 0
              && (activeCpuCount() + (userGaveUp ? 0 : 1)) === 2
              && chaserIsActive()
              && elapsedMs - lastBidAtMs >= CONFIG.takeYourTimeMs
              && elapsedMs - lastBidAtMs < CONFIG.silenceMentMs
              && lastTakeYourTimeAtMs < lastBidAtMs) {
            lastTakeYourTimeAtMs = elapsedMs;
            // 수정2: take_your_time는 추격자 1:1 재촉 → chaser 폐기 meta.
            const tex = pickHostLineEx('take_your_time', fmtCtx(null));
            if (tex && tex.text) logBid(tex.text, 'host', false, chaserMetaFor(tex.fn));
            return false;
          }
          // v11.04 확정안 MSG-3: 정적(교착) 멘트 — 지목형보다 먼저. 마지막 입찰 후 silenceMentMs+ 멘트 없을 때, 한 침묵 구간당 1회.
          if (bidCount > 0
              && elapsedMs - lastBidAtMs >= CONFIG.silenceMentMs
              && lastSilenceMentAtMs < lastBidAtMs) {
            lastSilenceMentAtMs = elapsedMs;
            // 수정2: silence_ment는 spotlight·chaser·일반 혼합.
            // 항목 A 보강: 초반엔 이름 없는 정적 줄만 뽑아 직접 호명을 막는다.
            const sex = namedCallAllowed(userGaveUp)
              ? pickHostLineEx('silence_ment', fmtCtx(null))
              : pickHostLineFromIndexesEx('silence_ment', SILENCE_GENERIC_IDX, fmtCtx(null));
            if (sex && sex.text) logBid(sex.text, 'host', false, silenceMentMeta(sex.fn));
            nextHostShoutMs = 1500 + rng.next() * 1500;
            return false;
          }
          if (nextFlavorMs <= 0) {
            const fl = pickFlavorLine(painting);
            if (fl) logBid(fl, 'host');
            // 항목 B: 무드별 flavor 간격 — rush 뜸하게(×1.6), quiet 잦게(×0.6).
            nextFlavorMs = (10000 + rng.next() * 8000) * getFlavorMood().flavorIntervalMul;
          } else if (nextHostShoutMs <= 0 && bidCount > 0) {
            const lastId = state.lastBidderId;
            // 항목 A: 초반(이름 호명 미허용)엔 호명 대신 이름 없는 풀. 항목 B: 무드별 호명 확률.
            const allowNamed = namedCallAllowed(userGaveUp);
            const counterProb = getFlavorMood().counterProb;
            let line = null;
            if (lastId === 'user') {
              // 멘트 정밀화 P2: 추격자 있을 때만 도발. 항목 A: 초반 억제. 항목 B: 무드 확률.
              if (allowNamed && chaserIsActive() && rng.next() < counterProb) {
                const ex = pickHostLineEx('counter_user', fmtCtx(null));
                if (ex && ex.text) logBid(ex.text, 'host', false, chaserMetaFor(ex.fn));
              } else {
                line = pickHostLine('cooldown_user', fmtCtx(null));
              }
            } else if (typeof lastId === 'number') {
              // 멘트 정밀화 P2: counter/cooldown_cpu는 추격자(prevBidder) 대상. 항목 A: 초반/미허용이면 이름 없는 풀.
              if (allowNamed && chaserIsActive()) {
                const grp = rng.next() < counterProb ? 'counter_cpu' : 'cooldown_cpu';
                const ex = pickHostLineEx(grp, fmtCtx(null));
                if (ex && ex.text) logBid(ex.text, 'host', false, chaserMetaFor(ex.fn));
              } else {
                line = pickHostLine('cooldown_user', fmtCtx(null));
              }
            } else {
              line = pickHostLine('cooldown_user', fmtCtx(null));
            }
            if (line) logBid(line, 'host');
            nextHostShoutMs = 3500 + rng.next() * 2000;
          } else if (nextHostShoutMs <= 0) {
            nextHostShoutMs = 3500;
          }
          return false;
        },
        step(dtMs) {
          if (over) return;
          const dt = scaledDt(dtMs);
          elapsedMs += dt;
          updateFlowStage();
          if (elapsedMs >= CONFIG.auctionHardCapMs) {
            trafficState = 'red';
            over = true;
            // 멘트 정밀화 N3 (종료 연출 즉시출력): immediate=true로 큐 우회 → finishAuction이 큐를 비워도 살아남음.
            logBid('📢 120초 안전장치 발동. 여기서 마감합니다.', 'host cd', true);
            return;
          }
          this._updateTraffic(dt);
          if (over) return;
          if (elapsedMs >= candleTotalMs && trafficState !== 'red') {
            trafficState = 'red';
            over = true;
            // 멘트 정밀화 N3 (종료 연출 즉시출력): immediate=true로 큐 우회 → finishAuction이 큐를 비워도 살아남음.
            logBid('📢 촛불이 꺼졌습니다! 경매 종료.', 'host cd', true);
            return;
          }
          if (this._hostCheck(dt)) return;
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
          this._wthLeaveScan();
          if (over) return;
          // v11.04 확정안: WTH 물러남 멘트 스캔 (조건 충족 시 1회 발사).
          wthDramaRetreatScan(cpus, elapsedMs, flowProgress(), fmtCtx);
          if (over) return;
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
          if (cpu.wthIsAway && !isWthLate) return;
          if (!canBidByActor(cpu.id)) return;
          const progress = elapsedMs / candleTotalMs;
          const ctxJump = { timerProgress: progress, flowStage, wthReentry: !!isWthLate };
          const jump = cpuJumpSteps(cpu, rng, isCheckRaise, isShkBurst, currentPrice, expected, ctxJump);
          let nextPrice = currentPrice;
          for (let j = 0; j < jump; j++) nextPrice += minTick(nextPrice);
          if (nextPrice <= currentPrice) {
            cpu.skips++;
            if (cpu.skips >= cpuRetireThreshold(cpu)) retireCpu(cpu, '이번 경매에서 빠집니다.');
            return;
          }
          if (!cpuCanAfford(cpu, nextPrice)) {
            cpu.skips++;
            if (cpu.skips >= cpuRetireThreshold(cpu)) {
              retireCpu(cpu, '자금 부족으로 빠집니다.');
            }
            return;
          }
          const ratio = nextPrice / expected;
          const activeCpus = cpus.filter(c => !c.retired && !c.bankrupt);
          const ctx2 = { priceRatio: ratio, activeCpus, timerProgress: progress, flowStage, wthReentry: !!isWthLate };
          let prob = cpuActionProb(cpu, ctx2) * aggressionMul();
          if (isCheckRaise || isWthLate) prob = Math.max(prob, 0.7);
          if (rng.next() < prob) {
            this._placeBid(cpu.id, nextPrice, isCheckRaise, isWthLate, jump, cpu);
          } else {
            cpu.skips++;
            if (cpu.skips >= cpuRetireThreshold(cpu)) {
              retireCpu(cpu, '이번 경매에서 빠집니다.');
            }
          }
        },
        _placeBid(bidderId, price, isCheckRaise, isWthLate, jump, cpuObj) {
          const previousTopBidder = topBidder;
          secondTopPrice = currentPrice;
          currentPrice = price;
          topBidder = bidderId;
          setLastBidder(bidderId);
          // v11.04 WTH 드라마: 1위 자리 교체 추적 (자유경매와 동일). 밀린 시점·1위 등극 시점 기록.
          if (previousTopBidder != null && previousTopBidder !== bidderId) {
            const prevC = cpus.find(cc => cc.id === previousTopBidder);
            if (prevC && prevC.type === 'WTH' && prevC.wthSilenceStartMs < 0) {
              // v11.04 코드리뷰 2차 #2: "오래 1위였다 밀림"만 드라마 (자유경매와 동일). aheadMinMs 이상 1위 유지 시에만 침묵 시작.
              const heldMs = (prevC.wthAheadSinceMs >= 0) ? (elapsedMs - prevC.wthAheadSinceMs) : -1;
              if (heldMs >= CONFIG.wthMin.aheadMinMs) {
                prevC.wthSilenceStartMs = elapsedMs;
              }
              prevC.wthAheadSinceMs = -1;
            }
          }
          bidIndex++;
          bidCount++;
          consecutiveBids++;
          lastBidAtMs = elapsedMs;
          fairWarningLevel = 0;
          silentMsLeft = 0;
          silenceArmed = false;
          if (state.fastForward) {
            state.fastForward = false;
            logBid('입찰 발생 — 1배속 복귀.', 'sys');
          }
          if (jump != null && jump > roundMaxJump) roundMaxJump = jump;
          resyncUserTarget(currentPrice);
          // 멘트 정밀화 P1: rivalry는 후반(활성 CPU ≤ 3)에서만, 직전 1위를 target으로, meta로 최신성 검증.
          if (previousTopBidder != null && previousTopBidder !== bidderId) {
            if (isLateGame() && shouldFireRivalry(secondTopPrice, currentPrice, rng)) {
              const line = pickHostLineFromIndexes('rivalry', [0, 1, 2, 3], fmtCtx(cpuObj, {
                actorId: bidderId,
                targetId: previousTopBidder,
              }));
              if (line) logBid(line, 'host', false, { cat: 'rivalry', leaderAtIssue: bidderId });
            }
          } else if (bidderId !== 'user' && cpuObj && !cpuObj.hasBid && bidCount > 1) {
            if (isLateGame() && shouldFireRivalry(secondTopPrice, currentPrice, rng)) {
              const line = pickHostLine('rivalry', fmtCtx(cpuObj, { actorId: bidderId }));
              if (line) logBid(line, 'host', false, { cat: 'rivalry', leaderAtIssue: bidderId });
            }
          }
          if (bidderId !== 'user' && cpuObj) {
            const c = cpuObj;
            c.hasBid = true;
            c.lastBid = price;
            c.lastActionAt = nowMs();
            // v11.04 확정안: WTH 복귀 멘트 게이트 — 입찰 횟수·침묵·진행률 갱신 전 시점으로 판정.
            // v11.04 코드리뷰 2차 #1: 복귀 인정 범위 확대 — 밀려서 침묵하다 직접 재입찰하는 경우(isWthLate=false)도 복귀로 인정.
            const wthReturnOk = (c.type === 'WTH')
              && wthShouldFireReturn(c, c.wthBidCount, elapsedMs, flowProgress());
            const persona = CONFIG.personaEmoji[c.type];
            let tag = isCheckRaise ? ' ⚡체크레이즈' : ((isWthLate || wthReturnOk) ? ' ↩️복귀' : '');
            if (jump != null && jump >= 3) tag += ` (${jump}단계 점프)`;
            logBid(`${cpuDisplayName(c)} ${persona} → ${formatMoney(price)}${tag}`, 'cpu');
            const wthLateForMent = wthReturnOk;
            if (jump >= 3 || isCheckRaise || wthLateForMent) {
              const key = personaHostKey(c.type, isCheckRaise, false, false, wthLateForMent);
              if (key && rng.next() < 0.6) {
                const line = pickHostLine(key, fmtCtx(c));
                if (line) logBid(line, 'host', false, { cat: 'persona', cpuId: c.id });
              }
            }
            triggerBLFCounter('cpu');
            if (jump != null) onLargeJump(rng, jump, c);
            // 멘트 정밀화 P5: WTH가 방금 입찰/복귀한 직후엔 이탈 선언 금지. 입찰 시각만 기록하고, 실제 이탈은 _wthLeaveScan에서.
            // v11.04: 이번 경매 WTH 입찰 횟수 누적 + 물러남 멘트 1회 잠금 해제(재입찰했으니 다시 물러남 가능).
            if (c.type === 'WTH') {
              c.wthLastBidAt = elapsedMs;
              c.wthBidCount++;
              c.wthRetreatMentDone = false;
              // 방금 1위가 됐으니 침묵 종료, 1위 등극 시각 기록.
              c.wthAheadSinceMs = elapsedMs;
              c.wthSilenceStartMs = -1;
            }
          } else {
            const stepsTag = (jump != null && jump > 1) ? ` (${jump}단계)` : '';
            state.userLastBid = price;
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
            topBidder: bidderDisplayName(topBidder),
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
    // 멘트 정밀화 N1: '지정가 거래입니다'는 지정가 경매 전용 오프닝 → 비밀경매에선 제거 (오발 방지).
    const shouts = (CONFIG.fixedCloseupShouts[catName] || CONFIG.fixedCloseupShouts.C)
      .filter(s => s.indexOf('지정가 거래') === -1);
    let shoutTimerMs = 800;
    let nextFlavorMs = 6000;

    // v6: P1-10 매 비밀경매마다 호가 갭 1개 선택
    const gapPick = rng.weighted(CONFIG.sealedGapPool);
    const roundGap = gapPick.gap;
    // BUG-2 ①: roundGap 격자가 거칠어 mean~1.0 인격들이 같은 격자점($1,000 등)으로 수렴 → 동점·재경매 빈발.
    //   CPU 비밀입찰 격자를 roundGap보다 잘게 (roundGap/4, 단 minTick 이상). 사용자 입력도 같은 잔격자로 스냅.
    function snapToGap(p) {
      const g = Math.max(minTick(p), Math.round(roundGap / 4));
      return Math.round(p / g) * g;
    }
    // BUG-2 ②: 인격별 노이즈 — snap 후 ±minTick 수준 교란으로 같은 격자에 수렴한 CPU들도 한두 틱씩 벌어지게.
    //   값은 다시 minTick 격자에 맞춰 깔끔하게 떨어지도록 라운드. price<1 방지는 호출부에서.
    function jitterPrice(p) {
      const tick = minTick(p);
      const off = Math.round(rng.rangeFloat(-1, 1)) * tick; // -tick, 0, +tick
      const v = Math.round((p + off) / tick) * tick;
      return v < tick ? tick : v;
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
        // BUG-1 경로 B: 자유/촛불 start()와 일관 — 종료 보호(logBid 큐 차단)가 걸리도록 초기화.
        state.auctionResolved = false;
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
          else if (c.type === 'APP_ROP') priceRatio = rng.clipped(1.25, 0.20, 0.8, ceiling);
          else if (c.type === 'FSP') priceRatio = rng.clipped(1.15, 0.35, 0.6, ceiling);
          else if (c.type === 'WTH') priceRatio = rng.clipped(1.1, 0.30, 0.6, ceiling);
          else priceRatio = rng.clipped(1.0, 0.30, 0.527, ceiling);
          // BUG-2 ②: snap 후 인격별 노이즈로 동일가 수렴 깨기.
          let price = jitterPrice(snapToGap(expected * priceRatio));
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
            logBid(`📢 ${cpuDisplayName(plan.cpu)} 봉투 제출!`, 'host');
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
          // BUG-1 경로 A: giveUp 분기에서 _resolve()를 호출하지 않으면 step() 타이머 만료가
          //   !userSubmitted 게이트에 걸려 영원히 종료 판정이 안 되고 멘트만 돈다.
          //   $0 봉투 제출 직후 즉시 종료 판정.
          // BUG-1 경로 A 보강: 종료 전 남은 CPU 봉투도 제출 처리(일반 경로와 동일).
          //   안 그러면 CPU 봉투가 누락돼 유찰로 오판정됨. (재경매 단계는 submitPlans가 비어 무해)
          while (submitPlans.length > 0) {
            const plan = submitPlans.shift();
            if (!plan.cpu.retired && !plan.cpu.bankrupt) {
              plan.cpu.hasBid = true;
              bids.push({ bidder: plan.cpu.id, price: plan.price });
            }
          }
          this._resolve();
          return;
        }
        if (!userMustSubmit) return;
        if (userSubmitted) return;
        const userPrice = snapToGap(Math.max(0, Number(payload.price) || 0));
        bids.push({ bidder: 'user', price: userPrice });
        userSubmitted = true;
        _userSubmittedFlag = true;
        setLastBidder('user');
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
          // BUG-1 경로 B: 종료 확정 → 멘트 큐 차단 보호 ON + 잔여 host 큐 비우기 (다른 finishAuction과 일관).
          state.auctionResolved = true;
          state.hostQueue = [];
          result = { winner: winners[0].bidder, finalPrice: maxPrice, purchased: maxPrice > 0, allBids: bids };
          if (maxPrice > 0) {
            const label = bidderDisplayName(winners[0].bidder);
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
            // BUG-2 ④: 재경매 인크리먼트 다양화 — 기존 roundGap*{1,2,3} 은 CPU끼리 자주 겹쳐 또 동점.
            //   CPU별 연속 랜덤 배수 + minTick 노이즈로 흩뿌린 뒤 minTick 격자에 라운드.
            const baseInc = roundGap * rng.rangeFloat(1.0, 3.5);
            let newPrice = w.price + baseInc;
            newPrice = jitterPrice(roundToTick(newPrice));
            if (newPrice <= w.price) newPrice = w.price + roundGap; // 최소 1갭은 올림 보장
            bids.push({ bidder: w.bidder, price: newPrice });
            logBid(`${bidderDisplayName(w.bidder)} 재입찰 → 비공개`, 'cpu');
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
          // BUG-1 경로 B: 재경매 종료 확정 → 멘트 큐 차단 + 잔여 큐 비우기.
          state.auctionResolved = true;
          state.hostQueue = [];
          result = { winner: newWinners[0].bidder, finalPrice: newMax, purchased: newMax > 0, allBids: bids };
          const label = bidderDisplayName(newWinners[0].bidder);
          logBid(`${label} 가 ${formatMoney(newMax)} 에 낙찰. (재경매)`, newWinners[0].bidder === 'user' ? 'user' : 'cpu');
        } else {
          over = true; phase = 'done';
          // BUG-1 경로 B: 랜덤 낙찰(동점)도 종료 확정 → 멘트 큐 차단 + 잔여 큐 비우기.
          state.auctionResolved = true;
          state.hostQueue = [];
          const picked = rng.pick(newWinners);
          result = { winner: picked.bidder, finalPrice: picked.price, purchased: picked.price > 0, randomTie: true, allBids: bids };
          const label = bidderDisplayName(picked.bidder);
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
        else if (c.type === 'APP_ROP') { priceRatio = rng.clipped(1.2, 0.18, 0.8, c.ceiling); bidIntent = 0.80; }
        else if (c.type === 'FSP') { priceRatio = rng.clipped(1.25, 0.35, 0.8, Math.min(c.ceiling, 1.6)); bidIntent = 0.45; }
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

      function retireLimitedCpu(cpu, reason) {
        if (!cpu || cpu.retired) return;
        // 멘트 정밀화 P3 (전체 경매 통일): 이 CPU가 빠진 뒤 활성 수(activeCpuCount-1)로 후반 판정 → free/candle과 동일하게 4→3 경계 순간에도 dropout 멘트 정상 발사.
        const lateGame = (activeCpuCount() - 1) <= 3;
        cpu.retired = true;
        logBid(`${cpuDisplayName(cpu)} ${CONFIG.personaEmoji[cpu.type]} ${reason}`, 'sys');
        if (lateGame) {
          const line = pickHostLine('dropout', makeHostCtx({ currentPrice: currentTop, actorCpu: cpu }));
          if (line) logBid(line, 'host', false, { cat: 'dropout', cpuId: cpu.id });
        }
      }

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
            logBid(`${cpuDisplayName(c)} ${CONFIG.personaEmoji[c.type]} 패스`, 'sys');
            if (c.skips >= cpuRetireThreshold(c)) retireLimitedCpu(c, '이번 경매에서 빠집니다.');
            return;
          }
          if (plan.price != null) {
            if (plan.price <= currentTop) {
              bids.push({ bidder: c.id, price: null });
              c.skips++;
              logBid(`${cpuDisplayName(c)} ${CONFIG.personaEmoji[c.type]} 패스 (현재가 이하)`, 'sys');
              if (c.skips >= cpuRetireThreshold(c)) retireLimitedCpu(c, '이번 경매에서 빠집니다.');
              return;
            }
            if (!cpuCanAfford(c, plan.price)) {
              bids.push({ bidder: c.id, price: null });
              c.skips++;
              logBid(`${cpuDisplayName(c)} ${CONFIG.personaEmoji[c.type]} 자금 부족 패스`, 'sys');
              if (c.skips >= cpuRetireThreshold(c)) retireLimitedCpu(c, '자금 부족으로 빠집니다.');
              return;
            }
            bids.push({ bidder: c.id, price: plan.price });
            c.hasBid = true;
            c.lastBid = plan.price;
            currentTop = plan.price;
            setLastBidder(c.id);
            const persona = CONFIG.personaEmoji[c.type];
            logBid(`${cpuDisplayName(c)} ${persona} → ${formatMoney(plan.price)}`, 'cpu');
            triggerBLFCounter('cpu');
          } else {
            bids.push({ bidder: c.id, price: null });
            c.skips++;
            logBid(`${cpuDisplayName(c)} ${CONFIG.personaEmoji[c.type]} 패스`, 'sys');
            if (c.skips >= cpuRetireThreshold(c)) retireLimitedCpu(c, '이번 경매에서 빠집니다.');
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
            // 멘트 정밀화 N4: 1회 제한 경매는 호가 추격 개념이 없음 → "다음 호가 가시겠습니까" 류 발사 금지.
            // 현재 최고가 안내(중립) 또는 선착순 독려만.
            if (currentTop > 0) {
              logBid(`📢 현재 최고가 ${formatMoney(currentTop)}. 한 분당 한 번, 선착순입니다.`, 'host');
            } else {
              logBid(`📢 아직 입찰 없습니다. 선착순 한 번, 도전하실 분?`, 'host');
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
          state.userLastBid = nextPrice;
          setLastBidder('user');
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
          const label = bidderDisplayName(winnerEntry.bidder);
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
            topL = bidderDisplayName(valids[0].bidder);
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
    // 멘트 정밀화 N1: '지정가 거래입니다'는 지정가 전용 → 네덜란드식 경매에선 제거 (오발 방지).
    const shouts = (CONFIG.fixedCloseupShouts[catName] || CONFIG.fixedCloseupShouts.C)
      .filter(s => s.indexOf('지정가 거래') === -1);
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
              setLastBidder(pick.id);
              logBid(`${cpuDisplayName(pick)} ${CONFIG.personaEmoji[pick.type]} 가 ${formatMoney(currentPrice)} 에 구매. (최저가)`, 'cpu');
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
          else if (c.type === 'APP_ROP') personalityMul = 0.95;
          else if (c.type === 'FSP') personalityMul = ratio > 1.0 ? 1.35 : 0.45;
          else if (c.type === 'WTH') personalityMul = ratio < 0.7 ? 1.2 : 0.5;
          const p = (frameP * personalityMul) / activeCount;
          if (rng.next() < p) {
            over = true;
            winner = c.id;
            c.hasBid = true;
            c.lastBid = currentPrice;
            setLastBidder(c.id);
            logBid(`${cpuDisplayName(c)} ${CONFIG.personaEmoji[c.type]} 가 ${formatMoney(currentPrice)} 에 구매.`, 'cpu');
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
        state.userLastBid = currentPrice;
        setLastBidder('user');
        logBid(`나 가 ${formatMoney(currentPrice)} 에 구매.`, 'user');
      },
      isOver() { return over; },
      end() { return { winner, finalPrice: currentPrice, purchased: winner != null }; },
      getView() {
        return {
          currentPrice,
          topBidder: winner ? bidderDisplayName(winner) : '하락 중',
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

  // UI 대개편(사이클 #4): 1대1 돌입 컷인. duelSpotlightActive가 꺼짐→켜짐으로 바뀌는
  //  순간 딱 한 번 "⚔️ 최후의 2인" 자막을 1.5초 띄운다. 진행 방해 최소(오버레이는 pointer 무시).
  let _duelCutinPrev = false;
  let _duelCutinTimer = null;
  function maybeShowDuelCutin(active) {
    if (active && !_duelCutinPrev) {
      const el = $('duel-cutin');
      if (el) {
        el.classList.remove('hidden');
        // 애니메이션 재시작(이미 있던 경우 대비)
        void el.offsetWidth;
        if (_duelCutinTimer) clearTimeout(_duelCutinTimer);
        _duelCutinTimer = setTimeout(() => { el.classList.add('hidden'); }, 1550);
      }
    }
    _duelCutinPrev = active;
  }

  // CPU 속내 표시는 닫아 둔다. 경매 판정은 그대로 두고, 얼굴 위 표정만 빈 표지판처럼 비운다.
  function cpuMoodFace(c, currentPrice, isTurn) {
    void c;
    void currentPrice;
    void isTurn;
    return '';
  }

  // 생각풍선 속 그림도 비운다. 차례 표시는 좌석 강조선이 맡는다.
  function cpuThinkGlyph(c, currentPrice) {
    void c;
    void currentPrice;
    return '';
  }

  function renderCpus() {
    const list = $('cpu-list');
    if (!list) return;
    list.innerHTML = '';
    const isSealed = state.currentAuction && state.currentAuction.sealedSecret && !state.currentAuction.isOver();
    const view = state.currentAuction ? state.currentAuction.getView() : null;
    const turnCpuId = view ? view.activeTurnCpuId : null;
    const duelIds = view && Array.isArray(view.duelParticipantIds) ? view.duelParticipantIds : [];
    const duelOn = !!(view && view.duelSpotlightActive);
    for (const c of state.cpus) {
      const card = document.createElement('div');
      const isTurn = turnCpuId === c.id;
      const cls = ['cpu-card'];
      if (c.bankrupt) cls.push('bankrupt');
      else if (c.retired) cls.push('retired');
      else {
        if (duelOn && duelIds.indexOf(c.id) >= 0 && !isSealed) cls.push('duel');
        if (isTurn && !isSealed) cls.push('turn');
      }
      card.className = cls.join(' ');

      const hasVisibleBid = !c.bankrupt && !c.retired && (
        (isSealed && c.hasBid)
        || (!isSealed && c.lastBid != null && c.lastTurnAction !== '패스' && c.lastTurnAction !== '빠짐')
      );
      const picketText = hasVisibleBid
        ? (isSealed ? '비밀' : formatMoney(c.lastBid))
        : '-';
      const picketClass = 'cpu-bubble bid-picket' + (hasVisibleBid ? ' show' : '') + bidPicketFlashClass(c.id);
      let decisionTimerHtml = '';
      if (isTurn && view && view.cpuDecisionTimerActive && !isSealed) {
        const total = Math.max(1, Number(view.cpuDecisionTimerTotalMs) || 1);
        const left = Math.max(0, Number(view.cpuDecisionTimerLeftMs) || 0);
        const progress = Math.max(0, Math.min(1, left / total));
        const sec = Math.max(0, Math.ceil(left / 1000));
        const timerClass = 'cpu-decision-timer' + (view.cpuDecisionTimerUrgent ? ' urgent' : '');
        decisionTimerHtml = `<div class="${timerClass}" style="--cpu-think-scale:${progress.toFixed(3)}" data-sec="${sec}" data-left-ms="${Math.round(left)}" data-total-ms="${Math.round(total)}" aria-label="${escapeHtmlForLog(cpuDisplayName(c))} 고민 시간 ${sec}초"></div>`;
      }

      const personaName = CONFIG.personaNameKo[c.type] || '';
      const cat = participantCatInfo(c.id);
      let moneyClass = 'cpu-money-line';
      if (c.bankrupt || c.money <= 0) moneyClass += ' broke';
      else if (c.money < 500) moneyClass += ' low';

      // 상태 한 줄(회색 처짐일 때만 라벨, 그 외엔 비움 — 장식 최소화)
      let statusLine = '';
      if (c.bankrupt) statusLine = '파산';
      else if (c.retired) statusLine = '10배속 보기';

      card.innerHTML = `
        <div class="bidder-face-row">
          <div class="cpu-avatar" data-cat-color="${escapeHtmlForLog(cat.color)}" aria-label="${escapeHtmlForLog(cat.name)} 고양이">
            ${participantCatIconHtml(c.id, 'cpu-cat-icon')}
          </div>
          <div class="${picketClass}" aria-label="${escapeHtmlForLog(cpuDisplayName(c))} 입찰 번호판">${escapeHtmlForLog(picketText)}</div>
        </div>
        ${decisionTimerHtml}
        <div class="cpu-name-line">${escapeHtmlForLog(cpuDisplayName(c))}</div>
        <div class="${moneyClass}">💰 ${formatMoney(c.money)}</div>
        <div class="cpu-status-line">${statusLine || (state.debugMode ? personaName + ' (' + c.type + ')' : '')}</div>
      `;
      list.appendChild(card);
    }
  }

  function getAuctionRankParticipants(view) {
    const topKey = view && view.topBidderId != null ? String(view.topBidderId) : '';
    const currentPrice = view && typeof view.currentPrice === 'number' ? view.currentPrice : 0;
    const participants = [];

    for (const c of state.cpus) {
      const idKey = String(c.id);
      let bidValue = (typeof c.lastBid === 'number') ? c.lastBid : null;
      if (topKey === idKey && currentPrice > 0) bidValue = currentPrice;
      participants.push({
        id: idKey,
        name: cpuDisplayName(c),
        bidValue,
        bidText: bidValue != null ? formatMoney(bidValue) : '—',
        seatOrder: c.id <= 2 ? c.id - 1 : c.id,
        leader: topKey === idKey,
        retired: !!(c.retired || c.bankrupt),
        passed: !!(view && view.hasPassedThisLap && view.hasPassedThisLap[idKey]),
        myTurn: !!(view && view.activeTurnCpuId === c.id),
      });
    }

    const userBid = (topKey === 'user' && currentPrice > 0)
      ? currentPrice
      : (typeof state.userLastBid === 'number' ? state.userLastBid : null);
    participants.push({
      id: 'user',
      name: bidderDisplayName('user'),
      bidValue: userBid,
      bidText: userBid != null ? formatMoney(userBid) : '—',
      seatOrder: 2,
      leader: topKey === 'user',
      retired: !!(view && view.userGaveUp),
      passed: !!(view && view.hasPassedThisLap && view.hasPassedThisLap.user),
      myTurn: !!(view && view.waitingForUser),
    });

    participants.sort((a, b) => {
      if (a.leader !== b.leader) return a.leader ? -1 : 1;
      if (a.retired !== b.retired) return a.retired ? 1 : -1;
      const aHasBid = typeof a.bidValue === 'number';
      const bHasBid = typeof b.bidValue === 'number';
      if (aHasBid !== bHasBid) return aHasBid ? -1 : 1;
      if (aHasBid && bHasBid && b.bidValue !== a.bidValue) return b.bidValue - a.bidValue;
      return a.seatOrder - b.seatOrder;
    });

    return participants.map((p, index) => ({ ...p, rank: index + 1 }));
  }

  function updateRankRowElement(row, p) {
    const classes = ['rank-row'];
    if (p.leader) classes.push('is-leader');
    if (p.retired || p.passed) classes.push('is-retired');
    if (p.myTurn) classes.push('is-my-turn');
    row.className = classes.join(' ');
    row.dataset.bidderId = String(p.id);
    row.dataset.rank = String(p.rank);
    row.dataset.bidValue = String(p.bidValue || 0);
    const pos = p.leader ? '👑' : String(p.rank);
    const bidText = (p.retired || (p.passed && p.bidValue == null)) ? '포기' : p.bidText;
    row.innerHTML = `
      <div class="rank-pos">${pos}</div>
      <div class="rank-avatar">${participantCatIconHtml(p.id, 'rank-cat-icon')}</div>
      <div class="rank-name">${escapeHtmlForLog(p.name)}</div>
      <div class="rank-bid">${escapeHtmlForLog(bidText)}</div>
      <div class="rank-crown">${p.leader ? '👑' : ''}</div>
    `;
  }

  function rankSlotTransform(rank) {
    const idx = Math.max(0, (rank || 1) - 1);
    return `${idx * 100}%`;
  }

  function markRankRowMove(row, movingUp) {
    if (!row) return;
    row.setAttribute('data-rank-moved', 'true');
    state._rankBarMoveSeen = true;
    if (typeof window !== 'undefined') window.__rankMoveSeen = true;
    row.classList.add(movingUp ? 'is-moving-up' : 'is-moving-down');
    const cleanup = () => {
      row.removeAttribute('data-rank-moved');
      row.classList.remove('is-moving-up', 'is-moving-down');
      row.removeEventListener('transitionend', cleanup);
    };
    row.addEventListener('transitionend', cleanup);
    setTimeout(cleanup, 650);
  }

  function renderTensionRankBar(v) {
    const list = $('tension-rank-list');
    if (!list) return;
    const participants = getAuctionRankParticipants(v || {});
    const existingRows = new Map();
    Array.from(list.children).forEach(row => {
      const id = row.dataset ? row.dataset.bidderId : '';
      if (!id) return;
      existingRows.set(id, row);
    });

    participants.forEach(p => {
      const row = existingRows.get(String(p.id)) || document.createElement('div');
      const oldRank = Number(row.dataset.rank || 0);
      const hadRow = !!row.parentNode;
      if (!hadRow) {
        row.style.transition = 'none';
        row.style.setProperty('--rank-y', rankSlotTransform(p.rank));
      }
      updateRankRowElement(row, p);
      if (!hadRow) list.appendChild(row);
      const nextY = rankSlotTransform(p.rank);
      if (hadRow && oldRank && oldRank !== p.rank) {
        row.style.setProperty('--rank-y', rankSlotTransform(oldRank));
        row.getBoundingClientRect();
        markRankRowMove(row, oldRank > p.rank);
        requestAnimationFrame(() => {
          row.style.setProperty('--rank-y', nextY);
        });
      } else {
        row.style.setProperty('--rank-y', nextY);
        if (!hadRow) {
          requestAnimationFrame(() => { row.style.transition = ''; });
        }
      }
      existingRows.delete(String(p.id));
    });

    existingRows.forEach(row => {
      row.remove();
    });

    state._rankBarLastOrder = participants.map(p => p.id);
  }

  function renderAppraisalPriceBar(v) {
    const wrap = $('price-bar-wrap');
    if (!wrap) return;
    const expected = Math.max(0, state._hiddenExpected || 0);
    const start = Math.max(0, state.currentStartPrice || 0);
    const current = Math.max(0, (v && typeof v.currentPrice === 'number') ? v.currentPrice : start);
    const upper = Math.max(start + minTick(Math.max(start, 1)) * 4, expected * 1.6, current);
    const span = Math.max(1, upper - start);
    const pct = (value) => Math.max(0, Math.min(100, ((value - start) / span) * 100));
    const currentPct = pct(current);
    const expectedPct = pct(expected);
    const over = expected > 0 && current > expected;
    const baseWidth = over ? expectedPct : currentPct;
    const hotWidth = over ? Math.max(0, currentPct - expectedPct) : 0;
    const base = $('pb-fill-base');
    const hot = $('pb-fill-hot');
    const markExpected = $('pb-mark-appraisal');
    const markCurrent = $('pb-mark-current');
    const pointer = $('pb-current-pointer');
    const label = $('pb-appraisal-label');
    wrap.classList.toggle('is-over-appraisal', over);
    if (base) base.style.width = `${baseWidth}%`;
    if (hot) {
      hot.style.left = `${expectedPct}%`;
      hot.style.width = `${hotWidth}%`;
    }
    if (markExpected) markExpected.style.left = `${expectedPct}%`;
    if (markCurrent) markCurrent.style.left = `${currentPct}%`;
    if (pointer) pointer.style.left = `${currentPct}%`;
    if (label) {
      label.style.left = `${expectedPct}%`;
      label.textContent = `감정가 ${formatMoney(expected)}`;
    }
  }

  function renderTurnCountdownLayer(v) {
    const ring = $('turn-countdown-ring');
    const timerEl = $('auc-timer');
    const bidBtn = $('bid-btn-next');
    if (!ring || !timerEl) return;
    const active = !!(v && v.userTurnLimitActive && typeof v.userTurnLeftMs === 'number');
    if (!active) {
      ring.style.setProperty('--turn-progress', '0deg');
      ring.classList.remove('active', 'urgent');
      ring.classList.add('idle');
      if (bidBtn) {
        bidBtn.style.setProperty('--turn-fill', '0%');
        bidBtn.classList.remove('timer-active', 'timer-urgent');
      }
      return;
    }

    const total = v.userTurnLimitTotalMs || CONFIG.userTurnLimitMs || 5000;
    const left = Math.max(0, v.userTurnLeftMs);
    const sec = Math.max(0, Math.ceil(left / 1000));
    const progress = Math.max(0, Math.min(1, left / total));
    ring.style.setProperty('--turn-progress', `${Math.round(progress * 360)}deg`);
    ring.classList.remove('idle');
    ring.classList.add('active');
    ring.classList.toggle('urgent', sec <= 3);
    if (bidBtn) {
      bidBtn.style.setProperty('--turn-fill', `${Math.round(progress * 100)}%`);
      bidBtn.classList.add('timer-active');
      bidBtn.classList.toggle('timer-urgent', sec <= 3);
    }
    timerEl.textContent = String(sec);
    timerEl.classList.remove('is-dash');
    timerEl.classList.toggle('warn', sec <= 3);
  }

  function stepsToReachTargetPrice(currentPrice, targetPrice) {
    let steps = 0;
    let price = Math.max(1, currentPrice || 1);
    const target = roundToTick(Math.max(price + 1, targetPrice || price));
    while (price < target && steps < 20) {
      steps++;
      price += minTick(price);
    }
    return Math.max(1, steps);
  }

  function adjustUserTargetSteps(delta) {
    if (!state.currentAuction || state.currentAuction.inputMode !== 'next') return;
    const view = state.currentAuction.getView ? state.currentAuction.getView() : null;
    if (!view || !view.canUserBid) return;
    state.userTargetSteps = Math.max(1, Math.min(20, (state.userTargetSteps || 1) + delta));
    state._renderDirty = true;
    renderAuctionFrame();
  }

  function bidRaiseExtra(extraAmount) {
    adjustUserTargetSteps(extraAmount >= 0 ? 1 : -1);
  }

  function triggerSoldHammerOverlay(res) {
    const overlay = $('sold-hammer-overlay');
    if (!overlay || !res) return;
    const title = $('sold-hammer-title');
    const detail = $('sold-hammer-detail');
    const count = $('sold-hammer-count');
    state.lastSoldHammer = {
      winner: res.winner,
      finalPrice: res.finalPrice,
      purchased: !!res.purchased,
      at: Date.now(),
    };
    if (count) count.textContent = '3 · 2 · 1';
    if (title) title.textContent = res.purchased ? '낙찰!' : '유찰';
    if (detail) {
      detail.innerHTML = res.purchased
        ? `${participantInlineHtml(res.winner, 'sold-hammer-participant')} · ${formatMoney(res.finalPrice)}`
        : '추가 입찰 없이 마감';
    }
    if (state._soldHammerTimer) clearTimeout(state._soldHammerTimer);
    overlay.classList.remove('hidden', 'show');
    // 애니메이션은 같은 망치를 다시 칠 때도 처음부터 보여야 해서 한 박자 리셋한다.
    void overlay.offsetWidth;
    overlay.classList.add('show');
    state._soldHammerTimer = setTimeout(() => {
      overlay.classList.remove('show');
      overlay.classList.add('hidden');
    }, 1700);
  }

  // 디렉터 사이클 #5 (#5): 사회자 멘트·로그에서 이름(CPU#·플레이어) 색 강조 helpers
  function escapeHtmlForLog(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function highlightNamesInText(text) {
    let out = escapeHtmlForLog(text);
    // CPU 라벨 (CPU1 ~ CPU99) 주황으로
    out = out.replace(/CPU\d+/g, m => `<span class="name-cpu">${m}</span>`);
    // 색 이름 청록으로 — 호명 자리(앞·뒤가 한글/영문/숫자가 아닌 경계)에서만 매치.
    // 비유: 이름표 색깔만 형광펜으로 칠하고, 문장 안쪽의 비슷한 음절은 건드리지 않는다.
    // 그래서 양쪽이 한글 음절(가-힣) 또는 자음·모음(ㄱ-ㅎㅏ-ㅣ)·영문·숫자가 아닐 때만 진짜 호명으로 본다.
    for (const name of participantDisplayNames()) {
      const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(
        new RegExp(`(?<![A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ])${safe}(?![A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ])`, 'g'),
        m => `<span class="name-player">${m}</span>`
      );
    }
    return out;
  }

  // UI 대개편(사이클 #2): 흘러가는 로그 컬럼을 제거하고 사회자 말풍선으로 전환.
  //  - state.bidLog는 내부 기록용으로 유지(엔진·검증이 참조), 화면엔 가장 최근 사회자 멘트만 말풍선으로.
  //  - 가장 최근 host 계열 엔트리를 찾아 사회자 머리 위 말풍선에 표시.
  function renderBidLog() {
    // 숨김 데이터 박스에 로그는 그대로 보존(디버그 로그 내보내기·검증용)
    const box = $('auc-bid-log');
    if (box) {
      box.innerHTML = '';
      const recent = state.bidLog.slice(-60);
      for (const e of recent) {
        const div = document.createElement('div');
        div.className = `log-msg ${e.kind || 'sys'}`;
        div.innerHTML = highlightNamesInText(e.text);
        box.appendChild(div);
      }
    }
    // CODEX-FIX-A: 내부 로그와 멘트 생성은 그대로 두고, 무대 위 말풍선 텍스트만 비운다.
    // 비유: 사회자가 들고 있던 대본 종이만 잠시 접어 두고, 사회자 자리는 그대로 남긴다.
    const bubble = $('host-bubble');
    if (bubble) {
      bubble.textContent = '';
      bubble.dataset.last = '';
      bubble.classList.remove('show');
    }
  }

  function renderIntermission(painting, auctionName, ruleLine) {
    $('inter-cycle-round').textContent = `라운드 ${state.round}/${state.cycleAuctions.length}`;
    $('inter-money').textContent = `자금: ${formatMoney(state.money)}`;
    $('inter-painting-img').src = CONFIG.paintingsDir + painting.file;
    $('inter-painting-title').textContent = painting.title;
    $('inter-painting-category').textContent = `카테고리 ${painting.category}`;
    // 디렉터 사이클 #3 (다1): 그림 제목 아래에 시작가·예상가 한 줄
    const priceLineEl = $('inter-price-line');
    if (priceLineEl) {
      const startStr = formatMoney(state.currentStartPrice || 0);
      const expStr = formatMoney(state._hiddenExpected || 0);
      priceLineEl.innerHTML = `시작가 <span class="start-num">${startStr}</span> · 감정가 <span class="expected-num">${expStr}</span>`;
    }
    $('inter-auction-name').textContent = auctionName;
    $('inter-auction-rule').textContent = ruleLine;
    // 디렉터 사이클 #5 (#4): 라운드 성격 태그 표시
    const flavorEl = $('inter-flavor-tag');
    if (flavorEl) {
      const flav = getCurrentFlavor();
      const key = state.currentFlavor || 'balanced';
      flavorEl.textContent = `${flav.label} 라운드`;
      flavorEl.className = `round-flavor-tag flavor-${key}`;
    }
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
    if (!state.currentAuction) {
      const emptyAuctionScreen = $('screen-auction');
      if (emptyAuctionScreen) emptyAuctionScreen.classList.remove('duel-spotlight');
      return;
    }
    const v = state.currentAuction.getView();
    const auctionScreenEl = $('screen-auction');
    if (auctionScreenEl) auctionScreenEl.classList.toggle('duel-spotlight', !!v.duelSpotlightActive);

    // UI 대개편(사이클 #4): 생존자 2명 돌입 순간 "⚔️ 최후의 2인" 컷인 한 번
    maybeShowDuelCutin(!!v.duelSpotlightActive);
    $('auc-round-num').textContent = `${state.round}/${state.cycleAuctions.length}`;
    $('auc-money').textContent = formatMoney(state.money);
    $('auc-auction-name').textContent = state.currentAuction.name;
    // v8 패치 4: 예상가 공개 — 화면 상단 topbar에 실시간 표시
    const expectedEl = $('bid-expected');
    if (expectedEl) expectedEl.textContent = formatMoney(state._hiddenExpected);
    const appraisalValueEl = $('appraisal-threshold-value');
    if (appraisalValueEl) appraisalValueEl.textContent = formatMoney(state._hiddenExpected);
    // 디렉터 사이클 #3 (나2): 시작가도 topbar에 표시
    const startEl = $('bid-start');
    if (startEl) startEl.textContent = formatMoney(state.currentStartPrice || 0);

    const currentPriceEl = $('auc-current-price');
    const expectedPrice = state._hiddenExpected || 0;
    const currentPriceForAppraisal = v.currentPrice || 0;
    const overAppraisal = expectedPrice > 0 && currentPriceForAppraisal > expectedPrice;
    const priceOverlayEl = document.querySelector('#screen-auction .center-price-overlay');
    if (priceOverlayEl) priceOverlayEl.classList.toggle('is-over-appraisal', overAppraisal);
    const auctionItemEl = document.querySelector('#screen-auction .auction-item');
    if (auctionItemEl) auctionItemEl.classList.toggle('is-over-appraisal', overAppraisal);

    if (v.sealedSecret || (state.currentAuction.name === '비밀경매' && (v.currentPrice == null || v.currentPrice === 0))) {
      currentPriceEl.textContent = '???';
    } else {
      currentPriceEl.textContent = formatMoney(v.currentPrice);
    }
    const budgetSpotEl = $('auc-budget-spot');
    if (budgetSpotEl) budgetSpotEl.textContent = formatMoney(state.money);
    const minBidEl = $('auc-min-bid');
    if (minBidEl) minBidEl.textContent = formatMoney(v.minBidIncrement || minTick(v.currentPrice || 100));
    const nextBidEl = $('auc-next-bid');
    if (nextBidEl) {
      if (v.sealedSecret || v.nextBidPrice == null) nextBidEl.textContent = '???';
      else nextBidEl.textContent = formatMoney(v.nextBidPrice);
    }
    const turnStatusEl = $('auc-turn-status');
    if (turnStatusEl) {
      let turnText = v.turnLabel || '진행 중';
      // A안 2번: 내 차례 선택 제한시간 카운트다운을 라벨 뒤에 붙여 보여준다.
      if (v.userTurnLimitActive) {
        const sec = Math.ceil((v.userTurnLeftMs || 0) / 1000);
        turnText += `  ⏱ ${sec}초`;
      }
      turnStatusEl.textContent = turnText;
    }
    if (state.currentPainting) {
      $('auc-painting-img').src = CONFIG.paintingsDir + state.currentPainting.file;
      $('auc-painting-title').textContent = state.currentPainting.title;
      const titleHotEl = $('appraisal-title-hot');
      if (titleHotEl) {
        titleHotEl.textContent = overAppraisal ? '🔥 감정가 돌파!' : '';
        titleHotEl.setAttribute('aria-hidden', overAppraisal ? 'false' : 'true');
      }
      $('auc-painting-category').textContent = `카테고리 ${state.currentPainting.category}`;
    }
    const topBidderEl = $('auc-top-bidder');
    if (v.topBidderId != null) {
      topBidderEl.innerHTML = `최고 입찰자 ${participantInlineHtml(v.topBidderId, 'cpo-winner-participant')}`;
    } else {
      topBidderEl.textContent = `최고 입찰자 ${v.topBidder || '—'}`;
    }
    const timerTxt = v.timerText || '';
    const aucTimerEl = $('auc-timer');
    aucTimerEl.textContent = timerTxt || '—';
    aucTimerEl.classList.toggle('is-dash', !timerTxt);

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
    const cdLabel = cdOverlay ? cdOverlay.querySelector('.countdown-label') : null;
    if (cdOverlay) cdOverlay.classList.toggle('duel-countdown', v.countdownVariant === 'duel');
    if (v.countdownActive) {
      cdOverlay.classList.remove('hidden');
      if (cdLabel) cdLabel.textContent = v.countdownLabel || '곧 경매 시작';
      const sec = Math.ceil(v.countdownLeft / 1000);
      if (sec > 0) {
        cdNum.textContent = String(sec);
        cdNum.classList.remove('go');
      }
    } else if (state.currentAuction.key === 'fixed' && v.countdownLeft != null && v.countdownLeft > -700) {
      cdOverlay.classList.remove('hidden');
      cdOverlay.classList.remove('duel-countdown');
      if (cdLabel) cdLabel.textContent = '곧 경매 시작';
      cdNum.textContent = 'GO!';
      cdNum.classList.add('go');
    } else {
      cdOverlay.classList.add('hidden');
      cdOverlay.classList.remove('duel-countdown');
      if (cdLabel) cdLabel.textContent = '곧 경매 시작';
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

    renderAppraisalPriceBar(v);
    renderTensionRankBar(v);
    renderTurnCountdownLayer(v);

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
      const raiseAmount = Math.max(0, np - (v.currentPrice || 0));
      const compactBidLabel = window.innerWidth <= 700;
      nextBtn.querySelector('.bid-btn-main').textContent = compactBidLabel
        ? `입찰 ${formatMoney(np)}`
        : `다음 가격 입찰 (${formatMoney(np)})`;
      // v11.04 코드리뷰 3차 #3: 막판 입찰 허용으로 getView가 closingSeq:false 고정 → 마무리 시퀀스 잠금 분기는 도달 불가(dead code)라 제거.
      //   입찰 버튼 잠금은 "본인 재입찰 불가"만 남는다.
      const isHybridTurn = !!v.sequentialTurnMode;
      const canBidNow = isHybridTurn ? !!v.canUserBid : state.lastBidderId !== 'user';
      const duelMode = !!v.duelClimaxActive;
      nextBtn.disabled = !canBidNow;
      if (isHybridTurn && !v.waitingForUser) nextBtn.querySelector('.bid-btn-sub').textContent = v.turnLabel || 'CPU 차례 대기';
      else if (!canBidNow) nextBtn.querySelector('.bid-btn-sub').textContent = duelMode ? '현재 1위 — 넘기기 또는 포기' : '현재 1위 — 패스로 마감 여부 확인';
      else nextBtn.querySelector('.bid-btn-sub').textContent = `현재가 ${formatMoney(v.currentPrice || 0)} + 호가 ${formatMoney(raiseAmount)}${stepText}`;
      [
        ['bid-btn-raise-50', '▲', '호가 올리기', false],
        ['bid-btn-raise-100', '▼', '호가 내리기', steps <= 1],
      ].forEach(([id, label, title, extraDisabled]) => {
        const raiseBtn = $(id);
        if (!raiseBtn) return;
        raiseBtn.disabled = !canBidNow || extraDisabled;
        raiseBtn.textContent = label;
        raiseBtn.title = title;
      });
      const giveUp = $('bid-btn-next-giveup');
      const skipTurn = $('bid-btn-next-skip');
      if (skipTurn) {
        skipTurn.disabled = !v.canUserPass;
        skipTurn.textContent = duelMode ? '이번 차례 패스' : '이번 턴 넘기기';
      }
      if (giveUp) {
        if (duelMode) {
          giveUp.disabled = !v.canUserPass;
          giveUp.textContent = v.canUserPass ? '포기 (상대 낙찰)' : '내 차례 대기';
        } else if (isHybridTurn) {
          giveUp.disabled = !v.canUserPass;
          giveUp.textContent = v.canUserPass
            ? (state.fastForward ? '10배속 보기 중 (×10)' : '10배속 보기 (×10)')
            : '내 차례 대기';
        } else if (v.userGaveUp) {
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

    // UI 대개편(사이클 #2): 플레이어 자리 이름·말풍선 연동
    const seatNameEl = $('player-seat-name');
    if (seatNameEl) seatNameEl.textContent = bidderDisplayName('user');
    const seatAvatarEl = document.querySelector('#player-seat .player-avatar');
    if (seatAvatarEl && !seatAvatarEl.querySelector('img.player-cat-icon')) {
      seatAvatarEl.innerHTML = participantCatIconHtml('user', 'player-cat-icon');
    }
    const seatEl = $('player-seat');
    const pBubble = $('player-bubble');
    if (seatEl) {
      seatEl.classList.toggle('my-turn', !!v.waitingForUser);
      seatEl.classList.toggle('duel', !!(v.duelSpotlightActive && v.duelParticipantIds && v.duelParticipantIds.indexOf('user') >= 0));
    }
    if (pBubble) {
      const sealedSubmitted = !!(state.currentAuction && state.currentAuction.sealedSecret && state.currentAuction._userSubmitted);
      const userBidValue = (v.topBidderId === 'user' && v.currentPrice > 0)
        ? v.currentPrice
        : (typeof state.userLastBid === 'number' ? state.userLastBid : null);
      if (sealedSubmitted) {
        pBubble.textContent = '비밀';
        pBubble.classList.add('show');
      } else if (userBidValue != null) {
        pBubble.textContent = formatMoney(userBidValue);
        pBubble.classList.add('show');
      } else {
        pBubble.textContent = '-';
        pBubble.classList.remove('show');
      }
      pBubble.classList.toggle('just-bid', bidPicketFlashClass('user') !== '');
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
      const name = participantInlineHtml(id, 'ledger-participant');
      const cpu = state.cpus.find(c => c.id === id);
      const row = document.createElement('div');
      row.className = id === 'user' ? 'ledger-row user-row' : 'ledger-row';
      const profitClass = profit > 0 ? 'gain' : (profit < 0 ? 'loss' : 'zero');
      const profitSign = profit >= 0 ? '+' : '';
      row.innerHTML = `
        <div class="ledger-name">${name}</div>
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
        const isMe = r.winner === 'user';
        const name = participantInlineHtml(r.winner, isMe ? 'pl-me painting-winner' : 'painting-winner');
        const diff = r.expected - r.finalPrice;
        const diffStr = diff >= 0 ? `+${formatMoney(diff)}` : `${formatMoney(diff)}`;
        const diffCls = diff > 0 ? 'pl-gain' : (diff < 0 ? 'pl-loss' : '');
        row.innerHTML = `<span class="pl-cat">[${r.painting.category}]</span> 🖼 <b>${r.painting.title}</b> → ${name} / ${formatMoney(r.finalPrice)} <span class="pl-exp">(예상 ${formatMoney(r.expected)} · 차익 <span class="${diffCls}">${diffStr}</span>)</span>`;
      }
      list.appendChild(row);
    }
  }

  function updateDebugInfo() {
    if (!state.debugMode) return;
    const info = $('debug-info');
    if (!info) return;
    const counts = {};
    for (const p of CONFIG.allPersonas) counts[p] = 0;
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
      `APP=${counts.APP} ROP=${counts.APP_ROP} FSP=${counts.FSP} WTH=${counts.WTH}\n` +
      `CON=${counts.CON} MAN=${counts.MAN} BLF=${counts.BLF} SHK=${counts.SHK} TLT=${counts.TLT} MIR=${counts.MIR} SNI=${counts.SNI}\n` +
      `cpu$=avg${formatMoney(meanCpu)} broke=${bankruptCount}/${CONFIG.cpuCount} lastMaxJump=${state.lastMaxJump}\n` +
      `agg=${aggressionMul().toFixed(2)} ceil=${ceilingMul().toFixed(2)} flow=${flowTimingMul().toFixed(2)} lastBidder=${bidderDisplayName(state.lastBidderId)} ff=${state.fastForward} f10v=${state._free10Variant}`;
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
    // 디렉터 사이클 #5 hotfix v2 (US-003): state.round가 카테고리 범위(1~5) 벗어나도
    // 마지막 카테고리로 클램프 (rollExpectedPrice와 같은 패턴). category.name 접근 시 TypeError 방지.
    const safeIdx = Math.max(0, Math.min(CONFIG.categories.length - 1, state.round - 1));
    const category = CONFIG.categories[safeIdx];
    // V6 단계별: _auctionPoolFilter가 있으면 해당 풀에서 뽑음, 없으면 전체 풀
    // 비유: 단계별 경매 시 지정된 그림 종류 바구니에서만 뽑고, 아니면 모든 바구니에서
    let pool = state.paintings;
    if (typeof state._auctionPoolFilter === 'function') {
      const filtered = state._auctionPoolFilter(state.paintings);
      if (filtered && filtered.length > 0) pool = filtered;
    }
    const used = state.usedPaintingIds || [];
    let candidates = pool.filter(p => !used.includes(p.id));
    // v11.05: 한 사이클 안 그림 중복 방지. 후보가 비면(그림 수 부족) 중복을 허용해 경매 진행은 유지.
    // 비유: 아직 안 나온 그림 바구니에서 먼저 고르고, 바구니가 완전히 비었을 때만 전체 바구니로 돌아간다.
    if (candidates.length === 0) candidates = pool;
    const painting = state.rng.pick(candidates);
    state.usedPaintingIds = state.usedPaintingIds || [];
    if (painting && painting.id != null) state.usedPaintingIds.push(painting.id);
    return { id: painting.id, file: painting.file, title: painting.title, category: category.name };
  }

  function rollExpectedPrice() {
    // v8 패치 10: 디버그 모드일 때 예상가 강제 설정
    // 비유: 자체 검증 패널에서 예상가를 직접 입력하면 그 값으로 고정
    if (window._mn9Debug && typeof window._mn9Debug.forceEstimatedPrice === 'number') {
      return window._mn9Debug.forceEstimatedPrice;
    }
    // 디렉터 사이클 #4 버그 B 안전망: state.round가 카테고리 범위(1~5) 벗어나도 마지막 카테고리로 클램프.
    // 비유: 라운드 번호가 어쩌다 6, 7로 튀어도 그림 카테고리 표에서 마지막 행을 쓰라고 잡아둠.
    const safeIdx = Math.max(0, Math.min(CONFIG.categories.length - 1, state.round - 1));
    const cat = CONFIG.categories[safeIdx];
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
    inspectionGameNo++;  // 디렉터 사이클 #7: 점검용 로그 게임 번호 증가 (비울 때까지 누적)
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
    state.usedPaintingIds = [];
    state.bidLog = [];
    state.cpuTiltMemory = {};
    state.lastBidderId = null;
    state.userLastBid = null;
    state.lastBidFlashId = null;
    state.lastBidFlashAt = 0;
    state.prevBidderId = null;
    state.auctionResolved = false;
    state.fastForward = false;
    state.lastMaxJump = 0;
    state._rankBarLastOrder = [];
    state.lastSoldHammer = null;
    state._recentHostKeys = [];
    // 디렉터 사이클 #2: 새 사이클 시작 시 사회자 큐·카운터 초기화
    state.hostQueue = [];
    state.lastHostEmitAt = 0;
    state._lastDrainedCat = null;
    state._lastFlavorLine = null;
    state.rivalryCount = 0;
    state.cpuMoneyMean = cpuMoneyMean();
    planExtremeRounds(state.rng);
    // 디렉터 사이클 #5 (#4): 라운드 성격 5개 미리 계획
    state.roundFlavorPlan = planRoundFlavors(state.rng);
    state.cycleAuctions = pickCycleKeys(state.rng);
    renderCyclePreview();
    showScreen('screen-cycle-preview');
  }

  function beginCycleAfterPreview() { nextRound(); }

  function nextRound() {
    // 디렉터 사이클 #5 hotfix v2 (US-003): 라운드 카운터 overflow 방어.
    // cycleAuctions가 비었거나 state.round가 길이를 넘으면 무한 루프 막고 사이클 종료로 폴백.
    // 비유: 5라운드 짜리 라운드표에서 라운드 번호가 6, 7로 튀면 더 진행하지 말고 정산으로 보냄.
    if (!state.cycleAuctions || state.cycleAuctions.length === 0 || state.round > state.cycleAuctions.length) {
      console.warn('[v7] nextRound 가드 발동 — round=' + state.round + ', auctions=' + (state.cycleAuctions ? state.cycleAuctions.length : 0) + '. 사이클 종료로 폴백.');
      startSaleSession();
      return;
    }
    state.bidLog = [];
    state.lastBidderId = null;
    state.userLastBid = null;
    state.lastBidFlashId = null;
    state.lastBidFlashAt = 0;
    state.prevBidderId = null;
    state.auctionResolved = false;
    state.fastForward = false;
    state.userTargetSteps = 1;
    state._pendingBuyClick = false;
    state._rankBarLastOrder = [];
    state.lastSoldHammer = null;
    // 디렉터 사이클 #2: 매 라운드(=경매 1건) 시작 시 큐·카운터 초기화
    state.hostQueue = [];
    state.lastHostEmitAt = 0;
    state._lastDrainedCat = null;
    state._lastFlavorLine = null;
    // 항목 C: 라운드(=경매 1건) 전환 시 멘트 중복 방지 링버퍼 초기화 — 매 라운드 신선하게 시작.
    state._recentHostKeys = [];
    state.rivalryCount = 0;
    // 디렉터 사이클 #5 (#4): 현재 라운드의 성격 결정 (계획 배열에서 꺼냄)
    state.currentFlavor = (state.roundFlavorPlan && state.roundFlavorPlan[state.round - 1]) || 'balanced';
    // 디렉터 사이클 #5 hotfix v4: 새 라운드 시작 시 auction-running 플래그 리셋 (다음 startAuctionRun 허용)
    state._auctionRunning = false;
    // 디렉터 사이클 #6 (P1-2): 속사포 오프닝 — 새 라운드 시작 시각 기록 (rollCooldown 첫 4초간 빠르게)
    state.roundStartMs = Date.now();

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
    // 디렉터 사이클 #7: 점검용 로그 — 라운드 헤더 (게임/라운드/경매방식/성격)
    inspectionLog.push({
      header: true,
      gameNo: inspectionGameNo,
      round: state.round,
      totalRounds: (state.cycleAuctions && state.cycleAuctions.length) || 0,
      auctionName: (auction && auction.name) || '?',
      flavor: (typeof getCurrentFlavor === 'function' ? (getCurrentFlavor().label || '') : ''),
      t: Date.now(),
    });

    // 디렉터 사이클 #3: 시작가를 state에 저장 (topbar·intermission UI 표시용)
    // 비유: 경매 시작 전에 가격표를 미리 인쇄해두는 것
    const initialView = (auction.getView && typeof auction.getView === 'function') ? auction.getView() : null;
    state.currentStartPrice = (initialView && typeof initialView.currentPrice === 'number') ? initialView.currentPrice : 0;

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
    // 디렉터 사이클 #5 hotfix v4: 같은 라운드의 startAuctionRun 중복 호출 방지.
    // (intermission 클릭 + 키 동시 발생, 또는 알 수 없는 listener 누적 등 어떤 경로든 차단.)
    // 비유: 경매장 문 한 번 열린 뒤엔 다시 안 열림. 입찰 끝나면 다시 열림.
    if (state._auctionRunning) return;
    state._auctionRunning = true;
    if (!state.currentAuction) { state._auctionRunning = false; return; }
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
      // 멘트 정밀화 N3: 종료 판정을 큐 배출보다 먼저. 종료 확정 프레임에 남은 진행/낙찰 멘트가 새는 것 + finishAuction 낙찰 멘트 중복을 동시에 차단.
      if (state.currentAuction.isOver()) {
        finishAuction();
        return;
      }
      // 디렉터 사이클 #2: 사회자 큐에서 시간 간격 충족 시 한 줄씩 흘려보냄
      drainHostQueue();
      renderAuctionFrame();
      state._renderDirty = false;
    }
    _rafId = requestAnimationFrame(tick);
  }

  function finishAuction() {
    if (_rafId) cancelAnimationFrame(_rafId);
    _rafId = 0;
    // 디렉터 사이클 #5 hotfix v4: 다음 라운드에서 startAuctionRun이 다시 시작할 수 있도록 플래그 해제
    state._auctionRunning = false;
    let res = state.currentAuction.end();
    // v8 패치 10: 디버그 모드일 때 강제 본인 낙찰
    // 비유: 자체 검증 패널에서 "강제 본인 낙찰" ON 상태면 결과를 내 낙찰로 덮어씀. 평소엔 그냥 무시
    if (window._mn9Debug && window._mn9Debug.forceWin) {
      res = { ...res, winner: 'user', purchased: true };
    }
    // 멘트 정밀화 N3: 낙찰/종료 확정 — 남은 진행 멘트 큐를 비우고, 이후 host 멘트 차단.
    // 낙찰/유찰 멘트는 immediate=true로 즉시 출력해 차단을 우회.
    state.hostQueue = [];
    if (res.purchased && res.winner != null) {
      const label = bidderDisplayName(res.winner);
      // v11.04 확정안 MSG-4: 자유경매(free10_1st/2nd) 낙찰 멘트는 정형 포맷("{price}에 낙찰! {name}, 축하합니다!").
      const isFree = state.currentAuctionKey === 'free10_1st' || state.currentAuctionKey === 'free10_2nd';
      const soldGroup = isFree ? 'closing_sold' : 'sold';
      const sold = pickHostLine(soldGroup, makeHostCtx({ currentPrice: res.finalPrice, name: label }));
      logBid(sold || `📢 ${formatMoney(res.finalPrice)}에 낙찰! ${label}, 축하합니다!`, 'host cd', true);
    } else {
      logBid(`📢 유찰. 낙찰자 없습니다.`, 'host cd', true);
    }
    triggerSoldHammerOverlay(res);
    state.auctionResolved = true;
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
      winnerName: bidderDisplayName(res.winner),
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
      winnerName: bidderDisplayName(res.winner),
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
    const winnerEl = $('result-winner');
    if (!r.purchased) winnerEl.textContent = '낙찰자 없음';
    else winnerEl.innerHTML = participantInlineHtml(r.winner, 'round-result-participant');
    $('result-price').textContent = r.purchased ? formatMoney(r.finalPrice) : '—';
    $('result-auction').textContent = r.auctionName;
    $('result-title').textContent = r.isLastRound ? `라운드 ${state.cycleAuctions.length}/${state.cycleAuctions.length} 결과` : `라운드 ${state.round}/${state.cycleAuctions.length} 결과`;
    $('btn-next-round').textContent = r.isLastRound ? '판매 세션으로' : '다음 라운드';
    showScreen('screen-round-result');
  }

  function proceedAfterResult() {
    const r = state.lastResult;
    if (!r) {
      console.warn('[v11] lastResult missing — fallback');
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
    // 디렉터 사이클 #5 hotfix v2 (US-003): proceedAfterResult overflow 가드.
    // isLastRound 플래그가 누락된 케이스(예전 라운드 결과 재실행)에도 라운드 한계 검사로 정산 진입.
    const auctionsLen = (state.cycleAuctions && state.cycleAuctions.length) || 0;
    if (r.isLastRound || state.round >= auctionsLen) {
      startSaleSession();
    } else {
      state.round++;
      if (state.round > auctionsLen) {
        console.warn('[v7] proceedAfterResult 가드 — round 증가 후 한계 초과. 정산으로 폴백.');
        startSaleSession();
        return;
      }
      nextRound();
    }
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

  // 디렉터 사이클 #5 hotfix v3: bindInputs 멱등성 보장.
  // bootForV9 → main() → bindInputs가 매 cycle 재진입마다 호출되어 이벤트 리스너가
  // 중복 등록되면, screen-intermission 클릭 한 번에 startAuctionRun이 2번 호출되어
  // 라운드 2~5가 즉시 종료되는 현상 발생. 단 한 번만 바인딩되게 가드.
  let _bindInputsDone = false;
  let _bindSlidersDone = false;

  // ============================================================
  // SECTION: input bindings (v6: P0-1 휠 반전 + P1-9 1회제한 휠 + P2-15 전역 키)
  // ============================================================

  function bindInputs() {
    // 디렉터 사이클 #5 hotfix v3: 멱등 가드 — main() 재호출 시 중복 바인딩 방지
    if (_bindInputsDone) return;
    _bindInputsDone = true;
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
    $('bid-btn-raise-50').addEventListener('click', () => adjustUserTargetSteps(1));
    $('bid-btn-raise-100').addEventListener('click', () => adjustUserTargetSteps(-1));
    $('bid-btn-next-skip').addEventListener('click', () => {
      if (state.currentAuction) state.currentAuction.onUserBid({ skipTurn: true });
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
        if (mode === 'next') {
          if (e.deltaY < 0) adjustUserTargetSteps(1);
          else if (e.deltaY > 0) adjustUserTargetSteps(-1);
          return;
        }
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
          if (mode === 'next') {
            adjustUserTargetSteps(1);
            return;
          }
          state.userTargetSteps = Math.min(20, (state.userTargetSteps || 1) + 1);
          state._renderDirty = true;
          renderAuctionFrame();
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (mode === 'next') {
            adjustUserTargetSteps(-1);
            return;
          }
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
    // 디렉터 사이클 #5 hotfix v3: 멱등 가드 — 슬라이더도 중복 바인딩 방지
    if (_bindSlidersDone) return;
    _bindSlidersDone = true;
    const sliders = [
      { id: 'slider-1', key: 's1_aggression', valId: 's1-val' },
      { id: 'slider-2', key: 's2_intensity', valId: 's2-val' },
      { id: 'slider-3', key: 's3_ceilingMean', valId: 's3-val' },
      { id: 'slider-4', key: 's4_ceilingSigma', valId: 's4-val' },
      { id: 'slider-5', key: 's5_cpuMoney', valId: 's5-val' },
      { id: 'slider-6', key: 's6_flowTiming', valId: 's6-val' },
      { id: 'slider-7', key: 's7_hostMsgPace', valId: 's7-val' },
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

  function normalizePaintingManifest(all) {
    const list = Array.isArray(all) ? all : Object.values(all || {}).flat();
    return list.map(p => ({
      ...p,
      // v11.05 그림 연결 수정: manifest.js는 filename, 엔진 화면은 file을 본다.
      // 비유: 카탈로그의 "파일명" 칸을 경매장 표시판이 읽는 "file" 칸에도 복사해 둔다.
      file: p.file || p.filename,
    }));
  }

  async function loadManifest() {
    // v9 패치: file:// 환경 대응 — MN9_MANIFEST 인라인 manifest 직접 사용
    // 비유: 이미 책상에 펼쳐진 카탈로그(manifest.js)가 있으면 외부에 가지러 가지 않고 그걸 씁니다.
    if (window.MN9_MANIFEST && window.MN9_MANIFEST.paintings) {
      // paintings 객체를 배열로 평탄화 (watercolor: [...], pointillism: [...] 형태)
      const list = normalizePaintingManifest(window.MN9_MANIFEST.paintings);
      console.log('[v9] MN9_MANIFEST 인라인 사용:', list.length, '장');
      return list;
    }
    // fallback: fetch 시도 (HTTP 서버 환경)
    try {
      const res = await fetch(CONFIG.paintingsDir + 'manifest.json');
      if (!res.ok) throw new Error('no manifest');
      const j = await res.json();
      return normalizePaintingManifest(j.paintings);
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

    // v7: 신규 인격 정상
    expect('WTH 이모지=↩️', CONFIG.personaEmoji.WTH === '↩️');
    expect('WTH 한국어=왔다갔다형', CONFIG.personaNameKo.WTH === '왔다갔다형');
    expect('FSP 한국어=불꽃 스프린터', CONFIG.personaNameKo.FSP === '불꽃 스프린터');
    expect('APP_ROP 한국어=줄다리기형', CONFIG.personaNameKo.APP_ROP === '줄다리기형');
    expect('allPersonas 11개', CONFIG.allPersonas.length === 11);

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
    expect(`자유경매 사이클당 파산 평균 ${freeStats.avgBankruptPerCycle.toFixed(2)} (0~2.5 기대)`,
      freeStats.avgBankruptPerCycle >= 0 && freeStats.avgBankruptPerCycle <= 2.5);

    const ok = tests.filter(t => t.ok).length;
    const total = tests.length;
    console.log(`[v7 self-test] ${ok}/${total} pass`);
    for (const t of tests) {
      if (!t.ok) console.log(`  FAIL - ${t.name}`);
    }
    return ok === total;
  }

  // ============================================================
  // SECTION: v7 자유경매 시뮬 (cooldown 모델 + 5라운드 참여 + 파산)
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
      console.log('[v7 자유경매 시뮬 1000회 — cooldown 모델]');
      const fs = runFreeAuctionSimulation(1000);
      console.log(fs);
      console.log('[v7 CPU 잔고 분포 시뮬 100 사이클]');
      const ms = runCpuMoneySimulation(100);
      console.log(ms);
      console.log('[v7 사이클 빌더 — 자유1등 분포 (100사이클)]');
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
    // 디렉터 사이클 #4 버그 A 픽스: 라운드·사이클 카운터와 세션 컬렉션 모두 초기화.
    // 비유: 경매장 문 다시 열기 전에 칠판·장부·번호표를 깨끗이 지움. 안 그러면 어제 라운드 14번이 그대로 남음.
    state.round = 1;
    state.cycle = 1;
    state.cycleAuctions = [];
    state.cycleResults = [];
    state.inventory = [];
    state.usedPaintingIds = [];
    state.bidLog = [];
    state.hostQueue = [];
    state.lastHostEmitAt = 0;
    state._lastDrainedCat = null;
    state._lastFlavorLine = null;
    state.rivalryCount = 0;
    state.currentStartPrice = 0;
    state.lastBidderId = null;
    state.prevBidderId = null;
    state.auctionResolved = false;
    state.currentAuction = null;
    state._hiddenExpected = 0;
    // 디렉터 사이클 #5 (#4): 라운드 성격도 초기화
    state.roundFlavorPlan = [];
    state.currentFlavor = 'balanced';
    // 디렉터 사이클 #5 hotfix v4: auction-running 플래그도 초기화
    state._auctionRunning = false;
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

  // 디렉터 사이클 #7: 점검용 로그를 사람이 읽는 텍스트로 변환
  function buildInspectionText() {
    const lines = [];
    let headerT = 0;
    const whoOf = (k) => {
      if (!k) return 'ℹ️시스템';
      if (k.indexOf('host') === 0) return '🎤사회자';
      if (k === 'cpu') return '💰CPU   ';
      if (k === 'user') return '옐로   ';
      if (k === 'warn') return '⚠️경고  ';
      return 'ℹ️시스템';
    };
    for (const e of inspectionLog) {
      if (e.header) {
        lines.push('');
        lines.push('===== 게임 ' + e.gameNo + ' · 라운드 ' + e.round + '/' + e.totalRounds
          + ' · ' + e.auctionName + ' · ' + e.flavor + ' =====');
        headerT = e.t;
      } else {
        const sec = ((e.t - headerT) / 1000).toFixed(1);
        lines.push('[' + String(sec).padStart(6) + 's] ' + whoOf(e.kind) + ' | ' + e.text);
      }
    }
    return lines.join('\n').replace(/^\n/, '');
  }

  window.MN9_AuctionEngine = {
    enterAuction,
    state,
    resetState,
    bootForV9,
    resetForV9: function() { _v9Booted = false; },  // 재진입 시 리셋용
    bidderDisplayName,
    participantCatInfo,
    participantCatIconHtml,
    participantInlineHtml,
    // 디렉터 사이클 #7: 점검용 로그 API
    exportInspectionLog: buildInspectionText,
    clearInspectionLog: function() { inspectionLog = []; },
    inspectionCount: function() { return inspectionLog.length; },
  };

})();
