# 모평균 추정 인터랙티브 웹앱 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 고등학교 「확률과 통계」 모평균 추정 단원을 학습하는 단일 파일(`index.html`) 인터랙티브 웹앱을 만든다.

**Architecture:** 하나의 `index.html` 안에 `<style>`(디자인 시스템), 전역 `state` 객체, 순수 계산 함수(모집단/표본/신뢰구간), 탭별 render 함수, Canvas 기반 커스텀 시각화(히스토그램/도트플롯/정규곡선/구간선분), Chart.js 기반 시각화(Error bar/line/gauge)로 구성한다. 상태가 바뀌면 해당 탭의 render 함수만 다시 그린다.

**Tech Stack:** HTML5, CSS3, Vanilla JS(ES6+, 모듈 없음), MathJax CDN(수식), Chart.js CDN(차트), Pretendard(jsDelivr CDN, 폰트). 프레임워크 없음.

## Global Constraints

- 산출물은 `index.html` 단 하나. `<script type="module">`이나 `import`/`export`, 로컬 `fetch` 금지 (CDN 스크립트 태그와 인라인 `<script>`만 사용).
- CDN 사용으로 인터넷 연결이 필요함 — 오프라인 완전 동작은 전제하지 않음.
- 표본추출은 항상 복원추출.
- z값: 95% → `1.96`, 99% → `2.58` (2.576 아님).
- 색상: Primary `#2563EB`, Success `#16A34A`, Danger `#DC2626`, Warning `#D97706`, Background `#F8FAFC`. 카드 radius `16px`.
- 반응형 브레이크포인트: 1920 / 1440 / 1280 / 1024 / 태블릿.
- 폰트: Pretendard, `cdn.jsdelivr.net/gh/orioncactus/pretendard`에서 로드.
- 자동화 테스트 프레임워크 없음. 순수 함수는 `console.assert` 스모크 테스트(브라우저 개발자도구 콘솔에서 에러 없이 통과하는지 확인), UI는 브라우저에서 직접 열어 수동 확인.
- 모집단 재생성 시 `state.currentSample`, `state.history` 초기화 + 안내 문구.
- TAB2에서 표본 추출 시 결과가 `state.history`에도 자동 추가됨 (TAB3 누적 카운트에 반영).

---

### Task 1: 뼈대 · 디자인 시스템 · 탭 네비게이션

**Files:**
- Create: `index.html`

**Interfaces:**
- Produces: `<body>` 내 `.tab-nav` 버튼(`data-tab="0|1|2|3"`), `.tab-panel`(`id="tab-0" ~ "tab-3"`), 전역 함수 `switchTab(tabIndex)`, CSS 커스텀 프로퍼티 `--color-primary` 등 디자인 토큰.

