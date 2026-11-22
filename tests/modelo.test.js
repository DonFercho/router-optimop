// Pruebas del modelo. Ejecutar con: node tests/modelo.test.js
const assert = require('assert');
const M = require('../js/modelo.js');
const P = require('../js/planos.js');
let n = 0;
const t = (nombre, fn) => { fn(); n++; console.log('ok -', nombre); };
const room = (x, y, w, h, weight = 1) => ({ x, y, w, h, weight });
const params = { L: 4, n: 3, Pm: -70, con: false, R: 4 };

t('una habitación tiene 4 muros', () => assert.strictEqual(M.buildWalls([room(0, 0, 4, 4)], []).length, 4));
t('dos habitaciones contiguas comparten el muro (5 muros)', () =>
  assert.strictEqual(M.buildWalls([room(0, 0, 4, 4), room(4, 0, 4, 4)], []).length, 5));
t('una puerta parte el muro en dos tramos', () => {
  const r = [room(0, 0, 4, 4), room(4, 0, 4, 4)];
  assert.strictEqual(M.buildWalls(r, [{ x: 4, y: 2, o: 'v' }]).length, 6);
});
t('cruzar un muro cuenta 1; dentro de la misma habitación 0', () => {
  const ctx = M.crearContexto({ rooms: [room(0, 0, 4, 4), room(4, 0, 4, 4)], doors: [], plug: { x: 1, y: 1 } }, params);
  assert.strictEqual(M.murosCruzados(ctx, 1, 2, 6, 2), 1);
  assert.strictEqual(M.murosCruzados(ctx, 1, 1, 3, 3), 0);
});
t('el centro cubre más que una esquina en una sola habitación', () => {
  const ctx = M.crearContexto({ rooms: [room(0, 0, 8, 6)], doors: [], plug: { x: 1, y: 1 } }, { ...params, Pm: -62 });
  assert.ok(M.F(ctx, 4, 3) > M.F(ctx, 0.5, 0.5));
});
t('el óptimo de una habitación simétrica queda cerca del centro', () => {
  const ctx = M.crearContexto({ rooms: [room(0, 0, 8, 6)], doors: [], plug: { x: 1, y: 1 } }, { ...params, Pm: -62 });
  const o = M.optimo(ctx);
  assert.ok(Math.abs(o.q[0] - 4) < 1.2 && Math.abs(o.q[1] - 3) < 1.2, JSON.stringify(o.q));
});
t('el ascenso por gradiente no empeora F', () => {
  const plan = P.clonar('casa');
  const ctx = M.crearContexto(plan, params);
  const f0 = M.F(ctx, 9, 6), a = M.ascenso(ctx, [9, 6]);
  assert.ok(a.f >= f0);
});
t('con restricción el óptimo respeta el cable', () => {
  const plan = P.clonar('casa');
  const ctx = M.crearContexto(plan, { ...params, con: true, R: 2 });
  const o = M.optimo(ctx);
  assert.ok(Math.hypot(o.q[0] - plan.plug.x, o.q[1] - plan.plug.y) <= 2 + 1e-6);
});
t('nearestWallNode encuentra un muro y devuelve su orientación', () => {
  const r = [room(0, 0, 4, 4), room(4, 0, 4, 4)];
  const d = M.nearestWallNode(r, 4.1, 2.1);
  assert.deepStrictEqual([d.x, d.y, d.o], [4, 2, 'v']);
  assert.strictEqual(M.nearestWallNode(r, 2, 2), null);
});
t('las plantillas son válidas y un plano solapado se rechaza', () => {
  assert.ok(P.clonar('casa') && P.clonar('apartamento') && P.clonar('vacio'));
  assert.strictEqual(P.validar({ rooms: [room(0, 0, 4, 4), room(2, 2, 4, 4)] }), null);
});
console.log(n + ' pruebas pasaron');
