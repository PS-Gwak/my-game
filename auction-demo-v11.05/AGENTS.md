# AGENTS.md — 뮤나리자 경매 데모 (Codex용)

> Codex가 이 폴더에서 코딩할 때 읽는 프로젝트 규칙서.
> 마지막 갱신: 2026-05-27

---

## 1. 프로젝트 개요

- **이름**: 뮤나리자(Mewna Lisa) 경매 데모
- **설명**: 고양이가 그림을 그리고 경매에서 파는 클리커/방치형 게임의 경매 시스템 데모
- **기술 스택**: 순수 HTML + JavaScript (프레임워크 없음, 단일 페이지)
- **실행 방법**: `index.html`을 브라우저에서 열기 (서버 불필요)

---

## 2. 핵심 파일 구조

```
auction-demo/
├── index.html                          # UI + 메인 화면 (891행)
├── manifest.js                         # 모듈 로더
└── modules/
    └── auction-engine/
        ├── v6-engine.js                # 핵심 경매 엔진 (4003행) ← 가장 중요
        ├── guards.js                   # 경매 진입 가드 (167행, 현재 비활성)
        └── first-auction.js            # 첫 경매 특수 처리 (63행)
```

---

## 3. v6 엔진 구조 요약

### CPU 인격 9종 (CONFIG.personalities, 38~96행)
- APP(시세형), CON(절약형), MAN(광기형), BLF(고객형), SHK(잠복형)
- TLT(도박형), MIR(추종형), SNI(저격형), WTH(관망형)

### 경매 종류 6가지
- 자유경매 1등가/2등가, 촛불경매, 비밀입찰, 1회제한, 네덜란드식

### 사회자 멘트 (HOST_LINES, 281~355행)
- cooldown_cpu, cooldown_user, counter_cpu, counter_user, rally, closing, bankrupt
- 인격 연관 멘트 (312~340행)

### 가격 메커니즘
- 추정가: rollExpectedPrice() (3056행), 카테고리별 범위
- 시작가: sampleStartRatio() (878행), 추정가의 약 40%
- 호가 단위: minTick() (426행), 현재가의 약 10%

### 쿨다운 모델 (1205~1244행)
- hostCooldownMs = 5~15초 랜덤
- 입찰 발생 시 리셋
- 만료 시 경매 종료

---

## 4. 현재 작업 목표 (v7 패치)

**상세 명세서**: `../../.omc/specs/deep-interview-auction-v7.md` (Deep Interview 8라운드 거쳐 확정)

A(사회자 MC) + B(경매 흐름 3단계) + C(CPU 인격 추가) 한꺼번에 진행 (2026-05-27 확정):

### P0 (필수 3개)
1. **사회자 대사 풀 확장** — rivalry, fair_warning, dropout_confirm, sold_congrats, persuasion, humor 카테고리 추가
2. **"against you" 자동 발사** — 입찰 시 직전 최고가였던 사람에게 자동 멘트
3. **CPU 이름 부여** — "CPU #3" 대신 실제 이름 표시

### P1 (중요 8개)
1. 3단계 흐름 도입 (속사포 → 경쟁 → 마무리)
2. 속사포 오프닝 (시작 3~5초)
3. 의도적 침묵 (fair warning 전 2~4초)
4. 늦둥이 등장 확률 상향 + MC 환영 대사
5. 교착 시 사회자 설득 모드
6. WTH(관망형) → "왔다갔다" 패턴으로 재설계
7. 불꽃 스프린터(FSP) 유형 신설
8. 줄다리기 전문가(APP_ROP) 변종 추가

---

## 5. 참고 문서 위치

| 문서 | 경로 | 설명 |
|------|------|------|
| 1차 경매 분석 | `../../baco-games/docs/analysis/auction-research/auction-flow-analysis.md` | 5단계 흐름, 극적 순간 6유형 |
| 2차 경매 분석 | `../../baco-games/docs/analysis/auction-research/auction-flow-analysis-v2.md` | 게임 비교 + v7 패치노트 |
| 사회자 멘트 구어체 | `../../baco-games/docs/analysis/auction-research/auctioneer-dialogue-korean.md` | 한국어 구어체 변환표 |
| Whisper 텍스트 (1차) | `../../baco-games/docs/analysis/auction-research/whisper-transcripts/` | 5개 |
| Whisper 텍스트 (2차) | `../../baco-games/docs/analysis/auction-research/batch2-whisper/` | 20개 |

---

## 6. 코딩 규칙

- **언어**: JavaScript ES2020+ (모듈 없이 전역 스코프)
- **한국어 주석**: 비유를 써서 비개발자도 이해할 수 있게
- **변수명**: 영어 camelCase
- **함수 추가 시**: 기존 섹션 구분 주석(`// ====`) 형식 따르기
- **테스트**: 브라우저에서 직접 플레이하며 확인 (자동 테스트 없음)
- **디버그**: URL에 `?debug=1` 붙이면 슬라이더 패널 + D키로 디버그 패널