- [ ] **Step 1: `index.html` 기본 골격 작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>모평균의 추정 — 인터랙티브 학습</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<script>
window.MathJax = { tex: { inlineMath: [['$', '$']] } };
</script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" defer></script>
<style>
:root {
  --color-primary: #2563EB;
  --color-success: #16A34A;
  --color-danger: #DC2626;
  --color-warning: #D97706;
  --color-bg: #F8FAFC;
  --card-radius: 16px;
  --card-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
* { box-sizing: border-box; }
body {
  font-family: 'Pretendard', sans-serif;
  background: var(--color-bg);
  margin: 0;
  color: #1E293B;
}
.tab-nav {
  display: flex;
  gap: 8px;
  padding: 16px 24px;
  background: white;
  box-shadow: var(--card-shadow);
  position: sticky;
  top: 0;
  z-index: 10;
}
.tab-nav button {
  padding: 10px 20px;
  border: none;
  border-radius: var(--card-radius);
  background: transparent;
  font-family: inherit;
  font-size: 15px;
  cursor: pointer;
  color: #64748B;
}
.tab-nav button.active {
  background: var(--color-primary);
  color: white;
}
.tab-panel { display: none; padding: 24px; max-width: 1400px; margin: 0 auto; }
.tab-panel.active { display: block; }
.card {
  background: white;
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
  padding: 24px;
  margin-bottom: 20px;
}
@media (max-width: 1024px) {
  .tab-nav { flex-wrap: wrap; }
}
</style>
</head>
<body>
<nav class="tab-nav">
  <button data-tab="0" class="active">TAB 0. 모집단 이해</button>
  <button data-tab="1">TAB 1. 신뢰구간 유도</button>
  <button data-tab="2">TAB 2. 표본추출 Visualizer</button>
  <button data-tab="3">TAB 3. 반복 시뮬레이션</button>
</nav>

<section id="tab-0" class="tab-panel active"></section>
<section id="tab-1" class="tab-panel"></section>
<section id="tab-2" class="tab-panel"></section>
<section id="tab-3" class="tab-panel"></section>

<script>
function switchTab(tabIndex) {
  document.querySelectorAll('.tab-nav button').forEach(function(btn) {
    btn.classList.toggle('active', Number(btn.dataset.tab) === tabIndex);
  });
  document.querySelectorAll('.tab-panel').forEach(function(panel, i) {
    panel.classList.toggle('active', i === tabIndex);
  });
}
document.querySelectorAll('.tab-nav button').forEach(function(btn) {
  btn.addEventListener('click', function() {
    switchTab(Number(btn.dataset.tab));
  });
});
</script>
</body>
</html>
```

- [ ] **Step 2: 브라우저에서 직접 열어 확인**

`index.html`을 더블클릭(또는 브라우저로 열기)해서 상단 탭 4개가 보이고, 클릭할 때마다 `active` 탭이 전환되는지 확인한다. 콘솔에 에러가 없어야 한다.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Add page skeleton, design tokens, tab navigation"
```

---

### Task 2: 모집단 생성 · 통계 · 신뢰구간 계산 (순수 함수)

**Files:**
- Modify: `index.html` (Task 1의 `<script>` 태그 내부, `switchTab` 아래에 추가)

**Interfaces:**
- Consumes: 없음 (순수 함수)
- Produces:
  - `mulberry32(seed) -> () => number`
  - `createRng(seed) -> () => number`
  - `randomNormal(rng, mean, sd) -> number`
  - `generatePopulation(mu, sigma, size, seed) -> [{id, minutes}]`
  - `mean(values: number[]) -> number`
  - `stdDev(values: number[]) -> number`
  - `sampleWithReplacement(population, n, rng) -> [{id, minutes}]`
  - `Z_VALUES = {95: 1.96, 99: 2.58}`
  - `marginOfError(sigma, n, confidenceLevel) -> number`
  - `confidenceInterval(sampleMean, sigma, n, confidenceLevel) -> {lower, upper, marginOfError, z}`
  - `containsMean(interval, mu) -> boolean`

- [ ] **Step 1: 계산 함수 작성**

```js
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seed) {
  if (seed === null || seed === undefined || seed === '') return Math.random;
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
    population.push({ id: 'S' + String(i + 1).padStart(4, '0'), minutes: minutes });
  }
  return population;
}

function mean(values) {
  return values.reduce(function(a, b) { return a + b; }, 0) / values.length;
}

function stdDev(values) {
  const m = mean(values);
  const variance = values.reduce(function(a, b) { return a + Math.pow(b - m, 2); }, 0) / values.length;
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
```

- [ ] **Step 2: 콘솔 스모크 테스트 작성 및 실행**

같은 `<script>` 끝부분에 임시로 추가 (Task 완료 후에도 남겨둬도 무해하지만, 최종 정리 시 Task 10에서 제거):

```js
(function selfTestMathHelpers() {
  const rng = createRng(42);
  const pop = generatePopulation(240, 40, 1000, 42);
  console.assert(pop.length === 1000, 'population size should be 1000');
  console.assert(Math.abs(mean(pop.map(function(p) { return p.minutes; })) - 240) < 5, 'population mean near 240');

  console.assert(Z_VALUES[95] === 1.96 && Z_VALUES[99] === 2.58, 'z values correct');

  const me = marginOfError(40, 25, 95);
  console.assert(Math.abs(me - (1.96 * 40 / 5)) < 1e-9, 'margin of error correct: ' + me);

  const ci = confidenceInterval(250, 40, 25, 95);
  console.assert(Math.abs(ci.lower - (250 - me)) < 1e-9, 'CI lower correct');
  console.assert(containsMean(ci, 240) === (240 >= ci.lower && 240 <= ci.upper), 'containsMean matches manual check');

  const sample = sampleWithReplacement(pop, 10, createRng(1));
  console.assert(sample.length === 10, 'sample size 10');

  console.log('selfTestMathHelpers passed');
})();
```

브라우저에서 `index.html`을 열고 개발자도구 콘솔에 `selfTestMathHelpers passed`가 찍히고 `assert` 실패(빨간 에러)가 없는지 확인한다.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Add population generation and confidence interval math helpers"
```

---

### Task 3: 전역 상태 및 모집단 초기화

**Files:**
- Modify: `index.html` (Task 2 코드 아래)

**Interfaces:**
- Consumes: `generatePopulation`, `mean`, `stdDev` (Task 2)
- Produces: 전역 `state` 객체, `regeneratePopulation(mu, sigma, populationSize, seed)`, `subscribe(fn)` / `notify()` (간단한 render 트리거)

- [ ] **Step 1: state와 regeneratePopulation 작성**

```js
const state = {
  mu: 240, sigma: 40, populationSize: 1000, seed: null,
  population: [],
  sampleSize: 20,
  confidenceLevel: 95,
  currentSample: null,
  history: [],
};

const listeners = [];
function subscribe(fn) { listeners.push(fn); }
function notify() { listeners.forEach(function(fn) { fn(); }); }

function regeneratePopulation(mu, sigma, populationSize, seed) {
  state.mu = mu;
  state.sigma = sigma;
  state.populationSize = populationSize;
  state.seed = seed;
  state.population = generatePopulation(mu, sigma, populationSize, seed);
  state.currentSample = null;
  state.history = [];
  notify();
}

regeneratePopulation(state.mu, state.sigma, state.populationSize, state.seed);
```

- [ ] **Step 2: 브라우저 콘솔에서 확인**

콘솔에 `state.population.length`를 입력해 `1000`이 나오는지 확인한다.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Add global state and population regeneration"
```

---

### Task 4: TAB 0 — 모집단 이해 (히스토그램 · 도트플롯 · 통계량)

**Files:**
- Modify: `index.html` (`#tab-0` 내부 HTML 채우기 + render 함수 추가)

**Interfaces:**
- Consumes: `state`, `subscribe`, `regeneratePopulation`, `mean`, `stdDev`
- Produces: `renderTab0()`, `drawHistogram(canvasEl, population, mu, sigma)`, `drawDotPlot(canvasEl, population, highlightIds)`

- [ ] **Step 1: `#tab-0` HTML 구조 추가**

```js
document.getElementById('tab-0').innerHTML =
  '<div class="card">' +
    '<h2>모집단: 고등학생 1,000명의 하루 스마트폰 사용시간(분)</h2>' +
    '<canvas id="histogram-canvas" width="900" height="260"></canvas>' +
  '</div>' +
  '<div class="card">' +
    '<h3>도트플롯 (1,000명)</h3>' +
    '<canvas id="dotplot-tab0-canvas" width="900" height="200"></canvas>' +
  '</div>' +
  '<div class="card">' +
    '<h3>통계량</h3>' +
    '<div id="tab0-stats"></div>' +
    '<button id="regen-population-btn">모집단 다시 생성</button>' +
  '</div>';
```

- [ ] **Step 2: 히스토그램 · 도트플롯 · 통계량 렌더 함수 작성**

```js
function drawHistogram(canvas, population, mu, sigma) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const values = population.map(function(p) { return p.minutes; });
  const min = Math.min.apply(null, values), max = Math.max.apply(null, values);
  const binCount = 30;
  const binWidth = (max - min) / binCount;
  const bins = new Array(binCount).fill(0);
  values.forEach(function(v) {
    let idx = Math.floor((v - min) / binWidth);
    if (idx >= binCount) idx = binCount - 1;
    bins[idx]++;
  });
  const maxBin = Math.max.apply(null, bins);
  const chartW = canvas.width - 60, chartH = canvas.height - 40;
  const originX = 40, originY = canvas.height - 30;

  ctx.fillStyle = '#2563EB';
  bins.forEach(function(count, i) {
    const barH = (count / maxBin) * chartH;
    const x = originX + (i / binCount) * chartW;
    const w = chartW / binCount - 2;
    ctx.fillRect(x, originY - barH, w, barH);
  });

  function xForValue(v) { return originX + ((v - min) / (max - min)) * chartW; }
  ctx.strokeStyle = '#1E293B';
  ctx.beginPath();
  ctx.moveTo(xForValue(mu), originY);
  ctx.lineTo(xForValue(mu), originY - chartH);
  ctx.stroke();

  ctx.strokeStyle = '#D97706';
  ctx.setLineDash([5, 5]);
  [mu - sigma, mu + sigma, mu - 2 * sigma, mu + 2 * sigma].forEach(function(v) {
    ctx.beginPath();
    ctx.moveTo(xForValue(v), originY);
    ctx.lineTo(xForValue(v), originY - chartH);
    ctx.stroke();
  });
  ctx.setLineDash([]);
}

function drawDotPlot(canvas, population, highlightIds) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const values = population.map(function(p) { return p.minutes; });
  const min = Math.min.apply(null, values), max = Math.max.apply(null, values);
  const chartW = canvas.width - 60;
  const originX = 30;
  const highlightSet = new Set(highlightIds || []);
  const colHeights = {};

  population.forEach(function(p) {
    const x = Math.round(originX + ((p.minutes - min) / (max - min)) * chartW);
    colHeights[x] = (colHeights[x] || 0) + 1;
    const y = canvas.height - 10 - colHeights[x] * 4;
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = highlightSet.has(p.id) ? '#2563EB' : '#CBD5E1';
    ctx.fill();
  });
}

function renderTab0() {
  drawHistogram(document.getElementById('histogram-canvas'), state.population, state.mu, state.sigma);
  drawDotPlot(document.getElementById('dotplot-tab0-canvas'), state.population, []);
  const values = state.population.map(function(p) { return p.minutes; });
  document.getElementById('tab0-stats').innerHTML =
    '평균: ' + mean(values).toFixed(2) + '분 | ' +
    '표준편차: ' + stdDev(values).toFixed(2) + '분 | ' +
    '최솟값: ' + Math.min.apply(null, values) + '분 | ' +
    '최댓값: ' + Math.max.apply(null, values) + '분';
}

document.getElementById('regen-population-btn').addEventListener('click', function() {
  regeneratePopulation(state.mu, state.sigma, state.populationSize, state.seed);
  alert('모집단이 새로 생성되어 누적된 표본추출 결과가 초기화되었습니다.');
});

subscribe(renderTab0);
renderTab0();
```

- [ ] **Step 3: 브라우저에서 확인**

TAB0에서 히스토그램(종모양)과 도트플롯이 그려지는지, 통계량이 240/40 근처로 표시되는지, "모집단 다시 생성" 클릭 시 그래프가 바뀌는지 확인한다.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Implement TAB0 population histogram, dot plot, and stats"
```

---

### Task 5: TAB 1 Step1~3 — 표본평균 분포 · 표준화 · 표준정규분포 곡선

**Files:**
- Modify: `index.html` (`#tab-1` 내부)

**Interfaces:**
- Consumes: `state`, `Z_VALUES`
- Produces: `renderTab1()`, `drawNormalCurve(canvas, confidenceLevel)`, `state.tab1Step` (1~5 중 현재 단계), `state.tab1ConfidenceLevel`(95|99, Step3 토글용)

- [ ] **Step 1: Step1~3 카드 HTML 및 MathJax 수식 추가**

```js
state.tab1ConfidenceLevel = 95;

document.getElementById('tab-1').innerHTML =
  '<div class="card">' +
    '<h3>Step 1. 표본평균의 분포</h3>' +
    '<p>모평균 $m$은 모르고, 모표준편차 $\\sigma$는 알려진 정규분포 $N(m, \\sigma^2)$을 따르는 ' +
    '모집단에서 크기가 $n$인 표본을 임의추출하면 표본평균 $\\bar X$는 정규분포 $N\\left(m, \\dfrac{\\sigma^2}{n}\\right)$을 따른다.</p>' +
  '</div>' +
  '<div class="card">' +
    '<h3>Step 2. 표준화</h3>' +
    '<p>확률변수 $Z=\\dfrac{\\bar X-m}{\\sigma/\\sqrt n}$은 표준정규분포 $N(0,1)$을 따른다.</p>' +
  '</div>' +
  '<div class="card">' +
    '<h3>Step 3. 표준정규분포에서의 확률</h3>' +
    '<div>' +
      '<button data-cl="95" class="tab1-cl-btn">95%</button>' +
      '<button data-cl="99" class="tab1-cl-btn">99%</button>' +
    '</div>' +
    '<canvas id="normal-curve-canvas" width="600" height="260"></canvas>' +
    '<p id="tab1-step3-formula"></p>' +
  '</div>';
```

- [ ] **Step 2: 표준정규분포 곡선 캔버스 함수 및 이벤트 작성**

```js
function drawNormalCurve(canvas, confidenceLevel) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const z = Z_VALUES[confidenceLevel];
  const originX = canvas.width / 2, originY = canvas.height - 30;
  const scaleX = 60, scaleY = 180;

  function phi(x) { return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI); }
  function xToPixel(x) { return originX + x * scaleX; }
  function yToPixel(y) { return originY - y * scaleY; }

  ctx.strokeStyle = '#1E293B';
  ctx.beginPath();
  for (let x = -4; x <= 4; x += 0.05) {
    const px = xToPixel(x), py = yToPixel(phi(x));
    if (x === -4) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(37, 99, 235, 0.3)';
  ctx.beginPath();
  ctx.moveTo(xToPixel(-z), originY);
  for (let x = -z; x <= z; x += 0.05) {
    ctx.lineTo(xToPixel(x), yToPixel(phi(x)));
  }
  ctx.lineTo(xToPixel(z), originY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#1E293B';
  ctx.font = '13px Pretendard';
  ctx.fillText('-' + z, xToPixel(-z) - 10, originY + 18);
  ctx.fillText(String(z), xToPixel(z) - 10, originY + 18);
  ctx.fillText('0', xToPixel(0) - 4, originY + 18);
}

document.querySelectorAll('.tab1-cl-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    state.tab1ConfidenceLevel = Number(btn.dataset.cl);
    renderTab1();
  });
});

function renderTab1() {
  const cl = state.tab1ConfidenceLevel;
  const z = Z_VALUES[cl];
  drawNormalCurve(document.getElementById('normal-curve-canvas'), cl);
  document.getElementById('tab1-step3-formula').innerHTML =
    '$P(-' + z + ' \\le Z \\le ' + z + ') = ' + (cl / 100).toFixed(2) + '$';
  document.querySelectorAll('.tab1-cl-btn').forEach(function(btn) {
    btn.classList.toggle('active', Number(btn.dataset.cl) === cl);
  });
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise([document.getElementById('tab-1')]);
  }
}

renderTab1();
```

- [ ] **Step 3: 브라우저에서 확인**

TAB1에서 Step1, 2 수식이 깨지지 않고 렌더링되고, Step3에서 95%/99% 버튼을 누르면 곡선의 색칠 영역과 z값(1.96 / 2.58), 확률 표시($0.95$/$0.99$)가 바뀌는지 확인한다.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Implement TAB1 Step1-3: sample mean distribution, standardization, normal curve"
```

---

### Task 6: TAB 1 Step4~5 및 확인 예제

**Files:**
- Modify: `index.html` (`#tab-1`에 이어붙임, `renderTab1` 확장)

**Interfaces:**
- Consumes: `state.tab1ConfidenceLevel`, `Z_VALUES`, `marginOfError`, `confidenceInterval`
- Produces: `state.tab1Step4Line` (0~4, 부등식 전개 단계), `renderTab1Step4()`, `checkExampleAnswer()`

- [ ] **Step 1: Step4(부등식 변형 단계별 전개) HTML/로직 추가**

```js
state.tab1Step4Line = 0;

const STEP4_LINES = [
  '$P(-1.96 \\le Z \\le 1.96) = 0.95$',
  '$P\\left(-1.96 \\le \\dfrac{\\bar X - m}{\\sigma/\\sqrt n} \\le 1.96\\right) = 0.95$',
  '$P\\left(\\bar X - 1.96\\dfrac{\\sigma}{\\sqrt n} \\le m \\le \\bar X + 1.96\\dfrac{\\sigma}{\\sqrt n}\\right) = 0.95$',
];

document.getElementById('tab-1').insertAdjacentHTML('beforeend',
  '<div class="card">' +
    '<h3>Step 4. 부등식 변형</h3>' +
    '<div id="tab1-step4-lines"></div>' +
    '<button id="tab1-step4-next-btn">다음</button>' +
  '</div>' +
  '<div class="card">' +
    '<h3>Step 5. 최종 공식</h3>' +
    '<p>신뢰도 95%: $\\bar X - 1.96\\dfrac{\\sigma}{\\sqrt n} \\le m \\le \\bar X + 1.96\\dfrac{\\sigma}{\\sqrt n}$</p>' +
    '<p>신뢰도 99%: $\\bar X - 2.58\\dfrac{\\sigma}{\\sqrt n} \\le m \\le \\bar X + 2.58\\dfrac{\\sigma}{\\sqrt n}$</p>' +
    '<p>오차한계 $ME = z\\dfrac{\\sigma}{\\sqrt n}$</p>' +
  '</div>' +
  '<div class="card">' +
    '<h3>확인 예제</h3>' +
    '<p>모표준편차가 8인 모집단에서 크기 64인 표본을 임의추출했더니 표본평균이 50이었다. 신뢰도 95%의 신뢰구간을 구하시오.</p>' +
    '<input id="example-lower-input" type="number" step="0.01" placeholder="하한">' +
    '<input id="example-upper-input" type="number" step="0.01" placeholder="상한">' +
    '<button id="example-check-btn">확인</button>' +
    '<p id="example-result"></p>' +
  '</div>'
);

function renderTab1Step4() {
  const html = STEP4_LINES.slice(0, state.tab1Step4Line + 1).map(function(line) {
    return '<p>' + line + '</p>';
  }).join('');
  document.getElementById('tab1-step4-lines').innerHTML = html;
  document.getElementById('tab1-step4-next-btn').disabled = state.tab1Step4Line >= STEP4_LINES.length - 1;
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise([document.getElementById('tab1-step4-lines')]);
  }
}

document.getElementById('tab1-step4-next-btn').addEventListener('click', function() {
  if (state.tab1Step4Line < STEP4_LINES.length - 1) {
    state.tab1Step4Line++;
    renderTab1Step4();
  }
});

renderTab1Step4();
```

- [ ] **Step 2: 확인 예제 채점 로직 추가**

```js
function checkExampleAnswer(inputLower, inputUpper) {
  const correct = confidenceInterval(50, 8, 64, 95);
  const tolerance = 0.05;
  const lowerOk = Math.abs(inputLower - correct.lower) < tolerance;
  const upperOk = Math.abs(inputUpper - correct.upper) < tolerance;
  return { correct: lowerOk && upperOk, expected: correct };
}

document.getElementById('example-check-btn').addEventListener('click', function() {
  const lower = Number(document.getElementById('example-lower-input').value);
  const upper = Number(document.getElementById('example-upper-input').value);
  const result = checkExampleAnswer(lower, upper);
  const resultEl = document.getElementById('example-result');
  if (result.correct) {
    resultEl.textContent = '정답입니다! (' + result.expected.lower.toFixed(2) + ' ~ ' + result.expected.upper.toFixed(2) + ')';
    resultEl.style.color = '#16A34A';
  } else {
    resultEl.textContent = '다시 계산해보세요. 힌트: ME = 1.96 × 8/√64';
    resultEl.style.color = '#DC2626';
  }
});
```

- [ ] **Step 3: 콘솔 스모크 테스트**

```js
console.assert(checkExampleAnswer(48.04, 51.96).correct === true, 'example answer check should pass for correct values');
console.assert(checkExampleAnswer(0, 0).correct === false, 'example answer check should fail for wrong values');
```

- [ ] **Step 4: 브라우저에서 확인**

Step4에서 "다음" 버튼을 누를 때마다 한 줄씩 나타나는지, 마지막 줄에서 버튼이 비활성화되는지 확인한다. 확인 예제에 `48.04`와 `51.96`을 입력하면 정답 처리되는지 확인한다.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Implement TAB1 Step4-5 inequality derivation and worked example"
```

---

### Task 7: TAB 2 — 표본추출 Visualizer

**Files:**
- Modify: `index.html` (`#tab-2` 내부)

**Interfaces:**
- Consumes: `state`, `sampleWithReplacement`, `mean`, `confidenceInterval`, `containsMean`, `drawDotPlot`, `notify`
- Produces: `renderTab2()`, `drawIntervalLine(canvas, interval, mu)`, `drawSampleOnTab2()`, `state.history` 항목 추가

- [ ] **Step 1: `#tab-2` HTML 구조**

```js
document.getElementById('tab-2').innerHTML =
  '<div class="card">' +
    '<label>표본크기 (n): <span id="tab2-n-label">20</span></label>' +
    '<input id="tab2-n-slider" type="range" min="10" max="200" value="20">' +
    '<button id="tab2-draw-btn">표본 1회 추출</button>' +
  '</div>' +
  '<div class="card"><canvas id="tab2-dotplot-canvas" width="900" height="200"></canvas></div>' +
  '<div class="card"><div id="tab2-sample-table"></div></div>' +
  '<div class="card">' +
    '<div id="tab2-mean-calc"></div>' +
    '<div id="tab2-me-calc"></div>' +
    '<div id="tab2-ci-calc"></div>' +
  '</div>' +
  '<div class="card">' +
    '<canvas id="tab2-interval-canvas" width="900" height="120"></canvas>' +
    '<p id="tab2-verdict"></p>' +
  '</div>';

document.getElementById('tab2-n-slider').addEventListener('input', function(e) {
  state.sampleSize = Number(e.target.value);
  document.getElementById('tab2-n-label').textContent = state.sampleSize;
});
```

- [ ] **Step 2: 구간 시각화 함수와 표본추출/계산 로직 작성**

```js
function drawIntervalLine(canvas, interval, mu) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const margin = 60;
  const span = Math.max(interval.upper - interval.lower, 1) * 3;
  const min = interval.lower - span, max = interval.upper + span;
  const chartW = canvas.width - margin * 2;
  function xFor(v) { return margin + ((v - min) / (max - min)) * chartW; }

  const contains = containsMean(interval, mu);
  ctx.strokeStyle = contains ? '#16A34A' : '#DC2626';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(xFor(interval.lower), 60);
  ctx.lineTo(xFor(interval.upper), 60);
  ctx.stroke();
  ctx.lineWidth = 1;

  ctx.strokeStyle = '#1E293B';
  ctx.beginPath();
  ctx.moveTo(xFor(mu), 20);
  ctx.lineTo(xFor(mu), 100);
  ctx.stroke();
  ctx.fillStyle = '#1E293B';
  ctx.fillText('모평균 ' + mu, xFor(mu) - 20, 15);
}

function performTab2Draw() {
  const rng = Math.random;
  const sample = sampleWithReplacement(state.population, state.sampleSize, rng);
  const values = sample.map(function(s) { return s.minutes; });
  const sampleMean = mean(values);
  const interval = confidenceInterval(sampleMean, state.sigma, state.sampleSize, state.confidenceLevel);
  const contains = containsMean(interval, state.mu);

  state.currentSample = { sample: sample, sampleMean: sampleMean, interval: interval, contains: contains };
  state.history.push({
    n: state.sampleSize, confidenceLevel: state.confidenceLevel,
    sampleMean: sampleMean, lower: interval.lower, upper: interval.upper, contains: contains,
  });

  renderTab2();
  notify();
}

function renderTab2() {
  const cs = state.currentSample;
  if (!cs) return;
  drawDotPlot(document.getElementById('tab2-dotplot-canvas'), state.population, cs.sample.map(function(s) { return s.id; }));

  document.getElementById('tab2-sample-table').innerHTML =
    '<table><tr><th>ID</th><th>사용시간(분)</th></tr>' +
    cs.sample.map(function(s) { return '<tr><td>' + s.id + '</td><td>' + s.minutes + '</td></tr>'; }).join('') +
    '</table>';

  const values = cs.sample.map(function(s) { return s.minutes; });
  document.getElementById('tab2-mean-calc').textContent =
    '합계 ' + values.reduce(function(a, b) { return a + b; }, 0) + ' ÷ ' + values.length + ' = 표본평균 ' + cs.sampleMean.toFixed(2);

  document.getElementById('tab2-me-calc').innerHTML =
    'ME = ' + cs.interval.z + ' × ' + state.sigma + ' / √' + state.sampleSize + ' = ' + cs.interval.marginOfError.toFixed(2);

  document.getElementById('tab2-ci-calc').innerHTML =
    '[' + cs.sampleMean.toFixed(2) + ' - ' + cs.interval.marginOfError.toFixed(2) + ', ' +
    cs.sampleMean.toFixed(2) + ' + ' + cs.interval.marginOfError.toFixed(2) + '] = [' +
    cs.interval.lower.toFixed(2) + ', ' + cs.interval.upper.toFixed(2) + ']';

  drawIntervalLine(document.getElementById('tab2-interval-canvas'), cs.interval, state.mu);

  const verdictEl = document.getElementById('tab2-verdict');
  if (cs.contains) {
    verdictEl.textContent = '이번 신뢰구간은 ' + state.mu + '을(를) 포함합니다.';
    verdictEl.style.color = '#16A34A';
  } else {
    verdictEl.textContent = '이번 표본평균이 치우치게 추출되어 모평균 ' + state.mu + '을(를) 포함하지 못했습니다.';
    verdictEl.style.color = '#DC2626';
  }
}

document.getElementById('tab2-draw-btn').addEventListener('click', performTab2Draw);
```

- [ ] **Step 3: 브라우저에서 확인**

TAB2에서 "표본 1회 추출"을 누르면 도트플롯에 파란 점이 강조되고, 표본 테이블·평균 계산식·ME·신뢰구간이 표시되고, 구간 선분이 초록/빨강으로 판정되는지 확인한다. 여러 번 눌러 초록/빨강이 모두 나오는지 확인한다.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Implement TAB2 sample extraction visualizer"
```

---

### Task 8: TAB 3 — 설정 · 반복 추출 · 대시보드

**Files:**
- Modify: `index.html` (`#tab-3` 내부)

**Interfaces:**
- Consumes: `state`, `performTab2Draw`(재사용을 위해 표본추출 로직을 공용 함수로 분리), `state.history`
- Produces: `drawSampleForHistory(silent)`(애니메이션 여부 포함), `runTrials(count)`, `renderTab3Dashboard()`

- [ ] **Step 1: 표본추출 로직을 TAB2/TAB3 공용 함수로 리팩터링**

Task 7의 `performTab2Draw` 내부에서 추출+계산+history push 로직을 분리한다.

```js
function drawOneTrial() {
  const rng = Math.random;
  const sample = sampleWithReplacement(state.population, state.sampleSize, rng);
  const values = sample.map(function(s) { return s.minutes; });
  const sampleMean = mean(values);
  const interval = confidenceInterval(sampleMean, state.sigma, state.sampleSize, state.confidenceLevel);
  const contains = containsMean(interval, state.mu);
  const record = { sample: sample, sampleMean: sampleMean, interval: interval, contains: contains, n: state.sampleSize, confidenceLevel: state.confidenceLevel };
  state.currentSample = record;
  state.history.push(record);
  return record;
}

function performTab2Draw() {
  drawOneTrial();
  renderTab2();
  notify();
}
```

(Task 7 Step2의 `performTab2Draw` 정의를 이 코드로 교체한다.)

- [ ] **Step 2: `#tab-3` HTML — 설정, 버튼, 대시보드**

```js
document.getElementById('tab-3').innerHTML =
  '<div class="card">' +
    '<label>표본크기 (n): <span id="tab3-n-label">20</span></label>' +
    '<input id="tab3-n-slider" type="range" min="10" max="200" value="20"><br>' +
    '<label>신뢰도: </label>' +
    '<select id="tab3-cl-select"><option value="95">95%</option><option value="99">99%</option></select><br>' +
    '<label>속도: </label>' +
    '<input id="tab3-speed-slider" type="range" min="50" max="1000" value="300">' +
  '</div>' +
  '<div class="card">' +
    '<button id="tab3-draw-1-btn">1회</button>' +
    '<button id="tab3-draw-10-btn">10회</button>' +
    '<button id="tab3-draw-100-btn">100회</button>' +
    '<input id="tab3-custom-count-input" type="number" min="1" value="1" style="width:60px">' +
    '<button id="tab3-draw-custom-btn">추출</button>' +
    '<button id="tab3-pause-btn">일시정지</button>' +
    '<button id="tab3-reset-btn">초기화</button>' +
  '</div>' +
  '<div class="card"><div id="tab3-dashboard"></div></div>' +
  '<div class="card"><canvas id="tab3-errorbar-canvas" height="300"></canvas></div>' +
  '<div class="card"><canvas id="tab3-convergence-canvas" height="200"></canvas></div>' +
  '<div class="card"><canvas id="tab3-gauge-canvas" height="200"></canvas></div>';

document.getElementById('tab3-n-slider').addEventListener('input', function(e) {
  state.sampleSize = Number(e.target.value);
  document.getElementById('tab3-n-label').textContent = state.sampleSize;
});
document.getElementById('tab3-cl-select').addEventListener('change', function(e) {
  state.confidenceLevel = Number(e.target.value);
});
```

- [ ] **Step 3: 반복 추출 실행 로직 (`runTrials`)과 일시정지/초기화**

```js
state.simulationPaused = false;

function runTrials(count) {
  state.simulationPaused = false;
  const speed = Number(document.getElementById('tab3-speed-slider').value);
  let done = 0;
  function step() {
    if (state.simulationPaused || done >= count) return;
    drawOneTrial();
    renderTab3Dashboard();
    done++;
    setTimeout(step, speed);
  }
  step();
}

document.getElementById('tab3-draw-1-btn').addEventListener('click', function() { runTrials(1); });
document.getElementById('tab3-draw-10-btn').addEventListener('click', function() { runTrials(10); });
document.getElementById('tab3-draw-100-btn').addEventListener('click', function() { runTrials(100); });
document.getElementById('tab3-draw-custom-btn').addEventListener('click', function() {
  const n = Math.max(1, Number(document.getElementById('tab3-custom-count-input').value) || 1);
  runTrials(n);
});
document.getElementById('tab3-pause-btn').addEventListener('click', function() { state.simulationPaused = true; });
document.getElementById('tab3-reset-btn').addEventListener('click', function() {
  state.simulationPaused = true;
  state.history = [];
  state.currentSample = null;
  renderTab3Dashboard();
});
```

- [ ] **Step 4: 대시보드 렌더 함수 (차트는 Task 9에서 추가)**

```js
function renderTab3Dashboard() {
  const total = state.history.length;
  const success = state.history.filter(function(h) { return h.contains; }).length;
  const rate = total === 0 ? 0 : (success / total * 100);
  const lastMe = total === 0 ? 0 : state.history[total - 1].interval.marginOfError;
  document.getElementById('tab3-dashboard').innerHTML =
    '총 시행: ' + total + ' | 성공: ' + success + ' | 실패: ' + (total - success) +
    ' | 성공률: ' + rate.toFixed(1) + '% | 현재 오차한계: ' + lastMe.toFixed(2);
}

subscribe(renderTab3Dashboard);
renderTab3Dashboard();
```

- [ ] **Step 5: 브라우저에서 확인**

TAB3에서 "1회"/"10회"/"100회"와 숫자 입력+추출 버튼이 각각 동작하는지, 대시보드 수치가 올라가는지, "일시정지"가 진행 중인 반복을 멈추는지, "초기화"가 대시보드를 0으로 되돌리는지 확인한다. TAB2에서 추출한 결과도 이 대시보드의 총 시행에 반영되는지 확인한다.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Implement TAB3 controls, repeated trials, and dashboard"
```

---

### Task 9: TAB 3 차트 — Error Bar · 누적 성공률 · 게이지 (+ 축약 애니메이션)

**Files:**
- Modify: `index.html` (Task 8의 `renderTab3Dashboard` 확장)

**Interfaces:**
- Consumes: `state.history`, Chart.js 전역 `Chart`
- Produces: `renderTab3Charts()`, 모듈 스코프 변수 `errorBarChart`, `convergenceChart`, `gaugeChart`

- [ ] **Step 1: Chart.js 인스턴스 초기화 및 갱신 함수**

Error bar는 Chart.js 기본 scatter로는 구간 폭(하한~상한)을 선분으로 보여줄 수 없으므로, `type: 'bar'` + `indexAxis: 'y'`의 floating bar 기법(데이터를 `[lower, upper]` 배열로 전달)을 사용해 실제 구간이 가로 막대로 보이게 한다.

```js
const muLinePlugin = {
  id: 'muLine',
  afterDraw: function(chart) {
    const xScale = chart.scales.x;
    const yScale = chart.scales.y;
    const px = xScale.getPixelForValue(state.mu);
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = '#1E293B';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(px, yScale.top);
    ctx.lineTo(px, yScale.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

let errorBarChart = null, convergenceChart = null, gaugeChart = null;

function renderTab3Charts() {
  const history = state.history;
  const labels = history.map(function(h, i) { return String(i + 1); });
  const errorBarData = history.map(function(h) { return [h.lower, h.upper]; });
  const errorBarColors = history.map(function(h) { return h.contains ? '#16A34A' : '#DC2626'; });

  if (!errorBarChart) {
    errorBarChart = new Chart(document.getElementById('tab3-errorbar-canvas'), {
      type: 'bar',
      data: { labels: labels, datasets: [{ label: '신뢰구간', data: errorBarData, backgroundColor: errorBarColors, barThickness: 6 }] },
      options: {
        indexAxis: 'y',
        scales: {
          x: { title: { display: true, text: '신뢰구간 (분)' } },
          y: { title: { display: true, text: '회차' } },
        },
      },
      plugins: [muLinePlugin],
    });
  } else {
    errorBarChart.data.labels = labels;
    errorBarChart.data.datasets[0].data = errorBarData;
    errorBarChart.data.datasets[0].backgroundColor = errorBarColors;
    errorBarChart.update();
  }

  const convergenceData = history.map(function(h, i) {
    const successCount = history.slice(0, i + 1).filter(function(x) { return x.contains; }).length;
    return { x: i + 1, y: (successCount / (i + 1)) * 100 };
  });

  if (!convergenceChart) {
    convergenceChart = new Chart(document.getElementById('tab3-convergence-canvas'), {
      type: 'line',
      data: { datasets: [{ label: '누적 성공률(%)', data: convergenceData, borderColor: '#2563EB', pointRadius: 0 }] },
      options: { scales: { x: { type: 'linear', title: { display: true, text: '시행 횟수' } }, y: { min: 0, max: 100 } } },
    });
  } else {
    convergenceChart.data.datasets[0].data = convergenceData;
    convergenceChart.update();
  }

  const total = history.length;
  const rate = total === 0 ? 0 : (history.filter(function(h) { return h.contains; }).length / total * 100);
  if (!gaugeChart) {
    gaugeChart = new Chart(document.getElementById('tab3-gauge-canvas'), {
      type: 'doughnut',
      data: { labels: ['성공률', ''], datasets: [{ data: [rate, 100 - rate], backgroundColor: ['#16A34A', '#E2E8F0'] }] },
      options: { circumference: 180, rotation: 270, cutout: '70%' },
    });
  } else {
    gaugeChart.data.datasets[0].data = [rate, 100 - rate];
    gaugeChart.update();
  }
}

subscribe(renderTab3Charts);
renderTab3Charts();
```

- [ ] **Step 2: `drawOneTrial`에 축약 애니메이션 훅 추가**

Task 8의 `drawOneTrial` 호출부(`runTrials`의 `step` 함수) 바로 다음 줄에 도트플롯 강조를 추가한다. `runTrials` 내부 `step` 함수를 아래로 교체:

```js
function step() {
  if (state.simulationPaused || done >= count) return;
  const record = drawOneTrial();
  drawDotPlot(document.getElementById('tab2-dotplot-canvas'), state.population, record.sample.map(function(s) { return s.id; }));
  renderTab3Dashboard();
  renderTab3Charts();
  done++;
  setTimeout(step, speed);
}
```

(평균 계산·ME·CI의 상세 숫자 전개 애니메이션은 여기서 호출하지 않는다 — Global Constraints의 축약 애니메이션 정책에 따름. 도트플롯 강조와 다음 Step에서 만들 구간 등장/판정만 유지한다.)

- [ ] **Step 3: 브라우저에서 확인**

TAB3에서 "10회", "100회"를 눌렀을 때 Error bar plot에 회차별 신뢰구간이 가로 막대(초록/빨강)로 쌓이고 모평균 세로 점선이 보이는지, 누적 성공률 line chart가 95%(또는 99%) 근처로 수렴하는 모습을 보이고, 게이지가 실시간으로 갱신되는지 확인한다. 100회 실행 시 화면이 버벅이지 않고 각 회차마다 짧게 도트가 반짝이는지 확인한다.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Implement TAB3 error bar plot, convergence chart, gauge, and abbreviated animation"
```

---

### Task 10: TAB 3 고급 옵션 (모평균 · 모표준편차 · 모집단크기 · 시드)

**Files:**
- Modify: `index.html` (Task 8의 `#tab-3` HTML에 패널 추가)

**Interfaces:**
- Consumes: `regeneratePopulation`
- Produces: `#tab3-advanced-panel` UI, 이벤트 핸들러가 `regeneratePopulation` 호출

- [ ] **Step 1: 고급 옵션 패널 HTML 추가**

Task 8 Step2의 `#tab-3` 설정 카드 안에 이어붙인다:

```js
document.querySelector('#tab-3 .card').insertAdjacentHTML('beforeend',
  '<details><summary>고급 옵션 (모집단 파라미터 직접 조작)</summary>' +
    '<label>모평균 (μ): <input id="adv-mu-input" type="number" value="240"></label><br>' +
    '<label>모표준편차 (σ): <input id="adv-sigma-input" type="number" value="40" min="1"></label><br>' +
    '<label>모집단 크기: <input id="adv-popsize-input" type="number" value="1000" min="200"></label><br>' +
    '<label>랜덤 시드 (비우면 매번 랜덤): <input id="adv-seed-input" type="number"></label><br>' +
    '<button id="adv-apply-btn">모집단 재생성 적용</button>' +
  '</details>'
);
```

- [ ] **Step 2: 유효성 검사 및 적용 이벤트**

```js
document.getElementById('adv-apply-btn').addEventListener('click', function() {
  const mu = Number(document.getElementById('adv-mu-input').value);
  const sigma = Math.max(1, Number(document.getElementById('adv-sigma-input').value));
  const popSize = Math.max(200, Number(document.getElementById('adv-popsize-input').value));
  const seedRaw = document.getElementById('adv-seed-input').value;
  const seed = seedRaw === '' ? null : Number(seedRaw);

  regeneratePopulation(mu, sigma, popSize, seed);
  alert('모집단이 새 파라미터로 재생성되어 누적된 표본추출 결과가 초기화되었습니다.');
});
```

- [ ] **Step 3: 브라우저에서 확인**

고급 옵션에서 모평균/모표준편차/모집단크기/시드를 바꾸고 "모집단 재생성 적용"을 누르면 TAB0의 히스토그램과 통계량, TAB3 대시보드가 초기화되고 새 파라미터를 반영하는지 확인한다. 같은 시드를 두 번 입력하면 같은 모집단이 재현되는지 확인한다 (`state.population[0].minutes` 값이 동일한지 콘솔에서 비교).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Implement TAB3 advanced options for population parameters"
```

---

### Task 11: 반응형 마감 · 최종 통합 점검 · 스모크 테스트 정리

**Files:**
- Modify: `index.html` (전체)

**Interfaces:**
- Consumes: 전체 앱
- Produces: 없음 (마감 작업)

- [ ] **Step 1: 반응형 스타일 보강**

`<style>`에 아래 미디어 쿼리를 추가해 1920/1440/1280/1024/태블릿 폭에서 카드와 캔버스가 잘리지 않게 한다.

```css
.card canvas { max-width: 100%; height: auto; }
@media (max-width: 1280px) {
  .tab-panel { padding: 16px; }
}
@media (max-width: 768px) {
  .tab-nav button { font-size: 13px; padding: 8px 12px; }
}
```

- [ ] **Step 2: 콘솔 스모크 테스트 정리**

Task 2, Task 6에서 추가한 `console.assert` 블록들이 여전히 통과하는지 최종 확인 후, `selfTestMathHelpers` 즉시실행함수는 그대로 두어도 무방하다(부작용 없음). 페이지 로드시 콘솔에 에러가 하나도 없어야 한다.

- [ ] **Step 3: 전체 시나리오 수동 검증**

1. TAB0 → TAB1 Step1~5 및 확인 예제 → TAB2에서 3회 추출(초록/빨강 모두 확인) → TAB3에서 표본크기·신뢰도 바꿔가며 100회 자동 추출 → 누적 성공률이 설정한 신뢰도 근처로 수렴하는지 확인.
2. TAB0 "모집단 다시 생성"과 TAB3 고급 옵션 각각에서 재생성 시 TAB2/TAB3 누적 결과가 초기화되는지 확인.
3. 브라우저 창 폭을 1920 → 1024 → 모바일 폭까지 줄여가며 레이아웃이 깨지지 않는지 확인.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Polish responsive layout and complete end-to-end verification"
```
