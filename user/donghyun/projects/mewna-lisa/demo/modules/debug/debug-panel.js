/* ============================================================
   debug-panel.js — 자체 검증 모드 풀 패키지 (락-인 결정 17)
   ============================================================
   비유: 게임을 테스트할 때 쓰는 '치트 패널'입니다. 화면 오른쪽에서
   서랍처럼 밀려 나오는 250px 패널이에요. 4개의 탭으로 나뉘어 있어요.
   - Ctrl+Shift+D 로 언제든 토글 (열고 닫기)
   - 시작 메뉴 「자체 검증 모드」 버튼으로도 진입 가능

   4탭 구조:
   ① 자원 조정  — 자금·붓·물감·인벤토리 직접 수정
   ② 단계 점프  — 해금 스위치, 경매 라운드, 고양이 토글
   ③ 경매 디버그 — 낙찰 강제·CPU 배율·시작가·예상가·인격 분포
   ④ 상태 덤프  — state JSON 보기·복사·붙여넣기·백업·초기화
   ============================================================ */

(function (global) {
  'use strict';

  // ──────────────────────────────────────────────────────────
  // 내부 상태 (패널 열림 여부, 현재 탭)
  // ──────────────────────────────────────────────────────────
  let _isOpen  = false;
  let _curTab  = 'resources';   // resources | phases | auction | dump
  let _getState   = null;       // () → state 반환
  let _onUpdate   = null;       // () → HUD 갱신 등 콜백
  let _onSwitchScreen = null;   // (screenName) → 화면 전환

  // ──────────────────────────────────────────────────────────
  // 패널 DOM 생성 (최초 1회)
  // ──────────────────────────────────────────────────────────
  function _ensurePanel() {
    if (document.getElementById('dbg-panel-root')) return;

    // 패널 뼈대
    const root = document.createElement('div');
    root.id = 'dbg-panel-root';
    root.className = 'dbg-panel-closed';
    root.innerHTML = `
      <div class="dbg-handle" id="dbg-handle" title="자체 검증 패널 열기/닫기 (Ctrl+Shift+D)">⚙</div>
      <div class="dbg-inner" id="dbg-inner">
        <div class="dbg-title-row">
          <span class="dbg-title">⚙ 자체 검증</span>
          <button class="dbg-close-btn" id="dbg-close-btn">✕</button>
        </div>
        <div class="dbg-tabs" id="dbg-tabs">
          <button class="dbg-tab" data-tab="resources">① 자원</button>
          <button class="dbg-tab" data-tab="phases">② 단계</button>
          <button class="dbg-tab" data-tab="auction">③ 경매</button>
          <button class="dbg-tab" data-tab="dump">④ 덤프</button>
        </div>
        <div class="dbg-content" id="dbg-content"></div>
      </div>
    `;
    document.body.appendChild(root);

    // 탭 클릭
    root.querySelectorAll('.dbg-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        _curTab = btn.getAttribute('data-tab');
        _renderTab();
      });
    });

    // 닫기 버튼
    document.getElementById('dbg-close-btn').addEventListener('click', closePanel);

    // 핸들 클릭
    document.getElementById('dbg-handle').addEventListener('click', togglePanel);
  }

  // ──────────────────────────────────────────────────────────
  // 탭 렌더 분기
  // ──────────────────────────────────────────────────────────
  function _renderTab() {
    const content = document.getElementById('dbg-content');
    if (!content) return;

    // 탭 활성 표시
    document.querySelectorAll('.dbg-tab').forEach(btn => {
      btn.classList.toggle('dbg-tab-active', btn.getAttribute('data-tab') === _curTab);
    });

    if (_curTab === 'resources') _renderResources(content);
    else if (_curTab === 'phases')    _renderPhases(content);
    else if (_curTab === 'auction')   _renderAuction(content);
    else if (_curTab === 'dump')      _renderDump(content);
  }

  // ──────────────────────────────────────────────────────────
  // ① 자원 조정 탭
  // ──────────────────────────────────────────────────────────
  function _renderResources(el) {
    const s = _getState();
    const fmt = v => '$' + Math.round(v).toLocaleString('en-US');

    // 인벤토리에 추가할 모조품 종류 옵션
    const typeOpts = [
      { v:'watercolor',  l:'수채화' },
      { v:'pointillism', l:'점묘화' },
      { v:'oilpainting', l:'유화'   },
      { v:'gratage',     l:'그라타주'},
    ];
    const gradeOpts = [1,2,3,4,5].map(g => `<option value="${g}">${g}등급</option>`).join('');

    el.innerHTML = `
      <!-- 자금 조정 -->
      <div class="dbg-section">
        <div class="dbg-section-hd">💰 자금 조정</div>
        <div class="dbg-row">현재: <strong>${fmt(s.money)}</strong></div>
        <div class="dbg-row dbg-btn-row">
          <button class="dbg-btn" data-act="money-plus">+$1,000</button>
          <button class="dbg-btn" data-act="money-minus">-$1,000</button>
          <button class="dbg-btn" data-act="money-set30k">=$30,000</button>
        </div>
      </div>

      <!-- 붓 레벨 -->
      <div class="dbg-section">
        <div class="dbg-section-hd">🖌 붓 레벨</div>
        <div class="dbg-row">
          <select id="dbg-brush-sel" class="dbg-sel">
            ${[1,2,3,4,5].map(lvl =>
              `<option value="${lvl}" ${(s.brushLevel||1)===lvl?'selected':''}>${lvl}단계</option>`
            ).join('')}
          </select>
          <button class="dbg-btn" data-act="brush-set">설정</button>
        </div>
      </div>

      <!-- 물감 레벨 4종 -->
      <div class="dbg-section">
        <div class="dbg-section-hd">🎨 물감 레벨 (0~4)</div>
        ${typeOpts.map(({v, l}) => `
          <div class="dbg-row">
            <span class="dbg-lbl">${l}</span>
            <input type="range" class="dbg-range" id="dbg-paint-${v}"
              min="0" max="4" value="${(s.paintLevels||{})[v]||0}">
            <span id="dbg-paint-${v}-val">${(s.paintLevels||{})[v]||0}</span>
            <button class="dbg-btn" data-act="paint-set" data-type="${v}">적용</button>
          </div>
        `).join('')}
      </div>

      <!-- 경매 가드 우회 -->
      <div class="dbg-section">
        <div class="dbg-section-hd">🚪 경매 가드 우회</div>
        <div class="dbg-row">
          <label class="dbg-toggle-wrap">
            <input type="checkbox" id="dbg-bypass-guard"
              ${(global._mn9Debug && global._mn9Debug.bypassGuards) ? 'checked' : ''}>
            자금 부족 차단 무력화 (어떤 자금으로도 경매 입장)
          </label>
        </div>
        <div class="dbg-hint">켜면 $0으로도 경매장에 들어갈 수 있어요.</div>
      </div>

      <!-- 모작 완성 임계율 -->
      <div class="dbg-section">
        <div class="dbg-section-hd">🎯 모작 완성 임계율</div>
        <div class="dbg-row">
          <input type="range" id="dbg-complete-threshold" min="50" max="99" step="5"
            value="${Math.round((s.debug && s.debug.completeThreshold != null ? s.debug.completeThreshold : 0.90) * 100)}">
          <span id="dbg-complete-threshold-val">${Math.round((s.debug && s.debug.completeThreshold != null ? s.debug.completeThreshold : 0.90) * 100)}%</span>
          <button class="dbg-btn" data-act="threshold-set">적용</button>
        </div>
        <div class="dbg-hint">현재 모작 화면에 즉시 반영돼요. 기본값 90%.</div>
      </div>

      <!-- 모조품 추가 -->
      <div class="dbg-section">
        <div class="dbg-section-hd">🖼 모조품 추가</div>
        <div class="dbg-row">
          <select id="dbg-add-type" class="dbg-sel">
            ${typeOpts.map(({v,l}) => `<option value="${v}">${l}</option>`).join('')}
          </select>
          <select id="dbg-add-grade" class="dbg-sel">${gradeOpts}</select>
          <button class="dbg-btn" data-act="inv-add">추가</button>
        </div>
        <div class="dbg-row">
          <button class="dbg-btn dbg-btn-danger" data-act="inv-clear">인벤 비우기</button>
        </div>
      </div>
    `;

    // 경매 가드 우회 체크박스
    const bypassCk = el.querySelector('#dbg-bypass-guard');
    if (bypassCk) {
      bypassCk.addEventListener('change', () => {
        if (!global._mn9Debug) global._mn9Debug = {};
        global._mn9Debug.bypassGuards = bypassCk.checked;
        // MN9_Guards 모듈에도 반영
        if (global.MN9_Guards) global.MN9_Guards.setBypassGuards(bypassCk.checked);
      });
    }

    // 완성 임계율 슬라이더 실시간 숫자 표시
    const threshRange = el.querySelector('#dbg-complete-threshold');
    const threshVal   = el.querySelector('#dbg-complete-threshold-val');
    if (threshRange && threshVal) {
      threshRange.addEventListener('input', () => { threshVal.textContent = threshRange.value + '%'; });
    }

    // 물감 슬라이더 실시간 숫자 표시
    typeOpts.forEach(({v}) => {
      const rangeEl = el.querySelector(`#dbg-paint-${v}`);
      const valEl   = el.querySelector(`#dbg-paint-${v}-val`);
      if (rangeEl && valEl) {
        rangeEl.addEventListener('input', () => { valEl.textContent = rangeEl.value; });
      }
    });

    // 버튼 액션 처리 (onclick = 매 렌더마다 새 핸들러 자동 교체)
    el.onclick = function(e) {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      const st  = _getState();

      if (act === 'money-plus')  { st.money = Math.max(0, st.money + 1000); }
      else if (act === 'money-minus') { st.money = Math.max(0, st.money - 1000); }
      else if (act === 'money-set30k') { st.money = 30000; }
      else if (act === 'brush-set') {
        const sel = el.querySelector('#dbg-brush-sel');
        if (sel) st.brushLevel = parseInt(sel.value, 10);
      }
      else if (act === 'paint-set') {
        const type  = btn.getAttribute('data-type');
        const range = el.querySelector(`#dbg-paint-${type}`);
        if (range) {
          if (!st.paintLevels) st.paintLevels = {};
          st.paintLevels[type] = parseInt(range.value, 10);
        }
      }
      else if (act === 'inv-add') {
        const type  = (el.querySelector('#dbg-add-type')  || {}).value || 'watercolor';
        const grade = parseInt((el.querySelector('#dbg-add-grade') || {}).value || '1', 10);
        _addFakeItem(st, type, grade);
      }
      else if (act === 'inv-clear') {
        if (confirm('인벤토리를 모두 비울까요?')) st.inventory = [];
      }
      else if (act === 'threshold-set') {
        const range = el.querySelector('#dbg-complete-threshold');
        if (range) {
          if (!st.debug) st.debug = {};
          st.debug.completeThreshold = parseInt(range.value, 10) / 100;
        }
      }
      else { return; }

      _onUpdate && _onUpdate();
      _renderTab();
    };
  }

  // 가짜 모조품 생성 헬퍼
  function _addFakeItem(st, type, grade) {
    const typeLabels = { watercolor:'수채화', pointillism:'점묘화', oilpainting:'유화', gratage:'그라타주' };
    const basePrices = { watercolor:120, pointillism:200, oilpainting:350, gratage:500 };
    const id = 'dbg_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
    const basePrice = (basePrices[type] || 100) * grade;
    const counterfeitGrade = Math.min(10, grade * 2 + Math.floor(Math.random() * 2));
    st.inventory.push({
      id,
      type,
      grade,
      filename: `${type}_${grade}.jpg`,
      title: `[디버그] ${typeLabels[type]} ${grade}등급`,
      artist: '디버그 작가',
      counterfeitGrade,
      value: Math.round(basePrice * 0.7),
      createdAt: Date.now(),
    });
  }

  // ──────────────────────────────────────────────────────────
  // ② 단계 점프 탭
  // ──────────────────────────────────────────────────────────
  function _renderPhases(el) {
    const s  = _getState();
    const u  = s.unlocks || {};
    const ut = s.unlockedTypes || {};
    const cu = u.catsUnlocked || {};
    const cats = s.cats || {};

    // 9개 unlock 토글 정의
    const unlockRows = [
      { key:'auctionOpen',   label:'경매장 해금',       isUnlock: true },
      { key:'pointillism',   label:'점묘화 해금',        isType: true },
      { key:'oilpainting',   label:'유화 해금',          isType: true },
      { key:'gratage',       label:'그라타주 해금',      isType: true },
      { key:'selfListing',   label:'자체 출품 해금',     isUnlock: true },
      { key:'museumEnding',  label:'박물관 엔딩 해금',   isUnlock: true },
    ];

    const catRows = [
      { id:'dorom',  name:'도롬 (수채화)' },
      { id:'ati',    name:'아티 (점묘화)' },
      { id:'oil',    name:'오일 (유화)'   },
      { id:'gold',   name:'골드 (그라타주)'},
      { id:'gongja', name:'공작 (박물관)' },
    ];

    el.innerHTML = `
      <!-- 해금 토글 -->
      <div class="dbg-section">
        <div class="dbg-section-hd">🔓 해금 토글</div>
        ${unlockRows.map(row => {
          const checked = row.isType ? !!ut[row.key] : !!u[row.key];
          return `<div class="dbg-row">
            <label class="dbg-toggle-wrap">
              <input type="checkbox" class="dbg-ck" data-unlock="${row.key}"
                data-is-type="${row.isType ? '1' : '0'}"
                ${checked ? 'checked' : ''}>
              ${row.label}
            </label>
          </div>`;
        }).join('')}
        <div class="dbg-row dbg-btn-row">
          <button class="dbg-btn" data-act="unlock-all">전체 해금</button>
          <button class="dbg-btn dbg-btn-danger" data-act="lock-all">전체 잠금</button>
        </div>
      </div>

      <!-- 수채화 카운터 -->
      <div class="dbg-section">
        <div class="dbg-section-hd">📊 카운터</div>
        <div class="dbg-row">
          수채화 누적: <strong>${s.counters ? s.counters.watercolorMade : 0}</strong>
          <button class="dbg-btn" data-act="wc-plus">+1</button>
        </div>
      </div>

      <!-- 경매 라운드 -->
      <div class="dbg-section">
        <div class="dbg-section-hd">⚖ 경매 라운드</div>
        <div class="dbg-row">현재: <strong>${u.auctionRounds || 1}라운드</strong></div>
        <div class="dbg-row dbg-btn-row">
          <button class="dbg-btn" data-act="rounds-1">1라운드</button>
          <button class="dbg-btn" data-act="rounds-3">3라운드</button>
          <button class="dbg-btn" data-act="rounds-5">5라운드</button>
        </div>
      </div>

      <!-- 고양이 토글 -->
      <div class="dbg-section">
        <div class="dbg-section-hd">🐱 고양이 도우미 토글</div>
        ${catRows.map(cat => {
          const unlocked = !!cu[cat.id];
          const hired    = !!(cats[cat.id] && cats[cat.id].hired);
          return `<div class="dbg-row">
            <label class="dbg-toggle-wrap">
              <input type="checkbox" class="dbg-cat-ck" data-cat="${cat.id}"
                ${unlocked ? 'checked' : ''}>
              ${cat.name} 해금
            </label>
            <span class="dbg-cat-status">${hired ? '(영입됨)' : '(미영입)'}</span>
          </div>`;
        }).join('')}
      </div>
    `;

    // 체크박스 변경
    el.querySelectorAll('.dbg-ck').forEach(ck => {
      ck.addEventListener('change', () => {
        const st      = _getState();
        const key     = ck.getAttribute('data-unlock');
        const isType  = ck.getAttribute('data-is-type') === '1';
        if (isType) {
          if (!st.unlockedTypes) st.unlockedTypes = {};
          st.unlockedTypes[key] = ck.checked;
        } else {
          if (!st.unlocks) st.unlocks = {};
          st.unlocks[key] = ck.checked;
        }
        _onUpdate && _onUpdate();
      });
    });

    el.querySelectorAll('.dbg-cat-ck').forEach(ck => {
      ck.addEventListener('change', () => {
        const st  = _getState();
        const catId = ck.getAttribute('data-cat');
        if (!st.unlocks) st.unlocks = {};
        if (!st.unlocks.catsUnlocked) st.unlocks.catsUnlocked = {};
        st.unlocks.catsUnlocked[catId] = ck.checked;
        _onUpdate && _onUpdate();
      });
    });

    // 버튼 액션 (onclick = 매 렌더마다 새 핸들러 자동 교체)
    el.onclick = function(e) {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      const st  = _getState();

      if (act === 'unlock-all') {
        st.unlockedTypes.watercolor = st.unlockedTypes.pointillism =
        st.unlockedTypes.oilpainting = st.unlockedTypes.gratage = true;
        st.unlocks.auctionOpen = st.unlocks.selfListing = st.unlocks.museumEnding = true;
        st.unlocks.auctionRounds = 5;
        if (!st.unlocks.catsUnlocked) st.unlocks.catsUnlocked = {};
        ['dorom_a','dorom_b','ati','oil','gold','gongja'].forEach(id => { st.unlocks.catsUnlocked[id] = true; });
      }
      else if (act === 'lock-all') {
        if (!confirm('모든 해금을 잠글까요? (수채화는 유지)')) return;
        st.unlockedTypes.pointillism = st.unlockedTypes.oilpainting = st.unlockedTypes.gratage = false;
        st.unlocks.auctionOpen = st.unlocks.selfListing = st.unlocks.museumEnding = false;
        st.unlocks.auctionRounds = 1;
        if (!st.unlocks.catsUnlocked) st.unlocks.catsUnlocked = {};
        ['ati','oil','gold','gongja'].forEach(id => { st.unlocks.catsUnlocked[id] = false; });
      }
      else if (act === 'wc-plus') {
        if (!st.counters) st.counters = { watercolorMade: 0, totalMade: 0 };
        st.counters.watercolorMade++;
        st.counters.totalMade++;
      }
      else if (act === 'rounds-1') { if (!st.unlocks) st.unlocks = {}; st.unlocks.auctionRounds = 1; }
      else if (act === 'rounds-3') { if (!st.unlocks) st.unlocks = {}; st.unlocks.auctionRounds = 3; }
      else if (act === 'rounds-5') { if (!st.unlocks) st.unlocks = {}; st.unlocks.auctionRounds = 5; }
      else { return; }

      _onUpdate && _onUpdate();
      _renderTab();
    };
  }

  // ──────────────────────────────────────────────────────────
  // ③ 경매 디버그 탭
  // ──────────────────────────────────────────────────────────
  function _renderAuction(el) {
    // 인격 8종 (v8 라벨)
    const personalities = [
      { key:'trend',   label:'시세형'  },
      { key:'save',    label:'절약형'  },
      { key:'crazy',   label:'광기형'  },
      { key:'client',  label:'고객형'  },
      { key:'lurk',    label:'잠복형'  },
      { key:'gamble',  label:'도박형'  },
      { key:'follow',  label:'추종형'  },
      { key:'snipe',   label:'저격형'  },
      { key:'random',  label:'랜덤'    },
    ];

    // window에 디버그 플래그 저장소 (v6 엔진이 읽어감)
    if (!global._mn9Debug) global._mn9Debug = {};
    const dbg = global._mn9Debug;

    el.innerHTML = `
      <!-- 낙찰 강제 -->
      <div class="dbg-section">
        <div class="dbg-section-hd">🏆 낙찰 강제</div>
        <div class="dbg-row">
          <label class="dbg-toggle-wrap">
            <input type="checkbox" id="dbg-force-win" ${dbg.forceWin ? 'checked' : ''}>
            다음 경매: 강제 본인 낙찰
          </label>
        </div>
        <div class="dbg-hint">경매 엔진에 플래그를 주입합니다 (window._mn9Debug.forceWin)</div>
      </div>

      <!-- CPU 자금 배율 -->
      <div class="dbg-section">
        <div class="dbg-section-hd">🤖 CPU 자금 배율</div>
        <div class="dbg-row">
          <input type="range" id="dbg-cpu-mult" min="1" max="100" step="1"
            value="${Math.round((dbg.cpuFundsMult || 1) * 10)}">
          <span id="dbg-cpu-mult-val">×${(dbg.cpuFundsMult || 1).toFixed(1)}</span>
        </div>
        <div class="dbg-hint">×0.1 ~ ×10 범위. CPU가 얼마나 세게 입찰하는지 조절해요.</div>
      </div>

      <!-- 시작가 강제 -->
      <div class="dbg-section">
        <div class="dbg-section-hd">🏷 시작가 강제</div>
        <div class="dbg-row">
          <input type="number" id="dbg-force-start" class="dbg-input"
            placeholder="비워두면 자동"
            value="${dbg.forceStartPrice != null ? dbg.forceStartPrice : ''}">
          <button class="dbg-btn" data-act="apply-start">적용</button>
          <button class="dbg-btn" data-act="clear-start">해제</button>
        </div>
      </div>

      <!-- 예상가 강제 -->
      <div class="dbg-section">
        <div class="dbg-section-hd">📋 예상가 강제</div>
        <div class="dbg-row">
          <input type="number" id="dbg-force-est" class="dbg-input"
            placeholder="비워두면 자동"
            value="${dbg.forceEstimatedPrice != null ? dbg.forceEstimatedPrice : ''}">
          <button class="dbg-btn" data-act="apply-est">적용</button>
          <button class="dbg-btn" data-act="clear-est">해제</button>
        </div>
      </div>

      <!-- 인격 분포 강제 -->
      <div class="dbg-section">
        <div class="dbg-section-hd">🎭 인격 분포 강제</div>
        ${personalities.map(p => {
          const cnt = (dbg.personalityForce || {})[p.key] || 0;
          return `<div class="dbg-row">
            <span class="dbg-lbl">${p.label}</span>
            <button class="dbg-btn dbg-btn-sm" data-act="pers-minus" data-pers="${p.key}">-</button>
            <span id="dbg-pers-${p.key}-cnt">${cnt}</span>
            <button class="dbg-btn dbg-btn-sm" data-act="pers-plus"  data-pers="${p.key}">+</button>
          </div>`;
        }).join('')}
        <div class="dbg-row">
          <button class="dbg-btn dbg-btn-danger" data-act="pers-clear">인격 분포 초기화</button>
        </div>
        <div class="dbg-hint">설정 시 CPU 인격이 이 수대로 배정됩니다.</div>
      </div>
    `;

    // 낙찰 강제 체크박스
    const forceWinCk = el.querySelector('#dbg-force-win');
    if (forceWinCk) {
      forceWinCk.addEventListener('change', () => {
        global._mn9Debug = global._mn9Debug || {};
        global._mn9Debug.forceWin = forceWinCk.checked;
      });
    }

    // CPU 배율 슬라이더 (1~100 → ÷10 = 0.1~10)
    const cpuRange = el.querySelector('#dbg-cpu-mult');
    const cpuVal   = el.querySelector('#dbg-cpu-mult-val');
    if (cpuRange && cpuVal) {
      cpuRange.addEventListener('input', () => {
        const mult = parseInt(cpuRange.value, 10) / 10;
        cpuVal.textContent = '×' + mult.toFixed(1);
        global._mn9Debug = global._mn9Debug || {};
        global._mn9Debug.cpuFundsMult = mult;
      });
    }

    // 버튼 액션 (onclick = 매 렌더마다 새 핸들러 자동 교체)
    el.onclick = function(e) {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      global._mn9Debug = global._mn9Debug || {};

      if (act === 'apply-start') {
        const v = parseFloat(el.querySelector('#dbg-force-start').value);
        if (!isNaN(v) && v > 0) global._mn9Debug.forceStartPrice = v;
      }
      else if (act === 'clear-start') {
        delete global._mn9Debug.forceStartPrice;
        el.querySelector('#dbg-force-start').value = '';
      }
      else if (act === 'apply-est') {
        const v = parseFloat(el.querySelector('#dbg-force-est').value);
        if (!isNaN(v) && v > 0) global._mn9Debug.forceEstimatedPrice = v;
      }
      else if (act === 'clear-est') {
        delete global._mn9Debug.forceEstimatedPrice;
        el.querySelector('#dbg-force-est').value = '';
      }
      else if (act === 'pers-plus') {
        const pers = btn.getAttribute('data-pers');
        if (!global._mn9Debug.personalityForce) global._mn9Debug.personalityForce = {};
        global._mn9Debug.personalityForce[pers] = ((global._mn9Debug.personalityForce[pers] || 0) + 1);
        const cntEl = el.querySelector(`#dbg-pers-${pers}-cnt`);
        if (cntEl) cntEl.textContent = global._mn9Debug.personalityForce[pers];
      }
      else if (act === 'pers-minus') {
        const pers = btn.getAttribute('data-pers');
        if (!global._mn9Debug.personalityForce) global._mn9Debug.personalityForce = {};
        global._mn9Debug.personalityForce[pers] = Math.max(0, (global._mn9Debug.personalityForce[pers] || 0) - 1);
        const cntEl = el.querySelector(`#dbg-pers-${pers}-cnt`);
        if (cntEl) cntEl.textContent = global._mn9Debug.personalityForce[pers];
      }
      else if (act === 'pers-clear') {
        global._mn9Debug.personalityForce = {};
        _renderTab();
      }
    };
  }

  // ──────────────────────────────────────────────────────────
  // ④ 상태 덤프 탭
  // ──────────────────────────────────────────────────────────
  function _renderDump(el) {
    el.innerHTML = `
      <!-- state JSON 보기 -->
      <div class="dbg-section">
        <div class="dbg-section-hd">📄 state JSON</div>
        <div class="dbg-row dbg-btn-row">
          <button class="dbg-btn" data-act="dump-show">화면에 보기</button>
          <button class="dbg-btn" data-act="dump-copy">클립보드 복사</button>
        </div>
        <pre id="dbg-dump-pre" class="dbg-dump-pre" style="display:none;max-height:200px;overflow:auto;"></pre>
      </div>

      <!-- state 붙여넣기 적용 -->
      <div class="dbg-section">
        <div class="dbg-section-hd">📥 state 붙여넣기 적용</div>
        <textarea id="dbg-paste-area" class="dbg-textarea"
          placeholder="JSON을 여기에 붙여넣고 불러오기 버튼을 눌러요"></textarea>
        <div class="dbg-row">
          <button class="dbg-btn" data-act="dump-paste">불러오기</button>
        </div>
      </div>

      <!-- 세이브 백업 / 초기화 -->
      <div class="dbg-section">
        <div class="dbg-section-hd">💾 세이브 관리</div>
        <div class="dbg-row dbg-btn-row">
          <button class="dbg-btn" data-act="backup-save">세이브 즉시 백업</button>
          <button class="dbg-btn" data-act="backup-load">백업 불러오기</button>
        </div>
        <div class="dbg-row">
          <button class="dbg-btn dbg-btn-danger" data-act="storage-reset">localStorage 초기화 + 새로고침</button>
        </div>
        <div class="dbg-hint" id="dbg-backup-status"></div>
      </div>
    `;

    el.onclick = function(e) {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      const st  = _getState();

      if (act === 'dump-show') {
        const pre = el.querySelector('#dbg-dump-pre');
        if (!pre) return;
        if (pre.style.display !== 'none') { pre.style.display = 'none'; return; }
        const json = JSON.stringify(st, (k, v) => {
          if (k === 'currentCanvas') return '[canvas — 저장 안 됨]';
          return v;
        }, 2);
        pre.textContent = json;
        pre.style.display = 'block';
      }
      else if (act === 'dump-copy') {
        const json = JSON.stringify(st, (k, v) => {
          if (k === 'currentCanvas') return undefined;
          return v;
        }, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(json)
            .then(() => alert('클립보드에 복사됐어요!'))
            .catch(() => alert('복사 실패 — 브라우저 권한을 확인해주세요'));
        } else {
          // fallback
          const ta = document.createElement('textarea');
          ta.value = json;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          alert('클립보드에 복사됐어요!');
        }
      }
      else if (act === 'dump-paste') {
        const textarea = el.querySelector('#dbg-paste-area');
        if (!textarea || !textarea.value.trim()) { alert('JSON을 먼저 붙여넣어 주세요'); return; }
        try {
          const parsed = JSON.parse(textarea.value);
          // state 필드를 직접 덮어쓰기
          const current = _getState();
          Object.assign(current, parsed);
          _onUpdate && _onUpdate();
          alert('state 적용 완료!');
          _renderTab();
        } catch(err) {
          alert('JSON 형식이 잘못됐어요: ' + err.message);
        }
      }
      else if (act === 'backup-save') {
        // 현재 state를 별도 백업 키에 저장
        const BACKUP_KEY = 'muthernuts_v9_debug_backup';
        const json = JSON.stringify(st, (k, v) => {
          if (k === 'currentCanvas') return undefined;
          return v;
        });
        try {
          localStorage.setItem(BACKUP_KEY, json);
          const statusEl = el.querySelector('#dbg-backup-status');
          if (statusEl) statusEl.textContent = '백업 완료: ' + new Date().toLocaleTimeString('ko-KR');
        } catch(err) {
          alert('백업 실패: ' + err.message);
        }
      }
      else if (act === 'backup-load') {
        const BACKUP_KEY = 'muthernuts_v9_debug_backup';
        const raw = localStorage.getItem(BACKUP_KEY);
        if (!raw) { alert('백업 데이터가 없어요'); return; }
        try {
          const parsed = JSON.parse(raw);
          const current = _getState();
          Object.assign(current, parsed);
          _onUpdate && _onUpdate();
          const statusEl = el.querySelector('#dbg-backup-status');
          if (statusEl) statusEl.textContent = '백업 불러오기 완료!';
          _renderTab();
        } catch(err) {
          alert('백업 불러오기 실패: ' + err.message);
        }
      }
      else if (act === 'storage-reset') {
        if (!confirm('localStorage를 전부 삭제하고 새로고침할까요? (되돌릴 수 없어요)')) return;
        try { localStorage.clear(); } catch(e) { /* 무시 */ }
        location.reload();
      }
    };
  }

  // ──────────────────────────────────────────────────────────
  // 패널 열기 / 닫기 / 토글
  // ──────────────────────────────────────────────────────────
  function openPanel() {
    _ensurePanel();
    const root = document.getElementById('dbg-panel-root');
    if (!root) return;
    root.classList.remove('dbg-panel-closed');
    root.classList.add('dbg-panel-open');
    _isOpen = true;
    _renderTab();
  }

  function closePanel() {
    const root = document.getElementById('dbg-panel-root');
    if (!root) return;
    root.classList.remove('dbg-panel-open');
    root.classList.add('dbg-panel-closed');
    _isOpen = false;
  }

  function togglePanel() {
    if (_isOpen) closePanel();
    else openPanel();
  }

  // ──────────────────────────────────────────────────────────
  // 초기화 (game.js가 호출)
  // ──────────────────────────────────────────────────────────
  function init(opts) {
    // opts = { getState, onUpdate, onSwitchScreen }
    _getState        = opts.getState;
    _onUpdate        = opts.onUpdate;
    _onSwitchScreen  = opts.onSwitchScreen || null;
    _ensurePanel();
  }

  // ──────────────────────────────────────────────────────────
  // CSS 인라인 주입 (별도 .css 파일 없이 자체 완결)
  // ──────────────────────────────────────────────────────────
  (function injectStyles() {
    if (document.getElementById('dbg-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'dbg-panel-styles';
    style.textContent = `
      /* 패널 루트 — 화면 오른쪽 고정 */
      #dbg-panel-root {
        position: fixed;
        top: 52px; /* HUD 아래 */
        right: 0;
        width: 270px;
        height: calc(100vh - 52px);
        z-index: 9999;
        display: flex;
        flex-direction: row-reverse;
        pointer-events: none; /* 닫혔을 때 클릭 통과 */
        font-family: 'Noto Sans KR', sans-serif;
        font-size: 13px;
        color: #e8d6a8;
      }
      #dbg-panel-root.dbg-panel-open  { pointer-events: auto; }
      #dbg-panel-root.dbg-panel-closed .dbg-inner { transform: translateX(100%); }
      #dbg-panel-root.dbg-panel-open  .dbg-inner { transform: translateX(0); }

      /* 핸들 (항상 보임) */
      .dbg-handle {
        position: absolute;
        right: 0;
        top: 16px;
        width: 28px;
        height: 40px;
        background: #3a2a10;
        border: 1px solid #f5a700;
        border-right: none;
        border-radius: 6px 0 0 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 16px;
        color: #f5a700;
        z-index: 10000;
        pointer-events: auto;
        transition: background 0.15s;
      }
      .dbg-handle:hover { background: #5a3e18; }

      /* 내부 패널 */
      .dbg-inner {
        width: 250px;
        height: 100%;
        background: #1c140a;
        border-left: 2px solid #f5a700;
        display: flex;
        flex-direction: column;
        transition: transform 0.25s ease;
        overflow: hidden;
      }

      /* 제목 행 */
      .dbg-title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        background: #2a1f0e;
        border-bottom: 1px solid #443a25;
      }
      .dbg-title { font-weight: 700; color: #f5a700; font-size: 14px; }
      .dbg-close-btn {
        background: none;
        border: none;
        color: #c8a870;
        cursor: pointer;
        font-size: 16px;
        padding: 2px 6px;
      }
      .dbg-close-btn:hover { color: #f5a700; }

      /* 탭 */
      .dbg-tabs {
        display: flex;
        border-bottom: 1px solid #443a25;
        background: #1c140a;
      }
      .dbg-tab {
        flex: 1;
        padding: 6px 2px;
        background: none;
        border: none;
        color: #a08050;
        cursor: pointer;
        font-size: 11px;
        text-align: center;
        transition: background 0.1s, color 0.1s;
      }
      .dbg-tab:hover       { background: #2a1f0e; color: #e8d6a8; }
      .dbg-tab-active      { background: #3a2a10 !important; color: #f5a700 !important; font-weight: 700; }

      /* 콘텐츠 영역 */
      .dbg-content {
        flex: 1;
        overflow-y: auto;
        padding: 6px;
      }
      .dbg-content::-webkit-scrollbar { width: 4px; }
      .dbg-content::-webkit-scrollbar-thumb { background: #443a25; border-radius: 2px; }

      /* 섹션 */
      .dbg-section {
        background: #221a0d;
        border: 1px solid #3a2e18;
        border-radius: 6px;
        padding: 8px;
        margin-bottom: 8px;
      }
      .dbg-section-hd {
        font-weight: 700;
        color: #f5a700;
        font-size: 12px;
        margin-bottom: 6px;
      }
      .dbg-row {
        display: flex;
        align-items: center;
        gap: 5px;
        margin-bottom: 4px;
        font-size: 12px;
        flex-wrap: wrap;
      }
      .dbg-btn-row { gap: 4px; }
      .dbg-lbl { min-width: 52px; font-size: 11px; color: #c8a870; }
      .dbg-hint { font-size: 10px; color: #7a6640; margin-top: 4px; line-height: 1.4; }

      /* 버튼 */
      .dbg-btn {
        background: #3a2a10;
        border: 1px solid #6a5030;
        color: #e8d6a8;
        border-radius: 4px;
        padding: 3px 8px;
        cursor: pointer;
        font-size: 11px;
        transition: background 0.1s;
      }
      .dbg-btn:hover         { background: #5a3e18; }
      .dbg-btn-danger        { border-color: #8a3020; background: #3a1810; color: #ffa090; }
      .dbg-btn-danger:hover  { background: #6a2818; }
      .dbg-btn-sm            { padding: 2px 5px; font-size: 12px; }

      /* 입력 요소 */
      .dbg-sel, .dbg-input {
        background: #2a1f0e;
        border: 1px solid #5a4a28;
        color: #e8d6a8;
        border-radius: 4px;
        padding: 3px 6px;
        font-size: 11px;
        max-width: 90px;
      }
      .dbg-range {
        flex: 1;
        accent-color: #f5a700;
        min-width: 60px;
      }
      .dbg-textarea {
        width: 100%;
        height: 80px;
        background: #2a1f0e;
        border: 1px solid #5a4a28;
        color: #e8d6a8;
        border-radius: 4px;
        padding: 4px;
        font-size: 10px;
        resize: vertical;
        font-family: monospace;
      }

      /* 덤프 pre */
      .dbg-dump-pre {
        background: #0c0904;
        border: 1px solid #3a2e18;
        border-radius: 4px;
        padding: 6px;
        font-size: 9px;
        color: #c8b880;
        font-family: monospace;
        word-break: break-all;
        white-space: pre-wrap;
        margin-top: 4px;
      }

      /* 토글 체크박스 */
      .dbg-toggle-wrap {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        font-size: 12px;
      }
      .dbg-ck, .dbg-cat-ck {
        accent-color: #f5a700;
        cursor: pointer;
      }
      .dbg-cat-status { font-size: 10px; color: #7a6640; }
    `;
    document.head.appendChild(style);
  })();

  // ──────────────────────────────────────────────────────────
  // 외부 공개 API
  // ──────────────────────────────────────────────────────────
  global.MN9_DebugPanel = {
    init,
    openPanel,
    closePanel,
    togglePanel,
  };

})(typeof window !== 'undefined' ? window : globalThis);
