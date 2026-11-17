/* Atlas · tema claro/oscuro y animaciones discretas de la página.
   - Botón de tema (se guarda en localStorage; si no hay elección, sigue al sistema).
   - Aparición suave de bloques al hacer scroll.
   - Cifras que cuentan una sola vez al verse (terminan en el texto original exacto).
   - Pausa las animaciones CSS marcadas con [data-anim] fuera de pantalla.
   Todo se omite con prefers-reduced-motion. */
(function () {
  'use strict';
  const raiz = document.documentElement;
  const quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const IO = 'IntersectionObserver' in window;

  /* ---------- Tema ---------- */
  const btn = document.getElementById('tema-btn');
  const meta = document.querySelector('meta[name="theme-color"]');
  function aplica(t, guarda) {
    raiz.dataset.tema = t;
    if (btn) {
      const os = t === 'oscuro';
      btn.setAttribute('aria-pressed', String(os));
      btn.setAttribute('aria-label', os ? 'Activar modo claro' : 'Activar modo oscuro');
      btn.title = os ? 'Modo claro' : 'Modo oscuro';
    }
    if (meta) meta.setAttribute('content', t === 'oscuro' ? '#0A1424' : '#0B2A5B');
    const logo = document.querySelector('.barra .logo img');
    if (logo) logo.src = t === 'oscuro' ? 'assets/solvectra-horizontal-oscuro.svg' : 'assets/solvectra-horizontal.svg';
    if (guarda) { try { localStorage.setItem('atlas-tema', t); } catch (e) { /* sin almacenamiento */ } }
    window.dispatchEvent(new CustomEvent('atlas:tema', { detail: t }));
  }
  if (!raiz.dataset.tema) raiz.dataset.tema = 'claro';
  aplica(raiz.dataset.tema, false);
  if (btn) btn.addEventListener('click', () => {
    raiz.classList.add('cambia-tema');
    aplica(raiz.dataset.tema === 'oscuro' ? 'claro' : 'oscuro', true);
    setTimeout(() => raiz.classList.remove('cambia-tema'), 400);
  });
  if (window.matchMedia) {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const sigue = () => { let g = null; try { g = localStorage.getItem('atlas-tema'); } catch (e) { /* */ } if (!g) aplica(mq.matches ? 'oscuro' : 'claro', false); };
    if (mq.addEventListener) mq.addEventListener('change', sigue);
  }

  if (quieto || !IO) return;

  /* ---------- Aparición al hacer scroll ---------- */
  const bloques = document.querySelectorAll('main section > .contenedor > *, main .panel, main .pos-card');
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visto'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
  bloques.forEach((b) => {
    const r = b.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) return; /* lo que ya se ve, se queda quieto */
    b.classList.add('revela'); io.observe(b);
  });

  /* ---------- Cifras que cuentan una vez ---------- */
  function cuenta(el) {
    const txt = el.textContent;
    const m = txt.match(/^(\d{1,3}(?:,\d{3})*|\d+)(\.\d+)?$/);
    if (!m) return;
    const dec = m[2] ? m[2].length - 1 : 0;
    const fin = parseFloat(txt.replace(/,/g, ''));
    const sep = txt.includes(',');
    const fmt = (v) => { const s = v.toFixed(dec); if (!sep) return s; const [e, d] = s.split('.'); return e.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : ''); };
    const t0 = performance.now(), dur = 1100;
    el.style.fontVariantNumeric = 'tabular-nums';
    (function paso(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = k < 1 ? fmt(fin * e) : txt;
      if (k < 1) requestAnimationFrame(paso);
    })(t0);
  }
  const cifras = document.querySelectorAll('[data-cuenta]');
  const ioC = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { cuenta(e.target); ioC.unobserve(e.target); } });
  }, { threshold: 0.6 });
  cifras.forEach((c) => ioC.observe(c));

  /* ---------- Pausar animaciones CSS fuera de pantalla ---------- */
  const animadas = document.querySelectorAll('[data-anim]');
  const ioA = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('en-pausa', !e.isIntersecting)), { threshold: 0 });
  animadas.forEach((a) => ioA.observe(a));
  document.addEventListener('visibilitychange', () => raiz.classList.toggle('pestana-oculta', document.hidden));
})();
