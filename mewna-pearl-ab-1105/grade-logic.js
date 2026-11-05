/* 뮤나리자 등급 회차 추첨 — 순수 로직 (화면·타이머 없음)
   · 회차마다 브론즈 80% / 실버 15% / 골드 4% / 플래티넘 0.8% / 다이아몬드 0.2%를 독립으로 뽑는다 (시험값).
   · 수동 3회의 최고 등급만 확보한다. 첫 확보와 최고 기록 상승에만 「개선(improved)」이 참이다.
   · 다이아몬드가 나오면 남은 수동 회차를 생략하고 곧바로 마감한다.
   · 마감 종류: 브론즈 = 즉시(instant) / 실버·골드 = 순차(sequential) / 플래티넘·다이아 = 순차 + 잭팟.
   · 피드백 1549472613842030692 추가 (B안):
     - finalDistribution(): 세 회차를 마친 최종 최고 등급의 확률 분포 (표시 옵션 B용. 추첨 규칙은 바꾸지 않는다).
     - forcedPath(): 디버그 「최종 등급 바꾸기」용. 자연 회차 확률을 「최종 최고 등급 = 목표」 조건으로 조건부 추첨해
       남은 회차 목록을 만든다. 첫 회차 강제 출현·매 회차 같은 등급 덮어쓰기가 없고 모든 합법 경로가 자연 가중치로 나온다.
   브라우저(window.MewnaGrade)와 node(module.exports) 양쪽에서 같은 파일을 쓴다. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MewnaGrade = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // 색은 D 원본(2026-07-21-squeegee-v6)의 등급색, 가격은 확률표 참고판의 레벨 1 시험값.
  var GRADES = [
    { key: "bronze",   name: "브론즈",     color: "#b87333", price: 70 },
    { key: "silver",   name: "실버",       color: "#a7b0ba", price: 130 },
    { key: "gold",     name: "골드",       color: "#d6a900", price: 250 },
    { key: "platinum", name: "플래티넘",   color: "#2aa198", price: 500 },
    { key: "diamond",  name: "다이아몬드", color: "#62c7ff", price: 1000 },
  ];
  var ROUND_P = [0.8, 0.15, 0.04, 0.008, 0.002];
  var MANUAL_ROUNDS = 3;
  var TOP = GRADES.length - 1;

  function gradeIndex(v) {
    if (typeof v === "number") return v;
    for (var i = 0; i < GRADES.length; i++) if (GRADES[i].key === v || GRADES[i].name === v) return i;
    throw new Error("unknown grade: " + v);
  }

  // rng()는 [0,1) 난수. 누적 구간으로 한 번만 뽑는다 (회차마다 독립).
  // 누적 경계는 소수 오차(0.8+0.15=0.9500000000000001)를 피하려고 만분율 정수로 둔다.
  var CUM = [];
  (function () { var acc = 0; for (var i = 0; i < ROUND_P.length; i++) { acc += Math.round(ROUND_P[i] * 10000); CUM.push(acc); } })();
  function drawGrade(rng) {
    var r = rng() * 10000;
    for (var i = 0; i < CUM.length; i++) if (r < CUM[i]) return i;
    return TOP;
  }

  function formatPercent(p) {
    var v = Math.round(p * 10000) / 100;
    return v.toLocaleString("ko-KR", { maximumFractionDigits: 2 }) + "%";
  }

  // 회차 완료 한 번: 이전 최고(best, null이면 아직 없음)와 이번 추첨으로 개선 여부를 정한다.
  function settleRound(best, draw) {
    var prev = best == null ? -1 : best;
    return {
      draw: draw,
      improved: draw > prev,            // 첫 브론즈 포함, 진짜 기록 상승만 참
      bestAfter: Math.max(prev, draw),  // 낮거나 같은 결과로는 절대 내려가지 않음
      earlyStop: draw === TOP,          // 다이아몬드 → 남은 수동 회차 생략
    };
  }

  function finishPlan(best) {
    var b = best == null ? 0 : best;
    return { kind: b <= 0 ? "instant" : "sequential", jackpot: b >= 3 };
  }

  // 검사용 시뮬레이션: 추첨 목록을 순서대로 넣으면 회차별 반응과 마감 계획을 돌려준다.
  function simulate(draws) {
    var best = null, rounds = [], early = false;
    for (var i = 0; i < MANUAL_ROUNDS && i < draws.length; i++) {
      var s = settleRound(best, draws[i]);
      best = s.bestAfter;
      rounds.push({ round: i + 1, draw: s.draw, improved: s.improved, bestAfter: best, dotsFilled: i + 1 });
      if (s.earlyStop) { early = true; break; }
    }
    return { rounds: rounds, best: best, dotsFilled: rounds.length, dotsTotal: MANUAL_ROUNDS, earlyStop: early, finish: finishPlan(best) };
  }

  /* ── 회차 확률의 누적 F[g] = P(한 회차 추첨 ≤ g) ── */
  var CUMF = [];
  (function () { var acc = 0; for (var i = 0; i < ROUND_P.length; i++) { acc += ROUND_P[i]; CUMF.push(acc); } })();
  function cumulative(g) { return g < 0 ? 0 : CUMF[Math.min(g, TOP)]; }

  // 세 회차(rounds회)를 마친 최종 최고 등급의 분포: P(최고 = g) = F(g)^n − F(g−1)^n.
  // 다이아 조기 종료는 남은 회차를 생략할 뿐 최고 등급을 바꾸지 않으므로 분포는 같다 (검사 파일의 전수 열거와 일치).
  // 표시 옵션 B에만 쓰이며 실제 추첨(drawGrade)·가격·마감 규칙에는 관여하지 않는다.
  function finalDistribution(rounds) {
    var n = rounds == null ? MANUAL_ROUNDS : rounds;
    var out = [];
    for (var g = 0; g < GRADES.length; g++) out.push(Math.pow(cumulative(g), n) - Math.pow(cumulative(g - 1), n));
    return out;
  }

  // 디버그 「최종 등급 바꾸기」: 현재 최고 best(null = 아직 없음), 남은 회차 수 remaining, 목표 target.
  // 남은 회차의 추첨값을 「모든 회차 ≤ target 이고 (아직 target을 확보하지 않았다면) 적어도 한 회차 = target」 조건으로
  // 자연 회차 확률에서 조건부 추첨한다 (앞에서부터 차례로, 뒤 회차의 조건부 가중치 Z를 곱해 정확한 주변 확률로 뽑는다).
  //   Z(m, 필요) = F(target)^m − F(target−1)^m,  Z(m, 불필요) = F(target)^m
  // 결과: 첫 회차 강제 출현 없음, 도달 시점(1·2·3회차)이 자연 가중치대로 다양, 같은 등급 유지·낮은 결과 유지 모두 가능,
  //       모든 합법 경로가 나올 수 있으며 균등 분포로 고정하지 않는다. 다이아가 나오면 그 뒤 회차는 만들지 않는다 (조기 종료).
  // best > target 이면 최고 등급 유지 규칙과 충돌하므로 합법 경로가 없다 → 오류 (호출 쪽에서 선택을 막는다).
  function forcedPath(best, remaining, target, rng) {
    var b = best == null ? -1 : best;
    if (typeof target !== "number" || target < 0 || target > TOP) throw new Error("bad target: " + target);
    if (target < b) throw new Error("impossible final: best " + GRADES[b].key + " above target " + GRADES[target].key);
    var out = [];
    if (remaining <= 0 || b === TOP) return out;
    var F = cumulative(target), Fb = cumulative(target - 1);
    var need = b < target;                       // target을 아직 확보하지 못했으면 남은 회차 중 적어도 한 번 나와야 한다
    for (var m = remaining; m >= 1; m--) {
      var rest = m - 1, total = 0, w = [];
      for (var d = 0; d <= target; d++) {
        var stillNeed = need && d !== target;
        var z = stillNeed ? Math.pow(F, rest) - Math.pow(Fb, rest) : Math.pow(F, rest);
        w.push(ROUND_P[d] * z); total += w[d];
      }
      var r = rng() * total, pick = target;
      for (var k = 0; k <= target; k++) { r -= w[k]; if (r < 0) { pick = k; break; } }
      out.push(pick);
      if (pick === target) need = false;
      if (pick === TOP) break;                   // 다이아 조기 종료 — 남은 회차는 수행되지 않는다
    }
    return out;
  }

  return {
    GRADES: GRADES, ROUND_P: ROUND_P, MANUAL_ROUNDS: MANUAL_ROUNDS,
    gradeIndex: gradeIndex, drawGrade: drawGrade, formatPercent: formatPercent,
    settleRound: settleRound, finishPlan: finishPlan, simulate: simulate,
    cumulative: cumulative, finalDistribution: finalDistribution, forcedPath: forcedPath,
  };
});
