/* ==========================================================================
   Network animation: one fixed canvas, driven by scroll.

   Intro (three beats, synced to the three lines):
     Why  – scattered dots, loose crossing lines, light fades before arriving
     How  – dots join into clean lines, light travels end to end
     What – lines converge on a stage outline; light runs through and it switches on
   Process:
     five dots break away from the rig and settle beside the steps as markers;
     light runs along the line joining them and lights each one in turn.
   ========================================================================== */
(() => {
  const canvas = document.getElementById('network');
  const intro = document.getElementById('intro');
  const process = document.getElementById('process');
  if (!canvas || !intro || !process) return;

  const ctx = canvas.getContext('2d');
  const lines = [...document.querySelectorAll('.intro-line')];
  const hint = document.querySelector('.scroll-hint');
  const slot = document.querySelector('.process-stage-slot');
  const markers = [...document.querySelectorAll('.step-marker')];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const AMBER = '255, 186, 102';
  const SILVER = '206, 210, 216';

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;
  // Fixed decimals: canvas rejects colours like "rgba(…, 1e-7)"
  const rgba = (c, a) => `rgba(${c}, ${clamp(a).toFixed(3)})`;

  /* ---------- Stage outline (normalised to a box, width : height ≈ 1 : 0.62) ---------- */

  const STAGE_POINTS = [
    [0.04, 0.08], [0.96, 0.08],                                           // 0–1  rig ends
    [0.20, 0.08], [0.35, 0.08], [0.50, 0.08], [0.65, 0.08], [0.80, 0.08], // 2–6  lamps on the rig
    [0.12, 0.72], [0.88, 0.72],                                           // 7–8  platform, back
    [0.04, 0.82], [0.96, 0.82],                                           // 9–10 platform, front top
    [0.04, 0.92], [0.96, 0.92],                                           // 11–12 platform, base
    [0.28, 0.20], [0.72, 0.20], [0.72, 0.56], [0.28, 0.56],               // 13–16 screen
    [0.28, 0.08], [0.72, 0.08],                                           // 17–18 screen hangers
    [0.04, 0.45], [0.96, 0.45],                                           // 19–20 rig legs
    [0.50, 0.82], [0.50, 0.92], [0.50, 0.72],                             // 21–23 platform centres
  ];
  const STAGE_EDGES = [
    [0, 2], [2, 17], [17, 3], [3, 4], [4, 5], [5, 18], [18, 6], [6, 1],   // rig
    [0, 19], [19, 9], [1, 20], [20, 10],                                  // legs
    [17, 13], [18, 14], [13, 14], [14, 15], [15, 16], [16, 13],           // screen
    [7, 23], [23, 8], [7, 9], [8, 10], [9, 21], [21, 10],                 // platform top
    [11, 22], [22, 12], [9, 11], [10, 12], [21, 22], [23, 21],            // platform front
  ];
  // Stage pieces, used to rebuild it piece by piece beside the steps:
  // 0 platform, 1 uprights, 2 rig, 3 screen
  const EDGE_PART = STAGE_EDGES.map((e, k) => (k < 8 ? 2 : k < 12 ? 1 : k < 18 ? 3 : 0));
  const POINT_PART = STAGE_POINTS.map((p, k) =>
    [7, 8, 9, 10, 11, 12, 21, 22, 23].includes(k) ? 0 : [0, 1, 19, 20].includes(k) ? 1 : [13, 14, 15, 16].includes(k) ? 3 : 2);
  const LAMPS = [2, 3, 4, 5, 6];
  const SCREEN = [13, 14, 15, 16];
  const SWITCH_ORIGIN = 22; // the light enters the stage here
  const NS = STAGE_POINTS.length;

  const adjacency = (n, edges) => {
    const adj = Array.from({ length: n }, () => []);
    edges.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
    return adj;
  };
  const stageAdj = adjacency(NS, STAGE_EDGES);
  const depth = new Array(NS).fill(Infinity);
  depth[SWITCH_ORIGIN] = 0;
  for (const queue = [SWITCH_ORIGIN]; queue.length;) {
    const k = queue.shift();
    stageAdj[k].forEach(j => { if (depth[j] === Infinity) { depth[j] = depth[k] + 1; queue.push(j); } });
  }
  const maxDepth = Math.max(...depth);

  /* ---------- State ---------- */

  let W = 0, H = 0, desktop = false;
  let dots = [], looseEdges = [], treeEdges = [], treeAdj = [], edgeOf = new Map();
  let pulses = [];
  let strandPaths = [];  // each strand's dots, left to right
  let nextStrand = 0, strandTimer = 0;

  // Width of the network field: most of a phone screen, a centred block on desktop
  const fieldWidth = () => (desktop ? Math.min(W * 0.62, 900) : W * 0.88);

  function buildNetwork() {
    // The same compact, centred field on every screen (desktop matches the phone),
    // running behind the statements with the dots close together
    const n = desktop ? 110 : 63; // iPhone: fewer dots so they aren't crowded on a narrow screen
    const fw = fieldWidth() / W;
    const [u0, u1, v0, v1] = [0.5 - fw / 2, 0.5 + fw / 2, 0.24, 0.76];
    dots = Array.from({ length: n }, () => ({
      u: u0 + Math.random() * (u1 - u0),
      v: v0 + Math.random() * (v1 - v0),
      amp: 3 + Math.random() * 7,
      speed: 0.08 + Math.random() * 0.16,
      phase: Math.random() * Math.PI * 2,
      delay: Math.random() * 0.35,
      r: 0.9 + Math.random() * 0.8,
      x: 0, y: 0, alpha: 1, f: 0,
    }));
    // How: flowing signal lines. Strands sweep across the screen and draw in towards
    // the centre, where the stage will form. Each dot has a place on one strand.
    const K = 7;
    const vMid = (v0 + v1) / 2, span = v1 - v0;
    const strandV = (k, u) => {
      const o = k / (K - 1) - 0.5;                                  // lane, -0.5 … 0.5
      const pinch = Math.exp(-Math.pow((u - 0.5) / 0.24, 2));       // narrows at the centre
      return vMid + o * span * lerp(0.96, 0.42, pinch) + 0.014 * Math.sin(u * 7 + k * 0.9);
    };
    // iPhone: the strands carry on past the screen edges instead of stopping short,
    // so the same shape isn't boxed into a narrow screen. Desktop is unchanged.
    const [s0, s1] = desktop ? [u0, u1] : [-0.1, 1.1];
    const strands = Array.from({ length: K }, () => []);
    dots.forEach((d, i) => strands[i % K].push(i));
    treeEdges = [];
    strands.forEach((ids, k) => {
      const m = ids.length;
      ids.forEach((i, j) => {
        const d = dots[i];
        d.strand = k;
        d.pu = s0 + ((j + 0.5 + (Math.random() - 0.5) * 0.45) / m) * (s1 - s0);
        d.pv = strandV(k, u0 + ((d.pu - s0) / (s1 - s0)) * (u1 - u0)); // same shape, just wider
        d.mdelay = Math.random() * 0.3;
        d.jx = (Math.random() - 0.5) * 0.08; // how loosely it sits on the outline at Audit
        d.jy = (Math.random() - 0.5) * 0.08;
      });
      ids.sort((a, b) => dots[a].pu - dots[b].pu);
      for (let j = 1; j < m; j++) treeEdges.push([ids[j - 1], ids[j]]);    // along the strand
    });
    // A few short links between neighbouring strands so light can cross over
    strands.forEach((ids, k) => {
      if (k === K - 1) return;
      ids.forEach(i => {
        if (Math.random() > 0.22) return;
        const near = strands[k + 1].reduce((b, j) =>
          Math.abs(dots[j].pu - dots[i].pu) < Math.abs(dots[b].pu - dots[i].pu) ? j : b);
        treeEdges.push([i, near]);
      });
    });
    // Every dot has a place on the stage outline, in the order it sits on its strand,
    // so neighbours land side by side and the line between them lies on a stage line
    const lens = STAGE_EDGES.map(([a, b]) => Math.hypot(
      STAGE_POINTS[a][0] - STAGE_POINTS[b][0], (STAGE_POINTS[a][1] - STAGE_POINTS[b][1]) * 0.62));
    const total = lens.reduce((x, y) => x + y, 0);
    const order = [].concat(...strands);
    order.forEach((i, q) => {
      let r = ((q + 0.5) / order.length) * total, k = 0;
      while (r > lens[k] && k < lens.length - 1) r -= lens[k++];
      const [a, b] = STAGE_EDGES[k], t = clamp(r / lens[k]);
      dots[i].part = EDGE_PART[k];
      dots[i].su = lerp(STAGE_POINTS[a][0], STAGE_POINTS[b][0], t);
      dots[i].sv = lerp(STAGE_POINTS[a][1], STAGE_POINTS[b][1], t);
    });

    // The stage's key points are taken by the network dots that land closest to them
    const gap = (d, u, v) => Math.hypot(d.su - u, (d.sv - v) * 0.62);
    const keys = [], used = new Set();
    STAGE_POINTS.forEach(([u, v], k) => {
      let best = -1;
      dots.forEach((d, i) => { if (!used.has(i) && (best < 0 || gap(d, u, v) < gap(dots[best], u, v))) best = i; });
      used.add(best);
      keys.push(best);
      dots[best].su = u;
      dots[best].sv = v;
      dots[best].part = POINT_PART[k];
    });
    // Re-index so key point k is dot k (the stage, lamps and screen look them up that way)
    const perm = keys.concat(dots.map((d, i) => i).filter(i => !used.has(i)));
    const newIndex = [];
    perm.forEach((old, i) => { newIndex[old] = i; });
    dots = perm.map(old => dots[old]);
    treeEdges = treeEdges.map(([a, b]) => [newIndex[a], newIndex[b]]);

    // Lines whose dots land far apart on the stage fold back into their own dot instead
    const spacing = total / n;
    treeEdges.forEach(e => {
      const A = dots[e[0]], B = dots[e[1]];
      e.fold = Math.hypot(A.su - B.su, (A.sv - B.sv) * 0.62) > spacing * 2.5;
    });
    // Light only travels along lines that end up on the stage
    treeAdj = adjacency(n, treeEdges.filter(e => !e.fold));
    // Each strand's dots in order, split wherever a line folds away, so the Audit-stage
    // light only flows along runs that trace the stage outline
    strandPaths = [];
    strands.forEach(ids => {
      let run = [];
      ids.map(i => newIndex[i]).forEach((i, j, arr) => {
        const prev = arr[j - 1];
        const e = j && treeEdges.find(t => (t[0] === prev && t[1] === i) || (t[0] === i && t[1] === prev));
        if (j && e && e.fold) { if (run.length > 2) strandPaths.push(run); run = []; }
        run.push(i);
      });
      if (run.length > 2) strandPaths.push(run);
    });
    // A few lines along the strands have a small break; light fizzles out as it reaches one
    edgeOf = new Map();
    treeEdges.forEach((e, i) => {
      edgeOf.set(Math.min(e[0], e[1]) + '-' + Math.max(e[0], e[1]), i);
      e.gapAt = !e.fold && dots[e[0]].strand === dots[e[1]].strand && Math.random() < 0.16
        ? 0.45 + Math.random() * 0.3 : -1;
    });

    // Why: the same lines, mis-connected. About a third start out long and crossing,
    // reaching towards a far dot but stopping short of it. During How their loose end
    // swings across to the right neighbour while the rest grow into place.
    const P = dots.map(d => [d.u * W, d.v * H]);
    const dist = (i, j) => Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]);
    const minLen = Math.max((u1 - u0) * W, (v1 - v0) * H) * 0.3;
    treeEdges.forEach(e => {
      e.delay = Math.random() * 0.3;
      e.reach = 0.62 + Math.random() * 0.26; // never quite meets the dot it's reaching for
      e.far = -1;
      if (Math.random() < 0.34) {
        for (let tries = 0; tries < 40; tries++) {
          const c = (Math.random() * n) | 0;
          if (c !== e[0] && c !== e[1] && dist(e[0], c) > minLen) { e.far = c; break; }
        }
      }
    });
    looseEdges = treeEdges.map((e, i) => i).filter(i => treeEdges[i].far >= 0);
    pulses = [];
    // A few signals already in flight, so light is moving the moment the page opens
    if (!reduceMotion) for (let k = 0; k < 4; k++) spawn('loose');
    pulses.forEach(pu => { pu.d = Math.random() * 120; });
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const wasDesktop = desktop;
    W = window.innerWidth;
    H = window.innerHeight;
    desktop = W >= 900;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!dots.length || wasDesktop !== desktop) buildNetwork();
  }

  /* ---------- Geometry ---------- */

  function stageBox(past, processRect) {
    let w = fieldWidth() * 0.75; // the stage keeps the same proportion to the field everywhere
    let h = w * 0.62;
    const maxH = H * (desktop ? 0.56 : 0.4);
    if (h > maxH) { h = maxH; w = h / 0.62; }
    let cx = W / 2;
    let cy = H * 0.5; // centred behind the statements

    if (desktop) {
      // Glide to the left column and stay pinned while the steps scroll past
      const m = ease(smooth(0, H * 0.7, past));
      const s = slot ? slot.getBoundingClientRect() : { left: 0, width: W / 2 };
      const scale = lerp(1, Math.min(1, (s.width * 0.9) / w), m);
      cx = lerp(cx, s.left + s.width / 2, m);
      cy = lerp(cy, H * 0.5, m) + Math.min(0, processRect.bottom - H);
      w *= scale;
      h *= scale;
    } else {
      cy -= past; // on mobile the stage simply scrolls away with the page
    }
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }

  function polyline(nodes) {
    const pts = nodes.map(k => [dots[k].x, dots[k].y]);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    return { pts, cum };
  }

  function pointAt({ pts, cum }, d) {
    for (let i = 1; i < pts.length; i++) {
      if (d <= cum[i] || i === pts.length - 1) {
        const t = clamp((d - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1));
        return [lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)];
      }
    }
    return pts[0];
  }

  // Where a broken line's gap starts and ends, as fractions from its first dot.
  // About 2px wide during How, closing as the dots fold into the stage.
  let gapClose = 0;
  function gapSpan(e, A, B) {
    const len = Math.hypot(B.x - A.x, B.y - A.y) || 1;
    const half = (1.15 * (1 - gapClose)) / len;
    return [clamp(e.gapAt - half), clamp(e.gapAt + half)];
  }

  /* ---------- Light pulses ---------- */

  function randomWalk(adj, start, maxLen) {
    const path = [start];
    const seen = new Set(path);
    while (path.length < maxLen) {
      const next = adj[path[path.length - 1]].filter(j => !seen.has(j));
      if (!next.length) break;
      const j = next[(Math.random() * next.length) | 0];
      path.push(j);
      seen.add(j);
    }
    return path;
  }

  function spawn(kind) {
    if (kind === 'loose') {
      if (!looseEdges.length) return;
      pulses.push({ kind, edge: looseEdges[(Math.random() * looseEdges.length) | 0], rev: Math.random() < 0.5,
        d: 0, speed: 150 + Math.random() * 80, tail: 90, fail: 0.35 + Math.random() * 0.3 });
    } else if (kind === 'strand') {
      // a calm, orderly signal: one strand, left to right, end to end
      const path = strandPaths[nextStrand++ % strandPaths.length];
      if (path && path.length > 1) pulses.push({ kind: 'tree', nodes: path, d: 0, speed: 170, tail: 80 });
    } else if (kind === 'tree') {
      const path = randomWalk(treeAdj, (Math.random() * dots.length) | 0, 24);
      // stop at the first break along the way
      let stop = null;
      for (let j = 1; j < path.length; j++) {
        const ei = edgeOf.get(Math.min(path[j - 1], path[j]) + '-' + Math.max(path[j - 1], path[j]));
        if (treeEdges[ei].gapAt >= 0) { stop = { from: path[j - 1], to: path[j], edge: ei }; path.length = j; break; }
      }
      if (path.length + (stop ? 1 : 0) < 3) return;
      pulses.push({ kind, nodes: path, stop, d: 0, speed: 180 + Math.random() * 80, tail: 130 });
    } else {
      const path = randomWalk(stageAdj, (Math.random() * NS) | 0, 7);
      if (path.length < 2) return;
      pulses.push({ kind, nodes: path, d: 0, speed: 120 + Math.random() * 50, tail: 70 });
    }
  }

  function glow(x, y, r, a) {
    if (a <= 0.003) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(AMBER, a));
    g.addColorStop(1, rgba(AMBER, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPulse(pl, d, tail, alpha) {
    const L = pl.cum[pl.cum.length - 1];
    const d1 = Math.min(d, L), d0 = Math.max(0, d - tail);
    if (d1 <= d0 || alpha <= 0.003) return;
    const path = [pointAt(pl, d0)];
    for (let i = 1; i < pl.pts.length - 1; i++) if (pl.cum[i] > d0 && pl.cum[i] < d1) path.push(pl.pts[i]);
    const head = pointAt(pl, d1);
    path.push(head);
    const g = ctx.createLinearGradient(path[0][0], path[0][1], head[0], head[1]);
    g.addColorStop(0, rgba(AMBER, 0));
    g.addColorStop(1, rgba(AMBER, alpha));
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    path.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.stroke();
    if (d <= L) glow(head[0], head[1], 11, 0.9 * alpha);
  }

  /* ---------- Intro text ---------- */

  // [fade in start, fade in end, fade out start, fade out end] in intro progress
  // The What line lands at 0.84, the same moment the stage finishes switching on.
  const WINDOWS = [[-1, 0, 0.22, 0.28], [0.32, 0.4, 0.58, 0.64], [0.72, 0.84, 2, 3]];

  function updateText(p) {
    lines.forEach((el, i) => {
      const [a, b, c, d] = WINDOWS[i];
      const inT = smooth(a, b, p), outT = smooth(c, d, p);
      el.style.opacity = (inT * (1 - outT)).toFixed(3);
      el.style.transform = `translate(-50%, calc(-50% + ${((1 - inT) * 14 - outT * 14).toFixed(1)}px))`;
    });
    // gone almost as soon as scrolling starts, long before the stage forms
    if (hint) {
      hint.style.opacity = (1 - smooth(0.006, 0.035, p)).toFixed(3);
      hint.style.visibility = p > 0.035 ? 'hidden' : '';
    }
  }

  /* ---------- Frame ---------- */

  let last = performance.now();
  let clock = 0;
  let progress = null; // eased intro progress, trails the scroll position
  let stepProgress = 0; // eased progress through the five steps (desktop)

  function line(a, b, color, alpha, width = 1) {
    if (alpha <= 0.003) return;
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;

    const ir = intro.getBoundingClientRect();
    const pr = process.getBoundingClientRect();
    const target = clamp(-ir.top / (ir.height - H));
    // Glide towards the scroll position rather than jumping, so a quick flick still plays out slowly
    progress = progress === null || reduceMotion ? target : progress + (target - progress) * (1 - Math.exp(-dt * 1.8));
    const p = progress;
    const past = Math.max(0, H - ir.bottom);

    updateText(p);
    ctx.clearRect(0, 0, W, H);
    if (pr.bottom < -40) { drawTrail(); return; } // only the trail remains below Process

    // Beat weights: the network builds steadily through Why and How,
    // and the stage is complete and lit as the What line arrives (p = 0.84), then holds.
    let morph = smooth(0.22, 0.4, p);      // Why → How: the loose lines swing into clean ones
    let fade = 1 - smooth(0.8, 0.88, p);    // network lines hand over to the stage lines once they have landed on them
    let form = smooth(0.46, 0.8, p);
    let on = smooth(0.7, 0.84, p);
    let ambient = 1 - smooth(0, H * 0.5, past);
    const box = stageBox(past, pr);
    // Where the network field sits: the whole screen in the intro
    let field = { x: 0, y: 0, w: W, h: H };
    let piecewise = false;
    let netVis = 1; // overall visibility of the network (not the step line)

    // Desktop Process: beside the steps the visual starts again from the messy network
    // and rebuilds gradually as you scroll through them: organise (steps 1–2),
    // the stage assembles piece by piece (step 3), light flows in (4), fully on (5)
    if (desktop && past > 0 && markers.length) {
      const top = markers[0].getBoundingClientRect().top;
      const span = markers[markers.length - 1].getBoundingClientRect().top - top + H * 0.35;
      const stepTarget = clamp((H * 0.85 - top) / span);
      stepProgress += (stepTarget - stepProgress) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 1.8));
      const q = stepProgress;
      // The lit stage fades out after What; while hidden it moves to the left column and
      // resets, then fades back in as the messy network beside "Five steps"
      const swap = H * 0.32;
      const r = past < swap ? 0 : 1;
      netVis = past < swap ? 1 - smooth(0, H * 0.3, past) : smooth(H * 0.62, H * 0.95, past);
      morph = lerp(morph, smooth(0.04, 0.3, q), r);
      form = lerp(form, smooth(0.32, 0.8, q), r);
      on = lerp(on, smooth(0.78, 0.97, q), r);
      fade = lerp(fade, 1 - smooth(0.8, 0.95, q), r);
      ambient = 1;
      piecewise = true;
      // the field shrinks into the left column, the same width as the stage
      const s = slot.getBoundingClientRect();
      const fw = fieldWidth() / W;
      const w = (s.width * 0.9) / fw, h = (s.width * 0.9 * 0.62 * 1.25) / 0.52;
      const pin = Math.min(0, pr.bottom - H);
      field = {
        x: lerp(0, s.left + s.width / 2 - w / 2, r),
        y: lerp(0, H * 0.5 - h / 2, r) + pin,
        w: lerp(W, w, r),
        h: lerp(H, h, r),
      };
    } else {
      stepProgress = 0;
    }
    const why = 1 - morph;
    const how = morph * fade;
    gapClose = piecewise ? smooth(0.02, 0.4, form) : smooth(0.46, 0.7, p);
    const nodeOn = k => clamp(on * (maxDepth + 1) - depth[k]);

    ctx.globalAlpha = netVis;

    // Dot positions: drift while scattered, converge on the stage as it forms
    dots.forEach((d, i) => {
      const t = clock * d.speed + d.phase;
      const drift = reduceMotion ? 0 : d.amp;
      // Why: scattered. How: settled onto its strand, drifting less
      const m = ease(clamp((morph - d.mdelay) / 0.7));
      const k = field.w / W; // drift scales with the field
      let x, y;
      if (piecewise) {
        // Beside the steps the network organises straight into a loose, slightly larger
        // outline of the stage (Audit), which then tightens into the real thing (Build)
        const ax = box.x + (0.5 + (d.su - 0.5) * 1.12 + d.jx) * box.w;
        const ay = box.y + (0.5 + (d.sv - 0.5) * 1.12 + d.jy) * box.h;
        x = lerp(field.x + d.u * field.w, ax, m) + Math.cos(t) * drift * k * (1 - 0.7 * m);
        y = lerp(field.y + d.v * field.h, ay, m) + Math.sin(t * 1.3) * drift * k * 0.7 * (1 - 0.7 * m);
      } else {
        x = field.x + lerp(d.u, d.pu, m) * field.w + Math.cos(t) * drift * k * (1 - 0.6 * m);
        y = field.y + lerp(d.v, d.pv, m) * field.h + Math.sin(t * 1.3) * drift * k * 0.7 * (1 - 0.6 * m);
      }
      // Every dot travels onto the stage outline; beside the steps it builds piece by piece
      d.f = piecewise
        ? ease(clamp((form - d.part * 0.2 - d.delay * 0.22) / 0.32))
        : ease(clamp((form - d.delay) / 0.65));
      x = lerp(x, box.x + d.su * box.w, d.f);
      y = lerp(y, box.y + d.sv * box.h, d.f);
      // key points stay bright; the rest settle as faint beads along the lines
      d.alpha = i < NS ? Math.max(ambient, d.f) : lerp(1, 0.4, d.f) * ambient;
      d.x = x;
      d.y = y;
    });

    // Pulses
    if (!reduceMotion) {
      if (Math.random() < dt * 2.2 * why * ambient) spawn('loose');
      if (piecewise) {
        // beside the steps: signals go out at a steady rhythm, strand after strand, top to bottom
        strandTimer += dt * how;
        if (strandTimer > 0.42) { strandTimer = 0; spawn('strand'); }
      } else if (Math.random() < dt * 1.8 * how) spawn('tree');
      if (Math.random() < dt * 1.3 * on) spawn('stage');
    }

    // Silver lines
    // One set of lines: loose ends swing across to their neighbour, the rest grow out
    const edgeEnd = treeEdges.map(e => {
      const t = ease(clamp((morph - e.delay) / 0.7));
      const a = dots[e[0]], to = dots[e[1]];
      // loose lines stop short of the far dot; the rest grow out from their start
      const from = e.far >= 0 ? { x: lerp(a.x, dots[e.far].x, e.reach), y: lerp(a.y, dots[e.far].y, e.reach) } : a;
      return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t), t };
    });
    treeEdges.forEach((e, i) => {
      const end = edgeEnd[i];
      if (e.far < 0 && end.t <= 0) return;
      const a = dots[e[0]];
      const vis = Math.min(a.alpha, dots[e[1]].alpha, e.far >= 0 ? dots[e.far].alpha : 1);
      // Lines that would cut across the stage fold back into their own dot as the dots travel;
      // the rest settle onto the stage outline and become its lines
      // (beside the steps they're already folded away once the lines organise at Audit)
      const foldBy = piecewise ? Math.max(ease(clamp(morph * 1.5)), ease(clamp(form * 1.8))) : ease(clamp(form * 1.8));
      const tip = e.fold ? { x: lerp(end.x, a.x, foldBy), y: lerp(end.y, a.y, foldBy) } : end;
      const lineAlpha = lerp(0.11, 0.24, morph) * fade * ambient * vis, lineW = lerp(0.8, 1, morph);
      if (e.gapAt >= 0 && !e.fold && end.t >= 1) {
        // a small break in the line (closes up as the lines fold into the stage)
        const g = gapSpan(e, a, tip);
        line(a, { x: lerp(a.x, tip.x, g[0]), y: lerp(a.y, tip.y, g[0]) }, SILVER, lineAlpha, lineW);
        line({ x: lerp(a.x, tip.x, g[1]), y: lerp(a.y, tip.y, g[1]) }, tip, SILVER, lineAlpha, lineW);
      } else {
        line(a, tip, SILVER, lineAlpha, lineW);
      }
    });
    STAGE_EDGES.forEach(([a, b]) => line(dots[a], dots[b], SILVER, 0.34 * Math.min(dots[a].f, dots[b].f)));

    ctx.globalCompositeOperation = 'lighter';

    // Stage switching on: the screen wakes, the rig glows
    if (on > 0) {
      const screenOn = smooth(0.75, 1, on);
      if (screenOn > 0) {
        const [a, b, c, d] = SCREEN.map(k => dots[k]);
        const g = ctx.createLinearGradient(a.x, a.y, d.x, d.y);
        g.addColorStop(0, rgba('255, 214, 160', 0.13 * screenOn));
        g.addColorStop(1, rgba(AMBER, 0.05 * screenOn));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fill();
        glow((a.x + c.x) / 2, (a.y + c.y) / 2, Math.abs(c.x - a.x) * 0.45, 0.07 * screenOn);
      }
      const floorY = box.y + 0.74 * box.h;
      LAMPS.forEach((k, i) => {
        const l = smooth(0, 1, nodeOn(k));
        if (l <= 0) return;
        const lamp = dots[k];
        const spread = box.w * 0.075;
        const aim = (i - 2) * box.w * 0.02;
        const g = ctx.createLinearGradient(lamp.x, lamp.y, lamp.x, floorY);
        g.addColorStop(0, rgba(AMBER, 0.16 * l));
        g.addColorStop(1, rgba(AMBER, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(lamp.x - 2, lamp.y);
        ctx.lineTo(lamp.x + 2, lamp.y);
        ctx.lineTo(lamp.x + aim + spread, floorY);
        ctx.lineTo(lamp.x + aim - spread, floorY);
        ctx.closePath();
        ctx.fill();
        glow(lamp.x, lamp.y, 16, 0.55 * l);
      });
    }

    // Light flooding through the stage from the base outward
    STAGE_EDGES.forEach(([a, b]) => {
      if (depth[a] > depth[b]) [a, b] = [b, a];
      const f = clamp(on * (maxDepth + 1) - depth[a] - 0.0001);
      if (f <= 0) return;
      const A = dots[a], B = dots[b];
      const end = { x: lerp(A.x, B.x, f), y: lerp(A.y, B.y, f) };
      line(A, end, AMBER, 0.08, 4);
      line(A, end, AMBER, 0.5, 1.1);
    });

    // Travelling light
    // network light keeps running as the dots travel, handing over to the stage light
    const weight = { loose: fade * ambient, tree: piecewise ? how : morph * (1 - smooth(0.7, 0.84, p)), stage: on };
    pulses = pulses.filter(pu => {
      let pl;
      if (pu.kind === 'loose') {
        // rides its line as it swings into place
        const A = dots[treeEdges[pu.edge][0]], B = edgeEnd[pu.edge];
        const pts = pu.rev ? [[B.x, B.y], [A.x, A.y]] : [[A.x, A.y], [B.x, B.y]];
        pl = { pts, cum: [0, Math.hypot(B.x - A.x, B.y - A.y)] };
      } else {
        pl = polyline(pu.nodes);
        if (pu.stop) {
          // run on to the edge of the break, then fizzle out
          const e = treeEdges[pu.stop.edge], A = dots[pu.stop.from], B = dots[pu.stop.to];
          const g = gapSpan(e, A, B);
          const t = pu.stop.from === e[0] ? g[0] : 1 - g[1];
          const q = [lerp(A.x, B.x, t), lerp(A.y, B.y, t)];
          const last = pl.pts[pl.pts.length - 1];
          pl.pts.push(q);
          pl.cum.push(pl.cum[pl.cum.length - 1] + Math.hypot(q[0] - last[0], q[1] - last[1]));
        }
      }
      const L = pl.cum[pl.cum.length - 1];
      pu.d += pu.speed * dt;
      let alpha = weight[pu.kind];
      // Signals fail during Why, and reach further as the lines connect
      const fail = pu.kind === 'loose' ? pu.fail + morph * 1.2 : Infinity;
      if (fail < 1) {
        const prog = pu.d / L;
        if (prog > fail) return false; // the signal dies before it arrives
        alpha *= 1 - smooth(fail * 0.45, fail, prog);
      } else if (pu.stop) {
        if (pu.d > L) return false;                 // dies at the break
        alpha *= 1 - smooth(L - 70, L, pu.d);
      } else if (pu.d - pu.tail > L) {
        return false;
      }
      drawPulse(pl, pu.d, pu.tail, alpha);
      return alpha > 0.003 || pu.d < L;
    });

    ctx.globalCompositeOperation = 'source-over';

    // Dots
    dots.forEach((d, i) => {
      if (d.alpha <= 0.01) return;
      const stage = i < NS ? d.f : 0;
      ctx.fillStyle = rgba(SILVER, (0.55 + 0.35 * stage) * d.alpha);
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r + stage * 0.6, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalAlpha = 1;
    drawTrail();
  }

  /* ---------- One continuous line: grows out of step 1, lights each step's dot,
     then carries on as a light streak down to the end of the page ---------- */

  const footer = document.querySelector('.footer');
  // Content the trail passes behind: it disappears behind these and glows in the gaps
  const occluders = [...document.querySelectorAll('.section-head, .contact-head, .card, .contact-form, .contact-done, .packages-help a')];
  // iPhone: the packages' position dots, which the streak spreads across
  const pkgDots = [...document.querySelectorAll('.carousel-dots button')];
  // The dots on the Services and Packages cards, which light as the streak passes them
  const serviceNodes = [...document.querySelectorAll('.service .node, .package .node, .quote .node')];

  function drawTrail() {
    if (!markers.length || !footer) return;
    // The step dots, where they sit beside each step
    const M = markers.map(m => { const r = m.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    const [mx, my] = M[M.length - 1];
    const done = smooth(H, H * 0.85, M[0][1]); // the dots fade in as step 1 arrives
    if (done <= 0) return;

    // Rail down the centre of the screen, behind the sections
    const railX = W / 2;
    const endY = footer.getBoundingClientRect().top + 14;
    if (endY < -10) return;

    // Path: a soft S-curve over to the centre, then straight down
    const bend = H * 0.45;
    const pts = M.slice(0, -1).map(q => q.slice()); // step 1 → step 4, then on from step 5
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, u = 1 - t;
      // cubic bezier: (mx, my) → (railX, my + bend), control points halfway down
      const ease3 = 3 * u * t * t + t * t * t; // weight of the rail end
      const mid = 3 * u * u * t + 3 * u * t * t; // weight of the halfway controls
      pts.push([lerp(mx, railX, ease3), my + bend * (0.5 * mid + t * t * t)]);
    }
    pts.push([railX, Math.max(endY, my + bend)]);

    // The head of the light rides a little below the middle of the screen
    // and catches up with the final dot as the visitor reaches the very bottom
    const remaining = document.documentElement.scrollHeight - window.scrollY - H;
    const ride = lerp(H * 0.62, pts[pts.length - 1][1], smooth(H * 0.35, 0, remaining));
    const headY = Math.min(Math.max(ride, M[0][1]), pts[pts.length - 1][1]);
    const upTo = y => {
      const out = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        if (y1 <= y) { out.push(pts[i]); continue; }
        if (y0 < y) { const t = (y - y0) / (y1 - y0); out.push([lerp(x0, x1, t), y]); }
        break;
      }
      return out;
    };
    const stroke = (path, style, width) => {
      if (path.length < 2) return;
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      path.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.stroke();
    };

    // Content the trail passes behind (only what has faded in)
    const pad = 14;
    const covers = [];
    occluders.forEach(el => {
      if (el.hidden || el.closest('[hidden]')) return;
      const b = el.getBoundingClientRect();
      if (b.bottom < 0 || b.top > H || b.left > railX || b.right < railX) return;
      if (parseFloat(getComputedStyle(el).opacity) < 0.3) return;
      covers.push(b);
    });
    const coverPath = () => covers.forEach(b =>
      ctx.roundRect(b.left - pad, b.top - pad, b.width + pad * 2, b.height + pad * 2, 22 + pad));

    const lit = upTo(headY);

    // Services and Packages: each card's dot lights as the light reaches it, like the step dots
    serviceNodes.forEach(n => {
      const r = n.getBoundingClientRect();
      n.classList.toggle('is-lit', headY >= r.top + r.height / 2);
    });

    // iPhone only: where the streak meets the row of package dots it spreads out along
    // the row (showing there are several options), then carries on down the centre.
    // Dots for packages already viewed glow amber.
    let row = null;
    if (pkgDots.length && pkgDots[0].offsetParent) {
      const rs = pkgDots.map(b => b.getBoundingClientRect());
      const y = rs[0].top + rs[0].height / 2;
      if (y > -20 && y < H + 20) {
        row = {
          y,
          xs: rs.map(r => r.left + r.width / 2),
          spread: ease(smooth(y, y + 70, headY)),
          seen: pkgDots.map(b => (b.classList.contains('seen') ? 1 : 0)),
        };
      }
    }
    const end = pts[pts.length - 1];
    const arrived = smooth(end[1] - 40, end[1], headY);

    const paint = k => {
      const a = done * k;
      stroke(pts, rgba(SILVER, 0.1 * a), 1);              // faint track to the end
      ctx.globalCompositeOperation = 'lighter';
      stroke(lit, rgba(AMBER, 0.28 * a), 1.2);            // the path already travelled
      const g = ctx.createLinearGradient(0, headY - H * 0.3, 0, headY);
      g.addColorStop(0, rgba(AMBER, 0));
      g.addColorStop(1, rgba(AMBER, a));
      stroke(lit, g, 1.7);                                // the bright streak behind the head
      const head = lit[lit.length - 1];
      glow(head[0], head[1], 16, 0.8 * a);
      if (row) {
        const left = row.xs[0], right = row.xs[row.xs.length - 1];
        ctx.globalCompositeOperation = 'source-over';
        stroke([[left, row.y], [right, row.y]], rgba(SILVER, 0.1 * a), 1);   // faint track across the row
        ctx.globalCompositeOperation = 'lighter';
        if (row.spread > 0) {
          // light spreads out from the centre line to both ends of the row
          const reach = (right - left) / 2 * row.spread;
          stroke([[railX - reach, row.y], [railX + reach, row.y]], rgba(AMBER, 0.45 * a), 1.2);
          glow(railX - reach, row.y, 7, 0.5 * a * (1 - row.spread));
          glow(railX + reach, row.y, 7, 0.5 * a * (1 - row.spread));
        }
        row.xs.forEach((x, i) => glow(x, row.y, 11, 0.4 * a * row.seen[i]));  // viewed packages
      }
      // Each step's dot lights as the line reaches it
      M.forEach(([x, y]) => {
        const on = smooth(y - 2, y + 26, headY);
        glow(x, y, 18, 0.5 * on * a);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = on > 0.5 ? rgba(AMBER, (0.6 + 0.4 * on) * a) : rgba(SILVER, 0.85 * a);
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
      });
      // A final dot that lights when the streak arrives
      glow(end[0], end[1], 18, 0.55 * arrived * a);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = arrived > 0.5 ? rgba(AMBER, 0.9 * a) : rgba(SILVER, 0.6 * a);
      ctx.beginPath();
      ctx.arc(end[0], end[1], 3, 0, Math.PI * 2);
      ctx.fill();
    };

    // Full strength in the gaps between sections…
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    coverPath();
    ctx.clip('evenodd');
    paint(1);
    ctx.restore();

    // …and just shining through behind the content
    if (covers.length) {
      ctx.save();
      ctx.beginPath();
      coverPath();
      ctx.clip();
      paint(0.22);
      ctx.restore();
    }
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(frame);
})();
