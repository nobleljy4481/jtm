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

  /* ===== Task 6: 4단계 — 구간 길이와 포함 정도 탐구 ===== */

  function computeMarginInterval(sampleMean, marginMinutes) {
    return { lower: sampleMean - marginMinutes, upper: sampleMean + marginMinutes, marginMinutes: marginMinutes };
  }

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
        s6DerivRender();
      });
    });
    document.getElementById("s6-z").addEventListener("input", function (e) {
      state.s6Z = Number(e.target.value);
      saveState();
      s6FindRender();
      s6DerivRender();
    });
  }

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

  // 임시 초기화 호출 (Task 13에서 정식 init()으로 교체 예정)
  loadState();
  initPopulation();
  s1Render();
  s2Render();
  s3Render();
  s4Render();
  s5Render();
  s6FindRender();
  s6DerivRender();
  goToStep(1);
  initNavEvents();

})();
