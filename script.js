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

})();
