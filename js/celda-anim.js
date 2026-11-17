/* Animación didáctica del efecto fotoeléctrico / fotovoltaico, al estilo de las
   simulaciones PhET. No usa datos oficiales: es una ilustración. Física de referencia:
   E = h·f = hc/λ.
   Llegan fotones (solo fotones, sin foco ni haz) a la cara frontal de una celda de
   silicio dibujada como un tubo de vidrio: rejilla frontal, capa n, unión p-n (iones fijos
   y campo eléctrico), capa p y contacto trasero. Los electrones liberados viajan en
   horizontal hacia la capa n y salen por el contacto frontal; recorren el cable y la carga
   y regresan por el contacto trasero, donde llenan los huecos. */
(function () {
  'use strict';
  const cv = document.getElementById('c-foto');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const EG = 1.12, HC = 1239.84, C_THZ = 299792.458, E_MAX = 3.4, VIS = [1.65, 3.1];
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const f = (x, n = 2) => Number(x).toFixed(n);
  const sci = (x) => { const e = Math.floor(Math.log10(x)); return `${f(x / Math.pow(10, e), 1)} × 10<sup>${e}</sup>`; };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  let W = 600, H = 460, dpr = 1, G = null, T = null;
  let st = { gInc: 1, cf: 1, theta: 30, luz: 'sol', nm: null, ratioI: 1, pRatio: 1, iOp: 1, vTxt: '', iTxt: '', pTxt: '', rTxt: '' };
  let parts = [], flowOff = 0, spawnAcc = 0, tt = 0;
  let playing = !reduce, visible = true, last = 0, raf = 0;
  const $ = (s) => document.querySelector(s);

  /* ---------- Colores (claro / oscuro) ---------- */
  function tema() {
    const os = document.documentElement.dataset.tema === 'oscuro';
    return os ? {
      os, tinta: '#EEF3FA', sub: '#AEBBD0', vidrio0: 'rgba(255,255,255,.16)', vidrio1: 'rgba(255,255,255,.02)', borde: 'rgba(190,215,255,.45)',
      n0: '#2A5296', n1: '#21447D', j0: '#16627A', j1: '#124F63', p0: '#5E4716', p1: '#4A3711',
      metal0: '#C3CEDD', metal1: '#7D8BA1', e: '#8CC0FF', eBorde: '#FFFFFF', h: '#FFC94D', hFondo: '#3A2C0F',
      campo: '#5FE0F5', ionP: '#CFE2FF', ionN: '#FFD36B', cobre0: '#D9B46A', cobre1: '#8C6A2C', punto: '#BFE0FF',
      lectura: '#0F1A2C', lecturaBorde: '#FFC22E', calor: '#FF8A4C', ir: '#FF8FBF',
      marca: '#0B2A5B', marcaT: '#FFC22E', azulT: '#B9D7FF', cianT: '#7FE7F7', ambarT: '#FFD36B',
    } : {
      os, tinta: '#0B2A5B', sub: '#5B6B85', vidrio0: 'rgba(255,255,255,.75)', vidrio1: 'rgba(255,255,255,.05)', borde: 'rgba(11,42,91,.30)',
      n0: '#DCE9FF', n1: '#C5DAFF', j0: '#D6F5FB', j1: '#C0ECF5', p0: '#FFF1CC', p1: '#FFE09A',
      metal0: '#D5DCE6', metal1: '#8592A6', e: '#1559D6', eBorde: '#FFFFFF', h: '#B87400', hFondo: '#FFF8E6',
      campo: '#0E95B3', ionP: '#0F4DBC', ionN: '#A86A00', cobre0: '#D9B46A', cobre1: '#9A7633', punto: '#1E6BE0',
      lectura: '#FFFFFF', lecturaBorde: '#F5A300', calor: '#E8590C', ir: '#8E2453',
      marca: '#FFFFFF', marcaT: '#0B2A5B', azulT: '#0F4DBC', cianT: '#0B6F86', ambarT: '#8A5A00',
    };
  }

  /* Color aproximado de una longitud de onda visible (380-780 nm). */
  function rgbNm(nm) {
    let r = 0, g = 0, b = 0;
    if (nm < 440) { r = (440 - nm) / 60; b = 1; }
    else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
    else if (nm < 510) { g = 1; b = (510 - nm) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
    else if (nm < 645) { r = 1; g = (645 - nm) / 65; }
    else if (nm <= 780) { r = 1; }
    else return null;
    const k = nm < 420 ? 0.45 + 0.55 * (nm - 380) / 40 : nm > 700 ? 0.45 + 0.55 * (780 - nm) / 80 : 1;
    const c = (v) => Math.round(255 * Math.pow(clamp(v * k, 0, 1), 0.8));
    let rgb = [c(r), c(g), c(b)];
    if (T && !T.os) rgb = rgb.map((v) => Math.round(v * 0.82));
    return rgb;
  }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
  const colorNm = (nm, a = 1) => { const c = rgbNm(nm); return c ? `rgba(${c[0]},${c[1]},${c[2]},${a})` : hexA(T.ir, a); };

  /* ---------- Geometría ---------- */
  function geom() {
    const m = W < 640;
    const tx0 = Math.round(W * 0.31), tx1 = Math.round(W * (m ? 0.93 : 0.74));
    const ty0 = Math.round(H * (m ? 0.33 : 0.42)), ty1 = Math.round(H * (m ? 0.62 : 0.70));
    const iw = tx1 - tx0;
    const xF = tx0 + iw * 0.055;           /* fin de la rejilla frontal */
    const xN = xF + iw * 0.15;             /* fin de la capa n */
    const xJ = xN + iw * 0.10;             /* fin de la unión */
    const xB = tx1 - iw * 0.065;           /* inicio del contacto trasero */
    const yW = Math.round(H * 0.90);
    const R = Math.min(W * (m ? 0.20 : 0.19), 220);
    return {
      m, tx0, tx1, ty0, ty1, iw, xF, xN, xJ, xB, yW, R,
      fy: (ty0 + ty1) / 2, cap: (ty1 - ty0) * 0.13,
      xIzq: tx0 - (m ? 18 : 34), xDer: Math.min(W - 8, tx1 + (m ? 12 : 34)),
      xCarga: m ? W * 0.40 : (tx0 + tx1) / 2 - 40,
      fs: m ? 10 : 12, fsS: m ? 9 : 11, esc: m ? 0.68 : 1,
    };
  }
  /* Recorrido de los electrones por el cable: del contacto frontal, por la carga, al trasero. */
  function ruta() {
    const g = G, yS = g.ty1 - g.cap * 1.2;
    return [[g.tx0 - 2, yS], [g.xIzq, yS], [g.xIzq, g.yW], [g.xDer, g.yW], [g.xDer, yS], [g.tx1 + 2, yS]];
  }
  function rutaLen(p) { let t = 0; for (let i = 1; i < p.length; i++) t += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return t; }
  function rutaEn(p, s) {
    for (let i = 1; i < p.length; i++) {
      const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
      if (s <= d) { const k = d ? s / d : 0; return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k]; }
      s -= d;
    }
    return p[p.length - 1];
  }
  /* Dirección de la luz según el ángulo de incidencia θ (de dónde vienen los fotones). */
  function direccionLuz() {
    const g = G;
    if (st.theta === null) { /* luz que llega por detrás del panel */
      const x = Math.min(W - 30 * g.esc, g.tx1 + g.R * 0.55), y = g.ty0 - g.R * 0.45;
      return { x, y, a: Math.atan2(g.fy - y, g.tx1 - x), atras: true };
    }
    const phi = Math.min(st.theta, 60) * Math.PI / 180;
    const x = g.tx0 - g.R * Math.cos(phi), y = g.fy - g.R * Math.sin(phi);
    return { x, y, a: Math.atan2(g.fy - y, g.tx0 - x), atras: false };
  }

  /* ---------- Partículas ---------- */
  function eligeNm() {
    if (st.nm) return st.nm;
    return Math.random() < 0.18 ? rnd(1250, 1500) : rnd(400, 700);
  }
  function profundidad(nm) {
    /* El azul se absorbe cerca de la cara frontal y el rojo más adentro (ilustrativo). */
    const k = clamp((nm - 380) / (1107 - 380), 0, 1);
    return G.xF + 4 + (G.xB - G.xF - 14) * Math.pow(k, 0.85) * rnd(0.72, 1.05);
  }
  function lanzaFoton() {
    const nm = eligeNm(), ir = HC / nm < EG, fo = direccionLuz(), g = G;
    const destX = fo.atras ? g.tx1 : g.tx0, destY = rnd(g.ty0 + 10, g.ty1 - g.cap * 2.2);
    /* los fotones entran desde el borde del lienzo, todos con la misma dirección */
    const ux = Math.cos(fo.a), uy = Math.sin(fo.a);
    let t = 1e9;
    if (ux > 0.01) t = Math.min(t, (destX + 14) / ux); else if (ux < -0.01) t = Math.min(t, (W + 14 - destX) / -ux);
    if (uy > 0.01) t = Math.min(t, (destY + 14) / uy);
    const x0 = destX - ux * t + rnd(-6, 6), y0 = destY - uy * t;
    const d = Math.hypot(destX - x0, destY - y0), v = g.m ? 170 : 230;
    parts.push({ t: 'ph', x: x0, y: y0, vx: (destX - x0) / d * v, vy: (destY - y0) / d * v, nm, ir, dentro: false, atras: fo.atras, xAbs: ir ? 1e9 : profundidad(nm), fase: rnd(0, TAU) });
  }
  function destello(x, y, col, r) { parts.push({ t: 'f', x, y, vida: 0.45, col, r: r || 12 }); }
  function absorbe(p) {
    const e = HC / p.nm, sobra = Math.max(0, 1 - EG / e);
    const zona = p.x < G.xN ? 'n' : p.x < G.xJ ? 'j' : 'p';
    parts.push({ t: 'e', x: p.x, y: p.y, est: zona, vida: 0 });
    parts.push({ t: 'h', x: p.x + 2, y: p.y + rnd(-3, 3), est: zona, vida: 0 });
    destello(p.x, p.y, colorNm(p.nm, 0.95), 15);
    if (Math.random() < sobra * 1.2) parts.push({ t: 'q', x: p.x, y: p.y, vida: 0.9, s: rnd(0, TAU) });
  }
  const fluye = () => st.iOp >= 0.002;

  function paso(dt) {
    tt += dt;
    const g = G;
    const tasa = st.gInc > 0.004 ? Math.min(16, 2 + 11 * Math.min(st.gInc, 1.3)) : 0;
    spawnAcc += tasa * dt;
    while (spawnAcc >= 1) { spawnAcc -= 1; if (parts.length < 240) lanzaFoton(); }
    const vel = fluye() ? 34 + 150 * Math.sqrt(Math.min(1, st.ratioI)) : 0;
    flowOff = (flowOff + vel * dt) % 22;
    const vLat = fluye() ? 60 + 150 * Math.sqrt(Math.min(1, st.ratioI)) : 0;
    const yMin = g.ty0 + 8, yMax = g.ty1 - 8;
    let pilaE = 0, pilaH = 0;
    for (const p of parts) if (p.est === 'pila') { if (p.t === 'e') pilaE++; else pilaH++; }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (p.t === 'ph') {
        p.x += p.vx * dt; p.y += p.vy * dt; p.fase += dt * 16;
        if (p.atras) { if (p.x >= g.tx1 - 2 || (p.vx < 0 && p.x <= g.tx1 + 2)) { destello(g.tx1, p.y, hexA(T.ir, 0.8), 9); parts.splice(i, 1); } continue; }
        if (!p.dentro && p.x >= g.tx0) { p.dentro = true; const v = Math.hypot(p.vx, p.vy) * 0.8; p.vx = v; p.vy = 0; }
        if (p.dentro && !p.ir && p.x >= p.xAbs) { absorbe(p); parts.splice(i, 1); continue; }
        if (p.dentro && p.x >= g.xB) { if (p.ir) parts.push({ t: 'q', x: p.x, y: p.y, vida: 0.6, s: rnd(0, TAU) }); parts.splice(i, 1); continue; }
        if (p.x > W + 20 || p.y > H + 20 || p.x < -20) parts.splice(i, 1);
      } else if (p.t === 'e') {
        p.vida += dt;
        if (p.est === 'p') { p.x -= 72 * dt; p.y += rnd(-24, 24) * dt; if (p.x <= g.xJ) p.est = 'j'; }
        else if (p.est === 'j') { p.x -= 240 * dt; if (p.x <= g.xN) p.est = 'n'; }
        else if (p.est === 'n') {
          if (fluye()) {
            p.x -= vLat * dt;
            if (p.x <= g.xF + 3) { destello(g.xF, p.y, T.punto, 7); parts.splice(i, 1); continue; }
          } else {
            if (p.meta === undefined) p.meta = rnd(g.xF + 6, g.xN - 6);
            p.x -= 40 * dt;
            if (p.x <= p.meta) { if (pilaE < 34) { p.est = 'pila'; p.vida = 0; pilaE++; } else { parts.splice(i, 1); continue; } }
          }
        } else if (p.est === 'pila') {
          p.x += rnd(-8, 8) * dt; p.y += rnd(-8, 8) * dt;
          p.x = clamp(p.x, g.xF + 5, g.xN - 4);
          if (fluye()) p.est = 'n';
          else if (p.vida > 3.4) { parts.splice(i, 1); continue; }
        }
        p.y = clamp(p.y, yMin, yMax);
      } else if (p.t === 'h') {
        p.vida += dt;
        if (p.est === 'n') { p.x += 60 * dt; if (p.x >= g.xN) p.est = 'j'; }
        else if (p.est === 'j') { p.x += 220 * dt; if (p.x >= g.xJ) p.est = 'p'; }
        else if (p.est === 'p') {
          p.x += 95 * dt; p.y += rnd(-18, 18) * dt;
          if (p.x >= g.xB - 6) {
            if (fluye()) { destello(g.xB - 3, p.y, T.punto, 7); parts.splice(i, 1); continue; }
            if (pilaH < 28) { p.est = 'pila'; p.vida = 0; pilaH++; } else { parts.splice(i, 1); continue; }
          }
        } else if (p.est === 'pila') {
          p.y += rnd(-6, 6) * dt; p.x = clamp(p.x + rnd(-6, 6) * dt, g.xB - 30, g.xB - 6);
          if (fluye()) p.est = 'p';
          else if (p.vida > 3.4) { parts.splice(i, 1); continue; }
        }
        p.y = clamp(p.y, yMin, yMax);
      } else if (p.t === 'q') {
        p.vida -= dt; p.y -= 14 * dt; p.x += Math.sin(p.s + p.vida * 14) * 0.6;
        if (p.vida <= 0) parts.splice(i, 1);
      } else if (p.t === 'f') {
        p.vida -= dt; if (p.vida <= 0) parts.splice(i, 1);
      }
    }
  }

  /* ---------- Utilidades de dibujo ---------- */
  function txt(t, x, y, o) {
    o = o || {};
    ctx.font = `${o.p || 500} ${o.fs || G.fs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = o.c || T.tinta; ctx.textAlign = o.a || 'left'; ctx.textBaseline = o.b || 'middle';
    ctx.fillText(t, x, y);
    return ctx.measureText(t).width;
  }
  function redondo(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function banda(x0, x1, c0, c1) {
    const g = G, gr = ctx.createLinearGradient(0, g.ty0, 0, g.ty1);
    gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    ctx.fillStyle = gr; ctx.fillRect(x0, g.ty0, x1 - x0, g.ty1 - g.ty0);
  }
  function metal(x0, x1) {
    const g = G, gr = ctx.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, T.metal1); gr.addColorStop(0.45, T.metal0); gr.addColorStop(1, T.metal1);
    ctx.fillStyle = gr; ctx.fillRect(x0, g.ty0, x1 - x0, g.ty1 - g.ty0);
  }

  /* ---------- Escena ---------- */
  function dibujaCable() {
    const g = G, pts = ruta();
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); pts.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.strokeStyle = T.cobre1; ctx.lineWidth = g.m ? 7 : 10; ctx.stroke();
    ctx.strokeStyle = T.cobre0; ctx.lineWidth = g.m ? 4 : 6; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
    /* electrones que recorren el cable */
    const len = rutaLen(pts), n = Math.floor(len / 22), mueve = fluye();
    const xc = g.xCarga, ancho = g.m ? 50 : 76;
    for (let i = 0; i < n; i++) {
      const s = (i * 22 + flowOff) % len, q = rutaEn(pts, s);
      if (Math.abs(q[1] - g.yW) < 1 && Math.abs(q[0] - xc) < ancho / 2 + 2) continue;
      ctx.fillStyle = mueve ? T.punto : hexA(T.os ? '#BFE0FF' : '#1E6BE0', 0.28);
      ctx.beginPath(); ctx.arc(q[0], q[1], g.m ? 2.3 : 3, 0, TAU); ctx.fill();
    }
  }
  function dibujaCarga() {
    const g = G, xc = g.xCarga, y = g.yW, w = g.m ? 50 : 76, h = g.m ? 22 : 30;
    const brillo = clamp(st.pRatio, 0, 1);
    if (brillo > 0.01) {
      const rr = (g.m ? 40 : 64) * (0.6 + 0.6 * brillo);
      const gl = ctx.createRadialGradient(xc, y, 2, xc, y, rr);
      gl.addColorStop(0, `rgba(255,194,46,${0.15 + 0.5 * brillo})`); gl.addColorStop(1, 'rgba(255,194,46,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(xc, y, rr, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = T.os ? '#1B2638' : '#FFFFFF'; ctx.strokeStyle = T.tinta; ctx.lineWidth = 1.5;
    redondo(xc - w / 2, y - h / 2, w, h, 8); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = brillo > 0.05 ? '#F5A300' : T.sub; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(xc - w * 0.36, y);
    for (let i = 0; i < 7; i++) ctx.lineTo(xc - w * 0.36 + w * 0.72 * (i + 0.5) / 7, y + (i % 2 ? -h * 0.26 : h * 0.26));
    ctx.lineTo(xc + w * 0.36, y); ctx.stroke();
    txt('Carga', xc, y - h / 2 - (g.m ? 8 : 10), { p: 600, a: 'center', fs: g.fsS });
    txt(st.rTxt, xc, y + h / 2 + (g.m ? 8 : 10), { a: 'center', c: T.sub, fs: g.fsS });
    /* lectura tipo PhET */
    const lx = g.m ? W * 0.60 : xc + w / 2 + 34, lw = g.m ? W * 0.30 : 168, lh = g.m ? 48 : 64;
    const ly = y - lh - (g.m ? 8 : 10);
    ctx.fillStyle = T.lectura; ctx.strokeStyle = T.lecturaBorde; ctx.lineWidth = 2;
    redondo(lx, ly, lw, lh, 8); ctx.fill(); ctx.stroke();
    const filas = [['Corriente', st.iTxt], ['Voltaje', st.vTxt], ['Potencia', st.pTxt]], dy = lh / 3;
    filas.forEach(([k, v], i) => {
      const yy = ly + dy * (i + 0.5);
      txt(k, lx + 8, yy, { c: T.sub, fs: g.fsS });
      txt(v, lx + lw - 8, yy, { p: 700, a: 'right', fs: g.fsS + 1, c: i === 2 ? (T.os ? '#FFC22E' : '#8A5A00') : T.tinta });
    });
  }
  function dibujaCelda() {
    const g = G, { tx0, tx1, ty0, ty1 } = g, h = ty1 - ty0, cap = g.cap;
    ctx.save(); ctx.shadowColor = T.os ? 'rgba(0,0,0,.5)' : 'rgba(11,42,91,.18)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
    ctx.fillStyle = T.os ? '#162238' : '#FFFFFF'; redondo(tx0 - cap, ty0, tx1 - tx0 + cap * 2, h, cap); ctx.fill(); ctx.restore();
    ctx.save(); redondo(tx0 - cap, ty0, tx1 - tx0 + cap * 2, h, cap); ctx.clip();
    banda(tx0, g.xN, T.n0, T.n1);
    banda(g.xN, g.xJ, T.j0, T.j1);
    banda(g.xJ, g.xB, T.p0, T.p1);
    metal(g.xB, tx1 + cap);
    /* rejilla frontal: dedos metálicos que dejan pasar la luz entre ellos */
    metal(tx0 - cap, tx0 + 2);
    const nd = g.m ? 6 : 9;
    for (let i = 0; i < nd; i++) {
      const y = ty0 + h * (i + 0.5) / nd;
      ctx.fillStyle = T.metal1; ctx.fillRect(tx0, y - 2.5, g.xF - tx0, 5);
      ctx.fillStyle = T.metal0; ctx.fillRect(tx0, y - 2.5, g.xF - tx0, 2);
    }
    /* unión p-n: iones fijos (+ del lado n, − del lado p) y campo eléctrico hacia la capa p */
    const xi0 = g.xN + (g.xJ - g.xN) * 0.25, xi1 = g.xN + (g.xJ - g.xN) * 0.75;
    const pasoY = g.m ? 15 : 20;
    ctx.lineWidth = 1.2;
    for (let y = ty0 + pasoY * 0.7, k = 0; y < ty1 - 6; y += pasoY, k++) {
      if (k % 2 === 1) {
        ctx.globalAlpha = 0.55 + 0.3 * Math.sin(tt * 2.4 + k); ctx.strokeStyle = T.campo; ctx.fillStyle = T.campo;
        ctx.beginPath(); ctx.moveTo(g.xN + 3, y); ctx.lineTo(g.xJ - 6, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(g.xJ - 9, y - 3); ctx.lineTo(g.xJ - 4, y); ctx.lineTo(g.xJ - 9, y + 3); ctx.fill();
        ctx.globalAlpha = 1; continue;
      }
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = T.ionP; ctx.beginPath(); ctx.arc(xi0, y, 3.6, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xi0 - 2, y); ctx.lineTo(xi0 + 2, y); ctx.moveTo(xi0, y - 2); ctx.lineTo(xi0, y + 2); ctx.stroke();
      ctx.strokeStyle = T.ionN; ctx.beginPath(); ctx.arc(xi1, y, 3.6, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xi1 - 2, y); ctx.lineTo(xi1 + 2, y); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function dibujaVidrio() {
    /* brillo de vidrio encima de todo, como el tubo de PhET */
    const g = G, { tx0, tx1, ty0, ty1 } = g, h = ty1 - ty0, cap = g.cap;
    const gr = ctx.createLinearGradient(0, ty0, 0, ty1);
    gr.addColorStop(0, T.vidrio0); gr.addColorStop(0.18, T.vidrio1); gr.addColorStop(0.8, 'rgba(255,255,255,0)'); gr.addColorStop(1, T.vidrio1);
    ctx.fillStyle = gr; redondo(tx0 - cap, ty0, tx1 - tx0 + cap * 2, h, cap); ctx.fill();
    ctx.strokeStyle = T.borde; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(tx0 + cap, ty0 + 4); ctx.lineTo(tx1 - cap, ty0 + 4); ctx.stroke();
  }
  function onda(p, alfa) {
    const sp = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / sp, uy = p.vy / sp, px = -uy, py = ux;
    const largo = G.m ? 15 : 20, lw = 3.4 + clamp((p.nm - 380) / 1120, 0, 1) * 9;
    const col = p.ir ? T.ir : colorNm(p.nm, 1);
    ctx.beginPath();
    for (let s = 0; s <= largo; s += 1.2) {
      const env = Math.sin(Math.PI * s / largo), a = 3.4 * env * Math.sin(TAU * s / lw + p.fase);
      const x = p.x - ux * s + px * a, y = p.y - uy * s + py * a;
      if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = col;
    ctx.globalAlpha = alfa * 0.22; ctx.lineWidth = 5; ctx.stroke();
    ctx.globalAlpha = alfa; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, 2.1, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function dibujaParticulas() {
    ctx.lineCap = 'round';
    for (const p of parts) if (p.t === 'ph') onda(p, p.dentro ? (p.ir ? 0.45 : 0.85) : (p.ir ? 0.75 : 1));
    for (const p of parts) {
      if (p.t === 'e') {
        ctx.globalAlpha = p.est === 'pila' ? clamp((3.4 - p.vida) / 0.8, 0, 1) : 1;
        ctx.fillStyle = T.e; ctx.strokeStyle = T.eBorde; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, G.m ? 4 : 4.8, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillRect(p.x - 2.2, p.y - 0.7, 4.4, 1.4);
        ctx.globalAlpha = 1;
      } else if (p.t === 'h') {
        ctx.globalAlpha = p.est === 'pila' ? clamp((3.4 - p.vida) / 0.8, 0, 1) : 1;
        ctx.fillStyle = T.hFondo; ctx.strokeStyle = T.h; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(p.x, p.y, G.m ? 4 : 4.8, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = T.h; ctx.fillRect(p.x - 2.2, p.y - 0.7, 4.4, 1.4); ctx.fillRect(p.x - 0.7, p.y - 2.2, 1.4, 4.4);
        ctx.globalAlpha = 1;
      } else if (p.t === 'q') {
        ctx.globalAlpha = clamp(p.vida / 0.5, 0, 1); ctx.fillStyle = T.calor;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.1, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      } else if (p.t === 'f') {
        const k = 1 - p.vida / 0.45;
        ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = p.col; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2 + p.r * k, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
  }

  function marca(nmr, x, y) {
    ctx.fillStyle = T.marca; ctx.strokeStyle = T.os ? 'rgba(255,194,46,.75)' : 'rgba(11,42,91,.35)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(x, y, G.m ? 8 : 9.5, 0, TAU); ctx.fill(); ctx.stroke();
    txt(String(nmr), x, y + 0.5, { p: 700, a: 'center', c: T.marcaT, fs: G.m ? 9.5 : 11 });
  }
  function etiqueta(t, x, y, xa, c) {
    /* nombre de la capa arriba del tubo, con una línea guía */
    ctx.strokeStyle = T.os ? 'rgba(190,215,255,.4)' : 'rgba(11,42,91,.28)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(xa, G.ty0 + 3); ctx.lineTo(xa, y + 7); ctx.stroke();
    txt(t, x, y, { p: 600, a: 'center', fs: G.fsS, c: c || T.tinta });
  }
  function dibujaEtiquetas() {
    const g = G, m = g.m, y1 = g.ty0 - (m ? 13 : 16), y2 = g.ty0 - (m ? 29 : 36);
    etiqueta(m ? 'Rejilla' : 'Rejilla frontal', g.tx0 + (m ? 4 : 0), y2, (g.tx0 + g.xF) / 2);
    etiqueta('Capa n', (g.xF + g.xN) / 2, y1, (g.xF + g.xN) / 2, T.azulT);
    etiqueta('Unión p‑n', (g.xN + g.xJ) / 2 + (m ? 10 : 0), y2, (g.xN + g.xJ) / 2, T.cianT);
    etiqueta('Capa p', (g.xJ + g.xB) / 2, y1, (g.xJ + g.xB) / 2, T.ambarT);
    etiqueta('Contacto trasero', Math.min(W - (m ? 42 : 52), (g.xB + g.tx1) / 2), y2, (g.xB + g.tx1) / 2);
    const yb = g.ty1 + (m ? 12 : 15);
    txt(m ? 'sobran e⁻' : 'sobran electrones', (g.xF + g.xN) / 2, yb, { a: 'center', fs: g.fsS, c: T.sub });
    txt(m ? 'faltan e⁻ (huecos)' : 'faltan electrones (huecos)', (g.xJ + g.xB) / 2 + (m ? 6 : 0), yb, { a: 'center', fs: g.fsS, c: T.sub });
    if (!m) txt('campo eléctrico', (g.xN + g.xJ) / 2, yb + 15, { a: 'center', fs: g.fsS, c: T.sub });
    txt('−', g.xIzq - (m ? 8 : 12), g.ty1 - g.cap * 1.2 - (m ? 10 : 0), { p: 700, fs: g.fs + 3, c: T.sub, a: 'center' });
    txt('+', g.xDer + (m ? -1 : 12), g.ty1 - g.cap * 1.2 - (m ? 12 : 0), { p: 700, fs: g.fs + 2, c: T.sub, a: 'center' });
    const fuente = st.gInc <= 0.004 ? 'Sin luz' : st.nm ? `Luz de ${f(st.nm, 0)} nm · ${f(HC / st.nm, 2)} eV por fotón` : 'Luz del Sol · todos los colores';
    if (st.gInc > 0.004) { ctx.fillStyle = st.nm ? colorNm(st.nm, 1) : '#FFC22E'; ctx.beginPath(); ctx.arc(12, 16, 4.5, 0, TAU); ctx.fill(); }
    txt(fuente, 22, 16, { p: 600, fs: g.fsS });
    const info = st.theta === null ? 'Luz por detrás: solo llega luz difusa' : `Luz a ${f(st.theta, 0)}° de la perpendicular`;
    txt(info, 12, 34, { c: T.sub, fs: g.fsS });
    txt(m ? 'Celda girada: su cara frontal mira hacia la luz' : 'Celda vista de lado y girada: su cara frontal (la de arriba en un panel) mira hacia la luz', 12, 52, { c: T.sub, fs: g.fsS });
    const fo = direccionLuz();
    marca(1, (fo.atras ? g.tx1 : g.tx0) + (fo.x - (fo.atras ? g.tx1 : g.tx0)) * 0.35, g.fy + (fo.y - g.fy) * 0.35 - 30);
    marca(2, g.xJ + (g.xB - g.xJ) * 0.28, g.ty1 - (m ? 14 : 18));
    marca(3, (g.xN + g.xJ) / 2, g.ty1 - (m ? 14 : 18));
    marca(4, g.xIzq, (g.ty1 + g.yW) / 2 + 6);
  }

  function dibuja() {
    if (!G || !T) return;
    ctx.clearRect(0, 0, W, H);
    dibujaCable();
    dibujaCarga();
    dibujaCelda();
    dibujaParticulas();
    dibujaVidrio();
    dibujaEtiquetas();
  }

  /* ---------- Ciclo ---------- */
  function cuadro(ts) {
    raf = 0;
    if (!playing || !visible || document.hidden) { last = 0; return; }
    if (!last) last = ts;
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    paso(dt); dibuja();
    raf = requestAnimationFrame(cuadro);
  }
  function arranca() { if (!raf && playing && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(cuadro); } }

  function mide() {
    const w = Math.max(280, Math.round(cv.parentElement.clientWidth));
    W = w; H = w < 640 ? 390 : w < 900 ? 460 : 480;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    G = geom(); T = tema();
    parts = [];
    for (let i = 0; i < 110; i++) paso(0.04);
    dibuja();
  }

  /* ---------- Textos de energía ---------- */
  function textos() {
    const pos = (e) => `${Math.min(100, e / E_MAX * 100)}%`;
    $('#eg-umbral').style.left = pos(EG);
    $('#eg-vis').style.left = pos(VIS[0]); $('#eg-vis').style.width = `${(VIS[1] - VIS[0]) / E_MAX * 100}%`;
    const fo = $('#eg-foton'), tx = $('#eg-texto'), rs = $('#foto-resumen');
    const lambda0 = HC / EG, f0 = C_THZ / lambda0;
    if (st.nm) {
      const e = HC / st.nm, fr = C_THZ / st.nm, ok = e >= EG;
      fo.style.display = 'block'; fo.style.left = pos(e); fo.style.background = ok ? '#1a7f4e' : '#b42318';
      tx.innerHTML = `Luz de <b>${f(st.nm, 0)} nm</b>: f = c/λ = ${f(fr, 0)} THz, y cada fotón trae E = h·f = <b>${f(e, 2)} eV</b>. ` +
        (ok ? `Como ${f(e, 2)} ≥ ${EG}, <b>sí libera un electrón</b>${e - EG > 0.02 ? ` y los ${f(e - EG, 2)} eV que sobran se vuelven calor` : ''}.`
            : `Como ${f(e, 2)} &lt; ${EG}, <b>no alcanza para liberar un electrón</b>: el fotón atraviesa el silicio. El mínimo del silicio es ${f(f0, 0)} THz (${f(lambda0, 0)} nm); por debajo de esa frecuencia no hay efecto.`);
    } else {
      fo.style.display = 'none';
      tx.innerHTML = `La luz del Sol mezcla todos los colores. La banda coloreada es la luz visible (≈ 1.65 a 3.10 eV): cada fotón visible supera los ${EG} eV y libera un electrón. El infrarrojo lejano (más allá de ${f(lambda0, 0)} nm) no alcanza y atraviesa la celda. Elige un solo color para ver la diferencia.`;
    }
    let r;
    if (st.gInc <= 0.004) r = 'Sin luz no llegan fotones: no hay electrones libres ni corriente.';
    else if (st.nm && st.cf === 0) r = 'Llegan fotones, pero ninguno trae energía suficiente: no se libera ningún electrón y el cable queda quieto. Más intensidad solo significa más fotones inútiles.';
    else if (st.iOp < 0.002) r = 'Los electrones liberados suben a la capa n pero el circuito está abierto, no tienen por dónde salir y se acumulan. Esa acumulación es el voltaje.';
    else {
      const q = 1.602176634e-19, ne = st.iOp / q;
      r = `Con esta carga pasan unos ${sci(ne)} electrones por segundo por el cable (I ÷ carga del electrón, cálculo). La corriente convencional se dibuja al revés: va del contacto trasero al frontal.`;
      if (st.nm) { const ph = st.G * st.gInc / (HC / st.nm * q); r += ` Llegan ≈ ${sci(ph)} fotones por m² por segundo.`; }
    }
    rs.innerHTML = r;
  }

  function update(p) {
    const antes = st.theta;
    st = Object.assign(st, p);
    if ((antes === null) !== (st.theta === null)) parts = parts.filter((q) => q.t !== 'ph');
    textos();
    if (!playing || !visible) dibuja();
  }

  /* ---------- Inicio ---------- */
  const esc = $('#eg-escala');
  if (esc) esc.innerHTML = [0, 1, 2, 3].map((v) => `<span style="left:${v / E_MAX * 100}%">${v}${v === 3 ? ' eV' : ''}</span>`).join('');
  const btn = $('#foto-play');
  function setPlay(v) {
    playing = v;
    btn.setAttribute('aria-pressed', String(v));
    btn.textContent = v ? '⏸ Pausar' : '▶ Reproducir';
    if (v) arranca(); else dibuja();
  }
  btn.addEventListener('click', () => setPlay(!playing));
  if (!playing) { btn.setAttribute('aria-pressed', 'false'); btn.textContent = '▶ Reproducir'; }
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) arranca(); }, { threshold: 0.05 }).observe(cv);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) arranca(); });
  window.addEventListener('atlas:tema', () => { T = tema(); dibuja(); });
  let rt = 0;
  const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { mide(); arranca(); }, 120); });
  ro.observe(cv.parentElement);
  mide(); textos(); arranca();

  window.CeldaAnim = { update, setPlay };
})();
