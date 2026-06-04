(() => {
  "use strict";

  const CONFIG = {
    CELL: 4,
    LINE_LUM: 235,
    MASK_CLOSE: 1,

    NODE_COUNT: 16,
    HIT_RADIUS: 45,
    WRONG_HIT_RADIUS: 32,
    LINE_WIDTH: 7,
    DRAW_PASS: 100,
    BREAK_PENALTY: 0.04, // 한 호흡 끊길 때마다 데생 점수에서 깎는 비율(약하게)

    BRUSH_SCRATCH: 22,
    SCRATCH_POWER: 28,
    SCRATCH_THRESHOLD: 100,
    SCRATCH_SOFT_BLUR: 6,
    PAINT_RESERVE: 70,
    PAINT_DRAIN_PER_TOUCH: 1,
    REVEAL_PASS: 92,

    AUTO_DELAY: 900,

    SCORE_REVEAL: 70,
    SCORE_DRAW: 15,
    SCORE_SCRATCH: 15,
  };
  const CONFIG_DEFAULTS = structuredClone(CONFIG);

  const IMAGE_ROLE = {
    OUTLINE_GUIDE: 0, // 1번 이미지: 큰 도화지 위 흐린 밑그림
    SKETCH: 1,        // 2번 이미지: 데생 완성 후 드러나는 선화
    COLOR: 2,         // 3번 이미지: 긁으면 밑에서 드러나는 컬러 그림
  };
  const IMG_SRC = [
    "assets/mena-lisa%201.png",
    "assets/mena-lisa%202.png",
    "assets/mena-lisa%203.jpg",
  ];
  const IMAGE_LOAD_TIMEOUT_MS = 8000;
  const WRONG_FLASH_MS = 260;
  const WRONG_HIT_RADIUS_RATIO = 0.72;
  const DRAW_LOOP_TARGET = 1;
  const FIXED_CONTOUR_RATIOS = [
    [0.3123, 0.0974],
    [0.4470, 0.1565],
    [0.6243, 0.1586],
    [0.7602, 0.0872],
    [0.7581, 0.2292],
    [0.7454, 0.3553],
    [0.9094, 0.4726],
    [0.9592, 0.9255],
    [0.5151, 0.8850],
    [0.3056, 0.8927],
    [0.2529, 0.8130],
    [0.0818, 0.8064],
    [0.1675, 0.6195],
    [0.3006, 0.4573],
    [0.3071, 0.3540],
    [0.3109, 0.2161],
  ];
  const STROKE_ORDER = [0, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

  const gameLayout = document.getElementById("gameLayout");
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const CELL = CONFIG.CELL;
  const GW = Math.ceil(W / CELL);
  const GH = Math.ceil(H / CELL);
  const MAIN_GRID = { w: W, h: H, cell: CELL, gw: GW, gh: GH };

  const off = document.createElement("canvas");
  off.width = W;
  off.height = H;
  const offCtx = off.getContext("2d", { willReadFrequently: true });

  const traceLayer = document.createElement("canvas");
  traceLayer.width = W;
  traceLayer.height = H;
  const traceCtx = traceLayer.getContext("2d");

  const revealLayer = document.createElement("canvas");
  revealLayer.width = W;
  revealLayer.height = H;
  const revealCtx = revealLayer.getContext("2d");

  const scratchBrushLayer = document.createElement("canvas");
  scratchBrushLayer.width = W;
  scratchBrushLayer.height = H;
  const scratchBrushCtx = scratchBrushLayer.getContext("2d");

  const scratchGridLayer = document.createElement("canvas");
  scratchGridLayer.width = GW;
  scratchGridLayer.height = GH;
  const scratchGridCtx = scratchGridLayer.getContext("2d");
  const scratchGridImage = scratchGridCtx.createImageData(GW, GH);

  const STAGE = { LOADING: 0, DRAW: 1, PAINT: 2, RESULT: 3 };
  let stage = STAGE.LOADING;
  const images = new Array(IMG_SRC.length).fill(null);
  let layout = null;

  let drawMaskCells = null;
  let maskCells = null;
  let totalMask = 0;

  let contourNodes = [];
  let completedDrawLoops = 0;
  let visitedNodeCount = 0;
  let lastNodeIdx = -1;
  let strokeActive = false;
  let nextNodeIdx = 0;        // 순서상 다음에 이어야 할 점 (희미하게 빛남)
  let breakCount = 0;         // 한 호흡이 끊긴 횟수 (그리는 도중 손을 뗀 횟수)
  let strokeInProgress = false; // 지금 한 호흡(누름/호버)으로 이어가는 중인지
  let wrongFlashNodeIdx = -1;
  let wrongFlashUntil = 0;
  let wrongResetTimer = null;

  let scratchCells = null;
  let touchedCells = null;
  let scratchVisitMarks = null;
  let scratchStrokeId = 0;
  let revealedAmount = 0;
  let scratchInsideTouches = 0;
  let scratchTotalTouches = 0;
  let paintLeft = 0;
  let paintMax = 0;
  let paintDepleted = false;
  let paintFinishReason = "manual";
  let drawCompleteQueued = false;
  let paintCompleteQueued = false;

  let wristMode = false;
  let hovering = false;
  let hoverSurface = null;
  let activeSurface = null;
  let drawing = false;
  let lastPt = null;
  let fade2 = 0;
  let fade2Active = false;
  let fade3 = 0;
  let fade3Active = false;
  let autoPaintTimer = null;
  let paintCompleteTimer = null;

  let dirty = true;
  function markDirty() {
    dirty = true;
  }

  function syncWrongHitRadius() {
    CONFIG.WRONG_HIT_RADIUS = Math.max(12, Math.round(CONFIG.HIT_RADIUS * WRONG_HIT_RADIUS_RATIO));
  }

  function showLoadError(msg) {
    const spin = document.getElementById("loadSpin");
    if (spin) spin.style.display = "none";
    const p = document.getElementById("loadMsg");
    if (p) p.innerHTML = msg;
  }

  function loadOne(src, i) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        im.onload = null;
        im.onerror = null;
        reject(new Error(`이미지 로딩 시간 초과: ${src}`));
      }, IMAGE_LOAD_TIMEOUT_MS);

      im.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        images[i] = im;
        resolve();
      };
      im.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(new Error(src));
      };
      im.src = src;
    });
  }

  function loadImages() {
    Promise.all(IMG_SRC.map((src, i) => loadOne(src, i)))
      .then(onAllLoaded)
      .catch((err) => {
        const src = err && err.message ? decodeURIComponent(err.message) : "이미지";
        console.error("이미지 로드 실패:", src);
        if (location.protocol === "file:") {
          showLoadError(
            "로컬 파일(file://)에서는 동작하지 않아요.<br>" +
            "로컬 HTTP 서버로 열어주세요. (예: 터미널에서 <b>python3 -m http.server</b>)"
          );
        } else {
          showLoadError("이미지를 불러오지 못했어요:<br>" + src);
        }
      });
  }

  function onAllLoaded() {
    try {
      computeLayout();
      buildMasks();
    } catch (err) {
      console.error("그림 분석 실패:", err);
      if (location.protocol === "file:") {
        showLoadError(
          "로컬 파일(file://)에서는 그림 분석이 막혀 있어요.<br>" +
          "로컬 HTTP 서버로 열어주세요. (예: 터미널에서 <b>python3 -m http.server</b>)"
        );
      } else {
        showLoadError("그림 분석에 실패했어요. 새로고침해 주세요.");
      }
      return;
    }
    document.getElementById("loading").style.display = "none";
    document.getElementById("redrawBtn").disabled = false;
    document.getElementById("startScreen").classList.remove("hidden");
    requestAnimationFrame(loop);
  }

  function computeLayout() {
    const ref = images[IMAGE_ROLE.SKETCH];
    const a = ref.width / ref.height;
    let h = H;
    let w = h * a;
    if (w > W) {
      w = W;
      h = w / a;
    }
    layout = { x: (W - w) / 2, y: (H - h) / 2, w, h, cx: W / 2, cy: H / 2 };
  }

  function placeFor() {
    return { x: layout.x, y: layout.y, w: layout.w, h: layout.h };
  }

  function pixelsOf(img) {
    const p = placeFor();
    offCtx.clearRect(0, 0, W, H);
    offCtx.fillStyle = "#ffffff";
    offCtx.fillRect(0, 0, W, H);
    offCtx.drawImage(img, p.x, p.y, p.w, p.h);
    return offCtx.getImageData(0, 0, W, H).data;
  }

  function buildMasks() {
    const sketchPixels = pixelsOf(images[IMAGE_ROLE.SKETCH]);
    drawMaskCells = extractSilhouetteMask(sketchPixels, MAIN_GRID);
    maskCells = drawMaskCells;

    totalMask = 0;
    for (let i = 0; i < maskCells.length; i++) {
      if (maskCells[i]) totalMask++;
    }

    scratchCells = new Float32Array(GW * GH);
    touchedCells = new Uint8Array(GW * GH);
    scratchVisitMarks = new Uint16Array(GW * GH);

    buildContourNodes();
  }

  function computePaintReserve() {
    if (!totalMask) return 0;
    const safePower = Math.max(1, CONFIG.SCRATCH_POWER);
    const fullRevealTouches = totalMask * (CONFIG.SCRATCH_THRESHOLD / safePower);
    return Math.max(1, Math.round(fullRevealTouches * (CONFIG.PAINT_RESERVE / 100)));
  }

  function extractSilhouetteMask(data, grid) {
    const wall = new Uint8Array(grid.gw * grid.gh);
    const outside = new Uint8Array(grid.gw * grid.gh);
    const stack = [];

    for (let gy = 0; gy < grid.gh; gy++) {
      for (let gx = 0; gx < grid.gw; gx++) {
        let blockedCell = false;
        for (let sy = 0; sy < grid.cell && !blockedCell; sy++) {
          for (let sx = 0; sx < grid.cell; sx++) {
            const px = Math.min(grid.w - 1, gx * grid.cell + sx);
            const py = Math.min(grid.h - 1, gy * grid.cell + sy);
            const idx = (py * grid.w + px) * 4;
            const r = data[idx], g = data[idx + 1], b = data[idx + 2], al = data[idx + 3];
            const lum = r * 0.299 + g * 0.587 + b * 0.114;
            if (al > 40 && lum < CONFIG.LINE_LUM) {
              blockedCell = true;
              break;
            }
          }
        }
        if (blockedCell) wall[gy * grid.gw + gx] = 1;
      }
    }

    let blocked = wall;
    for (let n = 0; n < CONFIG.MASK_CLOSE; n++) blocked = dilate(blocked, grid);

    function pushOpen(i) {
      if (!blocked[i] && !outside[i]) {
        outside[i] = 1;
        stack.push(i);
      }
    }
    for (let gx = 0; gx < grid.gw; gx++) {
      pushOpen(gx);
      pushOpen((grid.gh - 1) * grid.gw + gx);
    }
    for (let gy = 0; gy < grid.gh; gy++) {
      pushOpen(gy * grid.gw);
      pushOpen(gy * grid.gw + grid.gw - 1);
    }

    while (stack.length) {
      const i = stack.pop();
      const gx = i % grid.gw;
      const gy = (i / grid.gw) | 0;
      if (gx + 1 < grid.gw) pushOpen(gy * grid.gw + gx + 1);
      if (gx - 1 >= 0) pushOpen(gy * grid.gw + gx - 1);
      if (gy + 1 < grid.gh) pushOpen((gy + 1) * grid.gw + gx);
      if (gy - 1 >= 0) pushOpen((gy - 1) * grid.gw + gx);
    }

    const mask = new Uint8Array(grid.gw * grid.gh);
    for (let i = 0; i < grid.gw * grid.gh; i++) {
      if (!outside[i]) mask[i] = 1;
    }
    return mask;
  }

  function dilate(src, grid) {
    const out = new Uint8Array(grid.gw * grid.gh);
    for (let gy = 0; gy < grid.gh; gy++) {
      for (let gx = 0; gx < grid.gw; gx++) {
        const i = gy * grid.gw + gx;
        if (src[i]) {
          out[i] = 1;
          continue;
        }
        if (
          (gx + 1 < grid.gw && src[i + 1]) ||
          (gx - 1 >= 0 && src[i - 1]) ||
          (gy + 1 < grid.gh && src[i + grid.gw]) ||
          (gy - 1 >= 0 && src[i - grid.gw])
        ) {
          out[i] = 1;
        }
      }
    }
    return out;
  }

  function buildContourNodes() {
    if (!layout || layout.w <= 0 || layout.h <= 0 || FIXED_CONTOUR_RATIOS.length < 4) {
      // layout 계산이 비정상일 때도 데모가 멈추지 않도록 타원형 안내점으로 이어간다.
      buildFallbackNodes();
      assignStrokeOrder();
      return;
    }

    contourNodes = STROKE_ORDER.map((sourceIndex, orderIndex) => {
      const [ratioX, ratioY] = FIXED_CONTOUR_RATIOS[sourceIndex];
      return {
        x: layout.x + ratioX * layout.w,
        y: layout.y + ratioY * layout.h,
        sourceIndex,
        closesLoop: orderIndex === STROKE_ORDER.length - 1,
        kind: "outer",
        visited: false,
      };
    });
    assignStrokeOrder();
  }

  // 정렬된 contourNodes에 순서 번호(order)를 부여한다.
  function assignStrokeOrder() {
    contourNodes.forEach((node, i) => { node.order = i; });
  }

  function buildFallbackNodes() {
    const p = layout
      ? placeFor()
      : { x: W * 0.1, y: H * 0.08, w: W * 0.8, h: H * 0.84 };
    const count = STROKE_ORDER.length;
    contourNodes = [];
    for (let i = 0; i < count; i++) {
      const angle = -(Math.PI * 2 * i) / (count - 1) - Math.PI / 2;
      contourNodes.push({
        x: p.x + p.w / 2 + Math.cos(angle) * p.w * 0.37,
        y: p.y + p.h / 2 + Math.sin(angle) * p.h * 0.42,
        sourceIndex: STROKE_ORDER[i],
        closesLoop: i === count - 1,
        kind: "outer",
        visited: false,
      });
    }
  }

  function resetDrawState() {
    completedDrawLoops = 0;
    resetCurrentDrawLoop({ clearTrace: true, resetBreaks: true });
  }

  function resetCurrentDrawLoop({ clearTrace = true, resetBreaks = false } = {}) {
    clearWrongFlash();
    if (clearTrace) traceCtx.clearRect(0, 0, W, H);
    contourNodes.forEach((node) => { node.visited = false; });
    visitedNodeCount = 0;
    lastNodeIdx = -1;
    nextNodeIdx = 0;
    strokeActive = false;
    strokeInProgress = false;
    if (resetBreaks) breakCount = 0;
    drawCompleteQueued = false;
    drawing = false;
    lastPt = null;
    activeSurface = null;
  }

  function clearWrongFlash() {
    clearTimeout(wrongResetTimer);
    wrongResetTimer = null;
    wrongFlashNodeIdx = -1;
    wrongFlashUntil = 0;
  }

  // 틀린 점(순서상 다음이 아닌 점)에 닿았을 때 — 데생을 처음부터 다시.
  // 끊김 기록(breakCount)은 유지하지 않고, 그어둔 선·방문 표시만 0번부터 초기화.
  function restartSketch(message = "처음부터 다시") {
    clearWrongFlash();
    resetCurrentDrawLoop({ clearTrace: true, resetBreaks: true });
    if (message) toast(message);
    updateMeters();
    markDirty();
  }

  function flashWrongNodeThenRestart(nodeIdx) {
    if (wrongResetTimer) return;
    wrongFlashNodeIdx = nodeIdx;
    wrongFlashUntil = Date.now() + WRONG_FLASH_MS;
    toast("틀린 점이에요. 처음부터 다시");
    markDirty();
    wrongResetTimer = setTimeout(() => {
      wrongResetTimer = null;
      wrongFlashNodeIdx = -1;
      wrongFlashUntil = 0;
      restartSketch("");
    }, WRONG_FLASH_MS);
  }

  function resetScratchState() {
    scratchCells.fill(0);
    touchedCells.fill(0);
    scratchVisitMarks.fill(0);
    scratchBrushCtx.clearRect(0, 0, W, H);
    scratchGridCtx.clearRect(0, 0, GW, GH);
    scratchStrokeId = 0;
    revealedAmount = 0;
    scratchInsideTouches = 0;
    scratchTotalTouches = 0;
    paintMax = computePaintReserve();
    paintLeft = paintMax;
    paintDepleted = false;
    paintFinishReason = "manual";
    paintCompleteQueued = false;
    fade3 = 0;
    fade3Active = false;
  }

  function beginGame() {
    wristMode = document.getElementById("wristToggle").checked;
    document.getElementById("startScreen").classList.add("hidden");
    startDraw();
  }

  function restartGame() {
    if (stage === STAGE.LOADING) return;
    clearTimeout(autoPaintTimer);
    autoPaintTimer = null;
    clearTimeout(paintCompleteTimer);
    paintCompleteTimer = null;
    clearWrongFlash();
    const debugPanel = document.getElementById("debugPanel");
    debugPanel.classList.remove("open");
    debugPanel.setAttribute("aria-hidden", "true");
    wristMode = document.getElementById("wristToggle").checked;
    hovering = false;
    hoverSurface = null;
    document.getElementById("result").classList.remove("show");
    document.getElementById("savedTag").classList.remove("show");
    document.getElementById("startScreen").classList.add("hidden");
    startDraw();
  }

  function startDraw() {
    stage = STAGE.DRAW;
    resetDrawState();
    resetScratchState();
    fade2 = 0;
    fade2Active = false;
    setLayoutMode("draw");
    setChips("draw");
    document.getElementById("meterMainName").textContent = "데생 공개";
    document.getElementById("meterPaint").style.display = "none";
    updateHintBanner("draw");
    document.getElementById("skipDrawBtn").style.display = "";
    document.getElementById("finishBtn").style.display = "none";
    updateMeters();
    markDirty();
  }

  function enterPaint() {
    if (stage === STAGE.PAINT || stage === STAGE.RESULT) return;
    clearTimeout(autoPaintTimer);
    drawing = false;
    lastPt = null;
    activeSurface = null;
    strokeActive = false;
    completedDrawLoops = DRAW_LOOP_TARGET;
    fade2 = 1;
    fade2Active = false;
    document.getElementById("chipDraw").classList.add("done");
    startPaint();
  }

  function startPaint() {
    stage = STAGE.PAINT;
    resetScratchState();
    setLayoutMode("paint");
    setChips("paint");
    document.getElementById("meterMainName").textContent = "드러난 그림";
    document.getElementById("meterPaint").style.display = "";
    document.getElementById("paintVal").textContent = "100%";
    document.getElementById("paintBar").style.width = "100%";
    updateHintBanner("paint");
    document.getElementById("skipDrawBtn").style.display = "none";
    document.getElementById("finishBtn").style.display = "";
    updateMeters();
    markDirty();
  }

  function updateHintBanner(mode) {
    const isPaint = mode === "paint";
    const banner = document.getElementById("hintBanner");
    const icon = document.getElementById("hintBannerIcon");
    const stageLabel = document.getElementById("hintBannerStage");
    const message = document.getElementById("hintBannerMessage");
    const footerHint = document.getElementById("hint");
    const text = isPaint
      ? "도화지 전체를 골고루 문질러 컬러 명화를 드러내세요. 같은 곳은 두세 번 문질러야 다 벗겨져요."
      : "큰 그림 위 빛나는 점을 순서대로 이어 그림을 완성하세요";

    if (banner) {
      banner.classList.toggle("draw-mode", !isPaint);
      banner.classList.toggle("paint-mode", isPaint);
    }
    if (icon) icon.textContent = isPaint ? "🖌️" : "✏️";
    if (stageLabel) stageLabel.textContent = isPaint ? "② 채색 단계" : "① 데생 단계";
    if (message) message.textContent = text;
    if (footerHint) footerHint.innerHTML = `<b>${isPaint ? "채색" : "데생"}:</b> ${text}`;
  }

  function setLayoutMode(mode) {
    if (!gameLayout) return;
    gameLayout.classList.toggle("draw-mode", mode === "draw");
    gameLayout.classList.toggle("paint-mode", mode === "paint");
  }

  function toCanvasLocal(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x: cx * (W / rect.width), y: cy * (H / rect.height) };
  }

  function surfaceForStage() {
    if (stage === STAGE.DRAW) return "main";
    if (stage === STAGE.PAINT) return "main";
    return null;
  }

  function surfaceFromTarget(target) {
    if (target === canvas) return "main";
    return null;
  }

  function tryVisitContourAt(x, y) {
    if (nextNodeIdx >= contourNodes.length) return;
    if (wrongResetTimer) return;
    const hitRadius = CONFIG.HIT_RADIUS;
    const wrongRadius = CONFIG.WRONG_HIT_RADIUS;

    let nextDist = Infinity;
    let wrongHit = -1;
    let wrongDist = Infinity;
    for (let i = 0; i < contourNodes.length; i++) {
      const node = contourNodes[i];
      if (node.visited) continue;
      if (node.closesLoop && i !== nextNodeIdx) continue;
      const d = Math.hypot(node.x - x, node.y - y);
      if (i === nextNodeIdx) {
        if (d <= hitRadius) nextDist = d;
      } else if (d <= wrongRadius && d < wrongDist) {
        wrongDist = d;
        wrongHit = i;
      }
    }

    // 통과 반경 안에 손길이 들어오면 다음 점을 방문 처리한다. 선 자체는 drawTraceStroke의 손궤적 그대로 둔다.
    if (nextDist <= hitRadius) {
      visitNode(nextNodeIdx);
      return;
    }

    // 틀림 반경은 통과 반경보다 작게 자동 계산해, 엉뚱한 리셋이 과하게 나지 않게 한다.
    if (wrongHit >= 0 && wrongDist <= wrongRadius) {
      flashWrongNodeThenRestart(wrongHit);
    }
  }

  function visitNode(idx) {
    const node = contourNodes[idx];
    node.visited = true;
    visitedNodeCount++;

    lastNodeIdx = idx;
    nextNodeIdx = idx + 1;
    strokeActive = true;
    strokeInProgress = true;

    updateMeters();
    const pct = contourNodes.length ? (visitedNodeCount / contourNodes.length) * 100 : 0;
    if (visitedNodeCount >= contourNodes.length && pct >= CONFIG.DRAW_PASS && !drawCompleteQueued) {
      drawCompleteQueued = true;
      triggerDrawComplete();
    }
    markDirty();
  }

  function drawTraceStroke(a, b) {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    if (dist < 0.5) return;
    const steps = Math.max(2, Math.round(dist / 9));
    const nx = -(b.y - a.y) / (dist || 1);
    const ny = (b.x - a.x) / (dist || 1);

    traceCtx.lineCap = "round";
    traceCtx.lineJoin = "round";

    for (let pass = 0; pass < 2; pass++) {
      traceCtx.strokeStyle = pass === 0 ? "rgba(48,38,22,0.92)" : "rgba(70,56,32,0.5)";
      traceCtx.lineWidth = CONFIG.LINE_WIDTH * (pass === 0 ? 0.92 : 0.55);
      traceCtx.beginPath();
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const jitter = (Math.random() - 0.5) * 2.4;
        const px = a.x + (b.x - a.x) * t + nx * jitter;
        const py = a.y + (b.y - a.y) * t + ny * jitter;
        if (s === 0) traceCtx.moveTo(px, py);
        else traceCtx.lineTo(px, py);
      }
      traceCtx.stroke();
    }
  }

  function scratchStroke(a, b) {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(dist / 5));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      scratchAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    }
  }

  function scratchAt(x, y) {
    if (paintLeft <= 0) {
      finishPaint("depleted");
      return;
    }
    if (!scratchStrokeId) scratchStrokeId++;

    const r = CONFIG.BRUSH_SCRATCH;
    const gx0 = Math.max(0, Math.floor((x - r) / CELL));
    const gx1 = Math.min(GW - 1, Math.floor((x + r) / CELL));
    const gy0 = Math.max(0, Math.floor((y - r) / CELL));
    const gy1 = Math.min(GH - 1, Math.floor((y + r) / CELL));

    outer:
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const cxp = gx * CELL + CELL / 2;
        const cyp = gy * CELL + CELL / 2;
        if (Math.hypot(cxp - x, cyp - y) > r) continue;
        const i = gy * GW + gx;
        if (scratchVisitMarks[i] === scratchStrokeId) continue;
        scratchVisitMarks[i] = scratchStrokeId;
        if (!spendPaint()) break outer;
        if (!touchedCells[i]) {
          touchedCells[i] = 1;
          scratchTotalTouches++;
          if (maskCells[i]) scratchInsideTouches++;
        }
        const before = scratchCells[i];
        const after = Math.min(CONFIG.SCRATCH_THRESHOLD, before + CONFIG.SCRATCH_POWER);
        scratchCells[i] = after;
        if (maskCells[i]) revealedAmount += after - before;
      }
    }

    updateMeters();
    if (paintLeft <= 0 && stage === STAGE.PAINT && !paintCompleteQueued) {
      finishPaint("depleted");
    }
    markDirty();
  }

  function spendPaint() {
    if (paintLeft <= 0) return false;
    paintLeft = Math.max(0, paintLeft - CONFIG.PAINT_DRAIN_PER_TOUCH);
    return true;
  }

  function checkDrawHitsAlongStroke(from, to) {
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(dist / Math.max(4, CONFIG.HIT_RADIUS * 0.45)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      tryVisitContourAt(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
    }
  }

  function applyInput(from, to) {
    if (stage === STAGE.DRAW) {
      drawTraceStroke(from, to);
      checkDrawHitsAlongStroke(from, to);
    } else if (stage === STAGE.PAINT) {
      scratchStroke(from, to);
    }
  }

  function onDown(e) {
    if (stage !== STAGE.DRAW && stage !== STAGE.PAINT) return;
    const surface = surfaceFromTarget(e.currentTarget);
    if (surface !== surfaceForStage()) return;
    e.preventDefault();
    if (stage === STAGE.PAINT) scratchStrokeId++;
    activeSurface = surface;
    drawing = true;
    lastPt = toCanvasLocal(e);
    applyInput(lastPt, lastPt);
  }

  function onMove(e) {
    if (stage !== STAGE.DRAW && stage !== STAGE.PAINT) return;
    const requiredSurface = surfaceForStage();
    const isTouch = !!e.touches;
    const hoverDraw = wristMode && !isTouch && hovering && hoverSurface === requiredSurface;
    if (!drawing && !hoverDraw) return;
    const surface = drawing ? activeSurface : hoverSurface;
    if (surface !== requiredSurface) return;
    e.preventDefault();
    const p = toCanvasLocal(e);
    if (!lastPt) lastPt = p;
    applyInput(lastPt, p);
    lastPt = p;
  }

  function onUp() {
    if (stage === STAGE.DRAW) noteBreath();
    drawing = false;
    strokeActive = false;
    activeSurface = null;
    lastPt = null;
    markDirty();
  }

  // 데생 도중 손을 뗐다(=한 호흡 끊김) → 약하게 기록. 다시 누르면 이어 그릴 수 있음.
  function noteBreath() {
    if (strokeInProgress && lastNodeIdx >= 0 && nextNodeIdx < contourNodes.length) {
      breakCount++;
    }
    strokeInProgress = false;
  }

  function onEnter(e) {
    hovering = true;
    hoverSurface = surfaceFromTarget(e.currentTarget);
    if (stage === STAGE.PAINT && wristMode) scratchStrokeId++;
  }

  function onLeave(e) {
    const surface = surfaceFromTarget(e.currentTarget);
    hovering = false;
    if (hoverSurface === surface) hoverSurface = null;
    lastPt = null;
    if (wristMode) {
      // 손목보호(hover) 모드에선 캔버스를 벗어나는 게 곧 '한 호흡 끊김'.
      if (stage === STAGE.DRAW) noteBreath();
      drawing = false;
      strokeActive = false;
      activeSurface = null;
    }
    markDirty();
  }

  function updateMeters() {
    if (stage === STAGE.DRAW) {
      const pct = Math.round(getSketchRevealProgress() * 100);
      document.getElementById("meterMainVal").textContent = pct + "%";
      document.getElementById("meterMainBar").style.width = pct + "%";
    } else if (stage === STAGE.PAINT || stage === STAGE.RESULT) {
      const pct = Math.min(100, Math.round(getRevealRatio() * 100));
      const paintPct = paintMax ? Math.max(0, Math.round((paintLeft / paintMax) * 100)) : 0;
      document.getElementById("meterMainVal").textContent = pct + "%";
      document.getElementById("meterMainBar").style.width = pct + "%";
      document.getElementById("paintVal").textContent = paintPct + "%";
      document.getElementById("paintBar").style.width = paintPct + "%";
      document.getElementById("paintBarWrap").classList.toggle("low", paintPct < 35);
      if (stage === STAGE.PAINT && pct >= CONFIG.REVEAL_PASS && !paintCompleteQueued) {
        finishPaint("complete");
      }
    }
  }

  function getRevealRatio() {
    return totalMask ? revealedAmount / (totalMask * CONFIG.SCRATCH_THRESHOLD) : 0;
  }

  function getSketchRevealProgress() {
    const currentLoop = drawCompleteQueued
      ? 0
      : (contourNodes.length ? visitedNodeCount / contourNodes.length : 0);
    return Math.min(1, (completedDrawLoops + currentLoop) / DRAW_LOOP_TARGET);
  }

  function triggerDrawComplete() {
    completedDrawLoops = DRAW_LOOP_TARGET;
    fade2 = 0;
    fade2Active = true;
    updateMeters();

    toast("데생 완성! 윤곽선이 완성됐습니다");
    document.getElementById("chipDraw").classList.add("done");
    markDirty();
    scheduleAutoPaint();
  }

  function scheduleAutoPaint() {
    clearTimeout(autoPaintTimer);
    autoPaintTimer = setTimeout(() => {
      autoPaintTimer = null;
      if (stage === STAGE.DRAW) enterPaint();
    }, CONFIG.AUTO_DELAY);
  }

  function finishPaint(reason) {
    if (stage !== STAGE.PAINT || paintCompleteQueued) return;
    paintFinishReason = reason;
    paintDepleted = reason === "depleted";
    paintCompleteQueued = true;
    stage = STAGE.RESULT;
    setChips("done");
    triggerPaintComplete(showResult);
  }

  function triggerPaintComplete(cb) {
    const fullyRevealed = paintFinishReason === "complete";
    fade3Active = fullyRevealed;
    toast(
      paintDepleted
        ? "물감이 바닥났어요. 지금 상태로 채점합니다."
        : fullyRevealed
          ? "명화 완성!"
          : "현재 상태로 채점합니다."
    );
    document.getElementById("chipPaint").classList.add("done");
    document.getElementById("chipDone").classList.add("done");
    document.getElementById("finishBtn").style.display = "none";
    markDirty();
    paintCompleteTimer = setTimeout(() => {
      paintCompleteTimer = null;
      cb();
    }, 1400);
  }

  function loop() {
    // 데생 단계에선 '다음 점' 펄스를 위해 매 프레임 다시 그린다(미완성 점이 남아 있을 때만).
    const drawPulse = stage === STAGE.DRAW && fade2 < 1 && nextNodeIdx < contourNodes.length;
    const wrongFlashActive = stage === STAGE.DRAW && wrongFlashNodeIdx >= 0 && Date.now() < wrongFlashUntil;
    const animating = fade2Active || fade3Active || drawPulse || wrongFlashActive;
    if (dirty || animating) {
      render();
      dirty = false;
    }
    requestAnimationFrame(loop);
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = stage === STAGE.DRAW ? "#fffdf8" : "#f3ecda";
    ctx.fillRect(0, 0, W, H);
    if (!layout) return;

    if (fade2Active) {
      fade2 = Math.min(1, fade2 + 1 / 60);
      if (fade2 >= 1) fade2Active = false;
    }
    if (fade3Active) {
      fade3 = Math.min(1, fade3 + 1 / 72);
      if (fade3 >= 1) fade3Active = false;
    }

    const pSketch = placeFor();
    const pColor = placeFor();

    if (stage === STAGE.DRAW) {
      ctx.globalAlpha = 0.24;
      ctx.drawImage(images[IMAGE_ROLE.OUTLINE_GUIDE], pSketch.x, pSketch.y, pSketch.w, pSketch.h);
      ctx.globalAlpha = 1;
      const sketchAlpha = drawCompleteQueued ? fade2 : 0;
      if (sketchAlpha > 0) {
        ctx.globalAlpha = sketchAlpha;
        ctx.drawImage(images[IMAGE_ROLE.SKETCH], pSketch.x, pSketch.y, pSketch.w, pSketch.h);
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(traceLayer, 0, 0);
      drawContourNodes();
      return;
    }

    if ((stage === STAGE.PAINT || stage === STAGE.RESULT) && fade3 < 1) {
      // Scritchy식 구조: 3번 컬러 그림을 아래에 깔고, 2번 선화 종이를 위에 덮는다.
      // scratchCells 누적량만큼 위 종이가 지워져 아래 컬러가 서서히 드러난다.
      ctx.drawImage(images[IMAGE_ROLE.COLOR], pColor.x, pColor.y, pColor.w, pColor.h);
      composeScratchSurfaceLayer(pSketch);
      ctx.globalAlpha = 1 - fade3;
      ctx.drawImage(revealLayer, 0, 0);
      ctx.globalAlpha = 1;
    }

    if (fade3 > 0) {
      ctx.globalAlpha = fade3;
      ctx.drawImage(images[IMAGE_ROLE.COLOR], pColor.x, pColor.y, pColor.w, pColor.h);
      ctx.globalAlpha = 1;
    }
  }

  function composeScratchSurfaceLayer(pSketch) {
    paintScratchBrushLayerFromCells();
    revealCtx.clearRect(0, 0, W, H);
    revealCtx.globalCompositeOperation = "source-over";
    revealCtx.fillStyle = "#ffffff";
    revealCtx.fillRect(0, 0, W, H);
    revealCtx.drawImage(images[IMAGE_ROLE.SKETCH], pSketch.x, pSketch.y, pSketch.w, pSketch.h);
    revealCtx.globalCompositeOperation = "destination-out";
    revealCtx.drawImage(scratchBrushLayer, 0, 0);
    revealCtx.globalCompositeOperation = "source-over";
  }

  function paintScratchBrushLayerFromCells() {
    const data = scratchGridImage.data;
    data.fill(0);

    for (let i = 0; i < scratchCells.length; i++) {
      const progress = Math.min(1, scratchCells[i] / CONFIG.SCRATCH_THRESHOLD);
      if (progress <= 0) continue;
      const offset = i * 4;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = Math.round(progress * 255);
    }

    scratchGridCtx.putImageData(scratchGridImage, 0, 0);
    scratchBrushCtx.clearRect(0, 0, W, H);
    scratchBrushCtx.save();
    scratchBrushCtx.imageSmoothingEnabled = true;
    scratchBrushCtx.filter = `blur(${CONFIG.SCRATCH_SOFT_BLUR}px)`;
    scratchBrushCtx.drawImage(scratchGridLayer, 0, 0, W, H);
    scratchBrushCtx.restore();
  }

  function drawContourNodes() {
    const now = Date.now();
    const s = layout ? Math.max(0.85, Math.min(1.25, layout.w / 520)) : 1;
    const visitedRadius = Math.max(3.6, 5.6 * s);
    const idleRadius = Math.max(5.4, 8.4 * s);
    const nextRadius = Math.max(6.5, 10.5 * s);
    const nextGlow = Math.max(16, 28 * s);
    const wrongRadius = Math.max(8, 11 * s);
    const wrongGlow = Math.max(18, 31 * s);
    for (let i = 0; i < contourNodes.length; i++) {
      const node = contourNodes[i];
      const isNext = i === nextNodeIdx && !node.visited;
      const isWrongFlash = i === wrongFlashNodeIdx && now < wrongFlashUntil;
      if (node.closesLoop && !isNext && !isWrongFlash) continue;

      if (isWrongFlash) {
        const pulse = 0.65 + 0.35 * Math.sin(now / 34);
        ctx.beginPath();
        ctx.arc(node.x, node.y, wrongGlow, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(230,48,35,${0.22 + pulse * 0.22})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(node.x, node.y, wrongRadius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(230,48,35,0.95)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(node.x, node.y, wrongRadius, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255,242,232,0.95)";
        ctx.stroke();
      } else if (node.visited) {
        // 이미 이은 점 — 선을 탔다는 표시만 남긴다.
        ctx.beginPath();
        ctx.arc(node.x, node.y, visitedRadius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(104,78,36,0.58)";
        ctx.fill();
      } else if (isNext) {
        // 다음에 이을 점은 목적지 표시등처럼 더 크게 빛난다.
        const pulse = 0.72 + 0.22 * Math.sin(now / 360);
        ctx.beginPath();
        ctx.arc(node.x, node.y, nextGlow, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245,167,0,${0.22 * pulse})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(node.x, node.y, nextRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245,180,40,${0.82 * pulse + 0.16})`;
        ctx.fill();
        ctx.lineWidth = 1.7;
        ctx.strokeStyle = "rgba(255,247,221,0.9)";
        ctx.stroke();
      } else {
        // 아직 차례가 아닌 점도 또렷하게 보여서 전체 경로를 눈으로 잡을 수 있다.
        ctx.beginPath();
        ctx.arc(node.x, node.y, idleRadius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(28,21,10,0.92)";
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = "rgba(255,250,238,0.82)";
        ctx.stroke();
      }
    }
  }

  function showResult() {
    const revealRatio = getRevealRatio();
    const rawDrawRatio = Math.min(1, completedDrawLoops / DRAW_LOOP_TARGET);
    // 한 호흡 끊김이 많을수록 데생 보너스를 약하게 깎는다("한 번에 쭉" 그리면 더 좋은 점수).
    const breathFactor = Math.max(0.6, 1 - breakCount * CONFIG.BREAK_PENALTY);
    const drawRatio = rawDrawRatio * breathFactor;
    const scratchEff = scratchTotalTouches > 0 ? scratchInsideTouches / scratchTotalTouches : 0;

    const sReveal = Math.round(revealRatio * CONFIG.SCORE_REVEAL);
    const sDraw = Math.round(drawRatio * CONFIG.SCORE_DRAW);
    const sScratch = Math.round(scratchEff * CONFIG.SCORE_SCRATCH);
    const total = Math.min(100, sReveal + sDraw + sScratch);

    document.getElementById("bdFillLbl").textContent = `드러낸 면적 (최대 ${CONFIG.SCORE_REVEAL})`;
    document.getElementById("bdAccuLbl").textContent = `데생(획순) 보너스 (최대 ${CONFIG.SCORE_DRAW})`;
    document.getElementById("bdEffLbl").textContent = `긁기 효율 보너스 (최대 ${CONFIG.SCORE_SCRATCH})`;
    document.getElementById("bdFill").textContent = sReveal;
    document.getElementById("bdAccu").textContent = sDraw;
    document.getElementById("bdEff").textContent = sScratch;
    document.getElementById("scoreVal").textContent = total;

    let grade, title, fb;
    if (total >= 90) {
      grade = "S";
      title = "명작 거장!";
      fb = "테두리는 가볍게 잡고, 긁기는 시원하게 끝냈어요.";
    } else if (total >= 75) {
      grade = "A";
      title = "명화 완성!";
      fb = "좋습니다. 컬러가 꽤 잘 드러났어요.";
    } else if (total >= 55) {
      grade = "B";
      title = "그럴듯한 작품";
      fb = "조금 더 넓게 긁으면 완성감이 확 올라갑니다.";
    } else if (total >= 35) {
      grade = "C";
      title = "습작 단계";
      fb = "핵심 색이 덜 드러났어요. 그림 안쪽을 더 문질러보세요.";
    } else {
      grade = "D";
      title = "다시 도전!";
      fb = "아직 복권을 덜 긁은 상태예요. 컬러가 보일 때까지 쓱쓱 문질러보세요.";
    }
    if (paintDepleted && revealRatio < CONFIG.REVEAL_PASS / 100) {
      title = "물감 부족 미완성";
      fb = "물감이 바닥나서 퀄리티가 떨어진 그림이 됐어요. 붓 성능이나 물감 양을 올리면 더 많이 드러낼 수 있어요.";
    }

    document.getElementById("gradePill").textContent = grade;
    document.getElementById("resultTitle").textContent = title;
    document.getElementById("bdFeedback").textContent =
      `${fb} (드러낸 면적 ${Math.round(revealRatio * 100)}%, 데생 ${Math.round(rawDrawRatio * 100)}%·끊김 ${breakCount}회, 긁기 효율 ${Math.round(scratchEff * 100)}%, 물감 ${paintFinishReason === "depleted" ? "소진" : Math.round((paintLeft / Math.max(1, paintMax)) * 100) + "%"})`;

    buildStars();
    loadSavedReview();
    document.getElementById("result").classList.add("show");
  }

  const REVIEW_KEY = "mewna_proto_d_redesign_review";
  const reviewState = { feel: 0, diff: 0, retry: 0 };

  function buildStars() {
    document.querySelectorAll(".stars").forEach((group) => {
      const key = group.dataset.key;
      group.innerHTML = "";
      for (let i = 1; i <= 5; i++) {
        const s = document.createElement("span");
        s.className = "star";
        s.textContent = "★";
        s.addEventListener("click", () => {
          reviewState[key] = i;
          paintStars(group, i);
        });
        group.appendChild(s);
      }
      paintStars(group, reviewState[key]);
    });
  }

  function paintStars(group, n) {
    [...group.children].forEach((s, idx) => s.classList.toggle("lit", idx < n));
  }

  function loadSavedReview() {
    try {
      const raw = localStorage.getItem(REVIEW_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      reviewState.feel = d.feel || 0;
      reviewState.diff = d.diff || 0;
      reviewState.retry = d.retry || 0;
      document.getElementById("reviewComment").value = d.comment || "";
      buildStars();
    } catch (err) {
      console.warn("저장된 평가를 불러오지 못했습니다:", err);
    }
  }

  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function setChips(which) {
    const d = document.getElementById("chipDraw");
    const p = document.getElementById("chipPaint");
    const f = document.getElementById("chipDone");
    [d, p, f].forEach((chip) => chip.classList.remove("on", "done"));
    if (which === "draw") {
      d.classList.add("on");
    } else if (which === "paint") {
      d.classList.add("done");
      p.classList.add("on");
    } else if (which === "done") {
      d.classList.add("done");
      p.classList.add("done");
      f.classList.add("on");
    }
  }

  function wireSlider(sliderId, valId, key, decimals, onChange) {
    const slider = document.getElementById(sliderId);
    const valEl = document.getElementById(valId);
    function sync() {
      const v = parseFloat(slider.value);
      CONFIG[key] = v;
      valEl.textContent = decimals != null ? v.toFixed(decimals) : v;
      if (onChange) onChange(v);
      markDirty();
    }
    slider.addEventListener("input", sync);
    return { slider, valEl, key, sync };
  }

  const dbgControls = [
    wireSlider("dbgWasteCost", "dvWasteCost", "HIT_RADIUS", 0, () => {
      syncWrongHitRadius();
    }),
    wireSlider("dbgBrushDraw", "dvBrushDraw", "LINE_WIDTH", 0),
    wireSlider("dbgBrushPaint", "dvBrushPaint", "BRUSH_SCRATCH", 0),
    wireSlider("dbgTraceGain", "dvTraceGain", "SCRATCH_POWER", 0, () => {
      if (stage === STAGE.PAINT) {
        resetScratchState();
        updateMeters();
      }
    }),
    wireSlider("dbgPaintReserve", "dvPaintReserve", "PAINT_RESERVE", 0, () => {
      if (stage === STAGE.PAINT) {
        resetScratchState();
        updateMeters();
      }
    }),
    wireSlider("dbgAutoDelay", "dvAutoDelay", "AUTO_DELAY", 0),
    wireSlider("dbgScoreFill", "dvScoreFill", "REVEAL_PASS", 0, () => { if (stage === STAGE.PAINT) updateMeters(); }),
  ];

  const hitRadiusSlider = document.getElementById("dbgWasteCost");
  hitRadiusSlider.value = CONFIG.HIT_RADIUS;
  document.getElementById("dvWasteCost").textContent = CONFIG.HIT_RADIUS;
  const hitRadiusPanel = hitRadiusSlider.closest(".dbg-item");
  const hitRadiusLabel = hitRadiusPanel?.querySelector(".dbg-lbl span");
  const hitRadiusHelp = hitRadiusPanel?.querySelector(".dbg-cap");
  if (hitRadiusLabel) hitRadiusLabel.textContent = "점 통과 반경 (HIT_RADIUS)";
  if (hitRadiusHelp) hitRadiusHelp.textContent = "다음 점 근처 이 거리 안에 들어오면 통과예요. 클수록 쉽게 잡혀요.";

  function toggleDebugPanel() {
    const panel = document.getElementById("debugPanel");
    const isOpen = panel.classList.toggle("open");
    panel.setAttribute("aria-hidden", isOpen ? "false" : "true");
  }

  function isTypingTarget(target) {
    return target && (
      target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT"
    );
  }

  document.getElementById("startBtn").addEventListener("click", beginGame);
  document.getElementById("skipDrawBtn").addEventListener("click", enterPaint);
  document.getElementById("finishBtn").addEventListener("click", () => {
    if (stage !== STAGE.PAINT) return;
    finishPaint("manual");
  });
  document.getElementById("redrawBtn").addEventListener("click", restartGame);
  document.getElementById("saveReview").addEventListener("click", () => {
    const payload = {
      ...reviewState,
      comment: document.getElementById("reviewComment").value,
      score: document.getElementById("scoreVal").textContent,
      ts: new Date().toISOString(),
    };
    try {
      localStorage.setItem(REVIEW_KEY, JSON.stringify(payload));
      const tag = document.getElementById("savedTag");
      tag.classList.add("show");
      setTimeout(() => tag.classList.remove("show"), 2500);
    } catch (err) {
      console.warn("평가 저장 실패:", err);
    }
  });

  document.getElementById("dbgReset").addEventListener("click", () => {
    Object.assign(CONFIG, CONFIG_DEFAULTS);
    document.getElementById("dbgWasteCost").value = CONFIG.HIT_RADIUS;
    document.getElementById("dbgBrushDraw").value = CONFIG.LINE_WIDTH;
    document.getElementById("dbgBrushPaint").value = CONFIG.BRUSH_SCRATCH;
    document.getElementById("dbgTraceGain").value = CONFIG.SCRATCH_POWER;
    document.getElementById("dbgPaintReserve").value = CONFIG.PAINT_RESERVE;
    document.getElementById("dbgAutoDelay").value = CONFIG.AUTO_DELAY;
    document.getElementById("dbgScoreFill").value = CONFIG.REVEAL_PASS;
    dbgControls.forEach((c) => c.sync());
    if (stage === STAGE.PAINT) resetScratchState();
    updateMeters();
  });

  canvas.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  canvas.addEventListener("mouseenter", onEnter);
  canvas.addEventListener("mouseleave", onLeave);
  canvas.addEventListener("touchstart", onDown, { passive: false });
  canvas.addEventListener("touchmove", onMove, { passive: false });
  window.addEventListener("touchend", onUp);
  window.addEventListener("touchcancel", onUp);
  window.addEventListener("keydown", (e) => {
    const key = e.key ? e.key.toLowerCase() : "";
    if (key !== "d" || e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target)) return;
    e.preventDefault();
    toggleDebugPanel();
  });

  loadImages();
})();
