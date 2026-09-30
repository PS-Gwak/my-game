/*
  뮤나리자 그리기 실험 — 6개 시안 공통 틀 (동작)

  6개 시안이 똑같이 움직이도록 공통 동작을 한곳에 모았다. 게임 규칙은 건드리지 않는다.
  - 시작 카드: 들어오면 보여 주고, 읽는 동안에는 뒤쪽 화면을 잠근다(클릭·Tab 키 모두).
  - 손맛 조절(개발용) 창: 아랫줄 ⚙ 버튼이나 단축키 D(한글 입력 중이면 ㅇ)로 열고 닫는다.
  - 조작 배지: 그림 옆에서 지금 할 동작을 움직이는 아이콘 + 한 줄로 알려 준다.
      알려 준 대로 조작하는 동안은 흐려지고(방해 안 되게), 멈추거나 반대로 하면 다시 또렷해진다.
  - 완성 배지: '다시 그리기'와 '다음 시안 →' 버튼을 보여 준다.

  각 시안에서 쓰는 법:
    MewnaFrame.init({
      coachAnchor: 그림 틀 요소(position: relative 여야 함),
      coachSide: "right" 또는 "left" (기본 오른쪽),
      coachLimit: () => [배지가 넘어가면 안 되는 옆 요소들],   // 선택
      coachFallback: "dock" 또는 "inside",   // 그림 옆 자리가 모자랄 때: 아랫줄로 옮김(기본) / 받침 안쪽에 둠(그 자리를 비워 둔 시안만)
      next: { href: "../다음시안/index.html", label: "다음 시안 →" },
      onRedraw: () => { 다시 그리기 },                          // 완성 배지 버튼용
      onTuningToggle: (열림) => { 조절판 열고 닫을 때 추가로 할 일 },  // 선택
      onStart: () => { 시작하기 누른 뒤 할 일 },                  // 선택
    });
    MewnaFrame.setCoach("상태이름", { icon: "tap", title: "…", sub: "…", done: false });
    MewnaFrame.activity(true/false);   // 조작할 때마다: 알려 준 대로 하고 있으면 true
    MewnaFrame.wake();                 // 배지를 바로 또렷하게
    MewnaFrame.isIntroOpen();          // 시작 카드가 떠 있으면 true — 이때는 게임 입력을 무시할 것
*/
(function () {
  "use strict";

  const GOLD = "#f5a700";
  const GOLD_SOFT = "#f0c674";

  // 마우스 몸통(휠 포함) — 휠 아이콘 두 개가 같이 쓴다
  const MOUSE =
    `<rect x="18" y="4" width="28" height="44" rx="14" fill="none" stroke="${GOLD_SOFT}" stroke-width="3"/>` +
    `<line x1="32" y1="4" x2="32" y2="20" stroke="${GOLD_SOFT}" stroke-width="2"/>` +
    `<rect x="29" y="10" width="6" height="10" rx="3" fill="${GOLD}"/>`;

  // 손가락 대신 쓰는 마우스 화살표 모양
  const CURSOR = (x, y) =>
    `<path d="M${x} ${y} l0 30 l7 -7 l5 11 l5 -2 l-5 -11 l10 0 z" fill="${GOLD_SOFT}" stroke="#1a1206" stroke-width="1.5" stroke-linejoin="round"/>`;

  // 아이콘 모음 (모두 가로 64 × 세로 80 칸에 그림)
  const ICONS = {
    "wheel-down":
      MOUSE +
      `<path class="mf-anim-down" d="M32 56 V72 M24 65 L32 73 L40 65" fill="none" stroke="${GOLD}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    "wheel-up":
      MOUSE +
      `<path class="mf-anim-up" d="M32 73 V57 M24 64 L32 56 L40 64" fill="none" stroke="${GOLD}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    // 톡톡 누르기: 화살표 끝에서 물결이 퍼진다
    tap:
      `<circle class="mf-anim-pulse" cx="26" cy="22" r="12" fill="none" stroke="${GOLD}" stroke-width="2.5"/>` +
      `<g class="mf-anim-tap">${CURSOR(26, 22)}</g>`,
    // 점 잇기: 점선이 흐르며 점들을 이어 간다
    connect:
      `<path class="mf-anim-dash" d="M10 64 L30 20 L54 52" fill="none" stroke="${GOLD}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="10" cy="64" r="5" fill="${GOLD_SOFT}"/><circle cx="30" cy="20" r="5" fill="${GOLD_SOFT}"/><circle cx="54" cy="52" r="5" fill="${GOLD}"/>`,
    // 문질러 칠하기: 붓이 좌우로 오가며 물감이 번진다
    rub:
      `<path d="M8 60 C18 48 26 70 36 58 S52 50 58 60" fill="none" stroke="${GOLD}" stroke-width="7" stroke-linecap="round" opacity="0.55"/>` +
      `<g class="mf-anim-tap"><rect x="36" y="10" width="9" height="30" rx="3" fill="${GOLD_SOFT}" transform="rotate(35 40 25)"/><path d="M30 38 l8 6 l-6 8 l-8 -6 z" fill="${GOLD}"/></g>`,
    // 원 그리기: 화살표가 원을 따라 돈다
    circle:
      `<circle cx="32" cy="36" r="22" fill="none" stroke="${GOLD_SOFT}" stroke-width="2.5" opacity="0.45"/>` +
      `<g class="mf-anim-spin"><path d="M32 14 A22 22 0 0 1 54 36" fill="none" stroke="${GOLD}" stroke-width="4" stroke-linecap="round"/><path d="M54 28 L54 38 L45 35" fill="none" stroke="${GOLD}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>` +
      `<circle cx="32" cy="36" r="4" fill="${GOLD}"/>`,
    // 팔레트 누르기
    palette:
      `<path d="M30 8 C12 8 4 22 6 36 C8 50 20 56 28 52 C34 49 30 42 36 40 C44 38 54 44 58 34 C62 20 48 8 30 8 Z" fill="none" stroke="${GOLD_SOFT}" stroke-width="3"/>` +
      `<circle cx="20" cy="22" r="4" fill="#e06868"/><circle cx="34" cy="18" r="4" fill="#5b9be0"/><circle cx="46" cy="26" r="4" fill="#6fbf6f"/><circle cx="18" cy="38" r="4" fill="#e8c84a"/>` +
      `<circle class="mf-anim-pulse" cx="40" cy="44" r="9" fill="none" stroke="${GOLD}" stroke-width="2.5"/>` +
      `<g class="mf-anim-tap">${CURSOR(40, 44)}</g>`,
    // 누르고 있기(시작하기 버튼 등): 화살표가 버튼을 누른다
    button:
      `<rect x="8" y="24" width="48" height="22" rx="7" fill="none" stroke="${GOLD}" stroke-width="3"/>` +
      `<g class="mf-anim-tap">${CURSOR(34, 36)}</g>`,
    flag:
      `<path d="M18 76 V8" stroke="${GOLD_SOFT}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M20 10 H52 L43 24 L52 38 H20 Z" fill="${GOLD}"/>`,
  };

  function iconSvg(name) {
    const body = ICONS[name];
    if (!body) return "";
    return `<svg viewBox="0 0 64 80" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  const MF = {};
  let opts = {};
  let coachEl = null;
  let coachIcoEl = null;
  let coachTitleEl = null;
  let coachSubEl = null;
  let coachRedrawEl = null;
  let coachState = "";
  let coachText = "";
  let coachDone = false;
  let quietTimer = null;
  let tuneToggleEl = null;
  let behindIntro = [];

  MF.icon = iconSvg;

  MF.isIntroOpen = function () {
    return document.body.classList.contains("mf-intro-open");
  };

  // ── 조작 배지 ──
  function buildCoach() {
    if (!opts.coachAnchor) return;
    coachEl = document.createElement("div");
    coachEl.className = "mf-coach" + (opts.coachSide === "left" ? " left" : "");
    coachEl.setAttribute("aria-live", "polite");
    coachEl.setAttribute("tabindex", "-1"); // 시작 직후 키보드 초점을 받아 안내를 읽어 줄 수 있게
    coachEl.innerHTML =
      '<div class="mf-coach-ico"></div>' +
      '<div class="mf-coach-text"><b></b><span class="mf-coach-sub"></span>' +
      '<div class="mf-coach-actions">' +
      '<button class="mf-btn ghost" type="button" data-mf-redraw>다시 그리기</button>' +
      (opts.next ? `<a class="mf-btn" href="${opts.next.href}">${opts.next.label}</a>` : "") +
      "</div></div>";
    coachIcoEl = coachEl.querySelector(".mf-coach-ico");
    coachTitleEl = coachEl.querySelector("b");
    coachSubEl = coachEl.querySelector(".mf-coach-sub");
    coachRedrawEl = coachEl.querySelector("[data-mf-redraw]");
    if (opts.onRedraw) {
      coachRedrawEl.addEventListener("click", () => opts.onRedraw());
    } else {
      coachRedrawEl.remove();
    }
    opts.coachAnchor.appendChild(coachEl);
  }

  // 상태가 바뀌었을 때만 글과 아이콘을 바꾼다. 바뀌면 바로 또렷하게 보여 준다.
  MF.setCoach = function (state, cfg) {
    if (!coachEl) return false;
    cfg = cfg || {};
    const text = (cfg.title || "") + "|" + (cfg.sub || "");
    if (state === coachState) {
      // 같은 상태인데 문구만 달라졌으면(예: 조절판에서 목표 수치 변경) 글만 조용히 바꾼다
      if (text !== coachText) {
        coachText = text;
        coachTitleEl.textContent = cfg.title || "";
        coachSubEl.textContent = cfg.sub || "";
        coachSubEl.style.display = cfg.sub ? "" : "none";
      }
      return false;
    }
    coachState = state;
    coachText = text;
    coachDone = !!cfg.done;
    coachEl.classList.toggle("done", coachDone);
    coachIcoEl.innerHTML = cfg.icon ? iconSvg(cfg.icon) : "";
    coachIcoEl.style.display = cfg.icon && !coachDone ? "" : "none";
    coachTitleEl.textContent = cfg.title || "";
    coachSubEl.textContent = cfg.sub || "";
    coachSubEl.style.display = cfg.sub ? "" : "none";
    MF.wake();
    placeCoach();
    return true;
  };

  // 알려 준 대로 조작하는 중이면 흐리게, 손을 멈추고 2.5초 지나면 다시 또렷하게.
  // 반대로 조작하면 바로 또렷하게 — 방향을 바꿔야 할 때 안내가 안 보이면 안 되므로.
  MF.activity = function (rightWay) {
    if (!coachEl || coachDone) return;
    clearTimeout(quietTimer);
    if (rightWay) {
      coachEl.classList.add("quiet");
      quietTimer = setTimeout(() => coachEl.classList.remove("quiet"), 2500);
    } else {
      coachEl.classList.remove("quiet");
    }
  };

  MF.wake = function () {
    if (!coachEl) return;
    clearTimeout(quietTimer);
    coachEl.classList.remove("quiet");
  };

  // 배지를 아랫줄 맨 위 칸으로 옮기기 / 그림 옆으로 되돌리기
  function dockCoach() {
    const footer = document.querySelector(".mf-footer");
    if (!footer) {
      coachEl.classList.add("inside");
      return;
    }
    if (coachEl.parentElement !== footer) footer.insertBefore(coachEl, footer.firstChild);
    coachEl.classList.add("docked");
    footer.classList.add("mf-has-coach");
  }
  function undockCoach() {
    if (coachEl.parentElement !== opts.coachAnchor) opts.coachAnchor.appendChild(coachEl);
    coachEl.classList.remove("docked", "inside");
    const footer = document.querySelector(".mf-footer");
    if (footer) footer.classList.remove("mf-has-coach");
  }

  // 그림 옆에 자리가 모자라면 배지를 옮긴다.
  // 기본은 아랫줄 맨 위 칸 — 배지가 그림을 덮어 가리지 않게 하기 위해서다(겹침 금지 원칙).
  // 먼저 그림 옆으로 되돌려 놓고 잰 뒤 정하므로, 옮기고 되돌리기를 반복하며 흔들리지 않는다.
  function placeCoach() {
    if (!coachEl || !opts.coachAnchor) return;
    // 배지 안 버튼(예: 완성 배지의 '다음 시안')에 키보드 초점이 있었다면, 옮긴 뒤 되살린다
    const focused = coachEl.contains(document.activeElement) ? document.activeElement : null;
    placeCoachInner();
    if (focused && document.activeElement !== focused) focused.focus({ preventScroll: true });
  }
  function placeCoachInner() {
    undockCoach();
    const a = opts.coachAnchor.getBoundingClientRect();
    if (!a.width) return;
    const w = coachEl.offsetWidth || 200;
    const limits = (opts.coachLimit ? opts.coachLimit() : [])
      .filter((el) => el && el.offsetParent !== null)
      .map((el) => el.getBoundingClientRect());
    let inside;
    // 옆 장애물(예: 손맛 조절 창)은 배지 쪽으로 걸쳐 있기만 해도 한계로 본다.
    // (장애물이 그림 끝보다 살짝 안쪽에서 시작해도 놓치지 않도록)
    if (opts.coachSide === "left") {
      const leftLimit = Math.max(0, ...limits.filter((r) => r.left < a.left + 1).map((r) => r.right));
      inside = a.left - 22 - w - 12 < leftLimit;
    } else {
      const rightLimit = Math.min(window.innerWidth, ...limits.filter((r) => r.right > a.right - 1).map((r) => r.left));
      inside = a.right + 22 + w + 12 > rightLimit;
    }
    if (!inside) return;
    if (opts.coachFallback === "inside") coachEl.classList.add("inside");
    else dockCoach();
  }
  MF.placeCoach = placeCoach;

  // ── 손맛 조절(개발용) 창 ──
  function toggleTuning(force) {
    const panels = [...document.querySelectorAll("[data-mf-tuning]")];
    const hadFocus = panels.some((p) => p.contains(document.activeElement));
    const open = typeof force === "boolean" ? force : !document.body.classList.contains("mf-tuning-open");
    document.body.classList.toggle("mf-tuning-open", open);
    if (tuneToggleEl) tuneToggleEl.setAttribute("aria-expanded", String(open));
    // 조절판 안을 만지다 닫으면 키보드 초점이 허공에 뜨지 않게 ⚙ 버튼으로 돌려준다
    if (!open && hadFocus && tuneToggleEl) tuneToggleEl.focus();
    if (opts.onTuningToggle) opts.onTuningToggle(open);
    placeCoach();
  }
  MF.toggleTuning = toggleTuning;

  // ── 시작 카드 ──
  function setupIntro() {
    const intro = document.getElementById("mfIntro");
    const startBtn = document.getElementById("mfStart");
    if (!intro || !startBtn) return;
    document.body.classList.add("mf-intro-open");
    // 시작 카드와 '불러오는 중' 안내(data-mf-keep)만 남기고 뒤쪽 화면을 잠근다
    behindIntro = [...document.body.children].filter(
      (el) => el !== intro && !el.hasAttribute("data-mf-keep") && el.tagName !== "SCRIPT" && el.tagName !== "STYLE"
    );
    behindIntro.forEach((el) => { el.inert = true; });
    startBtn.focus();
    startBtn.addEventListener("click", () => {
      document.body.classList.remove("mf-intro-open");
      behindIntro.forEach((el) => { el.inert = false; });
      if (opts.onStart) opts.onStart();
      placeCoach();
      // 사라진 시작 버튼에 초점이 남지 않게, 지금 할 일을 알려 주는 배지로 옮긴다
      if (coachEl) coachEl.focus({ preventScroll: true });
      else document.body.focus();
    });
  }

  MF.init = function (options) {
    opts = options || {};

    // [data-mf-icon="이름"] 자리에 아이콘을 채운다 (시작 카드 단계 아이콘 등)
    document.querySelectorAll("[data-mf-icon]").forEach((el) => {
      el.innerHTML = iconSvg(el.getAttribute("data-mf-icon"));
    });

    buildCoach();

    tuneToggleEl = document.getElementById("mfTuneToggle");
    if (tuneToggleEl) {
      tuneToggleEl.setAttribute("aria-expanded", "false");
      tuneToggleEl.addEventListener("click", () => toggleTuning());
    }

    // 단축키 D로 손맛 조절 창 열고 닫기. 한글 입력 상태의 ㅇ도 같은 자리 키라 함께 받는다.
    // 시작 카드가 떠 있을 때, ⌘·Ctrl·Alt 조합(예: ⌘+D 북마크), 꾹 누르고 있을 때, 글자 입력 칸에서는 무시한다.
    window.addEventListener("keydown", (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (MF.isIntroOpen()) return;
      const t = event.target;
      if (t && (t.isContentEditable || t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && t.type !== "range" && t.type !== "checkbox"))) return;
      const isDKey = event.code === "KeyD" || event.key === "d" || event.key === "D" || event.key === "ㅇ";
      if (!isDKey) return;
      event.preventDefault();
      toggleTuning();
    });

    window.addEventListener("resize", placeCoach);
    setupIntro();
  };

  window.MewnaFrame = MF;
})();
