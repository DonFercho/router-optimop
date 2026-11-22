/* INTERFAZ: dibujo en canvas, editor del plano y resultados. La matemática está en modelo.js. */
(function () {
  'use strict';
  const M = Modelo, W = M.W, H = M.H, G = M.G;
  const KEY = 'router-optimo-v1';
  const $ = id => document.getElementById(id);
  const AYUDA = {
    router: 'Toca o arrastra sobre el plano para mover tu router actual.',
    room: 'Arrastra para dibujar una habitación (se ajusta a 0.5 m, mínimo 1 × 1 m).',
    door: 'Toca un muro para poner o quitar una puerta de 1 m.',
    plug: 'Toca dentro de la casa para ubicar el enchufe (se usa con la restricción de cable).',
    erase: 'Toca una puerta o una habitación para borrarla.'
  };

  let plan = cargar() || Planos.clonar('casa');
  let tool = 'router', view = 1, drag = null, cache = { key: '', val: null }, raf = 0, nextId = 1, tmsg = 0;
  plan.rooms.forEach(r => { nextId = Math.max(nextId, r.id + 1); });

  /* ---------- Guardado local ---------- */
  function cargar() {
    try { const s = localStorage.getItem(KEY); return s ? Planos.validar(JSON.parse(s)) : null; } catch (e) { return null; }
  }
  function guardar() { try { localStorage.setItem(KEY, JSON.stringify(plan)); } catch (e) { /* sin almacenamiento */ } }
  function aviso(t) { $('estado').textContent = t; clearTimeout(tmsg); tmsg = setTimeout(() => { $('estado').textContent = ''; }, 3500); }

  /* ---------- Lista de habitaciones ---------- */
  function renderRooms() {
    const box = $('rooms'); box.innerHTML = '';
    if (!plan.rooms.length) { box.innerHTML = '<p class="hint">Aún no hay habitaciones.</p>'; return; }
    for (const r of plan.rooms) {
      const d = document.createElement('div'); d.className = 'rr';
      const nm = document.createElement('input'); nm.type = 'text'; nm.value = r.name; nm.maxLength = 24; nm.setAttribute('aria-label', 'Nombre de la habitación');
      nm.addEventListener('input', () => { r.name = nm.value; guardar(); programar(); });
      const w = document.createElement('input'); w.type = 'number'; w.min = 0; w.max = 5; w.step = 0.5; w.value = r.weight; w.setAttribute('aria-label', 'Peso de ' + r.name);
      w.addEventListener('input', () => { r.weight = Math.min(5, Math.max(0, +w.value || 0)); cambio(false); });
      const x = document.createElement('button'); x.textContent = '×'; x.setAttribute('aria-label', 'Borrar ' + r.name);
      x.addEventListener('click', () => borrarHab(r.id));
      d.append(nm, w, x); box.appendChild(d);
    }
  }
  function borrarHab(id) {
    plan.rooms = plan.rooms.filter(r => r.id !== id);
    plan.doors = plan.doors.filter(d => M.puertaValida(plan.rooms, d));
    cambio(true);
  }

  /* ---------- Cambios en el plano ---------- */
  function cambio(estructural) { if (estructural) renderRooms(); guardar(); programar(); }
  function programar() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; actualizar(); }); }
  function asegurarDentro() {
    const c = plan.rooms[0] ? { x: plan.rooms[0].x + plan.rooms[0].w / 2, y: plan.rooms[0].y + plan.rooms[0].h / 2 } : null;
    if (c && !M.insideAny(plan.rooms, plan.router.x, plan.router.y)) plan.router = { ...c };
    if (c && !M.insideAny(plan.rooms, plan.plug.x, plan.plug.y)) plan.plug = { ...c };
  }
  function usarPlano(p) { plan = p; nextId = 1; plan.rooms.forEach(r => { nextId = Math.max(nextId, r.id + 1); }); cache.key = ''; cambio(true); }

  /* ---------- Cálculo y resultados ---------- */
  function params() {
    return { L: +$('L').value, n: +$('n').value, Pm: +$('Pm').value, con: $('rc').checked, R: +$('R').value, ang: +$('A').value * Math.PI / 180 };
  }
  const f1 = v => v.toFixed(1), f2 = v => v.toFixed(2);
  function vaciar() { for (const id of ['ra', 'ro', 'gr', 'hs', 'cl', 'lm', 'g0', 'du']) $(id).textContent = '—'; }

  function actualizar() {
    const p = params();
    $('vL').textContent = p.L + ' dB'; $('vn').textContent = p.n; $('vP').textContent = p.Pm + ' dBm'; $('vR').textContent = p.R + ' m'; $('vA').textContent = $('A').value + '°';
    asegurarDentro();
    if (!plan.rooms.length) {
      $('msg').textContent = 'Dibuja al menos una habitación con la herramienta «Habitación».'; vaciar(); dibujar(null); return;
    }
    const ctx = M.crearContexto(plan, p);
    const key = JSON.stringify([plan.rooms, plan.doors, plan.plug, p.L, p.n, p.Pm, p.con, p.R]);
    if (key !== cache.key) {
      const o = M.optimo(ctx);
      cache = { key, val: o ? { o, c1: M.cobertura(ctx, o.q[0], o.q[1]), g: M.grad(ctx, o.q[0], o.q[1]), h: M.hessiano(ctx, o.q[0], o.q[1]) } : null };
    }
    const op = cache.val;
    if (!op) { $('msg').textContent = 'No hay un punto válido: el enchufe y el cable no alcanzan ninguna habitación.'; vaciar(); dibujar(ctx, p); return; }
    const r = plan.router, c0 = M.cobertura(ctx, r.x, r.y), g0 = M.grad(ctx, r.x, r.y), own = M.ascenso(ctx, [r.x, r.y], 40);
    const [x, y] = op.o.q;
    $('msg').innerHTML = `Tu router actual cubre <b>${c0[0].toFixed(0)} %</b> de la casa (ponderada). En el punto óptimo cubrirías <b>${op.c1[0].toFixed(0)} %</b>.`;
    $('ra').textContent = `${c0[0].toFixed(0)} % · ${c0[1].toFixed(0)} dBm`;
    $('ro').textContent = `(${f1(x)}, ${f1(y)}) m · ${op.c1[0].toFixed(0)} %`;
    $('gr').textContent = `${f2(op.g[0])} , ${f2(op.g[1])}`;
    $('hs').textContent = `${f1(op.h.det)} , ${f1(op.h.fxx)}`;
    const enBorde = p.con && Math.hypot(x - plan.plug.x, y - plan.plug.y) > p.R - 0.02;
    $('cl').textContent = enBorde ? 'Máximo restringido' : (op.h.det > 0 && op.h.fxx < 0 ? 'Máximo local' : 'Máximo aprox. (muros)');
    $('lm').textContent = enBorde ? f2((op.g[0] * (x - plan.plug.x) + op.g[1] * (y - plan.plug.y)) / (2 * p.R * p.R)) : 'no aplica';
    $('g0').textContent = `(${f2(g0[0])}, ${f2(g0[1])})`;
    $('du').textContent = `${f2(g0[0] * Math.cos(p.ang) + g0[1] * Math.sin(p.ang))} %/m`;
    dibujar(ctx, p, op, own, g0);
  }

  /* ---------- Dibujo ---------- */
  const cv = $('cv'), g = cv.getContext('2d');
  function flecha(x, y, dx, dy, col) {
    const m = Math.hypot(dx, dy) || 1, L = 1.1; dx = dx / m * L; dy = dy / m * L;
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 0.07; g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx, y + dy); g.stroke();
    const a = Math.atan2(dy, dx);
    g.beginPath(); g.moveTo(x + dx, y + dy);
    g.lineTo(x + dx - 0.25 * Math.cos(a - 0.4), y + dy - 0.25 * Math.sin(a - 0.4));
    g.lineTo(x + dx - 0.25 * Math.cos(a + 0.4), y + dy - 0.25 * Math.sin(a + 0.4)); g.fill();
  }
  function dibujar(ctx, p, op, own, g0) {
    const w = cv.clientWidth; if (!w) return;
    const s = w / W, dpr = window.devicePixelRatio || 1;
    cv.width = w * dpr; cv.height = H * s * dpr; cv.style.height = H * s + 'px';
    g.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue('--wall').trim(), org = css.getPropertyValue('--org').trim(), line = css.getPropertyValue('--line').trim(), acc = css.getPropertyValue('--acc').trim();
    g.clearRect(0, 0, W, H);
    g.strokeStyle = line; g.lineWidth = 0.02; g.beginPath();
    for (let i = 0; i <= W; i++) { g.moveTo(i, 0); g.lineTo(i, H); }
    for (let j = 0; j <= H; j++) { g.moveTo(0, j); g.lineTo(W, j); }
    g.stroke();
    if (ctx && op) {
      const R0 = view === 1 ? plan.router : { x: op.o.q[0], y: op.o.q[1] };
      for (let x = 0; x < W; x += 0.1) for (let y = 0; y < H; y += 0.1) {
        if (!M.insideAny(plan.rooms, x + 0.05, y + 0.05)) continue;
        const v = M.senal(ctx, R0.x, R0.y, x + 0.05, y + 0.05), t = Math.min(1, Math.max(0, (v + 85) / 45));
        g.fillStyle = `hsl(${230 - 175 * t},80%,${v >= p.Pm ? 52 : 30}%)`; g.fillRect(x, y, 0.101, 0.101);
      }
    } else {
      g.fillStyle = 'rgba(128,128,128,.25)'; for (const r of plan.rooms) g.fillRect(r.x, r.y, r.w, r.h);
    }
    // Muros (mismo espesor para todos) y puertas
    g.strokeStyle = ink; g.lineWidth = 0.09; g.lineCap = 'round';
    for (const wl of M.buildWalls(plan.rooms, plan.doors)) { g.beginPath(); g.moveTo(wl[0], wl[1]); g.lineTo(wl[2], wl[3]); g.stroke(); }
    g.strokeStyle = acc; g.lineWidth = 0.05; g.setLineDash([0.1, 0.08]);
    for (const d of plan.doors) { g.beginPath(); if (d.o === 'h') { g.moveTo(d.x - 0.5, d.y); g.lineTo(d.x + 0.5, d.y); } else { g.moveTo(d.x, d.y - 0.5); g.lineTo(d.x, d.y + 0.5); } g.stroke(); }
    g.setLineDash([]);
    g.font = 'bold 0.28px system-ui'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.shadowColor = '#000'; g.shadowBlur = 0.1;
    for (const r of plan.rooms) g.fillText(r.name, r.x + r.w / 2, r.y + 0.5);
    g.shadowBlur = 0;
    if (drag && drag.type === 'room') {
      const x = Math.min(drag.a.x, drag.b.x), y = Math.min(drag.a.y, drag.b.y), rw = Math.abs(drag.a.x - drag.b.x), rh = Math.abs(drag.a.y - drag.b.y);
      g.fillStyle = 'rgba(15,118,110,.25)'; g.fillRect(x, y, rw, rh); g.strokeStyle = acc; g.lineWidth = 0.05; g.strokeRect(x, y, rw, rh);
    }
    if (ctx && p.con) {
      g.strokeStyle = '#fff'; g.setLineDash([0.12, 0.1]); g.lineWidth = 0.04; g.beginPath(); g.arc(plan.plug.x, plan.plug.y, p.R, 0, 7); g.stroke(); g.setLineDash([]);
    }
    if (plan.rooms.length) { g.fillStyle = '#fff'; g.strokeStyle = ink; g.lineWidth = 0.04; g.fillRect(plan.plug.x - 0.12, plan.plug.y - 0.12, 0.24, 0.24); g.strokeRect(plan.plug.x - 0.12, plan.plug.y - 0.12, 0.24, 0.24); }
    if (ctx && op) {
      g.strokeStyle = '#fff'; g.lineWidth = 0.05; g.setLineDash([0.08, 0.08]); g.beginPath();
      own.path.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke(); g.setLineDash([]);
      flecha(plan.router.x, plan.router.y, g0[0], g0[1], org);
      flecha(plan.router.x, plan.router.y, Math.cos(p.ang), Math.sin(p.ang), '#d9e0e6');
      g.fillStyle = org; g.strokeStyle = '#fff'; g.lineWidth = 0.05; g.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.15 : 0.4, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(op.o.q[0] + r * Math.cos(a), op.o.q[1] + r * Math.sin(a)); }
      g.closePath(); g.fill(); g.stroke();
    }
    if (plan.rooms.length) { g.fillStyle = '#fff'; g.strokeStyle = org; g.lineWidth = 0.07; g.beginPath(); g.arc(plan.router.x, plan.router.y, 0.2, 0, 7); g.fill(); g.stroke(); }
  }

  /* ---------- Interacción con el plano ---------- */
  function pos(e) {
    const r = cv.getBoundingClientRect(), k = W / r.width;
    return { x: Math.min(W, Math.max(0, (e.clientX - r.left) * k)), y: Math.min(H, Math.max(0, (e.clientY - r.top) * k)) };
  }
  const snap = m => ({ x: Math.round(m.x / G) * G, y: Math.round(m.y / G) * G });
  function moverRouter(m) { if (M.insideAny(plan.rooms, m.x, m.y)) { plan.router = { x: m.x, y: m.y }; programar(); } }
  function confirmarHab() {
    const a = drag.a, b = drag.b, r = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
    if (r.w < 1 || r.h < 1) { aviso('La habitación debe medir al menos 1 × 1 m.'); return; }
    if (plan.rooms.length >= 20) { aviso('Máximo 20 habitaciones.'); return; }
    if (plan.rooms.some(o => M.solapa(o, r))) { aviso('La habitación se solapa con otra. Dibújala al lado, no encima.'); return; }
    plan.rooms.push({ id: nextId++, name: 'Habitación ' + (plan.rooms.length + 1), x: r.x, y: r.y, w: r.w, h: r.h, weight: 1 });
    cambio(true);
  }
  function puerta(m) {
    const nd = M.nearestWallNode(plan.rooms, m.x, m.y);
    if (!nd) { aviso('Toca sobre un muro para poner una puerta.'); return; }
    const i = plan.doors.findIndex(d => d.x === nd.x && d.y === nd.y && d.o === nd.o);
    if (i >= 0) plan.doors.splice(i, 1); else plan.doors.push({ x: nd.x, y: nd.y, o: nd.o });
    cambio(false);
  }
  function borrar(m) {
    const i = plan.doors.findIndex(d => Math.hypot(d.x - m.x, d.y - m.y) < 0.5);
    if (i >= 0) { plan.doors.splice(i, 1); cambio(false); return; }
    const r = M.roomAt(plan.rooms, m.x, m.y);
    if (r) borrarHab(r.id);
  }
  cv.addEventListener('pointerdown', e => {
    const m = pos(e); cv.setPointerCapture(e.pointerId);
    if (tool === 'router') { drag = { type: 'router' }; moverRouter(m); }
    else if (tool === 'room') { const s = snap(m); drag = { type: 'room', a: s, b: s }; programar(); }
    else if (tool === 'door') puerta(m);
    else if (tool === 'plug') { if (M.insideAny(plan.rooms, m.x, m.y)) { plan.plug = { x: m.x, y: m.y }; cambio(false); } else aviso('El enchufe debe estar dentro de la casa.'); }
    else if (tool === 'erase') borrar(m);
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) return; const m = pos(e);
    if (drag.type === 'router') moverRouter(m); else if (drag.type === 'room') { drag.b = snap(m); programar(); }
  });
  const fin = () => { if (drag && drag.type === 'room') confirmarHab(); if (drag && drag.type === 'router') guardar(); drag = null; programar(); };
  cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', () => { drag = null; programar(); });

  /* ---------- Botones y controles ---------- */
  function elegirHerramienta(t) {
    tool = t; $('ayuda').textContent = AYUDA[t];
    document.querySelectorAll('#tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  }
  document.querySelectorAll('#tools button').forEach(b => b.addEventListener('click', () => elegirHerramienta(b.dataset.tool)));
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => usarPlano(Planos.clonar(b.dataset.preset))));
  $('b1').onclick = () => { view = 1; $('b1').className = 'on'; $('b2').className = ''; programar(); };
  $('b2').onclick = () => { view = 2; $('b2').className = 'on'; $('b1').className = ''; programar(); };
  ['L', 'n', 'Pm', 'R', 'rc', 'A'].forEach(i => $(i).addEventListener('input', programar));
  $('exp').onclick = () => {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'plano.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('imp').onclick = () => $('file').click();
  $('file').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try { const p = Planos.validar(JSON.parse(rd.result)); if (p) { usarPlano(p); aviso('Plano importado.'); } else aviso('El archivo no es un plano válido (revisa medidas y solapes).'); }
      catch (err) { aviso('No se pudo leer el archivo JSON.'); }
    };
    rd.readAsText(f); e.target.value = '';
  });
  window.addEventListener('resize', programar);

  elegirHerramienta('router'); renderRooms(); actualizar();
  window.__app = { get plan() { return plan; }, actualizar };
})();
