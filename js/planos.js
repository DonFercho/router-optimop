/* Plantillas de planos y validación (para importar/exportar JSON). Unidades: metros, múltiplos de 0.5. */
(function (root, factory) {
  const M = (typeof module === 'object' && module.exports) ? require('./modelo.js') : root.Modelo;
  const m = factory(M);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.Planos = m;
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';
  const PRESETS = {
    casa: {
      rooms: [
        { name: 'Sala', x: 0, y: 0, w: 5, h: 4, weight: 3 },
        { name: 'Cocina', x: 5, y: 0, w: 5, h: 4, weight: 1 },
        { name: 'Cuarto 1', x: 0, y: 4, w: 4, h: 3, weight: 3 },
        { name: 'Baño', x: 4, y: 4, w: 2, h: 3, weight: 0.5 },
        { name: 'Cuarto 2', x: 6, y: 4, w: 4, h: 3, weight: 2 }],
      doors: [{ x: 1.5, y: 4, o: 'h' }, { x: 5, y: 4, o: 'h' }, { x: 8, y: 4, o: 'h' }, { x: 5, y: 2, o: 'v' }],
      plug: { x: 1, y: 3 }, router: { x: 9, y: 6 }
    },
    apartamento: {
      rooms: [
        { name: 'Sala', x: 0, y: 0, w: 6, h: 4, weight: 3 },
        { name: 'Cocina', x: 6, y: 0, w: 3, h: 3, weight: 1 },
        { name: 'Habitación 1', x: 0, y: 4, w: 3, h: 3, weight: 3 },
        { name: 'Habitación 2', x: 3, y: 4, w: 3, h: 3, weight: 2 }],
      doors: [{ x: 6, y: 1.5, o: 'v' }, { x: 1.5, y: 4, o: 'h' }, { x: 4.5, y: 4, o: 'h' }],
      plug: { x: 1, y: 1 }, router: { x: 8, y: 2 }
    },
    vacio: { rooms: [], doors: [], plug: { x: 1, y: 1 }, router: { x: 1, y: 1 } }
  };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sn = v => Math.round(v / M.G) * M.G;

  // Devuelve un plano limpio o null si el objeto no es válido.
  function validar(o) {
    if (!o || !Array.isArray(o.rooms) || o.rooms.length > 20) return null;
    const rooms = [];
    let id = 1;
    for (const r of o.rooms) {
      if (!r || ![r.x, r.y, r.w, r.h].every(Number.isFinite)) return null;
      const x = sn(r.x), y = sn(r.y), w = sn(r.w), h = sn(r.h);
      if (w < 1 || h < 1 || x < 0 || y < 0 || x + w > M.W || y + h > M.H) return null;
      rooms.push({ id: id++, name: String(r.name || 'Habitación').slice(0, 24), x, y, w, h, weight: clamp(Number(r.weight) || 0, 0, 5) });
    }
    for (let i = 0; i < rooms.length; i++)
      for (let j = i + 1; j < rooms.length; j++) if (M.solapa(rooms[i], rooms[j])) return null;
    const doors = (Array.isArray(o.doors) ? o.doors : [])
      .filter(d => d && (d.o === 'h' || d.o === 'v') && Number.isFinite(d.x) && Number.isFinite(d.y))
      .map(d => ({ x: sn(d.x), y: sn(d.y), o: d.o }))
      .filter(d => M.puertaValida(rooms, d));
    const centro = rooms[0] ? { x: rooms[0].x + rooms[0].w / 2, y: rooms[0].y + rooms[0].h / 2 } : { x: 1, y: 1 };
    const ok = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && M.insideAny(rooms, p.x, p.y);
    return {
      rooms, doors,
      plug: ok(o.plug) ? { x: +o.plug.x, y: +o.plug.y } : { ...centro },
      router: ok(o.router) ? { x: +o.router.x, y: +o.router.y } : { ...centro }
    };
  }
  function clonar(nombre) { return validar(JSON.parse(JSON.stringify(PRESETS[nombre]))); }

  return { PRESETS, validar, clonar };
});
