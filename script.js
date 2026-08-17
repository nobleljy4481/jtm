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

    ctx.strokeStyle = "#1E293B";
    if (!revealMu) { ctx.setLineDash([5, 5]); }
    ctx.beginPath();
    ctx.moveTo(xForValue(mu), originY);
    ctx.lineTo(xForValue(mu), originY - chartH);
    ctx.stroke();
    ctx.setLineDash([]);

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
    const muLabel = revealMu ? String(Math.round(mu)) : "실제 모평균 위치 (비공개)";
    ctx.fillText(muLabel, xForValue(mu), originY + 14);
    ctx.font = "12px Pretendard, sans-serif";
    ctx.fillText("사용시간 (분)", originX + chartW / 2, originY + 30);

    ctx.save();
    ctx.translate(16, originY - chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("도수 (명)", 0, 0);
    ctx.restore();
    ctx.textAlign = "left";
  }

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

  /* ===== Task 4: 1단계 — 현실적 탐구 상황 ===== */

  function initPopulation() {
    if (state.population.length === 0) {
      state.population = generatePopulation(state.mu, state.sigma, state.populationSize, state.seed);
    }
  }

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

  // 임시 초기화 호출 (Task 13에서 정식 init()으로 교체 예정)
  loadState();
  initPopulation();
  s1Render();
  s2Render();
  s3Render();
  goToStep(1);
  initNavEvents();

})();
