/* Animación didáctica del efecto fotoeléctrico / fotovoltaico dentro de una celda.
   No usa datos oficiales: es una ilustración. Física de referencia: E = h·f = hc/λ.
   Corte transversal: vidrio, capa antirreflejante, rejilla frontal, capa n, unión p-n
   (iones fijos y campo eléctrico), capa p y contacto trasero. La luz llega en una franja;
   los electrones liberados suben a la capa n y viajan en horizontal hasta el contacto
   frontal, recorren el cable y la carga, y regresan por el contacto trasero a llenar huecos. */
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

  let W = 600, H = 420, dpr = 1, G = null, T = null;
  let st = { gInc: 1, cf: 1, theta: 30, luz: 'sol', nm: null, ratioI: 1, pRatio: 1, iOp: 1, vTxt: '', iTxt: '', pTxt: '', rTxt: '' };
  let parts = [], flowOff = 0, spawnAcc = 0, tt = 0;
  let playing = !reduce, visible = true, last = 0, raf = 0;
  const $ = (s) => document.querySelector(s);

  /* ---------- Colores (claro / oscuro) ---------- */
  function tema() {
    const os = document.documentElement.dataset.tema === 'oscuro';
    return os ? {
      os, tinta: '#E6EDF7', sub: '#9FB0C8', vidrio: 'rgba(142,197,255,.16)', brillo: 'rgba(210,230,255,.45)', ar: '#4152B8',
      n0: '#17386B', n1: '#122C57', j0: '#0E3B4A', j1: '#0B2F3D', p0: '#3A2D10', p1: '#2B210B', c0: '#6B788C', c1: '#465163',
      metal: '#B7C3D4', metalL: '#7F8DA3', e: '#6AAEFF', eHalo: 'rgba(106,174,255,.35)', h: '#FFC22E', hFondo: '#2B210B',
      campo: '#19C3E6', ionP: '#8EC5FF', ionN: '#FFC22E', cable: '#6F8DB8', punto: '#9CCBFF', calor: '#FF7A3D',
      pastilla: 'rgba(9,20,38,.72)', borde: 'rgba(142,197,255,.25)', ir: '#FF7AB0', mezcla: 'lighter', haz: 0.30, marca: '#0B2A5B', marcaT: '#FFC22E',
    } : {
      os, tinta: '#0B2A5B', sub: '#5B6B85', vidrio: 'rgba(160,200,250,.40)', brillo: 'rgba(255,255,255,.95)', ar: '#3B4A9E',
      n0: '#E4EFFF', n1: '#CCDFFF', j0: '#E2F8FC', j1: '#D2F2F8', p0: '#FFF3D3', p1: '#FFE3A3', c0: '#B5BFCC', c1: '#7F8B9D',
      metal: '#D3DAE4', metalL: '#7D8AA0', e: '#0F4DBC', eHalo: 'rgba(47,128,237,.28)', h: '#B87400', hFondo: '#FFF8E6',
      campo: '#0E95B3', ionP: '#0F4DBC', ionN: '#A86A00', cable: '#0B2A5B', punto: '#2F80ED', calor: '#E8590C',
      pastilla: 'rgba(255,255,255,.82)', borde: 'rgba(11,42,91,.14)', ir: '#8E2453', mezcla: 'source-over', haz: 0.20, marca: '#FFFFFF', marcaT: '#0B2A5B',
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
    const k = nm < 420 ? 0.35 + 0.65 * (nm - 380) / 40 : nm > 700 ? 0.35 + 0.65 * (780 - nm) / 80 : 1;
    const c = (v) => Math.round(255 * Math.pow(clamp(v * k, 0, 1), 0.8));
    let rgb = [c(r), c(g), c(b)];
    if (T && !T.os) rgb = rgb.map((v) => Math.round(v * 0.86)); /* un poco más oscuro sobre fondo claro */
    return rgb;
  }
  const colorNm = (nm, a = 1) => { const c = rgbNm(nm); return c ? `rgba(${c[0]},${c[1]},${c[2]},${a})` : hexA(T.ir, a); };
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

  /* ---------- Geometría ---------- */
  function geom() {
    const m = W < 560;
    const xL = m ? 6 : Math.round(W * 0.035), xR = Math.round(W * (m ? 0.655 : 0.70)), cw = xR - xL;
    const yG = Math.round(H * (m ? 0.27 : 0.29)), gT = m ? 6 : 8, aT = 3;
    const yA = yG + gT, yN = yA + aT;
    const yJ0 = yN + Math.round(H * 0.12), yJ1 = yJ0 + Math.round(H * 0.085);
    const yP1 = yJ1 + Math.round(H * (m ? 0.33 : 0.32)), yB = yP1 + (m ? 9 : 11);
    const xW = Math.round(W * (m ? 0.905 : 0.89));
    const yWt = Math.round((yN + yJ0) / 2), yWb = Math.round((yP1 + yB) / 2);
    const rb = m ? 12 : 16, yC = Math.round((yWt + yWb) / 2);
    return {
      m, xL, xR, cw, yG, gT, aT, yA, yN, yJ0, yJ1, yP1, yB, xW, yWt, yWb, rb, yC,
      bx0: xL + cw * (m ? 0.40 : 0.36), bx1: xL + cw * 0.84,
      fs: m ? 10 : 12, fsS: m ? 9 : 11,
    };
  }
  function ruta() {
    const g = G;
    return [[g.xR, g.yWt], [g.xW, g.yWt], [g.xW, g.yWb], [g.xR, g.yWb], [g.xL + g.cw * 0.06, g.yWb]];
  }
  function rutaLen(p) { let t = 0; for (let i = 1; i < p.length; i++) t += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return t; }
  function rutaEn(p, s) {
    for (let i = 1; i < p.length; i++) {
      const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
      if (s <= d) { const k = d ? s / d : 0; return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k, i]; }
      s -= d;
    }
    const q = p[p.length - 1]; return [q[0], q[1], p.length - 1];
  }
  const inclin = () => (st.theta === null ? 0 : Math.min(st.theta, 50) * Math.PI / 180);

  /* ---------- Partículas ---------- */
  function eligeNm() {
    if (st.nm) return st.nm;
    return Math.random() < 0.18 ? rnd(1250, 1500) : rnd(400, 700);
  }
  function profundidad(nm) {
    /* El azul se absorbe cerca de la superficie y el rojo más adentro (ilustrativo, no a escala). */
    const k = clamp((nm - 380) / (1107 - 380), 0, 1);
    return G.yN + 5 + (G.yP1 - G.yN - 14) * Math.pow(k, 0.85) * rnd(0.75, 1.05);
  }
  function lanzaFoton() {
    const nm = eligeNm(), ir = HC / nm < EG;
    if (st.theta === null) { /* luz difusa que entra por detrás */
      parts.push({ t: 'ph', x: rnd(G.bx0, G.bx1), y: H + 6, vx: 0, vy: -150, nm, ir: true, atras: true, fase: rnd(0, 6.28) });
      return;
    }
    const phi = inclin(), v = 230;
    const sitio = rnd(G.bx0 + 4, G.bx1 - 4);
    parts.push({ t: 'ph', x: sitio - Math.tan(phi) * (G.yG + 10), y: -10, vx: v * Math.sin(phi), vy: v * Math.cos(phi), nm, ir, yAbs: ir ? 1e9 : profundidad(nm), fase: rnd(0, 6.28) });
  }
  function destello(x, y, col, r) { parts.push({ t: 'f', x, y, vida: 0.45, col, r: r || 12 }); }
  function absorbe(p) {
    const e = HC / p.nm, sobra = Math.max(0, 1 - EG / e);
    const enN = p.y < G.yJ0, enJ = p.y >= G.yJ0 && p.y <= G.yJ1;
    parts.push({ t: 'e', x: p.x, y: p.y, est: enN ? 'n' : enJ ? 'j' : 'p', carril: rnd(G.yN + 6, G.yJ0 - 6), vida: 0 });
    parts.push({ t: 'h', x: p.x + rnd(-3, 3), y: p.y + 3, est: enN ? 'n' : enJ ? 'j' : 'p', vida: 0 });
    destello(p.x, p.y, colorNm(p.nm, 0.9), 14);
    if (Math.random() < sobra * 1.2) parts.push({ t: 'q', x: p.x, y: p.y, vida: 0.9, s: rnd(0, 6.28) });
  }
  const fluye = () => st.iOp >= 0.002;

  function paso(dt) {
    tt += dt;
    const tasa = st.gInc > 0.004 ? Math.min(24, 2.5 + 16 * Math.min(st.gInc, 1.3)) : 0;
    spawnAcc += tasa * dt;
    while (spawnAcc >= 1) { spawnAcc -= 1; if (parts.length < 340) lanzaFoton(); }
    const vel = fluye() ? 30 + 150 * Math.sqrt(Math.min(1, st.ratioI)) : 0;
    flowOff = (flowOff + vel * dt) % 20;
    const vLat = fluye() ? 55 + 170 * Math.sqrt(Math.min(1, st.ratioI)) : 0;
    let pilaE = 0, pilaH = 0;
    for (const p of parts) { if (p.est === 'pila') { if (p.t === 'e') pilaE++; else pilaH++; } }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (p.t === 'ph') {
        p.x += p.vx * dt; p.y += p.vy * dt; p.fase += dt * 18;
        if (p.atras) { if (p.y <= G.yB) { destello(p.x, G.yB, T.ir, 8); parts.splice(i, 1); } continue; }
        if (!p.ir && p.y >= p.yAbs) { absorbe(p); parts.splice(i, 1); continue; }
        if (p.y > H + 20 || p.x > W + 20) parts.splice(i, 1);
      } else if (p.t === 'e') {
        p.vida += dt;
        if (p.est === 'p') {
          p.y -= 75 * dt; p.x += rnd(-22, 22) * dt;
          if (p.y <= G.yJ1) p.est = 'j';
        } else if (p.est === 'j') {
          p.y -= 230 * dt;
          if (p.y <= G.yJ0 - 2) p.est = 'n';
        } else if (p.est === 'n') {
          p.y += (p.carril - p.y) * Math.min(1, 5 * dt);
          if (fluye()) {
            p.x += vLat * dt;
            if (p.x >= G.xR - 7) { destello(G.xR - 4, p.y, T.punto, 7); parts.splice(i, 1); continue; }
          } else {
            if (p.meta === undefined) p.meta = rnd(G.xR - G.cw * 0.30, G.xR - 10);
            p.x += 45 * dt;
            if (p.x >= p.meta) { if (pilaE < 36) { p.est = 'pila'; p.vida = 0; pilaE++; } else { parts.splice(i, 1); continue; } }
          }
        } else if (p.est === 'pila') {
          p.x += rnd(-10, 10) * dt; p.y += rnd(-10, 10) * dt;
          p.y = clamp(p.y, G.yN + 5, G.yJ0 - 5);
          if (fluye()) p.est = 'n';
          else if (p.vida > 3.2) { parts.splice(i, 1); continue; }
        }
        p.x = clamp(p.x, G.xL + 4, G.xR - 4);
      } else if (p.t === 'h') {
        p.vida += dt;
        if (p.est === 'n') { p.y += 50 * dt; if (p.y >= G.yJ0) p.est = 'j'; }
        else if (p.est === 'j') { p.y += 200 * dt; if (p.y >= G.yJ1 + 2) p.est = 'p'; }
        else if (p.est === 'p') {
          p.y += 95 * dt; p.x += rnd(-18, 18) * dt;
          if (p.y >= G.yP1 - 7) {
            if (fluye()) { destello(p.x, G.yP1 - 4, T.punto, 7); parts.splice(i, 1); continue; }
            if (pilaH < 30) { p.est = 'pila'; p.vida = 0; pilaH++; } else { parts.splice(i, 1); continue; }
          }
        } else if (p.est === 'pila') {
          p.x += rnd(-8, 8) * dt; p.y = clamp(p.y + rnd(-6, 6) * dt, G.yP1 - 30, G.yP1 - 6);
          if (fluye()) p.est = 'p';
          else if (p.vida > 3.2) { parts.splice(i, 1); continue; }
        }
        p.x = clamp(p.x, G.xL + 4, G.xR - 4);
      } else if (p.t === 'q') {
        p.vida -= dt; p.y -= 14 * dt; p.x += Math.sin(p.s + p.vida * 14) * 0.6;
        if (p.vida <= 0) parts.splice(i, 1);
      } else if (p.t === 'f') {
        p.vida -= dt; if (p.vida <= 0) parts.splice(i, 1);
      }
    }
  }

  /* ---------- Dibujo ---------- */
  function txt(t, x, y, o) {
    o = o || {};
    ctx.font = `${o.p || 500} ${o.fs || G.fs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = o.c || T.tinta; ctx.textAlign = o.a || 'left'; ctx.textBaseline = o.b || 'middle';
    ctx.fillText(t, x, y);
    return ctx.measureText(t).width;
  }
  function pastilla(lineas, x, y) {
    /* Etiqueta de capa: título en negritas y una línea secundaria, sobre un fondo suave. */
    ctx.font = `600 ${G.fs}px Inter, system-ui, sans-serif`;
    let w = ctx.measureText(lineas[0][0]).width;
    if (lineas[1]) { ctx.font = `400 ${G.fsS}px Inter, system-ui, sans-serif`; w = Math.max(w, ctx.measureText(lineas[1][0]).width); }
    const h = lineas[1] ? G.fs + G.fsS + 10 : G.fs + 8;
    ctx.fillStyle = T.pastilla; redondo(x - 5, y - h / 2, w + 10, h, 6); ctx.fill();
    if (lineas[1]) {
      txt(lineas[0][0], x, y - G.fsS / 2 - 1, { p: 600, c: lineas[0][1] });
      txt(lineas[1][0], x, y + G.fs / 2 + 1, { p: 400, fs: G.fsS, c: lineas[1][1] || T.sub });
    } else txt(lineas[0][0], x, y, { p: 600, c: lineas[0][1] });
  }
  function redondo(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function capa(y0, y1, c0, c1) {
    const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.fillRect(G.xL, y0, G.cw, y1 - y0);
  }

  function dibujaHaz() {
    if (st.gInc <= 0.004) return;
    const fuerza = clamp(st.gInc, 0.08, 1.3) / 1.3;
    ctx.save(); ctx.globalCompositeOperation = T.mezcla;
    if (st.theta === null) {
      const g = ctx.createLinearGradient(0, H, 0, G.yB);
      g.addColorStop(0, hexA(T.ir, 0)); g.addColorStop(1, hexA(T.ir, 0.12 * fuerza + 0.05));
      ctx.fillStyle = g; ctx.fillRect(G.bx0, G.yB, G.bx1 - G.bx0, H - G.yB);
      ctx.restore(); return;
    }
    const dx = Math.tan(inclin()) * G.yG;
    const a = T.haz * (0.35 + 0.65 * fuerza);
    ctx.beginPath();
    ctx.moveTo(G.bx0 - dx, 0); ctx.lineTo(G.bx1 - dx, 0); ctx.lineTo(G.bx1, G.yG); ctx.lineTo(G.bx0, G.yG); ctx.closePath();
    let g;
    if (st.nm) {
      g = ctx.createLinearGradient(0, 0, 0, G.yG);
      g.addColorStop(0, colorNm(st.nm, 0)); g.addColorStop(1, colorNm(st.nm, a * (HC / st.nm < EG ? 0.6 : 1)));
    } else {
      /* luz del Sol: todos los colores mezclados */
      g = ctx.createLinearGradient(G.bx0, 0, G.bx1, 0);
      [400, 450, 500, 550, 600, 650, 700].forEach((nm, k) => g.addColorStop(k / 6, colorNm(nm, a * 0.8)));
    }
    ctx.fillStyle = g;
    const e = G.m ? 4 : 7;
    for (let k = 0; k < 4; k++) { /* bordes difuminados */
      ctx.globalAlpha = k ? 0.3 : 0.25;
      ctx.beginPath();
      ctx.moveTo(G.bx0 - dx + e * k, 0); ctx.lineTo(G.bx1 - dx - e * k, 0); ctx.lineTo(G.bx1 - e * k, G.yG); ctx.lineTo(G.bx0 + e * k, G.yG); ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!st.nm) { /* velo superior para que el haz se desvanezca hacia arriba */
      ctx.globalCompositeOperation = 'destination-out';
      const v = ctx.createLinearGradient(0, 0, 0, G.yG); v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = v; ctx.fillRect(G.bx0 - dx - 2, 0, G.bx1 - G.bx0 + dx + 4, G.yG);
    }
    ctx.restore();
  }

  function dibujaCelda() {
    const g = G, w = g.cw;
    /* sombra suave de la celda */
    ctx.save(); ctx.shadowColor = T.os ? 'rgba(0,0,0,.45)' : 'rgba(11,42,91,.14)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fillStyle = T.os ? '#0E1D33' : '#fff'; ctx.fillRect(g.xL, g.yG, w, g.yB - g.yG); ctx.restore();
    /* capas */
    capa(g.yN, g.yJ0, T.n0, T.n1);
    capa(g.yJ0, g.yJ1, T.j0, T.j1);
    capa(g.yJ1, g.yP1, T.p0, T.p1);
    capa(g.yP1, g.yB, T.c0, T.c1);
    ctx.fillStyle = T.ar; ctx.fillRect(g.xL, g.yA, w, g.aT);
    ctx.fillStyle = T.vidrio; ctx.fillRect(g.xL, g.yG, w, g.gT);
    ctx.fillStyle = T.brillo; ctx.fillRect(g.xL, g.yG, w, 1.2);
    /* luz dentro de la celda (se apaga con la profundidad) */
    if (st.gInc > 0.004 && st.theta !== null) {
      ctx.save(); ctx.globalCompositeOperation = T.mezcla;
      const fondo = st.nm ? (HC / st.nm < EG ? g.yB : profundidad(st.nm)) : g.yP1;
      const gr = ctx.createLinearGradient(0, g.yN, 0, fondo);
      const c0 = st.nm ? colorNm(st.nm, 0.16) : (T.os ? 'rgba(255,230,160,.14)' : 'rgba(255,214,120,.18)');
      gr.addColorStop(0, c0); gr.addColorStop(1, st.nm ? colorNm(st.nm, 0) : 'rgba(255,214,120,0)');
      ctx.fillStyle = gr;
      for (let k = 0; k < 4; k++) { /* bordes difuminados */
        ctx.globalAlpha = 0.32; const e = k * (g.m ? 4 : 7);
        ctx.fillRect(g.bx0 + e, g.yN, g.bx1 - g.bx0 - 2 * e, fondo - g.yN);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    /* unión p-n: iones fijos y campo eléctrico (de n hacia p) */
    const paso = g.m ? 20 : 26, yi0 = g.yJ0 + (g.yJ1 - g.yJ0) * 0.27, yi1 = g.yJ0 + (g.yJ1 - g.yJ0) * 0.73;
    const pulso = 0.55 + 0.25 * Math.sin(tt * 2.2);
    ctx.lineWidth = 1.1;
    let k = 0;
    for (let x = g.xL + paso * 0.8; x < g.xR - 8; x += paso, k++) {
      if (k % 3 === 1) {
        ctx.globalAlpha = pulso; ctx.strokeStyle = T.campo; ctx.fillStyle = T.campo;
        ctx.beginPath(); ctx.moveTo(x, g.yJ0 + 3); ctx.lineTo(x, g.yJ1 - 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 3, g.yJ1 - 7); ctx.lineTo(x, g.yJ1 - 3); ctx.lineTo(x + 3, g.yJ1 - 7); ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = T.ionP; ctx.beginPath(); ctx.arc(x, yi0, 3.6, 0, 6.283); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 2, yi0); ctx.lineTo(x + 2, yi0); ctx.moveTo(x, yi0 - 2); ctx.lineTo(x, yi0 + 2); ctx.stroke();
      ctx.strokeStyle = T.ionN; ctx.beginPath(); ctx.arc(x, yi1, 3.6, 0, 6.283); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 2, yi1); ctx.lineTo(x + 2, yi1); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    /* rejilla frontal: dedos metálicos y barra colectora */
    const dedos = g.m ? 9 : 14;
    for (let i = 0; i < dedos; i++) {
      const x = g.xL + w * (0.05 + 0.9 * i / (dedos - 1)) - 2.5;
      ctx.fillStyle = T.metal; ctx.fillRect(x, g.yA - 3, 5, g.aT + 5);
      ctx.fillStyle = T.metalL; ctx.fillRect(x, g.yA + g.aT + 1, 5, 1);
    }
    const bb = ctx.createLinearGradient(g.xR - 7, 0, g.xR, 0); bb.addColorStop(0, T.metal); bb.addColorStop(1, T.metalL);
    ctx.fillStyle = bb; ctx.fillRect(g.xR - 7, g.yA - 3, 7, g.yJ0 - g.yA + 3);
    ctx.strokeStyle = T.borde; ctx.lineWidth = 1; ctx.strokeRect(g.xL + 0.5, g.yG + 0.5, w - 1, g.yB - g.yG - 1);
  }

  function dibujaCircuito() {
    const g = G, pts = ruta(), len = rutaLen(pts);
    ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = T.cable;
    const yTop = g.yC - g.rb, yBase = g.yC + g.rb * 1.35;
    ctx.beginPath(); ctx.moveTo(g.xR, g.yWt); ctx.lineTo(g.xW - 8, g.yWt); ctx.quadraticCurveTo(g.xW, g.yWt, g.xW, g.yWt + 8); ctx.lineTo(g.xW, yTop);
    ctx.moveTo(g.xW, yBase); ctx.lineTo(g.xW, g.yWb - 8); ctx.quadraticCurveTo(g.xW, g.yWb, g.xW - 8, g.yWb); ctx.lineTo(g.xR, g.yWb); ctx.stroke();
    /* foco (la carga): brilla según la potencia */
    const brillo = clamp(st.pRatio, 0, 1);
    if (brillo > 0.01) {
      ctx.save(); ctx.globalCompositeOperation = T.mezcla;
      const rr = g.rb * (2 + 3.2 * brillo);
      const gl = ctx.createRadialGradient(g.xW, g.yC, 2, g.xW, g.yC, rr);
      gl.addColorStop(0, `rgba(255,194,46,${0.18 + 0.55 * brillo})`); gl.addColorStop(1, 'rgba(255,194,46,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(g.xW, g.yC, rr, 0, 6.283); ctx.fill(); ctx.restore();
    }
    ctx.fillStyle = brillo > 0.02 ? `rgba(255,${226 - 30 * brillo},${150 - 90 * brillo},${0.35 + 0.6 * brillo})` : (T.os ? '#13233D' : '#FFFFFF');
    ctx.strokeStyle = T.cable; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(g.xW, g.yC, g.rb, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = brillo > 0.05 ? '#F5A300' : T.sub; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(g.xW - g.rb * 0.45, g.yC + g.rb * 0.55); ctx.lineTo(g.xW - g.rb * 0.45, g.yC);
    for (let i = 0; i <= 4; i++) ctx.lineTo(g.xW - g.rb * 0.45 + g.rb * 0.225 * i, g.yC + (i % 2 ? -g.rb * 0.3 : 0));
    ctx.lineTo(g.xW + g.rb * 0.45, g.yC + g.rb * 0.55); ctx.stroke();
    ctx.fillStyle = T.os ? '#5B677A' : '#9AA5B5';
    redondo(g.xW - g.rb * 0.5, g.yC + g.rb * 0.85, g.rb, g.rb * 0.5, 2); ctx.fill();
    /* terminales */
    txt('−', g.xR + 9, g.yWt - 9, { p: 700, c: T.sub, fs: G.fs + 2 });
    txt('+', g.xR + 9, g.yWb + 10, { p: 700, c: T.sub, fs: G.fs + 1 });
    /* electrones que recorren el cable y regresan por el contacto trasero */
    const n = Math.floor(len / 20), mueve = fluye();
    ctx.save(); if (mueve) ctx.globalCompositeOperation = T.mezcla;
    for (let i = 0; i < n; i++) {
      const s = (i * 20 + flowOff) % len, q = rutaEn(pts, s);
      if (q[0] === g.xW && q[1] > yTop - 2 && q[1] < yBase + 2) continue;
      const enContacto = q[2] === pts.length - 1;
      ctx.fillStyle = mueve ? T.punto : hexA(T.punto, 0.3);
      ctx.beginPath(); ctx.arc(q[0], q[1], enContacto ? 1.8 : 2.6, 0, 6.283); ctx.fill();
    }
    ctx.restore();
    /* lecturas junto a la carga */
    const xt = g.xW - g.rb - (g.m ? 6 : 12), y0 = g.yC - (g.m ? 30 : 38), dy = g.m ? 13 : 16;
    txt('Carga', xt, y0, { p: 600, a: 'right' });
    txt(st.rTxt, xt, y0 + dy, { a: 'right', c: T.sub, fs: G.fsS });
    txt(st.vTxt, xt, y0 + dy * 2, { p: 600, a: 'right', fs: G.fsS + 1 });
    txt(st.iTxt, xt, y0 + dy * 3, { p: 600, a: 'right', fs: G.fsS + 1 });
    txt(st.pTxt, xt, y0 + dy * 4, { p: 700, a: 'right', c: T.os ? '#FFC22E' : '#8A5A00', fs: G.fsS + 1 });
  }

  function onda(p, alfa) {
    const sp = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / sp, uy = p.vy / sp, px = -uy, py = ux;
    const largo = G.m ? 15 : 20, lw = 3.2 + clamp((p.nm - 380) / 1120, 0, 1) * 9;
    const col = p.ir ? T.ir : colorNm(p.nm, 1);
    ctx.beginPath();
    for (let s = 0; s <= largo; s += 1.2) {
      const env = Math.sin(Math.PI * s / largo), a = 3.2 * env * Math.sin(2 * Math.PI * s / lw + p.fase);
      const x = p.x - ux * s + px * a, y = p.y - uy * s + py * a;
      if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.globalAlpha = alfa * (p.ir ? 0.55 : 1);
    ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.globalAlpha *= 0.22; ctx.stroke();
    ctx.globalAlpha = alfa * (p.ir ? 0.65 : 1); ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, 1.9, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function dibujaParticulas() {
    ctx.lineCap = 'round';
    for (const p of parts) {
      if (p.t === 'ph') {
        let a = 1;
        if (p.ir && p.y > G.yB) a = clamp(1 - (p.y - G.yB) / 50, 0, 1);
        else if (p.y > G.yN) a = p.ir ? 0.4 : 0.85;
        onda(p, a);
      }
    }
    for (const p of parts) {
      if (p.t === 'e') {
        const a = p.est === 'pila' ? clamp((3.2 - p.vida) / 0.8, 0, 1) : 1;
        ctx.globalAlpha = a;
        ctx.fillStyle = T.eHalo; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 6.283); ctx.fill();
        ctx.fillStyle = T.e; ctx.beginPath(); ctx.arc(p.x, p.y, 4.2, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(p.x - 2, p.y - 0.6, 4, 1.3);
        ctx.globalAlpha = 1;
      } else if (p.t === 'h') {
        const a = p.est === 'pila' ? clamp((3.2 - p.vida) / 0.8, 0, 1) : 1;
        ctx.globalAlpha = a; ctx.fillStyle = T.hFondo; ctx.strokeStyle = T.h; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4.2, 0, 6.283); ctx.fill(); ctx.stroke();
        ctx.fillStyle = T.h; ctx.fillRect(p.x - 2, p.y - 0.6, 4, 1.3); ctx.fillRect(p.x - 0.6, p.y - 2, 1.3, 4);
        ctx.globalAlpha = 1;
      } else if (p.t === 'q') {
        ctx.globalAlpha = clamp(p.vida / 0.5, 0, 1); ctx.fillStyle = T.calor;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
      } else if (p.t === 'f') {
        const k = 1 - p.vida / 0.45;
        ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = p.col; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2 + p.r * k, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
  }

  function marca(nmr, x, y) {
    ctx.fillStyle = T.marca; ctx.strokeStyle = T.os ? 'rgba(255,194,46,.7)' : 'rgba(11,42,91,.35)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, G.m ? 8 : 9.5, 0, 6.283); ctx.fill(); ctx.stroke();
    txt(String(nmr), x, y + 0.5, { p: 700, a: 'center', c: T.marcaT, fs: G.m ? 9.5 : 11 });
  }

  function dibujaEtiquetas() {
    const g = G, x = g.xL + 9, m = g.m;
    txt(m ? 'Vidrio y antirreflejante' : 'Vidrio protector · capa antirreflejante', g.xL, g.yG - 11, { c: T.sub, fs: g.fsS });
    txt('Rejilla frontal', g.xR, g.yG - 11, { c: T.sub, fs: g.fsS, a: 'right' });
    pastilla([[m ? 'Capa n' : 'Capa n', T.os ? '#9CCBFF' : '#0F4DBC'], [m ? 'sobran e⁻' : 'sobran electrones']], x, (g.yN + g.yJ0) / 2 + 1);
    pastilla([[m ? 'Unión p‑n' : 'Unión p‑n · campo eléctrico', T.os ? '#5FE0F5' : '#0B6F86']], x, (g.yJ0 + g.yJ1) / 2);
    pastilla([['Capa p', T.os ? '#FFD36B' : '#8A5A00'], [m ? 'faltan e⁻ (huecos)' : 'faltan electrones (huecos)']], x, g.yJ1 + (g.yP1 - g.yJ1) * 0.32);
    txt('Contacto trasero', g.xL, g.yB + 12, { c: T.sub, fs: g.fsS });
    /* fuente de luz y ángulo */
    const fuente = st.gInc <= 0.004 ? 'Sin luz' : st.nm ? `Luz de ${f(st.nm, 0)} nm · ${f(HC / st.nm, 2)} eV por fotón` : 'Luz del Sol · todos los colores';
    if (st.nm || st.gInc > 0.004) {
      ctx.fillStyle = st.nm ? colorNm(st.nm, 1) : '#FFC22E';
      ctx.beginPath(); ctx.arc(g.xL + 5, 14, 4.5, 0, 6.283); ctx.fill();
    }
    txt(fuente, g.xL + 15, 14, { p: 600, fs: g.fsS });
    const info = st.theta === null ? 'Luz por detrás: solo llega luz difusa' : `Luz a ${f(st.theta, 0)}° de la perpendicular`;
    txt(info, W - 6, 14, { a: 'right', c: T.sub, fs: g.fsS });
    /* pasos 1-4 (los mismos de la lista de abajo) */
    const dx = Math.tan(inclin()) * g.yG * 0.45;
    marca(1, g.bx1 - dx + 16, g.yG * 0.55);
    const xm = g.m ? g.bx1 + (g.xR - g.bx1) / 2 : g.bx0 - 14;
    marca(2, xm, g.yJ1 + (g.yP1 - g.yJ1) * 0.62);
    marca(3, xm, (g.yJ0 + g.yJ1) / 2);
    marca(4, (g.xR + g.xW) / 2, g.yWt - 14);
  }

  function dibuja() {
    if (!G || !T) return;
    ctx.clearRect(0, 0, W, H);
    dibujaHaz();
    dibujaCelda();
    dibujaCircuito();
    dibujaParticulas();
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
    W = w; H = w < 560 ? 400 : w < 860 ? 410 : 420;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    G = geom(); T = tema();
    parts = [];
    for (let i = 0; i < 90; i++) paso(0.04);
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
