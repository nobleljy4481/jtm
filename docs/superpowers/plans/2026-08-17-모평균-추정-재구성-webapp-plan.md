# 모평균의 추정 — 교수학습 흐름 재구성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `C:\dev\jtm`에 "모평균의 추정" 인터랙티브 학습 웹앱을 새로 만든다. `withjm`의 시뮬레이션 기능(표본 강조 산점도, 95%/99% 신뢰구간 비교, 반복 시뮬레이션 시각화, 누적 포함비율 그래프)은 그대로 보존하고, `first-task`의 10단계 진행형 교수학습 흐름과 z 슬라이더 탐색 활동을 이식해서 하나로 재구성한다.

**Architecture:** `index.html`(구조) / `style.css`(스타일) / `script.js`(로직) 3분할 단일 페이지. 모듈 없음, 더블클릭으로 바로 실행. 전역 상태 객체 하나를 모든 단계가 공유하며, 상단 진행바 + 하단 이전/다음 버튼으로 10단계를 오간다. Canvas 2D로 직접 그리는 시각화(히스토그램·산점도·신뢰구간 막대·정규분포 곡선·Error Bar)는 withjm 코드를 그대로 이식하고, 게이지·누적그래프만 Chart.js를 계속 사용한다. 모평균(`state.mu`)은 8단계(반복 시뮬레이션) 전까지 화면에 숫자로 노출하지 않는다.

**Tech Stack:** HTML5 / CSS3 / Vanilla JavaScript (ES6+). 외부 CDN: MathJax(수식), Chart.js(게이지·누적그래프), Pretendard(폰트). 인터넷 연결 필요(기존 withjm과 동일 제약).

## Global Constraints

- 단일 세트의 파일(`index.html`/`style.css`/`script.js`) 3분할, `import`/`export` 금지, 더블클릭으로 바로 열림 (design doc §2)
- `state.mu`는 항상 내부적으로 존재하되, `state.meanRevealed === true`가 되기 전(8단계 진입 전)까지 화면에 숫자로 표시하지 않는다 — 신뢰구간 판정 막대·Error Bar의 모평균 라벨은 `reveal` 인자로 제어 (design doc §2)
- z 탐색 활동의 "찾음" 판정 허용오차는 목표 넓이와의 차이 ±0.003 (design doc §4, 이전 대화 합의)
- 넓이 계산은 외부 통계 라이브러리 없이 수치적분(Simpson's rule)으로 직접 구현 (design doc §4)
- Canvas 2D 시각화는 `responsive:false` 스타일로 width/height 속성 직접 관리 (withjm §7 버그 방지 메모 계승)
- Chart.js를 쓰는 인스턴스(게이지, 누적그래프)는 `responsive:false, maintainAspectRatio:false, beginAtZero:false` 명시, Error Bar류 갱신은 `destroy()` 후 재생성 방식 사용 (withjm §7 버그 방지 메모 계승)
- 10단계 진행 상태와 입력값은 `localStorage`에 저장 (design doc §2)

---

## File Structure

- `C:\dev\jtm\index.html` — `<head>`(CDN 링크) + 진행바 + 10개 `<section class="step" data-step="N">` 껍데기 + 하단 이전/다음 버튼 + `<script src="script.js">`
- `C:\dev\jtm\style.css` — 카드/진행바/버튼/슬라이더/토글/피드백 박스 스타일 (first-task의 style.css를 기반으로 확장)
- `C:\dev\jtm\script.js` — 전역 상태, 순수 통계 함수, Canvas 시각화 함수, 단계별 `sN...()` 렌더/이벤트 함수, 네비게이션, 초기화. 섹션 주석 `/* ===== Task N: ... ===== */`로 구분

---

### Task 1: 프로젝트 골격 — 상태·네비게이션·기본 스타일

**Files:**
- Create: `C:\dev\jtm\index.html`
- Create: `C:\dev\jtm\style.css`
- Create: `C:\dev\jtm\script.js`

**Interfaces:**
- Produces: 전역 `state` 객체, `subscribe(fn)`/`notify()` pub-sub, `goToStep(n)`, `saveState()`/`loadState()`, `STORAGE_KEY`, `TOTAL_STEPS = 10`

- [ ] **Step 1: index.html 기본 구조 작성**

`C:\dev\jtm\index.html`:

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>모평균의 추정 — 인터랙티브 학습</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
<link rel="stylesheet" href="style.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<script>
window.MathJax = { tex: { inlineMath: [['$', '$']] } };
</script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" defer></script>
</head>
<body>

<header class="site-header">
  <h1>모평균의 추정</h1>
  <ol class="progress-bar" id="progressBar">
    <li data-step="1"><span class="dot">1</span><span class="label">탐구 상황</span></li>
    <li data-step="2"><span class="dot">2</span><span class="label">점추정의 한계</span></li>
    <li data-step="3"><span class="dot">3</span><span class="label">구간추정의 필요성</span></li>
    <li data-step="4"><span class="dot">4</span><span class="label">구간과 포함정도</span></li>
    <li data-step="5"><span class="dot">5</span><span class="label">신뢰도의 의미</span></li>
    <li data-step="6"><span class="dot">6</span><span class="label">공식 유도</span></li>
    <li data-step="7"><span class="dot">7</span><span class="label">표본 신뢰구간</span></li>
    <li data-step="8"><span class="dot">8</span><span class="label">반복 시뮬레이션</span></li>
    <li data-step="9"><span class="dot">9</span><span class="label">표본크기 영향</span></li>
    <li data-step="10"><span class="dot">10</span><span class="label">적용하기</span></li>
  </ol>
</header>

<main>
  <section class="step" id="step-1" data-step="1"></section>
  <section class="step" id="step-2" data-step="2"></section>
  <section class="step" id="step-3" data-step="3"></section>
  <section class="step" id="step-4" data-step="4"></section>
  <section class="step" id="step-5" data-step="5"></section>
  <section class="step" id="step-6" data-step="6"></section>
  <section class="step" id="step-7" data-step="7"></section>
  <section class="step" id="step-8" data-step="8"></section>
  <section class="step" id="step-9" data-step="9"></section>
  <section class="step" id="step-10" data-step="10"></section>
</main>

<footer class="nav-buttons">
  <button class="btn-secondary" id="prevBtn">이전</button>
  <span id="stepIndicator" class="step-indicator">1 / 10</span>
  <button class="btn-primary" id="nextBtn">다음</button>
</footer>

<script src="script.js"></script>
</body>
</html>
```

- [ ] **Step 2: style.css 작성 (first-task 스타일 기반)**

`C:\dev\jtm\style.css`:

```css
* { box-sizing: border-box; }

:root {
  --surface: #fcfcfb;
  --page: #f9f9f7;
  --ink: #0b0b0b;
  --ink-secondary: #52514e;
  --ink-muted: #898781;
  --gridline: #e1e0d9;
  --axis: #c3c2b7;
  --border: rgba(11, 11, 11, 0.10);
  --blue: #2a78d6;
  --orange: #eb6834;
  --blue-wash: rgba(42, 120, 214, 0.10);
  --good: #0ca30c;
  --critical: #d03b3b;
  --radius: 10px;
}

body {
  margin: 0;
  font-family: 'Pretendard', system-ui, sans-serif;
  background: var(--page);
  color: var(--ink);
  line-height: 1.6;
}

.site-header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 20px 16px 12px;
  text-align: center;
}
.site-header h1 { margin: 0 0 16px; font-size: 1.5rem; }

