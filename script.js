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
      s2DiscoveryDraft: "",

      s3Text: "",
      s3DiscoveryDraft: "",

      s4Margin: 5,
      s4Single: null,
      s4Batch: [],
      s4Explored: {},
      s4DiscoveryDraft: "",

      s6Target: 95,
      s6Z: 0,
      s6Found95: false,
      s6Found99: false,

      s6DerivLevel: 95,
      s6DerivLine: 0,
      s6DiscoveryDraft: "",

      sampleSize: 20,
      confidenceLevel: 95,
      currentSample: null,
      s7DiscoveryDraft: "",

      history: [],
      tab8ViewMode: "95",
      simulationPaused: false,
      s8DiscoveryDraft: "",

      s9Explored: {},
      s9DiscoveryDraft: "",

      s10Text: "",
      s10JustifyDecision: "",
      s10JustifyReason: "",
      s10SynthesisText: "",
      s10DiscoveryDraft: "",

      s5DiscoveryDraft: "",
      studentDiscoveries: [], // [{ step, text }] — 학생이 직접 쓴 발견 문장(자동 생성 아님)
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

  /* ===== 개념기반 교육과정 요소: "우리가 지금까지 발견한 것" =====
     프로그램이 정답을 미리 채워 넣지 않는다. 학생이 각 단계의 활동을 마친 뒤
     자신의 언어로 쓴 문장만 여기 쌓인다. 단계를 오가도 유지되고, "처음부터 다시"를
     누르면 함께 초기화된다(state에 포함되어 localStorage로 저장/삭제되므로). */

  const DISCOVERY_STEP_LABELS = {
    2: "2단계", 3: "3단계", 4: "4단계", 5: "5단계", 6: "6단계",
    7: "7단계", 8: "8단계", 9: "9단계", 10: "10단계",
  };

  function discoveryLabel(step) {
    return DISCOVERY_STEP_LABELS[step] || (step + "단계");
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function addStudentDiscovery(step, text) {
    text = (text || "").trim();
    if (!text) return false;
    state.studentDiscoveries.push({ step: step, text: text });
    saveState();
    renderDiscoveriesPanel();
    return true;
  }

  // 목록 안에서 인라인으로 수정 중인 항목의 인덱스(페이지 상태일 뿐, 저장 대상 아님)
  let editingDiscoveryIndex = -1;

  function renderDiscoveriesPanel() {
    const list = document.getElementById("discoveriesList");
    const empty = document.getElementById("discoveriesEmpty");
    if (!list || !empty) return;
    if (state.studentDiscoveries.length === 0) {
      list.innerHTML = "";
      empty.style.display = "";
      return;
    }
    empty.style.display = "none";
    list.innerHTML = state.studentDiscoveries.map(function (d, i) {
      const label = discoveryLabel(d.step);
      if (i === editingDiscoveryIndex) {
        return '<li class="discovery-editing">' +
          '<span class="discovery-step-tag">' + label + '</span>' +
          '<textarea class="discovery-edit-input" rows="2">' + escapeHtml(d.text) + '</textarea>' +
          '<div class="discovery-edit-actions">' +
            '<button class="btn-primary discovery-save-btn" data-idx="' + i + '">저장</button>' +
            '<button class="btn-secondary discovery-cancel-btn">취소</button>' +
          '</div>' +
        '</li>';
      }
      return '<li><span class="discovery-step-tag">' + label + '</span>' +
        '<span class="discovery-text">' + escapeHtml(d.text) + '</span>' +
        '<button class="discovery-edit-btn" data-idx="' + i + '" title="수정">✏️</button></li>';
    }).join("");

    list.querySelectorAll(".discovery-edit-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        editingDiscoveryIndex = Number(btn.dataset.idx);
        renderDiscoveriesPanel();
      });
    });
    list.querySelectorAll(".discovery-save-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const idx = Number(btn.dataset.idx);
        const textarea = btn.closest("li").querySelector(".discovery-edit-input");
        const newText = textarea.value.trim();
        if (newText) state.studentDiscoveries[idx].text = newText;
        editingDiscoveryIndex = -1;
        saveState();
        renderDiscoveriesPanel();
      });
    });
    list.querySelectorAll(".discovery-cancel-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        editingDiscoveryIndex = -1;
        renderDiscoveriesPanel();
      });
    });
  }

  // 단계별 "발견 작성" 질문. 1단계는 아직 활동이 없어 항목이 없다.
  const DISCOVERY_QUESTIONS = {
    2: "표본을 여러 번 뽑아보니 표본평균은 어떻게 달라졌나요? 이번 활동에서 발견한 것을 한 문장으로 적어보세요.",
    3: "하나의 값이 아니라 범위로 추정하면 어떤 점이 좋을까요? 이 활동에서 발견한 것을 적어보세요.",
    4: "오차범위(구간의 폭)를 넓히거나 좁힐 때, 모평균을 포함하는 정도는 어떻게 달라졌나요? 발견한 관계를 적어보세요.",
    5: "신뢰도와 신뢰구간 사이에는 어떤 관계가 있었나요? 발견한 관계를 한 문장으로 적어보세요.",
    6: "표준정규분포에서 찾은 z값은 신뢰구간 공식에서 어떤 역할을 하나요? 이번 활동에서 알게 된 것을 적어보세요.",
    7: "신뢰도(95%, 99%)에 따라 같은 표본의 신뢰구간은 어떻게 달라졌나요? 발견한 것을 적어보세요.",
    8: "같은 방법으로 표본추출과 신뢰구간 구성을 반복했을 때 어떤 규칙성을 발견했나요?",
    9: "표본의 크기가 달라질 때 신뢰구간은 어떻게 달라졌나요? 발견한 관계를 적어보세요.",
    10: "이번 학습을 통해 알게 된 내용을 바탕으로, 탐구 질문에 대한 자신의 생각을 일반화하여 한 문장으로 정리해 보세요.",
  };

  // 대부분의 단계는 "발견한 것 적어보기"지만, 10단계는 지금까지의 활동을 종합해
  // 탐구 질문에 대한 일반화를 쓰는 성격이라 카드 제목을 다르게 표시한다.
  const DISCOVERY_CARD_TITLES = { 10: "탐구 질문에 대한 일반화하기" };

  function discoveryPromptCardHtml(step, question, draftValue) {
    const title = DISCOVERY_CARD_TITLES[step] || "발견한 것 적어보기";
    return '<div class="card discovery-prompt-card">' +
      '<h3><span class="panel-icon">💡</span> ' + title + '</h3>' +
      '<p>' + question + '</p>' +
      '<textarea id="s' + step + '-discovery-draft" rows="3" placeholder="한 문장으로 적어보세요.">' + escapeHtml(draftValue || "") + '</textarea>' +
      '<button class="btn-secondary discovery-add-btn" data-step="' + step + '" style="margin-top:8px;">발견한 내용에 추가하기</button>' +
      '</div>';
  }

  // 오른쪽 사이드바에 "지금 보고 있는 단계"의 발견 작성 카드 하나만 그린다.
  // goToStep()에서 단계가 바뀔 때마다 다시 호출된다. 1단계는 질문이 없어 비워둔다.
  function renderDiscoveryWriteSlot() {
    const slot = document.getElementById("discoveryWriteSlot");
    if (!slot) return;
    const step = state.currentStep;
    const question = DISCOVERY_QUESTIONS[step];
    if (!question) {
      slot.innerHTML = "";
      return;
    }
    const draftField = "s" + step + "DiscoveryDraft";
    slot.innerHTML = discoveryPromptCardHtml(step, question, state[draftField]);

    const textarea = document.getElementById("s" + step + "-discovery-draft");
    textarea.addEventListener("input", function (e) {
      state[draftField] = e.target.value;
      saveState();
    });
    document.querySelector('.discovery-add-btn[data-step="' + step + '"]').addEventListener("click", function () {
      const added = addStudentDiscovery(step, textarea.value);
      if (added) {
        state[draftField] = "";
        saveState();
        renderDiscoveryWriteSlot();
      }
    });
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
    // 발견 사이드바(작성 카드 + 누적 목록)는 1단계(아직 아무 활동도 없음)에는 보이지 않고 2단계부터 나타난다.
    const sidebar = document.getElementById("discoverySidebar");
    if (sidebar) sidebar.style.display = (n === 1) ? "none" : "";
    renderDiscoveryWriteSlot();
    saveState();
    window.scrollTo(0, 0);
  }

  function initNavEvents() {
    document.getElementById("prevBtn").addEventListener("click", function () { goToStep(state.currentStep - 1); });
    document.getElementById("nextBtn").addEventListener("click", function () { goToStep(state.currentStep + 1); });
    document.querySelectorAll("#progressBar li").forEach(function (li) {
      li.addEventListener("click", function () { goToStep(Number(li.dataset.step)); });
    });
    document.getElementById("resetBtn").addEventListener("click", function () {
      if (!confirm("처음부터 다시 시작하시겠습니까? 지금까지의 진행 상황이 모두 사라집니다.")) return;
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
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
    const previewSample = state.population.slice(0, 20);
    const previewMean = mean(previewSample.map(function (s) { return s.minutes; }));
    container.innerHTML =
      '<h2>일부만 보고 전체를 어떻게 판단할 수 있을까?</h2>' +
      '<div class="card">' +
        '<p>우리 학교 고등학생 1,000명의 <strong>하루 스마트폰 사용시간(분)</strong>이 궁금합니다. ' +
        '하지만 1,000명 전체를 다 조사하는 건 시간과 비용이 많이 듭니다.</p>' +
        '<p>그래서 담당 선생님은 <strong>학생 ' + previewSample.length + '명만 무작위로 뽑아</strong> 사용시간을 먼저 살펴보기로 했습니다.</p>' +
      '</div>' +
      '<div class="card">' +
        '<p><strong>미리 뽑아본 학생 ' + previewSample.length + '명이 전체 1,000명 중 어디쯤 있는지</strong></p>' +
        '<canvas id="s1-dotplot-canvas" width="600" height="200"></canvas>' +
        '<p class="hint">파란 점이 이번에 뽑은 ' + previewSample.length + '명, 회색 점은 아직 살펴보지 않은 나머지 학생입니다.</p>' +
      '</div>' +
      '<div class="card">' +
        '<p><strong>뽑아본 학생 ' + previewSample.length + '명의 사용시간</strong></p>' +
        '<div class="scroll-box"><table><tr><th>ID</th><th>사용시간(분)</th></tr>' +
        previewSample.map(function (s) { return "<tr><td>" + s.id + "</td><td>" + s.minutes + "</td></tr>"; }).join("") +
        '</table></div>' +
        '<p class="summary-text">이 ' + previewSample.length + '명의 평균은 <strong>' + previewMean.toFixed(1) + '분</strong>입니다.</p>' +
      '</div>' +
      '<div class="card predict-card">' +
        '<label for="s1-predict">이 ' + previewSample.length + '명의 평균(' + previewMean.toFixed(1) + '분)을 보고, <strong>학교 전체 학생 1,000명의 평균 사용시간</strong>은 몇 분쯤일 것 같나요?</label>' +
        '<div class="predict-row" style="display:flex;align-items:center;gap:8px;margin:10px 0;">' +
          '<input type="number" id="s1-predict" min="0" max="600" step="1" placeholder="예: 200">' +
          '<span>분</span>' +
        '</div>' +
        '<p class="hint">정답을 맞히는 활동이 아닙니다. 여러분의 예상을 적어두면, 뒤에서 실제 값을 확인할 때 비교해볼 수 있어요.</p>' +
      '</div>';

    drawDotPlot(document.getElementById("s1-dotplot-canvas"), state.population, previewSample.map(function (s) { return s.id; }));

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
      '<h2>표본에서 얻은 하나의 값은 얼마나 믿을 수 있을까?</h2>' +
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
      '<h2>왜 어떤 값이 아니라 범위로 추정해야 할까?</h2>' +
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
      '<h2>구간 추정의 범위를 넓히면 무엇이 달라질까?</h2>' +
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
      '<h2>추정의 불확실성은 어떻게 표현하고 해석할 수 있는가? — 95%, 99% 신뢰한다는 것은 무엇을 의미할까?</h2>' +
      '<div class="card">' +
        '<p>모평균을 추정하기 위해 만든 구간을 <strong>"신뢰구간"</strong>이라 부르고, 같은 방법으로 구간을 반복해서 만들었을 때 그 구간이 실제 모평균을 포함할 것으로 기대되는 비율을 <strong>"신뢰도"</strong>라고 합니다.</p>' +
        '<p>일반적으로 통계에서는 신뢰도로 <strong>95%와 99%</strong>를 많이 사용합니다.</p>' +
      '</div>';
  }

  const TARGET_TOLERANCE = 0.003;

  // z 슬라이더 등 "텍스트/캔버스/찾음 상태"만 바뀌는 경우를 위한 경량 갱신 함수.
  // #s6-find-section의 DOM 구조(특히 <input id="s6-z">)는 건드리지 않아야
  // 드래그 중 pointer capture가 끊기지 않는다.
  function s6UpdateFindDisplay() {
    const targetArea = state.s6Target / 100;
    const currentArea = normalAreaBetween(state.s6Z);
    const found = Math.abs(currentArea - targetArea) < TARGET_TOLERANCE;

    const wasFound = state.s6Target === 95 ? state.s6Found95 : state.s6Found99;
    if (found) {
      if (state.s6Target === 95) state.s6Found95 = true;
      if (state.s6Target === 99) state.s6Found99 = true;
    }
    // 방금 이 목표값을 처음 찾았고, 부등식 변형 카드가 같은 신뢰도 수준을 보고 있다면
    // 카드가 잠금 해제된 상태로 즉시 다시 그려지도록 한다. (#s6-find-section의 DOM은
    // 이 함수에서 건드리지 않으므로 슬라이더 드래그 중 pointer capture는 영향받지 않는다.)
    if (found && !wasFound && state.s6DerivLevel === state.s6Target) {
      s6DerivRender();
    }

    document.getElementById("s6-z-val").textContent = state.s6Z.toFixed(2);
    drawNormalCurveInteractive(document.getElementById("s6-curve-canvas"), state.s6Z, found);

    const readout = document.getElementById("s6-area-readout");
    readout.textContent = "현재 가운데 영역: " + currentArea.toFixed(3) + " (목표: " + targetArea.toFixed(2) + ")";
    readout.classList.toggle("found", found);

    const foundBox = document.getElementById("s6-found-box");
    foundBox.classList.toggle("correct", found);
    foundBox.classList.toggle("hidden", !found);
    foundBox.textContent = found
      ? ("찾았습니다! z ≈ " + state.s6Z.toFixed(2) + "일 때 가운데 영역이 " + targetArea.toFixed(2) + "가 됩니다. 이 값이 " + state.s6Target + "% 신뢰도의 신뢰구간에 쓰이는 값입니다.")
      : "";

    document.querySelectorAll("#s6-target .toggle-btn").forEach(function (btn) {
      const val = Number(btn.dataset.val);
      const isFound = val === 95 ? state.s6Found95 : state.s6Found99;
      btn.textContent = (val === 95 ? "95% 찾기" : "99% 찾기") + (isFound ? " ✓" : "");
    });

    return found;
  }

  function s6FindRender() {
    const container = document.getElementById("step-6");

    // 헤더와 소개 콘텐츠는 처음 한 번만 설정
    if (!container.querySelector("#s6-find-section")) {
      container.innerHTML =
        '<h2>표준정규분포에서 찾은 z값으로, 신뢰구간을 나타내는 식을 어떻게 만들 수 있을까?</h2>' +
        '<div class="card">' +
          '<p>아래 슬라이더로 표준정규분포의 가운데 영역을 조절하면서, 그 영역의 넓이가 0.95, 0.99가 되는 순간의 z값을 찾아봅시다.</p>' +
        '</div>';
    }

    // 자체 범위인 #s6-find-section만 관리
    const existing = container.querySelector("#s6-find-section");
    if (existing) existing.remove();

    const section = document.createElement("div");
    section.id = "s6-find-section";
    section.innerHTML =
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
        '<p class="summary-text" id="s6-area-readout"></p>' +
        '<div class="feedback hidden" id="s6-found-box"></div>' +
      '</div>';

    // #s6-deriv-section이 존재하면 그 앞에, 없으면 마지막에 삽입
    const derivSection = container.querySelector("#s6-deriv-section");
    if (derivSection) {
      container.insertBefore(section, derivSection);
    } else {
      container.appendChild(section);
    }

    s6UpdateFindDisplay();

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
      s6UpdateFindDisplay();
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
    const found = level === 95 ? state.s6Found95 : state.s6Found99;

    const section = document.createElement("div");
    section.id = "s6-deriv-section";

    const toggleHtml =
      '<div class="control-row toggle-row"><span>신뢰도</span>' +
        '<div class="toggle-group" id="s6-deriv-level">' +
          '<button class="toggle-btn' + (level === 95 ? " active" : "") + '" data-val="95">95%</button>' +
          '<button class="toggle-btn' + (level === 99 ? " active" : "") + '" data-val="99">99%</button>' +
        '</div></div>';

    if (!found) {
      section.innerHTML =
        '<div class="card">' +
          '<h3>부등식 변형 — 방금 찾은 z값으로 신뢰구간 공식 유도하기</h3>' +
          toggleHtml +
          '<p class="summary-text">먼저 위에서 슬라이더로 z값을 찾아보세요. z를 찾으면 이 카드에 부등식 유도 과정이 나타납니다.</p>' +
        '</div>';
      container.appendChild(section);

      document.querySelectorAll("#s6-deriv-level .toggle-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          state.s6DerivLevel = Number(btn.dataset.val);
          saveState();
          s6DerivRender();
        });
      });
      return;
    }

    const lines = s6DerivLines(level);
    const options = s6McqOptions(level);

    section.innerHTML =
      '<div class="card">' +
        '<h3>부등식 변형 — 방금 찾은 z값으로 신뢰구간 공식 유도하기</h3>' +
        toggleHtml +
        '<div id="s6-deriv-lines">' + lines.map(function (l) { return "<p>" + l + "</p>"; }).join("") + '</div>' +
        '<p>이 부등식을 <strong>m</strong>에 대해 정리하면 다음 중 어느 것이 될까요?</p>' +
        '<div class="mcq" id="s6-mcq">' +
          options.map(function (opt, i) {
            return '<label class="mcq-option"><input type="radio" name="s6mcq" value="' + i + '"><span>' + opt.text + '</span></label>';
          }).join("") +
        '</div>' +
        '<div class="feedback hidden" id="s6-mcq-feedback"></div>' +
      '</div>';
    insertDerivSection();

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
    // state.history에는 원본 sample 배열을 저장하지 않는다 — 이력 중 화면에 표시되는 건
    // 가장 최근 표본(state.currentSample)뿐이므로, 매 시행마다 학생 배열 전체를 쌓아두면
    // 반복 시뮬레이션(100회 등)에서 state가 불필요하게 커진다.
    const record = {
      sampleMean: sampleMean, n: state.sampleSize,
      interval95: interval95, interval99: interval99,
      contains95: contains95, contains99: contains99,
      interval: selectedInterval, contains: selectedContains,
    };
    state.currentSample = Object.assign({ sample: sample }, record);
    state.history.push(record);
    return state.currentSample;
  }

  function s7DrawSample() {
    drawOneTrial();
    saveState();
    s7Render();
  }

  function s7Render() {
    const container = document.getElementById("step-7");
    container.innerHTML =
      '<h2>표본에서 구한 신뢰구간은 어떻게 해석할 수 있을까?</h2>' +
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

    // 신뢰도 토글은 이미 그려진 표본을 다시 뽑지 않고, 같은 표본의 두 구간
    // (interval95/interval99) 중 현재 state.confidenceLevel에 맞는 쪽을 골라 보여준다.
    const selInterval = state.confidenceLevel === 99 ? cs.interval99 : cs.interval95;
    const selContains = state.confidenceLevel === 99 ? cs.contains99 : cs.contains95;

    const values = cs.sample.map(function (s) { return s.minutes; });
    document.getElementById("s7-calc").innerHTML =
      "합계 " + values.reduce(function (a, b) { return a + b; }, 0) + " ÷ " + values.length + " = 표본평균 " + cs.sampleMean.toFixed(2) + "<br>" +
      "ME = " + selInterval.z + " × " + state.sigma + " / √" + cs.n + " = " + selInterval.marginOfError.toFixed(2) + "<br>" +
      "[" + cs.sampleMean.toFixed(2) + " - " + selInterval.marginOfError.toFixed(2) + ", " + cs.sampleMean.toFixed(2) + " + " + selInterval.marginOfError.toFixed(2) + "] = [" +
      selInterval.lower.toFixed(2) + ", " + selInterval.upper.toFixed(2) + "]";

    drawIntervalLine(document.getElementById("s7-interval-canvas"), selInterval, state.mu, cs.sampleMean, state.meanRevealed);
    const verdictEl = document.getElementById("s7-verdict");
    verdictEl.textContent = selContains
      ? "이번 신뢰구간은 실제 모평균 위치를 포함합니다."
      : "이번 표본평균이 치우치게 추출되어 실제 모평균 위치를 포함하지 못했습니다.";
    verdictEl.style.color = selContains ? "#16A34A" : "#DC2626";
  }

  /* ===== Task 11: 8단계 — 반복 시뮬레이션 + 모평균 공개 ===== */

  let convergenceChart = null, gauge95Chart = null, gauge99Chart = null;
  let errorBarAnimHandle = null;

  function drawErrorBarChartFrame(canvas, history, mode, mu, lastBarAlpha) {
    const ctx = canvas.getContext("2d");
    // drawMarginBatchChart(Task 6)와 같은 패턴: 이력이 늘어나도 캔버스 높이가 무한정
    // 커지지 않도록 행 높이를 예산(300px) 안에서 압축한다. 시행 수가 적을 때는 기존과
    // 동일하게 16px를 유지한다. rowH에는 바닥값(0.5px)이 있어 아주 많은 시행에서는
    // 다시 선형으로 늘 수 있으므로, 캔버스 높이 자체에도 상한을 둔다.
    const rowH = Math.max(0.5, Math.min(16, 300 / Math.max(history.length, 1)));
    const topPad = 26, bottomPad = 30, leftPad = 44, rightPad = 12;
    const MAX_ERRORBAR_HEIGHT = 500;
    canvas.width = 600;
    canvas.height = Math.min(MAX_ERRORBAR_HEIGHT, Math.max(160, topPad + bottomPad + history.length * rowH));
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

  function renderGauges(rate95, rate99) {
    // Chart.js CDN 로드 실패 시(오프라인 등) 여기서 예외를 던지면 s8RenderResults()를
    // 호출한 setTimeout 콜백 전체가 중단되어 다음 시행 예약(setTimeout)까지 함께 끊긴다.
    // 대시보드/Error Bar 등 Chart.js에 의존하지 않는 나머지 렌더링은 계속 동작해야 하므로
    // 여기서는 조용히 건너뛴다.
    if (typeof Chart === "undefined") return;
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
    if (typeof Chart === "undefined") return;
    const history = state.history;
    const mode = state.tab8ViewMode;
    const datasets = [];
    function cumulativeRate(key) {
      let count = 0;
      return history.map(function (h, i) {
        if (h[key]) count++;
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
    // innerHTML로 #step-8을 다시 그릴 때마다 기존 canvas가 새 canvas로 교체되므로,
    // 이전 canvas를 가리키던 Chart.js 인스턴스를 먼저 destroy해서 renderGauges()/
    // renderConvergenceChart()가 새 canvas에 다시 생성되도록 한다.
    if (gauge95Chart) { gauge95Chart.destroy(); gauge95Chart = null; }
    if (gauge99Chart) { gauge99Chart.destroy(); gauge99Chart = null; }
    if (convergenceChart) { convergenceChart.destroy(); convergenceChart = null; }

    const firstEntry = !state.meanRevealed;
    state.meanRevealed = true;
    saveState();

    const container = document.getElementById("step-8");
    container.innerHTML =
      (firstEntry ? '<div class="card reflect-card"><p><strong>사실 모집단은 이랬습니다!</strong> 지금까지 여러분이 추정해온 진짜 모집단을 공개합니다.</p></div>' : '') +
      '<h2>신뢰도의 의미는 반복해서 구한 신뢰구간에서 어떻게 나타날까?</h2>' +
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

  /* ===== Task 12: 9단계 — 표본크기의 영향 ===== */

  // n 슬라이더 드래그 중 호출되는 경량 갱신 함수. #step-9의 DOM 구조(특히
  // <input id="s9-n">)는 건드리지 않아야 드래그 중 pointer capture가 끊기지 않는다.
  function s9UpdateDisplay(n) {
    const sample = sampleWithReplacement(state.population, n, Math.random);
    const sampleMean = mean(sample.map(function (s) { return s.minutes; }));
    const ci = confidenceInterval(sampleMean, state.sigma, n, 95);
    state.s9Explored[n] = ci.upper - ci.lower;
    saveState();

    document.getElementById("s9-n-val").textContent = n;
    drawIntervalLine(document.getElementById("s9-interval-canvas"), ci, state.mu, sampleMean, state.meanRevealed);
    document.getElementById("s9-summary").textContent =
      "n = " + n + "일 때, 95% 신뢰구간은 [" + ci.lower.toFixed(1) + ", " + ci.upper.toFixed(1) + "]이며 폭은 " + (ci.upper - ci.lower).toFixed(1) + "입니다.";
    drawTrendChart(document.getElementById("s9-trend-canvas"), state.s9Explored, [10, 200], [0, 60]);
  }

  function s9Render() {
    const container = document.getElementById("step-9");
    const n = state.sampleSize;

    container.innerHTML =
      '<h2>더 많은 자료는 신뢰구간에 어떤 영향을 미칠까?</h2>' +
      '<div class="card"><p>신뢰도(95%)는 고정하고, 표본크기(n)만 바꿔가며 신뢰구간의 폭이 어떻게 달라지는지 슬라이더로 확인해보세요.</p></div>' +
      '<div class="card controls-card">' +
        '<div class="control-row"><label for="s9-n">표본크기 (n = <span id="s9-n-val">' + n + '</span>명)</label>' +
        '<input type="range" id="s9-n" min="10" max="200" step="5" value="' + n + '"></div>' +
      '</div>' +
      '<div class="card"><canvas id="s9-interval-canvas" width="600" height="120"></canvas>' +
        '<p id="s9-summary" class="summary-text"></p></div>' +
      '<div class="card"><canvas id="s9-trend-canvas" width="600" height="90"></canvas>' +
        '<p class="hint">가로축: 표본크기 n (10~200) · 세로축: 신뢰구간 폭 · 슬라이더를 움직여 여러 n을 탐색해보세요.</p></div>';

    s9UpdateDisplay(n);

    document.getElementById("s9-n").addEventListener("input", function (e) {
      state.sampleSize = Number(e.target.value);
      s9UpdateDisplay(state.sampleSize);
    });
  }

  /* ===== Task 13: 10단계 — 새로운 상황에 적용 · 전체 통합 ===== */

  const S10_SAMPLE_SIZE = 40;
  const S10_SAMPLE_MEAN = 42; // 1학년 통학시간(분) 예시 표본평균 — 고정값으로 제시
  const S10_SIGMA = 12;

  function s10Render() {
    const container = document.getElementById("step-10");
    container.innerHTML =
      '<h2>이 근거만으로 의사결정을 정당화할 수 있을까?</h2>' +
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
      '</div>' +
      '<div class="card justify-card">' +
        '<h3><span class="panel-icon">✍</span> 나의 판단을 정당화해 봅시다</h3>' +
        '<label for="s10-justify-decision">나는 ____라고 판단한다.</label>' +
        '<textarea id="s10-justify-decision" rows="2" placeholder="예: 스쿨버스를 1대 더 늘려야 한다고..."></textarea>' +
        '<label for="s10-justify-reason" style="margin-top:10px;display:block;">그 근거는 ____이다.</label>' +
        '<textarea id="s10-justify-reason" rows="3" placeholder="예: 95% 신뢰구간이 ~이기 때문에..."></textarea>' +
      '</div>' +
      '<div class="card">' +
        '<h3>이번 탐구에서 발견한 관계들을 연결하여 하나의 문장으로 정리해 봅시다.</h3>' +
        '<p class="hint">오른쪽에 모아둔 나의 발견들을 참고해서, 표본을 통해 모집단을 추정할 때 알아야 할 것을 문장으로 써 보세요.</p>' +
        '<textarea id="s10-synthesis" rows="4" placeholder="____________________________________________."></textarea>' +
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

    const justifyDecision = document.getElementById("s10-justify-decision");
    justifyDecision.value = state.s10JustifyDecision || "";
    justifyDecision.addEventListener("input", function (e) {
      state.s10JustifyDecision = e.target.value;
      saveState();
    });
    const justifyReason = document.getElementById("s10-justify-reason");
    justifyReason.value = state.s10JustifyReason || "";
    justifyReason.addEventListener("input", function (e) {
      state.s10JustifyReason = e.target.value;
      saveState();
    });

    const synthesis = document.getElementById("s10-synthesis");
    synthesis.value = state.s10SynthesisText || "";
    synthesis.addEventListener("input", function (e) {
      state.s10SynthesisText = e.target.value;
      saveState();
    });
  }

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
    renderDiscoveriesPanel();
    subscribe(function () {
      if (state.currentStep === 8 || document.getElementById("step-8").classList.contains("active")) {
        s8Render();
      }
    });
    document.querySelectorAll("#progressBar li, #nextBtn, #prevBtn").forEach(function (el) {
      el.addEventListener("click", function () {
        setTimeout(function () {
          if (document.getElementById("step-8").classList.contains("active")) s8Render();
          // 8단계에서 모평균이 공개된 뒤 7단계로 되돌아오면, 이미 그려둔 신뢰구간 캔버스가
          // 공개 이전 상태(점선·"비공개")로 굳어있으므로 다시 그려 최신 상태를 반영한다.
          if (document.getElementById("step-7").classList.contains("active")) s7Render();
          // 8단계에서 모평균이 공개된 뒤 9단계로 되돌아오면, 이미 그려둔 구간 캔버스가
          // 공개 이전 상태로 굳어있으므로 다시 그려 최신 상태를 반영한다.
          if (document.getElementById("step-9").classList.contains("active")) s9Render();
          // 10단계의 "지금까지 발견한 것 모아보기"는 다른 단계에서 쓴 발견을 그대로 보여주므로,
          // 10단계에 들어올 때마다 최신 studentDiscoveries로 다시 그린다.
          if (document.getElementById("step-10").classList.contains("active")) s10Render();
        }, 0);
      });
    });
    goToStep(state.currentStep);
    // 새로고침 등으로 8단계 상태가 그대로 복원된 경우, goToStep은 클릭이 아닌 직접 호출이라
    // 위 클릭 리스너를 타지 않으므로 여기서 별도로 렌더링을 트리거해야 한다.
    if (document.getElementById("step-8").classList.contains("active")) s8Render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
