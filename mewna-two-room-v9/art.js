// 뮤나리자 B 플레이 데모 — 픽셀 아트 (이모지 전면 금지, 전부 자체 제작 캔버스).
// 출처 구분:
//  · 빨간 회전식 전화기 / 빨간 수화기 / 원작 3종 / 흰 도화지
//    = phone-guided-ui-variants-2026-08-06/shared/art.js에서 이어받은 이 시안군 전용 아트.
//  · 흰색 클린 창문 B(하늘 유리·흰 창틀·오염층)
//    = show-window-print-feedback-v3-2026-08-04/index.html의 「B. 흰색 클린 창문」과
//      0/5→5/5 오염 제거 그리기를 이식. (A 검은 프레임은 쓰지 않는다.)
//  · V6 인쇄 그림 = 정본 2026-07-21-squeegee-v6.html의 V6_PIXEL_ART/V6_PLATE_COLORS 이식본.
//  · 카탈로그 책자 = 이 폴더에서 새로 그린 전용 픽셀 아트 (레퍼런스 표면 복사 아님).
"use strict";

(function (root) {
  // ── 공용: 문자 격자 → 캔버스 픽셀 아트 ──────────────────────────
  function drawPixelArt(canvas, rows, colors, scale) {
    const context = canvas && canvas.getContext ? canvas.getContext("2d") : null;
    if (!context) return false;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, canvas.width, canvas.height);
    rows.forEach(function (row, y) {
      for (let x = 0; x < row.length; x += 1) {
        const key = row[x];
        if (key === "." || !colors[key]) continue;
        context.fillStyle = colors[key];
        context.fillRect(x * scale, y * scale, scale, scale);
      }
    });
    return true;
  }

  // ── 큰 빨간 회전식 전화기 (24×20 격자 × 8배 = 192×160) ──────────
  const PHONE_ART = [
    "........................",
    "..kkkk..........kkkk....",
    ".khhhhk........khhhhk...",
    ".khhhhhkkkkkkkkhhhhhk...",
    ".khhhhhhhhhhhhhhhhhhk...",
    "..khhhhhhhhhhhhhhhhk....",
    "...kkkkkkkkkkkkkkkk.....",
    "......krrrrrrrrrrk......",
    ".....krrrrrrrrrrrrk.....",
    ".....krrrkkkkkkrrrk.....",
    "....krrkwwwwwwwwkrrk....",
    "....krrkwgwwwwgwkrrk....",
    "...krrrkwwwwwwwwkrrrk...",
    "...krrrkwgwwwwgwkrrrk...",
    "...krrrkwwwwwwwwkrrrk...",
    "..krrrrrkwgwwgwkrrrrrk..",
    "..krrrrrrkkkkkkrrrrrrk..",
    ".krrrrrrrrrrrrrrrrrrrrk.",
    ".kddddddddddddddddddddk.",
    ".kkkkkkkkkkkkkkkkkkkkkk.",
  ];
  const PHONE_COLORS = {
    k: "#2a1114", h: "#e5484d", r: "#c92a33", d: "#8f1d24", w: "#f3e7d0", g: "#3a2a24",
  };
  function drawRotaryPhone(canvas) {
    return drawPixelArt(canvas, PHONE_ART, PHONE_COLORS, 8);
  }

  // ── 큰 빨간 수화기 (전화 대화상자 오른쪽, 22×7 × 8배 = 176×56) ──
  const RECEIVER_ART = [
    "..kkkk..........kkkk..",
    ".khhhhk........khhhhk.",
    ".khhhhhkkkkkkkkhhhhhk.",
    ".khhhhhhhhhhhhhhhhhhk.",
    ".kddhhhhhhhhhhhhhhddk.",
    "..kddhhhhhhhhhhhhddk..",
    "...kkkkkkkkkkkkkkkk...",
  ];
  function drawReceiver(canvas) {
    return drawPixelArt(canvas, RECEIVER_ART, PHONE_COLORS, 8);
  }

  // ── 카탈로그 책자 (16×16 × 8배 = 128×128 — 이 폴더 신규 아트) ──
  // 첫 전화 뒤 위에서 떨어지는 「물건」. 금색 표지에 뮤나리자 초상 창이 나 있다.
  const CATALOG_ART = [
    "................",
    ".kkkkkkkkkkkkk..",
    ".kggggggggggkw..",
    ".kgssssssssgkw..",
    ".kgsffffffsgkw..",
    ".kgsffddffsgkw..",
    ".kgsffffffsgkw..",
    ".kgsfbbbbfsgkw..",
    ".kgsbbbbbbsgkw..",
    ".kgssssssssgkw..",
    ".kggggggggggkw..",
    ".kgttttttttgkw..",
    ".kggggggggggkw..",
    ".kkkkkkkkkkkkw..",
    "..wwwwwwwwwwww..",
    "................",
  ];
  const CATALOG_COLORS = {
    k: "#3a2c14", g: "#d8b046", s: "#f3e7c8", f: "#d9a066",
    d: "#2b211b", b: "#6b4a2f", w: "#f6f1e2", t: "#8a6f3c",
  };
  function drawCatalog(canvas) {
    return drawPixelArt(canvas, CATALOG_ART, CATALOG_COLORS, 8);
  }

  // ── V6 인쇄 그림 정본 (원작 ①: 뮤나리자) ────────────────────────
  const V6_PIXEL_ART = [
    "................",
    "..f..........f..",
    "..ff........ff..",
    "..fff......fff..",
    "..ffffffffffff..",
    "..ffffffffffff..",
    "..ffddffffddff..",
    "..ffffffffffff..",
    "..ffffdddfffff..",
    "...ffffffffff...",
    "....bbbbbbbb....",
    "...bbbbbbbbbb...",
    "..bbbbbbbbbbbb..",
    "..bbbbbbbbbbbb..",
    "..bbbffffffbbb..",
    "..bbbbbbbbbbbb..",
  ];
  const V6_PLATE_COLORS = { ".": "#3f5a4d", b: "#6b4a2f", f: "#d9a066", d: "#2b211b" };

  // ── 원작 ②: 해바라기 ──
  const SUNFLOWER_ART = [
    "bbbbbyyyybbbbbbb",
    "bbbyyyyyyyybbbbb",
    "bbyyynnnnyyybbbb",
    "byyynnnnnnyyybbb",
    "byyynnnnnnyyybbb",
    "bbyyynnnnyyybbbb",
    "bbbyyyyyyyybbbbb",
    "bbbbbbggbbbbbbbb",
    "bbbbbbggbbbbbbbb",
    "bbbllggllbbbbbbb",
    "bbbbbbggbbbbbbbb",
    "bbbbbbggbbbbbbbb",
    "bbbbbbggbbbbbbbb",
    "tttttttttttttttt",
    "tttttttttttttttt",
    "tttttttttttttttt",
  ];
  const SUNFLOWER_COLORS = {
    b: "#2e4a6b", y: "#efc85b", n: "#6b4a2f", g: "#3f6b3a", l: "#5d8a45", t: "#8a6a44",
  };

  // ── 원작 ③: 진주 고양이 ──
  const PEARL_CAT_ART = [
    "ddddkudddukddddd",
    "ddddduuuuudddddd",
    "dddduuuuuuuddddd",
    "ddduuuffffuudddd",
    "ddduuffffffuuddd",
    "dddduffkfkfudddd",
    "dddduffffffudddd",
    "dddddffffddddddd",
    "ddddyyyyyydddddd",
    "dddyyyyyyyypdddd",
    "ddyyyyyyyyyydddd",
    "ddyyyyyyyyyydddd",
    "dyyyyyyyyyyyyddd",
    "dyyyyyyyyyyyyddd",
    "dddddddddddddddd",
    "dddddddddddddddd",
  ];
  const PEARL_CAT_COLORS = {
    d: "#241f1c", u: "#3a6ea5", y: "#c9a227", f: "#d9a066", k: "#1a1512", p: "#f2efe4",
  };

  // ══ 2026-10-12 v5 · 원작을 원래 그림 비율로 (형님 31-A · 33-A · 34-A) ═══════════
  // 긴 쪽은 지금과 같은 16칸, 짧은 쪽만 원작 비율로 줄였다(지금 16×16 틀 안에 쏙).
  // 진주 고양이 · 키스는 원작이 정사각형에 가까워 16×16 그대로다.
  // 위 V6 · 해바라기 그림(16×16)은 v4까지의 정본 기록으로 남기고, 게임은 아래 새 비율판을 쓴다.
  // 그림 출처: docs/plans/2026-10-06-mewna-two-room-demo/workshop-economy-2026-10-12/new-originals/round2/opus_round2.py
  //   뮤나리자 · 해바라기 = 지금 게임 그림에서 옆만 덜어 냄 / 별이 빛나는 밤 · 절규 = 형님이 고른 오푸스 1차에서 덜어 냄 /
  //   키스 = 오푸스 2차(형님 35-A 확정).
  const MEWNA_ART_V5 = [
    "...........",
    ".f.......f.",
    ".ff.....ff.",
    ".fff...fff.",
    ".fffffffff.",
    ".fffffffff.",
    ".ffdfffdff.",
    ".fffffffff.",
    ".ffffdddff.",
    "..fffffff..",
    "...bbbbb...",
    "..bbbbbbb..",
    ".bbbbbbbbb.",
    ".bbbbbbbbb.",
    ".bbbffffbb.",
    ".bbbbbbbbb.",
  ]; // 11×16
  const SUNFLOWER_ART_V5 = [
    "bbbbyyyyybbbb",
    "bbyyyyyyyyybb",
    "byyynnnnnyyyb",
    "byynnnnnnnyyb",
    "byynnnnnnnyyb",
    "byyynnnnnyyyb",
    "bbyyyyyyyyybb",
    "bbbbyyyyybbbb",
    "bbbbbbggbbbbb",
    "bbbbbbggbbbbb",
    "bbbbllggllbbb",
    "bbbbbbggbbbbb",
    "bbbbbbggbbbbb",
    "ttttttttttttt",
    "ttttttttttttt",
    "ttttttttttttt",
  ]; // 13×16
  // ── 원작 ④: 별이 빛나는 밤 (16×13) — 소용돌이 밤하늘 · 노란 달 · 왼쪽 사이프러스 · 오른쪽 아래 검은 고양이 ──
  const STARRY_ART = [
    "kkskkkkkkkkkkyyk",
    "ksswskkykkkkyyyy",
    "kykkkswwsskkkyyk",
    "kckkkkswwwsskkkk",
    "kcckkkkksswwskyk",
    "kcckykkkkkkswskk",
    "ccccsskkkkkkskkk",
    "ccccwwsskkksswss",
    "cccchhssswwchchh",
    "cchhhhhhhhhccchh",
    "chhyhhvhhhhckchh",
    "chhhvhhhyhccccvh",
    "vvvvvvyvvvvcccvv",
  ];
  const STARRY_COLORS = { k: "#1d2a4f", s: "#3e6fb0", w: "#9cc3e6", y: "#f2d45c", c: "#14180f", v: "#2b3a5a", h: "#4a5f7a" };
  // ── 원작 ⑤: 절규 (13×16) — 주황 · 빨강 하늘 · 파란 피오르 · 사선 다리 · 볼 감싼 고양이 ──
  const SCREAM_ART = [
    "oooyyooooorro",
    "yyyoooorrrooo",
    "ooorrrooooyyo",
    "rroooooyyyooo",
    "oyyyooooooobb",
    "boooooobbbbbb",
    "bbbbfbbbfbbbb",
    "bbbbffffffbbb",
    "bbbhfdffdfhbb",
    "wbbhffffffhbb",
    "wwbhfffdffhbb",
    "bwwbhffdffhbb",
    "bbwwhhfffhhbb",
    "bbbwhhhhhhwww",
    "bbbwwhhhhwwww",
    "bbbbwwwwwwwww",
  ];
  const SCREAM_COLORS = { o: "#e07a2e", r: "#b8402a", y: "#e8b04a", b: "#2f4f7a", f: "#e3d3a8", d: "#2a2230", h: "#3a2f2a", w: "#8a6a44" };
  // ── 원작 ⑥: 키스 (16×16) — 청동빛 바탕 · 종 모양 금빛 망토 · 기댄 고양이 둘 · 꽃밭 ──
  const KISS_ART = [
    "gggggggggggggggg",
    "gggggngngggggggg",
    "ggggggnnnffgfggg",
    "gggggnnknfffffgg",
    "ggggynnnffkfkfgg",
    "gggyyynyyffffggg",
    "gggykyyyyyyypggg",
    "ggyytyyyyybyyggg",
    "ggyykyyyypyyyygg",
    "ggyytyyyyyybyygg",
    "gyyykyyyypyyyygg",
    "gyyytyyyyyyybygg",
    "gyyykyyyyypyyygg",
    "mmyyyyyyyyyyyymm",
    "mpmmpmmyymmmpmpm",
    "mmmpmmpmmmpmmmmm",
  ];
  const KISS_COLORS = { g: "#9a7a2a", y: "#e6c14a", k: "#1a1512", t: "#efe8d2", n: "#5a3a22", f: "#e0a874", p: "#c25a5a", b: "#3a6ea5", m: "#4f7a3a" };

  // ══ 2026-10-16 v6 · 원작을 다시 모두 정사각형(16×16)으로 (형님 메모 #2740 9번 · 42-A) ═══════════
  // 여백이 남는 그림이 보기 좋지 않아 원작은 우선 모두 정사각형에 맞춘다(10/12 31-A 「원래 비율」 대체).
  // 비유: 액자 대지를 없애고 그림을 액자 끝까지 채운다. 위 v5 원래 비율판은 기록으로만 남긴다(게임은 안 씀).
  // 그림 출처: docs/plans/2026-10-06-mewna-two-room-demo/workshop-economy-2026-10-12/new-originals/round3/opus_round3.py
  //   · 뮤나리자 = v4까지 쓰던 정본(V6_PIXEL_ART)으로 롤백
  //   · 별이 빛나는 밤 = v5 그림 위에 하늘 2줄, 아래에 땅 1줄을 이어 그림(새로 그리지 않음)
  //   · 절규 = v5 그림 왼쪽 1칸 · 오른쪽 2칸을 이어 그림(하늘 띠 · 피오르 · 다리 연장)
  //   · 해바라기 = 원작 구도로 다시 그림(아래 「해바라기 고르기」 한 줄)
  //   · 진주 고양이 · 키스 = 이미 16×16이라 그대로
  const STARRY_ART_V6 = [
    "kkkkkkkkykkkkkkk", // 새 줄 — 별 하나
    "kkkskkkkkkswskkk", // 새 줄 — 작은 소용돌이 끝자락
  ].concat(STARRY_ART, [
    "vvvvvvvvvvccccvv", // 새 줄 — 땅 · 고양이 몸 아래
  ]);
  const SCREAM_ART_V6 = (function () {
    const left = "oyorobbbwwbbbbbb"; // 새 왼쪽 1칸(위 → 아래) — 하늘 띠 · 피오르, 사선 다리는 두 줄 위까지 이어진다
    const right = ["oy", "oo", "oo", "rr", "bb", "bb", "bb", "bb", "bb", "bb", "bb", "bb", "bb", "ww", "ww", "ww"];
    return SCREAM_ART.map(function (row, y) { return left[y] + row + right[y]; });
  }());

  // ── 해바라기 고르기 (형님 질문 44 — 오푸스/페이블) ──────────────────────────
  // 두 판은 색 키를 똑같이 맞춰 두었다(w 벽 · t 탁자 · v 꽃병 · o 테두리 · u 파란 띠 · p 꽃잎 · n 꽃 가운데 · g 줄기).
  // 그래서 인쇄 판 나누기(engine.js PLATE_GROUPS.sunflower)는 어느 쪽이든 그대로다.
  // 주의 — 44번 답에 따라 교체: 아래 SUNFLOWER_PICK 한 줄만 SUNFLOWER_OPUS_V6 ↔ SUNFLOWER_FABLE_V6 로 바꾼다.
  const SUNFLOWER_OPUS_V6 = Object.freeze({
    fill: "#efd98a",
    colors: {
      w: "#efd98a", t: "#cf8a2e", v: "#e3a83c", o: "#8a5a24", u: "#3a6ea5",
      p: "#f0a21e", n: "#6b3f1c", g: "#5d7a35",
    },
    art: [
      "wwwwwwwpppwwwwww",
      "wwwwwwwpnpwwwwww",
      "wwwpppwpppwwwwww",
      "wwwpnpwwgwwpppww",
      "wwwpppwpppwpnpww",
      "pppwwgwpnpwpppww",
      "pnpwwgwpppwwgppp",
      "pppgwwgwgwwgwpnp",
      "wwwwgwggggwgwppp",
      "wwwwwgovvogwwwww",
      "wwwwwovvvvowwwww",
      "wwwwwouuuuowwwww",
      "tttttovvvvottttt",
      "ttttttovvotttttt",
      "tttttttttttttttt",
      "tttttttttttttttt",
    ],
  });
  // 페이블판 원본: round3/fable/fable-round3.json — 꽃 가운데 키 「b」만 오푸스판과 같은 「n」으로 바꿨다(색은 그대로).
  const SUNFLOWER_FABLE_V6 = Object.freeze({
    fill: "#ecd890",
    colors: {
      w: "#ecd890", t: "#d69a3a", o: "#7a5424", v: "#cfae4c", u: "#3e6fa8",
      p: "#e58f2b", n: "#5e3416", g: "#6f8c3c",
    },
    art: [
      "wwwwwwwppwwwwwww",
      "wwwwwwpnnpwwppww",
      "wwppwwpnnpwpnnpw",
      "wpnnpwwppwwpnnpw",
      "wpnnpwwgwwwwppww",
      "wwppwwwgwwwwgwww",
      "wpppgwwgwwwgwppw",
      "wpnpwgwgwwgwpnnp",
      "wpppwwggggwwpnnp",
      "wwggwwovvowgwppw",
      "wwwwgwovvoggwwww",
      "ooooovvvvvvooooo",
      "ttttouuuuuuotttt",
      "ttttovvvvvvotttt",
      "tttttoooooottttt",
      "tttttttttttttttt",
    ],
  });
  const SUNFLOWER_PICK = SUNFLOWER_OPUS_V6; // ← 44번 답에 따라 교체 (오푸스: SUNFLOWER_OPUS_V6 / 페이블: SUNFLOWER_FABLE_V6)

  // 원래 비율 그림(w×h)을 16×16 틀 가운데에 앉힌다. 틀에서 그림 밖 칸은 공백(" ") — 어느 색판에도 속하지 않아
  // 인쇄되지 않고, 썸네일에서는 칠하지 않는다. 비유: 정사각형 도화지 가운데에 원작 모양 창을 낸 액자 대지.
  const FRAME = 16;
  function frameArt(rows) {
    const h = rows.length;
    const w = rows[0].length;
    const ox = Math.floor((FRAME - w) / 2);
    const oy = Math.floor((FRAME - h) / 2);
    const blank = " ".repeat(FRAME);
    const out = [];
    for (let y = 0; y < FRAME; y += 1) {
      const src = rows[y - oy];
      out.push(src === undefined ? blank : " ".repeat(ox) + src + " ".repeat(FRAME - ox - w));
    }
    return { art: Object.freeze(out), width: w, height: h, offsetX: ox, offsetY: oy };
  }
  function makeOriginal(key, label, rows, colors, fill) {
    const f = frameArt(rows);
    return Object.freeze({
      key: key, label: label, art: f.art, rawArt: Object.freeze(rows.slice()), colors: colors, fill: fill,
      width: f.width, height: f.height, offsetX: f.offsetX, offsetY: f.offsetY,
    });
  }

  // ── 2026-10-20 v9 · 한 번에 한 색 — 원작 6점을 4~6색 판으로 (그릴미 기둥 2-3 · 2-4) ──────────
  // 출처: docs/plans/2026-10-06-mewna-two-room-demo/workshop-economy-2026-10-12/new-originals/round4-colors/
  //   reduced-originals.json(뮤나리자 · 진주 고양이 · 별이 빛나는 밤 · 절규 · 키스) + slot2-dance-redraw(2번째 = 마티스 「춤」
  //   고양이 다섯 — 형님 9 = A2, 해바라기 대체). 시안 pillars-ui-mockup-2026-10-19-v2/art-data.js와 칸 단위로 같다.
  // plateOrder = 칠하는 순서(밀대를 한 번 끝까지 내릴 때 한 색). 마지막 색은 자동 마감 — 직접 미는 횟수 = 색 − 1.
  // plateNames = 그 색의 이름(기록 줄 「다음 공정」에 쓴다). 뮤나리자는 v6 그림과 칸 · 색이 그대로다.
  const DANCE_ART_V9 = Object.freeze([
    "bbbbbobbbobbbbbb", "bbbbbooooobbbbbb", "bbbbbododobbbbbb", "bbbbbbooobbbbbbb",
    "bbbboooooooobbbb", "obbbobbbbbbobbbo", "ooooobbbbbbooooo", "ododobbbbbbododo",
    "booobbbbbbbbooob", "bboggggbbbbbbobb", "ggooggggggbboobb", "ggogggogggoggbob",
    "ggooooooooooooob", "ggododogggododog", "gggooogggggooogg", "gggggggggggggggg",
  ]);
  const DANCE_COLORS_V9 = Object.freeze({ b: "#2f5fa8", g: "#3f8a4a", o: "#e07a3c", d: "#2b211b" });
  const PEARL_CAT_ART_V9 = Object.freeze([
    "dddddudddudddddd", "ddddduuuuudddddd", "dddduuuuuuuddddd", "ddduuuffffuudddd",
    "ddduuffffffuuddd", "dddduffdfdfudddd", "dddduffffffudddd", "dddddffffddddddd",
    "ddddyyyyyydddddd", "dddyyyyyyyypdddd", "ddyyyyyyyyyydddd", "ddyyyyyyyyyydddd",
    "dyyyyyyyyyyyyddd", "dyyyyyyyyyyyyddd", "dddddddddddddddd", "dddddddddddddddd",
  ]);
  const PEARL_CAT_COLORS_V9 = Object.freeze({ d: "#241f1c", y: "#c9a227", u: "#3a6ea5", f: "#d9a066", p: "#f2efe4" });
  const STARRY_ART_V9 = Object.freeze([
    "kkkkkkkkykkkkkkk", "kkkwkkkkkkwwwkkk", "kkwkkkkkkkkkkyyk", "kwwwwkkykkkkyyyy",
    "kykkkwwwwwkkkyyk", "kckkkkwwwwwwkkkk", "kcckkkkkwwwwwkyk", "kcckykkkkkkwwwkk",
    "ccccwwkkkkkkwkkk", "ccccwwwwkkkwwwww", "cccchhwwwwwchchh", "cchhhhhhhhhccchh",
    "chhyhhhhhhhckchh", "chhhhhhhyhcccchh", "hhhhhhyhhhhccchh", "hhhhhhhhhhcccchh",
  ]);
  const STARRY_COLORS_V9 = Object.freeze({ k: "#1d2a4f", h: "#3d5272", c: "#14180f", w: "#9cc3e6", y: "#f2d45c" });
  const SCREAM_ART_V9 = Object.freeze([
    "ooooooooooorrooo", "oooooooorrrooooo", "oooorrrooooooooo", "rrrooooooooooorr",
    "oooooooooooobbbb", "bboooooobbbbbbbb", "bbbbbfbbbfbbbbbb", "bbbbbffffffbbbbb",
    "wbbbdfdffdfdbbbb", "wwbbdffffffdbbbb", "bwwbdfffdffdbbbb", "bbwwbdffdffdbbbb",
    "bbbwwddfffddbbbb", "bbbbwddddddwwwww", "bbbbwwddddwwwwww", "bbbbbwwwwwwwwwww",
  ]);
  const SCREAM_COLORS_V9 = Object.freeze({ o: "#e07a2e", b: "#2f4f7a", w: "#8a6a44", f: "#e3d3a8", r: "#b8402a", d: "#2e2428" });
  const KISS_ART_V9 = Object.freeze([
    "gggggggggggggggg", "gggggkgkgggggggg", "ggggggkkkffgfggg", "gggggkkkkfffffgg",
    "ggggykkkffkfkfgg", "gggyyykyyffffggg", "gggykyyyyyyypggg", "ggyyfyyyyypyyggg",
    "ggyykyyyypyyyygg", "ggyyfyyyyyypyygg", "gyyykyyyypyyyygg", "gyyyfyyyyyyypygg",
    "gyyykyyyyypyyygg", "mmyyyyyyyyyyyymm", "mpmmpmmyymmmpmpm", "mmmpmmpmmmpmmmmm",
  ]);
  const KISS_COLORS_V9 = Object.freeze({ g: "#9a7a2a", y: "#e6c14a", m: "#4f7a3a", f: "#e0a874", p: "#c25a5a", k: "#1a1512" });
  // 칠하는 순서 · 색 이름 — 키는 원작 키. 첫 색 = 바탕(실루엣 · 썸네일 바탕), 마지막 색 = 자동 마감.
  const PLATE_PLAN_V9 = Object.freeze({
    "mewna-lisa": Object.freeze({ order: Object.freeze([".", "b", "f", "d"]), names: Object.freeze(["배경", "몸", "얼굴", "눈·입"]) }),
    "dance": Object.freeze({ order: Object.freeze(["b", "g", "o", "d"]), names: Object.freeze(["파란 하늘", "초록 언덕", "주황 고양이들", "눈"]) }),
    "pearl-cat": Object.freeze({ order: Object.freeze(["d", "y", "u", "f", "p"]), names: Object.freeze(["어두운 배경", "노란 옷", "파란 터번", "얼굴", "진주"]) }),
    "starry-night": Object.freeze({ order: Object.freeze(["k", "h", "c", "w", "y"]), names: Object.freeze(["밤하늘", "언덕·땅", "사이프러스·고양이", "소용돌이", "별·달"]) }),
    "scream": Object.freeze({ order: Object.freeze(["o", "b", "w", "f", "r", "d"]), names: Object.freeze(["주황 하늘", "피오르", "다리", "얼굴", "붉은 물결", "외투·눈·입"]) }),
    "kiss": Object.freeze({ order: Object.freeze(["g", "y", "m", "f", "p", "k"]), names: Object.freeze(["청동 바탕", "금빛 망토", "꽃밭", "얼굴·흰 무늬", "꽃·붉은 칸", "눈·머리·검정 무늬"]) }),
  });
  // v9: 원작에 칠하는 순서(plateOrder) · 색 이름(plateNames) · 직접 미는 횟수(manualStrokes = 색 − 1)를 함께 단다.
  // 바탕색(fill)은 첫 색의 물감색이다 — 썸네일 바탕과 실루엣의 옅은 판이 이 색을 기준으로 갈린다.
  function makeOriginalV9(key, label, rows, colors) {
    const plan = PLATE_PLAN_V9[key];
    const base = makeOriginal(key, label, rows, colors, colors[plan.order[0]]);
    return Object.freeze(Object.assign({}, base, {
      plateOrder: plan.order, plateNames: plan.names, manualStrokes: plan.order.length - 1,
    }));
  }

  // 2026-10-16 v6: 여섯 점 모두 16×16 — frameArt는 그대로 두지만 이제 여백(" ")이 생기지 않는다.
  // 2026-10-20 v9: 4~6색 판으로 갈아 끼우고 2번째를 「춤」으로(해바라기 · 옛 5~8색 그림 상수는 위에 기록용으로 남긴다).
  const ORIGINALS = Object.freeze([
    makeOriginalV9("mewna-lisa", "뮤나리자", V6_PIXEL_ART, V6_PLATE_COLORS),
    makeOriginalV9("dance", "춤", DANCE_ART_V9, DANCE_COLORS_V9),
    makeOriginalV9("pearl-cat", "진주 고양이", PEARL_CAT_ART_V9, PEARL_CAT_COLORS_V9),
    makeOriginalV9("starry-night", "별이 빛나는 밤", STARRY_ART_V9, STARRY_COLORS_V9),
    makeOriginalV9("scream", "절규", SCREAM_ART_V9, SCREAM_COLORS_V9),
    makeOriginalV9("kiss", "키스", KISS_ART_V9, KISS_COLORS_V9),
  ]);

  function originalByKey(key) {
    return ORIGINALS.find(function (item) { return item.key === key; });
  }

  function drawOriginal(canvas, key, scale) {
    const item = originalByKey(key);
    if (!item) return false;
    const context = canvas && canvas.getContext ? canvas.getContext("2d") : null;
    if (!context) return false;
    context.imageSmoothingEnabled = false;
    // v5: 그림 밖 틀 칸은 비워 둔다(캔버스 뒤 바탕이 그대로 보임) — 바탕색은 그림 자리에만 칠한다.
    context.clearRect(0, 0, 16 * scale, 16 * scale);
    context.fillStyle = item.fill;
    context.fillRect(item.offsetX * scale, item.offsetY * scale, item.width * scale, item.height * scale);
    item.art.forEach(function (row, y) {
      for (let x = 0; x < row.length; x += 1) {
        const ch = row[x];
        if (ch === "." || ch === " " || !item.colors[ch]) continue;
        context.fillStyle = item.colors[ch];
        context.fillRect(x * scale, y * scale, scale, scale);
      }
    });
    return true;
  }

  // ── 원작 실루엣 (2026-10-08 두 방 데모 4단계) ──
  // 경매장 문의 다음 매물 예고와 카탈로그의 아직 없는 원작에 쓴다(기둥 ⑤ · 형님 14-A).
  // 그림의 바탕(「.」 또는 바탕색과 같은 색)은 옅은 판으로, 나머지 칸은 전부 까맣게 칠한다 —
  // 모양만 보이고 색·무늬는 숨는다. 비유: 커튼 뒤에 비친 그림자.
  const SILHOUETTE_BG = "#4a3d2c";
  const SILHOUETTE_INK = "#120d09";
  function drawOriginalSilhouette(canvas, key, scale) {
    const item = originalByKey(key);
    if (!item) return false;
    const context = canvas && canvas.getContext ? canvas.getContext("2d") : null;
    if (!context) return false;
    context.imageSmoothingEnabled = false;
    // v5: 실루엣도 원작 모양(가로 · 세로 그림)만큼만 판을 깐다 — 「다음은 가로 그림이구나」가 힌트가 된다.
    context.clearRect(0, 0, 16 * scale, 16 * scale);
    context.fillStyle = SILHOUETTE_BG;
    context.fillRect(item.offsetX * scale, item.offsetY * scale, item.width * scale, item.height * scale);
    context.fillStyle = SILHOUETTE_INK;
    item.art.forEach(function (row, y) {
      for (let x = 0; x < row.length; x += 1) {
        const ch = row[x];
        if (ch === "." || ch === " " || !item.colors[ch] || item.colors[ch] === item.fill) continue;
        context.fillRect(x * scale, y * scale, scale, scale);
      }
    });
    return true;
  }

  // ── 완전한 흰 도화지 아이콘 — 밑그림·실루엣·색 힌트 전면 금지 ──
  function drawBlankPaper(canvas) {
    const context = canvas && canvas.getContext ? canvas.getContext("2d") : null;
    if (!context) return false;
    const w = canvas.width;
    const h = canvas.height;
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#f4efe2";
    context.fillRect(0, 0, w, h);
    context.fillStyle = "#eae3d2";
    context.fillRect(0, h - 6, w, 6);
    context.fillRect(w - 6, 0, 6, h);
    context.fillStyle = "#faf6ec";
    context.fillRect(0, 0, w, 4);
    context.fillRect(0, 0, 4, h);
    return true;
  }

  // ══ 흰색 클린 창문 B — v3 정본 이식 ═══════════════════════════
  const ART = 16;
  const SUB = 3;
  const CV = ART * SUB; // 48×48

  function hash01(x, y, k) {
    let h = ((x + 3) * 374761393 + (y + 7) * 668265263 + (k + 11) * 974634211) >>> 0;
    h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  const SKY_TOP = [201, 236, 255];
  const SKY_BOTTOM = [91, 184, 231];
  const SKY_CLOUDS = [
    { y: 2, rows: [[3, 3], [2, 6], [4, 4]] },
    { y: 7, rows: [[9, 3], [8, 6], [10, 4]] },
    { y: 11, rows: [[2, 2], [1, 5], [3, 4]] },
  ];

  // 하늘색 유리 — 완주가 끝나면 이 유리와 빛만 남는다 (v3 drawSkyGlass에서 문틀 제외분).
  function drawSkyGlass(context) {
    for (let y = 0; y < ART; y += 1) {
      const t = y / (ART - 1);
      const rgb = SKY_TOP.map(function (v, i) { return Math.round(v + (SKY_BOTTOM[i] - v) * t); });
      context.fillStyle = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
      context.fillRect(0, y * SUB, CV, SUB);
    }
    context.globalAlpha = 0.42;
    context.fillStyle = "#f8fdff";
    SKY_CLOUDS.forEach(function (cloud) {
      cloud.rows.forEach(function (pair, row) {
        context.fillRect(pair[0] * SUB, (cloud.y + row) * SUB, pair[1] * SUB, SUB);
      });
    });
    context.globalAlpha = 0.18;
    context.fillStyle = "#ffffff";
    for (let y = 0; y < ART; y += 1) {
      const x1 = 1 + Math.floor(y * 0.34);
      const x2 = 9 + Math.floor(y * 0.22);
      context.fillRect(x1 * SUB, y * SUB, SUB, SUB);
      if (x2 < ART - 1 && y > 2 && y < 13) context.fillRect(x2 * SUB, y * SUB, SUB, SUB);
    }
    context.globalAlpha = 1;
  }

  // 흰색 클린 창틀 — v3 「B. 흰색 클린 창문」 이식본에서 두께만 절반으로 줄였다.
  // (2026-08-06 MNL-11: 창틀이 두꺼워 유리가 안 보이는 문제 → 2칸 → 1칸.
  //  모양을 새로 디자인한 것이 아니라 두께만 절반이다. 안쪽 그림자·하이라이트는
  //  1픽셀 선이라 창틀 두께를 늘리지 않는다.)
  const FRAME_CELLS = 1; // 창틀 두께 (기존 2칸의 절반)
  const GLASS_FIRST = FRAME_CELLS; // 유리가 시작되는 칸
  const GLASS_LAST = ART - FRAME_CELLS - 1; // 유리가 끝나는 칸

  function drawCleanFrame(context) {
    context.globalAlpha = 1;
    context.fillStyle = "#f8fcff";
    context.fillRect(0, 0, CV, FRAME_CELLS * SUB);
    context.fillRect(0, (ART - FRAME_CELLS) * SUB, CV, FRAME_CELLS * SUB);
    context.fillRect(0, 0, FRAME_CELLS * SUB, CV);
    context.fillRect((ART - FRAME_CELLS) * SUB, 0, FRAME_CELLS * SUB, CV);
    // 안쪽 그림자 한 픽셀 — 유리와 창틀 경계만 또렷하게 (두께 증가 없음)
    context.fillStyle = "#cfe6ec";
    context.fillRect(FRAME_CELLS * SUB, FRAME_CELLS * SUB, (ART - FRAME_CELLS * 2) * SUB, 1);
    context.fillRect(FRAME_CELLS * SUB, FRAME_CELLS * SUB, 1, (ART - FRAME_CELLS * 2) * SUB);
    // 바깥 하이라이트 한 픽셀 — 흰 창틀이 배경에 묻히지 않게
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CV, 1);
    context.fillRect(0, 0, 1, CV);
  }

  // ══ 때 묻은 유리 6개 레이어 — 실제로 한 칸씩 지워진다 ═══════════
  // 2026-08-25 회의 전 추천안 계약 4로 다섯 겹 → 여섯 겹이 됐다.
  // 창문 한 장의 밀대 완주가 6회가 되면서 지울 겹도 그만큼 있어야 하기 때문이다.
  // 2026-08-06 MNL-10 확정: 쉐이더로 한 장을 덮었다가 옅게 지우는 방식은 폐기.
  // 서로 다른 때 5겹이 겹쳐 있고, 밀대가 한 칸(한 줄) 지나갈 때마다 그 줄에서
  // 맨 위 한 겹이 통째로 사라진다. 각 겹은 자기 진하기가 고정이라
  // 「옅어졌다」가 아니라 「없어졌다」로 보인다.
  //
  // 겹 순서(먼저 지워지는 것부터):
  //  ⓪ 검댕 껍질 → ① 굵은 때 덩어리 → ② 기름막 → ③ 흙탕 물자국 → ④ 손자국 얼룩
  //  → ⑤ 뿌연 김서림
  const OIL_SPOTS = [[3, 3, 4, 3], [9, 2, 3, 3], [5, 8, 4, 3], [10, 11, 3, 2], [2, 12, 3, 2]];
  const MUD_COLS = [3, 6, 10, 13];
  const SMUDGES = [[5, 4], [10, 7], [4, 11], [12, 12]];

  const DIRT_LAYERS = Object.freeze([
    // ⓪ 검댕 껍질 — 2026-08-25 회의 전 추천안 계약 4로 새로 붙인 여섯 번째 겹.
    // 창문 한 장이 밀대 완주 4회 → 6회가 되면서, 그림 겹이 다섯 장뿐이면
    // 「밀어야 할 횟수보다 지울 겹이 적은」 상태가 된다. 가장 두꺼운 겹을 하나 더 얹어
    // 첫 완주에서 눈에 띄게 벗겨지는 층을 만든다.
    Object.freeze({
      key: "soot", alpha: 0.9,
      cell: function (x, y) {
        const h = hash01(x, y, 61);
        if (h < 0.14) return null; // 원래 조금 벗겨져 있던 자리
        return h < 0.6 ? "#241a12" : "#332618";
      },
    }),
    // ① 굵은 때 덩어리 — 두 번째로 걷힌다
    Object.freeze({
      key: "grime", alpha: 0.94,
      cell: function (x, y) {
        const h = hash01(x, y, 22);
        if (h < 0.08) return null; // 원래 조금 벗겨져 있던 자리
        return h < 0.55 ? "#3b2a1a" : "#57402a";
      },
    }),
    // ② 기름막 — 뭉친 얼룩 몇 군데
    Object.freeze({
      key: "oil", alpha: 0.62,
      cell: function (x, y) {
        for (let i = 0; i < OIL_SPOTS.length; i += 1) {
          const s = OIL_SPOTS[i];
          if (x >= s[0] && x < s[0] + s[2] && y >= s[1] && y < s[1] + s[3]) {
            return hash01(x, y, 31) < 0.75 ? "#a8792c" : "#8d6522";
          }
        }
        return null;
      },
    }),
    // ③ 흙탕 물자국 — 세로로 흘러내린 줄기
    Object.freeze({
      key: "mud", alpha: 0.58,
      cell: function (x, y) {
        for (let i = 0; i < MUD_COLS.length; i += 1) {
          const c = MUD_COLS[i];
          if (x === c) return hash01(x, y, 9) < 0.85 ? "#6b563a" : null;
          if (x === c + 1 && hash01(x, y, 14) < 0.35) return "#7a6444";
        }
        return null;
      },
    }),
    // ④ 손자국 얼룩 — 드문드문 남은 자국
    Object.freeze({
      key: "smudge", alpha: 0.45,
      cell: function (x, y) {
        for (let i = 0; i < SMUDGES.length; i += 1) {
          const s = SMUDGES[i];
          const d = Math.abs(x - s[0]) + Math.abs(y - s[1]);
          if (d <= 1 && hash01(x, y, 45) < 0.9) return "#8a7660";
        }
        return null;
      },
    }),
    // ⑤ 뿌연 김서림 — 마지막 한 겹, 이게 사라져야 하늘이 선명해진다
    Object.freeze({
      key: "haze", alpha: 0.3,
      cell: function () { return "#dfeaf0"; },
    }),
  ]);

  // levelAt(row) → 그 줄에서 이미 지워진 겹 수 (0겹 = 새 창문, 6겹 = 완전 투명).
  // 아직 남은 겹만 그린다. 뒤 겹부터 그려서 ①이 맨 위에 오게 한다.
  function drawDirtRows(context, levelAt) {
    for (let y = GLASS_FIRST; y <= GLASS_LAST; y += 1) {
      const removed = Math.min(DIRT_LAYERS.length, Math.max(0, levelAt(y)));
      for (let k = DIRT_LAYERS.length - 1; k >= removed; k -= 1) {
        const layer = DIRT_LAYERS[k];
        context.globalAlpha = layer.alpha;
        for (let x = GLASS_FIRST; x <= GLASS_LAST; x += 1) {
          const color = layer.cell(x, y);
          if (!color) continue;
          context.fillStyle = color;
          context.fillRect(x * SUB, y * SUB, SUB, SUB);
        }
      }
    }
    context.globalAlpha = 1;
  }

  // ── 왼쪽 작업 탭 아이콘 — 「유리창 + 밀대」 중립 고정 그림 ──────
  // 2026-08-10 라운드 005 확정: 이 아이콘은 지금 창문이 얼마나 닦였는지와
  // 아무 관계가 없다. 언제나 같은 한 장이며, 진행 상태를 읽지 않는다.
  // (그래서 이 함수는 인자로도 상태를 받지 않는다.)
  function drawJobIcon(canvas) {
    const context = canvas && canvas.getContext ? canvas.getContext("2d") : null;
    if (!context) return false;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, CV, CV);
    drawSkyGlass(context);
    drawCleanFrame(context);
    // 고무 밀대 — 나무 손잡이와 검은 고무날을 유리 한가운데에 얹는다.
    context.fillStyle = "#8a6d45";
    context.fillRect(7 * SUB, 4 * SUB, 2 * SUB, 5 * SUB); // 손잡이 기둥
    context.fillStyle = "#a98551";
    context.fillRect(7 * SUB, 4 * SUB, SUB, 5 * SUB); // 손잡이 밝은 면
    context.fillStyle = "#6f5a3a";
    context.fillRect(5 * SUB, 8 * SUB, 6 * SUB, SUB); // 밀대 몸통
    context.fillStyle = "#4a4a4a";
    context.fillRect(3 * SUB, 9 * SUB, 10 * SUB, SUB); // 고무날
    context.fillStyle = "#2f2f2f";
    context.fillRect(3 * SUB, 10 * SUB - 1, 10 * SUB, 1); // 날 아래 그림자 한 픽셀
    // 닦인 자리를 알리는 짧은 광택 두 줄 — 위치도 밝기도 고정이다.
    context.globalAlpha = 0.55;
    context.fillStyle = "#ffffff";
    context.fillRect(3 * SUB, 3 * SUB, 4 * SUB, SUB);
    context.fillRect(9 * SUB, 5 * SUB, 3 * SUB, SUB);
    context.globalAlpha = 1;
    return true;
  }

  // ── 상점 장비 픽셀 아이콘 (2026-08-26 v1 · 계약 6항) ──────────────
  // 새 장비가 처음 열릴 때 뜨는 작은 알림 안에 들어가는 16×16 픽셀 그림이다.
  // 외부 이미지도 이모지도 쓰지 않고 여기서 직접 칸을 칠한다.
  // 캔버스 크기에 맞춰 한 칸 크기를 계산하므로 32px든 48px든 같은 그림이 나온다.
  const UPGRADE_ICONS = Object.freeze({
    // . 투명 / o 테두리 / b 몸통 / h 밝은 면 / i 잉크 / g 금빛
    inkTank: Object.freeze({
      colors: Object.freeze({ o: "#3b2f1e", b: "#7d6746", h: "#a98551", i: "#3f6fae" }),
      rows: Object.freeze([
        "................", ".....oooooo.....", "....ob....bo....", "....ob....bo....",
        "...oooooooooo...", "...ob......bo...", "...ob......bo...", "...ob.iiii.bo...",
        "...ob.iiii.bo...", "...ob.iiii.bo...", "...ob.iiii.bo...", "...ob.iiii.bo...",
        "...ob.iiii.bo...", "...oooooooooo...", "....hhhhhhhh....", "................",
      ]),
    }),
    printSqueegeeSpeed: Object.freeze({
      colors: Object.freeze({ o: "#2f2f2f", b: "#8a6d45", h: "#a98551", i: "#4a4a4a" }),
      rows: Object.freeze([
        "................", "................", ".......bb.......", ".......bh.......",
        ".......bh.......", ".......bh.......", ".......bh.......", "...oooooooooo...",
        "...obbbbbbbbo...", "...oiiiiiiiio...", "...oooooooooo...", "................",
        "..h..h..h..h....", "..h..h..h..h....", "................", "................",
      ]),
    }),
    autoBuyPaper: Object.freeze({
      colors: Object.freeze({ o: "#3b2f1e", b: "#efe1bd", h: "#ffffff", g: "#d8b978" }),
      rows: Object.freeze([
        "................", "...oooooooo.....", "...obbbbbbo.....", "...obhhhhbo.....",
        "...obbbbbbo.....", "...obhhhhbo.....", "...obbbbbbo.....", "...obhhhhbo.....",
        "...obbbbbbo.....", "...oooooooo.....", "..........gg....", ".........gggg...",
        "........gg..gg..", ".......gg....g..", "................", "................",
      ]),
    }),
    autoSellWork: Object.freeze({
      colors: Object.freeze({ o: "#3b2f1e", b: "#efe1bd", h: "#8a6d45", g: "#d8b978" }),
      rows: Object.freeze([
        "................", "....oooooooo....", "....obbbbbbo....", "....obhhhhbo....",
        "....obhhhhbo....", "....obbbbbbo....", "....oooooooo....", "................",
        "......gggg......", ".....g....g.....", ".....g.gg.g.....", ".....g....g.....",
        "......gggg......", "................", "................", "................",
      ]),
    }),
    inkQuality: Object.freeze({
      colors: Object.freeze({ o: "#2a3f66", b: "#3f6fae", h: "#7fb3e8", g: "#f4dc9a" }),
      rows: Object.freeze([
        "................", ".......g........", "......ggg.......", ".......g........",
        "................", "......oooo......", ".....obbbbo.....", "....obbhhbbo....",
        "....obhhhhbo....", "...obbhhhhbbo...", "...obbbbbbbbo...", "....obbbbbbo....",
        ".....obbbbo.....", "......oooo......", "................", "................",
      ]),
    }),
  });

  function drawUpgradeIcon(canvas, key) {
    const context = canvas && canvas.getContext ? canvas.getContext("2d") : null;
    if (!context) return false;
    const icon = UPGRADE_ICONS[key];
    const w = canvas.width;
    const h = canvas.height;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, w, h);
    if (!icon) return false;
    const cell = Math.max(1, Math.floor(Math.min(w, h) / 16));
    for (let y = 0; y < 16; y += 1) {
      const row = icon.rows[y];
      for (let x = 0; x < 16; x += 1) {
        const color = icon.colors[row[x]];
        if (!color) continue;
        context.fillStyle = color;
        context.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    return true;
  }

  // ── 2026-10-20 v9 · 오른쪽 세 칸 · 원작 카탈로그 아이콘 (시안 pillars-ui-mockup-2026-10-19-v2 그대로) ──
  // 16×16 칸 그림을 캔버스 크기에 맞춰 칠한다. 이모지 · 외부 그림 없이 여기서 칸을 직접 칠한다.
  const RAIL_ICONS = Object.freeze({
    // 잠긴 칸 — 자물쇠
    lock: Object.freeze({
      colors: Object.freeze({ o: "#6a563a", b: "#3a2f24", k: "#14100c" }),
      rows: Object.freeze(["................", "................", "......oooo......", ".....o....o.....", "....o......o....",
        "....o......o....", "....o......o....", "...oooooooooo...", "...obbbbbbbbo...", "...obbbkkbbbo...",
        "...obbbkkbbbo...", "...obbbbkbbbo...", "...obbbbbbbbo...", "...oooooooooo...", "................", "................"]),
    }),
    // 모작 운 — 네잎클로버
    clover: Object.freeze({
      colors: Object.freeze({ o: "#24532a", g: "#5fb04a", h: "#9bd77a", s: "#3f7a32" }),
      rows: Object.freeze(["................", "....oo....oo....", "...oggo..oggo...", "...oghgooghgo...", "....oggggggo....",
        ".....oggggo.....", "....oggggggo....", "...oghgooghgo...", "...oggo..oggo...", "....oo.s..oo....",
        ".......s........", "......s.........", ".....s..........", "................", "................", "................"]),
    }),
  });
  // 스퀴지 재질 색 — 나무 · 브론즈 · 실버(v8 「인쇄 스퀴지 속도」 아이콘 모양에 재질 색만 바꿔 칠한다)
  const SQUEEGEE_MATERIAL_COLORS = Object.freeze({
    wood: Object.freeze({ b: "#8a6d45", h: "#a98551" }),
    bronze: Object.freeze({ b: "#a5652c", h: "#e0a060" }),
    silver: Object.freeze({ b: "#8f99a3", h: "#e6edf2" }),
  });
  // speed = true면 아래 속도 줄(스퀴지 속도 칸), false면 줄 없이 재질만(스퀴지 종류 칸)
  function squeegeeIcon(materialKey, speed) {
    const mat = SQUEEGEE_MATERIAL_COLORS[materialKey] || SQUEEGEE_MATERIAL_COLORS.wood;
    const rows = ["................", "................", ".......bb.......", ".......bh.......", ".......bh.......",
      ".......bh.......", ".......bh.......", "...oooooooooo...", "...obbbbbbbbo...", "...ohhhhhhhho...",
      "...oiiiiiiiio...", "...oooooooooo...", "................",
      speed ? "..s..s..s..s...." : "................", speed ? "..s..s..s..s...." : "................", "................"];
    return { colors: { o: "#2f2f2f", b: mat.b, h: mat.h, i: "#4a4a4a", s: "#d8b978" }, rows: rows };
  }
  function drawIcon16(canvas, icon) {
    const context = canvas && canvas.getContext ? canvas.getContext("2d") : null;
    if (!context || !icon) return false;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const cell = Math.max(1, Math.floor(Math.min(canvas.width, canvas.height) / 16));
    for (let y = 0; y < 16; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        const c = icon.colors[icon.rows[y][x]];
        if (!c) continue;
        context.fillStyle = c;
        context.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    return true;
  }
  // 왼쪽 위 돈 칸의 금화(11×11 격자) — 시안 2판 그대로
  const COIN_ROWS = Object.freeze([
    "...ooooo...", ".ooyyyyyoo.", ".oyhhyyyyo.", "oyhyyyyyydo", "oyhyyyyyydo", "oyyyyyyyydo",
    "oyyyyyyyydo", "oyyyyyyyddo", ".oyyyyyddo.", ".oodddddoo.", "...ooooo...",
  ]);
  const COIN_COLORS = Object.freeze({ o: "#6b4a1c", y: "#e7b84a", h: "#fff2b0", d: "#b07d26" });
  function drawCoin(canvas, scale) { return drawPixelArt(canvas, COIN_ROWS, COIN_COLORS, scale || 2); }

  // 밀대 — 잉크/거품 둑을 앞세우고 굴러 내려간다 (v3 drawSqueegee 이식).
  function drawSqueegee(context, posRows, foamColor, clock, tremor) {
    const y = Math.min(Math.round(posRows * SUB), CV - 2);
    const t = tremor || 0;
    if (foamColor) {
      context.globalAlpha = 0.85;
      context.fillStyle = foamColor;
      for (let x = 0; x < CV; x += 2) {
        const h = 1 + (Math.sin(clock / 90 + x * 0.7) > 0.2 ? 1 : 0);
        context.fillRect(x + t, y + 2, 2, h);
      }
      context.globalAlpha = 1;
    }
    context.fillStyle = "#4a4a4a";
    context.fillRect(t, y, CV, 2);
    context.fillStyle = "#8a6d45";
    context.fillRect(CV / 2 - 4 + t, y - 2, 8, 2);
  }

  const exported = {
    ART: ART,
    SUB: SUB,
    CV: CV,
    FRAME_CELLS: FRAME_CELLS,
    GLASS_FIRST: GLASS_FIRST,
    GLASS_LAST: GLASS_LAST,
    DIRT_LAYERS: DIRT_LAYERS,
    drawPixelArt: drawPixelArt,
    drawRotaryPhone: drawRotaryPhone,
    drawReceiver: drawReceiver,
    drawCatalog: drawCatalog,
    V6_PIXEL_ART: V6_PIXEL_ART,
    V6_PLATE_COLORS: V6_PLATE_COLORS,
    ORIGINALS: ORIGINALS,
    originalByKey: originalByKey,
    drawOriginalSilhouette: drawOriginalSilhouette,
    drawOriginal: drawOriginal,
    drawBlankPaper: drawBlankPaper,
    drawSkyGlass: drawSkyGlass,
    drawCleanFrame: drawCleanFrame,
    drawDirtRows: drawDirtRows,
    drawJobIcon: drawJobIcon,
    // 2026-08-26 v1 — 상점 최초 해금 알림 안의 16×16 장비 아이콘
    drawUpgradeIcon: drawUpgradeIcon,
    // 2026-10-20 v9 — 오른쪽 세 칸 · 카탈로그 잠김 · 왼쪽 위 금화
    RAIL_ICONS: RAIL_ICONS,
    squeegeeIcon: squeegeeIcon,
    drawIcon16: drawIcon16,
    drawCoin: drawCoin,
    PLATE_PLAN_V9: PLATE_PLAN_V9,
    drawSqueegee: drawSqueegee,
    hash01: hash01,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported; // Node 테스트용
  }
  root.MewnaArt = exported; // 브라우저용 전역
})(typeof globalThis !== "undefined" ? globalThis : this);