.progress-bar {
  list-style: none;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0 auto;
  padding: 0;
  max-width: 900px;
}
.progress-bar li {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1 1 74px;
  min-width: 74px;
  opacity: 0.45;
  cursor: pointer;
}
.progress-bar li:hover { opacity: 0.75; }
.progress-bar li.active, .progress-bar li.done { opacity: 1; }
.progress-bar .dot {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--gridline); color: var(--ink-secondary);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.85rem; font-weight: 600;
}
.progress-bar li.active .dot { background: var(--blue); color: #fff; }
.progress-bar li.done .dot { background: var(--good); color: #fff; }
.progress-bar .label { font-size: 0.68rem; color: var(--ink-muted); text-align: center; word-break: keep-all; }

main { max-width: 760px; margin: 0 auto; padding: 24px 16px 100px; }
.step { display: none; }
.step.active { display: block; }
.step h2 { font-size: 1.25rem; margin: 0 0 16px; }

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px 20px;
  margin-bottom: 16px;
}
.card p { margin: 0 0 10px; }
.card p:last-child { margin-bottom: 0; }

.hint { font-size: 0.85rem; color: var(--ink-muted); }
.hidden { display: none !important; }

.reflect-card { background: var(--blue-wash); border-color: var(--blue); }

.controls-card { display: flex; flex-direction: column; gap: 14px; }
.control-row { display: flex; flex-direction: column; gap: 6px; }
.control-row label { font-size: 0.9rem; color: var(--ink-secondary); font-weight: 600; }
input[type="range"] { width: 100%; accent-color: var(--blue); }
input[type="number"] {
  padding: 8px 10px; font-size: 1rem;
  border: 1px solid var(--axis); border-radius: 6px; width: 120px;
}
textarea {
  width: 100%; padding: 10px 12px; font-family: inherit; font-size: 0.95rem;
  border: 1px solid var(--axis); border-radius: 8px; resize: vertical;
}

.toggle-row { flex-direction: row; align-items: center; justify-content: space-between; }
.toggle-group { display: inline-flex; border: 1px solid var(--axis); border-radius: 8px; overflow: hidden; }
.toggle-btn { border: none; background: var(--surface); color: var(--ink-secondary); padding: 8px 16px; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
.toggle-btn.active { background: var(--blue); color: #fff; }

.btn-primary, .btn-secondary {
  border: none; border-radius: 8px; padding: 11px 18px;
  font-size: 0.95rem; font-weight: 600; cursor: pointer; font-family: inherit; margin-right: 8px;
}
.btn-primary { background: var(--blue); color: #fff; }
.btn-primary:hover { background: #2266ba; }
.btn-secondary { background: var(--surface); color: var(--ink-secondary); border: 1px solid var(--axis); }
.btn-secondary:hover { background: var(--gridline); }
.btn-primary:disabled, .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

.feedback { margin-top: 14px; padding: 12px 14px; border-radius: 8px; font-size: 0.92rem; }
.feedback.correct { background: rgba(12,163,12,0.10); border: 1px solid var(--good); color: #0a5c0a; }
.feedback.incorrect { background: rgba(208,59,59,0.10); border: 1px solid var(--critical); color: #8f2626; }

.mcq { display: flex; flex-direction: column; gap: 8px; margin: 12px 0; }
.mcq-option { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border: 1px solid var(--axis); border-radius: 8px; cursor: pointer; font-size: 0.92rem; }
.mcq-option:has(input:checked) { border-color: var(--blue); background: var(--blue-wash); }

canvas { max-width: 100%; height: auto; display: block; }
.scroll-box { max-height: 280px; overflow-y: auto; }
table { border-collapse: collapse; width: 100%; }
table th, table td { border: 1px solid var(--gridline); padding: 6px 10px; text-align: center; font-size: 14px; }
table th { position: sticky; top: 0; background: var(--surface); }

.summary-text { margin-top: 10px; font-size: 0.9rem; color: var(--ink-secondary); text-align: center; }
.legend-row { display: flex; justify-content: center; gap: 18px; flex-wrap: wrap; font-size: 0.82rem; color: var(--ink-secondary); margin-top: 6px; }
.legend-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: middle; }

.nav-buttons {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: var(--surface); border-top: 1px solid var(--border);
  padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;
  max-width: 760px; margin: 0 auto;
}
.step-indicator { font-size: 0.9rem; color: var(--ink-muted); font-weight: 600; }

@media (max-width: 480px) {
  .site-header h1 { font-size: 1.2rem; }
  .progress-bar .label { display: none; }
  .card { padding: 14px 16px; }
  main { padding: 16px 12px 100px; }
}
```

- [ ] **Step 3: script.js — 상태 객체, 저장/복원, 네비게이션 작성**

`C:\dev\jtm\script.js` (파일 시작 부분):

```js
(function () {
  "use strict";

  /* ===== Task 1: 전역 상태 · 저장/복원 · 단계 네비게이션 ===== */

  const TOTAL_STEPS = 10;
  const STORAGE_KEY = "moe-mean-estimation-v1";

  function defaultState() {
    return {
      currentStep: 1,
      mu: 240, sigma: 40, populationSize: 1000, seed: null,
      population: [],
      meanRevealed: false,

      predictMean: null,

      s2SampleSize: 20,
      s2History: [],

      s3Text: "",

      s4Margin: 5,
      s4Single: null,
      s4Batch: [],
      s4Explored: {},

      s6Target: 95,
      s6Z: 0,
      s6Found95: false,
      s6Found99: false,

      s6DerivLevel: 95,
      s6DerivLine: 0,

      sampleSize: 20,
      confidenceLevel: 95,
      currentSample: null,

      history: [],
      tab8ViewMode: "95",
      simulationPaused: false,

      s9Explored: {},

      s10Text: "",
    };
  }

  let state = defaultState();
  const listeners = [];
  function subscribe(fn) { listeners.push(fn); }
  function notify() { listeners.forEach(function (fn) { fn(); }); }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = Object.assign(defaultState(), parsed);
      }
    } catch (e) {
      state = defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* localStorage 사용 불가 시 조용히 무시 */ }
  }

  function goToStep(n) {
    n = Math.max(1, Math.min(TOTAL_STEPS, n));
    state.currentStep = n;
    document.querySelectorAll(".step").forEach(function (sec) {
      sec.classList.toggle("active", Number(sec.dataset.step) === n);
    });
    document.querySelectorAll("#progressBar li").forEach(function (li) {
      const s = Number(li.dataset.step);
      li.classList.toggle("active", s === n);
      li.classList.toggle("done", s < n);
    });
    document.getElementById("stepIndicator").textContent = n + " / " + TOTAL_STEPS;
    document.getElementById("prevBtn").disabled = n === 1;
    document.getElementById("nextBtn").disabled = n === TOTAL_STEPS;
    saveState();
    window.scrollTo(0, 0);
  }

  function initNavEvents() {
    document.getElementById("prevBtn").addEventListener("click", function () { goToStep(state.currentStep - 1); });
    document.getElementById("nextBtn").addEventListener("click", function () { goToStep(state.currentStep + 1); });
    document.querySelectorAll("#progressBar li").forEach(function (li) {
      li.addEventListener("click", function () { goToStep(Number(li.dataset.step)); });
    });
  }

  (function selfTestNavigation() {
    // goToStep의 경계값 로직만 순수하게 재현해 검증 (DOM 없이)
    function clamp(n) { return Math.max(1, Math.min(TOTAL_STEPS, n)); }
    console.assert(clamp(0) === 1, "0 이하는 1로 고정");
    console.assert(clamp(11) === TOTAL_STEPS, TOTAL_STEPS + " 초과는 " + TOTAL_STEPS + "로 고정");
    console.assert(clamp(5) === 5, "범위 내 값은 그대로");
    console.log("selfTestNavigation passed");
  })();
```

- [ ] **Step 4: 순수 로직(clamp 경계값) node로 검증**

Run:
```bash
node -e "
function clamp(n, total) { return Math.max(1, Math.min(total, n)); }
console.assert(clamp(0, 10) === 1, 'fail: 0 -> 1');
console.assert(clamp(11, 10) === 10, 'fail: 11 -> 10');
console.assert(clamp(5, 10) === 5, 'fail: 5 -> 5');
console.log('clamp logic OK');
"
```
Expected: `clamp logic OK` 출력, assert 실패 없음

- [ ] **Step 5: 브라우저에서 골격 확인**

`C:\dev\jtm\index.html`을 더블클릭해서 열고: 진행바가 10개 표시되는지, "이전"/"다음" 버튼과 "1 / 10" 표시가 있는지, 개발자도구 콘솔에 `selfTestNavigation passed`가 뜨고 빨간 에러가 없는지 확인 (아직 `initNavEvents()`/`goToStep(1)` 호출부는 Task 13에서 최종 연결하므로, 이 시점엔 버튼이 아직 동작하지 않아도 정상)

- [ ] **Step 6: 커밋**

```bash
cd "C:/dev/jtm"
git init
git add index.html style.css script.js
git commit -m "프로젝트 골격: 상태 객체, 단계 네비게이션, 기본 스타일"
```

---

### Task 2: 핵심 통계 함수 이식

**Files:**
- Modify: `C:\dev\jtm\script.js` (Task 1의 IIFE 내부, `/* ===== Task 1 ===== */` 블록 다음에 이어씀)

**Interfaces:**
- Consumes: 없음 (순수 함수)
- Produces: `mulberry32(seed)`, `createRng(seed)`, `randomNormal(rng, mean, sd)`, `generatePopulation(mu, sigma, size, seed)`, `mean(values)`, `stdDev(values)`, `sampleWithReplacement(population, n, rng)`, `Z_VALUES = {95:1.96, 99:2.58}`, `marginOfError(sigma, n, confidenceLevel)`, `confidenceInterval(sampleMean, sigma, n, confidenceLevel)`, `containsMean(interval, mu)`

- [ ] **Step 1: withjm 코드를 그대로 이식**

`script.js`에 추가 (Task 1 블록 뒤):

```js
  /* ===== Task 2: 핵심 통계 함수 (withjm 이식) ===== */

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createRng(seed) {
    if (seed === null || seed === undefined || seed === "") return Math.random;
    return mulberry32(Number(seed));
  }

  function randomNormal(rng, meanValue, sd) {
    let u1 = 0;
    while (u1 === 0) u1 = rng();
    const u2 = rng();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return meanValue + sd * z0;
  }

  function generatePopulation(mu, sigma, size, seed) {
    const rng = createRng(seed);
    const population = [];
    for (let i = 0; i < size; i++) {
      const minutes = Math.round(randomNormal(rng, mu, sigma));
      population.push({ id: "S" + String(i + 1).padStart(4, "0"), minutes: minutes });
    }
    return population;
  }

  function mean(values) {
    return values.reduce(function (a, b) { return a + b; }, 0) / values.length;
  }

  function stdDev(values) {
    const m = mean(values);
    const variance = values.reduce(function (a, b) { return a + Math.pow(b - m, 2); }, 0) / values.length;
    return Math.sqrt(variance);
  }

  function sampleWithReplacement(population, n, rng) {
    rng = rng || Math.random;
    const sample = [];
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(rng() * population.length);
      sample.push(population[idx]);
    }
    return sample;
  }

  const Z_VALUES = { 95: 1.96, 99: 2.58 };

  function marginOfError(sigma, n, confidenceLevel) {
    return Z_VALUES[confidenceLevel] * (sigma / Math.sqrt(n));
  }

  function confidenceInterval(sampleMean, sigma, n, confidenceLevel) {
    const me = marginOfError(sigma, n, confidenceLevel);
    return { lower: sampleMean - me, upper: sampleMean + me, marginOfError: me, z: Z_VALUES[confidenceLevel] };
  }

  function containsMean(interval, mu) {
    return mu >= interval.lower && mu <= interval.upper;
  }

  (function selfTestStats() {
    const pop = generatePopulation(240, 40, 1000, 42);
    console.assert(pop.length === 1000, "population size should be 1000");
    console.assert(Math.abs(mean(pop.map(function (p) { return p.minutes; })) - 240) < 5, "population mean near 240");
    console.assert(Z_VALUES[95] === 1.96 && Z_VALUES[99] === 2.58, "z values correct");

    const me = marginOfError(40, 25, 95);
    console.assert(Math.abs(me - (1.96 * 40 / 5)) < 1e-9, "margin of error correct: " + me);

    const ci = confidenceInterval(250, 40, 25, 95);
    console.assert(Math.abs(ci.lower - (250 - me)) < 1e-9, "CI lower correct");
    console.assert(containsMean(ci, 240) === (240 >= ci.lower && 240 <= ci.upper), "containsMean matches manual check");

    const sample = sampleWithReplacement(pop, 10, createRng(1));
    console.assert(sample.length === 10, "sample size 10");

    console.log("selfTestStats passed");
  })();
```

- [ ] **Step 2: node로 순수 함수 검증**

Run:
```bash
node -e "
function mulberry32(seed){return function(){seed|=0;seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function createRng(seed){if(seed===null||seed===undefined||seed==='')return Math.random;return mulberry32(Number(seed));}
function randomNormal(rng,meanValue,sd){let u1=0;while(u1===0)u1=rng();const u2=rng();const z0=Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);return meanValue+sd*z0;}
function generatePopulation(mu,sigma,size,seed){const rng=createRng(seed);const population=[];for(let i=0;i<size;i++){const minutes=Math.round(randomNormal(rng,mu,sigma));population.push({id:'S'+String(i+1).padStart(4,'0'),minutes:minutes});}return population;}
function mean(values){return values.reduce((a,b)=>a+b,0)/values.length;}
const Z_VALUES={95:1.96,99:2.58};
function marginOfError(sigma,n,cl){return Z_VALUES[cl]*(sigma/Math.sqrt(n));}
const pop=generatePopulation(240,40,1000,42);
console.assert(pop.length===1000,'fail: size');
console.assert(Math.abs(mean(pop.map(p=>p.minutes))-240)<5,'fail: mean near 240');
console.assert(Math.abs(marginOfError(40,25,95)-(1.96*40/5))<1e-9,'fail: ME');
console.log('stats functions OK');
"
```
Expected: `stats functions OK` 출력, assert 실패 없음

- [ ] **Step 3: 브라우저 콘솔에서 `selfTestStats passed` 확인**

`index.html`을 열고 개발자도구(F12) 콘솔에서 `selfTestStats passed` 로그와 에러 없음을 확인

- [ ] **Step 4: 커밋**

```bash
cd "C:/dev/jtm"
git add script.js
git commit -m "핵심 통계 함수 이식: 모집단 생성, 표본추출, 신뢰구간 계산"
```

---

### Task 3: 공용 Canvas 시각화 함수 (히스토그램 · 산점도 · 신뢰구간 판정 막대)

**Files:**
- Modify: `C:\dev\jtm\script.js`

**Interfaces:**
- Consumes: `mean`, `stdDev`, `containsMean` (Task 2)
- Produces: `drawHistogram(canvas, population, mu, sigma, revealMu)`, `drawDotPlot(canvas, population, highlightIds)`, `drawIntervalLine(canvas, interval, mu, sampleMean, revealMu)`

**중요:** withjm 원본의 `drawHistogram`/`drawIntervalLine`은 `mu`를 항상 숫자로 그렸다. 여기서는 `revealMu` 인자를 추가해 `false`면 점선 + "실제 모평균 위치 (비공개)" 라벨만, `true`면 기존처럼 숫자 라벨을 그리도록 확장한다.

- [ ] **Step 1: drawDotPlot 이식 (withjm과 동일, 변경 없음)**

```js
  /* ===== Task 3: 공용 Canvas 시각화 함수 ===== */

  function drawDotPlot(canvas, population, highlightIds) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const values = population.map(function (p) { return p.minutes; });
    const min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    const chartW = canvas.width - 60;
    const originX = 30;
    const bottomMargin = 34;
    const highlightSet = new Set(highlightIds || []);
    const colHeights = {};
    const positions = [];

    population.forEach(function (p) {
      const x = Math.round(originX + ((p.minutes - min) / (max - min)) * chartW);
      colHeights[x] = (colHeights[x] || 0) + 1;
      const y = canvas.height - bottomMargin - colHeights[x] * 4;
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = highlightSet.has(p.id) ? "#2563EB" : "#CBD5E1";
      ctx.fill();
      positions.push({ id: p.id, minutes: p.minutes, x: x, y: y });
    });

    ctx.strokeStyle = "#94A3B8";
    ctx.beginPath();
    ctx.moveTo(originX, canvas.height - bottomMargin + 6);
    ctx.lineTo(originX + chartW, canvas.height - bottomMargin + 6);
    ctx.stroke();

    ctx.fillStyle = "#64748B";
    ctx.font = "10px Pretendard, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(Math.round(min) + "분", originX, canvas.height - bottomMargin + 18);
    ctx.textAlign = "right";
    ctx.fillText(Math.round(max) + "분", originX + chartW, canvas.height - bottomMargin + 18);
    ctx.textAlign = "left";

    return positions;
  }
```

- [ ] **Step 2: drawHistogram 이식 + revealMu 파라미터 추가**

```js
  function drawHistogram(canvas, population, mu, sigma, revealMu) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const values = population.map(function (p) { return p.minutes; });
    const min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    const binCount = 30;
    const binWidth = (max - min) / binCount;
    const bins = new Array(binCount).fill(0);
    values.forEach(function (v) {
      let idx = Math.floor((v - min) / binWidth);
      if (idx >= binCount) idx = binCount - 1;
      bins[idx]++;
    });
    const maxBin = Math.max.apply(null, bins);
    const chartW = canvas.width - 76, chartH = canvas.height - 56;
    const originX = 56, originY = canvas.height - 40;

    ctx.fillStyle = "#2563EB";
    bins.forEach(function (count, i) {
      const barH = (count / maxBin) * chartH;
      const x = originX + (i / binCount) * chartW;
      const w = chartW / binCount - 2;
      ctx.fillRect(x, originY - barH, w, barH);
    });

    function xForValue(v) { return originX + ((v - min) / (max - min)) * chartW; }

    if (revealMu) {
      ctx.strokeStyle = "#1E293B";
      ctx.beginPath();
      ctx.moveTo(xForValue(mu), originY);
      ctx.lineTo(xForValue(mu), originY - chartH);
      ctx.stroke();
    }

    ctx.strokeStyle = "#94A3B8";
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX + chartW, originY);
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX, originY - chartH);
    ctx.stroke();

    ctx.fillStyle = "#64748B";
    ctx.font = "10px Pretendard, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(Math.round(min), xForValue(min), originY + 14);
    ctx.fillText(Math.round(max), xForValue(max), originY + 14);
    if (revealMu) ctx.fillText(Math.round(mu), xForValue(mu), originY + 14);
    ctx.font = "12px Pretendard, sans-serif";
    ctx.fillText("사용시간 (분)", originX + chartW / 2, originY + 30);

    ctx.save();
    ctx.translate(16, originY - chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("도수 (명)", 0, 0);
    ctx.restore();
    ctx.textAlign = "left";
  }
```

- [ ] **Step 3: drawIntervalLine 이식 + revealMu 파라미터 추가**

```js
  function drawIntervalLine(canvas, interval, mu, sampleMean, revealMu) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const margin = 60;
    const span = Math.max(interval.upper - interval.lower, 1) * 3;
    const min = interval.lower - span, max = interval.upper + span;
    const chartW = canvas.width - margin * 2;
    function xFor(v) { return margin + ((v - min) / (max - min)) * chartW; }

    const contains = containsMean(interval, mu);
    ctx.strokeStyle = contains ? "#16A34A" : "#DC2626";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(xFor(interval.lower), 60);
    ctx.lineTo(xFor(interval.upper), 60);
    ctx.stroke();
    ctx.lineWidth = 1;

    if (typeof sampleMean === "number") {
      ctx.strokeStyle = "#FACC15";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(xFor(sampleMean), 48);
      ctx.lineTo(xFor(sampleMean), 72);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = "#92400E";
      ctx.font = "11px Pretendard, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("표본평균", xFor(sampleMean), 84);
      ctx.textAlign = "left";
    }

    ctx.strokeStyle = "#1E293B";
    if (!revealMu) { ctx.setLineDash([5, 5]); }
    ctx.beginPath();
    ctx.moveTo(xFor(mu), 20);
    ctx.lineTo(xFor(mu), 100);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#1E293B";
    ctx.font = "bold 14px Pretendard, sans-serif";
    ctx.textAlign = "center";
    const label = revealMu ? ("모평균 " + mu) : "실제 모평균 위치 (비공개)";
    ctx.fillText(label, xFor(mu), 14);
    ctx.textAlign = "left";
  }
```

- [ ] **Step 4: node로 xFor/라벨 분기 로직만 순수하게 검증**

Run:
```bash
node -e "
function labelFor(revealMu, mu) { return revealMu ? ('모평균 ' + mu) : '실제 모평균 위치 (비공개)'; }
console.assert(labelFor(false, 240) === '실제 모평균 위치 (비공개)', 'fail: hidden label');
console.assert(labelFor(true, 240) === '모평균 240', 'fail: revealed label');
console.log('reveal label logic OK');
"
```
Expected: `reveal label logic OK`

- [ ] **Step 5: 커밋**

```bash
cd "C:/dev/jtm"
git add script.js
git commit -m "공용 Canvas 시각화 함수 이식: 히스토그램, 산점도, 신뢰구간 막대(비공개 라벨 지원)"
```

---

### Task 4: 1단계 화면 — 현실적 탐구 상황

**Files:**
- Modify: `C:\dev\jtm\index.html` (`#step-1` 내부 채우지 않음 — innerHTML은 script.js에서 주입)
- Modify: `C:\dev\jtm\script.js`

**Interfaces:**
- Consumes: `generatePopulation`, `sampleWithReplacement`, `state`, `saveState`
- Produces: `initPopulation()`, `s1Render()`, 예시 표본 상수 `SAMPLE_PREVIEW_IDS`(1단계에서 보여줄 학생 5명)

- [ ] **Step 1: 모집단 초기화 함수 작성**

```js
  /* ===== Task 4: 1단계 — 현실적 탐구 상황 ===== */

  function initPopulation() {
    if (state.population.length === 0) {
      state.population = generatePopulation(state.mu, state.sigma, state.populationSize, state.seed);
    }
  }
```

- [ ] **Step 2: 1단계 화면 HTML/렌더 함수 작성**

```js
  function s1Render() {
    const container = document.getElementById("step-1");
    const previewSample = state.population.slice(0, 5);
    container.innerHTML =
      '<h2>1. 탐구 상황</h2>' +
      '<div class="card">' +
        '<p>우리 학교 고등학생 1,000명의 <strong>하루 스마트폰 사용시간(분)</strong>이 궁금합니다. ' +
        '하지만 1,000명 전체를 다 조사하는 건 시간과 비용이 많이 듭니다.</p>' +
        '<p>그래서 담당 선생님은 <strong>학생 몇 명만 무작위로 뽑아</strong> 사용시간을 먼저 살펴보기로 했습니다.</p>' +
      '</div>' +
      '<div class="card">' +
        '<p><strong>미리 뽑아본 학생 ' + previewSample.length + '명</strong></p>' +
        '<table><tr><th>ID</th><th>사용시간(분)</th></tr>' +
        previewSample.map(function (s) { return "<tr><td>" + s.id + "</td><td>" + s.minutes + "</td></tr>"; }).join("") +
        '</table>' +
      '</div>' +
      '<div class="card predict-card">' +
        '<label for="s1-predict">이 몇 명의 자료를 보고, <strong>학교 전체 학생 1,000명의 평균 사용시간</strong>은 몇 분쯤일 것 같나요?</label>' +
        '<div class="predict-row" style="display:flex;align-items:center;gap:8px;margin:10px 0;">' +
          '<input type="number" id="s1-predict" min="0" max="600" step="1" placeholder="예: 200">' +
          '<span>분</span>' +
        '</div>' +
        '<p class="hint">정답을 맞히는 활동이 아닙니다. 여러분의 예상을 적어두면, 뒤에서 실제 값을 확인할 때 비교해볼 수 있어요.</p>' +
      '</div>';

    const predictInput = document.getElementById("s1-predict");
    if (state.predictMean !== null && state.predictMean !== undefined) {
      predictInput.value = state.predictMean;
    }
    predictInput.addEventListener("input", function (e) {
      state.predictMean = e.target.value === "" ? null : Number(e.target.value);
      saveState();
    });
  }
```

- [ ] **Step 3: node로 previewSample 슬라이스 로직 검증**

Run:
```bash
node -e "
const pop = [];
for (let i = 0; i < 1000; i++) pop.push({ id: 'S' + i, minutes: 200 + i % 50 });
const preview = pop.slice(0, 5);
console.assert(preview.length === 5, 'fail: preview length');
console.assert(preview[0].id === 'S0', 'fail: first id');
console.log('preview slice OK');
"
```
Expected: `preview slice OK`

- [ ] **Step 4: 브라우저에서 확인**

`script.js` 맨 끝에 임시로 `initPopulation(); s1Render(); goToStep(1); initNavEvents();`를 추가하고 `index.html`을 열어 1단계 카드 3개(서사, 예시표, 예측 입력)가 보이는지, 입력 후 새로고침해도 값이 남아있는지(localStorage) 확인. 확인 후 이 임시 호출부는 Task 13에서 정식 `init()`으로 교체되므로 그대로 둬도 됨(중복 호출 방지는 Task 13에서 정리)

- [ ] **Step 5: 커밋**

```bash
cd "C:/dev/jtm"
git add script.js
git commit -m "1단계 화면: 현실적 탐구 상황"
```

---

### Task 5: 2·3단계 화면 — 점추정의 한계 + 구간추정의 필요성

**Files:**
- Modify: `C:\dev\jtm\script.js`

**Interfaces:**
- Consumes: `state.population`, `sampleWithReplacement`, `mean`, `state.s2History`, `state.s3Text`
- Produces: `s2Render()`, `s2DrawSample()`, `drawMeanDotPlot(canvas, means)`, `s3Render()`

- [ ] **Step 1: 표본평균 누적 점도표 함수 작성 (drawDotPlot 패턴 재사용, 값이 population이 아니라 숫자 배열)**

```js
  /* ===== Task 5: 2·3단계 — 점추정의 한계 · 구간추정의 필요성 ===== */

  function drawMeanDotPlot(canvas, means) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (means.length === 0) return;
    const min = Math.min.apply(null, means) - 5, max = Math.max.apply(null, means) + 5;
    const chartW = canvas.width - 60;
    const originX = 30;
    const bottomMargin = 34;
    const colHeights = {};

    means.forEach(function (v, i) {
      const x = Math.round(originX + ((v - min) / (max - min)) * chartW);
      colHeights[x] = (colHeights[x] || 0) + 1;
      const y = canvas.height - bottomMargin - colHeights[x] * 6;
      const isLast = i === means.length - 1;
      ctx.beginPath();
      ctx.arc(x, y, isLast ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isLast ? "#2563EB" : "#93C5FD";
      ctx.fill();
    });

    ctx.strokeStyle = "#94A3B8";
    ctx.beginPath();
    ctx.moveTo(originX, canvas.height - bottomMargin + 6);
    ctx.lineTo(originX + chartW, canvas.height - bottomMargin + 6);
    ctx.stroke();
    ctx.fillStyle = "#64748B";
    ctx.font = "12px Pretendard, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("표본평균 (분)", canvas.width / 2, canvas.height - 4);
    ctx.textAlign = "left";
  }
```

- [ ] **Step 2: 2단계 렌더/추출 함수 작성**

```js
  function s2DrawSample() {
    const sample = sampleWithReplacement(state.population, state.s2SampleSize, Math.random);
    const sampleMean = mean(sample.map(function (s) { return s.minutes; }));
    state.s2History.push(sampleMean);
    saveState();
    s2Render();
  }

  function s2Render() {
    const container = document.getElementById("step-2");
    container.innerHTML =
      '<h2>2. 점추정의 한계</h2>' +
      '<div class="card">' +
        '<p>같은 방법으로 학생 ' + state.s2SampleSize + '명을 여러 번 뽑아 표본평균을 계산해봅시다. 뽑을 때마다 표본평균이 어떻게 달라지는지 관찰해보세요.</p>' +
      '</div>' +
      '<div class="card controls-card">' +
        '<button class="btn-primary" id="s2-draw">표본 1개 뽑기</button>' +
        '<button class="btn-secondary" id="s2-reset">초기화</button>' +
      '</div>' +
      '<div class="card"><canvas id="s2-chart" width="600" height="170"></canvas>' +
        '<p id="s2-summary" class="summary-text"></p></div>' +
      '<div class="card reflect-card">' +
        '<p>표본을 뽑을 때마다 표본평균 값이 계속 달라집니다. 그렇다면 이 값들 중 어느 하나가 정확히 "진짜" 모평균이라고 확신할 수 있을까요?</p>' +
      '</div>';

    const canvas = document.getElementById("s2-chart");
    if (state.s2History.length === 0) {
      const summary = document.getElementById("s2-summary");
      summary.textContent = '아직 표본을 뽑지 않았습니다. "표본 1개 뽑기" 버튼을 눌러보세요.';
    } else {
      drawMeanDotPlot(canvas, state.s2History);
      const last = state.s2History[state.s2History.length - 1];
      document.getElementById("s2-summary").textContent =
        "지금까지 " + state.s2History.length + "번 뽑았습니다. 이번 표본평균: " + last.toFixed(1) + "분";
    }

    document.getElementById("s2-draw").addEventListener("click", s2DrawSample);
    document.getElementById("s2-reset").addEventListener("click", function () {
      state.s2History = [];
      saveState();
      s2Render();
    });
  }
```

- [ ] **Step 3: 3단계 렌더 함수 작성**

```js
  function s3Render() {
    const container = document.getElementById("step-3");
    container.innerHTML =
      '<h2>3. 구간추정의 필요성</h2>' +
      '<div class="card">' +
        '<p>방금 확인했듯, 표본평균 하나(점추정)는 뽑을 때마다 달라집니다. 그렇다면 모평균을 <strong>하나의 값이 아니라 일정한 범위(구간)</strong>로 추정하면 어떤 점이 더 나을까요? 자유롭게 생각을 적어보세요.</p>' +
        '<textarea id="s3-text" rows="4" placeholder="예: 표본평균이 매번 달라지니까..."></textarea>' +
      '</div>';

    const textarea = document.getElementById("s3-text");
    textarea.value = state.s3Text || "";
    textarea.addEventListener("input", function (e) {
      state.s3Text = e.target.value;
      saveState();
    });
  }
```

- [ ] **Step 4: node로 drawMeanDotPlot의 min/max 계산 로직만 검증**

Run:
```bash
node -e "
const means = [195, 210, 240, 205];
const min = Math.min.apply(null, means) - 5, max = Math.max.apply(null, means) + 5;
console.assert(min === 190, 'fail: min');
console.assert(max === 245, 'fail: max');
console.log('mean dot plot range OK');
"
```
Expected: `mean dot plot range OK`

- [ ] **Step 5: 브라우저에서 확인**

`s2Render()`, `s3Render()`를 Task 4의 임시 호출부 옆에 추가 호출해두고, 진행바에서 2·3단계를 클릭해 이동 → "표본 1개 뽑기"를 여러 번 눌러 점이 누적되는지, "초기화"가 동작하는지, 3단계 텍스트 입력이 저장되는지 확인

- [ ] **Step 6: 커밋**

```bash
cd "C:/dev/jtm"
git add script.js
git commit -m "2·3단계 화면: 점추정의 한계, 구간추정의 필요성"
```

---

### Task 6: 4단계 화면 — 구간 길이와 포함 정도 탐구

**Files:**
- Modify: `C:\dev\jtm\script.js`

**Interfaces:**
- Consumes: `sampleWithReplacement`, `mean`, `containsMean`, `state.s4Margin/s4Single/s4Batch/s4Explored`
- Produces: `computeMarginInterval(sampleMean, marginMinutes)`, `s4DrawSingle()`, `s4RunBatch()`, `drawMarginBatchChart(canvas, batch, mu, revealMu)`, `drawTrendChart(canvas, explored, xLabel, yLabel, xRange, yRange)`, `s4Render()`

- [ ] **Step 1: 순수 계산 함수 작성**

```js
  /* ===== Task 6: 4단계 — 구간 길이와 포함 정도 탐구 ===== */

  function computeMarginInterval(sampleMean, marginMinutes) {
    return { lower: sampleMean - marginMinutes, upper: sampleMean + marginMinutes, marginMinutes: marginMinutes };
  }
```

- [ ] **Step 2: node로 computeMarginInterval 검증**

Run:
```bash
node -e "
function computeMarginInterval(sampleMean, marginMinutes) {
  return { lower: sampleMean - marginMinutes, upper: sampleMean + marginMinutes, marginMinutes: marginMinutes };
}
const iv = computeMarginInterval(230, 10);
console.assert(iv.lower === 220 && iv.upper === 240, 'fail: margin interval');
console.log('computeMarginInterval OK');
"
```
Expected: `computeMarginInterval OK`

- [ ] **Step 3: 배치 결과 시각화(막대 여러 개) + 추이 그래프 함수 작성 (범용화해서 9단계에서도 재사용)**

```js
  function drawMarginBatchChart(canvas, batch, mu, revealMu) {
    const ctx = canvas.getContext("2d");
    const rowH = Math.max(4, Math.min(16, 220 / Math.max(batch.length, 1)));
    const topPad = 26, bottomPad = 30, leftPad = 44, rightPad = 12;
    canvas.height = Math.max(120, topPad + bottomPad + batch.length * rowH);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (batch.length === 0) return;

    const lowers = batch.map(function (b) { return b.lower; });
    const uppers = batch.map(function (b) { return b.upper; });
    const min = Math.min.apply(null, lowers.concat([mu])) - 5;
    const max = Math.max.apply(null, uppers.concat([mu])) + 5;
    const chartW = canvas.width - leftPad - rightPad;
    function xFor(v) { return leftPad + ((v - min) / (max - min)) * chartW; }

    batch.forEach(function (b, i) {
      const y = topPad + i * rowH + rowH / 2;
      ctx.strokeStyle = b.contains ? "#16A34A" : "#DC2626";
      ctx.lineWidth = Math.max(2, rowH - 3);
      ctx.beginPath();
      ctx.moveTo(xFor(b.lower), y);
      ctx.lineTo(xFor(b.upper), y);
      ctx.stroke();
    });
    ctx.lineWidth = 1;

    const muX = xFor(mu);
    ctx.strokeStyle = "#1E293B";
    if (!revealMu) ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(muX, topPad - 12);
    ctx.lineTo(muX, topPad + batch.length * rowH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#1E293B";
    ctx.font = "11px Pretendard, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(revealMu ? ("모평균 " + mu) : "실제 모평균 (비공개)", muX, topPad - 16);
    ctx.textAlign = "left";
  }

  function drawTrendChart(canvas, explored, xRange, yRange) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const keys = Object.keys(explored).map(Number).sort(function (a, b) { return a - b; });
    const leftPad = 40, rightPad = 20, topPad = 12, bottomPad = 30;
    const chartW = canvas.width - leftPad - rightPad, chartH = canvas.height - topPad - bottomPad;
    function xFor(v) { return leftPad + ((v - xRange[0]) / (xRange[1] - xRange[0])) * chartW; }
    function yFor(v) { return topPad + chartH - ((v - yRange[0]) / (yRange[1] - yRange[0])) * chartH; }

    ctx.strokeStyle = "#94A3B8";
    ctx.beginPath();
    ctx.moveTo(leftPad, topPad + chartH);
    ctx.lineTo(leftPad + chartW, topPad + chartH);
    ctx.moveTo(leftPad, topPad);
    ctx.lineTo(leftPad, topPad + chartH);
    ctx.stroke();

    if (keys.length > 1) {
      ctx.strokeStyle = "#2563EB";
      ctx.lineWidth = 2;
      ctx.beginPath();
      keys.forEach(function (k, i) {
        const x = xFor(k), y = yFor(explored[k]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    keys.forEach(function (k) {
      ctx.beginPath();
      ctx.arc(xFor(k), yFor(explored[k]), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#2563EB";
      ctx.fill();
    });
  }
```

- [ ] **Step 4: 4단계 렌더/이벤트 함수 작성**

```js
  function s4DrawSingle() {
    const sample = sampleWithReplacement(state.population, 20, Math.random);
    const sampleMean = mean(sample.map(function (s) { return s.minutes; }));
    state.s4Single = { sampleMean: sampleMean };
    saveState();
    s4Render();
  }

  function s4RunBatch() {
    const batch = [];
    for (let i = 0; i < 30; i++) {
      const sample = sampleWithReplacement(state.population, 20, Math.random);
      const sampleMean = mean(sample.map(function (s) { return s.minutes; }));
      const iv = computeMarginInterval(sampleMean, state.s4Margin);
      iv.contains = containsMean(iv, state.mu);
      batch.push(iv);
    }
    state.s4Batch = batch;
    const containCount = batch.filter(function (b) { return b.contains; }).length;
    state.s4Explored[state.s4Margin] = containCount / batch.length;
    saveState();
    s4Render();
  }

  function s4Render() {
    const container = document.getElementById("step-4");
    container.innerHTML =
      '<h2>4. 구간 길이와 모평균 포함 정도 탐구</h2>' +
      '<div class="card"><p>표본평균 ± 오차범위로 구간을 만들어봅시다. 오차범위를 바꾸면서, 만든 구간이 (아직 공개되지 않은) 실제 모평균을 포함하는 정도가 어떻게 달라지는지 관찰해보세요.</p></div>' +
      '<div class="card controls-card">' +
        '<div class="control-row"><label for="s4-margin">오차범위 (± <span id="s4-margin-val">' + state.s4Margin + '</span>분)</label>' +
        '<input type="range" id="s4-margin" min="1" max="40" step="1" value="' + state.s4Margin + '"></div>' +
        '<button class="btn-secondary" id="s4-draw">구간 1개 만들기</button>' +
        '<button class="btn-primary" id="s4-run">같은 방법으로 30번 반복하기</button>' +
      '</div>' +
      '<div class="card"><canvas id="s4-single-canvas" width="600" height="110"></canvas>' +
        '<p id="s4-single-summary" class="summary-text"></p></div>' +
      '<div class="card"><canvas id="s4-batch-canvas" width="600" height="200"></canvas>' +
        '<p id="s4-batch-summary" class="summary-text"></p></div>' +
      '<div class="card reflect-card"><p>오차범위를 넓히거나 좁히면 포함 비율이 어떻게 바뀌나요? 아래는 여러 번 실험한 결과입니다.</p>' +
        '<canvas id="s4-trend-canvas" width="600" height="90"></canvas></div>';

    document.getElementById("s4-margin").addEventListener("input", function (e) {
      state.s4Margin = Number(e.target.value);
      document.getElementById("s4-margin-val").textContent = state.s4Margin;
      saveState();
    });
    document.getElementById("s4-draw").addEventListener("click", s4DrawSingle);
    document.getElementById("s4-run").addEventListener("click", s4RunBatch);

    if (state.s4Single) {
      const iv = computeMarginInterval(state.s4Single.sampleMean, state.s4Margin);
      drawIntervalLine(document.getElementById("s4-single-canvas"), iv, state.mu, state.s4Single.sampleMean, false);
      document.getElementById("s4-single-summary").textContent =
        "표본평균 " + state.s4Single.sampleMean.toFixed(1) + "분 → 구간 [" + iv.lower.toFixed(1) + ", " + iv.upper.toFixed(1) + "]";
    }
    if (state.s4Batch.length > 0) {
      drawMarginBatchChart(document.getElementById("s4-batch-canvas"), state.s4Batch, state.mu, false);
      const containCount = state.s4Batch.filter(function (b) { return b.contains; }).length;
      document.getElementById("s4-batch-summary").textContent =
        "± " + state.s4Margin + "분 오차범위로 만든 " + state.s4Batch.length + "개 구간 중 " + containCount + "개가 실제 모평균을 포함했습니다.";
    }
    drawTrendChart(document.getElementById("s4-trend-canvas"), state.s4Explored, [1, 40], [0, 1]);
  }
```

- [ ] **Step 5: node로 배치 포함비율 계산 로직 검증**

Run:
```bash
node -e "
function containsMean(interval, mu) { return mu >= interval.lower && mu <= interval.upper; }
const batch = [{lower:230,upper:250},{lower:260,upper:280}];
const mu = 240;
batch.forEach(b => b.contains = containsMean(b, mu));
const count = batch.filter(b => b.contains).length;
console.assert(count === 1, 'fail: expected 1 containing interval, got ' + count);
console.log('batch containment logic OK');
"
```
Expected: `batch containment logic OK`

- [ ] **Step 6: 브라우저에서 확인**

4단계로 이동 → 슬라이더 조작 시 라벨이 바뀌는지, "구간 1개 만들기"/"30번 반복하기" 버튼 동작, 모평균 라벨이 항상 "실제 모평균 (비공개)"로만 뜨고 숫자 240이 안 보이는지(개발자도구로 캔버스 텍스트 확인 어려우면 육안으로 "비공개" 문구만 있는지 확인) 검증

- [ ] **Step 7: 커밋**

```bash
cd "C:/dev/jtm"
git add script.js
git commit -m "4단계 화면: 구간 길이와 모평균 포함 정도 탐구 (모평균 비공개 유지)"
```

---

### Task 7: 표준정규분포 넓이 계산 + 곡선 그리기 함수

**Files:**
- Modify: `C:\dev\jtm\script.js`

**Interfaces:**
- Consumes: 없음 (순수 함수 + Canvas)
- Produces: `normalPDF(x)`, `normalAreaBetween(z)`, `drawNormalCurveInteractive(canvas, z, revealFound)`

- [ ] **Step 1: normalPDF, 심슨법 수치적분 normalAreaBetween 작성**

```js
  /* ===== Task 7: 표준정규분포 넓이 계산 · 곡선 그리기 ===== */

  function normalPDF(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  // Simpson's rule로 -z ~ z 구간의 넓이(가운데 확률)를 근사 계산
  function normalAreaBetween(z) {
    if (z <= 0) return 0;
    const n = 200; // 짝수
    const a = -z, b = z;
    const h = (b - a) / n;
    let sum = normalPDF(a) + normalPDF(b);
    for (let i = 1; i < n; i++) {
      const x = a + i * h;
      sum += (i % 2 === 0 ? 2 : 4) * normalPDF(x);
    }
    return (h / 3) * sum;
  }
```

- [ ] **Step 2: node로 normalAreaBetween 정확도 검증 (z=1.96→0.95, z=2.58→0.99)**

Run:
```bash
node -e "
function normalPDF(x) { return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI); }
function normalAreaBetween(z) {
  if (z <= 0) return 0;
  const n = 200;
  const a = -z, b = z;
  const h = (b - a) / n;
  let sum = normalPDF(a) + normalPDF(b);
  for (let i = 1; i < n; i++) {
    const x = a + i * h;
    sum += (i % 2 === 0 ? 2 : 4) * normalPDF(x);
  }
  return (h / 3) * sum;
}
const a95 = normalAreaBetween(1.96);
const a99 = normalAreaBetween(2.58);
console.assert(Math.abs(a95 - 0.95) < 0.001, 'fail: z=1.96 area=' + a95);
console.assert(Math.abs(a99 - 0.99) < 0.001, 'fail: z=2.58 area=' + a99);
console.assert(normalAreaBetween(0) === 0, 'fail: z=0 area should be 0');
console.log('normalAreaBetween OK: 95%->' + a95.toFixed(4) + ', 99%->' + a99.toFixed(4));
"
```
Expected: `normalAreaBetween OK: 95%->0.9500, 99%->0.9901` (근사값 출력, 각 목표와 오차 0.001 이내)

- [ ] **Step 3: 표준정규분포 곡선 + 넓이 칠하기 그리는 함수 작성 (withjm의 drawNormalCurve 확장 — 고정 95/99 대신 임의 z를 받음)**

```js
  function drawNormalCurveInteractive(canvas, z, found) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const originX = canvas.width / 2, originY = canvas.height - 46;
    const scaleX = (canvas.width / 2 - 30) / 4;
    const scaleY = (canvas.height - 70) / 0.4;

    function xToPixel(x) { return originX + x * scaleX; }
    function yToPixel(y) { return originY - y * scaleY; }

    ctx.strokeStyle = "#1E293B";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = -4; x <= 4; x += 0.05) {
      const px = xToPixel(x), py = yToPixel(normalPDF(x));
      if (x === -4) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.lineWidth = 1;

    if (z > 0) {
      ctx.fillStyle = found ? "rgba(22, 163, 74, 0.35)" : "rgba(37, 99, 235, 0.3)";
      ctx.beginPath();
      ctx.moveTo(xToPixel(-z), originY);
      for (let x = -z; x <= z; x += 0.05) {
        ctx.lineTo(xToPixel(x), yToPixel(normalPDF(x)));
      }
      ctx.lineTo(xToPixel(z), originY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "#1E293B";
      ctx.setLineDash([4, 4]);
      [-z, z].forEach(function (b) {
        ctx.beginPath();
        ctx.moveTo(xToPixel(b), originY);
        ctx.lineTo(xToPixel(b), yToPixel(normalPDF(b)));
        ctx.stroke();
      });
      ctx.setLineDash([]);

      ctx.fillStyle = "#1E293B";
      ctx.font = "bold 13px Pretendard, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("-" + z.toFixed(2), xToPixel(-z), originY + 20);
      ctx.fillText(z.toFixed(2), xToPixel(z), originY + 20);
    }

    ctx.strokeStyle = "#94A3B8";
    ctx.beginPath();
    ctx.moveTo(xToPixel(-4), originY);
    ctx.lineTo(xToPixel(4) + 10, originY);
    ctx.moveTo(xToPixel(4) + 10, originY);
    ctx.lineTo(xToPixel(4) + 2, originY - 4);
    ctx.moveTo(xToPixel(4) + 10, originY);
    ctx.lineTo(xToPixel(4) + 2, originY + 4);
    ctx.stroke();

    ctx.fillStyle = "#1E293B";
    ctx.font = "bold 14px Pretendard, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("0", xToPixel(0), originY + 20);
    ctx.textAlign = "left";
    ctx.fillText("Z", xToPixel(4) + 16, originY + 5);
  }
```

- [ ] **Step 4: 브라우저 콘솔에서 임시로 함수 호출해 시각 확인**

`index.html`을 열고 개발자도구 콘솔에 `drawNormalCurveInteractive(document.createElement('canvas'), 1.96, true)`를 입력해 에러 없이 실행되는지 확인 (아직 화면에 canvas가 없으므로 눈으로 보이진 않음 — 다음 Task에서 실제 canvas에 연결)

- [ ] **Step 5: 커밋**

```bash
cd "C:/dev/jtm"
git add script.js
git commit -m "표준정규분포 넓이 계산(심슨법) 및 곡선 그리기 함수"
```

---

### Task 8: 5·6-1단계 화면 — 신뢰도의 의미 + z 찾기 슬라이더

**Files:**
- Modify: `C:\dev\jtm\script.js`

**Interfaces:**
- Consumes: `normalAreaBetween`, `drawNormalCurveInteractive`, `state.s6Target/s6Z/s6Found95/s6Found99`
- Produces: `s5Render()`, `s6FindRender()`

**허용오차:** 목표 넓이와의 차이가 `0.003` 미만이면 "찾음"으로 판정 (design doc §4)

- [ ] **Step 1: 5단계 렌더 함수 작성**

```js
  /* ===== Task 8: 5·6-1단계 — 신뢰도의 의미 · z 찾기 ===== */

  function s5Render() {
    const container = document.getElementById("step-5");
    container.innerHTML =
      '<h2>5. 신뢰도의 필요성과 의미</h2>' +
      '<div class="card">' +
        '<p>모평균을 추정하기 위해 만든 구간을 <strong>"신뢰구간"</strong>이라 부르고, 같은 방법으로 구간을 반복해서 만들었을 때 그 구간이 실제 모평균을 포함할 것으로 기대되는 비율을 <strong>"신뢰도"</strong>라고 합니다.</p>' +
        '<p>일반적으로 통계에서는 신뢰도로 <strong>95%와 99%</strong>를 많이 사용합니다.</p>' +
      '</div>';
  }
```

- [ ] **Step 2: z 찾기(6-1단계) 렌더/이벤트 함수 작성**

```js
  const TARGET_TOLERANCE = 0.003;

  function s6FindRender() {
    const container = document.getElementById("step-6");
    const targetArea = state.s6Target / 100;
    const currentArea = normalAreaBetween(state.s6Z);
    const found = Math.abs(currentArea - targetArea) < TARGET_TOLERANCE;

    if (found) {
      if (state.s6Target === 95) state.s6Found95 = true;
      if (state.s6Target === 99) state.s6Found99 = true;
    }

    container.innerHTML =
      '<h2>6. 표준정규분포를 이용한 신뢰구간 공식 유도</h2>' +
      '<div class="card">' +
        '<p>아래 슬라이더로 표준정규분포의 가운데 영역을 조절하면서, 그 영역의 넓이가 0.95, 0.99가 되는 순간의 z값을 찾아봅시다.</p>' +
      '</div>' +
      '<div class="card controls-card">' +
        '<div class="control-row toggle-row"><span>목표</span>' +
          '<div class="toggle-group" id="s6-target">' +
            '<button class="toggle-btn' + (state.s6Target === 95 ? " active" : "") + '" data-val="95">95% 찾기' + (state.s6Found95 ? " ✓" : "") + '</button>' +
            '<button class="toggle-btn' + (state.s6Target === 99 ? " active" : "") + '" data-val="99">99% 찾기' + (state.s6Found99 ? " ✓" : "") + '</button>' +
          '</div></div>' +
        '<div class="control-row"><label for="s6-z">경계값 (z = ± <span id="s6-z-val">' + state.s6Z.toFixed(2) + '</span>)</label>' +
          '<input type="range" id="s6-z" min="0" max="3.5" step="0.01" value="' + state.s6Z + '"></div>' +
      '</div>' +
      '<div class="card">' +
        '<canvas id="s6-curve-canvas" width="600" height="260"></canvas>' +
        '<p class="summary-text' + (found ? ' found' : '') + '" id="s6-area-readout">현재 가운데 영역: ' + currentArea.toFixed(3) + ' (목표: ' + targetArea.toFixed(2) + ')</p>' +
        '<div class="feedback' + (found ? " correct" : " hidden") + '" id="s6-found-box">' +
          (found ? ("찾았습니다! z ≈ " + state.s6Z.toFixed(2) + "일 때 가운데 영역이 " + targetArea.toFixed(2) + "가 됩니다. 이 값이 " + state.s6Target + "% 신뢰도의 신뢰구간에 쓰이는 값입니다.") : "") +
        '</div>' +
      '</div>';

    drawNormalCurveInteractive(document.getElementById("s6-curve-canvas"), state.s6Z, found);

    document.querySelectorAll("#s6-target .toggle-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.s6Target = Number(btn.dataset.val);
        saveState();
        s6FindRender();
      });
    });
    document.getElementById("s6-z").addEventListener("input", function (e) {
      state.s6Z = Number(e.target.value);
      saveState();
      s6FindRender();
    });
  }
```

- [ ] **Step 3: node로 found 판정 로직 검증**

Run:
```bash
node -e "
function normalPDF(x) { return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI); }
function normalAreaBetween(z) {
  if (z <= 0) return 0;
  const n = 200, a = -z, b = z, h = (b - a) / n;
  let sum = normalPDF(a) + normalPDF(b);
  for (let i = 1; i < n; i++) { const x = a + i * h; sum += (i % 2 === 0 ? 2 : 4) * normalPDF(x); }
  return (h / 3) * sum;
}
const TOL = 0.003;
function isFound(z, targetPct) { return Math.abs(normalAreaBetween(z) - targetPct / 100) < TOL; }
console.assert(isFound(1.96, 95) === true, 'fail: 1.96 should find 95%');
console.assert(isFound(2.58, 99) === true, 'fail: 2.58 should find 99%');
console.assert(isFound(1.50, 95) === false, 'fail: 1.50 should NOT find 95%');
console.log('found-判定 logic OK');
"
```
Expected: `found-判定 logic OK` (한글 주석 깨짐 없이 assert 결과만 중요)

- [ ] **Step 4: 브라우저에서 확인**

6단계로 이동 → 슬라이더를 1.96 근처로 움직이면 곡선 색이 바뀌고 "찾았습니다!" 메시지가 뜨는지, "95% 찾기" 버튼에 ✓ 표시가 남는지, "99% 찾기"로 전환 후 2.58 근처로 움직이면 마찬가지로 확인되는지, 목표를 오가도 슬라이더 값이 초기화되지 않고 유지되는지 확인

- [ ] **Step 5: 커밋**

```bash
cd "C:/dev/jtm"
git add script.js
git commit -m "5단계: 신뢰도의 의미, 6-1단계: z값 슬라이더 탐색 활동"
```

---

### Task 9: 6-2단계 화면 — 부등식 변형 (자동 대입 + 객관식)

**Files:**
- Modify: `C:\dev\jtm\script.js`

**Interfaces:**
- Consumes: `state.s6DerivLevel`, `state.s6DerivLine`, `Z_VALUES`
- Produces: `s6DerivLines(level)`, `S6_MCQ_OPTIONS(level)`, `s6DerivRender()`

- [ ] **Step 1: 유도 줄 텍스트 생성 함수 + 객관식 보기 생성 함수 작성**

```js
  /* ===== Task 9: 6-2단계 — 부등식 변형 ===== */

  function s6DerivLines(level) {
    const z = Z_VALUES[level];
    const p = (level / 100).toFixed(2);
    return [
      "$P(-" + z + " \\le Z \\le " + z + ") = " + p + "$",
      "$P\\left(-" + z + " \\le \\dfrac{\\bar X - m}{\\sigma/\\sqrt n} \\le " + z + "\\right) = " + p + "$",
    ];
  }

  function s6McqOptions(level) {
    const z = Z_VALUES[level];
    const correct = "$\\bar X - " + z + "\\dfrac{\\sigma}{\\sqrt n} \\le m \\le \\bar X + " + z + "\\dfrac{\\sigma}{\\sqrt n}$";
    const wrongSign = "$\\bar X + " + z + "\\dfrac{\\sigma}{\\sqrt n} \\le m \\le \\bar X - " + z + "\\dfrac{\\sigma}{\\sqrt n}$";
    const wrongNoSqrt = "$\\bar X - " + z + "\\sigma \\le m \\le \\bar X + " + z + "\\sigma$";
    const wrongOneSide = "$m \\le \\bar X + " + z + "\\dfrac{\\sigma}{\\sqrt n}$";
    return [
      { text: correct, correct: true },
      { text: wrongSign, correct: false },
      { text: wrongNoSqrt, correct: false },
      { text: wrongOneSide, correct: false },
    ];
  }
```

- [ ] **Step 2: node로 s6DerivLines/s6McqOptions 정답 개수 검증**

Run:
```bash
node -e "
const Z_VALUES = { 95: 1.96, 99: 2.58 };
function s6McqOptions(level) {
  const z = Z_VALUES[level];
  return [
    { text: 'correct-' + z, correct: true },
    { text: 'wrong1-' + z, correct: false },
    { text: 'wrong2-' + z, correct: false },
    { text: 'wrong3-' + z, correct: false },
  ];
}
const opts95 = s6McqOptions(95);
console.assert(opts95.filter(o => o.correct).length === 1, 'fail: exactly one correct option');
console.assert(opts95.length === 4, 'fail: 4 options total');
console.log('mcq options OK');
"
```
Expected: `mcq options OK`

- [ ] **Step 3: 6-2단계 렌더 함수 작성 (객관식 선택 + 정오답 피드백)**

```js
  function s6DerivRender() {
    const container = document.getElementById("step-6");
    const existing = container.querySelector("#s6-deriv-section");
    if (existing) existing.remove();

    const level = state.s6DerivLevel;
    const lines = s6DerivLines(level);
    const options = s6McqOptions(level);

    const section = document.createElement("div");
    section.id = "s6-deriv-section";
    section.innerHTML =
      '<div class="card">' +
        '<h3>부등식 변형 — 방금 찾은 z값으로 신뢰구간 공식 유도하기</h3>' +
        '<div class="control-row toggle-row"><span>신뢰도</span>' +
          '<div class="toggle-group" id="s6-deriv-level">' +
            '<button class="toggle-btn' + (level === 95 ? " active" : "") + '" data-val="95">95%</button>' +
            '<button class="toggle-btn' + (level === 99 ? " active" : "") + '" data-val="99">99%</button>' +
          '</div></div>' +
        '<div id="s6-deriv-lines">' + lines.map(function (l) { return "<p>" + l + "</p>"; }).join("") + '</div>' +
        '<p>이 부등식을 <strong>m</strong>에 대해 정리하면 다음 중 어느 것이 될까요?</p>' +
        '<div class="mcq" id="s6-mcq">' +
          options.map(function (opt, i) {
            return '<label class="mcq-option"><input type="radio" name="s6mcq" value="' + i + '"><span>' + opt.text + '</span></label>';
          }).join("") +
        '</div>' +
        '<div class="feedback hidden" id="s6-mcq-feedback"></div>' +
      '</div>';
    container.appendChild(section);

    document.querySelectorAll("#s6-deriv-level .toggle-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.s6DerivLevel = Number(btn.dataset.val);
        saveState();
        s6DerivRender();
      });
    });

    document.querySelectorAll('#s6-mcq input[name="s6mcq"]').forEach(function (input) {
      input.addEventListener("change", function () {
        const idx = Number(input.value);
        const feedback = document.getElementById("s6-mcq-feedback");
        feedback.classList.remove("hidden", "correct", "incorrect");
        if (options[idx].correct) {
          feedback.classList.add("correct");
          feedback.textContent = "정답입니다! 이 식이 신뢰도 " + level + "%의 모평균 신뢰구간 공식입니다.";
        } else {
          feedback.classList.add("incorrect");
          feedback.textContent = "다시 생각해보세요. 부호 방향과 √n 위치를 확인해보세요.";
        }
        if (window.MathJax && window.MathJax.typesetPromise) {
          window.MathJax.typesetPromise([feedback]);
        }
      });
    });

    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([section]);
    }
  }
```

**참고:** `s6FindRender()`(Task 8)와 `s6DerivRender()`는 같은 `#step-6` 컨테이너를 쓰지만 `s6FindRender()`는 `container.innerHTML =`로 전체를 교체하므로, 두 함수를 호출하는 순서는 반드시 `s6FindRender()` 다음에 `s6DerivRender()`여야 한다(Task 13 `initAllSteps()`에서 순서 고정).

- [ ] **Step 4: 브라우저에서 확인**

6단계 하단에 "부등식 변형" 카드가 z 찾기 카드 아래 이어서 보이는지, 신뢰도 토글이 95%/99%를 바꾸는지, 객관식 중 정답을 고르면 초록 피드백, 오답을 고르면 빨강 피드백이 뜨는지, MathJax 수식이 깨지지 않고 렌더링되는지 확인

- [ ] **Step 5: 커밋**

```bash
cd "C:/dev/jtm"
git add script.js
git commit -m "6-2단계: 부등식 변형 (z값 연결 + 최종식 객관식)"
```

---

### Task 10: 7단계 화면 — 한 표본의 신뢰구간 계산과 해석

**Files:**
- Modify: `C:\dev\jtm\script.js`

**Interfaces:**
- Consumes: `sampleWithReplacement`, `mean`, `confidenceInterval`, `containsMean`, `drawDotPlot`, `drawIntervalLine`, `state.sampleSize/confidenceLevel/currentSample/history`
- Produces: `drawOneTrial()`, `s7Render()`, `s7DrawSample()`

**중요:** `drawOneTrial()`은 이후 8단계(반복 시뮬레이션)에서도 그대로 재사용되는 공용 함수이므로 여기서 정의한다. `state.history`는 7·8단계가 공유하는 누적 기록이다.

- [ ] **Step 1: drawOneTrial 작성 (withjm 로직 이식, 95/99 동시 계산)**

```js
  /* ===== Task 10: 7단계 — 한 표본의 신뢰구간 계산과 해석 ===== */

  function drawOneTrial() {
    const sample = sampleWithReplacement(state.population, state.sampleSize, Math.random);
    const values = sample.map(function (s) { return s.minutes; });
    const sampleMean = mean(values);
    const interval95 = confidenceInterval(sampleMean, state.sigma, state.sampleSize, 95);
    const interval99 = confidenceInterval(sampleMean, state.sigma, state.sampleSize, 99);
    const contains95 = containsMean(interval95, state.mu);
    const contains99 = containsMean(interval99, state.mu);
    const selectedInterval = state.confidenceLevel === 99 ? interval99 : interval95;
    const selectedContains = state.confidenceLevel === 99 ? contains99 : contains95;
    const record = {
      sample: sample, sampleMean: sampleMean, n: state.sampleSize,
      interval95: interval95, interval99: interval99,
      contains95: contains95, contains99: contains99,
      interval: selectedInterval, contains: selectedContains,
    };
    state.currentSample = record;
    state.history.push(record);
    return record;
  }

  function s7DrawSample() {
    drawOneTrial();
    saveState();
    s7Render();
  }
```

- [ ] **Step 2: 7단계 렌더 함수 작성 (모평균 비공개 유지)**

```js
  function s7Render() {
    const container = document.getElementById("step-7");
    container.innerHTML =
      '<h2>7. 한 표본의 신뢰구간 계산과 해석</h2>' +
      '<div class="card">' +
        '<label>표본크기 (n): <span id="s7-n-label">' + state.sampleSize + '</span></label>' +
        '<input id="s7-n-slider" type="range" min="10" max="200" value="' + state.sampleSize + '">' +
        '<div class="control-row toggle-row" style="margin-top:10px;"><span>신뢰도</span>' +
          '<div class="toggle-group" id="s7-cl">' +
            '<button class="toggle-btn' + (state.confidenceLevel === 95 ? " active" : "") + '" data-cl="95">95%</button>' +
            '<button class="toggle-btn' + (state.confidenceLevel === 99 ? " active" : "") + '" data-cl="99">99%</button>' +
          '</div></div>' +
        '<button class="btn-primary" id="s7-draw" style="margin-top:10px;">표본 1회 추출</button>' +
      '</div>' +
      '<div class="card"><canvas id="s7-dotplot-canvas" width="600" height="200"></canvas></div>' +
      '<div class="card"><div id="s7-sample-table" class="scroll-box"></div></div>' +
      '<div class="card"><div id="s7-calc"></div></div>' +
      '<div class="card"><canvas id="s7-interval-canvas" width="600" height="120"></canvas>' +
        '<p id="s7-verdict"></p></div>';

    document.getElementById("s7-n-slider").addEventListener("input", function (e) {
      state.sampleSize = Number(e.target.value);
      document.getElementById("s7-n-label").textContent = state.sampleSize;
      saveState();
    });
    document.querySelectorAll("#s7-cl .toggle-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.confidenceLevel = Number(btn.dataset.cl);
        saveState();
        s7Render();
      });
    });
    document.getElementById("s7-draw").addEventListener("click", s7DrawSample);

    const cs = state.currentSample;
    if (!cs) {
      drawDotPlot(document.getElementById("s7-dotplot-canvas"), state.population, []);
      return;
    }
    drawDotPlot(document.getElementById("s7-dotplot-canvas"), state.population, cs.sample.map(function (s) { return s.id; }));
    document.getElementById("s7-sample-table").innerHTML =
      "<table><tr><th>ID</th><th>사용시간(분)</th></tr>" +
      cs.sample.map(function (s) { return "<tr><td>" + s.id + "</td><td>" + s.minutes + "</td></tr>"; }).join("") +
      "</table>";

    const values = cs.sample.map(function (s) { return s.minutes; });
    document.getElementById("s7-calc").innerHTML =
      "합계 " + values.reduce(function (a, b) { return a + b; }, 0) + " ÷ " + values.length + " = 표본평균 " + cs.sampleMean.toFixed(2) + "<br>" +
      "ME = " + cs.interval.z + " × " + state.sigma + " / √" + state.sampleSize + " = " + cs.interval.marginOfError.toFixed(2) + "<br>" +
      "[" + cs.sampleMean.toFixed(2) + " - " + cs.interval.marginOfError.toFixed(2) + ", " + cs.sampleMean.toFixed(2) + " + " + cs.interval.marginOfError.toFixed(2) + "] = [" +
      cs.interval.lower.toFixed(2) + ", " + cs.interval.upper.toFixed(2) + "]";

    drawIntervalLine(document.getElementById("s7-interval-canvas"), cs.interval, state.mu, cs.sampleMean, state.meanRevealed);
    const verdictEl = document.getElementById("s7-verdict");
    verdictEl.textContent = cs.contains
      ? "이번 신뢰구간은 실제 모평균 위치를 포함합니다."
      : "이번 표본평균이 치우치게 추출되어 실제 모평균 위치를 포함하지 못했습니다.";
    verdictEl.style.color = cs.contains ? "#16A34A" : "#DC2626";
  }
```

- [ ] **Step 3: node로 drawOneTrial의 record 구조 검증 (population/RNG는 단순 목업으로 대체)**

Run:
```bash
node -e "
function mean(values) { return values.reduce((a,b)=>a+b,0)/values.length; }
const Z_VALUES = { 95: 1.96, 99: 2.58 };
function marginOfError(sigma, n, cl) { return Z_VALUES[cl] * (sigma / Math.sqrt(n)); }
function confidenceInterval(sampleMean, sigma, n, cl) {
  const me = marginOfError(sigma, n, cl);
  return { lower: sampleMean - me, upper: sampleMean + me, marginOfError: me, z: Z_VALUES[cl] };
}
function containsMean(iv, mu) { return mu >= iv.lower && mu <= iv.upper; }

const values = [230, 240, 250, 235, 245];
const sampleMean = mean(values);
const interval95 = confidenceInterval(sampleMean, 40, values.length, 95);
const interval99 = confidenceInterval(sampleMean, 40, values.length, 99);
const record = {
  sampleMean: sampleMean, interval95: interval95, interval99: interval99,
  contains95: containsMean(interval95, 240), contains99: containsMean(interval99, 240),
};
console.assert(typeof record.sampleMean === 'number', 'fail: sampleMean type');
console.assert(record.interval99.marginOfError > record.interval95.marginOfError, 'fail: 99% ME should be wider than 95%');
console.log('drawOneTrial record shape OK');
"
```
Expected: `drawOneTrial record shape OK`

- [ ] **Step 4: 브라우저에서 확인**

7단계로 이동 → n 슬라이더, 신뢰도 토글, "표본 1회 추출" 버튼이 동작하는지, 신뢰구간 판정 막대의 모평균 라벨이 (8단계 도달 전이므로) 여전히 "비공개"로 나오는지 확인

- [ ] **Step 5: 커밋**

```bash
cd "C:/dev/jtm"
git add script.js
git commit -m "7단계 화면: 한 표본의 신뢰구간 계산과 해석 (모평균 비공개 유지)"
```

---

### Task 11: 8단계 화면 — 반복 시뮬레이션 + 모평균 공개

**Files:**
- Modify: `C:\dev\jtm\script.js`

**Interfaces:**
- Consumes: `drawOneTrial`(Task 10), `drawHistogram`, `drawDotPlot`(Task 3), `state.history/tab8ViewMode/meanRevealed`, Chart.js 전역
- Produces: `s8RevealPopulation()`, `drawErrorBarChartFrame(...)`, `renderErrorBarChart(...)`, `renderGauges(rate95, rate99)`, `renderConvergenceChart()`, `s8RunTrials(count)`, `s8Render()`

**모평균 공개 지점:** 이 단계에 처음 진입할 때(`s8Render()`가 처음 호출될 때) `state.meanRevealed = true`로 전환한다. 이후 Task 3·6·10에서 만든 `revealMu`/`reveal` 인자가 모두 `true`가 되어 이전 단계로 되돌아가도 라벨이 계속 공개 상태로 보인다(비공개→공개는 비가역, 왔다갔다하며 다시 숨기지 않음).

- [ ] **Step 1: Error Bar 차트 프레임 그리기 함수 이식 (withjm 로직 그대로, 라벨 조건 제거 — 이미 공개 상태이므로 항상 숫자 라벨)**

```js
  /* ===== Task 11: 8단계 — 반복 시뮬레이션 + 모평균 공개 ===== */

  let convergenceChart = null, gauge95Chart = null, gauge99Chart = null;
  let errorBarAnimHandle = null;

  function drawErrorBarChartFrame(canvas, history, mode, mu, lastBarAlpha) {
    const ctx = canvas.getContext("2d");
    const rowH = 16, topPad = 26, bottomPad = 30, leftPad = 44, rightPad = 12;
    canvas.width = 600;
    canvas.height = Math.max(160, topPad + bottomPad + history.length * rowH);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const lowerKey = mode === "99" ? "interval99" : (mode === "95" ? "interval95" : "interval99");
    const lowers = history.map(function (h) { return h[lowerKey].lower; });
    const uppers = history.map(function (h) { return h[lowerKey].upper; });
    const dataMin = lowers.length ? Math.min.apply(null, lowers) : mu - 10;
    const dataMax = uppers.length ? Math.max.apply(null, uppers) : mu + 10;
    const span = Math.max(dataMax - dataMin, 1);
    const min = Math.min(dataMin, mu) - span * 0.15;
    const max = Math.max(dataMax, mu) + span * 0.15;
    const chartW = canvas.width - leftPad - rightPad;
    function xFor(v) { return leftPad + ((v - min) / (max - min)) * chartW; }

    history.forEach(function (h, i) {
      const y = topPad + i * rowH + rowH / 2;
      const isLast = i === history.length - 1;
      ctx.globalAlpha = isLast ? lastBarAlpha : 1;
      if (mode === "both") {
        ctx.strokeStyle = "rgba(37,99,235,0.35)";
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(xFor(h.interval99.lower), y);
        ctx.lineTo(xFor(h.interval99.upper), y);
        ctx.stroke();
        ctx.strokeStyle = h.contains95 ? "#16A34A" : "#DC2626";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(xFor(h.interval95.lower), y);
        ctx.lineTo(xFor(h.interval95.upper), y);
        ctx.stroke();
      } else {
        const iv = mode === "99" ? h.interval99 : h.interval95;
        const contains = mode === "99" ? h.contains99 : h.contains95;
        ctx.strokeStyle = contains ? "#16A34A" : "#DC2626";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(xFor(iv.lower), y);
        ctx.lineTo(xFor(iv.upper), y);
        ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;

    const muX = xFor(mu);
    ctx.strokeStyle = "#1E293B";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(muX, topPad - 10);
    ctx.lineTo(muX, topPad + Math.max(history.length, 1) * rowH);
    ctx.stroke();
    ctx.setLineDash([]);

    const label = "모평균 " + mu;
    ctx.font = "bold 11px Pretendard, sans-serif";
    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = "#1E293B";
    ctx.fillRect(muX - textWidth / 2 - 4, topPad - 26, textWidth + 8, 16);
    ctx.fillStyle = "white";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, muX - textWidth / 2, topPad - 18);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function renderErrorBarChart(history, mode, mu, animateNewBar) {
    const canvas = document.getElementById("s8-errorbar-canvas");
    if (errorBarAnimHandle) { cancelAnimationFrame(errorBarAnimHandle); errorBarAnimHandle = null; }
    if (!animateNewBar || history.length === 0) {
      drawErrorBarChartFrame(canvas, history, mode, mu, 1);
      return;
    }
    const start = performance.now();
    const duration = 250;
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      drawErrorBarChartFrame(canvas, history, mode, mu, t);
      if (t < 1) errorBarAnimHandle = requestAnimationFrame(frame);
      else errorBarAnimHandle = null;
    }
    errorBarAnimHandle = requestAnimationFrame(frame);
  }
```

- [ ] **Step 2: 게이지·누적그래프 함수 이식 (Chart.js, withjm 로직 그대로)**

```js
  function renderGauges(rate95, rate99) {
    if (!gauge95Chart) {
      gauge95Chart = new Chart(document.getElementById("s8-gauge95-canvas"), {
        type: "doughnut",
        data: { labels: ["95% 성공률", ""], datasets: [{ data: [rate95, 100 - rate95], backgroundColor: ["#16A34A", "#E2E8F0"] }] },
        options: { responsive: false, maintainAspectRatio: false, circumference: 180, rotation: 270, cutout: "70%", plugins: { legend: { display: false } } },
      });
    } else {
      gauge95Chart.data.datasets[0].data = [rate95, 100 - rate95];
      gauge95Chart.update();
    }
    if (!gauge99Chart) {
      gauge99Chart = new Chart(document.getElementById("s8-gauge99-canvas"), {
        type: "doughnut",
        data: { labels: ["99% 성공률", ""], datasets: [{ data: [rate99, 100 - rate99], backgroundColor: ["#2563EB", "#E2E8F0"] }] },
        options: { responsive: false, maintainAspectRatio: false, circumference: 180, rotation: 270, cutout: "70%", plugins: { legend: { display: false } } },
      });
    } else {
      gauge99Chart.data.datasets[0].data = [rate99, 100 - rate99];
      gauge99Chart.update();
    }
  }

  function renderConvergenceChart() {
    const history = state.history;
    const mode = state.tab8ViewMode;
    const datasets = [];
    function cumulativeRate(key) {
      return history.map(function (h, i) {
        const count = history.slice(0, i + 1).filter(function (x) { return x[key]; }).length;
        return { x: i + 1, y: (count / (i + 1)) * 100 };
      });
    }
    if (mode === "both" || mode === "95") datasets.push({ label: "95% 누적 성공률", data: cumulativeRate("contains95"), borderColor: "#16A34A", pointRadius: 0 });
    if (mode === "both" || mode === "99") datasets.push({ label: "99% 누적 성공률", data: cumulativeRate("contains99"), borderColor: "#2563EB", pointRadius: 0 });

    if (!convergenceChart) {
      convergenceChart = new Chart(document.getElementById("s8-convergence-canvas"), {
        type: "line",
        data: { datasets: datasets },
        options: { responsive: false, maintainAspectRatio: false, scales: { x: { type: "linear", title: { display: true, text: "시행 횟수" } }, y: { min: 0, max: 100 } } },
      });
    } else {
      convergenceChart.data.datasets = datasets;
      convergenceChart.update();
    }
  }
```

- [ ] **Step 3: 8단계 렌더/이벤트 함수 작성 (모집단 공개 연출 포함)**

```js
  function s8RunTrials(count) {
    state.simulationPaused = false;
    let done = 0;
    function step() {
      if (state.simulationPaused || done >= count) return;
      drawOneTrial();
      saveState();
      s8RenderResults(true);
      done++;
      setTimeout(step, 200);
    }
    step();
  }

  function s8RenderResults(animate) {
    const total = state.history.length;
    const success95 = state.history.filter(function (h) { return h.contains95; }).length;
    const success99 = state.history.filter(function (h) { return h.contains99; }).length;
    const rate95 = total === 0 ? 0 : (success95 / total * 100);
    const rate99 = total === 0 ? 0 : (success99 / total * 100);
    const mode = state.tab8ViewMode;

    let html = "총 시행: " + total + "<br>";
    if (mode === "both") {
      html += "95% 성공률: <b style='color:#16A34A'>" + rate95.toFixed(1) + "%</b> (" + success95 + "/" + total + ") &nbsp;·&nbsp; 99% 성공률: <b style='color:#2563EB'>" + rate99.toFixed(1) + "%</b> (" + success99 + "/" + total + ")";
    } else if (mode === "95") {
      html += "95% 성공률: <b style='color:#16A34A'>" + rate95.toFixed(1) + "%</b> (" + success95 + "/" + total + ")";
    } else {
      html += "99% 성공률: <b style='color:#2563EB'>" + rate99.toFixed(1) + "%</b> (" + success99 + "/" + total + ")";
    }
    document.getElementById("s8-dashboard").innerHTML = html;
    document.getElementById("s8-gauge95-canvas").style.display = (mode === "both" || mode === "95") ? "" : "none";
    document.getElementById("s8-gauge99-canvas").style.display = (mode === "both" || mode === "99") ? "" : "none";

    renderErrorBarChart(state.history, mode, state.mu, !!animate);
    renderGauges(rate95, rate99);
    renderConvergenceChart();
  }

  function s8Render() {
    const firstEntry = !state.meanRevealed;
    state.meanRevealed = true;
    saveState();

    const container = document.getElementById("step-8");
    container.innerHTML =
      (firstEntry ? '<div class="card reflect-card"><p><strong>사실 모집단은 이랬습니다!</strong> 지금까지 여러분이 추정해온 진짜 모집단을 공개합니다.</p></div>' : '') +
      '<h2>8. 반복 시뮬레이션을 통한 신뢰도의 의미 확인</h2>' +
      '<div class="card">' +
        '<canvas id="s8-histogram-canvas" width="600" height="220"></canvas>' +
        '<div id="s8-stats"></div>' +
        '<button class="btn-secondary" id="s8-regen">모집단 다시 생성</button>' +
      '</div>' +
      '<div class="card controls-card">' +
        '<button class="btn-primary" id="s8-draw-1">1회</button>' +
        '<button class="btn-primary" id="s8-draw-10">10회</button>' +
        '<button class="btn-primary" id="s8-draw-100">100회</button>' +
        '<button class="btn-secondary" id="s8-pause">일시정지</button>' +
        '<button class="btn-secondary" id="s8-reset">초기화</button>' +
      '</div>' +
      '<div class="card">' +
        '<div class="toggle-group" id="s8-mode">' +
          '<button class="toggle-btn' + (state.tab8ViewMode === "95" ? " active" : "") + '" data-mode="95">95%만</button>' +
          '<button class="toggle-btn' + (state.tab8ViewMode === "99" ? " active" : "") + '" data-mode="99">99%만</button>' +
          '<button class="toggle-btn' + (state.tab8ViewMode === "both" ? " active" : "") + '" data-mode="both">비교 (95%+99%)</button>' +
        '</div>' +
      '</div>' +
      '<div class="card"><div class="scroll-box"><canvas id="s8-errorbar-canvas" width="600" height="200"></canvas></div></div>' +
      '<div class="card">' +
        '<div id="s8-dashboard" style="margin-bottom:10px;"></div>' +
        '<div style="display:flex; gap:8px; justify-content:center;">' +
          '<canvas id="s8-gauge95-canvas" width="140" height="140"></canvas>' +
          '<canvas id="s8-gauge99-canvas" width="140" height="140"></canvas>' +
        '</div>' +
        '<canvas id="s8-convergence-canvas" width="560" height="160"></canvas>' +
      '</div>';

    drawHistogram(document.getElementById("s8-histogram-canvas"), state.population, state.mu, state.sigma, true);
    const values = state.population.map(function (p) { return p.minutes; });
    document.getElementById("s8-stats").innerHTML =
      "평균: " + mean(values).toFixed(2) + "분 · 표준편차: " + stdDev(values).toFixed(2) + "분";

    document.getElementById("s8-regen").addEventListener("click", function () {
      state.population = generatePopulation(state.mu, state.sigma, state.populationSize, state.seed);
      state.history = [];
      state.currentSample = null;
      saveState();
      s8Render();
    });
    document.getElementById("s8-draw-1").addEventListener("click", function () { s8RunTrials(1); });
    document.getElementById("s8-draw-10").addEventListener("click", function () { s8RunTrials(10); });
    document.getElementById("s8-draw-100").addEventListener("click", function () { s8RunTrials(100); });
    document.getElementById("s8-pause").addEventListener("click", function () { state.simulationPaused = true; });
    document.getElementById("s8-reset").addEventListener("click", function () {
      state.simulationPaused = true;
      state.history = [];
      saveState();
      s8RenderResults(false);
    });
    document.querySelectorAll("#s8-mode .toggle-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.tab8ViewMode = btn.dataset.mode;
        saveState();
        document.querySelectorAll("#s8-mode .toggle-btn").forEach(function (b) { b.classList.toggle("active", b === btn); });
        s8RenderResults(false);
      });
    });

    s8RenderResults(false);
  }
```

- [ ] **Step 4: node로 성공률 계산 로직 검증**

Run:
```bash
node -e "
const history = [
  { contains95: true, contains99: true },
  { contains95: false, contains99: true },
  { contains95: true, contains99: true },
];
const success95 = history.filter(h => h.contains95).length;
const success99 = history.filter(h => h.contains99).length;
const rate95 = success95 / history.length * 100;
const rate99 = success99 / history.length * 100;
console.assert(Math.abs(rate95 - 66.666) < 0.01, 'fail: rate95=' + rate95);
console.assert(rate99 === 100, 'fail: rate99=' + rate99);
console.log('success rate calc OK');
"
```
Expected: `success rate calc OK`

- [ ] **Step 5: 브라우저에서 확인**

8단계로 처음 진입 시 "사실 모집단은 이랬습니다!" 문구와 히스토그램이 보이는지, 이후 7단계로 돌아가도 신뢰구간 막대의 모평균 라벨이 계속 숫자로("모평균 240") 보이는지(비가역 공개 확인), 1/10/100회 버튼과 보기 모드 전환, Error Bar·게이지·누적그래프가 모두 정상 동작하는지 확인

- [ ] **Step 6: 커밋**

```bash
cd "C:/dev/jtm"
git add script.js
git commit -m "8단계 화면: 반복 시뮬레이션 + 모평균 공개 연출"
```

---

### Task 12: 9단계 화면 — 표본크기의 영향

**Files:**
- Modify: `C:\dev\jtm\script.js`

**Interfaces:**
- Consumes: `sampleWithReplacement`, `mean`, `confidenceInterval`, `drawIntervalLine`, `drawTrendChart`(Task 6), `state.s9Explored`
- Produces: `s9Render()`

- [ ] **Step 1: 9단계 렌더 함수 작성**

```js
  /* ===== Task 12: 9단계 — 표본크기의 영향 ===== */

  function s9Render() {
    const container = document.getElementById("step-9");
    const n = state.sampleSize;
    const sample = sampleWithReplacement(state.population, n, Math.random);
    const sampleMean = mean(sample.map(function (s) { return s.minutes; }));
    const ci = confidenceInterval(sampleMean, state.sigma, n, 95);
    state.s9Explored[n] = ci.upper - ci.lower;
    saveState();

    container.innerHTML =
      '<h2>9. 표본크기의 영향</h2>' +
      '<div class="card"><p>신뢰도(95%)는 고정하고, 표본크기(n)만 바꿔가며 신뢰구간의 폭이 어떻게 달라지는지 슬라이더로 확인해보세요.</p></div>' +
      '<div class="card controls-card">' +
        '<div class="control-row"><label for="s9-n">표본크기 (n = <span id="s9-n-val">' + n + '</span>명)</label>' +
        '<input type="range" id="s9-n" min="10" max="200" step="5" value="' + n + '"></div>' +
      '</div>' +
      '<div class="card"><canvas id="s9-interval-canvas" width="600" height="120"></canvas>' +
        '<p class="summary-text">n = ' + n + '일 때, 95% 신뢰구간은 [' + ci.lower.toFixed(1) + ', ' + ci.upper.toFixed(1) + ']이며 폭은 ' + (ci.upper - ci.lower).toFixed(1) + '입니다.</p></div>' +
      '<div class="card"><canvas id="s9-trend-canvas" width="600" height="90"></canvas>' +
        '<p class="hint">가로축: 표본크기 n (10~200) · 세로축: 신뢰구간 폭 · 슬라이더를 움직여 여러 n을 탐색해보세요.</p></div>';

    drawIntervalLine(document.getElementById("s9-interval-canvas"), ci, state.mu, sampleMean, state.meanRevealed);
    drawTrendChart(document.getElementById("s9-trend-canvas"), state.s9Explored, [10, 200], [0, 60]);

    document.getElementById("s9-n").addEventListener("input", function (e) {
      state.sampleSize = Number(e.target.value);
      saveState();
      s9Render();
    });
  }
```

- [ ] **Step 2: node로 표본크기 증가 시 폭 감소 경향 검증**

Run:
```bash
node -e "
const Z_VALUES = { 95: 1.96 };
function marginOfError(sigma, n, cl) { return Z_VALUES[cl] * (sigma / Math.sqrt(n)); }
const widthAt20 = marginOfError(40, 20, 95) * 2;
const widthAt100 = marginOfError(40, 100, 95) * 2;
console.assert(widthAt100 < widthAt20, 'fail: width should shrink as n grows (n=20:' + widthAt20.toFixed(2) + ', n=100:' + widthAt100.toFixed(2) + ')');
console.log('sample size vs width relationship OK');
"
```
Expected: `sample size vs width relationship OK`

- [ ] **Step 3: 브라우저에서 확인**

9단계로 이동 → n 슬라이더를 움직이면 구간 폭이 좁아지거나 넓어지는지, 추이 그래프에 점이 누적되는지, 신뢰구간 막대의 모평균 라벨이 8단계를 거쳐왔다면 숫자로 보이는지 확인

- [ ] **Step 4: 커밋**

```bash
cd "C:/dev/jtm"
git add script.js
git commit -m "9단계 화면: 표본크기의 영향"
```

---

### Task 13: 10단계 화면 — 새로운 상황에 적용 + 전체 통합

**Files:**
- Modify: `C:\dev\jtm\script.js`

**Interfaces:**
- Consumes: 모든 이전 Task의 함수
- Produces: `s10Render()`, `initAllSteps()`, `init()` (최종 진입점, `DOMContentLoaded`에 바인딩)

- [ ] **Step 1: 10단계 렌더 함수 작성 (새 맥락 적용 문제)**

```js
  /* ===== Task 13: 10단계 — 새로운 상황에 적용 · 전체 통합 ===== */

  const S10_SAMPLE_SIZE = 40;
  const S10_SAMPLE_MEAN = 42; // 1학년 통학시간(분) 예시 표본평균 — 고정값으로 제시
  const S10_SIGMA = 12;

  function s10Render() {
    const container = document.getElementById("step-10");
    container.innerHTML =
      '<h2>10. 새로운 상황에 적용</h2>' +
      '<div class="card">' +
        '<p>이번엔 같은 학교 1학년 학생들의 <strong>평균 통학시간(분)</strong>이 궁금합니다. 1학년 300명 중 ' + S10_SAMPLE_SIZE + '명을 무작위로 뽑아 조사했더니 평균 통학시간이 <strong>' + S10_SAMPLE_MEAN + '분</strong>으로 나왔습니다. (모표준편차는 과거 자료를 참고해 ' + S10_SIGMA + '분으로 알려져 있다고 가정합니다.)</p>' +
      '</div>' +
      '<div class="card controls-card">' +
        '<button class="btn-primary" id="s10-calc">신뢰구간 계산하기</button>' +
      '</div>' +
      '<div class="card"><div id="s10-result"></div></div>' +
      '<div class="card">' +
        '<label for="s10-text">계산된 신뢰구간을 바탕으로, 학교가 무엇을 결정할 수 있을지(예: 스쿨버스 배차 시간, 지각 방지 대책) 서술해보세요.</label>' +
        '<textarea id="s10-text" rows="5" placeholder="예: ..."></textarea>' +
      '</div>';

    const resultEl = document.getElementById("s10-result");
    if (state.s10Calculated) {
      const ci = confidenceInterval(S10_SAMPLE_MEAN, S10_SIGMA, S10_SAMPLE_SIZE, 95);
      resultEl.innerHTML = "95% 신뢰구간: [" + ci.lower.toFixed(2) + ", " + ci.upper.toFixed(2) + "]";
    } else {
      resultEl.innerHTML = '<p class="hint">"신뢰구간 계산하기" 버튼을 눌러보세요.</p>';
    }

    document.getElementById("s10-calc").addEventListener("click", function () {
      state.s10Calculated = true;
      saveState();
      s10Render();
    });
    const textarea = document.getElementById("s10-text");
    textarea.value = state.s10Text || "";
    textarea.addEventListener("input", function (e) {
      state.s10Text = e.target.value;
      saveState();
    });
  }
```

- [ ] **Step 2: node로 10단계 신뢰구간 계산 검증**

Run:
```bash
node -e "
const Z_VALUES = { 95: 1.96 };
function marginOfError(sigma, n, cl) { return Z_VALUES[cl] * (sigma / Math.sqrt(n)); }
const me = marginOfError(12, 40, 95);
const lower = 42 - me, upper = 42 + me;
console.assert(lower < 42 && upper > 42, 'fail: interval should straddle sample mean');
console.assert(Math.abs(me - (1.96 * 12 / Math.sqrt(40))) < 1e-9, 'fail: ME formula');
console.log('step10 CI calc OK: [' + lower.toFixed(2) + ', ' + upper.toFixed(2) + ']');
"
```
Expected: `step10 CI calc OK: [38.28, 45.72]` 형태 출력

- [ ] **Step 3: Task 1~12의 임시 호출부를 정리하고 정식 초기화 함수로 교체**

`script.js`에서 Task 4~12 과정 중 임시로 추가했던 개별 호출 라인(`initPopulation(); s1Render(); goToStep(1); initNavEvents();` 등)을 모두 지우고, 파일 맨 끝에 아래 블록으로 교체:

```js
  function initAllSteps() {
    s1Render();
    s2Render();
    s3Render();
    s4Render();
    s5Render();
    s6FindRender();
    s6DerivRender();
    s7Render();
    s9Render();
    s10Render();
    // s8Render()는 8단계 진입(goToStep) 시점에 최초 1회 호출 — 모평균 공개 연출이 여기서 트리거되므로 미리 그리지 않음
  }

  function init() {
    loadState();
    initPopulation();
    initNavEvents();
    initAllSteps();
    subscribe(function () {
      if (state.currentStep === 8 || document.getElementById("step-8").classList.contains("active")) {
        s8Render();
      }
    });
    document.querySelectorAll("#progressBar li, #nextBtn").forEach(function (el) {
      el.addEventListener("click", function () {
        setTimeout(function () {
          if (document.getElementById("step-8").classList.contains("active")) s8Render();
        }, 0);
      });
    });
    goToStep(state.currentStep);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
```

- [ ] **Step 4: 전체 흐름 브라우저 통합 점검**

`index.html`을 새로고침해서 처음부터 끝까지 확인:
1. 1단계부터 10단계까지 "다음" 버튼으로 순서대로 이동되는지
2. 진행바 클릭으로 임의 단계 이동이 되는지, "done" 표시(초록 점)가 지나온 단계에 남는지
3. 개발자도구 콘솔에 `selfTestNavigation passed`, `selfTestStats passed`가 뜨고 빨간 에러가 없는지
4. 7단계까지는 모평균이 어디에도 숫자로 노출되지 않는지, 8단계 진입 순간 처음으로 "모평균 240"이 보이는지, 이후 7·9단계로 돌아가도 숫자가 계속 보이는지(비가역 공개)
5. 새로고침 후에도 현재 단계·입력값들이 유지되는지(localStorage)

- [ ] **Step 5: 커밋**

```bash
cd "C:/dev/jtm"
git add script.js
git commit -m "10단계 화면: 새로운 상황에 적용 + 전체 초기화 흐름 통합"
```

---

## Self-Review 메모 (계획 작성자용, 실행 시 참고)

- **Spec 커버리지**: design doc §3의 1~10단계가 Task 4~13에 1:1로 대응됨. §2 모평균 비공개 메커니즘은 Task 3(그리기 함수 reveal 인자)·Task 11(공개 트리거)로 구현됨. §4 기술메모(수치적분, 허용오차)는 Task 7·8에 반영됨.
- **모평균 공개 비가역성**: `state.meanRevealed`는 한번 `true`가 되면 되돌리지 않음 — 8단계 진입 후 이전 단계로 돌아가도 라벨이 다시 숨겨지지 않아야 자연스럽다(연출 의도상 "이미 봤으니 계속 보임"이 맞음). Task 11 Step 5에서 이 동작을 명시적으로 확인하도록 했음.
- **history 공유**: 7단계(`s7DrawSample`)와 8단계(`s8RunTrials`)가 같은 `state.history`/`drawOneTrial()`을 공유하므로, 7단계에서 뽑은 시행도 8단계 대시보드 카운트에 자동 반영됨 (withjm 원본의 "TAB2 상단·하단 공유" 특성 계승).
