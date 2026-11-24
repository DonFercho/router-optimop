/*
 * MODELO MATEMÁTICO (sin DOM, se puede probar con Node)
 * -----------------------------------------------------
 * Señal:      S(x,y) = 100 - 10·n·log10(d) - L·(muros cruzados) [% de 0 a 100]
 * Objetivo:   F(x0,y0) = 100 · Σ w·σ((P - Pmin)/s) / Σ w     (integral doble discretizada)
 * Óptimo:     ascenso por gradiente (∇F) desde varios puntos de partida.
 * Lagrange:   con cable, el óptimo queda en el borde del círculo: ∇F = λ∇g.
 */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.Modelo = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const G = 0.5;            // resolución de la cuadrícula del plano (m)
  const W = 14, H = 9;      // tamaño máximo del plano (m)
  const P1 = 100;           // señal de referencia a 1 m del router (%)
  const SUAV = 5;           // suavizado de la sigmoide (unidades de %)
  const MUESTRA = 0.4;      // separación de los puntos de la integral (m)

  const sig = z => 1 / (1 + Math.exp(-z));
  const gi = v => Math.round(v / G);

  /* ---------- Geometría del plano ---------- */
  function insideAny(rooms, x, y) {
    return rooms.some(r => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h);
  }
  function roomAt(rooms, x, y) {
    return rooms.find(r => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) || null;
  }
  function solapa(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  }

  // Segmentos unitarios de muro (de 0.5 m). Un muro compartido entre dos habitaciones se cuenta una sola vez.
  function wallUnits(rooms) {
    const h = new Map(), v = new Map();
    const add = (m, k, i) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(i); };
    for (const r of rooms) {
      const x0 = gi(r.x), y0 = gi(r.y), x1 = gi(r.x + r.w), y1 = gi(r.y + r.h);
      for (let i = x0; i < x1; i++) { add(h, y0, i); add(h, y1, i); }
      for (let j = y0; j < y1; j++) { add(v, x0, j); add(v, x1, j); }
    }
    return { h, v };
  }

  // Muros finales [x1,y1,x2,y2] en metros: se quitan las puertas y se unen los tramos contiguos.
  function buildWalls(rooms, doors) {
    const { h, v } = wallUnits(rooms);
    for (const d of doors || []) {
      const gx = gi(d.x), gy = gi(d.y);
      const s = d.o === 'h' ? h.get(gy) : v.get(gx);
      if (s) { const a = d.o === 'h' ? gx : gy; s.delete(a - 1); s.delete(a); }
    }
    const out = [];
    const runs = (m, horiz) => {
      for (const [k, set] of m) {
        const a = [...set].sort((p, q) => p - q);
        let s = null, prev = null;
        const flush = () => {
          if (s === null) return;
          const e = prev + 1;
          out.push(horiz ? [s * G, k * G, e * G, k * G] : [k * G, s * G, k * G, e * G]);
        };
        for (const i of a) {
          if (s === null) { s = i; prev = i; }
          else if (i === prev + 1) prev = i;
          else { flush(); s = i; prev = i; }
        }
        flush();
      }
    };
    runs(h, true); runs(v, false);
    return out;
  }

  // Nodo de muro más cercano al punto (x,y): ahí se puede colocar una puerta de 1 m.
  function nearestWallNode(rooms, x, y, tol) {
    tol = tol || 0.35;
    const { h, v } = wallUnits(rooms);
    const gx = gi(x), gy = gi(y);
    let best = null;
    const sh = h.get(gy);
    if (sh && sh.has(gx - 1) && sh.has(gx) && Math.abs(y - gy * G) <= tol)
      best = { x: gx * G, y: gy * G, o: 'h', d: Math.abs(y - gy * G) };
    const sv = v.get(gx);
    if (sv && sv.has(gy - 1) && sv.has(gy) && Math.abs(x - gx * G) <= tol) {
      const d = Math.abs(x - gx * G);
      if (!best || d < best.d) best = { x: gx * G, y: gy * G, o: 'v', d };
    }
    return best;
  }
  function puertaValida(rooms, d) {
    const { h, v } = wallUnits(rooms);
    const gx = gi(d.x), gy = gi(d.y);
    const s = d.o === 'h' ? h.get(gy) : v.get(gx);
    const a = d.o === 'h' ? gx : gy;
    return !!(s && s.has(a - 1) && s.has(a));
  }

  /* ---------- Contexto de cálculo ---------- */
  function buildSamples(rooms) {
    const S = [];
    for (let x = MUESTRA / 2; x < W; x += MUESTRA)
      for (let y = MUESTRA / 2; y < H; y += MUESTRA) {
        const r = roomAt(rooms, x, y);
        if (r) S.push([x, y, r.weight]);
      }
    return S;
  }
  function crearContexto(plan, p) {
    return { rooms: plan.rooms, walls: buildWalls(plan.rooms, plan.doors), samples: buildSamples(plan.rooms), plug: plan.plug, p };
  }

  /* ---------- Señal y objetivo ---------- */
  function cruza(ax, ay, bx, by, w) {
    const o = (px, py, qx, qy, rx, ry) => (ry - py) * (qx - px) - (qy - py) * (rx - px);
    const d1 = o(ax, ay, bx, by, w[0], w[1]), d2 = o(ax, ay, bx, by, w[2], w[3]);
    const d3 = o(w[0], w[1], w[2], w[3], ax, ay), d4 = o(w[0], w[1], w[2], w[3], bx, by);
    return d1 * d2 < 0 && d3 * d4 < 0;
  }
  function murosCruzados(ctx, ax, ay, bx, by) {
    let c = 0;
    for (const w of ctx.walls) if (cruza(ax, ay, bx, by, w)) c++;
    return c;
  }
  // P depende de d y d de (x,y): regla de la cadena.
  function senal(ctx, rx, ry, x, y) {
    const d = Math.max(Math.hypot(x - rx, y - ry), 0.3);
    return P1 - 10 * ctx.p.n * Math.log10(d) - ctx.p.L * murosCruzados(ctx, rx, ry, x, y);
  }
  // Integral doble discretizada: suma ponderada sobre todo el plano.
  function F(ctx, x, y) {
    let a = 0, t = 0;
    for (const s of ctx.samples) {
      a += s[2] * sig((senal(ctx, x, y, s[0], s[1]) - ctx.p.Pm) / SUAV);
      t += s[2];
    }
    return t ? 100 * a / t : 0;
  }
  function cobertura(ctx, x, y) {
    let a = 0, t = 0, m = 0;
    for (const s of ctx.samples) {
      const v = senal(ctx, x, y, s[0], s[1]);
      if (v >= ctx.p.Pm) a += s[2];
      m += s[2] * v; t += s[2];
    }
    return t ? [100 * a / t, m / t] : [0, 0];
  }

  /* ---------- Derivadas ---------- */
  function grad(ctx, x, y, h) {
    h = h || 0.15;
    return [(F(ctx, x + h, y) - F(ctx, x - h, y)) / (2 * h), (F(ctx, x, y + h) - F(ctx, x, y - h)) / (2 * h)];
  }
  function hessiano(ctx, x, y) {
    const h = 0.3, f0 = F(ctx, x, y);
    const fxx = (F(ctx, x + h, y) - 2 * f0 + F(ctx, x - h, y)) / (h * h);
    const fyy = (F(ctx, x, y + h) - 2 * f0 + F(ctx, x, y - h)) / (h * h);
    const fxy = (F(ctx, x + h, y + h) - F(ctx, x + h, y - h) - F(ctx, x - h, y + h) + F(ctx, x - h, y - h)) / (4 * h * h);
    return { fxx, fyy, fxy, det: fxx * fyy - fxy * fxy };
  }

  /* ---------- Optimización ---------- */
  function proj(ctx, q) {
    let x = Math.min(W - 0.15, Math.max(0.15, q[0])), y = Math.min(H - 0.15, Math.max(0.15, q[1]));
    if (ctx.p.con) { // restricción g(x,y) = (x-xe)² + (y-ye)² - R² ≤ 0
      const d = Math.hypot(x - ctx.plug.x, y - ctx.plug.y);
      if (d > ctx.p.R) { x = ctx.plug.x + (x - ctx.plug.x) * ctx.p.R / d; y = ctx.plug.y + (y - ctx.plug.y) * ctx.p.R / d; }
    }
    return [x, y];
  }
  function ascenso(ctx, p0, maxIt) {
    maxIt = maxIt || 70;
    let q = proj(ctx, p0), f = F(ctx, q[0], q[1]), st = 0.4;
    const path = [q];
    for (let i = 0; i < maxIt && st > 0.01; i++) {
      const g = grad(ctx, q[0], q[1]), m = Math.hypot(g[0], g[1]);
      if (m < 1e-6) break;
      const t = proj(ctx, [q[0] + st * g[0] / m, q[1] + st * g[1] / m]);
      if (insideAny(ctx.rooms, t[0], t[1])) {
        const ft = F(ctx, t[0], t[1]);
        if (ft > f + 1e-9) { q = t; f = ft; path.push(q); continue; }
      }
      st /= 2;
    }
    return { q, f, path };
  }
  // Varios puntos de partida (F puede tener varios máximos locales).
  function optimo(ctx) {
    const c = [];
    for (let x = 0.25; x < W; x += 0.5)
      for (let y = 0.25; y < H; y += 0.5) {
        if (!insideAny(ctx.rooms, x, y)) continue;
        const q = proj(ctx, [x, y]);
        if (Math.hypot(q[0] - x, q[1] - y) > 1e-9) continue;
        c.push([x, y, F(ctx, x, y)]);
      }
    if (!c.length) return null;
    c.sort((a, b) => b[2] - a[2]);
    let best = null;
    for (const s of c.slice(0, 4)) {
      const r = ascenso(ctx, [s[0], s[1]]);
      if (!best || r.f > best.f) best = r;
    }
    return best;
  }

  return { G, W, H, insideAny, roomAt, solapa, wallUnits, buildWalls, nearestWallNode, puertaValida,
    buildSamples, crearContexto, cruza, murosCruzados, senal, F, cobertura, grad, hessiano, proj, ascenso, optimo };
});
