/* ============================================================
   atelier.js — 작업실 UI (캔버스 + 확률 박스 + 붓·물감 정보 표시)
   ============================================================
   비유: 그림 그리는 방(작업실)의 인테리어 담당입니다.
   - 왼쪽 상단에 원본 그림 미리보기 (상단 고정, 락-인 결정 13)
   - 가운데에 실제 칠하는 도화지
   - 오른쪽에 확률 미리보기 + 진행 바 + 붓·물감 정보
   모작이 80% 채워지면 onComplete 콜백을 올려보내요.

   받는 옵션:
   - container    : 캔버스를 넣을 DOM 요소
   - type         : 그림 종류
   - paintingEntry: manifest에서 가져온 그림 메타데이터
   - state        : 현재 게임 상황 메모지
   - onComplete   : (resultItem) → void  — 모작 완성 시 호출
   ============================================================ */

(function (global) {
  'use strict';

  // ── 작업실 UI 시작
  // 반환: { destroy } — 화면 이탈 시 game.js가 destroy() 호출
  function startAtelier({ container, type, paintingEntry, state, onComplete }) {
    const Brush   = global.MN9_Brush;
    const Paint   = global.MN9_Paint;
    const Scorer  = global.MN9_Scorer;
    const Composer = global.MN9_Composer;
    const WristMode = global.MN9_WristMode;

    if (!Brush || !Paint || !Scorer || !Composer) {
      console.error('[atelier] 필요한 모듈이 없어요. brush/paint/scorer/composer 확인.');
      return { destroy: () => {} };
    }

    // 손목 보호 모드 여부 확인
    const wristMode = WristMode ? WristMode.isWristMode(state) : false;

    const brushLevel = state.brushLevel || 1;
    const paintLevel = (state.paintLevels || {})[type] || 0;
    const brushRadius = Brush.getRadius(brushLevel);

    // ── 레이아웃 HTML 구성
    container.innerHTML = `
      <div class="atelier-wrap">

        <!-- 상단 고정: 원본 참고 그림 (락-인 결정 13) -->
        <div class="atelier-reference">
          <span class="atelier-ref-label">참고 그림 (작업 중 고정)</span>
          <img
            class="atelier-ref-img"
            src="assets/paintings/${paintingEntry.filename}"
            alt="${paintingEntry.title}"
            onerror="this.style.display='none'; this.nextSibling.style.display='block'"
          />
          <div class="atelier-ref-fallback" style="display:none;">
            ${paintingEntry.title}<br><small>${paintingEntry.artist}</small>
          </div>
          <div class="atelier-ref-caption">${paintingEntry.title} — ${paintingEntry.artist} (${paintingEntry.grade}등급)</div>
        </div>

        <!-- 도화지 영역 -->
        <div class="atelier-canvas-wrap">
          <div class="atelier-canvas-label" id="atelier-label">
            흐릿한 그림 위에 마우스를 움직여 또렷하게 만들어주세요 (90% 도달 시 완성!)
          </div>
          <div class="atelier-canvas-box" id="atelier-canvas-box"></div>
          <!-- 진행 바 -->
          <div class="atelier-progress-wrap" style="position:relative;">
            <div class="atelier-progress-bar" id="atelier-progress-bar" style="width:0%"></div>
            <!-- 80% 금색 마커 라인 -->
            <div id="atelier-goal-marker" style="
              position:absolute;top:0;left:80%;width:2px;height:100%;
              background:#f5a700;opacity:0.85;pointer-events:none;
            "></div>
          </div>
          <div class="atelier-progress-text" id="atelier-progress-text">0% 채움</div>
        </div>

        <!-- 오른쪽 정보 패널 -->
        <div class="atelier-info">

          <!-- 확률 미리보기 (모작 시작 전 표시 — 락-인 architect §3.6) -->
          <div class="atelier-prob-box">
            <div class="atelier-prob-title">이번 모작 등급 확률</div>
            <div class="atelier-prob-list" id="atelier-prob-list"></div>
          </div>

          <!-- V3: 등급별 받을 금액 (해금된 등급만 표시) -->
          <div class="atelier-price-box">
            <div class="atelier-price-title">등급별 받을 금액</div>
            <div class="atelier-price-list" id="atelier-price-list"></div>
          </div>

          <!-- E3: 담당 고양이 표시 -->
          <div class="atelier-cat-row" id="atelier-cat-row"></div>

          <!-- 붓 정보 -->
          <div class="atelier-tool-row">
            <span class="atelier-tool-icon">🖌</span>
            <div>
              <div class="atelier-tool-name">붓 ${brushLevel}단계</div>
              <div class="atelier-tool-desc">${Brush.getLabel(brushLevel)}</div>
            </div>
          </div>

          <!-- 물감 정보 -->
          <div class="atelier-tool-row">
            <span class="atelier-tool-icon">🎨</span>
            <div>
              <div class="atelier-tool-name">${typeLabel(type)} 물감 ${paintLevel}단계</div>
              <div class="atelier-tool-desc">${Paint.getLabel(paintLevel)}</div>
            </div>
          </div>

        </div>
      </div>
    `;

    // 확률 미리보기 채우기
    const probList = container.querySelector('#atelier-prob-list');
    if (probList) {
      const lines = Scorer.getProbabilityPreview(paintLevel);
      probList.innerHTML = lines.map(l => `<div class="atelier-prob-row">${l}</div>`).join('');
    }

    // V3: 등급별 받을 금액 채우기 (해금된 등급만)
    const priceList = container.querySelector('#atelier-price-list');
    if (priceList) {
      const ug = (state.unlocks && state.unlocks.unlockedGrades) || { bronze: true, silver: false, gold: false };
      const tiers = [
        { gradeMax: 10, gradeMin: 7, key: 'gold',   label: '금별·다이아' },
        { gradeMax: 6,  gradeMin: 4, key: 'silver', label: '은별' },
        { gradeMax: 3,  gradeMin: 1, key: 'bronze', label: '동별' },
      ];
      const rows = [];
      for (const t of tiers) {
        if (!ug[t.key]) continue;
        for (let g = t.gradeMax; g >= t.gradeMin; g--) {
          const price = Scorer.computePrice(paintingEntry.grade, g, paintingEntry.basePrice);
          rows.push(`<div class="atelier-price-row">${Scorer.gradeLabel(g)} → $${price.toLocaleString('en-US')}</div>`);
        }
      }
      priceList.innerHTML = rows.join('');
    }

    // 캔버스 박스에 composer 붙이기
    const canvasBox = container.querySelector('#atelier-canvas-box');
    const progressBar  = container.querySelector('#atelier-progress-bar');
    const progressText = container.querySelector('#atelier-progress-text');
    const atelierLabel = container.querySelector('#atelier-label');
    const goalMarker   = container.querySelector('#atelier-goal-marker');

    // V1: 임계율 동적 반영 (디버그 슬라이더 값 또는 기본 90%)
    const goalPct = Math.round(((state.debug && state.debug.completeThreshold) || 0.90) * 100);

    // 진행 바 마커 위치 동적화
    if (goalMarker) goalMarker.style.left = goalPct + '%';

    // 안내 문구 동적화 (기법별)
    if (type === 'gratage') {
      if (atelierLabel) atelierLabel.textContent = `마우스를 누르고 움직여서 검정을 긁어내세요 (${goalPct}% 노출 시 완성!)`;
    } else if (type === 'pointillism') {
      if (atelierLabel) atelierLabel.textContent = `마우스를 클릭해서 점을 찍으세요 (${goalPct}% 채우면 완성!)`;
    } else {
      if (atelierLabel) atelierLabel.textContent = `흐릿한 그림 위에 마우스를 움직여 또렷하게 만들어주세요 (${goalPct}% 도달 시 완성!)`;
    }

    // 손목 보호 모드 ON이면 배지 추가
    if (wristMode && atelierLabel) {
      const badge = document.createElement('span');
      badge.textContent = ' [손목 보호 모드 ON]';
      badge.style.cssText = 'color:#f5a700;font-weight:bold;font-size:0.9em;';
      atelierLabel.appendChild(badge);
    }

    const composer = Composer.createComposer({
      type,
      brushRadius,
      paintLevel,
      paintingEntry,
      wristMode,
      onProgress: (coverage) => {
        const pct = Math.round(coverage * 100);
        if (progressBar)  progressBar.style.width = pct + '%';
        if (progressText) progressText.textContent = `${pct}% 채움`;
      },
      onComplete: () => {
        // 등급 결정 + 결과 아이템 구성
        const counterfeitGrade = Scorer.rollGrade(paintLevel);
        const value = Scorer.computePrice(paintingEntry.grade, counterfeitGrade, paintingEntry.basePrice);
        const resultItem = {
          id: `made_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type,
          grade:            paintingEntry.grade,
          filename:         paintingEntry.filename,
          title:            paintingEntry.title,
          artist:           paintingEntry.artist,
          counterfeitGrade,
          value,
          createdAt: Date.now(),
        };
        onComplete && onComplete(resultItem);
      },
    });

    if (canvasBox && composer) {
      canvasBox.appendChild(composer.canvas);
    }

    // E3/E4: 담당 고양이 표시 + 로딩 바
    const Cats = global.MN9_Cats;
    let _catTimerId = null;

    function _findAssignedCat() {
      if (!Cats || !state.cats) return null;
      const entry = Object.entries(state.cats).find(
        ([id, data]) => data.assignedPaintingId === paintingEntry.id
      );
      if (!entry) return null;
      return { catId: entry[0], catData: entry[1], catDef: Cats.CAT_DEFS[entry[0]] };
    }

    function _renderCatRow() {
      const catRow = container.querySelector('#atelier-cat-row');
      if (!catRow) return;
      const found = _findAssignedCat();
      if (!found || !found.catDef) {
        catRow.innerHTML = `
          <div style="color:#b8a070;font-size:0.85em;padding:8px 0;border-top:1px solid #3d2c18;margin-top:8px;">
            🐱 담당 고양이 없음 — 보유 그림에서 배치하세요
          </div>`;
        return;
      }
      const { catDef, catData } = found;
      const intervalMs = catDef.autoIntervalSec * 1000;
      const elapsed = catData.lastCopyAt ? (Date.now() - catData.lastCopyAt) : 0;
      const ratio = Math.min(1, elapsed / intervalMs);
      const pct = Math.round(ratio * 100);
      const remaining = Math.max(0, Math.ceil((intervalMs - elapsed) / 1000));
      catRow.innerHTML = `
        <div style="border-top:1px solid #3d2c18;margin-top:8px;padding-top:8px;">
          <div style="font-size:0.85em;color:#b8a070;margin-bottom:4px;">담당 고양이</div>
          <div style="font-size:0.95em;color:#e9d6a4;font-weight:bold;">
            ${catDef.emoji} ${catDef.name}
          </div>
          <div style="font-size:0.8em;color:#b8a070;margin:3px 0;">
            ${catDef.autoIntervalSec}초마다 1장 / 등급 보정 +${catDef.gradeBonus || 0}
          </div>
          <!-- E4: 로딩 바 -->
          <div style="
            background:#1a1008;border-radius:4px;height:8px;
            margin-top:6px;overflow:hidden;
          ">
            <div style="
              background:#f5a700;height:100%;width:${pct}%;
              transition:width 0.5s linear;border-radius:4px;
            "></div>
          </div>
          <div style="font-size:0.78em;color:#b8a070;margin-top:3px;">
            ${pct < 100 ? `다음 모작까지 ${remaining}초` : '모작 진행 중...'}
          </div>
        </div>`;
    }

    // 초기 렌더 + 1초마다 갱신
    _renderCatRow();
    _catTimerId = setInterval(_renderCatRow, 1000);

    // destroy: 이벤트 정리
    function destroy() {
      if (_catTimerId) { clearInterval(_catTimerId); _catTimerId = null; }
      if (composer) composer.destroy();
    }

    return { destroy };
  }

  // 그림 종류 한글 라벨
  function typeLabel(type) {
    const map = {
      watercolor:  '수채화',
      pointillism: '점묘화',
      oilpainting: '유화',
      gratage:     '그라타주',
    };
    return map[type] || type;
  }

  global.MN9_Atelier = { startAtelier };

})(typeof window !== 'undefined' ? window : globalThis);
