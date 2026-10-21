// 뮤나리자 B 플레이 데모 — 화면 담당. 게임 규칙은 전부 engine.js에 있고,
// 이 파일은 그리기·소리·입력 연결·검수 API만 맡는다.
// 소리 출처: V6 정본의 tone/팡파르 재현 + 시연용 벨소리(레퍼런스 녹화에 오디오가
// 없어 새로 만든 소리 — README 참조).
"use strict";

(function () {
  const State = window.MewnaState;
  const Art = window.MewnaArt;
  const REVIEW_HARNESS_ENABLED = new URLSearchParams(window.location.search).get("qa-review") === "1";
  let engine = window.MewnaEngine.createEngine({ reviewHarness: REVIEW_HARNESS_ENABLED });
  const C = engine.CONSTANTS;
  const ART = C.ART;
  const SUB = C.SUB;
  const CV = ART * SUB;
  const GRADE_COLORS = {
    bronze: "#b87333", silver: "#a7b0ba", gold: "#d6a900",
    platinum: "#2aa198", diamond: "#62c7ff",
  };
  const GRADE_LABELS = {};
  State.ECON_TEST_VALUES.grades.forEach(function (g) { GRADE_LABELS[g.key] = g.label; });

  const $ = function (id) { return document.getElementById(id); };
  const stage = $("stage");
  const workbench = $("workbench");
  const benchCtx = $("benchCanvas").getContext("2d");
  benchCtx.imageSmoothingEnabled = false;
  // 2·3·4번째 작업대의 그림면. 휠 입력은 작업면(workbench) 하나만 받는다.
  // 동시 제작에서는 같은 인쇄 진행을 그대로 한 번 더 그리고,
  // 순차 제작에서는 이미 마감한 작품을 완성된 모습으로 남겨 둔다.
  const benchCtxB = $("benchCanvasB").getContext("2d");
  benchCtxB.imageSmoothingEnabled = false;
  const benchCtxC = $("benchCanvasC").getContext("2d");
  benchCtxC.imageSmoothingEnabled = false;
  const benchCtxD = $("benchCanvasD").getContext("2d");
  benchCtxD.imageSmoothingEnabled = false;
  const BENCH_TAGS = ["A", "B", "C", "D"];
  const benchCtxOf = { A: benchCtx, B: benchCtxB, C: benchCtxC, D: benchCtxD };

  // ── 소리 ─────────────────────────────────────────────────────
  let AC = null;
  function ensureAudio() {
    if (!AC) {
      try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; }
    }
    if (AC && AC.state === "suspended") AC.resume();
  }
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];
  function tone(i, gain, dur, base) {
    if (!AC) return;
    const o = AC.createOscillator();
    const g = AC.createGain();
    o.type = "triangle";
    o.frequency.value = (base || 392) * Math.pow(2, SCALE[Math.min(i, 15)] / 12);
    g.gain.setValueAtTime(gain || 0.06, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + (dur || 0.07));
    o.connect(g);
    g.connect(AC.destination);
    o.start();
    o.stop(AC.currentTime + (dur || 0.07));
  }
  function clickSound() { tone(0, 0.04, 0.05, 240); }
  let fanfareTimers = [];
  function clearFanfareTimers() {
    fanfareTimers.forEach(function (timer) { clearTimeout(timer); });
    fanfareTimers = [];
  }
  function fanfare(top) {
    if (!AC) return;
    const notes = top ? [0, 4, 7, 12, 16] : [0, 7, 12];
    notes.forEach(function (n, k) {
      const timer = setTimeout(function () {
        fanfareTimers = fanfareTimers.filter(function (item) { return item !== timer; });
        if (!engine.getState().paused) tone(Math.min(15, 8 + Math.floor(n / 3)), 0.07, 0.12);
      }, k * 90);
      fanfareTimers.push(timer);
    });
  }
  // 전화벨은 16개 음을 약 0.8초 앞까지 예약한다. 전화를 빨리 받아도 예약음이
  // 그대로 남으면 통화창 위에서 벨이 계속 들린다. 지금 살아 있는 전화벨 발진기를
  // 따로 모아 두고, 수신 순간 한꺼번에 끊는다.
  const ringOscillators = new Set();
  function stopRingBurst() {
    ringOscillators.forEach(function (o) {
      try { o.stop(); } catch (e) { /* 이미 끝난 음은 무시한다 */ }
      try { o.disconnect(); } catch (e) { /* 이미 분리된 음은 무시한다 */ }
    });
    ringOscillators.clear();
  }
  function ringBurst() {
    if (!AC) return;
    // 오래된 묶음이 남아 있으면 새 반복 벨과 겹치지 않게 먼저 정리한다.
    stopRingBurst();
    const t0 = AC.currentTime;
    for (let i = 0; i < 16; i += 1) {
      const o = AC.createOscillator();
      const g = AC.createGain();
      o.type = "square";
      o.frequency.value = i % 2 ? 1244 : 1568;
      const at = t0 + i * 0.05;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.045, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.046);
      o.connect(g);
      g.connect(AC.destination);
      ringOscillators.add(o);
      o.onended = function () {
        ringOscillators.delete(o);
        try { o.disconnect(); } catch (e) { /* 이미 분리됐으면 끝 */ }
        try { g.disconnect(); } catch (e) { /* 이미 분리됐으면 끝 */ }
      };
      o.start(at);
      o.stop(at + 0.05);
    }
  }
  // ── 유리창 닦기 전용 소리 (라운드 005) ───────────────────────
  // 인쇄 스퀴지(tone/clickSound)와는 아예 다른 경로다 — 한쪽을 손대도 다른 쪽이
  // 따라 바뀌지 않는다. 톱니·사각파 대신 걸러진 잡음을 써서, 다섯 번을 이어 들어도
  // 고무가 끼익 하는 마찰음이 되지 않는 「젖은 천이 스치는」 소리를 만든다.
  let wetNoise = null;
  function wetNoiseBuffer() {
    if (!AC) return null;
    if (wetNoise && wetNoise.sampleRate === AC.sampleRate) return wetNoise;
    const len = Math.floor(AC.sampleRate * 0.4);
    const buf = AC.createBuffer(1, len, AC.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i += 1) {
      // 갈색 잡음 — 흰 잡음보다 낮고 부드러워 물기 소리에 가깝다
      last = last * 0.96 + (Math.random() * 2 - 1) * 0.04;
      data[i] = Math.max(-1, Math.min(1, last * 3.4));
    }
    wetNoise = buf;
    return buf;
  }
  // 줄 하나를 닦을 때마다 나는 짧은 물기 스침 소리.
  function wipeSwipe(row) {
    if (!AC) return;
    const buf = wetNoiseBuffer();
    if (!buf) return;
    const src = AC.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const band = AC.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 820 + Math.min(15, row || 0) * 58;
    band.Q.value = 0.85;
    const soft = AC.createBiquadFilter();
    soft.type = "lowpass";
    soft.frequency.value = 3000;
    const g = AC.createGain();
    const t0 = AC.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.045, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
    src.connect(band);
    band.connect(soft);
    soft.connect(g);
    g.connect(AC.destination);
    src.start(t0);
    src.stop(t0 + 0.17);
  }
  // 완주 한 번을 마쳤을 때의 짧고 맑은 마감음 — 물기 소리 뒤에 얹힌다.
  function wipeFinish() {
    if (!AC) return;
    const t0 = AC.currentTime;
    [1174.7, 1760].forEach(function (hz, i) {
      const o = AC.createOscillator();
      const g = AC.createGain();
      o.type = i ? "sine" : "triangle";
      o.frequency.value = hz;
      const at = t0 + i * 0.055;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(0.045, at + 0.014);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.24);
      o.connect(g);
      g.connect(AC.destination);
      o.start(at);
      o.stop(at + 0.27);
    });
  }
  document.addEventListener("pointerdown", ensureAudio);

  // ── 정적 픽셀 아트 ───────────────────────────────────────────
  Art.drawRotaryPhone($("phoneCanvas"));
  Art.drawReceiver($("receiverCanvas"));
  Art.drawCatalog($("catalogCanvas"));
  // 2026-10-20 v9: 「도화지 구매」 카드 · 「작업대 · 한 대」 칸은 뺐다 — 대신 왼쪽 위 돈 칸의 금화를 그린다(시안 2판).
  Art.drawCoin($("coinIcon"), 2);
  // 왼쪽 작업 탭 아이콘 — 유리창과 밀대를 함께 담은 중립 고정 그림 한 장이다.
  // 진행 상태를 전혀 읽지 않으므로 여기서 한 번만 그리고 다시 손대지 않는다.
  Art.drawJobIcon($("windowIcon"));

  // ── 무대 등비 축소 ───────────────────────────────────────────
  // ── 무대 맞추기 (2026-08-25 검수 지적 5) ────────────────────────
  // 데스크톱은 지금까지처럼 1920×1080 무대를 등비 축소한다.
  // 좁은 화면(휴대폰)에서는 그 축소가 20%까지 내려가 글자를 읽을 수도 버튼을 누를
  // 수도 없고, 무대 바깥이 잘려 시작·돈·현재 행동·작업대가 화면에서 사라졌다
  // (증거: qa/mobile-fresh-start-390x844.png · qa/mobile-count4-artworks-390x844.png).
  // 그래서 좁은 화면에서는 축소를 아예 걸지 않고, styles.css의 같은 기준값을 쓰는
  // 미디어 질의가 한 열 흐름으로 다시 배치한다. 데스크톱 논리 좌표 계약은 그대로다.
  const MOBILE_MAX_WIDTH = 700; // styles.css의 @media (max-width: 700px)와 같은 값
  function fitStage() {
    const mobile = window.innerWidth <= MOBILE_MAX_WIDTH;
    document.body.dataset.layout = mobile ? "mobile" : "desktop";
    if (mobile) {
      // 인라인 축소를 남겨 두면 미디어 질의가 이길 수 없다 — 아예 지운다.
      stage.style.transform = "";
      return;
    }
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = "translate(-50%, -50%) scale(" + scale + ")";
  }
  window.addEventListener("resize", fitStage);
  fitStage();

  // ── 왼쪽 구매줄 — B 전체 탭형: 탭이 줄 전체를 갈아끼운다 ─────
  const PANES = ["workshop", "shop"];
  const tabBtn = { workshop: $("workshopTabBtn"), shop: $("shopTabBtn") };
  const pane = { workshop: $("workshopPane"), shop: $("shopPane") };
  let activePane = "workshop";
  // 유리창 조작 도움 팝업 상태 — benchCaption 제거의 보완 (2026-08-20 형 확정, 라운드 005 문제 A).
  // seen: 이번 실행에서 자동으로 한 번 띄웠는가 / open: 지금 열려 있는가.
  let scrollHelpSeen = false;
  let scrollHelpOpen = false;
  function closeScrollHelp() {
    if (!scrollHelpOpen) return;
    scrollHelpOpen = false;
    $("scrollHelpBox").hidden = true;
  }
  function setPane(key) {
    if (PANES.indexOf(key) < 0) return false;
    if (key === "shop" && !engine.getState().unlocked.shop) return false;
    activePane = key;
    PANES.forEach(function (name) {
      const on = name === key;
      tabBtn[name].classList.toggle("on", on);
      tabBtn[name].setAttribute("aria-selected", String(on));
      tabBtn[name].tabIndex = on ? 0 : -1;
      pane[name].hidden = !on;
    });
    // 상점을 여는 순간이 곧 「새 카드 확인」이다 — 탭 금빛 NEW와 카드 금빛 테두리를
    // 함께 끄고, 구매 전이어도 다시 켜지지 않는다 (2026-08-12 계약 10).
    if (key === "shop") {
      tabBtn.shop.dataset.new = "false";
      engine.confirmWorkbenchCard();
    }
    return true;
  }
  PANES.forEach(function (name) {
    tabBtn[name].addEventListener("click", function () { setPane(name); });
  });
  $("autoSellOnBtn").addEventListener("click", function () {
    engine.setAutoSell(true);
    render(engine.getState());
  });
  $("autoSellOffBtn").addEventListener("click", function () {
    engine.setAutoSell(false);
    render(engine.getState());
  });
  $("backToWorkshopBtn").addEventListener("click", function () {
    setPane("workshop");
    tabBtn.workshop.focus();
  });

  // ── 상점 업그레이드 3항목 — 선형 해금 순서대로 고정 배치 ─────
  // (유리창 전용 강화 카드는 2026-08-12 계약 15에서 일반 상점에서 뺐다.)
  const UPGRADES = State.UPGRADES;

  // ── 0827 승인 · 작업 탭 공통 카드 그리기 ──────────────────────────────
  // 상점 카드와 작업 카드가 같은 네 칸(이름 · 돈 · 레벨 · 게이지)을 나눠 쓴다.
  // 무엇을 담을지는 규칙 함수 State.workCardText가 정하고, 여기서는 그 결과를
  // 칸에 옮겨 담기만 한다 — 화면이 표기를 따로 만들지 않는다.
  function workCardEls(root) {
    return {
      root: root,
      name: root.querySelector(".wc-name"),
      money: root.querySelector(".wc-money"),
      level: root.querySelector(".wc-level"),
      fill: root.querySelector(".wc-fill"),
    };
  }
  function paintWorkCard(el, card) {
    setText(el.name, card.name);
    setText(el.money, card.money);
    setText(el.level, card.level);
    if (el.fill && el.fill.style.getPropertyValue("--wc-gauge-ratio") !== card.gauge.percent) {
      el.fill.style.setProperty("--wc-gauge-ratio", card.gauge.percent);
    }
  }
  // 레벨 칸 폭 못박기 — 「Lv. 0」과 「Lv. 2」의 글자 폭이 달라 게이지 길이가 흔들리는
  // 것을 막는다(승인 비교판 0827 r1 수정 그대로). 실측에 실패하면 CSS 폴백
  // (max-content)이 그대로 남으므로 화면이 깨지지 않는다.
  function syncLevelColumnWidth() {
    const host = document.createElement("span");
    host.className = "wc-lv-probe";
    host.setAttribute("aria-hidden", "true");
    document.body.appendChild(host);
    let widest = 0;
    for (let level = 0; level <= 4; level += 1) {
      host.textContent = "Lv. " + level;
      widest = Math.max(widest, host.getBoundingClientRect().width);
    }
    host.textContent = "";
    if (widest > 0) {
      document.documentElement.style.setProperty("--wc-lv-col",
        (Math.ceil(widest * 100) / 100) + "px");
    }
  }

  const upgEls = {};
  UPGRADES.forEach(function (u) {
    upgEls[u.key] = workCardEls($("upg-" + u.key));
    upgEls[u.key].root.addEventListener("click", function () { engine.buyUpgrade(u.key); });
  });
  const jobCardEls = workCardEls($("jobBtn"));
  const benchOfferEls = workCardEls($("upg-secondWorkbench"));
  syncLevelColumnWidth();

  // ══ 2026-10-20 v9 · 왼쪽 원작 카탈로그 — 한 장 제작 (그릴미 기둥 2-1 · 시안 2판) ══════════
  // 카드 여섯 장은 HTML에 처음부터 서 있고(좌표 불변), 여기서는 글자 · 상태 · 그림만 바꾼다.
  //   owned   — 가진 원작: 그림 · 이름 · 한 장 참가비 · Lv. 누르면 참가비를 내고 바로 그린다
  //   preview — 다음 새 원작: 실루엣 · 「???」 · 참가비(경매장에서 얻으면 열림)
  //   locked  — 그 뒤 원작: 자물쇠 · 「잠김」
  // 그리는 동안(판매 전)에는 다른 카드를 누를 수 없다(14-A). 판정은 엔진(makeSheet)이 다시 한다.
  const catalogCards = Art.ORIGINALS.map(function (o) {
    const root = $("cat-" + o.key);
    const el = workCardEls(root);
    el.canvas = root.querySelector("canvas");
    root.addEventListener("click", function () {
      if (engine.makeSheet(o.key)) {
        workbench.focus({ preventScroll: true });
        showWorkspaceOnMobile();
      }
    });
    return { o: o, el: el, drawn: "" };
  });
  function paintCatalogCard(el, c) {
    setText(el.name, c.name);
    setText(el.money, c.money);
    setText(el.level, c.level);
    if (el.fill) el.fill.style.setProperty("--wc-gauge-ratio", Math.round((c.gauge || 0) * 100) + "%");
    if (el.root.dataset.state !== c.state) el.root.dataset.state = c.state;
    el.root.dataset.short = String(!!c.short);
    el.root.dataset.free = String(!!c.free);
    if (el.root.getAttribute("aria-label") !== c.aria) el.root.setAttribute("aria-label", c.aria);
  }
  function renderCatalog(s, canAct) {
    const area = $("catalogArea");
    const lockedArea = String(!s.unlocked.paper);
    if (area.dataset.locked !== lockedArea) area.dataset.locked = lockedArea;
    const info = {};
    (s.originals || []).forEach(function (o) { info[o.key] = o; });
    const sheet = s.sheet || {};
    catalogCards.forEach(function (c) {
      const o = info[c.o.key] || { owned: false, level: 0, fee: 0 };
      const mode = o.owned ? "owned" : (sheet.nextNew === c.o.key ? "preview" : "locked");
      if (c.drawn !== mode) {
        c.drawn = mode;
        if (mode === "owned") Art.drawOriginal(c.el.canvas, c.o.key, 3);
        else if (mode === "preview") Art.drawOriginalSilhouette(c.el.canvas, c.o.key, 3);
        else Art.drawIcon16(c.el.canvas, Art.RAIL_ICONS.lock);
      }
      const current = !!sheet.current && sheet.current === c.o.key;
      const busy = !!sheet.busy && !current;
      if (mode === "owned") {
        const free = !!sheet.free;
        const short = !free && s.money < o.fee && !current;
        paintCatalogCard(c.el, {
          name: c.o.label, money: free ? "무료" : State.moneyText(o.fee), level: "Lv. " + o.level,
          gauge: o.level / State.ORIGINAL_TEST_VALUES.maxLevel, state: "", short: short, free: free && !current,
          aria: c.o.label + " 한 장 제작 — 참가비 " + (free ? "무료(첫 잉크통 선물)" : State.moneyText(o.fee))
            + ", 레벨 " + o.level + ", 직접 " + o.strokes + "번 밀기"
            + (current ? " — 그리는 중" : busy ? " — 지금 그림을 다 판 뒤에 고를 수 있습니다"
              : sheet.needInkTank ? " — 상점에서 잉크통을 먼저 사세요"
                : short ? " — 돈이 모자랍니다" : " — 누르면 바로 시작"),
        });
        c.el.root.disabled = !canAct || busy || current || short || !!sheet.needInkTank || !s.unlocked.paper;
      } else if (mode === "preview") {
        paintCatalogCard(c.el, {
          name: "???", money: State.moneyText(o.fee), level: "", gauge: 0, state: "preview",
          aria: "다음 원작 예고 — 한 장 참가비 " + State.moneyText(o.fee) + ", 경매장에서 얻으면 열립니다",
        });
        c.el.root.disabled = true;
      } else {
        paintCatalogCard(c.el, { name: "잠김", money: "", level: "", gauge: 0, state: "locked", aria: "잠긴 원작 칸" });
        c.el.root.disabled = true;
      }
      c.el.root.dataset.current = String(current);
      c.el.root.dataset.busy = String(busy && mode === "owned");
    });
  }

  // ══ 2026-10-20 v9 · 오른쪽 「업그레이드」 세 칸 (그릴미 기둥 2-7 · 2-8 · 시안 2판) ══════════
  // 순서 = 모작 운 → 스퀴지 종류(다음 재질) → 스퀴지 속도(형님 10/19 12번). 사는 길은 상점과 같은 engine.buyUpgrade.
  const railCards = {
    luck: workCardEls($("upgLuck")),
    material: workCardEls($("upgMaterial")),
    speed: workCardEls($("upgSpeed")),
  };
  railCards.luck.canvas = $("upgLuckIcon");
  railCards.material.canvas = $("upgMaterialIcon");
  railCards.speed.canvas = $("upgSpeedIcon");
  const RAIL_BUY_KEYS = { luck: "inkQuality", material: "squeegeeMaterial", speed: "printSqueegeeSpeed" };
  function railBoughtFx(el) {
    el.classList.remove("mk-bought");
    void el.offsetWidth;
    el.classList.add("mk-bought");
    // 끝나면 표시를 뗀다 — 남겨 두면 요소가 다시 그려질 때 반짝임이 다시 재생될 수 있다
    el.addEventListener("animationend", function () { el.classList.remove("mk-bought"); }, { once: true });
  }
  Object.keys(railCards).forEach(function (slot) {
    railCards[slot].root.addEventListener("click", function () {
      if (engine.buyUpgrade(RAIL_BUY_KEYS[slot])) railBoughtFx(railCards[slot].root);
    });
  });
  let railIconKey = "";
  let railLvKey = "";
  const lvProbe = document.createElement("span");
  lvProbe.className = "wc-lv-probe";
  lvProbe.setAttribute("aria-hidden", "true");
  document.body.appendChild(lvProbe);
  function railCardPaint(el, c) {
    setText(el.name, c.name);
    setText(el.money, c.money);
    setText(el.level, c.level);
    if (el.fill) el.fill.style.setProperty("--wc-gauge-ratio", Math.round((c.gauge || 0) * 100) + "%");
    if (el.root.dataset.state !== c.state) el.root.dataset.state = c.state;
    el.root.dataset.short = String(!!c.short);
    el.root.dataset.busy = String(!!c.busy);
    el.root.dataset.guard = String(!!c.guard);
    if (el.root.getAttribute("aria-label") !== c.aria) el.root.setAttribute("aria-label", c.aria);
  }
  function lockedCard(slot) {
    return { name: "잠김", money: "구간 " + slot.unlockSegment, level: "", gauge: 0, state: "locked",
      aria: "잠긴 업그레이드 — 구간 " + slot.unlockSegment + " 달성 뒤 열립니다" };
  }
  function renderRail(s, canAct) {
    const r = s.rail;
    if (!r) return;
    const iconKey = [r.luck.locked, r.material.locked, r.speed.locked, r.material.current.key,
      r.material.next ? r.material.next.key : "-"].join("|");
    if (railIconKey !== iconKey) {
      railIconKey = iconKey;
      Art.drawIcon16(railCards.luck.canvas, r.luck.locked ? Art.RAIL_ICONS.lock : Art.RAIL_ICONS.clover);
      Art.drawIcon16(railCards.material.canvas, r.material.locked ? Art.RAIL_ICONS.lock
        : Art.squeegeeIcon((r.material.next || r.material.current).key, false));
      Art.drawIcon16(railCards.speed.canvas, r.speed.locked ? Art.RAIL_ICONS.lock
        : Art.squeegeeIcon(r.speed.material.key, true));
    }
    const guardText = State.deadlockGuardShort();
    // ① 모작 운
    const lu = r.luck;
    railCardPaint(railCards.luck, lu.locked ? lockedCard(lu) : {
      name: "모작 운", money: lu.max ? "최대" : State.moneyText(lu.price), level: "Lv. " + lu.level,
      gauge: lu.level / lu.maxLevel, state: lu.max ? "max" : lu.affordable ? "ready" : "",
      short: !lu.max && s.money < lu.price, guard: lu.reserveBlocked,
      aria: "모작 운 — 레벨 " + lu.level + (lu.max ? ", 최대"
        : ", 다음 " + State.moneyText(lu.price) + " — 좋은 등급이 나올 확률이 오릅니다"
          + (lu.reserveBlocked ? " · " + guardText : "")),
    });
    railCards.luck.root.disabled = !(canAct && lu.affordable);
    // ② 스퀴지 종류(다음 재질)
    const mo = r.material;
    railCardPaint(railCards.material, mo.max ? {
      name: mo.current.label + " 스퀴지", money: "보유", level: "재질 " + (mo.current.index + 1) + "/" + (mo.maxLevel + 1),
      gauge: 1, state: "max", aria: "스퀴지 재질 — " + mo.current.label + "(마지막)",
    } : mo.locked ? lockedCard(mo) : {
      name: mo.next.label + " 스퀴지", money: State.moneyText(mo.price), level: "지금 " + mo.current.label,
      gauge: (mo.current.index + 1) / (mo.maxLevel + 1), state: mo.affordable ? "ready" : "",
      short: s.money < mo.price, busy: mo.busy, guard: mo.reserveBlocked,
      aria: "다음 재질 — " + mo.next.label + " 스퀴지 " + State.moneyText(mo.price) + ", 사면 속도 1단계부터"
        + (mo.busy ? " — 그리는 동안에는 바꿀 수 없습니다" : mo.reserveBlocked ? " · " + guardText : ""),
    });
    railCards.material.root.disabled = !(canAct && mo.affordable);
    // ③ 스퀴지 속도 — 지금 재질에 붙는 속도
    const sp = r.speed;
    railCardPaint(railCards.speed, sp.locked ? lockedCard(sp) : {
      name: "스퀴지 속도", money: sp.max ? "최대" : State.moneyText(sp.price),
      level: sp.material.label + " " + sp.step + "/" + sp.maxStep,
      gauge: sp.step / sp.maxStep, state: sp.max ? "max" : sp.affordable ? "ready" : "",
      short: !sp.max && s.money < sp.price, busy: sp.busy, guard: sp.reserveBlocked,
      aria: "스퀴지 속도 — " + sp.material.label + " 스퀴지 " + sp.step + "/" + sp.maxStep + "단계"
        + (sp.max ? ", 최대" : ", 다음 단계 " + State.moneyText(sp.price))
        + (sp.busy ? " — 그리는 동안에는 바꿀 수 없습니다" : sp.reserveBlocked ? " · " + guardText : ""),
    });
    railCards.speed.root.disabled = !(canAct && sp.affordable);
    // 세 칸의 레벨 글자(「나무 2/5」 · 「지금 브론즈」 · 「Lv. 2」)가 길이가 달라도 막대가 같은 x에서 시작하게,
    // 가장 긴 글자 폭으로 첫 칸을 못박는다(시안 2판 syncUpgLevelColumn — 프로브는 무대 밖이라 축소를 받지 않는다).
    const texts = [railCards.luck, railCards.material, railCards.speed].map(function (c) { return c.level.textContent; });
    const lvKey = texts.join("|");
    if (lvKey !== railLvKey) {
      railLvKey = lvKey;
      const widest = Math.max.apply(null, texts.map(function (t) {
        if (!t) return 0;
        lvProbe.textContent = t;
        return lvProbe.getBoundingClientRect().width;
      }));
      $("upg3").style.setProperty("--upg-lv-col", Math.ceil(widest) + "px");
    }
  }
  function unlockHint(u) {
    // 2026-10-08 3단계: 해금은 구간 목표 하나 — 잉크통만 전화(이야기)로 열린다.
    if (u.unlock.type === "segment") return "구간 " + u.unlock.value + " 목표를 채우면 열립니다";
    return "이야기가 더 진행되면 열립니다";
  }

  // ── 작업대 발광·흔들림·불꽃 (V6 이식) ────────────────────────
  let glowTimer = null;
  // 완성 테두리 두께는 2026-08-06 MNL-11대로 기존의 절반(4px → 2px)이다.
  // 바깥으로 번지는 부드러운 발광은 두께가 아니라 빛이라 그대로 둔다.
  const BORDER_PX = 2;
  function glowBench(color, ms, diamond) {
    clearTimeout(glowTimer);
    workbench.style.boxShadow = diamond
      ? "0 0 0 " + BORDER_PX + "px #d8f5ff, 0 0 18px #62c7ff, 0 0 34px #328fbd"
      : "0 0 0 " + BORDER_PX + "px " + color + ", 0 0 34px " + color;
    glowTimer = setTimeout(function () { workbench.style.boxShadow = "none"; }, ms);
  }
  function snapShake() {
    workbench.classList.remove("shake");
    void workbench.offsetWidth;
    workbench.classList.add("shake");
  }
  let particles = [];
  function burst(gradeKey) {
    for (let i = 0; i < 60; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 14 + Math.random() * 40;
      particles.push({
        x: CV / 2, y: CV / 2,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 18,
        life: 0.7 + Math.random() * 0.5,
        color: gradeKey === "diamond" && i % 3 === 0 ? "#d8f5ff" : GRADE_COLORS[gradeKey],
      });
    }
  }
  function popFloat(id, text) {
    const node = $(id);
    node.textContent = text;
    node.classList.remove("show");
    void node.offsetWidth;
    node.classList.add("show");
  }

  // ── 유리창 대성공 오버레이 ───────────────────────────────────
  // 보상은 엔진이 이미 한 번만 지급했다. 여기서는 무대 전체를 잠깐 어둡게 덮고
  // 중앙에 금빛 결과를 평소 보수 표시보다 크게 보여 주기만 한다.
  // 입력 잠금은 엔진의 게임 시계가 맡으므로 이 연출은 화면을 밀지도, 클릭을 막지도 않는다.
  let jackpotTimer = null;
  function hideJackpotOverlay() {
    clearTimeout(jackpotTimer);
    jackpotTimer = null;
    $("jackpotOverlay").dataset.open = "false";
  }
  function showJackpotOverlay(ev) {
    const box = $("jackpotOverlay");
    $("jackpotTitle").textContent = ev.label || "아주 깨끗하게 닦았다!";
    $("jackpotPay").textContent = "+" + ev.pay + "$";
    box.dataset.open = "true";
    clearTimeout(jackpotTimer);
    jackpotTimer = setTimeout(hideJackpotOverlay, ev.lockMs || 1200);
  }

  // ── 유리 파손 균열 — 0827 승인 「유리 A · 충격점 거미줄」 ─────────────
  // 유리가 깨졌다는 사실을 숫자로만 말하지 않고, 닦고 있던 그 유리 한 장 위에
  // 중앙 충격점에서 사방으로 번지는 균열을 실제로 낸다.
  //
  // 이 함수는 성공·실패를 스스로 판정하지 않는다 — 결과 키를 State.glassBreakFx에
  // 그대로 넘기고, 규칙이 계획을 주지 않으면(성공·대성공) 아무것도 켜지 않는다.
  // 자리를 차지하지 않는 덮개층이라 무대 좌표도 한 픽셀 밀리지 않는다.
  //
  // 0827 승인 유지 계약(State.GLASS_CRACK_PERSIST): 균열은 파손 직후·안내 전화·
  // 그 뒤 대기까지 화면에 그대로 남고, 「다음 단계」에서만 사라진다. 다음 단계란
  // 플레이어가 다음 유리창 작업을 시작하는 순간이고, 전체 초기화도 같은 정리를 쓴다.
  // 그래서 연출 단계가 다 돌아도 스스로 닫는 타이머를 걸지 않는다.
  let glassCrackTimers = [];
  function clearGlassCrack() {
    glassCrackTimers.forEach(clearTimeout);
    glassCrackTimers = [];
    const box = $("glassCrackFx");
    box.dataset.open = "false";
    box.dataset.step = "0";
  }
  function showGlassCrack(resultKey) {
    const plan = State.glassBreakFx(resultKey);
    clearGlassCrack();
    if (!plan) return false; // 성공·대성공에서는 한 조각도 켜지지 않는다
    const box = $("glassCrackFx");
    box.dataset.open = "true";
    for (let step = 1; step <= plan.steps; step += 1) {
      glassCrackTimers.push(setTimeout(function () {
        box.dataset.step = String(step);
      }, plan.stepMs * (step - 1)));
    }
    // 마지막 예약은 「연출 단계가 끝났다」만 표시한다 — 화면은 그대로 두고
    // 들고 있던 예약 목록만 비운다 (0827 승인 유지 계약: 다음 단계까지 유지).
    glassCrackTimers.push(setTimeout(function () {
      glassCrackTimers = [];
    }, plan.totalMs));
    return true;
  }

  // ── 구간 달성 알림 (2026-10-08 3단계 · 별도 검수로 자리 변경) ─────────
  // 처음에는 옛 레벨업 토스트(오른쪽 위에 떠 있는 작은 상자)를 썼는데, 그 상자가 구간 목표 칸
  // 테두리와 겹쳤다(형님 「UI 겹침 금지」). 그래서 따로 띄우지 않고, 구간 목표 칸의 「다음: …」 줄을
  // 2.4초 동안 「▲ 구간 n 달성」으로 바꿔 금빛으로 밝힌다. 비유: 새 쪽지를 붙이는 대신 칠판 한 줄을 잠깐 고쳐 쓴다.
  // 그리는 쪽(render)이 매 프레임 이 줄을 다시 쓰므로, 알림 글자는 goalFlashText에 들고 있다가 거기서 고른다.
  let goalFlashText = "";
  let goalToastTimer = null;
  function hideGoalToast() {
    clearTimeout(goalToastTimer);
    goalToastTimer = null;
    goalFlashText = "";
    $("goalPanel").dataset.flash = "false";
  }
  function showGoalToast(number) {
    goalFlashText = "▲ 구간 " + number + " 달성";
    $("goalPanel").dataset.flash = "true";
    putText("goalReward", goalFlashText);
    clearTimeout(goalToastTimer);
    goalToastTimer = setTimeout(hideGoalToast, 2400);
  }

  // ── 엔진 사건 → 소리·연출 ────────────────────────────────────
  function handleEvents() {
    engine.drainEvents().forEach(function (ev) {
      switch (ev.type) {
        // 유리창은 인쇄 스퀴지와 완전히 다른 소리 경로를 쓴다 (라운드 005).
        case "windowRow": wipeSwipe(ev.row); break;
        case "strokeReturn": wipeFinish(); break;
        case "printRow": tone(ev.row); break;
        case "outlineRow": tone(ev.row, 0.045, 0.055, 520); break;
        case "printReturn": clickSound(); break;
        // 확정 결과표의 실패는 축하할 일이 아니다 — 보수 0원만 조용히 알린다.
        case "windowDone":
          if (ev.result !== "fail") fanfare(!!ev.jackpot);
          else tone(2, 0.05, 0.16, 220);
          // 2026-08-26: 파손은 「보수 없음」이 아니라 실제 손실이다 — 총손실을 그대로 띄운다.
          popFloat("windowPayFloat", ev.result === "fail"
            ? "−" + (ev.totalLoss || 0) + "$ 파손"
            : "+" + ev.pay + "$");
          // 2026-08-27 v4: 결과 키를 규칙에 그대로 넘긴다. 파손일 때만 유리 작업대 위에
          // 픽셀 균열이 번지고, 성공·대성공에서는 규칙이 계획을 주지 않아 아무 일도 없다.
          showGlassCrack(ev.result);
          break;
        case "windowJackpot":
          popFloat("jackpotFloat", ev.label);
          glowBench("#f4dc9a", 900, false);
          showJackpotOverlay(ev);
          break;
        case "ring": ringBurst(); break;
        case "phoneOpen": stopRingBurst(); $("phoneNextBtn").focus(); break;
        // ── 0827 승인 · 대출 A 「스크래치 충실형」 흐름 ─────────────────────
        // 안내 통화를 확인하면 상단에서 계약서가 내려오고, 서명하면 그 종이가 접혀
        // 우상단 계약 자리로 옮겨간다. 화면은 엔진이 말한 사건을 따라갈 뿐이고
        // 지급·불이익·잔액 같은 값은 하나도 스스로 만들지 않는다.
        case "loanAccepted":
          tone(6, 0.05, 0.12, 294);
          dropLoanContract();
          break;
        case "loanSigned":
          tone(9, 0.06, 0.16, 330);
          flyLoanToSlot();
          break;
        case "unlockFlash": {
          const flash = $("unlockFlash");
          flash.classList.remove("show");
          void flash.offsetWidth;
          flash.classList.add("show");
          tone(12, 0.06, 0.16, 392);
          break;
        }
        case "catalogDocked": tone(10, 0.05, 0.1, 330); break;
        case "upgradeUnlocked":
          if (activePane !== "shop") tabBtn.shop.dataset.new = "true";
          tone(11, 0.05, 0.12, 392);
          break;
        // 두 번째 작업대 상품이 열린 순간 — 탭 금빛 NEW와 카드 금빛 테두리가 함께 켜진다.
        case "workbenchOfferUnlocked":
          if (activePane !== "shop") tabBtn.shop.dataset.new = "true";
          tone(12, 0.06, 0.16, 392);
          break;
        case "workbenchBought": tone(13, 0.06, 0.18, 392); break;
        // 2026-08-26 v1 계약 3항 — 진행 알림은 중앙 무대를 덮는 큰 알림이 아니라
        // 구석에서 잠깐 떴다 사라지는 작은 토스트로만 알린다.
        // 2026-10-08 3단계: 레벨업 대신 구간 달성이 그 토스트를 켠다.
        case "segmentCleared": tone(13, 0.07, 0.2, 392); showGoalToast(ev.number); break;
        case "gradeSignal": glowBench(GRADE_COLORS[ev.grade], 400, ev.grade === "diamond"); break;
        case "snap": snapShake(); break;
        case "burst": burst(ev.grade); glowBench(GRADE_COLORS[ev.grade], 900, ev.grade === "diamond"); break;
        case "revealGlow": glowBench(GRADE_COLORS[ev.grade], 900, ev.diamond); break;
        case "fanfare": fanfare(ev.top); break;
        case "extraStart": tone(6, 0.05, 0.1, 294); break;
        case "extraResult":
          if (ev.up) tone(14, 0.07, 0.18, 392);
          else tone(2, 0.05, 0.16, 220);
          break;
        // 2026-10-06 두 방 데모 A — 회차가 끝나 최고 기록이 오를 때만(첫 확보 포함)
        // 도화지 둘레가 그 등급색으로 깜빡이고 확률표의 그 줄이 한 번 반응한다(클로드판 recordImprove).
        case "gradeImproved": gradeImprovedFx(ev.grade); tone(ev.first ? 8 : 12, 0.05, 0.12, 392); break;
        case "reveal": {
          const banner = $("gradeBanner");
          // 회차 연출이 상승을 이미 보여 줬으므로 「등급 상승!」 머리말은 뺐다(클로드판 배너).
          banner.textContent = (ev.jackpot ? "잭팟! " : "") + GRADE_LABELS[ev.grade] + " 완성";
          banner.style.color = GRADE_COLORS[ev.grade];
          banner.classList.toggle("diamond", ev.grade === "diamond");
          banner.classList.add("show");
          break;
        }
        case "sold": $("gradeBanner").classList.remove("show"); break;
        case "galleryUnlocked": tone(12, 0.06, 0.14, 392); break;
        // 미완성으로 멈춘 묶음은 축하할 일이 아니다 — 팡파르 없이 조용히 결과판만 연다.
        // (종료 신호 자체는 아래 inkOut 배너가 담당한다 — MNL-07)
        case "resultsOpen": if (!ev.incomplete) fanfare(false); break;
        // 라운드 005 단계 3 · MNL-07 (2026-08-19 회의, 검수 승인 2026-08-20):
        // 잉크 바닥 미완성도 「이건 끝났고 다음 걸 그려야 한다」는 신호가 필요하다 —
        // 두 번 긋고 멈추면 "이제 붓으로 눈을 그려야 하나?"로 읽혔다 (재현이형 지적).
        // 정상 완성이 쓰는 중앙 배너(reveal)를 재활용하되, 축하가 아니라 종료 신호라
        // 잿빛 잉크색 + 낮은 톤으로 구분한다. 결과판은 기존 계약(2026-08-12 계약 2·3)
        // 대로 이 순간 이미 열려 있고, 배너는 그 위 작업대 중앙에 겹치지 않게 뜬다.
        case "inkOut": {
          // 2026-10-16 v7 추가(형님): 그림 위에 「미완성 — 잉크가 모자라 마른 자국만 남습니다」 글자를 띄우지 않는다
          // (미관상 그림을 가림). 끝났다는 신호는 잿빛 테두리 · 낮은 톤 · 아래 결과판이 맡는다.
          // 글자 없이 자연스럽게 알리는 대안은 HTML 시안으로 따로 고른다.
          $("gradeBanner").classList.remove("show");
          glowBench("#9b8f7a", 700, false);
          inkOutWarnFx(); // 49-B · 52: 인쇄 점 × 흔들림 + 1 그림 진동 · 2 × 튀어 오르기 · 3 잉크통 깜빡 · 4 밀대 멈칫
          tone(3, 0.05, 0.18, 247);
          break;
        }
        case "lossResult": tone(2, 0.06, 0.2, 220); break;
        case "lossConfirmed": tone(9, 0.05, 0.1, 330); break;
        case "workSold":
          $("gradeBanner").classList.remove("show");
          tone(9, 0.05, 0.1, 330);
          break;
        case "workDisplayed":
          $("gradeBanner").classList.remove("show");
          glowBench(GRADE_COLORS[ev.grade], 700, ev.grade === "diamond");
          tone(12, 0.06, 0.16, 392);
          break;
        // 미완성 묶음의 마감에는 팡파르를 울리지 않는다 (손실 결과가 바로 뒤에 뜬다).
        case "expansionComplete": if (!ev.incomplete) fanfare(true); break;
        case "reviewMoney": clickSound(); break;
        case "paperBought": tone(8, 0.05, 0.1, 330); break;
        case "upgradeBought": tone(10, 0.05, 0.1, 330); break;
        // 2026-10-08 4단계 — 경매장 문에서 원작을 얻었다
        case "originalAcquired": tone(14, 0.07, 0.22, 440); break;
        default: break;
      }
    });
  }

  // ── 그리기: 유리창 알바 — 때 5레이어가 한 칸씩 지워진다 ──────
  // needPasses = 이번 창문을 끝내는 데 필요한 밀대 완주 횟수(겹 수).
  // 내부 window 객체에는 이 값이 없어서(공개 상태에만 있다) 호출할 때 함께 받는다.
  function drawBenchWindow(w, clock, needPasses, windowFoam) {
    benchCtx.clearRect(0, 0, CV, CV);
    Art.drawSkyGlass(benchCtx);
    const strokeFloor = w.swapping ? ART : Math.floor(w.stroke.pos);
    // 밀대가 이미 지나간 줄은 이번 완주분까지 한 겹 더 지워진 상태로 보인다.
    // 2026-08-19 수정: 그림의 때는 언제나 5겹으로 그려지는데, 실제로 밀어야 하는
    // 횟수는 이제 4겹(디버그로는 3·5겹)이다. 예전처럼 「민 횟수 = 지워진 그림 겹」으로
    // 세면 4번을 다 밀어도 마지막 김서림 한 겹이 영원히 남아 창문이 끝까지 깨끗해지지
    // 않는다. 그래서 「얼마나 밀었나」를 비율로 바꿔 그림 겹에 고르게 나눠 지운다.
    // 마지막 완주에서는 언제나 전부 걷힌다.
    const dirtLayers = Art.DIRT_LAYERS.length;
    const passesNeeded = Math.max(1, Number(needPasses) || 1);
    Art.drawDirtRows(benchCtx, function (row) {
      const passes = Math.min(passesNeeded, w.pass + (row < strokeFloor ? 1 : 0));
      return Math.round(dirtLayers * passes / passesNeeded);
    });
    for (let r = 0; r < ART; r += 1) {
      const age = clock - w.rowT[r];
      if (age >= 0 && age < 160) {
        benchCtx.globalAlpha = 0.5 * (1 - age / 160);
        benchCtx.fillStyle = "#ffffff";
        benchCtx.fillRect(0, r * SUB, CV, SUB);
      }
    }
    benchCtx.globalAlpha = 1;
    Art.drawCleanFrame(benchCtx);
    // 완성(5/5) 순간에만 짧은 최종 광택 — 중간 광택 금지
    const glintAge = clock - w.doneClock;
    if (glintAge >= 0 && glintAge < 700) {
      const p = glintAge / 700;
      benchCtx.globalAlpha = 0.55 * (1 - p);
      benchCtx.fillStyle = "#ffffff";
      for (let y = 0; y < CV; y += 1) {
        benchCtx.fillRect(Math.round(p * 86 - 14 - y * 0.6), y, 5, 1);
      }
      benchCtx.globalAlpha = 1;
    }
    // 유리창 밀대 앞에 밀린 때가 쌓이는 연출은 이미 여기 있었다(하늘색 거품).
    // 디버그에서 끄면 거품색을 비워 밀대만 남긴다 — 그림판 쪽과 같은 방식이다.
    if (!w.swapping) {
      Art.drawSqueegee(benchCtx, w.stroke.pos, windowFoam ? "#bfe0ee" : null, clock, 0);
    }
  }

  // ── 그리기: 인쇄 — 흰 종이, 색판 어긋남→착 맞춤, 한 칸 밀 때 흔들림 (V6 이식) ──
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  // ctx를 받는 이유는 두 칸 작업대 때문이다. 같은 인쇄 진행(P)을 두 그림면에 그대로 그려
  // 한 번의 밀기가 두 장을 함께 민다는 것을 눈으로 보여 준다.
  // frameDt를 0으로 주면 불꽃 입자를 계산만 하지 않고 그리기만 한다(두 번 밀리지 않게).
  // 2026-08-19로 대체: 옛 계약 12(「밀대는 여기서 그리지 않는다 · 공통 막대 하나뿐」)는
  // 폐기됐다. 이제 v6 시안 D처럼 밀대를 도화지 그림 안에 그리고, 도화지마다 자기
  // 밀대를 하나씩 갖는다. 공통 막대가 없어졌으므로 겹쳐 보일 일도 없다.
  // ── 도화지 안 밀대와 잉크 둑 (2026-08-19 · v6 시안 D 복원) ──────
  // 예전에는 작업대 위에 긴 나무 막대 하나를 DOM으로 띄우고 별도 좌표(top 118px)로
  // 내렸다. 그래서 밀대가 도화지 맨 위가 아니라 4분의 1쯤에서 시작하는 것처럼 보였고,
  // 도화지가 여러 장이어도 밀대는 하나뿐이었다.
  //
  // 이제 v6 시안 D와 같이 밀대를 도화지 그림 「안에」 직접 그린다. 그러면
  //   · 시작 위치가 저절로 도화지 맨 위가 된다 (pos 0 = 맨 윗줄)
  //   · 도화지마다 자기 밀대를 하나씩 갖는다 (그리는 곳이 각자의 그림면이라서)
  //   · 밀대 크기가 도화지 크기를 저절로 따라간다 (같은 그림면을 확대해 보여 주므로)
  //   · 잉크 둑이 밀대 바로 앞에 붙어 함께 굴러간다
  // 세 가지 요구(8-1 작업대별 밀대 · 8-2 잉크 둑 커서 · 시작 위치)가 한 뿌리다.
  // 잉크 둑을 지금 켜 두었는가 — 디버그 창이 유리창·그림판을 따로 정한다.
  function inkDamOn(s, which) {
    if (!s || !s.debug || !s.debug.values) return true;
    const key = which === "window" ? "windowInkDam" : "printInkDam";
    return Number(s.debug.values[key]) !== 0;
  }
  function drawPrintSqueegee(ctx, P, clock, inkDam) {
    // 2026-08-25 검수 지적 3으로 갱신: 「바닥남」 하나로 숨기지 않는다.
    // ② 모자람에서는 잉크가 모자라도 그 회차가 도화지 끝까지 내려간다. 예전 조건은
    // 그 구간에서 밀대를 지워 버려 화면상으로는 흐름이 끊긴 것처럼 보였다.
    // 이제 상태 계약(State.squeegeeView)과 같은 기준 — 마감 단계에 들어갔는가 — 만 본다.
    const moving = !!(P && State.squeegeeView(P, ART, 1).moving > 0);
    if (!moving) return;
    // 마감 직전 「멈칫」 구간에서는 밀대가 잘게 떤다 (v6 정본 연출).
    // v7 · 52-4: 잉크가 바닥난 순간 「덜컹」 걸리는 동안에도 같은 떨림을 쓴다.
    const hitching = performance.now() < inkHitchUntil;
    const tremor = (P.phase === "freeze" || hitching) ? Math.round(Math.sin(clock / 18)) : 0;
    // 유리창 밀대와 같은 그리기 함수를 쓴다 — 두 밀대가 같은 도구처럼 보이고,
    // 잉크 둑을 끄는 방식(색을 비운다)도 한 곳에서 같은 뜻으로 돈다.
    // 잉크 둑 색은 지금 찍고 있는 색판의 물감색이다.
    Art.drawSqueegee(ctx, P.pos || 0, inkDam ? printInkColor(P) : null, clock, tremor);
  }

  // ── 밑그림 A/B (2026-08-25 계약 2) ─────────────────────────────
  // A 단색 윤곽(기본): 채우지 않은 한 색 윤곽선 — 미완성임이 한눈에 읽힌다.
  // B 옅은 원색: 원작 색을 쓰되 완성품으로 보이지 않을 만큼 낮은 불투명도다.
  // 둘 다 「밑」그림이라 찍힌 색판 아래에 깔린다. 다 찍히면 저절로 덮여 사라진다.
  const UNDERDRAW_OUTLINE_COLOR = "#7d6f5c"; // 연필 자국 같은 한 색
  const UNDERDRAW_OUTLINE_ALPHA = 0.55;
  const UNDERDRAW_TINT_ALPHA = 0.18; // 원색이지만 완성품으로 읽히지 않는 진하기
  const underdrawCache = {};
  // 2026-08-25 검수 지적 1로 갱신: 옛 구현은 「이웃과 색이 다른 칸」을 통째로 칠했다.
  // 16×16에서는 거의 모든 칸이 경계라 윤곽이 아니라 흰 면 덩어리가 됐다.
  // 이제 규칙 파일이 내는 「선 픽셀」을 그대로 찍는다 — 칸 안쪽은 손대지 않는다.
  function outlineRectsFor(P) {
    const key = P.originalKey || "mewna-lisa";
    if (!underdrawCache[key]) {
      underdrawCache[key] = State.underdrawOutlinePixels(P.artRows, ART, SUB);
    }
    return underdrawCache[key];
  }
  function drawUnderdrawing(ctx, P, mode) {
    if (!P || !P.artRows || !P.colors) return;
    if (Number(mode) === 1) {
      // B — 옅은 원색
      ctx.globalAlpha = UNDERDRAW_TINT_ALPHA;
      for (let y = 0; y < ART; y += 1) {
        for (let x = 0; x < ART; x += 1) {
          const tint = P.colors[P.artRows[y][x]];
          if (!tint) continue; // v5: 원작 비율 밖(틀 여백 " ")은 도화지 그대로 둔다
          ctx.fillStyle = tint;
          ctx.fillRect(x * SUB, y * SUB, SUB, SUB);
        }
      }
      ctx.globalAlpha = 1;
      return;
    }
    // A — 단색 윤곽 (기본). 1픽셀짜리 선만 찍으므로 칸 한가운데는 언제나 도화지 그대로다.
    const rects = outlineRectsFor(P);
    ctx.globalAlpha = UNDERDRAW_OUTLINE_ALPHA;
    ctx.fillStyle = UNDERDRAW_OUTLINE_COLOR;
    for (let i = 0; i < rects.length; i += 1) {
      const r = rects[i];
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    ctx.globalAlpha = 1;
  }

  // ── 잉크 부족 「치약 쥐어짜기」 (2026-10-16 v7 · 형님 46-B) ─────────────
  // v6까지의 「마른 줄 = 도화지 폭 전체 세로 긁힘」(2026-08-25 계약 1)은 형님이 A·B·C 비교판을 보고
  // 8/24 치약 쥐어짜기(B)로 되돌렸다. 이제 마른 줄도 따로 합성하지 않고, 색판 칸을 찍을 때
  // 엔진이 줄마다 남긴 진하기(P.dens)만큼만 칸을 남긴다 — 고르는 식은 State.inkSqueezeKeepCell 하나다.
  // 엔진이 찍은 줄마다 진하기를 남긴다(마른 줄 = 12%). 기록이 없는 줄(완성작 정지 화면 등)은 온전히 찍는다.
  function squeezeDensityAt(P, plateIndex, y) {
    const densRows = P.dens && P.dens[plateIndex];
    return densRows && densRows[y] !== undefined ? densRows[y] : 1;
  }
  let lastPrintDamShown = false; // 검사용 — 지금 인쇄 밀대에 잉크 둑을 그렸는가

  function drawBenchPrint(ctx, P, clock, frameDt, inkDam, showSqueegee, underdrawing) {
    ctx.clearRect(0, 0, CV, CV);
    ctx.fillStyle = "#f4efe2";
    ctx.fillRect(0, 0, CV, CV);
    ctx.fillStyle = "#eae3d2";
    ctx.fillRect(0, CV - 1, CV, 1);
    ctx.fillRect(CV - 1, 0, 1, CV);
    if (P) {
      // 밑그림이 먼저 깔린다 — 찍힌 색판(잉크가 모자란 줄은 듬성듬성)이 그 위에 올라간다.
      drawUnderdrawing(ctx, P, underdrawing);
      const alignT = P.snapped ? easeOut(Math.min(1, (clock - P.snapT) / 250)) : 0;
      // 시안 D 정본: 밀대가 방금 한 칸 지나갔으면 그림 전체가 1px 눌리듯 흔들린다.
      const painting = P.phase === "ready" || P.phase === "auto";
      const rowAge = clock - P.lastRowT;
      const dy = (painting && rowAge >= 0 && rowAge < C.SHAKE_MS) ? -1 : 0;
      // v9: 색판 수 = 원작 색 수(4~6) — 판마다 한 색
      for (let k = 0; k < P.plates.length; k += 1) {
        const prog = P.plateProg[k];
        if (prog <= 0) continue;
        const off = engine.GROUP_OFF[k % engine.GROUP_OFF.length];
        const ox = Math.round(off[0] * (1 - alignT));
        const oy = Math.round(off[1] * (1 - alignT));
        const cells = P.plates[k];
        for (let i = 0; i < cells.length; i += 1) {
          const x = cells[i][0];
          const y = cells[i][1];
          if (y >= prog) continue;
          // v7: 잉크가 모자란 줄은 칸이 군데군데 빠진다 (마른 줄은 12%만 마른 점으로)
          const den = squeezeDensityAt(P, k, y);
          if (den < 1 && !State.inkSqueezeKeepCell(x, y, k, den)) continue;
          ctx.fillStyle = P.colors[P.artRows[y][x]] || "#000";
          ctx.fillRect(x * SUB + ox, y * SUB + oy + dy, SUB, SUB);
        }
      }
      for (let r = 0; r < ART; r += 1) {
        const age = clock - P.rowT[r];
        // ② 줄 "착!" 반짝 — 판정된 줄만 잠깐 (중간 광택 아님: 판정 피드백)
        if (age >= 0 && age < 160) {
          ctx.globalAlpha = 0.55 * (1 - age / 160);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, r * SUB + dy, CV, SUB);
        }
        // ① 젖은 광택 — 잉크 둑이 지나간 자리가 천천히 마른다 (시안 D 정본)
        if (age >= 0 && age < C.WET_MS) {
          ctx.globalAlpha = 0.22 * (1 - age / C.WET_MS);
          ctx.fillStyle = "#cfe8ff";
          ctx.fillRect(0, r * SUB + dy, CV, SUB);
        }
      }
      ctx.globalAlpha = 1;
    }
    if (frameDt > 0) {
      particles = particles.filter(function (p) { return (p.life -= frameDt) > 0; });
      particles.forEach(function (p) {
        p.vy += 60 * frameDt;
        p.x += p.vx * frameDt;
        p.y += p.vy * frameDt;
      });
    }
    particles.forEach(function (p) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    });
    ctx.globalAlpha = 1;
    // 밀대는 그림과 입자 위에 얹는다 — 손에 든 도구가 종이 위에 있기 때문이다.
    // 몇 장에 그릴지는 drawWorkCanvases가 상태 계약(State.squeegeeView)으로 정해 넘긴다.
    if (showSqueegee) drawPrintSqueegee(ctx, P, clock, inkDam);
  }

  // ── 그리기: 작업대별 그림면 ─────────────────────────────────
  // 지금 밀고 있는 작품은 실제 인쇄 상태(view.S.print)를 그대로 그린다.
  // 순차 제작에서 이미 마감한 작품은 자기 자리에 완성된 모습으로 남아야 하므로,
  // 그 작품의 원작으로 「전부 찍힌」 정지 상태를 만들어 그린다.
  // (입자 계산은 첫 그림면에서 한 번만 돌린다 — 두 번 밀리지 않게 한다.)
  const finishedCache = {};
  function finishedPrintFor(work) {
    const key = work.originalKey || "mewna-lisa";
    if (finishedCache[key]) return finishedCache[key];
    const original = Art.originalByKey(key);
    if (!original) return null;
    const groups = engine.PLATE_GROUPS[key] || engine.PLATE_GROUPS["mewna-lisa"];
    const plates = groups.map(function () { return []; });
    original.art.forEach(function (row, y) {
      for (let x = 0; x < ART; x += 1) {
        const ch = row[x];
        for (let k = 0; k < groups.length; k += 1) {
          if (groups[k].indexOf(ch) >= 0) { plates[k].push([x, y]); break; }
        }
      }
    });
    finishedCache[key] = {
      originalKey: key,
      artRows: original.art,
      colors: original.colors,
      plates: plates,
      plateProg: plates.map(function () { return ART; }),
      rowT: new Array(ART).fill(-1e9),
      lastRowT: -1e9,
      phase: "reveal",
      snapped: true,
      snapT: -1e9,
      curPlate: plates.length - 1,
      extraPass: false,
    };
    return finishedCache[key];
  }
  function drawWorkCanvases(s, view, frameDt) {
    const P = view.S.print;
    const active = s.activeWorkSlot;
    const sequential = s.review.productionMode === "sequential";
    // 「지금 실제로 밀리고 있는 작품이 몇 장인가」 — 순차는 대상 한 장, 동시는 아직
    // 마감하지 않은 작품 전부다. 이 수를 상태 계약에 물어 밀대를 몇 개 그릴지 정한다.
    const liveSlots = s.works.reduce(function (n, work, index) {
      const live = sequential ? index === active : !work.done;
      return n + (live ? 1 : 0);
    }, 0);
    // 화면이 밀대를 자기 마음대로 그리지 않고 상태 계약을 통해 정한다.
    // moving이 0이면 어느 그림면에도 밀대가 없어야 한다(잉크가 바닥나 멈춘 그림 등).
    const sq = State.squeegeeView(P, null, liveSlots);
    // 2026-08-25 계약 2: 디버그창의 밑그림 선택은 「지금 제작 중인 모든 작품」에
    // 즉시 든다 — 여기서 한 번 읽어 모든 그림면에 같은 값을 넘긴다.
    const underdrawing = (s.debug && s.debug.values) ? s.debug.values.underdrawing : 0;
    let painted = 0;
    s.works.forEach(function (work, index) {
      const ctx = benchCtxOf[BENCH_TAGS[index]];
      if (!ctx) return;
      // 순차 제작에서는 대상 작품만 살아 있는 인쇄를 쓴다.
      const live = sequential ? index === active : true;
      const target = live ? P : (work.done ? finishedPrintFor(work) : null);
      const dt = painted === 0 ? frameDt : 0;
      // 밀대는 「지금 실제로 밀리고 있는 작품」에만 그린다. 순차 제작이면 대상 한 장,
      // 동시 제작이면 진행 중인 작품 전부에 각자의 밀대가 생긴다.
      // 이미 마감된 작품에는 밀대가 없다 — 손을 뗀 그림이기 때문이다.
      const showSqueegee = sq.moving > 0 && live && !work.done;
      // v7(8/24 치약 쥐어짜기): 잉크가 바닥나면 밀대 앞 잉크 둑도 사라진다 — 마른 날만 지나간다.
      // 잔량 0이어도 마지막 줄을 막 찍고 마감 중(자동 마무리 · 멈칫)이면 둑을 남긴다 — 다음 밀기를 기다릴 때만 끈다.
      const inkEmpty = !!(P && P.inkOut) || (!(s.ink && s.ink.cells > 0) && !!P && P.phase === "ready");
      if (live) lastPrintDamShown = showSqueegee && inkDamOn(s, "print") && !inkEmpty;
      drawBenchPrint(ctx, target, view.clock, dt,
        showSqueegee && inkDamOn(s, "print") && !inkEmpty, showSqueegee, underdrawing);
      painted += 1;
    });
  }

  // ── 밀대 잉크색 ────────────────────────────────────────────────
  // 잉크 둑은 지금 찍고 있는 색판의 물감색을 그대로 쓴다 (v6 시안 D 정본).
  // 옛 공통 막대의 세로 궤도(top 118px에서 시작하던 별도 좌표)는 2026-08-19에 폐기됐다.
  // 밀대가 도화지 그림 안으로 들어가면서 시작·끝 위치를 그림 좌표가 직접 정한다 —
  // 맨 윗줄이 0, 맨 아랫줄이 끝이라 별도 좌표를 손으로 맞출 일이 없어졌다.
  function printInkColor(P) {
    const groups = engine.PLATE_GROUPS[P.originalKey] || engine.PLATE_GROUPS["mewna-lisa"];
    const inkChar = (groups[P.extraPass ? groups.length - 1 : P.curPlate] || groups[0])[0];
    return P.colors[inkChar] || "#22352c";
  }
  // 2026-08-19: 위쪽 공통 나무 막대는 폐기됐다. 밀대가 도화지 그림 안으로 들어가면서
  // (v6 시안 D) 도화지마다 자기 밀대를 갖게 됐고, 공동 막대는 역할이 사라졌다.
  // 두 밀대가 함께 보이면 오히려 밀대가 두 개인 것처럼 읽힌다 (2026-08-19 동현 확정).

  // ── 상황 안내 한 줄 (전화기 곁 상시 문장 금지 — 왼쪽 줄에만) ──
  function workshopHintText(s) {
    if (!s.started) return "「화면을 눌러 시작」을 누르세요.";
    if (s.phone.ringing) return "전화가 울리고 있어요 — 가운데 위 빨간 전화기를 눌러 받으세요.";
    // 손실 결과가 열려 있으면 확인이 먼저다 — 다음 진행은 그 뒤에 열린다 (라운드 001).
    if (s.lossResult && s.lossResult.pending) {
      return "도화지 " + s.lossResult.paperCost + "$ / 판매 " + s.lossResult.salePrice
        + "$ / 손실 " + s.lossResult.loss + "$ — 아래 결과판의 「확인」을 누르세요.";
    }
    if (s.print && s.print.inkOut && !s.resultsOpen) {
      // 2026-08-25 계약 1: 흐름은 끊기지 않았다 — 밀대는 끝까지 내려갔고 모자란 구간만 말랐다.
      return "잉크가 모자랐어요 — 밀대는 끝까지 내려갔지만 마른 자국이 남아 미완성입니다.";
    }
    if (s.resultsOpen) {
      const incomplete = s.works.find(function (w) { return w.incomplete && !w.outcome; });
      if (incomplete) {
        return "미완성 작품이 작업대에 남았어요 — 아래 결과판에서 「미완성 복제품 "
          + incomplete.price + "$에 판매」를 눌러 직접 파세요.";
      }
      return s.works.length > 1
        ? "두 작품이 끝났어요 — 아래 결과판에서 작품마다 복제품 판매나 갤러리 전시를 고르세요."
        : "작품이 끝났어요 — 아래 결과판에서 복제품 판매나 갤러리 전시를 고르세요.";
    }
    if (s.catalog === "landed") return "작업대에 떨어진 카탈로그를 눌러 보세요.";
    // 2026-10-20 v9 · 6-A: 첫 잉크통 선물이 남아 있으면 그것부터 알린다
    if (!s.hasPaper && s.sheet && s.sheet.free && !s.resultsOpen) {
      return "첫 잉크통 선물 — 다음 한 장은 참가비 없이 그립니다. 왼쪽 원작 카드를 누르세요.";
    }
    if (s.awaitingOriginal) {
      return s.unlocked.catalog
        ? "흰 도화지가 놓였어요 — 왼쪽 위 원작 자리를 눌러 그림을 고르세요."
        : "흰 도화지가 놓였어요. 무엇을 찍을지 알려 줄 물건이 곧 도착합니다.";
    }
    if (s.hasPaper) {
      // 다음 한 번의 입력을 채울 잉크가 없으면 밀기 전에 제작 전체가 멈춘다.
      if (s.ink.state === "blocked" && s.print && !s.print.inkOut) {
        return "잉크가 다음 입력 비용보다 " + s.ink.shortagePercent
          + "% 모자라요 — 입력 전에 제작 전체가 차단됩니다.";
      }
      if (s.print && (s.print.phase === "ready" || s.print.phase === "auto")) {
        const target = s.works.length > 1 && s.review.productionMode === "sequential"
          ? " · " + (s.activeWorkSlot + 1) + "번 작업대"
          : "";
        // 2026-08-25 계약 1: 「인쇄 1/3회」가 아니라 「밀대 진행 1/3」 형식으로 말한다.
        // v9: 한 번에 한 색 — 직접 미는 횟수는 원작마다 다르다(3~5)
        return "밀대 진행 " + s.print.stroke + "/" + s.print.roundsTotal + target
          + " — 작업대 위에서 휠을 아래로 굴리면 한 색씩 찍힙니다.";
      }
      return s.works.length > 1
        ? "자동 마감 중 — 결과가 나오면 두 작품을 각각 처리합니다."
        : "자동 마감 중 — 결과가 나오면 결과판에서 처리 방법을 고릅니다.";
    }
    // 2026-10-20 v9: 한 장 제작 — 첫 손실 학습 뒤에는 잉크통을 먼저 산다(v8 규칙 그대로)
    if (s.unlocked.paper && s.sheet && s.sheet.needInkTank) {
      return "상점 탭에서 잉크통을 먼저 사면 다음 한 장을 그릴 수 있어요.";
    }
    if (s.unlocked.paper && !s.hasPaper && s.money >= s.workbench.paperCost) {
      return "왼쪽 원작 카드를 누르면 참가비를 내고 바로 한 장 그립니다.";
    }
    // 새로 열린 두 번째 작업대 상품 — 사기 전까지 어디에서 사는지 알려 준다.
    const offer = s.workbenchOffer;
    if (offer && !offer.purchased) {
      return offer.affordable
        ? "상점 탭에 「" + offer.label + "」이(가) 열렸어요 — " + offer.cost + "$에 살 수 있습니다."
        : "상점 탭에 「" + offer.label + "」이(가) 열렸어요 — " + offer.cost + "$가 모이면 살 수 있습니다.";
    }
    const buyable = s.shop.items.find(function (i) { return i.affordable; });
    if (buyable) return "상점 탭에 「" + buyable.label + "」이(가) 있어요 — 지금 살 수 있습니다.";
    if (s.mode === "window") {
      // 2026-08-19: 겹 수가 4겹으로 바뀌었고 디버그로 3·5겹도 고를 수 있어
      // 숫자를 글에 박지 않고 지금 도는 값을 그대로 읽는다.
      const need = s.window ? s.window.layers : s.debug.values.windowLayers;
      // 2026-08-26: 한 장에는 선투자가 붙는다. 처음 밀 때 한 번만 나간다는 것을 함께 말한다.
      return "휠을 아래로 굴려 밀대를 끝까지 미세요. 완주 " + need
        + "번이면 창문 한 장이에요. 처음 밀 때 선투자 "
        + (s.windowCosts ? s.windowCosts.upfront : 0) + "$가 한 번만 나갑니다.";
    }
    if (s.unlocked.paper) return "유리창 알바로 돈을 모으면 원작 한 장을 그릴 수 있어요.";
    return "유리창 알바를 눌러 창문을 닦아 보세요.";
  }

  // benchCaptionText(작업대 아래 설명 글)는 2026-08-20 형 확정으로 제거됐다 (라운드 005 문제 A).
  // 3·4대에서 도화지를 덮었고, 싣던 정보는 전부 workshopHint(왼쪽 카드)·recEvent(오른쪽 기록)에
  // 이미 중복돼 있음을 하나씩 대조해 확인했다. 유리창 조작법만 scrollHelpBox 팝업으로 남는다.

  // ── 매 프레임 화면 갱신 ──────────────────────────────────────
  let lastCatalogState = "none";
  let lastSlotOriginal = "__none__";
  let lastLotKey = "__none__"; // 2026-10-08 4단계 — 경매장 문 실루엣을 매물이 바뀔 때만 다시 그린다
  let lastLevelLotKey = "__none__"; // 2026-10-12 v5 — 레벨업 칸 그림도 매물이 바뀔 때만 다시 그린다
  let dexOpen = false;
  let lastOverlayInert = false;
  const textCache = {};
  function putText(id, text) {
    if (textCache[id] === text) return;
    textCache[id] = text;
    $(id).textContent = text;
  }
  function setText(node, text) {
    if (node.__txt === text) return;
    node.__txt = text;
    node.textContent = text;
  }

  function setBackgroundInert(on) {
    if (lastOverlayInert === on) return;
    lastOverlayInert = on;
    ["reviewBar"].map($).concat([
      document.querySelector('[data-anchor="left-rail"]'),
      document.querySelector('[data-anchor="center-workspace"]'),
      document.querySelector('[data-anchor="right-rail"]'),
    ]).forEach(function (section) {
      if (!section) return;
      if (on) section.setAttribute("inert", "");
      else section.removeAttribute("inert");
    });
  }

  // ── 검수 전용 제작 전환 (2026-08-15) ─────────────────────────
  // 작업대 1~4개 · 동시 제작 해금 · 순차/동시 선택을 상단 검수 바에서만 다룬다.
  // 제작 중(첫 입력 이후)에는 엔진이 전환을 거절하므로 버튼도 함께 비활성으로 둔다 —
  // 「제작 중 방식 변경을 어떻게 할지」 자체는 아직 미정이라 이 시안이 확정하지 않는다.
  const REVIEW_BENCH_BTNS = [
    { n: 1, id: "reviewBench1" },
    { n: 2, id: "reviewBench2" },
    { n: 3, id: "reviewBench3" },
    { n: 4, id: "reviewBench4" },
  ];
  function renderReviewTools(s, canAct) {
    const r = s.review;
    const open = canAct && !r.modeSwitchLocked;
    REVIEW_BENCH_BTNS.forEach(function (item) {
      const btn = $(item.id);
      btn.dataset.on = String(r.workbenchCount === item.n);
      btn.disabled = !open;
    });
    const unlockBtn = $("reviewSimulUnlock");
    unlockBtn.dataset.on = String(r.simultaneousUnlocked);
    unlockBtn.disabled = !open;
    const seqBtn = $("reviewModeSequential");
    const simBtn = $("reviewModeSimultaneous");
    seqBtn.dataset.on = String(r.productionMode === "sequential");
    simBtn.dataset.on = String(r.productionMode === "simultaneous");
    seqBtn.disabled = !open;
    simBtn.disabled = !open || !r.simultaneousUnlocked;
  }

  // ── 자동판매 켜고 끄기 (2026-08-19) ────────────────────────────
  // 산 뒤에만 보인다. 갤러리에 걸고 싶은 작품이 나왔을 때 잠시 꺼 두라고 만든 스위치라,
  // 없으면 자동판매를 사는 순간 갤러리에 걸 작품이 영영 안 생긴다.
  function renderAutoSellSwitch(s, canAct) {
    const box = $("autoSellSwitch");
    const show = !!s.automation.sellWork;
    if (box.hidden !== !show) box.hidden = !show;
    if (!show) return;
    const on = !!s.automation.sellOn;
    $("autoSellOnBtn").dataset.on = String(on);
    $("autoSellOffBtn").dataset.on = String(!on);
    $("autoSellOnBtn").disabled = !canAct;
    $("autoSellOffBtn").disabled = !canAct;
    putText("autoSellNote", on
      ? "완성작을 알아서 팝니다 (미완성·골드 이상 제외)"
      : "지금은 직접 팝니다 — 갤러리에 걸 작품을 고를 수 있어요");
  }

  // ── 상점 최초 해금 아이콘 팝업 (2026-08-26 v1 계약 6항) ─────────────
  // 새 장비가 「처음」 열릴 때만 뜬다. 화면을 덮지 않는 작은 알림이라 게임을 멈추지
  // 않고, 잠시 뒤 저절로 사라진다. 다음 단계 해금에서는 NEW만 켜지고 여기 오지 않는다.
  let shopPopupKey = "";
  let shopPopupTimer = 0;
  function showShopUnlockPopup(key, label) {
    if (shopPopupKey === key) return;
    shopPopupKey = key;
    putText("shopUnlockName", label);
    Art.drawUpgradeIcon($("shopUnlockIcon"), key);
    $("shopUnlockPopup").dataset.open = "true";
    clearTimeout(shopPopupTimer);
    shopPopupTimer = setTimeout(function () {
      $("shopUnlockPopup").dataset.open = "false";
    }, 3200);
  }

  function renderShop(s, canAct) {
    putText("shopCount", s.shop.revealed + " / " + s.shop.total + " 열림");
    renderAutoSellSwitch(s, canAct);
    // 상점 탭을 보고 있는 동안이 곧 「카드 확인」이다 — 팝업·NEW가 함께 꺼진다.
    if (activePane === "shop") {
      s.shop.items.forEach(function (item) {
        if (item.isNew) engine.confirmShopCard(item.key);
      });
    }
    if (s.shop.unlockPopup && activePane !== "shop") {
      showShopUnlockPopup(s.shop.unlockPopup.key, s.shop.unlockPopup.label);
    }
    s.shop.items.forEach(function (item, index) {
      const el = upgEls[item.key];
      const meta = UPGRADES[index];
      // 가격·현재 단계·구매 상태 글자는 전부 표기 계약 함수가 정한다.
      const card = State.shopCardText(item);
      let mode;
      if (!item.revealed) mode = "locked";
      else if (item.gatedSegment) mode = "locked"; // v9: 다음 단계가 구간에 막힘(잉크통 2 · 3단계) — 시안 2판처럼 「구간 n」
      else if (item.owned) mode = "owned";
      else if (item.affordable) mode = "ready";
      else mode = "short";
      if (el.root.dataset.state !== mode) el.root.dataset.state = mode;
      el.root.disabled = !(canAct && mode === "ready"); // 최종 단계(owned)는 계속 클릭 불가
      // 2026-08-26 v1 계약 6항 — 이 카드에 NEW를 켜 두어야 하는가.
      // 상점 탭을 보고 있는 동안이 곧 「카드 확인」이라 그때는 켜지 않는다.
      const cardNew = String(!!item.isNew && activePane !== "shop");
      if (el.root.dataset.new !== cardNew) el.root.dataset.new = cardNew;
      if (item.revealed) {
        // 0827 승인 · 작업 탭 UI 통일 — 카드 본문은 정확히 네 가지다:
        // 이름 / 현재 돈 금액($) / 레벨 / 레벨 게이지바.
        // 짧은 효과문·도구 설명(item.note)·「지금 살 수 있어요」·「MAX」·교착 안내는
        // 본문에서 빠지고 접근성 이름에만 남는다 — 같은 사실을 카드 상태(data-state),
        // 활성 여부, 가득 찬 게이지가 이미 눈으로 말하고 있다.
        // v9: 구간 관문에 막힌 카드는 「전체 단계 중 몇 단계」로 게이지를 채운다(관문 앞 단계로 재면 가득 차 MAX처럼 보인다)
        const gauge = State.shopCardGauge(item.gatedSegment ? Object.assign({}, item, { maxLevel: item.fullMaxLevel }) : item);
        paintWorkCard(el, State.workCardText({
          name: item.label,
          money: item.cost,       // 지금 사는 값 — 엔진 수치를 그대로 읽는다
          level: gauge.level,
          maxLevel: gauge.maxLevel,
        }));
        // v9: 구간 관문에 막힌 다음 단계는 값 대신 「구간 n」(시안 2판 잉크통 카드)
        if (item.gatedSegment) setText(el.money, "구간 " + item.gatedSegment);
        el.root.dataset.guard = String(!!item.reserveBlocked);
        el.root.setAttribute("aria-label",
          item.label + " " + card.cost
          + ", " + item.effect + (item.note ? " · " + item.note : "")
          // 눈으로만 읽히는 게이지를 소리로도 같이 말한다 (2026-08-27 v4).
          + ", 단계 " + gauge.label
          + ", " + (item.gatedSegment ? "다음 단계는 구간 " + item.gatedSegment + " 달성 뒤"
            : item.reserveBlocked ? State.deadlockGuardShort() : card.state));
      } else if (index === s.shop.revealed) {
        setText(el.name, "다음 업그레이드");
        setText(el.money, "");
        setText(el.level, "");
        el.root.setAttribute("aria-label",
          "아직 열리지 않은 다음 업그레이드 — " + unlockHint(meta));
      } else {
        setText(el.name, "잠김");
        setText(el.money, "");
        setText(el.level, "");
        el.root.setAttribute("aria-label", "잠긴 업그레이드");
      }
    });
  }

  // ── 두 번째 작업대 상품 카드 (2026-08-12 계약 7~11) ────────────
  // 첫 정상 완성품을 판 순간에만 열린다. 열린 뒤에도 칸은 그대로 한 칸이고,
  // 60원을 실제로 내야 같은 규격 작업대 한 대가 더 선다 — 무료 확장은 없다.
  // 카드 금빛 테두리는 상점을 열어 확인하기 전까지만 켜진다.
  function renderWorkbenchOffer(s, canAct) {
    const benchCard = $("upg-secondWorkbench");
    // 2026-10-06 두 방 데모 B-1: 작업대 확장 제외 — 상품 카드는 상점에 서지 않는다(자리째 숨김).
    if (!State.EXPANSION_TEST_VALUES.secondWorkbenchOffered) {
      if (!benchCard.hidden) benchCard.hidden = true;
      if (benchCard.dataset.new !== "false") benchCard.dataset.new = "false";
      benchCard.disabled = true;
      return;
    }
    const offer = s.workbenchOffer;
    // 상점 탭을 보고 있는 동안이 곧 「카드 확인」이다.
    if (offer && activePane === "shop") engine.confirmWorkbenchCard();
    const lit = !!(offer && offer.isNew) && activePane !== "shop";
    if (lit) benchCard.dataset.new = "true";
    else benchCard.dataset.new = "false";
    if (!offer) {
      if (benchCard.dataset.state !== "locked") benchCard.dataset.state = "locked";
      benchCard.disabled = true;
      setText(benchOfferEls.name, "다음 상품");
      setText(benchOfferEls.money, "");
      setText(benchOfferEls.level, "");
      benchCard.setAttribute("aria-label",
        "아직 열리지 않은 두 번째 작업대 상품 — 첫 정상 작품을 팔면 열립니다");
      return;
    }
    const mode = offer.purchased ? "owned" : offer.affordable ? "ready" : "short";
    if (benchCard.dataset.state !== mode) benchCard.dataset.state = mode;
    benchCard.disabled = !(canAct && mode === "ready");
    // 0827 승인 · 작업 탭 UI 통일 — 이 상품 카드도 같은 네 칸만 담는다.
    // 「레벨」은 지금 세운 작업대 대수다(1대 → 2대). 수치는 엔진에서 그대로 읽는다.
    paintWorkCard(benchOfferEls, State.workCardText({
      name: offer.label,
      money: offer.cost,
      level: offer.purchased ? 2 : 1,
      maxLevel: 2,
    }));
    benchCard.dataset.guard = String(!!offer.reserveBlocked);
    benchCard.setAttribute("aria-label", offer.label + " "
      + State.moneyText(offer.cost) + ", " + offer.effect + " · " + offer.note
      + ", " + (offer.purchased ? "작업대 2대"
        : offer.reserveBlocked ? State.deadlockGuardShort()
          : offer.affordable ? "지금 살 수 있어요" : "돈이 모자라요"));
  }

  // ── 결과판 — 실제로 산 작품만큼만 카드를 켠다 ──────────────────
  // 두 번째 정상 작품까지는 기존 학습 흐름대로 자동 판매하고, 갤러리가 열린 뒤부터
  // 이 판이 마감 경로가 된다. 판매+판매·판매+전시·전시+판매를 모두 허용하며,
  // 전시를 막는 것은 남은 무료 전시 칸뿐이다.
  // 라운드 001: 첫 미완성 작품도 여기서 직접 팔고(자동 판매 없음), 판 직후에는
  // 같은 자리가 「도화지 / 판매 / 손실」 결과와 「확인」으로 바뀐다.
  function lossPending(s) {
    return !!(s.lossResult && s.lossResult.pending);
  }
  function resultBoardMode(s) {
    if (lossPending(s)) return "loss";
    return s.resultsOpen ? "results" : "";
  }

  function renderResultBoard(s, canAct) {
    const board = $("resultBoard");
    const mode = resultBoardMode(s);
    const open = mode !== "";
    if (board.dataset.open !== String(open)) board.dataset.open = String(open);

    // 손실 결과 — 숫자 세 줄과 「확인」. 확인 전에는 다음 진행이 열리지 않는다.
    const lossBox = $("lossBox");
    const showLoss = mode === "loss";
    if (lossBox.hidden !== !showLoss) lossBox.hidden = !showLoss;
    $("boardWorks").hidden = showLoss;
    $("lossConfirmBtn").disabled = !(canAct && showLoss);
    if (showLoss) {
      const rec = s.lossResult;
      putText("boardTitle", "첫 작품 결과 — 참가비보다 " + rec.loss + "$ 모자랍니다");
      putText("lossPaper", rec.paperCost + "$");
      putText("lossSale", rec.salePrice + "$");
      putText("lossDiff", rec.loss + "$");
      putText("boardNote", "잉크가 모자라 그림을 끝까지 찍지 못했고, 미완성 복제품은 "
        + "참가비보다 싸게 팔립니다. 「확인」을 누르면 다음 이야기가 이어집니다.");
      return;
    }

    if (open) {
      const incomplete = s.works.some(function (w) { return w.incomplete && !w.outcome; });
      putText("boardTitle", incomplete
        ? "잉크가 바닥나 미완성으로 멈췄습니다 — 복제품으로 넘기세요"
        : s.works.length > 1
          ? s.works.length + "개 작품이 완성됐습니다 — 작품마다 판매나 전시를 고르세요"
          : "작품이 완성됐습니다 — 판매나 전시를 고르세요");
      putText("boardNote", incomplete
        ? "미완성 복제품은 등급 없이 정액입니다. 판매 버튼을 누르면 참가비와 얼마나 "
          + "차이 나는지 바로 보여 드립니다."
        : "판매는 복제품이라고 밝히는 안전 판매입니다. "
          + "전시한 작품은 가치가 오르고, 작품 버프와 경매 출품 자격의 대상입니다. "
          + "무료 전시 칸은 하나라 두 점을 동시에 걸 수는 없습니다.");
    }

    BENCH_TAGS.forEach(function (tag, index) {
      const work = s.works[index];
      const card = $("boardWork" + tag);
      const sellBtn = $("sellWork" + tag);
      const showBtn = $("displayWork" + tag);
      const pending = !!(work && work.done && !work.outcome);
      // 사지 않은 칸의 카드는 아예 내린다 — 한 장짜리 묶음은 카드도 하나다.
      if (card.hidden !== !work) card.hidden = !work;
      if (work) {
        putText("workGrade" + tag, work.outcome === "sold"
          ? work.gradeLabel + " · 판매 완료 +" + work.price + "$"
          : work.outcome === "gallery"
            ? work.gradeLabel + " · 갤러리 전시 중"
            : (work.incomplete ? "미완성 작품" : work.gradeLabel) + " · " + work.price + "$");
        // 미완성 작품은 등급가가 아니라 정액이라는 것을 버튼 문구가 그대로 말한다.
        putText("sellWork" + tag, work.incomplete
          ? "미완성 복제품 " + work.price + "$에 판매"
          : "복제품으로 판매");
      } else {
        putText("workGrade" + tag, "");
      }
      // 판매는 아직 처리하지 않은 작품이면 언제나 열려 있다 (판매+판매 허용).
      // 전시는 갤러리가 열렸고 남은 무료 칸이 있을 때만 열린다 — 이것이 유일한 제한이다.
      sellBtn.disabled = !(canAct && pending);
      showBtn.disabled = !(canAct && pending && s.gallery.unlocked
        && s.gallery.used < s.gallery.capacity);
    });
  }

  // ── 갤러리 칸 — 무료 1칸. 주기 수입은 없다 ───────────────────
  let lastGalleryKey = "__none__";
  function renderGallery(s) {
    const panel = $("galleryPanel");
    if (panel.dataset.unlocked !== String(s.gallery.unlocked)) {
      panel.dataset.unlocked = String(s.gallery.unlocked);
    }
    const item = s.gallery.items[0] || null;
    if (panel.dataset.filled !== String(!!item)) panel.dataset.filled = String(!!item);
    putText("galleryCount", s.gallery.used + " / " + s.gallery.capacity);
    putText("galleryItem", item
      ? item.label + " 모작"
      : s.gallery.unlocked ? "빈 전시 칸" : "잠긴 전시 칸");
    // v9: 칸 안 작은 안내 글(galleryNote)은 뺐다(시안 2판 — 형님 「작은 설명 글 금지」). 같은 말은 접근성 이름에 남긴다.
    const galleryAria = "갤러리 — " + (item ? item.label + " 모작 전시 중"
      : s.gallery.unlocked ? "빈 전시 칸, 완성한 작품 한 점을 무료로 걸 수 있습니다"
        : "잠긴 전시 칸 — 작품을 두 점 이상 판 뒤 정상 작품을 팔면 무료 전시 칸이 열립니다");
    if (panel.getAttribute("aria-label") !== galleryAria) panel.setAttribute("aria-label", galleryAria);
    const key = item ? item.originalKey + "/" + item.grade : "__none__";
    if (lastGalleryKey !== key) {
      lastGalleryKey = key;
      const canvas = $("galleryCanvas");
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 64, 64);
      if (item) Art.drawOriginal(canvas, item.originalKey, 4);
    }
  }

  // 마감 알림 자리 — 「이대로 마감할지」를 물어야 할 때만 켜진다.
  // 2026-08-12 계약 2: 잉크가 바닥났다는 이유로는 켜지지 않는다. 그 순간 엔진이 곧바로
  // 미완성 결과판을 열고, 70원 판매는 결과판의 「미완성 복제품 70원에 판매」로만 이뤄진다.
  // 그래서 이 자리는 1.6초짜리 중간 상자로 쓰이지 않고, 잉크가 남은 채 마감을 묻는
  // 기존 용도만 그대로 맡는다. (결과판이 열리면 닫혀 두 상자가 겹치지 않는다.)
  function renderFinishChoice(s, canAct) {
    const box = $("finishChoice");
    const P = s.print;
    const open = !!(P && P.awaitingExtra) && !s.resultsOpen;
    if (box.dataset.open !== String(open)) box.dataset.open = String(open);
    $("sellNowBtn").disabled = !(canAct && open);
    if (!open) return;
    putText("sellNowBtn", "이대로 마감하기");
    putText("finishLine", "잉크가 남았습니다 — 이대로 마감하면 지금 결과로 결과판이 열립니다");
  }

  // 잉크 표시 — 작업대 바로 위. 칸이 아니라 완성 기준 퍼센트로만 말한다.
  // 작업대에 도화지가 한 장도 없으면 아예 끄고, 도화지를 한 장이라도 산 순간부터
  // 그 묶음 처리가 끝날 때까지 상시 켜 둔다 (라운드 005). 자리는 늘 예약돼 있다.
  function renderInk(s) {
    const panel = $("inkPanel");
    const show = s.hasPaper || s.works.length > 0;
    if (panel.hidden !== !show) panel.hidden = !show;
    if (!show) return;
    const out = !!s.ink.out;
    if (panel.dataset.out !== String(out)) panel.dataset.out = String(out);
    putText("inkView", State.inkCurrentText(s.ink.percent));
    putText("inkNeed", State.inkNeedText());
    $("inkFill").style.width = Math.min(100, s.ink.percent).toFixed(1) + "%";
    putText("inkState", out
      ? "잉크가 바닥나 그림이 미완성입니다"
      : s.hasPaper
        ? "밀 때마다 잉크가 줄어듭니다"
        : s.ink.percent >= 100
          ? "도화지를 사면 이 잉크가 종이에 채워집니다"
          : "지금 잉크통으로는 한 장을 끝까지 찍을 수 없습니다");
  }

  // ── 문 옆 잉크 카트리지 (2026-08-15 B 확정) ─────────────────
  // 액체 윗면(.ink-liquid 높이)과 수치판 숫자(#inkNowView)를 같은 갱신에서 함께 바꾼다.
  // 그래서 입력이 차단된 순간에는 둘 다 그대로 멈춰 있고, 잉크가 빠질 때는 함께 내려간다.
  // 「현재 잔량」과 「다음 한 번의 입력 비용」을 언제나 함께 글자로 보여 주며,
  // 가능한 입력이 2회 이하이면 색과 남은 횟수 문구를 함께 쓰는 주의 상태가 된다.
  function renderInkCartridge(s) {
    const box = $("inkCartridge");
    const ink = s.ink;
    // 2026-08-18 저녁 동현 지시: 도화지를 사기 전에는 잉크통이 화면에 아예 없다.
    // 소등한 대기 상태로 세워 두지 않는다 — 잉크 정보가 필요할 때만 등장한다.
    const show = !!ink.cartridgeVisible;
    if (box.hidden !== !show) box.hidden = !show;
    if (!show) return;
    if (box.dataset.state !== ink.state) box.dataset.state = ink.state;
    const idle = ink.state === "idle";
    // 액체 윗면과 숫자는 같은 render 경로에서 함께 갱신한다.
    $("inkLiquid").style.height = (idle ? 0 : Math.max(0, Math.min(100, ink.percent))) + "%";
    putText("inkNowView", idle ? "대기" : ink.percent + "%");
    putText("inkNextView", idle
      ? "도화지 없음"
      : "다음 -" + ink.nextCostPercent + "%");
    putText("inkCartridgeState", idle
      ? "제작할 작품 없음"
      : ink.state === "blocked"
        ? "차단 · " + ink.shortagePercent + "% 모자람"
        : ink.state === "warn"
          ? (ink.inputsLeft > 0
            ? "주의 · " + ink.inputsLeft + "회 가능"
            : "주의 · 이번 입력 도중에 바닥납니다")
          : "정상 · " + ink.inputsLeft + "회 가능");
  }

  // ── 2026-10-06 두 방 데모 A: 회차 표시 · 확률표 ─────────────────
  // 화면은 엔진 스냅샷의 「끝난 회차」 정보(print.best · roundsDone · probTable.held)만 읽는다.
  // 미리 세운 추첨 계획이나 최종 등급(targetGrade)은 읽지 않는다 — 회차가 끝나기 전에 결과를 드러내지 않는다.
  const BENCH_UNIT_IDS = ["benchUnitA", "benchUnitB", "benchUnitC", "benchUnitD"];
  const NEUTRAL_HELD_COLOR = "#57452c"; // 아직 확보 등급이 없을 때의 둘레선 (클로드판 NEUTRAL_COLOR)
  // 확률 칸 표기: 기본 「최종 결과 확률」(9/16 B · 9/30 체험판 기본값), 디버그 창에서 회차별로 바꿀 수 있다.
  let probDisplayMode = "final";
  let lastRoundMarkKey = "";
  function heldColorOf(key) { return key ? GRADE_COLORS[key] : NEUTRAL_HELD_COLOR; }

  // 확률표 — 2026-10-06 두 방 데모 B-1: 그림 바로 오른쪽 세로표(9/30 클로드판 그대로).
  // 줄마다 등급 / 확률 / 가격. 확보 등급 줄은 고정 강조, 표기(최종 결과 / 회차별)는 덩어리 A 그대로.
  function renderProbTable(s) {
    const t = s.probTable;
    const key = probDisplayMode + "|" + (t.held || "-") + "|"
      + t.rows.map(function (r) { return r.percent + "/" + r.roundPercent + "@" + r.price; }).join("|");
    if (textCache.__prob === key) return;
    textCache.__prob = key;
    const body = $("probRows");
    body.innerHTML = "";
    t.rows.forEach(function (r) {
      const row = document.createElement("tr");
      row.className = "prob-row";
      row.dataset.grade = r.key;
      const name = document.createElement("td");
      name.textContent = r.label;
      const prob = document.createElement("td");
      prob.className = "num";
      prob.textContent = probDisplayMode === "round" ? r.roundPercent : r.percent;
      const price = document.createElement("td");
      price.className = "num";
      price.textContent = r.price.toLocaleString("ko-KR") + "$";
      row.appendChild(name);
      row.appendChild(prob);
      row.appendChild(price);
      if (t.held === r.key) row.classList.add("held");
      body.appendChild(row);
    });
  }

  // 완료 점 ○○○ + 확보 등급 둘레선 — 지금 밀고 있는 작업대 한 대에만 붙는다.
  // 2026-10-16 v6 (메모 #2740 10번): 유리창 알바에도 같은 점을 같은 자리(틀 바깥 아래 가운데)에 붙인다.
  // 「어떤 행동이든 몇 번 밀어야 끝나는지 늘 보이게」 — 점 개수 = 창문 한 장의 밀대 완주 횟수(기본 4),
  // 끝낸 완주만큼 ●. 한 장이 끝나 새 창문으로 바뀌면 다시 ○부터. 유리창에는 등급이 없어 둘레선은 켜지 않는다.
  function windowMarks(s) {
    if (s.mode !== "window" || !s.window) return null;
    const total = Math.max(1, Math.round(Number(s.window.layers) || 1));
    // 완성 뒤 교체 연출 중에는 다 채운 채로 둔다(마지막 완주가 끝났다는 걸 보여 준다).
    // 교체 중이 아닐 때는 최대 total-1까지만 — 디버그로 겹 수를 진행도 이하로 줄여도 「다 참인데 안 끝남」이 안 보이게(검수 1).
    const done = s.window.swapping ? total : Math.max(0, Math.min(total - 1, s.window.pass));
    return { done: done, total: total };
  }
  function syncDotCount(dots, n) {
    while (dots.children.length < n) dots.appendChild(document.createElement("span"));
    while (dots.children.length > n) dots.removeChild(dots.lastChild);
  }
  function renderRoundMarks(s) {
    const P = s.mode !== "window" && s.hasPaper ? s.print : null;
    const W = P ? null : windowMarks(s);
    const slot = P ? s.activeWorkSlot : W ? 0 : -1; // 유리창은 언제나 첫 작업대(benchUnitA) 한 장
    // 2026-10-20 v9(시안 2판): 결과판이 열리면 인쇄 점은 결과판 뒤로 숨긴다(v8은 결과판이 점을 덮었다 — 겹침 금지).
    const boardOpen = !!(s.resultsOpen || lossPending(s));
    const key = slot + "|" + (boardOpen ? "board" : "") + "|" + (P ? P.roundsDone + "/" + P.roundsTotal + "|" + (P.best || "-") + "|" + (P.inkOut ? "x" : "")
      : W ? "w" + W.done + "/" + W.total : "-");
    if (key === lastRoundMarkKey) return;
    lastRoundMarkKey = key;
    BENCH_UNIT_IDS.forEach(function (id, i) {
      const box = $(id);
      if (!box) return;
      const on = (!!P || !!W) && i === slot && !(P && boardOpen);
      let dots = box.querySelector(".print-dots");
      if (!dots && on) {
        dots = document.createElement("div");
        dots.className = "print-dots";
        dots.setAttribute("aria-label", "완료한 회차");
        for (let k = 0; k < 3; k += 1) dots.appendChild(document.createElement("span"));
        box.appendChild(dots);
      }
      if (dots) {
        dots.hidden = !on;
        if (on) {
          const done = P ? P.roundsDone : W.done;
          // v9: 모작 인쇄 점 = 그 원작을 직접 미는 횟수(3 · 3 · 4 · 4 · 5 · 5) — 마지막 자동 마감 색은 세지 않는다
          const total = P ? P.roundsTotal : W.total;
          syncDotCount(dots, total);
          Array.prototype.forEach.call(dots.children, function (span, k) {
            span.classList.toggle("on", k < done);
            // v7 · 49-B: 잉크가 바닥난 인쇄는 못 찍게 된 회차 점이 잿빛 × (그림 위 글자 대신)
            span.classList.toggle("x", !!P && !!P.inkOut && k >= done);
          });
          dots.setAttribute("aria-label", P
            ? "완료한 회차 " + P.roundsDone + " / " + P.roundsTotal + (P.inkOut ? " · 잉크가 바닥나 여기까지" : "")
            : "닦은 횟수 " + W.done + " / " + W.total);
        }
      }
      const canvas = box.querySelector("canvas");
      if (canvas) {
        const held = !!P && i === slot;
        canvas.classList.toggle("held-frame", held);
        box.style.setProperty("--held-color", held ? heldColorOf(P.best) : NEUTRAL_HELD_COLOR);
      }
    });
  }

  // ── 잉크가 바닥나는 순간의 강조 (2026-10-16 v7 · 형님 49-B · 52: 1·2·3·4) ──
  // 시안 inkout-dots-mockup-2026-10-16-v2에서 고른 조합. 매번 같은 세기(「처음 두 번만 크게」는 안 씀).
  // 그림 위에는 글자를 올리지 않는다 — 인쇄 점 ×가 「이번 장은 여기까지」를 말한다.
  const INK_HITCH_MS = 260; // 4 밀대 멈칫 — 이 시간 동안 휠·키 입력이 밀대에 들어가지 않고 밀대가 떤다
  let inkHitchUntil = 0;
  // 연출 클래스를 붙였다가 ms 뒤에 뗀다 — 떼지 않으면 숨었던 잉크통·점이 다음 도화지에서 다시 보일 때
  // 애니메이션이 처음부터 또 재생된다(별도 검수 지적). 같은 연출을 다시 켜면 앞 타이머는 버린다.
  function replayFx(el, cls, ms) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth; // 같은 연출을 다시 켜려면 한 번 끊어 준다
    el.classList.add(cls);
    el._fxTimers = el._fxTimers || {};
    clearTimeout(el._fxTimers[cls]);
    el._fxTimers[cls] = setTimeout(function () { el.classList.remove(cls); }, ms);
  }
  function inkOutWarnFx() {
    lastRoundMarkKey = ""; // 점을 바로 ×로 다시 그리게 한다
    renderRoundMarks(engine.getState());
    const s = engine.getState();
    const box = $(BENCH_UNIT_IDS[Math.max(0, s.activeWorkSlot)]);
    const dots = box ? box.querySelector(".print-dots") : null;
    if (dots) {
      replayFx(dots, "shake-x", 460);
      Array.prototype.forEach.call(dots.querySelectorAll("span.x"), function (span) { replayFx(span, "pop", 540); });
    }
    replayFx($("workbench"), "ink-warn-shake", 500);
    replayFx($("inkCartridge"), "fx-blink", 540);
    inkHitchUntil = performance.now() + INK_HITCH_MS;
  }

  // 최고 기록이 오른 순간 — 둘레 세 번 깜빡 + 확률표 그 줄 한 번 반응 (각 0.3초 × 3, 클로드판).
  function gradeImprovedFx(gradeKey) {
    const s = engine.getState();
    const box = $(BENCH_UNIT_IDS[s.activeWorkSlot] || BENCH_UNIT_IDS[0]);
    const color = GRADE_COLORS[gradeKey] || "#d8b978";
    if (box) {
      box.style.setProperty("--blink-color", color);
      box.style.setProperty("--held-color", color);
      box.classList.remove("grade-blink");
      void box.offsetWidth;
      box.classList.add("grade-blink");
      setTimeout(function () { box.classList.remove("grade-blink"); }, 950);
    }
    textCache.__prob = null;
    renderProbTable(s);
    const row = $("probRows").querySelector('.prob-row[data-grade="' + gradeKey + '"]');
    if (row) {
      row.classList.remove("pulse");
      void row.offsetWidth;
      row.classList.add("pulse");
      setTimeout(function () { row.classList.remove("pulse"); }, 950);
    }
  }

  // ── 작업대 한 대 그리기 ─────────────────────────────────────
  // unit이 없으면 아직 사지 않은 자리라 그 대를 통째로 내린다. unit이 있으면 그 대는
  // 언제나 서 있고, 위에 올라간 것이 있는지만 그림면과 「빈 작업대」 문구를 가른다.
  function benchEmptyText(s) {
    if (s.workbench.slots > 1) return "빈 작업대";
    // 2026-10-20 v9(시안 2판): 한 장 제작 — 원작 카드를 누르면 바로 그린다
    return s.unlocked.paper
      ? "작업대가 비었습니다.\n왼쪽 원작 카드를 누르면 바로 그립니다."
      : "작업대가 비었습니다.\n왼쪽 「유리창 알바」를 눌러 보세요.";
  }
  // 자리(col·row)는 State.benchLayout(count)이 정한 그대로 옮긴다.
  // 크기는 CSS 공통 변수 하나가 정하므로 여기서 다시 계산하지 않는다.
  function renderBenchUnit(box, canvasId, labelId, unit, cell, s) {
    const show = !!unit;
    if (box.hidden !== !show) box.hidden = !show;
    if (!show) return;
    const col = String((cell ? cell.col : 0) + 1);
    const row = String((cell ? cell.row : 0) + 1);
    if (box.style.gridColumn !== col) box.style.gridColumn = col;
    if (box.style.gridRow !== row) box.style.gridRow = row;
    if (box.dataset.filled !== String(unit.filled)) box.dataset.filled = String(unit.filled);
    $(canvasId).hidden = !unit.filled;
    $(labelId).hidden = unit.filled;
    if (!unit.filled) putText(labelId, benchEmptyText(s));
  }

  // ── 작업대 위 포인터 — 확률표를 띄우는 유일한 조건 ───────────
  // 「돈이 100원을 넘겼다」 같은 상태가 아니라 실제 포인터 위치만 본다.
  // 포인터가 작업대(제작 중인 도화지)를 벗어나면 곧바로 false가 된다.
  // 표가 뜨는 자리는 styles.css의 #probPanel(그림 오른쪽 세로표 · left 812 / top 250, B-1)이 정한다 —
  // 화면 쪽에서 좌표를 다시 쓰지 않으므로 포인터를 움직여도 표는 제자리에 있다 (라운드 001).
  let benchHover = false;
  // 유리창 확률표용 호버 — 모작 확률표와 같은 방식이되, 도화지가 아니라
  // 닦고 있는 유리창 위에 포인터가 있을 때 켜진다 (유리창은 언제나 첫 칸을 쓴다).
  let windowHover = false;

  // ── 왼쪽 경제 카드는 없다 (2026-08-27 2차 피드백 ㉱) ─────────────────
  // 부모 판에는 여기 renderEconomyCard가 있어 현금 / 대출 / 유리창 선투자 /
  // 파손 총손실을 왼쪽 카드에 되풀이했다. 그 카드(#economyCard)와 전용 CSS,
  // 그리고 그 안에만 있던 상시 계약서 버튼까지 통째로 뺐다.
  // 현금은 상단 보유 금액이, 대출은 낙하 계약서 · 우상단 계약 카드 · 상환 UI가
  // 그대로 말한다 — 경제 규칙과 숫자는 한 칸도 바뀌지 않았다.

  // ── 스크래치식 대출 계약서 (2026-08-26 v1 · 이 자식 판) ──────────────
  // 서명 전에는 대출금만 크게 말한다. 이자율과 총상환액은 서명 「직후」에
  // 반전으로 열린다. 분할 상환은 없고 언제나 200원을 한 번에 갚는다. 다만 갚을 수
  // 있는 현금 조건은 두 가지다 (2026-08-26 동현 확정 · 상환 교착 방지) — 팔거나
  // 진행해 회복할 작품이 있으면 현금 200원부터, 하나도 없으면 갚고도 유리창 선투자
  // 20원이 남는 220원부터다. 그 조건 판정과 요구 금액은 전부 엔진이 준다
  // (L.canRepay · L.repayNeeded). 화면이 숫자나 조건을 따로 갖지 않는다.
  // 숫자와 성립 여부는 전부 엔진(s.loan)에서 오고 화면이 따로 갖지 않는다.
  let loanOpen = false;
  let loanNote = ""; // 방금 누른 결과 한 줄. 비어 있으면 지금 상태를 대신 말한다.
  let loanNoteTone = ""; // "" 보통 · "done" 성공 · "warn" 거절
  // 대출 계약은 상점·작업 카드의 달러 표기 변경 범위 밖이다.
  // 2026-10-20 v9 · 10-A: 대출 화면도 다른 화면처럼 「$」(옛 이름 won은 부르는 곳이 많아 그대로 둔다).
  function won(n) { return (Number(n) || 0).toLocaleString("ko-KR") + "$"; }
  function sayLoan(text, tone) {
    loanNote = text;
    loanNoteTone = tone || "";
    render(engine.getState());
  }
  function openLoanContract(open) {
    loanOpen = !!open;
    if (!loanOpen) { loanNote = ""; loanNoteTone = ""; } // 닫으면 안내문도 지운다
    render(engine.getState());
  }

  // ── 0827 승인 · 대출 A 「스크래치 충실형」의 연출 세 단계 ─────────────────
  // ① 수락(안내 확인) 직후 — 상단에서 계약서가 내려온다. 자동으로 열리지 않는다.
  //    플레이어가 그 종이를 직접 눌러야 중앙 계약서가 열린다(관찰한 원본 그대로).
  function dropLoanContract() {
    const s = engine.getState();
    if (!(s.loan.accepted && !s.loan.signed)) return false;
    loanOpen = false; // 중앙 종이는 아직 열지 않는다 — 상단 종이를 눌러야 열린다
    render(engine.getState());
    return true;
  }
  // ② 서명 직후 — 중앙 종이가 접혀 우상단 계약 자리로 날아간다.
  //    이동이 끝나면 우상단 카드가 정착하고, 엔진이 건 재전화가 그 자리를 가리킨다.
  //    A안이라 경로선도 스포트라이트도 그리지 않는다 — 조각 하나가 조용히 옮겨갈 뿐.
  let loanFlyTimer = null;
  function flyLoanToSlot() {
    const flyer = $("loanFlyer");
    const dialog = $("loanContractDialog");
    const slot = $("loanSlot");
    const host = document.querySelector('[data-anchor="center-workspace"]');
    if (!host) return false;
    // 출발 자리는 「아직 열려 있는 중앙 종이」다 — 닫고 나서 재면 크기가 0이 되므로
    // 반드시 닫기 전에 잰다. 도착 자리(우상단 카드)는 좌표가 CSS에 못박혀 있어
    // 열려 있든 아니든 같은 사각형이다.
    const hostBox = host.getBoundingClientRect();
    const fromBox = dialog.getBoundingClientRect();
    const toBox = slot.getBoundingClientRect();
    loanOpen = false; // 중앙 종이는 접혀 사라지고, 그 자리에 우상단 카드가 선다
    render(engine.getState());
    if (!hostBox.width || !toBox.width || !fromBox.width) return false;
    // 무대는 등비 축소돼 있을 수 있다 — 화면 좌표를 무대 논리 좌표로 되돌린다.
    const scale = (hostBox.width / host.offsetWidth) || 1;
    const place = function (box) {
      flyer.style.left = ((box.left - hostBox.left) / scale) + "px";
      flyer.style.top = ((box.top - hostBox.top) / scale) + "px";
      flyer.style.width = (box.width / scale) + "px";
      flyer.style.height = (box.height / scale) + "px";
    };
    place(fromBox);
    flyer.style.transform = "rotate(0deg)";
    flyer.dataset.open = "true";
    flyer.getBoundingClientRect(); // 시작값을 확정시킨다
    requestAnimationFrame(function () {
      place(toBox);
      flyer.style.transform = "rotate(-8deg)";
      flyer.dataset.open = "false";
    });
    clearTimeout(loanFlyTimer);
    loanFlyTimer = setTimeout(function () {
      flyer.dataset.open = "false";
      flyer.style.transform = "rotate(0deg)";
    }, 700);
    return true;
  }
  // ③ 우상단 카드 → 계약 상세. 승인 계약대로 상환금액·디버프 정보·상환버튼만 담는다.
  function openLoanDetail() {
    ensureAudio();
    openLoanContract(true);
  }
  let lastRevealKey = "__none__";
  function renderLoanContract(s) {
    const L = s.loan;
    // 상단 지갑 옆 한 줄 — 대출이 있을 때만 말한다. 좁은 자리라 고른 불이익은
    // 짧은 표시(L.penaltyShort · 예: 「판매가 10% ↓」)로 붙인다. 옛 「(수입 50%)」는
    // 2026-08-26 동현 승인으로 폐기됐다.
    putText("loanNote2", L.penaltyActive
      ? " · 대출 " + won(L.balance) + (L.penaltyShort ? " (" + L.penaltyShort + ")" : "")
      : L.cleared ? " · 대출 완납" : "");

    // 계약서 화면 — 열려 있을 때만 존재한다.
    const overlay = $("loanContractOverlay");
    if (overlay.hidden !== !loanOpen) overlay.hidden = !loanOpen;
    // ── 0827 승인 · 대출 A의 세 자리 ──────────────────────────────────
    // 상단 낙하 계약서는 「수락했지만 아직 서명하지 않은」 동안에만 떠 있고,
    // 우상단 계약 카드는 「서명해서 갚을 것이 남은」 동안에만 떠 있다.
    // 상세가 열려 있는 동안에는 카드를 감춰 겹침을 원천 차단한다.
    const drop = $("loanDrop");
    const dropOpen = String(!!(L.accepted && !L.signed && !loanOpen));
    if (drop.dataset.open !== dropOpen) {
      drop.dataset.open = dropOpen;
      drop.setAttribute("aria-hidden", dropOpen === "true" ? "false" : "true");
      drop.tabIndex = dropOpen === "true" ? 0 : -1;
    }
    const slot = $("loanSlot");
    const slotOpen = String(!!(L.signed && L.balance > 0));
    if (slot.dataset.open !== slotOpen) {
      slot.dataset.open = slotOpen;
      slot.setAttribute("aria-hidden", slotOpen === "true" ? "false" : "true");
      slot.tabIndex = slotOpen === "true" ? 0 : -1;
    }
    const slotHidden = String(loanOpen);
    if (slot.dataset.hidden !== slotHidden) slot.dataset.hidden = slotHidden;
    // 재전화가 걸려 오는 동안 그 자리가 조용히 맥동한다 (A안 — 화살표도 덮개도 없다).
    const highlight = String(s.phone.ringing === "loanSigned"
      || (s.phone.open && s.phone.script === "loanSigned"));
    if (slot.dataset.highlight !== highlight) slot.dataset.highlight = highlight;
    putText("loanSlotRepay", won(L.totalDue));
    putText("loanSlotDebuff", L.penaltyShort || "");
    slot.setAttribute("aria-label", "대출 계약 — 상환 " + won(L.totalDue)
      + (L.penaltyLine ? " · " + L.penaltyLine : "") + " · 눌러 상세 보기");

    if (!loanOpen) return;
    // 서명 전(sign)과 체결 뒤(detail) — 계약서는 두 모습 중 하나만 보인다.
    const dialog = $("loanContractDialog");
    const mode = L.signed ? "detail" : "sign";
    if (dialog.dataset.mode !== mode) dialog.dataset.mode = mode;
    putText("loanPrincipal", won(L.principal));
    putText("loanTotalNote", "서명하면 바로 지급됩니다 · 상환 조건은 서명 뒤 공개");
    // 0827 승인 — 체결 뒤 대출 UI에 남는 것은 상환금액 · 디버프 정보 · 상환버튼뿐이다.
    putText("loanDetailNo", "LOAN #" + ("00" + Math.max(1, L.repaidCount + 1)).slice(-3));
    putText("loanDetailRepayAmount", won(L.totalDue));
    putText("loanDetailPenalty", L.penaltyLine || "");
    // 반전 — 서명한 뒤에만 열린다. 문구는 엔진이 준 줄을 그대로 쓴다.
    const reveal = $("loanReveal");
    const openReveal = String(!!L.revealed);
    if (reveal.dataset.open !== openReveal) reveal.dataset.open = openReveal;
    const revealKey = (L.revealLines || []).join("|");
    if (lastRevealKey !== revealKey) {
      lastRevealKey = revealKey;
      const list = $("loanRevealLines");
      list.innerHTML = "";
      (L.revealLines || []).forEach(function (line) {
        const li = document.createElement("li");
        li.textContent = line;
        list.appendChild(li);
      });
    }
    // 안내문 — 방금 누른 결과가 있으면 그것을 말하되, 현금이 실제 상환 구간에
    // 들어오면 지금 상태를 우선한다. 그렇지 않으면 서명 직후 문구가 영구히 남아
    // 200~219원의 선투자 잠금 이유를 가린다.
    const repaymentStateReached = L.signed && L.balance > 0 && s.money >= L.totalDue;
    const note = (!repaymentStateReached && loanNote) || (!L.signed
      ? "서명하기를 누르면 바로 체결됩니다"
      : L.cleared
        ? "대출을 모두 갚았습니다 — 이제 번 돈이 온전히 들어옵니다"
        // 2026-08-26 동현 확정 — 상환 교착 방지가 걸린 자리는 그 이유부터 말한다.
        // 새 줄을 만들지 않고 기존 안내문 자리를 쓴다 (대화상자 높이가 튀지 않는다).
        : L.reserveBlocked
          ? "유리창 선투자 " + won(s.deadlockGuard.reserve) + "을 남겨야 합니다 · 현금 "
            + won(L.repayNeeded) + "부터 갚을 수 있어요"
          : "분할 상환은 없습니다 · " + won(L.totalDue) + "을 한 번에 갚습니다 · 현금 "
            + won(s.money));
    putText("loanNote", note);
    const tone = (!repaymentStateReached && loanNote) ? loanNoteTone
      : (L.cleared ? "done" : L.reserveBlocked ? "warn" : "");
    const noteBox = $("loanNote");
    if (noteBox.dataset.tone !== tone) noteBox.dataset.tone = tone;
    $("loanSignBtn").disabled = !L.canSign;

    // 전액 상환 버튼 — 잠긴 이유를 눈(색 표시)과 접근성 이름 둘 다로 말한다.
    // 짧은 이유 문구(L.repayNotice)는 규칙 파일 한 곳에서만 나온다.
    const repayBtn = $("loanRepayBtn");
    repayBtn.disabled = !L.canRepay;
    // 2026-08-26 독립 검토 대응: 버튼 금액은 지금 잔액이 아니라 계약의 총상환액에서
    // 나온다. 분할이 없으므로 갚는 금액은 언제나 200원 하나뿐이고, 잔액이 조작된
    // 판에서도 화면이 「100원만 갚으면 된다」고 말하지 않는다.
    const repayLabel = won(L.totalDue) + " 전액 상환";
    putText("loanRepayBtn", repayLabel);
    const repayGuard = String(!!L.reserveBlocked);
    if (repayBtn.dataset.guard !== repayGuard) repayBtn.dataset.guard = repayGuard;
    const repayAria = L.reserveBlocked
      ? repayLabel + " — 지금은 잠김: " + L.repayNotice + " · 현금 " + won(L.repayNeeded)
        + "부터 갚을 수 있습니다"
      : repayLabel;
    if (repayBtn.getAttribute("aria-label") !== repayAria) {
      repayBtn.setAttribute("aria-label", repayAria);
      repayBtn.title = repayAria;
    }
  }

  // ── 유리창 알바 카드 문구 (2026-08-19 확정) ────────────────────────
  // 카드에도 접근성 이름에도 보수 숫자를 고정해 두지 않는다. 지금 유리창 레벨의
  // 확정 결과표만 읽어 만든다.
  //
  // 2026-08-19 동현 확정: 대성공(잭팟)은 카드에서도 숨긴다. 확률표에서만 감추고
  // 카드에는 「대성공 66원」이 그대로 보이면 두 화면이 서로 다른 말을 하게 되고,
  // 플레이어가 터뜨리기 전에 잭팟의 존재를 알아 버린다. 그래서 카드도 확률표와
  // 같은 권위(State.windowPublicTable)를 쓴다 — 대성공은 성공 쪽에 합쳐져 사라진다.
  function windowTableFor(level) {
    const tables = State.WINDOW_RULES.tables;
    return tables[Math.max(0, Math.min(tables.length - 1, level || 0))];
  }
  // 2026-08-26: 이제 한 장에는 선투자가 붙는다. 카드는 「얼마 내고 얼마 받는가」를
  // 한 줄로 말한다 — 대성공은 여전히 숨은 확률이라 여기 나오지 않는다.
  function windowPayText(level) {
    const rows = State.windowPublicTable(level);
    const win = rows.find(function (r) { return r.pay > 0; });
    const none = rows.find(function (r) { return r.pay <= 0; });
    const upfront = State.WINDOW_RULES.upfrontCost;
    if (!win) return "선투자 " + upfront + "$ · 보수 0$";
    const head = "선투자 " + upfront + "$ → 한 장 " + win.pay + "$";
    if (!none) return head + " (순이익 " + (win.pay - upfront) + "$)";
    // 보수가 나오지 않는 갈래가 있으면 그것만 함께 알린다.
    return head + " · 파손이면 총손실 " + (none.cost || 0) + "$";
  }
  // 2026-08-27 2차 피드백 ㉯ — 유리창 알바 카드의 「현재 돈 금액」은 레벨별 보수
  // (40 / 53)가 아니라 매 작업을 시작할 때 실제로 내는 현재 구매값, 곧 선투자
  // s.windowCosts.upfront다. 도화지 카드가 「지금 사는 값」을 말하는 것과 같은 문법이라
  // 두 작업 카드가 같은 뜻의 숫자를 갖게 된다. 옛 windowRewardNow는 함께 지웠다 —
  // 보수 숫자는 확률표와 접근성 이름(windowPayText)에 그대로 남는다.
  // 이 변경은 표기가 읽는 자리만 옮긴다. 경제 수치·보수·해금은 한 칸도 바뀌지 않았다.
  // 접근성 이름은 계약 5절 그대로 결과표 문장을 계속 담는다 — 선투자·파손 총손실처럼
  // 카드 본문에서 뺀 사실이 소리로는 사라지지 않게 한다.
  let jobAriaCache = "";
  function renderJobCard(s) {
    const g = s.windowGauge;
    paintWorkCard(jobCardEls, State.workCardText({
      name: "유리창 알바",
      money: s.windowCosts.upfront,
      level: g.level,
      maxLevel: Math.max(1, g.level + (g.maxed ? 0 : 1)),
    }));
    const btn = $("jobBtn");
    const maxed = String(g.maxed);
    if (btn.dataset.windowMaxed !== maxed) btn.dataset.windowMaxed = maxed;
    // 게이지 안쪽 막대는 「다음 레벨까지 얼마나 왔는가」를 그대로 쓴다.
    if (jobCardEls.fill) jobCardEls.fill.style.setProperty("--wc-gauge-ratio", g.percent + "%");
    const aria = "유리창 알바 — " + windowPayText(s.windowLevel)
      + ", 레벨 " + g.level + (g.maxed ? " (최고 레벨)" : ", " + g.done + " / " + g.need + "장")
      + ", 때 " + (s.window ? s.window.pass + "겹 제거 / " + s.window.layers + "겹"
        : s.debug.values.windowLayers + "겹");
    if (jobAriaCache === aria) return;
    jobAriaCache = aria;
    $("jobBtn").setAttribute("aria-label", aria);
  }

  // ── 유리창 보수 확률표 (2026-08-19 · 0817 피드백 3번) ─────────
  // 모작 등급 확률표와 같은 방식이다: 엔진이 「띄울 수 있는 상태」를 말하고,
  // 여기서 「지금 포인터가 실제로 유리창 위에 있는가」를 한 번 더 얹는다.
  // 잭팟은 엔진이 이미 성공 쪽에 합쳐 보냈으므로 여기서는 그대로 그린다.
  let windowProbCache = "";
  function renderWindowProbTable(s) {
    const panel = $("windowProbPanel");
    const show = s.windowProbTable.visible && windowHover;
    if (panel.hidden !== !show) panel.hidden = !show;
    if (!show) return;
    const t = s.windowProbTable;
    const key = t.level + "|" + t.rows.map(function (r) {
      return r.percent + "@" + r.pay + "/" + (r.cost || 0);
    }).join("|");
    if (windowProbCache !== key) {
      windowProbCache = key;
      // 2026-10-06 두 방 데모 B-1 (형님 2-A): 모작 확률표가 그림 오른쪽 세로표로 옮겨 가면서
      // 유리창 표도 8/19 「같은 자리 · 같은 등장 방식」 그대로 따라간다 — 마크업·자리·형식을
      // 모작 세로표와 통일한다(줄마다 결과 / 확률 / 보수, 성공·파손 고유 색).
      const body = $("windowProbRows");
      body.innerHTML = "";
      t.rows.forEach(function (r) {
        const row = document.createElement("tr");
        row.className = "prob-row";
        row.dataset.grade = r.key;
        const name = document.createElement("td");
        name.textContent = r.label;
        const prob = document.createElement("td");
        prob.className = "num";
        prob.textContent = r.percent;
        const pay = document.createElement("td");
        pay.className = "num";
        pay.textContent = r.pay > 0 ? r.pay.toLocaleString("ko-KR") + "$"
          : r.cost > 0 ? "-" + r.cost.toLocaleString("ko-KR") + "$" : "0$";
        row.appendChild(name);
        row.appendChild(prob);
        row.appendChild(pay);
        body.appendChild(row);
      });
      putText("windowProbLevel", "레벨 " + t.level);
    }
  }

  // ── D키 디버그 창 (2026-08-19 · 0817 피드백 4번) ──────────────
  // 지금 골라져 있는 값에만 표시를 켠다. 게임은 멈추지 않는다.
  function renderDebugPanel(s) {
    const panel = $("debugPanel");
    if (panel.hidden !== !s.debug.open) panel.hidden = !s.debug.open;
    if (!s.debug.open) return;
    debugPicks.forEach(function (btn) {
      const now = Number(s.debug.values[btn.dataset.debugKey]);
      const mine = Number(btn.dataset.debugValue);
      const on = String(Math.abs(now - mine) < 1e-9);
      if (btn.dataset.on !== on) btn.dataset.on = on;
      // 2026-08-25 계약 2: 선택 상태를 눈(데이터 속성 → CSS)뿐 아니라 접근성 정보로도
      // 함께 낸다. 밑그림 A/B가 요구한 값이지만 손잡이 전체에 같은 문법으로 붙인다.
      if (btn.getAttribute("aria-pressed") !== on) btn.setAttribute("aria-pressed", on);
    });
    // 번호(0~4) 대신 사람이 읽는 등급 이름으로 알려 준다.
    const GRADE_LABELS = ["브론즈", "실버", "골드", "플래티넘", "다이아몬드"];
    // 라운드 005 문제 E (형 확정: 일반 화면은 시안대로 깨끗하게, 시험값 표시는 디버그 창에만).
    // 2026-08-25 계약: 일반 화면은 시험값 표기로 어지럽히지 않고, 여기 푸터와 빌드 라벨이
    // 「회의용 시험안」임을 명시한다.
    // 2026-08-26: 「도화지까지 몇 장」은 총보수가 아니라 순이익(총보수 − 선투자)으로 센다.
    // 시작 현금 20원이 이미 첫 장의 선투자로 나가므로 도화지값 100원까지 남은 것은 100원이다.
    const upfront = s.windowCosts ? s.windowCosts.upfront : 0;
    const netPay = Math.max(1, s.debug.values.windowPay - upfront);
    putText("debugFoot", "[주의] 아래 수치는 이 판의 확정 규칙 (2026-08-26 · 0825 피드백 · 대출 재설계). 지금: "
      + s.debug.values.windowLayers + "겹 · 밀대 "
      + s.debug.values.windowScrollSpeed + "배 · 레벨 0 총보수 "
      + s.debug.values.windowPay + "$ (선투자 " + upfront + "$ → 순이익 " + netPay
      + "$ · 도화지 " + s.workbench.paperCost + "$까지 " + Math.ceil(s.workbench.paperCost / netPay) + "장). "
      // 2026-08-19: 레벨 1 보수 손잡이가 생겨 「여기서 바뀌지 않는다」는 말이
      // 더는 맞지 않는다. 지금 무엇이 눌려 있는지를 그대로 알려 준다.
      + "레벨 1 보수: " + (s.debug.values.windowPayLv1 > 0
        ? s.debug.values.windowPayLv1 + "$ (직접 지정)"
        : "확정 결과표 그대로")
      + " · 등급: " + (s.debug.values.forceGrade >= 0
        ? (GRADE_LABELS[s.debug.values.forceGrade] || "?") + "로 고정"
        : "무작위")
      + " · 물감량: " + (s.debug.values.firstInkPercent > 0
        ? s.debug.values.firstInkPercent + "% (직접 지정)"
        : "규칙값 그대로")
      + " · 시간 " + s.debug.values.timeScale + "배."
      // 2026-08-25 회의 전 추천안 — 이번 판에서 새로 붙은 손잡이와 예약 상태.
      + " 밑그림: " + (s.debug.values.underdrawing ? "옅은 원색" : "단색 윤곽")
      + " · 다음 유리창 파손 예약: " + (s.debug.breakNextWindow ? "켬" : "끔")
      + " (파손 총손실 " + (s.windowCosts ? s.windowCosts.breakTotalLoss : 0) + "$ · "
      + "자동 신용 없음 — 못 내면 빚이 아니라 차단).");
  }

  function render(s) {
    putText("moneyView", s.money.toLocaleString("ko-KR") + "$");
    // 2026-08-26 v1 — 상단 HUD는 현금과 대출을 한 줄로 요약만 한다.
    // 2026-08-27 2차 피드백 ㉱ 이후로 이 요약이 화면에 남은 유일한 현금 표시다.
    const moneyBox = document.querySelector("#reviewBar .money");
    if (moneyBox) moneyBox.dataset.loan = String(s.loan.penaltyActive);
    // 2026-08-26 v1 — 스크래치식 대출 계약서.
    renderLoanContract(s);
    putText("scopeNote", s.scopeComplete ? "이번 플레이 범위 완료 · 계속 플레이 가능" : "");
    // 검수 전용 돈 — 한 번이라도 쓰면 표시가 계속 남는다 (초기화하면 사라진다).
    putText("reviewMoneyNote", s.reviewMoney.used ? "검수용 돈 사용 중" : "");
    renderReviewTools(s, s.started && !s.paused && !s.inputLocked);
    document.body.dataset.paused = String(s.paused);
    document.body.dataset.inputLocked = String(s.inputLocked);
    const canAct = s.started && !s.paused && !s.inputLocked;

    // 왼쪽 구매줄 — 작업 탭
    $("jobBtn").disabled = !canAct || s.hasPaper;
    renderJobCard(s);
    // 2026-10-20 v9 — 왼쪽 원작 카탈로그(한 장 제작) · 오른쪽 세 칸. v8의 「도화지 구매」 카드와
    // 「작업대 · 한 대」 칸은 뺐다(작업대 늘리기는 9/9에 제외 — 그 칸은 하는 일이 없었다).
    renderCatalog(s, canAct);
    renderRail(s, canAct);
    tabBtn.shop.dataset.unlocked = String(s.unlocked.shop);
    if (!s.unlocked.shop && activePane === "shop") setPane("workshop");
    renderShop(s, canAct);
    renderWorkbenchOffer(s, canAct);
    // 상점 탭 금빛 NEW — 엔진이 켠 새 상품 알림을 그대로 읽는다. 상점을 열면 꺼진다.
    if (s.shop.tabNew && activePane !== "shop") tabBtn.shop.dataset.new = "true";
    putText("workshopHint", workshopHintText(s));

    // 오른쪽 세로줄 — 구간 목표 금액 (2026-10-08 3단계 · 경험치·레벨 대신)
    // 글자·비율은 전부 규칙 파일(State.segmentView)이 정한 값을 그대로 쓴다.
    const seg = s.segment;
    putText("goalStep", seg.stepText);
    $("goalFill").style.width = (Math.min(1, seg.ratio) * 100).toFixed(1) + "%";
    putText("goalText", seg.amountText);
    putText("goalReward", goalFlashText || seg.rewardText); // 달성 알림 2.4초 동안은 그 글자
    const goalPanel = $("goalPanel");
    if (goalPanel.dataset.done !== String(seg.done)) goalPanel.dataset.done = String(seg.done);
    // 2026-10-20 v9(시안 2판): 경매장 문 위 칸 = 다음 새 원작 예고 — 실루엣 · 예상가 · 한 장 참가비.
    // 처음부터 보인다(v8은 구간 2 전까지 숨김). 사는 것은 구간 2(경매장 문)부터, 그 원작의 구간 전엔 「구간 n」 표만.
    // 돈이 예상가에 닿으면 느낌표 + 금빛 테두리가 켜지고, 그때만 눌러서 원작을 얻는다(임시 방식).
    const door = $("auctionDoorBtn");
    const doorOpen = String(!!s.auctionDoor.open);
    if (door.dataset.open !== "true") door.dataset.open = "true";
    const auction = s.auction || { newLot: null, levelLot: null };
    const money = function (v) { return Number(v).toLocaleString("ko-KR") + "$"; };
    const lot = auction.newLot; // 새 원작(예고 중이면 locked)
    const lotInfo = lot ? (s.originals || []).find(function (o) { return o.key === lot.key; }) : null;
    const lotGate = lot ? (lot.locked ? lot.unlockSegment : (!s.auctionDoor.open ? 2 : 0)) : 0; // 아직 못 사는 구간
    const ready = !!(s.auctionDoor.open && lot && !lot.locked && lot.affordable && canAct);
    door.disabled = !ready;
    if (door.dataset.ready !== String(ready)) door.dataset.ready = String(ready);
    $("lotBang").hidden = !ready;
    $("lotLock").hidden = !lotGate;
    if (lotGate) putText("lotLock", "구간 " + lotGate);
    const lotKey = lot ? lot.lotKey : "none";
    if (lastLotKey !== lotKey) {
      lastLotKey = lotKey;
      const lotCtx = $("lotSilhouette").getContext("2d");
      lotCtx.imageSmoothingEnabled = false;
      lotCtx.clearRect(0, 0, 48, 48);
      // 새 원작은 얻기 전까지 실루엣으로 숨긴다(모양만 보인다)
      if (lot) Art.drawOriginalSilhouette($("lotSilhouette"), lot.key, 3);
    }
    putText("lotName", "경매장");
    putText("lotInfo", !lot ? "모두 모았어요"
      : lot.reserveBlocked ? State.deadlockGuardShort() // 돈은 닿았지만 유리창 선투자 몫을 남겨야 할 때 — 상점 카드와 같은 표시
        : "예상가 " + money(lot.price));
    const feeText = lot && lotInfo ? "한 장 참가비 " + money(lotInfo.fee) : "";
    if (textCache.__lotFee !== feeText) {
      textCache.__lotFee = feeText;
      $("lotFee").innerHTML = "";
      if (lot && lotInfo) {
        $("lotFee").appendChild(document.createTextNode("한 장 참가비 "));
        const b = document.createElement("b");
        b.textContent = money(lotInfo.fee);
        $("lotFee").appendChild(b);
      }
    }
    const doorLabel = !lot ? "경매장 — 원작을 모두 모았습니다"
      : "경매장 다음 원작 예고 — 예상가 " + money(lot.price) + (lotInfo ? ", 한 장 참가비 " + money(lotInfo.fee) : "")
        + (lotGate ? ", 구간 " + lotGate + " 달성 뒤 살 수 있습니다"
          : ready ? " — 눌러서 얻기"
            : lot.reserveBlocked ? " — " + State.deadlockGuardShort()
              : " — 돈이 모자랍니다");
    // 아래 칸 — 주력 레벨업
    const lvBtn = $("auctionLevelBtn");
    if (lvBtn.dataset.open !== doorOpen) {
      lvBtn.dataset.open = doorOpen;
      lvBtn.setAttribute("aria-hidden", String(!s.auctionDoor.open));
      lvBtn.tabIndex = s.auctionDoor.open ? 0 : -1;
    }
    const lv = auction.levelLot;
    const lvReady = !!(s.auctionDoor.open && lv && lv.affordable && canAct);
    lvBtn.disabled = !lvReady;
    if (lvBtn.dataset.ready !== String(lvReady)) lvBtn.dataset.ready = String(lvReady);
    $("levelLotBang").hidden = !lvReady;
    const lvKey = lv ? lv.lotKey : "none";
    if (lastLevelLotKey !== lvKey) {
      lastLevelLotKey = lvKey;
      const lvCtx = $("levelLotArt").getContext("2d");
      lvCtx.imageSmoothingEnabled = false;
      lvCtx.clearRect(0, 0, 48, 48);
      if (lv) Art.drawOriginal($("levelLotArt"), lv.key, 3); // 가진 원작이라 그림을 그대로 보여 준다
    }
    const lvArt = lv ? Art.originalByKey(lv.key) : null;
    putText("levelLotName", lvArt ? lvArt.label : "레벨업");
    putText("levelLotInfo", !s.auctionDoor.open ? "준비 중"
      : !lv ? "최고 레벨"
        : lv.reserveBlocked ? State.deadlockGuardShort()
          : "Lv " + lv.fromLevel + "→" + lv.toLevel + " · " + money(lv.price));
    const lvLabel = !s.auctionDoor.open ? "경매장 레벨업 칸 — 준비 중"
      : !lv ? "경매장 레벨업 — 주력 원작이 최고 레벨입니다"
        : "경매장 레벨업 — " + (lvArt ? lvArt.label : lv.key) + " 레벨 " + lv.fromLevel + "에서 " + lv.toLevel
          + "로, 값 " + money(lv.price)
          + (lvReady ? " — 눌러서 올리기" : lv.reserveBlocked ? " — " + State.deadlockGuardShort() : " — 돈이 모자랍니다");
    if (lvBtn.getAttribute("aria-label") !== lvLabel) lvBtn.setAttribute("aria-label", lvLabel);
    if (door.getAttribute("aria-label") !== doorLabel) door.setAttribute("aria-label", doorLabel);
    // 「1막 끝」 화면 — 엔진이 띄우고 닫는다(떠 있는 동안 시계·입력 정지).
    const act1 = $("act1Overlay");
    if (act1.hidden !== !s.act1End.open) {
      act1.hidden = !s.act1End.open;
      act1.dataset.open = String(!!s.act1End.open);
      if (s.act1End.open) $("act1ContinueBtn").focus();
    }

    // 작업대 위 잉크 표시와 왼쪽 문 옆 카트리지
    renderInk(s);
    renderInkCartridge(s);

    // 전화 — 울릴 때만 클릭 가능, 상시 설명문 없음
    const phoneBtn = $("phoneBtn");
    phoneBtn.disabled = !canAct || !s.phone.ringing;
    phoneBtn.classList.toggle("ringing", !!s.phone.ringing && s.started);
    phoneBtn.setAttribute("aria-label", s.phone.ringing ? "울리는 전화 받기" : "빨간 회전식 전화기");

    // 원작 슬롯 — 카탈로그 편입 뒤에만 보인다 (자리는 처음부터 예약)
    const sel = $("originalSelectorBtn");
    sel.dataset.locked = String(!s.unlocked.catalog);
    sel.disabled = !canAct || !s.unlocked.catalog;
    if (s.unlocked.catalog) {
      const cur = s.currentOriginal ? Art.originalByKey(s.currentOriginal) : null;
      // 2026-10-08 4단계: 지금 원작의 레벨을 함께 보인다(원작 레벨이 판매가를 올린다).
      const curInfo = cur ? (s.originals || []).find(function (o) { return o.key === cur.key; }) : null;
      putText("originalName", cur
        // 원작 이름과 「· Lv n」은 붙은 띄어쓰기(\u00a0)로 한 덩어리로 묶는다 — 좁은 슬롯에서 「진주 / 고양이」나
        // 「Lv / 1」처럼 갈라지지 않고, 줄이 바뀌면 「원작:」 뒤에서만 바뀐다.
        ? "원작: " + (cur.label + (curInfo ? " · Lv " + curInfo.level : "")).replace(/ /g, "\u00a0")
        : "원작을 고르세요");
      putText("originalSub", s.nextOriginal
        ? "다음 작품 예약: " + Art.originalByKey(s.nextOriginal).label
        : cur ? "누르면 카탈로그가 열립니다" : "눌러서 첫 그림을 고르세요");
      // 고른 원작 그림을 슬롯 안에 그대로 보여 준다 (16×16 × 4배 = 64×64)
      if (lastSlotOriginal !== s.currentOriginal) {
        lastSlotOriginal = s.currentOriginal;
        const slotCtx = $("originalIcon").getContext("2d");
        slotCtx.imageSmoothingEnabled = false;
        slotCtx.clearRect(0, 0, 64, 64);
        if (cur) Art.drawOriginal($("originalIcon"), s.currentOriginal, 4);
      }
    }

    // 카탈로그 물건
    if (s.catalog !== lastCatalogState) {
      const item = $("catalogItem");
      lastCatalogState = s.catalog;
      item.hidden = s.catalog === "none" || s.catalog === "docked";
      item.className = "";
      if (s.catalog === "falling") item.classList.add("falling");
      else if (s.catalog === "landed") item.classList.add("landed");
      else if (s.catalog === "unlocking") item.classList.add("unlocking");
      else if (s.catalog === "docking") item.classList.add("unlocking", "docking");
      if (s.catalog === "none") {
        item.style.removeProperty("left");
        item.style.removeProperty("top");
      }
    }

    // 작업대 — 유리창 / 인쇄(흰 도화지 포함) / 빈 작업대
    const benchMode = s.mode === "window" ? "window" : s.hasPaper ? "print" : "idle";
    workbench.dataset.bench = benchMode;
    // 칸 수 — 자리·크기는 styles.css의 칸수별 규칙이 정한다 (1개 480 · 2개 430 · 3·4개 380).
    if (workbench.dataset.slots !== String(s.workbench.slots)) {
      workbench.dataset.slots = String(s.workbench.slots);
    }
    // 중앙 작업칸에도 같은 칸수 표식을 실어 잉크통이 CSS만으로 작업대 왼쪽을 따라오게 한다.
    const centerZone = document.querySelector('[data-anchor="center-workspace"]');
    if (centerZone.dataset.slots !== String(s.workbench.slots)) {
      centerZone.dataset.slots = String(s.workbench.slots);
    }
    // 작업대 가구는 「구매한 칸 수」에만 묶인다 (2026-08-12 계약 11).
    // 60원을 낸 직후 빈 상태에서도, 도화지를 한 장만 올렸을 때도, 유리창 알바 중에도
    // 같은 규격 작업대가 그대로 서 있고 올라간 것이 없는 대만 빈 작업대로 보인다.
    const units = State.benchUnits(s);
    // 1 중앙 / 2 한 줄 중앙 / 3 오른쪽 아래 공석 / 4 2×2 — 배치는 순수 규칙이 정한다.
    // 2026-08-26: 유리창 알바는 언제나 큰 창 한 장이다. 작업대를 두 대 이상 사 둔
    // 판에서도 격자를 1×1로 두어 776px 틀 안에 그 한 장만 선다 (빈 대는 CSS가 접는다).
    // 「작업대를 샀다」는 사실은 State.benchUnits가 그대로 들고 있어 도화지를 놓으면
    // 두 대가 다시 선다 — 2026-08-12 계약 11은 그대로다.
    const layout = benchMode === "window"
      ? State.benchLayout(1)
      : State.benchLayout(Math.max(1, Math.min(4, s.workbench.slots)));
    // 격자 칸은 작품이 아니라 「작업대 한 대」 크기다 — 작품은 그 안에 90%로 선다.
    workbench.style.gridTemplateColumns =
      new Array(layout.cols).fill("var(--bench-size)").join(" ");
    workbench.style.gridTemplateRows =
      new Array(layout.rows).fill("var(--bench-size)").join(" ");
    renderBenchUnit($("benchUnitA"), "benchCanvas", "benchEmpty", units[0], layout.cells[0], s);
    renderBenchUnit($("benchUnitB"), "benchCanvasB", "benchEmptyB", units[1], layout.cells[1], s);
    renderBenchUnit($("benchUnitC"), "benchCanvasC", "benchEmptyC", units[2], layout.cells[2], s);
    renderBenchUnit($("benchUnitD"), "benchCanvasD", "benchEmptyD", units[3], layout.cells[3], s);
    // 유리창 조작 도움 팝업 — 첫 유리창 진입 때 1회 자동으로 열린다 (2026-08-20 형 확정).
    if (s.mode === "window" && s.window && !scrollHelpSeen) {
      scrollHelpSeen = true;
      scrollHelpOpen = true;
    }
    $("scrollHelpBox").hidden = !scrollHelpOpen;
    renderFinishChoice(s, canAct);
    renderResultBoard(s, canAct);
    renderGallery(s);

    // 확률표 — 「띄울 수 있는 상태(probTable.visible)」 위에 「지금 포인터가 실제로
    // 제작 중인 도화지 위에 있는가(benchHover)」를 한 번 더 얹는다.
    // 결과판이 열리거나 작업대가 비면 엔진 쪽에서 이미 false가 되고,
    // 포인터가 작업대를 벗어나면 여기서 꺼진다.
    renderWindowProbTable(s);
    renderDebugPanel(s);
    const probPanel = $("probPanel");
    const showProb = s.probTable.visible && benchHover;
    probPanel.hidden = !showProb;
    // 2026-10-06 두 방 데모 A·B-1: 표 줄은 숨어 있을 때도 만들어 둔다 — 최고 기록이 오르는 순간의
    // 줄 반응(펄스)과 확보 등급 강조가 표를 다시 띄웠을 때 그대로 보이게.
    renderProbTable(s);
    renderRoundMarks(s);

    // 오른쪽 공방 기록
    putText("recWindows", String(s.windowsDone));
    // 대성공 횟수는 화면에서 뺐다 (2026-08-19 · 숨은 확률). s.jackpots는 엔진에
    // 그대로 살아 있으므로 나중에 다시 붙일 때 이 줄만 되살리면 된다.
    putText("recArtworks", String(s.artworksSold));
    putText("recEvent", s.lastEvent);

    // 전화 오버레이
    const overlay = $("phoneOverlay");
    overlay.hidden = !s.phone.open;
    if (s.phone.open) {
      const pages = State.PHONE_SCRIPTS[s.phone.script].pages;
      putText("phoneLine", pages[s.phone.page]);
      putText("phonePageNo", (s.phone.page + 1) + " / " + pages.length);
      $("phonePrevBtn").disabled = s.phone.page === 0;
      const last = s.phone.page === pages.length - 1;
      // 0827 승인 · 대출 A: 위기 통화의 마지막 장에서는 「다음」 대신 확인 버튼 하나가
      // 선다. 고르는 화면이 아니라 안내를 확인하고 계약서로 넘어가는 문이다 —
      // 거절 버튼은 이 판에 존재하지 않고, 돈이 소진되면 대출은 반드시 진행된다.
      const confirming = !!s.loan.offerOpen;
      const next = $("phoneNextBtn");
      next.hidden = confirming;
      $("phoneAcceptBtn").hidden = !confirming;
      // 2026-08-27 2차 피드백 ㉰: 대출 통화에만 붙던 하단 안내 줄(#phoneOnlyNote)은
      // 지웠다. 그 줄 하나 때문에 대출 통화창만 다른 전화보다 높았다.
      if (next.textContent !== (last ? "통화 끝내기" : "다음")) {
        next.textContent = last ? "통화 끝내기" : "다음";
      }
      next.classList.toggle("primary", last);
    }
    // 계약서가 열려 있는 동안에도 뒤쪽 세 구역은 잠근다 — 계약서 위로 휠을 굴리다
    // 뒤의 작업대가 밀리는 일이 없어야 한다 (휠 제작 입력과 UI 조작의 분리).
    setBackgroundInert(s.phone.open || dexOpen || loanOpen);
  }

  // ── 원작 선택 카탈로그 오버레이 ──────────────────────────────
  function openDex() {
    const s = engine.getState();
    if (dexOpen || s.phone.open || s.inputLocked || !s.unlocked.catalog) return;
    dexOpen = true;
    $("dexOverlay").hidden = false;
    renderDex();
    $("dexCloseBtn").focus();
  }
  function closeDex() {
    if (!dexOpen) return;
    dexOpen = false;
    $("dexOverlay").hidden = true;
  }
  function renderDex() {
    const s = engine.getState();
    const during = !!(s.print && (s.print.stroke > 0 || s.print.phase !== "ready" || s.print.plateProg[0] > 0));
    const mode = $("dexMode");
    mode.dataset.selectionMode = during ? "next" : "current";
    mode.textContent = during
      ? "지금은 제작 중 — 여기서 고르면 현재 작품과 등급은 그대로 두고 다음 작품으로 예약합니다."
      : s.awaitingOriginal
        ? "흰 도화지가 놓였습니다 — 여기서 고른 그림이 바로 인쇄에 올라갑니다."
        // 별도 검수(10/13) M1: 도화지가 놓인 뒤 바꾸면 재료비 차액이 오간다는 것을 미리 말한다.
        : s.hasPaper
          ? "여기서 고르면 지금 작품에 바로 적용됩니다 — 재료비가 다르면 차액을 내거나 돌려받습니다."
          : "여기서 고르면 지금 작품에 바로 적용됩니다.";
    const list = $("dexList");
    list.innerHTML = "";
    // 2026-10-08 4단계(형님 14-A): 가진 원작만 고를 수 있다. 아직 없는 원작은 실루엣 + 자물쇠로
    // 「무엇을 더 모을 수 있는지」만 보이고 눌리지 않는다. 가진 원작은 「Lv n」을 크게 보인다.
    const ownedInfo = {};
    (s.originals || []).forEach(function (o) { ownedInfo[o.key] = o; });
    Art.ORIGINALS.forEach(function (item) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dex-item";
      const info = ownedInfo[item.key] || { owned: true, level: 1, tier: 1 };
      const isCurrent = item.key === s.currentOriginal;
      const isNext = item.key === s.nextOriginal;
      button.dataset.current = String(isCurrent);
      button.dataset.next = String(isNext);
      button.dataset.owned = String(!!info.owned);
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      canvas.setAttribute("aria-hidden", "true");
      const name = document.createElement("b");
      const level = document.createElement("span");
      level.className = "dex-level";
      if (!info.owned) {
        Art.drawOriginalSilhouette(canvas, item.key, 8);
        name.textContent = info.tier + "급 · 잠김"; // 자물쇠는 이모지 대신 글자로(2D 픽셀 UI — 이모지 금지 계약)
        level.textContent = " ";
        button.disabled = true;
        button.setAttribute("aria-label", "아직 없는 원작 — " + info.tier + "급, 경매장에서 얻을 수 있습니다");
      } else {
        Art.drawOriginal(canvas, item.key, 8);
        name.textContent = item.label;
        // 별도 검수(10/8): 얻은 뒤에도 「잉크 두 배」가 보이게 — 잉크통 1단계로 찍으면 미완성이 나오는 원작이다
        level.textContent = "Lv " + info.level + (info.inkMult > 1 ? " · 잉크 ×" + info.inkMult : "");
        button.setAttribute("aria-label", "원작 " + item.label + " 레벨 " + info.level
          + (info.inkMult > 1 ? ", 잉크 " + info.inkMult + "배" : "")
          + (isCurrent ? ", 현재 작품" : isNext ? ", 다음 작품 예약됨" : ""));
      }
      const badge = document.createElement("span");
      badge.className = "dex-badge";
      badge.textContent = isCurrent ? "현재 작품" : isNext ? "다음 작품 예약" : " ";
      button.appendChild(canvas);
      button.appendChild(name);
      button.appendChild(level);
      button.appendChild(badge);
      button.addEventListener("click", function () {
        if (!info.owned) return;
        const wasWaiting = engine.getState().awaitingOriginal;
        engine.chooseOriginal(item.key);
        if (wasWaiting) {
          closeDex();
          workbench.focus();
          return;
        }
        renderDex();
      });
      list.appendChild(button);
    });
    putText("dexNextInfo", s.nextOriginal
      ? "다음 작품 예약: " + Art.originalByKey(s.nextOriginal).label
      : "다음 작품 예약 없음");
  }

  // ── 입력 연결 ────────────────────────────────────────────────
  $("startBtn").addEventListener("click", function () {
    ensureAudio();
    engine.start();
    $("startGate").hidden = true;
  });
  function showWorkspaceOnMobile() {
    if (!window.matchMedia("(max-width: 700px)").matches) return;
    window.requestAnimationFrame(function () {
      $("workbench").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
  $("mobileWorkspaceJump").addEventListener("click", showWorkspaceOnMobile);
  $("jobBtn").addEventListener("click", function () {
    if (engine.startWindowJob()) {
      // 0827 승인 유지 계약의 「다음 단계」 — 여기서만 깨진 유리가 새 유리로 바뀐다.
      clearGlassCrack();
      workbench.focus();
      showWorkspaceOnMobile();
    }
  });
  // 2026-10-20 v9: 「도화지 구매」 버튼은 뺐다 — 원작 카드 누르기(renderCatalog 위 catalogCards)가 그 자리를 맡는다.
  $("phoneBtn").addEventListener("click", function () {
    // 다음 화면 갱신을 기다리지 않고 클릭한 바로 그 순간 벨을 끊는다.
    if (engine.answerPhone()) stopRingBurst();
  });
  $("phonePrevBtn").addEventListener("click", function () { engine.prevPhone(); });
  // 2026-10-08 3단계 — 「1막 끝」 화면의 「계속 하기」: 닫고 그대로 이어서 논다(초기화 없음).
  $("act1ContinueBtn").addEventListener("click", function () { engine.closeAct1End(); });
  $("phoneNextBtn").addEventListener("click", function () { engine.advancePhone(); });
  $("catalogItem").addEventListener("click", function () { engine.clickCatalog(); });
  $("originalSelectorBtn").addEventListener("click", openDex);
  // 2026-10-08 4단계: 경매장 문 — 돈이 예상가에 닿았을 때만 눌린다(엔진이 다시 한 번 확인한다).
  // 별도 검수(10/8): 더블클릭 · Enter 꾹 누르기로 다음 매물까지 연달아 사지 않게 — 화면에 보인 매물만, 0.45초에 한 번.
  let doorLockUntil = 0;
  $("auctionDoorBtn").addEventListener("click", function () {
    if (performance.now() < doorLockUntil) return;
    doorLockUntil = performance.now() + 450;
    engine.buyAuctionLot(lastLotKey);
  });
  // 2026-10-12 v5: 레벨업 칸 — 화면이 보여 준 매물(lastLevelLotKey)만 산다(같은 0.45초 잠금)
  $("auctionLevelBtn").addEventListener("click", function () {
    if (performance.now() < doorLockUntil) return;
    doorLockUntil = performance.now() + 450;
    engine.buyAuctionLot(lastLevelLotKey);
  });
  $("dexCloseBtn").addEventListener("click", closeDex);
  // 마감 알림 자리의 버튼 — 지금 열려 있는 마감 선택을 그대로 넘긴다.
  // 잉크 소진은 이 자리를 거치지 않는다 (결과판이 그 순간 곧바로 열린다).
  $("sellNowBtn").addEventListener("click", function () { engine.sellNow(); });
  // 두 번째 작업대 상품 — 60원을 실제로 내야 같은 규격 작업대 한 대가 더 선다.
  $("upg-secondWorkbench").addEventListener("click", function () {
    engine.buySecondWorkbench();
  });
  // 결과판 — 산 작품을 각각 처리한다. 첫 미완성 작품도 여기서 직접 판다 (라운드 001).
  BENCH_TAGS.forEach(function (tag, index) {
    $("sellWork" + tag).addEventListener("click", function () { engine.sellWork(index); });
    $("displayWork" + tag).addEventListener("click", function () { engine.displayWork(index); });
  });
  // 검수 전용 제작 전환 — 엔진 API에 그대로 잇는다.
  // 돈·경험치·판매수·상점·업그레이드·자연 상품 해금은 하나도 바꾸지 않는다.
  REVIEW_BENCH_BTNS.forEach(function (item) {
    $(item.id).addEventListener("click", function () {
      engine.setReviewWorkbenchCount(item.n);
    });
  });
  $("reviewSimulUnlock").addEventListener("click", function () {
    engine.setReviewSimultaneousUnlock(!engine.getState().review.simultaneousUnlocked);
  });
  $("reviewModeSequential").addEventListener("click", function () {
    engine.setReviewProductionMode("sequential");
  });
  $("reviewModeSimultaneous").addEventListener("click", function () {
    engine.setReviewProductionMode("simultaneous");
  });
  // 첫 판매 손실 결과의 「확인」 — 이 뒤에야 잉크통 전화가 걸린다.
  $("lossConfirmBtn").addEventListener("click", function () { engine.confirmLoss(); });
  // 검수 전용 돈 — 실제 경제와 분리된 도구. 돈만 더한다.
  State.EXPANSION_TEST_VALUES.reviewMoneyAmounts.forEach(function (amount) {
    $("reviewMoney" + amount).addEventListener("click", function () {
      engine.addReviewMoney(amount);
    });
  });

  $("scrollHelpIcon").addEventListener("click", function () {
    scrollHelpOpen = !scrollHelpOpen;
    $("scrollHelpBox").hidden = !scrollHelpOpen;
  });
  $("scrollHelpClose").addEventListener("click", closeScrollHelp);

  // 스크래치식 대출 계약서 — 0827 승인 대출 A로 진입 경로가 정리됐다.
  // 열리는 길은 둘이다 — ① 상단에서 내려온 계약서(#loanDrop)를 누르는 것,
  // ② 체결 뒤 우상단 계약 카드(#loanSlot). 2026-08-27 2차 피드백 ㉱로 왼쪽 경제
  // 카드와 그 안의 상시 계약서 버튼이 사라져 셋에서 둘이 됐다.
  // 어디에도 「거절」은 없다 — 돈이 소진되면 대출은 반드시 진행된다.
  $("loanContractClose").addEventListener("click", function () { openLoanContract(false); });
  $("loanDrop").addEventListener("click", function () {
    ensureAudio();
    openLoanContract(true);
  });
  // 우상단 계약 카드 → 상세. 카드는 상세가 열려 있는 동안 스스로 숨는다.
  $("loanSlot").addEventListener("click", function () { openLoanDetail(); });
  // 위기 통화의 마지막 장에 남은 단 하나의 버튼 — 고르는 것이 아니라 확인이다.
  // 누르면 통화가 끝나고 계약서가 상단에서 내려온다(dropLoanContract).
  $("phoneAcceptBtn").addEventListener("click", function () {
    ensureAudio();
    engine.acceptLoanOffer();
    render(engine.getState());
  });
  $("loanSignBtn").addEventListener("click", function () {
    // 성립 판정은 엔진이 한다 — 이미 체결한 계약서는 여기서 눌러도 false다.
    if (engine.signLoanContract()) {
      const L = engine.getState().loan;
      sayLoan("서명했습니다 — 현금 " + won(L.principal) + " 수령. …그런데 뒷면에 뭐가 적혀 있죠?",
        "warn");
    } else {
      sayLoan("이미 체결한 계약입니다 — 다시 서명할 수 없습니다", "warn");
    }
  });
  $("loanRepayBtn").addEventListener("click", function () {
    const before = engine.getState();
    if (engine.repayLoan()) {
      sayLoan("대출을 한 번에 모두 갚았습니다 — 이제 번 돈이 온전히 들어옵니다", "done");
      return;
    }
    sayLoan(!before.loan.signed ? "아직 체결하지 않은 계약입니다"
      : before.loan.balance <= 0 ? "이미 모두 갚았습니다"
        // 잔액만큼은 모았는데 잠긴 자리 — 유리창 선투자를 남겨야 한다는 뜻이다.
        : before.loan.reserveBlocked
          ? "유리창 선투자 " + won(before.deadlockGuard.reserve) + "을 남겨야 합니다 — 현금 "
            + won(before.loan.repayNeeded) + "부터 갚을 수 있어요 · 지금 현금 "
            + won(before.money)
          : "분할 상환은 없습니다 — 현금 " + won(before.loan.totalDue)
            + "이 모여야 갚을 수 있어요 · 지금 현금 " + won(before.money), "warn");
  });

  // ── 작업대 입력 (2026-08-26 v1 계약 5항) ────────────────────────────
  // 휠·아래 화살표는 「포인터가 올라간 작업대 한 대」에만 들어간다.
  // 어느 대인지는 아래 호버 판정(hoverBenchSlot)이 정하고, 정해지지 않았으면
  // 지금 대상 작업대(엔진의 benchFocus)가 그대로 받는다.
  //
  // 2026-08-26 동현 확정: 대상 한 대로 넣는 길만 있다. 대상 판정이 실패해도
  // 전부를 미는 printWheel/printKey로 떨어지지 않는다 — 그 우회가 있으면 검수용
  // 동시 제작을 켠 상태에서 포인터 한 번이 네 작업대를 통째로 밀어 버렸다.
  // 「전체 입력」은 검수 도구(디버그 창)의 몫으로만 남는다.
  let hoverBenchSlot = -1;
  function pushBenchInput(kind, delta) {
    const s = engine.getState();
    if (s.mode === "window") {
      return kind === "wheel" ? engine.windowWheel(delta) : engine.windowKey();
    }
    if (!s.hasPaper) return false;
    if (performance.now() < inkHitchUntil) return false; // v7 · 52-4 밀대 멈칫 — 바닥난 순간 잠깐 걸린다
    const slot = hoverBenchSlot >= 0 ? hoverBenchSlot : s.benchFocus;
    return kind === "wheel"
      ? engine.printWheelAt(slot, delta)
      : engine.printKeyAt(slot);
  }

  workbench.addEventListener("wheel", function (event) {
    event.preventDefault(); // 페이지 스크롤과 분리 — 작업대 위에서만
    ensureAudio();
    let d = event.deltaY;
    if (event.deltaMode === 1) d *= 33;
    if (d <= 0) return;
    closeScrollHelp(); // 조작을 시작했으면 도움 팝업은 할 일을 다한 것
    pushBenchInput("wheel", d);
  }, { passive: false });

  // 확률표 호버 — 작업대 테두리나 두 칸 사이 빈틈이 아니라, 실제로 보이는
  // 도화지 캔버스 위에 포인터가 있을 때만 켠다.
  // 포인터의 좌표는 읽지 않는다 — 표 자리는 CSS 고정이다 (라운드 001).
  // 2026-08-26 v1: 같은 호버 판정이 「확률표를 띄울까」와 「어느 작업대가 입력을
  // 받을까」를 함께 정한다. 표가 뜨는 그 도화지가 곧 밀리는 도화지다.
  function paperPointerMove(event) {
    const s = engine.getState();
    const onCanvas = !event.currentTarget.hidden;
    benchHover = !!s.hasPaper && onCanvas;
    // 같은 칸 위지만 지금 놓인 것이 도화지가 아니라 유리창이면 유리창 표를 켠다.
    windowHover = !s.hasPaper && s.mode === "window" && onCanvas;
    const slot = Number(event.currentTarget.dataset.benchSlot);
    hoverBenchSlot = benchHover && Number.isInteger(slot) ? slot : -1;
    if (hoverBenchSlot >= 0) engine.focusBench(hoverBenchSlot);
  }
  function paperPointerLeave() {
    benchHover = false;
    windowHover = false;
    hoverBenchSlot = -1;
  }
  // 네 그림면 모두 같은 호버 판정을 쓴다 (3·4번째는 검수 전환으로 열었을 때만 보인다).
  // dataset.benchSlot이 곧 「이 캔버스가 몇 번 작업대인가」다.
  [$("benchCanvas"), $("benchCanvasB"), $("benchCanvasC"), $("benchCanvasD")]
    .forEach(function (canvas, index) {
      canvas.dataset.benchSlot = String(index);
      canvas.addEventListener("pointerenter", paperPointerMove);
      canvas.addEventListener("pointermove", paperPointerMove);
      canvas.addEventListener("pointerleave", paperPointerLeave);
      canvas.addEventListener("pointercancel", paperPointerLeave);
    });

  workbench.addEventListener("keydown", function (event) {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    ensureAudio();
    closeScrollHelp(); // 휠과 같은 이유 — 조작 시작이 곧 닫기 신호
    pushBenchInput("key", 0);
  });

  // ── D키 디버그 창 (2026-08-19 · 0817 피드백 4번) ────────────────
  // 「디버그 창은 기본적으로 d키를 눌렀을 때 나왔으면 좋겠음」 — 동현.
  // 글자를 입력하는 칸에 포커스가 있을 때는 가로채지 않는다.
  // 2026-10-06 두 방 데모 A — 모작 확률표의 표기만 바꾸는 화면 손잡이(엔진 값·추첨·가격은 그대로).
  Array.prototype.forEach.call(document.querySelectorAll("#debugPanel .prob-mode-pick"), function (btn, _i, all) {
    btn.addEventListener("click", function () {
      probDisplayMode = btn.dataset.probMode === "round" ? "round" : "final";
      Array.prototype.forEach.call(all, function (b) {
        const on = String(b === btn);
        b.dataset.on = on;
        b.setAttribute("aria-pressed", on);
      });
      textCache.__prob = null;
    });
  });
  const debugPicks = Array.prototype.slice.call(
    document.querySelectorAll("#debugPanel .debug-pick"));
  debugPicks.forEach(function (btn) {
    btn.addEventListener("click", function () {
      engine.setDebugValue(btn.dataset.debugKey, Number(btn.dataset.debugValue));
      render(engine.getState());
    });
  });
  // 즉시 실행 버튼 — 누르면 한 번 일어나고 화면을 다시 그린다.
  Array.prototype.slice.call(document.querySelectorAll("#debugPanel [data-debug-action]"))
    .forEach(function (btn) {
      btn.addEventListener("click", function () {
        engine.runDebugAction(btn.dataset.debugAction);
        render(engine.getState());
      });
    });
  $("debugCloseBtn").addEventListener("click", function () {
    engine.toggleDebug(false);
    render(engine.getState());
  });
  function typingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
  }

  document.addEventListener("keydown", function (event) {
    if ((event.key === "d" || event.key === "D")
      && !event.metaKey && !event.ctrlKey && !event.altKey
      && !typingTarget(event.target)) {
      event.preventDefault();
      engine.toggleDebug();
      render(engine.getState());
      return;
    }
    if (event.key !== "Escape") return;
    if (engine.getState().debug.open) { engine.toggleDebug(false); render(engine.getState()); return; }
    if (engine.getState().phone.open) engine.closePhone();
    else if (dexOpen) closeDex();
    else if (loanOpen) openLoanContract(false); // 계약서도 Esc로 닫힌다
  });

  // 전체 초기화 — 실수 클릭을 막는 확인 절차
  $("resetBtn").addEventListener("click", function () {
    $("resetConfirm").hidden = false;
    $("resetBtn").hidden = true;
  });
  $("resetCancelBtn").addEventListener("click", function () {
    $("resetConfirm").hidden = true;
    $("resetBtn").hidden = false;
  });
  function fullReset() {
    engine.reset();
    engine.start();
    particles = [];
    clearTimeout(glowTimer);
    clearFanfareTimers();
    workbench.style.boxShadow = "none";
    workbench.classList.remove("shake");
    $("gradeBanner").classList.remove("show");
    // 라운드 005 단계 1-A 보수 (게임싸개 리뷰 지적, 2026-08-24): 전체 초기화는 새 게임의
    // 시작이므로 유리창 도움말도 처음 상태로 돌아가야 한다. 이걸 빼먹으면
    //  · seen이 남아 → 리셋 뒤 첫 유리창에서 자동 도움말이 다시 안 뜨고
    //  · open이 남아 → 열어둔 채 리셋하면 새 게임 화면에 도움말이 그대로 남는다.
    scrollHelpSeen = false;
    scrollHelpOpen = false;
    $("scrollHelpBox").hidden = true; // 화면도 닫힌 상태와 즉시 동기화
    // 대출 계약서도 같은 이유로 닫힌 상태로 돌아간다 — 엔진 쪽 계약은 engine.reset()이
    // 이미 「제안 없음 · 미서명 · 0원」으로 되돌렸고, 여기서는 열려 있던 화면과 안내문만 지운다.
    loanOpen = false;
    loanNote = "";
    loanNoteTone = "";
    lastRevealKey = "__none__";
    $("loanContractOverlay").hidden = true;
    // 구석 알림 둘도 함께 지운다 (뜬 채로 초기화해도 새 게임 화면에 남지 않는다).
    hideGoalToast();
    clearTimeout(shopPopupTimer);
    shopPopupKey = "";
    $("shopUnlockPopup").dataset.open = "false";
    hoverBenchSlot = -1;
    $("unlockFlash").classList.remove("show");
    $("jackpotFloat").classList.remove("show");
    hideJackpotOverlay();
    // 2026-08-27 v4 독립 검토 지적: 유리 파손 균열(#glassCrackFx)도 같은 구석 연출이다.
    // 균열이 번지는 도중에 초기화하면 이걸 빼먹은 만큼
    //  · 새 게임 화면에 깨진 유리 파편이 그대로 얹혀 있고
    //  · 이전 게임이 예약해 둔 단계 타이머가 나중에 깨어나 새 화면을 덮는다.
    clearGlassCrack();
    benchHover = false;
    windowHover = false;
    lastCatalogState = "__stale__";
    lastSlotOriginal = "__none__";
    lastLotKey = "__none__";
    lastLevelLotKey = "__none__";
    lastGalleryKey = "__stale__"; // 갤러리 칸 그림도 초기값으로 다시 그린다
    closeDex();
    setPane("workshop");
    tabBtn.shop.dataset.new = "false";
    $("upg-secondWorkbench").dataset.new = "false";
    textCache.__prob = null;
    // 2026-10-06 두 방 데모 A — 회차 점·둘레 강조도 새 게임 화면에 남지 않게
    lastRoundMarkKey = "";
    BENCH_UNIT_IDS.forEach(function (id) { const box = $(id); if (box) box.classList.remove("grade-blink"); });
  }
  $("resetConfirmBtn").addEventListener("click", function () {
    fullReset();
    $("resetConfirm").hidden = true;
    $("resetBtn").hidden = false;
  });

  // 시연용 반복 벨 — 받을 때까지 1.7초 주기 (일시정지 중 제외)
  setInterval(function () {
    const s = engine.getState();
    if (s.started && s.phone.ringing && !s.paused) ringBurst();
  }, 1700);

  // ── 프레임 루프 ──────────────────────────────────────────────
  let lastFrame = performance.now();
  function frame() {
    const now = performance.now();
    const realDt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    engine.tick(realDt * 1000);
    handleEvents();
    const s = engine.getState();
    render(s);
    const view = engine.view();
    if (s.mode === "window" && view.S.window) {
      drawBenchWindow(view.S.window, view.clock, s.window ? s.window.layers : null,
        inkDamOn(s, "window"));
    } else if (s.hasPaper) {
      drawWorkCanvases(s, view, s.paused ? 0 : realDt);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ── 검수·자동화 테스트 API ──
  // 화면에 드러난 검수 도구는 상단 검수 바의 「검수용 돈」뿐이고,
  // 나머지 자동화 조작은 전부 이 객체에만 둔다 (플레이 화면에는 노출하지 않는다).
  window.__MEWNA_TEST__ = {
    reset: function () {
      fullReset();
      $("startGate").hidden = true;
      return true;
    },
    // 2026-08-26 5차 독립 검토 대응 — 저장·불러오기 검수 손잡이.
    // 「전화가 울린 그 순간 저장 → 불러오기」로 되살아나는 대출 전화(README 15번)를
    // 브라우저에서도 그대로 재현할 수 있어야 한다. 화면은 프레임 루프가 매 프레임
    // 다시 그리므로 여기서 따로 render를 부르지 않는다. 경제 규칙은 하나도 건드리지
    // 않고 엔진의 save/load를 그대로 내보낸다.
    save: function () { return engine.save(); },
    load: function (data) { return engine.load(data); },
    getState: function () { return engine.getState(); },
    // 2026-10-16 v7 — 지금 인쇄의 색판별 · 줄별 진하기(치약 쥐어짜기) 사본. 검사 전용, 읽기만 한다.
    printDamShownForQa: function () { return lastPrintDamShown; },
    inkHitchLeftForQa: function () { return Math.max(0, inkHitchUntil - performance.now()); }, // 검사 전용 — 밀대 멈칫 남은 시간(ms)
    printDensForQa: function () {
      const P = engine.view().S.print;
      return P && P.dens ? P.dens.map(function (row) { return Array.from({ length: ART }, function (_, y) { return row[y] === undefined ? null : row[y]; }); }) : null;
    },
    tick: function (ms) { return engine.tick(ms); },
    // 브라우저 검수도 화면 버튼과 같은 「다음 단계」 정리를 지난다 — 검수 경로에서만
    // 깨진 유리가 남아 보이는 어긋남이 생기지 않게 한다 (0827 유리 A 유지 계약).
    startWindowJob: function () {
      const started = engine.startWindowJob();
      if (started) clearGlassCrack();
      return started;
    },
    completeWindowStroke: function () { return engine.completeWindowStroke(); },
    completeWindow: function () { return engine.completeWindow(); },
    // 2026-08-26 v1 — 스크래치식 대출. 브라우저 검수가 화면을 거치지 않고도 같은 규칙을
    // 두드려 볼 수 있게 열어 둔다 (화면 버튼이 부르는 것과 완전히 같은 엔진 함수다).
    acceptLoanOffer: function () { return engine.acceptLoanOffer(); },
    // 2026-08-27 대출 A 승인 — 「거절」 손잡이는 화면 쪽에서 사라졌다. 플레이어가
    // 닿을 수 있는 어떤 경로도 대출을 거절하지 않는다. 엔진 함수 자체는 「순서를
    // 건너뛴 호출은 성립하지 않는다」는 부모 방어 계약을 계속 지키려고 남아 있지만,
    // 이 브라우저 검수 손잡이에서까지 내보내지는 않는다.
    signLoanContract: function () { return engine.signLoanContract(); },
    repayLoan: function () { return engine.repayLoan(); },
    // 계약서 화면 자체를 여닫는 손잡이 — 겹침·가로 넘침 캡처에 쓴다.
    openLoanContract: function (open) { openLoanContract(open !== false); return true; },
    // 검수 전용: 지금 현금을 특정 금액으로 맞춘다. 대출 위기(돈이 없어 막히는 순간)와
    // 전액 상환 조건(200원)을 브라우저에서 결정적으로 재현하기 위한 손잡이다.
    // 해금·확률·판매 수·경험치는 하나도 건드리지 않는다.
    setReviewMoney: function (amount) { return engine.setReviewMoney(amount); },
    // 2026-08-26 v1 — 작업대별 독립 입력
    focusBench: function (slot) { return engine.focusBench(slot); },
    printWheelAt: function (slot, d) { return engine.printWheelAt(slot, d); },
    answerPhone: function () { return engine.answerPhone(); },
    advancePhone: function () { return engine.advancePhone(); },
    closePhone: function () { return engine.closePhone(); },
    clickCatalog: function () { return engine.clickCatalog(); },
    buyPaper: function () { return engine.buyPaper(); },
    // 2026-10-20 v9 — 한 장 제작(왼쪽 원작 카드와 같은 엔진 함수)
    makeSheet: function (key) { return engine.makeSheet(key); },
    performPrintStroke: function () { return engine.performPrintStroke(); },
    finishPrint: function () { return engine.finishPrint(); },
    extraPrint: function () { return engine.extraPrint(); },
    performExtraPrint: function () { return engine.performExtraPrint(); },
    sellNow: function () { return engine.sellNow(); },
    buyUpgrade: function (key) { return engine.buyUpgrade(key); },
    // 2026-10-08 4단계 — 경매장 문(화면 버튼과 같은 엔진 함수)
    buyAuctionLot: function (lotKey) { return engine.buyAuctionLot(lotKey); }, // v5: 매물 이름표(「원작:레벨」)를 넘길 수 있다
    // 2026-10-08 3단계 — 검수 창 「구간 채우기」와 같은 명령 · 「1막 끝」의 「계속 하기」
    runDebugAction: function (name) { return engine.runDebugAction(name); },
    closeAct1End: function () { return engine.closeAct1End(); },
    chooseOriginal: function (key) { return engine.chooseOriginal(key); },
    // 라운드 005 — 결과판 처리·첫 갤러리 전시·검수 전용 돈
    sellWork: function (slot) { return engine.sellWork(slot); },
    displayWork: function (slot) { return engine.displayWork(slot); },
    addReviewMoney: function (amount) { return engine.addReviewMoney(amount); },
    // 2026-08-19 — 검수 전용 잉크. 3·4번째 작업대는 아직 자연 경로가 없어
    // (상점 잉크통은 두 장분이 끝) 겉모습 검수에는 이 손잡이가 필요하다.
    addReviewInk: function () { return engine.addReviewInk(); },
    // 브라우저 캡처 전용: 자연 진행을 바꾸지 않고 작업대별 작품 외형만 준비한다.
    prepareReviewArtworks: function (count) { return engine.prepareReviewArtworks(count); },
    // 2026-08-19 — D키 디버그 창
    toggleDebug: function (open) { return engine.toggleDebug(open); },
    setDebugValue: function (key, value) { return engine.setDebugValue(key, value); },
    // 라운드 001 — 첫 판매 손실 결과의 확인
    confirmLoss: function () { return engine.confirmLoss(); },
    // 2026-08-12 — 두 번째 작업대 상품 확인·구매
    confirmWorkbenchCard: function () { return engine.confirmWorkbenchCard(); },
    buySecondWorkbench: function () { return engine.buySecondWorkbench(); },
    // 2026-08-15 — 검수 전용 제작 전환 (작업대 1~4 · 동시 해금 · 순차/동시)
    setReviewWorkbenchCount: function (n) { return engine.setReviewWorkbenchCount(n); },
    setReviewSimultaneousUnlock: function (on) { return engine.setReviewSimultaneousUnlock(on); },
    setReviewProductionMode: function (mode) { return engine.setReviewProductionMode(mode); },
    setRandom: function (fn) { return engine.setRandom(fn); },
    setJackpotRandom: function (fn) { return engine.setJackpotRandom(fn); },
    isPaused: function () { return engine.getState().paused; },
    getAnchors: function () {
      const out = {};
      State.ANCHOR_KEYS.forEach(function (key) {
        const node = document.querySelector('[data-anchor="' + key + '"]');
        if (!node) throw new Error("필수 앵커 누락: " + key);
        const rect = node.getBoundingClientRect();
        out[key] = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
      return out;
    },
  };
}());
