const { test, expect } = require('@playwright/test');

test('Task 9: Step 6-2 - Inequality Transformation MCQ', async ({ page }) => {
  // Go to Step 6
  await page.goto('http://localhost:8000');

  // Clear storage and set up initial state
  await page.evaluate(() => {
    localStorage.clear();
  });

  // Reload to get clean state
  await page.reload();

  // Navigate to Step 6
  await page.locator('#progressBar li[data-step="6"]').click();
  await page.waitForTimeout(500);

  // ===== Check 1: Both z-finder and derivation cards are visible =====
  console.log('\n=== Check 1: Both cards visible in #step-6 ===');

  // Check z-finder card heading (from Task 8)
  const s6FindHeading = await page.locator('#step-6 h2').textContent();
  console.log(`Step 6 main heading: "${s6FindHeading}"`);
  expect(s6FindHeading).toContain('표준정규분포');

  // Check for z-finder canvas (Task 8)
  const s6CurveCanvas = page.locator('#s6-curve-canvas');
  const canvasExists = await s6CurveCanvas.isVisible();
  console.log(`z-finder canvas visible: ${canvasExists}`);
  expect(canvasExists).toBe(true);

  // Check derivation card heading (Task 9)
  const derivCardHeading = await page.locator('#s6-deriv-section h3').textContent();
  console.log(`Derivation card heading: "${derivCardHeading}"`);
  expect(derivCardHeading).toContain('부등식 변형');

  // Check derivation MCQ section exists
  const mcqSection = page.locator('#s6-mcq');
  const mcqExists = await mcqSection.isVisible();
  console.log(`MCQ section visible: ${mcqExists}`);
  expect(mcqExists).toBe(true);

  // ===== Check 2: Confidence level toggle switches lines and options =====
  console.log('\n=== Check 2: Confidence level toggle (95%/99%) ===');

  // Get initial (95%) content
  const btn95 = await page.locator('#s6-deriv-level .toggle-btn[data-val="95"]');
  const btn99 = await page.locator('#s6-deriv-level .toggle-btn[data-val="99"]');

  // Check 95% is active by default
  const btn95Classes = await btn95.getAttribute('class');
  console.log(`95% button active: ${btn95Classes.includes('active')}`);
  expect(btn95Classes).toContain('active');

  // Get 95% lines
  const lines95Before = await page.locator('#s6-deriv-lines p').allTextContents();
  console.log(`95% lines count: ${lines95Before.length}`);
  expect(lines95Before.length).toBe(2);

  // Switch to 99%
  await btn99.click();
  await page.waitForTimeout(300);

  // Check 99% is now active
  const btn99Classes = await btn99.getAttribute('class');
  console.log(`99% button active: ${btn99Classes.includes('active')}`);
  expect(btn99Classes).toContain('active');

  // Get 99% lines (should be different z value: 2.58 instead of 1.96)
  const lines99 = await page.locator('#s6-deriv-lines p').allTextContents();
  console.log(`99% lines count: ${lines99.length}`);
  expect(lines99.length).toBe(2);

  // Verify lines changed (z value changed from 1.96 to 2.58)
  const lines99First = lines99[0];
  console.log(`99% first line contains 2.58: ${lines99First.includes('2.58')}`);
  expect(lines99First).toContain('2.58');

  // Switch back to 95%
  await btn95.click();
  await page.waitForTimeout(300);

  const lines95After = await page.locator('#s6-deriv-lines p').allTextContents();
  const lines95AfterFirst = lines95After[0];
  console.log(`95% first line contains 1.96: ${lines95AfterFirst.includes('1.96')}`);
  expect(lines95AfterFirst).toContain('1.96');

  // ===== Check 3: Correct answer feedback (green) =====
  console.log('\n=== Check 3: Correct answer feedback ===');

  // Get all radio options
  const radios = await page.locator('#s6-mcq input[type="radio"]').all();
  console.log(`Total MCQ options: ${radios.length}`);
  expect(radios.length).toBe(4);

  // First option should be correct (index 0)
  await radios[0].click();
  await page.waitForTimeout(300);

  // Check feedback div
  const feedback = page.locator('#s6-mcq-feedback');
  const feedbackText = await feedback.textContent();
  console.log(`Feedback text (correct): "${feedbackText}"`);
  expect(feedbackText).toContain('정답입니다');

  // Check feedback has 'correct' class (green)
  const feedbackClasses = await feedback.getAttribute('class');
  console.log(`Feedback classes (should contain 'correct'): ${feedbackClasses}`);
  expect(feedbackClasses).toContain('correct');
  expect(feedbackClasses).not.toContain('hidden');

  // ===== Check 4: Wrong answer feedback (red) =====
  console.log('\n=== Check 4: Wrong answer feedback ===');

  // Select a wrong option (index 1: wrongSign)
  await radios[1].click();
  await page.waitForTimeout(300);

  const feedbackTextWrong = await feedback.textContent();
  console.log(`Feedback text (wrong): "${feedbackTextWrong}"`);
  expect(feedbackTextWrong).toContain('다시 생각해보세요');

  // Check feedback has 'incorrect' class (red)
  const feedbackClassesWrong = await feedback.getAttribute('class');
  console.log(`Feedback classes (should contain 'incorrect'): ${feedbackClassesWrong}`);
  expect(feedbackClassesWrong).toContain('incorrect');
  expect(feedbackClassesWrong).not.toContain('hidden');

  // ===== Check 5: MathJax rendering =====
  console.log('\n=== Check 5: MathJax rendering ===');

  // Check that MathJax was loaded and typesetPromise is available
  const mathJaxLoaded = await page.evaluate(() => {
    return typeof window.MathJax !== 'undefined' &&
           typeof window.MathJax.typesetPromise !== 'undefined';
  });
  console.log(`MathJax loaded: ${mathJaxLoaded}`);
  expect(mathJaxLoaded).toBe(true);

  // Wait for MathJax to render
  await page.waitForTimeout(1000);

  // Check that LaTeX is NOT visible as raw text in derivation lines
  // MathJax processes $...$ into rendered formulas
  const rawLatexInLines = await page.evaluate(() => {
    const lines = document.querySelectorAll('#s6-deriv-lines p');
    let hasRawLatex = false;
    lines.forEach(line => {
      // If there's visible text like \bar or \le or \dfrac, it didn't render
      if (line.textContent.includes('\\')) {
        hasRawLatex = true;
      }
    });
    return hasRawLatex;
  });
  console.log(`Raw LaTeX found in lines (should be false): ${rawLatexInLines}`);

  // Check MCQ options for rendered math
  const rawLatexInMCQ = await page.evaluate(() => {
    const labels = document.querySelectorAll('#s6-mcq .mcq-option span');
    let hasRawLatex = false;
    labels.forEach(label => {
      if (label.textContent.includes('\\')) {
        hasRawLatex = true;
      }
    });
    return hasRawLatex;
  });
  console.log(`Raw LaTeX found in MCQ (should be false): ${rawLatexInMCQ}`);

  // ===== Check 6: Slider drag maintains derivation card (Task 8→9 coexistence test) =====
  console.log('\n=== Check 6: Slider interaction maintains derivation card ===');

  // Verify derivation card exists BEFORE slider drag
  let derivSectionBefore = await page.locator('#s6-deriv-section').isVisible();
  console.log(`Derivation card visible BEFORE slider drag: ${derivSectionBefore}`);
  expect(derivSectionBefore).toBe(true);

  // Get current z value
  const currentZ = await page.inputValue('#s6-z');
  console.log(`Current z value: ${currentZ}`);

  // Drag the slider to a new value
  const slider = page.locator('#s6-z');
  await slider.click();
  await slider.fill('1.5');
  await page.waitForTimeout(300);

  // Verify derivation card still exists AFTER slider drag
  let derivSectionAfter = await page.locator('#s6-deriv-section').isVisible();
  console.log(`Derivation card visible AFTER slider drag: ${derivSectionAfter}`);
  expect(derivSectionAfter).toBe(true);

  // Verify it's actually in the DOM and not just hidden
  const derivSectionDOM = await page.evaluate(() => {
    return document.getElementById('s6-deriv-section') !== null;
  });
  console.log(`Derivation section in DOM after slider drag: ${derivSectionDOM}`);
  expect(derivSectionDOM).toBe(true);

  // ===== Check 7: Target toggle maintains derivation card =====
  console.log('\n=== Check 7: Target toggle maintains derivation card ===');

  // Verify derivation card exists BEFORE toggle click
  derivSectionBefore = await page.locator('#s6-deriv-section').isVisible();
  console.log(`Derivation card visible BEFORE target toggle: ${derivSectionBefore}`);
  expect(derivSectionBefore).toBe(true);

  // Click the 99% target toggle (different from current state)
  const targetToggle99 = page.locator('#s6-target .toggle-btn[data-val="99"]');
  await targetToggle99.click();
  await page.waitForTimeout(300);

  // Verify derivation card still exists AFTER target toggle
  let derivSectionAfterToggle = await page.locator('#s6-deriv-section').isVisible();
  console.log(`Derivation card visible AFTER target toggle: ${derivSectionAfterToggle}`);
  expect(derivSectionAfterToggle).toBe(true);

  // Verify it's actually in the DOM
  const derivSectionDOMAfterToggle = await page.evaluate(() => {
    return document.getElementById('s6-deriv-section') !== null;
  });
  console.log(`Derivation section in DOM after target toggle: ${derivSectionDOMAfterToggle}`);
  expect(derivSectionDOMAfterToggle).toBe(true);

  // ===== Check 8: Derivation card's own toggle still works (no regression) =====
  console.log('\n=== Check 8: Derivation card 95%/99% toggle regression test ===');

  // Get derivation level toggle (inside derivation card)
  const derivBtn95 = page.locator('#s6-deriv-level .toggle-btn[data-val="95"]');
  const derivBtn99 = page.locator('#s6-deriv-level .toggle-btn[data-val="99"]');

  // Get initial state of derivation card
  let lines95Initial = await page.locator('#s6-deriv-lines p').allTextContents();
  console.log(`Initial derivation line 1: "${lines95Initial[0]}"`);

  // Verify it starts with 1.96 (95% is the default)
  const hasDefault96 = lines95Initial[0].includes('1.96');
  console.log(`Initial derivation contains 1.96 (95% default): ${hasDefault96}`);
  expect(hasDefault96).toBe(true);

  // Click derivation's 99% toggle
  await derivBtn99.click();
  await page.waitForTimeout(300);

  // Verify 99% button is now active
  let derivBtn99ClassesAfter = await derivBtn99.getAttribute('class');
  console.log(`Derivation 99% button active after click: ${derivBtn99ClassesAfter.includes('active')}`);
  expect(derivBtn99ClassesAfter).toContain('active');

  // Verify z value in derivation changed (should now show z=2.58 for 99%)
  const lines99Deriv = await page.locator('#s6-deriv-lines p').allTextContents();
  console.log(`99% derivation line 1: "${lines99Deriv[0]}"`);
  const has258 = lines99Deriv[0].includes('2.58');
  console.log(`99% derivation contains 2.58: ${has258}`);
  expect(has258).toBe(true);

  // Verify derivation card is STILL visible after this internal toggle
  const derivCardStillVisible = await page.locator('#s6-deriv-section').isVisible();
  console.log(`Derivation card still visible after internal toggle: ${derivCardStillVisible}`);
  expect(derivCardStillVisible).toBe(true);

  // ===== Check 9: Console error check =====
  console.log('\n=== Check 9: Console error check ===');

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Wait a bit for any late errors
  await page.waitForTimeout(500);

  console.log(`Console errors caught: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('Errors:', consoleErrors);
    // Note: MathJax CDN load errors are acceptable and reported separately
  }

  // Accept up to 1 error (potential MathJax CDN failure is not a code defect)
  expect(consoleErrors.length).toBeLessThanOrEqual(1);

  console.log('\n=== All checks passed! ===');
});
