/* ============================================================
   game.js — 뮤더너츠 v9 메인 연출가
   ============================================================
   비유: 모든 모듈을 부르고 화면 전환을 책임지는 '총감독'입니다.
   버튼 클릭 → 어느 모듈에 맡길지 판단 → 결과 반영 → 자동 저장.

   화면 목록 (Phase 4 확장):
   - screen-menu       : 시작 메뉴 (이어하기/새로시작/자체검증)
   - screen-studio     : 작업실 (그림 선택 → 모작)
   - screen-atelier    : 붓질 캔버스 (모작 진행 중)
   - screen-inventory  : 보유 그림 목록
   - screen-shop       : 상점 (붓·물감 탭)
   - screen-cat-market : 고양이 시장
   - screen-museum     : 박물관 엔딩
   - screen-devmode    : 자체 검증 모드
   - screen-auction-engine : 경매 엔진
   ============================================================ */

(function (global) {
  'use strict';

  // ── 모듈 짧은 이름
  const Persist     = global.MN9_Persist;
  const State       = global.MN9_State;
  const Unlock      = global.MN9_Unlock;
  const Menu        = global.MN9_Menu;
  const Brush       = global.MN9_Brush;
  const Paint       = global.MN9_Paint;
  const Scorer      = global.MN9_Scorer;
  const Composer    = global.MN9_Composer;
  const Atelier     = global.MN9_Atelier;
  const Inventory   = global.MN9_Inventory;
  const Sell        = global.MN9_Sell;
  const Submit      = global.MN9_Submit;
  const DevMode     = global.MN9_DevMode;
  const MANIFEST    = global.MN9_MANIFEST;
  const PaintShop   = global.MN9_PaintShop;
  const BrushShop   = global.MN9_BrushShop;
  const Cats        = global.MN9_Cats;
  const CatMarket   = global.MN9_CatMarket;
  const Museum      = global.MN9_Museum;
  // Phase 5 신규 모듈
  const DebugPanel  = global.MN9_DebugPanel;  // 우측 슬라이드 패널 풀 패키지
  const Guards      = global.MN9_Guards;      // 경매장 입장 가드

  // 필수 모듈 체크
  if (!Persist || !State || !Unlock || !Menu || !Atelier || !Inventory || !Sell || !DevMode || !MANIFEST) {
    console.error('[game] 필수 모듈이 없어요. index.html의 script 순서를 확인해주세요.');
    return;
  }

  // ── 게임 상태 (단일 인스턴스)
  let state = State.loadState();

  // state에 cats 필드 없으면 초기화 (이전 저장 데이터 호환)
  if (!state.cats) {
    state.cats = {
      dorom_a: { hired: false },
      dorom_b: { hired: false },
      ati:     { hired: false },
      oil:     { hired: false },
      gold:    { hired: false },
      gongja:  { hired: false },
    };
  }
  if (!state.unlocks.catsUnlocked) {
    state.unlocks.catsUnlocked = {
      dorom_a: true, dorom_b: false, ati: false, oil: false, gold: false, gongja: false,
    };
  }
  if (!state.museumCollection) state.museumCollection = [];

  // 현재 작업실 캔버스 인스턴스 (없으면 null)
  let activeAtelier = null;

  // ── DOM 헬퍼
  function $(id) { return document.getElementById(id); }
  function show(id) { const el = $(id); if (el) el.classList.remove('hidden'); }
  function hide(id) { const el = $(id); if (el) el.classList.add('hidden'); }
  function setText(id, txt) { const el = $(id); if (el) el.textContent = txt; }
  function fmt(v) {
    const n = Math.round(v);
    return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US');
  }

  // ── 토스트 (우상단 잠깐 알림)
  function toast(msg) {
    const t = $('toast');
    if (!t) { console.log('[toast]', msg); return; }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  }
  Unlock.setToastCallback(toast);

  // ── 가운데 빵 알림 (Phase 4 언락 이벤트용)
  // 비유: 화면 정중앙에 큰 글씨로 잠깐 나타났다 사라지는 알림판입니다.
  function centerNotify(msg) {
    // 기존 알림 제거
    const old = document.querySelector('.center-notify');
    if (old) old.remove();

    const el = document.createElement('div');
    el.className = 'center-notify';
    el.innerHTML = `
      <div class="center-notify-box">
        <div class="center-notify-msg">${msg}</div>
        <button class="center-notify-close" onclick="this.closest('.center-notify').remove()">확인</button>
      </div>
    `;
    document.body.appendChild(el);

    // 5초 후 자동 제거
    setTimeout(() => { if (el.parentNode) el.remove(); }, 5000);
  }
  Unlock.setCenterNotifyCallback(centerNotify);

  // ── 자동 저장
  function autosave() { State.saveState(state); }

  // ── 상단 HUD 갱신
  function updateHud() {
    setText('hud-money',     fmt(state.money));
    setText('hud-inventory', `${state.inventory.length}장`);
    setText('hud-brush',     `붓 ${state.brushLevel || 1}단계`);
    const wc = state.counters.watercolorMade;
    setText('hud-wc-count',  `수채화 ${wc}/4`);
  }

  // ── 화면 전환
  const ALL_SCREENS = [
    'screen-menu', 'screen-studio', 'screen-atelier',
    'screen-inventory', 'screen-shop', 'screen-devmode',
    'screen-auction-engine',  // v8 Phase 3: 경매 엔진 화면
    'screen-cat-market',      // v8 Phase 4: 고양이 시장
    'screen-museum',          // v8 Phase 4: 박물관 엔딩
  ];

  function switchScreen(name) {
    // 기존 캔버스 작업 중이면 정리
    if (activeAtelier && name !== 'screen-atelier') {
      activeAtelier.destroy();
      activeAtelier = null;
    }

    // 모든 화면 숨기고 원하는 것만 보이기
    for (const s of ALL_SCREENS) {
      const el = $(s);
      if (el) el.classList.toggle('hidden', s !== name);
    }

    // 화면별 진입 렌더
    if (name === 'screen-menu')           renderMenu();
    if (name === 'screen-studio')         renderStudio();
    if (name === 'screen-inventory')      renderInventoryScreen();
    if (name === 'screen-shop')           renderShop();
    if (name === 'screen-devmode')        renderDevModeScreen();
    if (name === 'screen-auction-engine') renderAuctionEngine();
    if (name === 'screen-cat-market')     renderCatMarketScreen();
    if (name === 'screen-museum')         renderMuseumScreen();
  }

  // ── 시작 메뉴 렌더
  function renderMenu() {
    const container = $('screen-menu');
    if (!container) return;
    Menu.renderStartMenu(container, {
      onContinue: () => switchScreen('screen-studio'),
      onNewGame:  () => {
        state = State.resetAllData();
        autosave();
        switchScreen('screen-studio');
      },
      onDevMode: () => switchScreen('screen-devmode'),
    });
  }

  // ── 작업실 화면 렌더
  function renderStudio() {
    updateHud();
    const container = $('screen-studio');
    if (!container) return;

    // 해금된 그림 종류 목록
    const unlocked = Object.entries(state.unlockedTypes)
      .filter(([, v]) => v)
      .map(([k]) => k);

    const typeLabels = {
      watercolor:  '🎨 수채화',
      pointillism: '🔸 점묘화',
      oilpainting: '🖼 유화',
      gratage:     '⚒ 그라타주',
    };

    // 작업실 UI 구성
    container.innerHTML = `
      <div class="studio8-wrap">

        <!-- 왼쪽: 그림 종류 선택 -->
        <aside class="studio8-left">
          <h2>그림 종류 선택</h2>
          <div class="studio8-type-list" id="studio8-type-list">
            ${['watercolor','pointillism','oilpainting','gratage'].map(type => {
              const isUnlocked = state.unlockedTypes[type];
              const paintLvl = (state.paintLevels || {})[type] || 0;
              return `
                <div class="studio8-type-card ${isUnlocked ? '' : 'studio8-locked'}"
                     data-type="${type}">
                  <div class="studio8-type-name">${typeLabels[type]}</div>
                  <div class="studio8-type-meta">
                    ${isUnlocked
                      ? `물감 ${paintLvl}단계 · 붓 ${state.brushLevel||1}단계`
                      : '🔒 잠김 (게임 진행으로 해금)'}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- 이동 버튼들 -->
          <div class="studio8-nav">
            <button id="btn-go-inventory">🖼 보유 그림 (${state.inventory.length}장)</button>
            <button id="btn-go-shop">🛒 상점</button>
            <button id="btn-go-catmarket">🐱 고양이 시장</button>
            <button id="btn-go-auction" class="${state.unlocks.auctionOpen ? '' : 'studio8-disabled'}"
              ${state.unlocks.auctionOpen ? '' : 'disabled'}>
              ⚖ 경매장 ${state.unlocks.auctionOpen ? '' : '(잠김)'}
            </button>
            ${state.unlocks.museumEnding ? `<button id="btn-go-museum" class="studio8-museum-btn">🏛 박물관 엔딩</button>` : ''}
          </div>
        </aside>

        <!-- 가운데: 그림 선택 패널 -->
        <main class="studio8-center" id="studio8-center">
          <div class="studio8-center-hint">왼쪽에서 그림 종류를 고르면<br>원본 그림 목록이 여기 나타납니다</div>
        </main>

      </div>
    `;

    // 그림 종류 카드 클릭 → 원본 선택 패널
    container.querySelectorAll('.studio8-type-card:not(.studio8-locked)').forEach(card => {
      card.onclick = () => {
        const type = card.getAttribute('data-type');
        renderPaintingPicker(type);
        // 선택 강조
        container.querySelectorAll('.studio8-type-card').forEach(c => c.classList.remove('studio8-selected'));
        card.classList.add('studio8-selected');
      };
    });

    // 보유 그림 버튼
    $('btn-go-inventory').onclick = () => switchScreen('screen-inventory');

    // 상점 버튼
    $('btn-go-shop').onclick = () => switchScreen('screen-shop');

    // 고양이 시장 버튼
    const btnCatMarket = $('btn-go-catmarket');
    if (btnCatMarket) btnCatMarket.onclick = () => switchScreen('screen-cat-market');

    // 경매장 버튼 — v8 Phase 3 구현
    const btnAuction = $('btn-go-auction');
    if (btnAuction && !btnAuction.disabled) {
      btnAuction.onclick = () => goToAuction();
    }

    // 박물관 엔딩 버튼 (조건 충족 시만 렌더됨)
    const btnMuseum = $('btn-go-museum');
    if (btnMuseum) btnMuseum.onclick = () => switchScreen('screen-museum');
  }

  // ── 경매장 진입 (v8 Phase 5: guards.js로 교체)
  // 비유: "경매장 가기" 버튼을 누르면 이 함수가 문지기 역할을 합니다.
  //       guards.js 가 자금을 확인하고, 부족하면 모달을 띄워요.
  //       자체 검증 모드(디버그)에서는 가드가 무력화되어 바로 입장 가능해요.
  function goToAuction() {
    if (Guards) {
      // guards.js 전역 가드 사용
      const ok = Guards.canEnterAuction({
        currentMoney: state.money,
        onEnterDebug: () => {
          // 모달에서 「자체 검증 모드 진입」 클릭 시 디버그 패널 열기
          if (DebugPanel) DebugPanel.openPanel();
          else switchScreen('screen-devmode');
        },
      });
      if (!ok) return;
    }
    switchScreen('screen-auction-engine');
  }

  // ── 경매 엔진 화면 렌더 (v9 패치: fetch 제거 — HTML 인라인, JS는 index.html에서 미리 로드)
  // 비유: 경매장 내부 인테리어(HTML)를 외부에서 가져오는 게 아니라
  //       index.html에 이미 붙여 넣어 뒀으므로, 그냥 불을 켜고(show) 엔진 시동만 겁니다.
  function renderAuctionEngine() {
    const container = $('screen-auction-engine');
    if (!container) return;

    // v6 엔진 CSS 활성화
    const auctionCss = document.getElementById('auction-css');
    if (auctionCss) auctionCss.disabled = false;

    // 두 번째 이후 진입: v6 상태 리셋 후 시작 화면으로 돌아가기
    if (container.dataset.loaded === '1') {
      if (window.MN9_AuctionEngine) {
        if (typeof window.MN9_AuctionEngine.resetForV9 === 'function') {
          window.MN9_AuctionEngine.resetForV9();  // 부팅 가드 초기화
        }
        if (typeof window.MN9_AuctionEngine.resetState === 'function') {
          window.MN9_AuctionEngine.resetState();  // 경매 시작 화면으로 복귀
        }
        if (typeof window.MN9_AuctionEngine.bootForV9 === 'function') {
          window.MN9_AuctionEngine.bootForV9();   // 엔진 재시동
        }
      }
      return;
    }
    container.dataset.loaded = '1';

    // 첫 진입: v6-engine.js가 index.html에서 이미 로드됨 — bootForV9으로 엔진 시동
    // (DOMContentLoaded 이벤트 없이 강제 main() 호출)
    if (window.MN9_AuctionEngine && typeof window.MN9_AuctionEngine.bootForV9 === 'function') {
      window.MN9_AuctionEngine.bootForV9();
    } else {
      console.error('[game] MN9_AuctionEngine.bootForV9 없음 — v6-engine.js 로드 순서 확인 필요');
    }
  }

  // ── 원본 그림 선택 패널 (작업실 가운데 영역)
  function renderPaintingPicker(type) {
    const center = $('studio8-center');
    if (!center) return;

    const ownedFilenames = new Set(
      (state.inventory || []).filter(it => it.type === type).map(it => it.filename)
    );
    const paintings = (MANIFEST.paintings[type] || []).filter(p => ownedFilenames.has(p.filename));
    const typeLabels = {
      watercolor: '수채화', pointillism: '점묘화',
      oilpainting: '유화',  gratage: '그라타주',
    };

    center.innerHTML = `
      <div class="picker8-wrap">
        <h3>${typeLabels[type]} 원본 선택</h3>
        <p class="picker8-hint">원본을 고르면 그 그림을 보면서 모작을 그려요.</p>
        <div class="picker8-grid">
          ${paintings.map(p => `
            <div class="picker8-card" data-type="${type}" data-grade="${p.grade}">
              <img
                class="picker8-thumb"
                src="assets/paintings/${p.filename}"
                alt="${p.title}"
                onerror="this.style.display='none'"
              />
              <div class="picker8-title">${p.title}</div>
              <div class="picker8-meta">${p.artist} · ${p.grade}등급 원본</div>
              <div class="picker8-price">원본가 $${p.basePrice}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // 원본 카드 클릭 → 모작 시작
    center.querySelectorAll('.picker8-card').forEach(card => {
      card.onclick = () => {
        const t = card.getAttribute('data-type');
        const g = parseInt(card.getAttribute('data-grade'), 10);
        const entry = paintings.find(p => p.grade === g);
        if (entry) startAtelier(t, entry);
      };
    });
  }

  // ── 모작 시작 (작업실 캔버스 화면으로 전환)
  function startAtelier(type, paintingEntry) {
    // 손목 보호 모드를 아직 선택한 적 없으면 1회 팝업으로 먼저 묻기
    const WristMode    = global.MN9_WristMode;
    const StartupPopup = global.MN9_StartupPopup;
    if (WristMode && StartupPopup && !WristMode.hasBeenAsked(state)) {
      StartupPopup.showPopup(function(chosen) {
        WristMode.setWristMode(state, chosen);
        autosave();
        startAtelier(type, paintingEntry); // 선택 완료 후 재진입
      });
      return;
    }

    switchScreen('screen-atelier');
    const container = $('screen-atelier');
    if (!container) return;

    // 뒤로가기 버튼 영역 + 캔버스 영역 구성
    container.innerHTML = `
      <div class="atelier8-outer">
        <div class="atelier8-topbar">
          <button id="btn-atelier-back">◀ 작업실로</button>
          <span class="atelier8-topbar-title">모작 진행 중 — ${paintingEntry.title}</span>
        </div>
        <div class="atelier8-body" id="atelier8-body"></div>
      </div>
    `;

    $('btn-atelier-back').onclick = () => {
      if (activeAtelier) { activeAtelier.destroy(); activeAtelier = null; }
      switchScreen('screen-studio');
    };

    const body = $('atelier8-body');
    const result = Atelier.startAtelier({
      container: body,
      type,
      paintingEntry,
      state,
      onComplete: (resultItem) => {
        // 모작 완성 → 판매/보관 선택 창
        Sell.showSellDialog(resultItem, {
          onSell: (item) => {
            state.money += item.value;
            state.counters.totalMade++;
            if (type === 'watercolor') state.counters.watercolorMade++;
            toast(`판매 완료! +${fmt(item.value)}`);
            Unlock.checkUnlocks(state);
            autosave();
            updateHud();
            switchScreen('screen-studio');
          },
          onKeep: (item) => {
            state.inventory.push(item);
            state.counters.totalMade++;
            if (type === 'watercolor') state.counters.watercolorMade++;
            toast(`보관 완료! 인벤토리에 넣었어요`);
            Unlock.checkUnlocks(state);
            autosave();
            updateHud();
            switchScreen('screen-studio');
          },
        });
      },
    });

    activeAtelier = result;
  }

  // ── 보유 그림 화면
  function renderInventoryScreen() {
    updateHud();
    const container = $('screen-inventory');
    if (!container) return;

    container.innerHTML = `
      <div class="inv8-outer">
        <div class="inv8-topbar">
          <button id="btn-inv-back">◀ 작업실로</button>
          <span class="inv8-topbar-title">보유 그림 (${state.inventory.length}장)</span>
        </div>
        <div class="inv8-body" id="inv8-body"></div>
      </div>
    `;

    $('btn-inv-back').onclick = () => switchScreen('screen-studio');

    Inventory.renderInventory(
      $('inv8-body'),
      state.inventory,
      {
        // 현재 state 접근 (cat-assign 모듈용)
        getState: () => state,
        // 이 그림으로 모작 그리기
        onMakeCopy: (item) => {
          const type = item.type;
          const entry = (MANIFEST.paintings[type] || []).find(p => p.grade === item.grade);
          if (entry) startAtelier(type, entry);
          else toast('원본 정보를 찾을 수 없어요');
        },
        // 원본 팔기 (인벤토리에서 제거 + 자금 추가)
        onSellOriginal: (item) => {
          if (!confirm(`「${item.title}」을 ${fmt(item.value)}에 팔까요?`)) return;
          state.inventory = state.inventory.filter(it => it.id !== item.id);
          state.money += item.value;
          toast(`판매! +${fmt(item.value)}`);
          Unlock.checkUnlocks(state);
          autosave();
          updateHud();
          renderInventoryScreen();
        },
        // 고양이 배치 변경 후 화면 갱신 (E7)
        onAssignChanged: () => {
          autosave();
          updateHud();
          renderInventoryScreen();
        },
        // 자체 출품 (해금 시만 표시)
        onSelfSubmit: (item) => {
          if (!Submit) { toast('자체 출품 모듈 없음'); return; }
          Submit.showSubmitDialog(item, state, {
            onSubmit: ({ item: it, startPrice, estimatedPrice }) => {
              // 경매 엔진에 자체 출품 파라미터 전달 후 경매 화면으로 이동
              // v6 엔진은 별도 파라미터 주입 방식을 사용하므로
              // window에 임시 저장 후 경매 화면에서 읽음
              global._mn9SelfSubmit = { item: it, startPrice, estimatedPrice };
              toast(`「${it.title}」 출품 등록! 경매를 시작해요`);
              switchScreen('screen-auction-engine');
            },
            onCancel: () => {},
          });
        },
        selfListingUnlocked: !!(state.unlocks && state.unlocks.selfListing),
      }
    );
  }

  // ── 상점 화면 (붓·물감 탭 방식, Phase 4 신규 모듈 사용)
  function renderShop(activeTab) {
    updateHud();
    const container = $('screen-shop');
    if (!container) return;

    const tab = activeTab || 'paint'; // 기본 탭: 물감

    container.innerHTML = `
      <div class="shop8-outer">
        <div class="shop8-topbar">
          <button id="btn-shop-back">◀ 작업실로</button>
          <span class="shop8-topbar-title">상점 — 현재 자금: ${fmt(state.money)}</span>
        </div>

        <!-- 탭 선택 -->
        <div class="shop8-tabs">
          <button class="shop8-tab ${tab === 'paint' ? 'shop8-tab-active' : ''}" data-tab="paint">🎨 물감 상점</button>
          <button class="shop8-tab ${tab === 'brush' ? 'shop8-tab-active' : ''}" data-tab="brush">🖌 붓 상점</button>
        </div>

        <!-- 탭 내용 -->
        <div class="shop8-body" id="shop8-tab-content"></div>
      </div>
    `;

    // 뒤로가기
    $('btn-shop-back').onclick = () => switchScreen('screen-studio');

    // 탭 전환
    container.querySelectorAll('.shop8-tab').forEach(btn => {
      btn.onclick = () => renderShop(btn.getAttribute('data-tab'));
    });

    const tabContent = $('shop8-tab-content');

    if (tab === 'paint' && PaintShop) {
      // 물감 상점 탭 — PaintShop 모듈 사용
      PaintShop.renderPaintShop(tabContent, state, {
        onBuy: (type) => {
          toast(`${PaintShop.TYPE_LABELS[type]} 업그레이드!`);
          Unlock.checkUnlocks(state);
          autosave();
          renderShop('paint');
        },
      });
    } else if (tab === 'brush' && BrushShop) {
      // 붓 상점 탭 — BrushShop 모듈 사용
      BrushShop.renderBrushShop(tabContent, state, {
        onBuy: () => {
          toast(`붓 ${state.brushLevel}단계로 업그레이드!`);
          Unlock.checkUnlocks(state);
          autosave();
          renderShop('brush');
        },
      });
    } else {
      // 모듈 없을 때 fallback
      tabContent.innerHTML = '<div class="shop8-fallback">상점 모듈을 불러오는 중...</div>';
    }
  }

  // ── 고양이 시장 화면 (Phase 4 신규)
  function renderCatMarketScreen() {
    updateHud();
    const container = $('screen-cat-market');
    if (!container) return;

    container.innerHTML = `
      <div class="catmkt-outer">
        <div class="catmkt-topbar">
          <button id="btn-catmkt-back">◀ 작업실로</button>
          <span class="catmkt-topbar-title">고양이 시장 — 도우미 채용소</span>
        </div>
        <div class="catmkt-body" id="catmkt-body"></div>
      </div>
    `;

    $('btn-catmkt-back').onclick = () => switchScreen('screen-studio');

    if (CatMarket) {
      CatMarket.renderCatMarket(
        $('catmkt-body'),
        state,
        {
          onHire: (catId) => {
            const cat = Cats && Cats.CAT_DEFS[catId];
            toast(`${cat ? cat.emoji + ' ' + cat.name : catId} 영입 완료! 30초마다 자동 모작을 해줄 거예요`);
            Unlock.checkUnlocks(state);
            autosave();
            updateHud();
            // 화면 새로고침
            renderCatMarketScreen();
          },
          onReroll: () => {
            toast('고양이 시장 새로고침!');
            autosave();
            updateHud();
            renderCatMarketScreen();
          },
          onClose: () => switchScreen('screen-studio'),
        }
      );
    } else {
      $('catmkt-body').innerHTML = '<div class="catmkt-empty">고양이 시장 모듈을 불러오는 중...</div>';
    }
  }

  // ── 박물관 엔딩 화면 (Phase 4 신규)
  function renderMuseumScreen() {
    updateHud();
    const container = $('screen-museum');
    if (!container) return;

    container.innerHTML = `
      <div class="museum8-screen-outer">
        <div class="museum8-topbar">
          <button id="btn-museum-back">◀ 작업실로</button>
          <span class="museum8-topbar-title">박물관 엔딩</span>
        </div>
        <div class="museum8-body" id="museum8-body"></div>
      </div>
    `;

    $('btn-museum-back').onclick = () => switchScreen('screen-studio');

    if (Museum) {
      Museum.renderMuseumEnding(
        $('museum8-body'),
        state,
        {
          onNewGame: () => {
            state = State.resetAllData();
            autosave();
            switchScreen('screen-menu');
          },
          onContinue: () => {
            autosave();
            updateHud();
            switchScreen('screen-studio');
          },
        }
      );
    }
  }

  // ── 자체 검증 모드 화면
  function renderDevModeScreen() {
    const container = $('screen-devmode');
    if (!container) return;

    // 뒤로가기 버튼 영역 구성
    container.innerHTML = `
      <div class="dev8-outer">
        <div class="dev8-topbar">
          <button id="btn-dev-back">◀ 시작 메뉴로</button>
          <button id="btn-dev-to-studio">▶ 작업실로 이동</button>
          <button id="btn-dev-open-panel">⚙ 풀 패키지 패널 열기 (Ctrl+Shift+D)</button>
        </div>
        <div class="dev8-body" id="dev8-body"></div>
      </div>
    `;

    $('btn-dev-back').onclick    = () => switchScreen('screen-menu');
    $('btn-dev-to-studio').onclick = () => switchScreen('screen-studio');

    // Phase 5: 우측 슬라이드 패널 열기 버튼
    const btnPanel = $('btn-dev-open-panel');
    if (btnPanel) {
      btnPanel.onclick = () => {
        if (DebugPanel) DebugPanel.openPanel();
      };
    }

    DevMode.renderDevMode(
      $('dev8-body'),
      () => state,
      () => { autosave(); updateHud(); }
    );
  }

  // ── Ctrl+Shift+D 단축키 — Phase 5: DebugPanel 토글 우선, 없으면 화면 전환
  Menu.registerDevShortcut(() => {
    if (DebugPanel) {
      DebugPanel.togglePanel();
    } else {
      switchScreen('screen-devmode');
    }
  });

  // ── 초기 진입
  function init() {
    Unlock.checkUnlocks(state);

    // 영입된 고양이 타이머 복구 (페이지 새로고침 후에도 자동 모작 재개)
    if (Cats) {
      Cats.setToastCallback(toast);
      Cats.resumeHiredCats(state);
    }

    // Phase 5: DebugPanel 초기화 (우측 슬라이드 패널 풀 패키지)
    if (DebugPanel) {
      DebugPanel.init({
        getState:       () => state,
        onUpdate:       () => { autosave(); updateHud(); },
        onSwitchScreen: switchScreen,
      });
    }

    // Phase 5: Guards 가드 우회 기본값 (시작 시엔 가드 활성)
    if (Guards) Guards.setBypassGuards(false);

    switchScreen('screen-menu');
    updateHud();
  }

  document.addEventListener('DOMContentLoaded', init);

  // 디버그용 글로벌 접근 (콘솔에서 MN9_Game.state() 로 확인 가능)
  global.MN9_Game = {
    state: () => state,
    switchScreen,
    toast,
    autosave: () => Persist.saveState(state),  // v6 경매 엔진이 자체 호출하는 자동 저장 브리지
  };

})(typeof window !== 'undefined' ? window : globalThis);
