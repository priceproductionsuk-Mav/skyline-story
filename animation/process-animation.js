/*
 * Process animation — "What you get" → Tangled → 01–04 → 05
 *
 * 150 short dashes morph between formations as the visitor scrolls.
 * Each formation is a function (index, time) -> [x, y, angle, length, alpha].
 * Scroll position (0..N) decides which two formations are blended and how far.
 *
 * Usage:
 *   <canvas id="process-canvas"></canvas>
 *   ProcessAnimation.mount(document.getElementById('process-canvas'), {
 *     getProgress: () => 0..6,          // where the visitor is in the story
 *     onStageChange: (stage) => {...}   // update eyebrow / title / description
 *   });
 */
(function (global) {
  'use strict';

  const P = 150;
  const PI = Math.PI;

  // Colours matched by eye to the gold stage reference image
  const COLOURS = {
    background: '#0E0E10',
    line: [226, 198, 142], // #E2C68E champagne gold
    glow: 'rgba(242,184,95,0.85)', // #F2B85F warm amber
    heading: '#F2F2F4',
    eyebrow: '#9A9AA0'
  };

  const reducedMotion = global.matchMedia &&
    global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (x) => Math.max(0, Math.min(1, x));
  const ease = (f) => (f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2);

  // Fixed random layout for the tangle, so it looks the same on every visit
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const RX = [], RY = [], RA = [];
  for (let j = 0; j < P; j++) {
    RX.push(-160 + rnd() * 320);
    RY.push(-110 + rnd() * 220);
    RA.push(rnd() * PI);
  }
  const AUDIT_HEIGHTS = [7, 4, 9, 6, 8, 3, 10, 5, 7, 9, 4, 6, 8, 5, 7];

  let progress = 0; // read by Build to tie its lock-in to scroll

  // ---- Formations -------------------------------------------------------

  // Tangled: scattered gear, no system yet
  const tangle = (j, t) => [
    RX[j] + 8 * Math.sin(t / 1700 + j),
    RY[j] + 8 * Math.cos(t / 1900 + j * 1.3),
    RA[j] + (t / 3000) * (j % 2 ? 1 : -1),
    7,
    0.85
  ];

  // 01 Questionnaire: voice waveform
  const questionnaire = (j, t) => {
    const c = j >> 1, up = j & 1;
    const x = -130 + c * (260 / 74);
    const env = Math.pow(Math.sin((PI * (c + 0.5)) / 75), 1.3);
    const a = Math.abs(0.6 * Math.sin(c * 0.35 + t / 380) + 0.4 * Math.sin(c * 0.13 - t / 650));
    const h = Math.max(6, env * (8 + 40 * a));
    return [x, up ? -h / 2 : h / 2, PI / 2, h, 1];
  };

  // 02 Audit: wall of level meters, some high, some low
  const audit = (j, t) => {
    const c = j % 15, r = Math.floor(j / 15);
    const h = AUDIT_HEIGHTS[c] + Math.round(Math.sin(t / 260 + c * 1.3) * 1.3);
    return [-126 + c * 18, 58 - r * 13, 0, 10, r < h ? 1 : 0.16];
  };

  // 03 Build: unstable signal figure that locks into one clean shape (placeholder, not final)
  const build = (j, t) => {
    const L = ease(clamp((progress - 3.35) / 0.6));
    const n = 1 - L;
    const u = (j / P) * 2 * PI;
    const dl = reducedMotion ? PI / 4 : PI / 4 + t / 5000;
    const f = (v) => {
      const a = 3 + n * 0.37 * Math.sin(v * 5);
      const b = 2 + n * 0.29 * Math.cos(v * 3);
      return [
        105 * Math.sin(a * v + dl) + n * 14 * Math.sin(v * 11 + t / 300),
        78 * Math.sin(b * v) + n * 12 * Math.cos(v * 9 - t / 280)
      ];
    };
    const p = f(u), q = f(u + 0.01);
    return [p[0], p[1], Math.atan2(q[1] - p[1], q[0] - p[0]), 7, 0.6 + 0.3 * L];
  };

  // 04 Train: ripples spreading out from the centre
  const train = (j, t) => {
    const k = j % 5, i = Math.floor(j / 5);
    const f = reducedMotion ? k / 5 : (t / 3400 + k / 5) % 1;
    const r = 14 + f * 112;
    const a = (i / 30) * 2 * PI + k;
    return [r * Math.cos(a), r * Math.sin(a) * 0.72,
      Math.atan2(Math.cos(a) * 0.72, -Math.sin(a)), 8, Math.sin(PI * f)];
  };

  // What you get / 05 Running and maintained: all four, together and calm.
  // 40 sound + 36 control + 40 system + 34 team = 150. Every dash used.
  const together = (j, t) => {
    const T = reducedMotion ? 0 : t;
    if (j < 40) { // Sound
      const c = j >> 1, up = j & 1;
      const x = -140 + c * (40 / 19);
      const e = Math.pow(Math.sin((PI * (c + 0.5)) / 20), 1.2);
      const a = Math.abs(0.6 * Math.sin(c * 0.5 + T / 700) + 0.4 * Math.sin(c * 0.2 - T / 1100));
      const h = Math.max(8, e * (8 + 30 * a));
      return [x, up ? -h / 2 : h / 2, PI / 2, h, 0.9];
    }
    if (j < 76) { // Control
      const k = j - 40, c = k % 4, r = Math.floor(k / 4);
      const lv = reducedMotion ? 6 : 5.6 + 1.4 * Math.sin(T / 1400 + c * 0.5);
      const on = r < lv;
      return [-58 + c * 12, 44 - r * 11, 0, 9, on ? (r >= 7 ? 1 : 0.85) : 0];
    }
    if (j < 116) { // System
      const k = j - 76, u = (k / 40) * 2 * PI, dl = PI / 4 + T / 6000;
      const f = (v) => [34 * Math.sin(3 * v + dl), 40 * Math.sin(2 * v)];
      const p = f(u), q = f(u + 0.01);
      return [40 + p[0], p[1], Math.atan2(q[1] - p[1], q[0] - p[0]), 7, 0.85];
    }
    // Team
    const k = j - 116, ring = k % 2, i = Math.floor(k / 2);
    const f = reducedMotion ? 0.5 : (T / 4200 + ring / 2) % 1;
    const R = 12 + f * 28, a = (i / 17) * 2 * PI + ring * 0.18;
    return [120 + R * Math.cos(a), R * Math.sin(a),
      Math.atan2(Math.cos(a), -Math.sin(a)),
      Math.max(6, (R * 2 * PI) / 17 - 4), Math.sin(PI * f) * 0.95];
  };

  const STAGES = [
    { eyebrow: 'WHAT YOU GET', title: 'Running and maintained',
      text: 'Sound, control, a solid system and a confident team. All yours, looked after.',
      fn: together, labels: true },
    { eyebrow: 'WHERE MOST START', title: 'Tangled', text: 'Scattered gear, no system yet', fn: tangle },
    { eyebrow: '01', title: 'Questionnaire', text: 'We listen to what you need', fn: questionnaire },
    { eyebrow: '02', title: 'Audit', text: 'We check every level and signal', fn: audit },
    { eyebrow: '03', title: 'Build', text: 'Every signal locked in and in sync', fn: build },
    { eyebrow: '04', title: 'Train', text: 'Know-how spreading through your team', fn: train },
    { eyebrow: '05', title: 'Running and maintained',
      text: 'Everything you saw at the start, now yours.', fn: together, labels: true }
  ];

  function mount(canvas, opts) {
    const options = opts || {};
    const ctx = canvas.getContext('2d');
    const height = options.height || 270;
    let scale = 1, lastStage = -1;

    function size() {
      const w = canvas.clientWidth, dpr = global.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = height * dpr;
      canvas.style.height = height + 'px';
      scale = w / 380;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    global.addEventListener('resize', size);

    const N = STAGES.length - 1;

    function frame(now) {
      progress = Math.max(0, Math.min(N, options.getProgress ? options.getProgress() : 0));
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const i = Math.min(N - 1, Math.floor(progress));
      const g = clamp((progress - i - 0.1) / 0.8);
      const A = STAGES[i].fn, B = STAGES[i + 1].fn;
      const cx = (canvas.clientWidth / 2), cy = height / 2;

      ctx.lineCap = 'round';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = COLOURS.glow;
      ctx.shadowBlur = 7;

      for (let j = 0; j < P; j++) {
        const a = A(j, now), b = B(j, now);
        const k = ease(clamp(g * 1.5 - (j / P) * 0.5)); // staggered handover
        let da = b[2] - a[2];
        da -= PI * Math.round(da / PI); // dashes have no direction; take the short turn
        const x = a[0] + (b[0] - a[0]) * k;
        const y = a[1] + (b[1] - a[1]) * k;
        const an = a[2] + da * k;
        const ln = a[3] + (b[3] - a[3]) * k;
        const al = Math.min(1, a[4] + (b[4] - a[4]) * k);
        if (al <= 0.02 || ln < 4) continue; // no stray dots
        const dx = (Math.cos(an) * ln) / 2, dy = (Math.sin(an) * ln) / 2;
        ctx.strokeStyle = `rgba(${COLOURS.line[0]},${COLOURS.line[1]},${COLOURS.line[2]},${al})`;
        ctx.beginPath();
        ctx.moveTo(cx + (x - dx) * scale, cy + y - dy);
        ctx.lineTo(cx + (x + dx) * scale, cy + y + dy);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      const r = Math.round(progress);
      if (r !== lastStage) {
        lastStage = r;
        if (options.onStageChange) options.onStageChange(STAGES[r], r);
      }
      if (options.onFrame) options.onFrame(progress, N);
      global.requestAnimationFrame(frame);
    }
    global.requestAnimationFrame(frame);
  }

  global.ProcessAnimation = { mount, STAGES, COLOURS, COUNT: P };
})(window);
