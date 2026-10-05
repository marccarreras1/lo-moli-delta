/**
 * Propuesta inicial de puntos de instalación generada a partir de la geometría del Layout
 * (muros, aberturas, estancias y muebles). No hay coordenadas fijas: si cambian las medidas
 * de la casa, los puntos se recalculan y conservan su identificador (que depende de la
 * función, no de la posición).
 *
 * Todo es una PROPUESTA hasta su validación por el instalador: no representa dispositivos
 * contratados ni recorridos definitivos.
 */
import type { Furniture, Layout, Opening, Room, Vec2, Wall } from '../data/types';
import { bbox, centroid, distPointSegment, furnitureFootprint, pointInPolygon, pointOnWall, polygonArea, wallDir, wallLength, wallNormal } from '../model/geometry';
import type { InstallKind, InstallPoint, Layer } from './types';
import { uStairPieces } from '../model/stairU';

const r2 = (x: number) => Math.round(x * 100) / 100;
const PROPUESTA = 'Propuesta pendiente de validación por el instalador; no es un dispositivo contratado.';
const nota = (s: string) => `${s.trim()} ${PROPUESTA}`;

// ---------- utilidades geométricas ----------

const levelElev = (l: Layout, id: string) => l.levels.find((x) => x.id === id)?.elevation ?? 0;

/** muros presentes a la cota de un nivel (los exteriores de planta baja suben hasta la cubierta) */
function wallsAt(l: Layout, levelId: string): Wall[] {
  const z = levelElev(l, levelId) + 0.1;
  return l.walls.filter((w) => {
    const b = levelElev(l, w.levelId);
    return z >= b - 1e-6 && z <= b + w.height;
  });
}

/** muro cuya cara pasa por `p` (tolerancia en m) */
function wallFaceAt(l: Layout, p: Vec2, levelId: string, tol = 0.04): { wall: Wall; s: number; side: 1 | -1 } | null {
  for (const w of wallsAt(l, levelId)) {
    const d = wallDir(w);
    const n = wallNormal(w);
    const vx = p[0] - w.a[0];
    const vy = p[1] - w.a[1];
    const s = vx * d[0] + vy * d[1];
    const [e0, e1] = w.ext ?? [0, 0];
    if (s < -Math.max(e0, 0) - tol || s > wallLength(w) + Math.max(e1, 0) + tol) continue;
    const off = vx * n[0] + vy * n[1];
    if (Math.abs(Math.abs(off) - w.thickness / 2) <= tol) return { wall: w, s, side: off >= 0 ? 1 : -1 };
  }
  return null;
}

/** ¿cae el punto dentro (o junto a) un hueco de la cota del nivel? */
function inOpening(l: Layout, p: Vec2, levelId: string, margin = 0.08): boolean {
  const z0 = levelElev(l, levelId);
  const z1 = z0 + 2.4;
  for (const o of l.openings) {
    const w = l.walls.find((x) => x.id === o.wallId);
    if (!w) continue;
    const base = levelElev(l, w.levelId);
    const oz0 = base + o.sill;
    const oz1 = oz0 + o.height;
    if (oz1 <= z0 + 0.05 || oz0 >= z1) continue;
    const a = pointOnWall(w, o.offset - margin);
    const b = pointOnWall(w, o.offset + o.width + margin);
    if (distPointSegment(p, a, b) <= w.thickness / 2 + 0.05) return true;
  }
  return false;
}

const roomsAt = (l: Layout, levelId: string) => l.rooms.filter((r) => r.levelId === levelId);
const roomAt = (l: Layout, p: Vec2, levelId: string) => roomsAt(l, levelId).find((r) => pointInPolygon(p, r.polygon));
const roomById = (l: Layout, id: string | null | undefined) => (id ? l.rooms.find((r) => r.id === id) : undefined);

/** nivel de un mueble (el de su estancia) */
const furnitureLevel = (l: Layout, f: Furniture) => roomById(l, f.roomId)?.levelId ?? l.levels[0]?.id ?? 'pb';

/** piezas que no tapan la pared (no impiden un mecanismo detrás) */
const LIGHT_PIECES = new Set(['alfombra', 'aplique', 'balda', 'jarron', 'taburete', 'silla', 'maceta']);
/** piezas altas (por encima de 1,10 m no se puede poner un interruptor) */
const TALL = new Set(['armario', 'nevera', 'ducha', 'banera']);

function blockedBy(l: Layout, p: Vec2, levelId: string, test: (f: Furniture) => boolean): boolean {
  for (const f of l.furniture) {
    if (furnitureLevel(l, f) !== levelId || !test(f)) continue;
    if (pointInPolygon(p, furnitureFootprint(f))) return true;
  }
  for (const st of l.stairs) {
    if (st.fromLevel !== levelId) continue;
    const [x0, y0, x1, y1] = st.rect;
    if (p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1) return true;
  }
  return false;
}

/** cota del techo (relativa al nivel) sobre un punto: bajo un forjado superior o bajo la cubierta */
function ceilingAt(l: Layout, p: Vec2, levelId: string): number {
  const from = levelElev(l, levelId);
  let best = l.topHeight - (l.roof?.thickness ?? 0.25) - (l.roof?.ceiling?.rise ?? 0);
  for (const s of l.slabs) {
    const bottom = levelElev(l, s.levelId) - s.thickness;
    if (bottom > from + 0.5 && bottom < best && pointInPolygon(p, s.polygon)) best = bottom;
  }
  return r2(best - from);
}

/** punto interior de un polígono (centroide si cae dentro; si no, el punto interior más próximo) */
function interiorPoint(poly: Vec2[]): Vec2 {
  const c = centroid(poly);
  if (pointInPolygon(c, poly, -1)) return c;
  const b = bbox(poly);
  let best: Vec2 | null = null;
  let bd = Infinity;
  const step = Math.max(0.05, Math.min(b.maxX - b.minX, b.maxY - b.minY) / 20);
  for (let x = b.minX + step / 2; x < b.maxX; x += step)
    for (let y = b.minY + step / 2; y < b.maxY; y += step) {
      if (!pointInPolygon([x, y], poly, -1)) continue;
      // se prefiere un punto alejado de los bordes y cercano al centroide
      let edge = Infinity;
      for (let i = 0; i < poly.length; i++) edge = Math.min(edge, distPointSegment([x, y], poly[i], poly[(i + 1) % poly.length]));
      const d = Math.hypot(x - c[0], y - c[1]) - Math.min(edge, 0.6) * 2;
      if (d < bd) { bd = d; best = [x, y]; }
    }
  return best ?? c;
}

/** normal hacia dentro de la arista i de un polígono */
function inwardNormal(poly: Vec2[], i: number): Vec2 {
  const a = poly[i];
  const b = poly[(i + 1) % poly.length];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const n: Vec2 = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L];
  const m: Vec2 = [(a[0] + b[0]) / 2 + n[0] * 0.05, (a[1] + b[1]) / 2 + n[1] * 0.05];
  return pointInPolygon(m, poly, -1) ? n : [-n[0], -n[1]];
}

interface WallSpot { p: Vec2; arc: number; inward: Vec2 }

/** muestras del perímetro de una estancia que caen sobre la cara de un muro, fuera de huecos */
function wallSpots(l: Layout, room: Room, ok: (p: Vec2, inward: Vec2) => boolean, step = 0.1, corner = 0.25): WallSpot[] {
  const out: WallSpot[] = [];
  const poly = room.polygon;
  let arc = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = inwardNormal(poly, i);
    for (let t = corner; t <= L - corner + 1e-9; t += step) {
      const p: Vec2 = [a[0] + ((b[0] - a[0]) * t) / L, a[1] + ((b[1] - a[1]) * t) / L];
      if (!wallFaceAt(l, p, room.levelId) || inOpening(l, p, room.levelId)) continue;
      if (!ok(p, n)) continue;
      out.push({ p, arc: arc + t, inward: n });
    }
    arc += L;
  }
  return out;
}

const perimeter = (poly: Vec2[]) => poly.reduce((s, p, i) => s + Math.hypot(poly[(i + 1) % poly.length][0] - p[0], poly[(i + 1) % poly.length][1] - p[1]), 0);

/** reparte k puntos a lo largo del perímetro, separados al menos `minGap` */
function spread(spots: WallSpot[], k: number, total: number, minGap = 0.8): WallSpot[] {
  const chosen: WallSpot[] = [];
  for (let i = 0; i < k; i++) {
    const target = (total * (i + 0.5)) / k;
    const cand = spots
      .filter((s) => chosen.every((c) => Math.hypot(c.p[0] - s.p[0], c.p[1] - s.p[1]) >= minGap))
      .sort((a, b) => Math.abs(a.arc - target) - Math.abs(b.arc - target))[0];
    if (cand) chosen.push(cand);
  }
  return chosen;
}

/** mueble: punto en coordenadas locales (lx a lo largo de w, ly hacia el frente; −d/2 = trasera) */
function local(f: Furniture, lx: number, ly: number): Vec2 {
  const r = (f.rot * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [f.x + lx * c - ly * s, f.y + lx * s + ly * c];
}

/** centro del módulo de cocina `kind` en coordenada local x, o null */
function moduleX(f: Furniture, kind: string): number | null {
  if (!f.modules?.length) return null;
  let acc = -f.w / 2;
  for (const m of f.modules) {
    if (m.kind === kind) return acc + m.w / 2;
    acc += m.w;
  }
  return null;
}

/** lado de un muro hacia una estancia del nivel (+1 / −1), o 0 si ninguno */
function roomSide(l: Layout, w: Wall, s: number, levelId: string): { side: 1 | -1; room: Room }[] {
  const out: { side: 1 | -1; room: Room }[] = [];
  for (const side of [1, -1] as const) {
    const r = roomAt(l, pointOnWall(w, s, side * (w.thickness / 2 + 0.15)), levelId);
    if (r) out.push({ side, room: r });
  }
  return out;
}

// ---------- generación ----------

interface Ctx {
  l: Layout;
  out: InstallPoint[];
}

function add(ctx: Ctx, p: Omit<InstallPoint, 'status' | 'circuit' | 'zone' | 'note'> & Partial<Pick<InstallPoint, 'status' | 'circuit' | 'zone' | 'note'>>) {
  let id = p.id;
  let k = 2;
  while (ctx.out.some((q) => q.id === id)) id = `${p.id}-${k++}`;
  ctx.out.push({
    circuit: '',
    zone: '',
    status: 'propuesto',
    note: nota(''),
    ...p,
    id,
    x: p.x === null ? null : r2(p.x),
    y: p.y === null ? null : r2(p.y),
    height: r2(p.height),
  });
}

const P = (layer: Layer, kind: InstallKind) => ({ layer, kind });

interface SwitchSpot { p: Vec2; room: Room; wall: Wall | null }

/** punto junto a una puerta, en la cara del muro hacia `side` */
function switchNearOpening(l: Layout, o: Opening, w: Wall, side: 1 | -1, room: Room): SwitchSpot | null {
  const t = w.thickness / 2;
  // lado de la manilla = el opuesto a la bisagra; sin bisagra, el final del hueco
  const free: 'inicio' | 'fin' = o.swing ? (o.swing.hinge === 'inicio' ? 'fin' : 'inicio') : 'fin';
  const sides: ('inicio' | 'fin')[] = [free, free === 'fin' ? 'inicio' : 'fin'];
  const valid = (p: Vec2) =>
    pointInPolygon(p, room.polygon, 0.02) && !!wallFaceAt(l, p, room.levelId) && !inOpening(l, p, room.levelId) && !blockedBy(l, p, room.levelId, (f) => TALL.has(f.type));
  for (const which of sides) {
    const jamb = which === 'fin' ? o.offset + o.width : o.offset;
    const sign = which === 'fin' ? 1 : -1;
    // 1) en el mismo muro, más allá de la jamba
    for (const d of [0.15, 0.3]) {
      const p = pointOnWall(w, jamb + sign * d, side * t);
      if (valid(p)) return { p, room, wall: w };
    }
    // 2) en el muro perpendicular, junto a la esquina más próxima a la jamba
    const J = pointOnWall(w, jamb, side * t);
    const poly = room.polygon;
    let vi = -1;
    let vd = Infinity;
    poly.forEach((v, i) => { const d = Math.hypot(v[0] - J[0], v[1] - J[1]); if (d < vd) { vd = d; vi = i; } });
    if (vi >= 0 && vd < 0.35) {
      const v = poly[vi];
      const wd = wallDir(w);
      for (const ni of [(vi + 1) % poly.length, (vi + poly.length - 1) % poly.length]) {
        const q = poly[ni];
        const L = Math.hypot(q[0] - v[0], q[1] - v[1]);
        if (L < 0.3) continue;
        const e: Vec2 = [(q[0] - v[0]) / L, (q[1] - v[1]) / L];
        if (Math.abs(e[0] * wd[0] + e[1] * wd[1]) > 0.5) continue; // paralelo al muro de la puerta
        const p: Vec2 = [v[0] + e[0] * 0.15, v[1] + e[1] * 0.15];
        if (valid(p)) return { p, room, wall: wallFaceAt(l, p, room.levelId)?.wall ?? null };
      }
    }
  }
  return null;
}

/** punto en la cara de un muro junto a un vértice de la estancia, moviéndose por las aristas */
function spotNearVertex(room: Room, v: Vec2, valid: (p: Vec2) => boolean): Vec2 | null {
  const poly = room.polygon;
  const vi = poly.findIndex((q) => Math.hypot(q[0] - v[0], q[1] - v[1]) < 1e-6);
  if (vi < 0) return null;
  for (const d of [0.15, 0.4]) {
    for (const ni of [(vi + 1) % poly.length, (vi + poly.length - 1) % poly.length]) {
      const q = poly[ni];
      const L = Math.hypot(q[0] - v[0], q[1] - v[1]);
      if (L < d + 0.1) continue;
      const p: Vec2 = [v[0] + ((q[0] - v[0]) * d) / L, v[1] + ((q[1] - v[1]) * d) / L];
      if (valid(p)) return p;
    }
  }
  return null;
}

/** tramo compartido entre dos estancias abiertas entre sí (sin muro) */
function sharedEdge(a: Room, b: Room): [Vec2, Vec2] | null {
  let best: [Vec2, Vec2] | null = null;
  let bestLen = 0;
  for (let i = 0; i < a.polygon.length; i++) {
    const p = a.polygon[i];
    const q = a.polygon[(i + 1) % a.polygon.length];
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (L < 1e-6) continue;
    const d: Vec2 = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
    for (let j = 0; j < b.polygon.length; j++) {
      const r = b.polygon[j];
      const s = b.polygon[(j + 1) % b.polygon.length];
      const off = (pt: Vec2) => Math.abs((pt[0] - p[0]) * -d[1] + (pt[1] - p[1]) * d[0]);
      if (off(r) > 0.02 || off(s) > 0.02) continue;
      const tr = (r[0] - p[0]) * d[0] + (r[1] - p[1]) * d[1];
      const ts = (s[0] - p[0]) * d[0] + (s[1] - p[1]) * d[1];
      const t0 = Math.max(0, Math.min(tr, ts));
      const t1 = Math.min(L, Math.max(tr, ts));
      if (t1 - t0 > bestLen + 1e-6) {
        bestLen = t1 - t0;
        best = [[p[0] + d[0] * t0, p[1] + d[1] * t0], [p[0] + d[0] * t1, p[1] + d[1] * t1]];
      }
    }
  }
  return bestLen > 0.3 ? best : null;
}

const isWet = (l: Layout, room: Room) => l.furniture.some((f) => f.roomId === room.id && (f.type === 'ducha' || f.type === 'banera' || f.type === 'inodoro'));

/**
 * Genera la propuesta de puntos de instalación para el Layout dado. Función pura.
 * Ningún punto sale como «validado por instalador».
 */
export function proposedPoints(layout: Layout): InstallPoint[] {
  const l = layout;
  const ctx: Ctx = { l, out: [] };
  const groundLevel = [...l.levels].sort((a, b) => a.elevation - b.elevation)[0]?.id ?? 'pb';
  const roomName = (id: string | null | undefined) => roomById(l, id)?.name ?? 'Exterior';

  // ---- referencias: entrada, zona de día, baño ----
  const wallOf = (o: Opening) => l.walls.find((w) => w.id === o.wallId);
  const extDoors = l.openings.filter((o) => o.kind === 'puerta' && wallOf(o)?.kind === 'exterior');
  const entrance = l.openings.find((o) => o.entrance) ?? extDoors[0];
  const entranceWall = entrance ? wallOf(entrance) : undefined;
  const entranceInside = entrance && entranceWall ? roomSide(l, entranceWall, entrance.offset + entrance.width / 2, entranceWall.levelId)[0] : undefined;
  const encimeras = l.furniture.filter((f) => f.type === 'encimera');
  const dayRoom = roomById(l, encimeras[0]?.roomId) ?? entranceInside?.room ?? [...roomsAt(l, groundLevel)].sort((a, b) => polygonArea(b.polygon) - polygonArea(a.polygon))[0];
  const duchas = l.furniture.filter((f) => f.type === 'ducha').sort((a, b) => a.id.localeCompare(b.id));
  const bathRoom = roomById(l, duchas[0]?.roomId) ?? roomById(l, l.furniture.find((f) => f.type === 'inodoro')?.roomId) ?? l.rooms.find((r) => /ba[ñn]o/i.test(r.id + r.name));
  const corridor = l.rooms.find((r) => /pasillo/i.test(r.id + r.name) && r.id !== bathRoom?.id);
  const bedRooms = l.rooms.filter((r) => l.furniture.some((f) => f.type === 'cama' && f.roomId === r.id));

  // ================= ELECTRICIDAD =================
  // --- iluminación ---
  const lampRooms = new Set<string>();
  for (const f of l.furniture.filter((x) => x.type === 'aplique')) {
    const lv = furnitureLevel(l, f);
    lampRooms.add(f.roomId);
    add(ctx, { id: `elec-luz-${f.id}`, ...P('electricidad', 'luz'), label: `${f.label} (${roomName(f.roomId).toLowerCase()})`, roomId: roomById(l, f.roomId) ? f.roomId : null, levelId: lv, x: f.x, y: f.y, height: f.h, circuit: 'C1 · alumbrado (propuesto)', zone: roomName(f.roomId), note: nota('Punto de luz para el aplique dibujado en el modelo.') });
  }
  const group = (l.pendants ?? []).find((g) => g.location === l.options.lamparasUbicacion);
  if (group) {
    group.points.forEach((pt, i) => {
      const lv = groundLevel;
      const room = roomAt(l, pt, lv);
      if (room) lampRooms.add(room.id);
      add(ctx, { id: `elec-luz-${group.id}-${i + 1}`, ...P('electricidad', 'luz'), label: `Colgante ${i + 1} · ${group.label.toLowerCase()}`, roomId: room?.id ?? null, levelId: lv, x: pt[0], y: pt[1], height: ceilingAt(l, pt, lv), circuit: 'C1 · alumbrado (propuesto)', zone: room?.name ?? '', note: nota(`Caja de techo para la lámpara colgante en su ubicación activa («${group.label}»); parte baja de la lámpara a ${group.bottom.toFixed(2).replace('.', ',')} m. La ubicación de las colgantes aún no está elegida.`) });
    });
  }
  for (const room of l.rooms) {
    if (lampRooms.has(room.id)) continue;
    const p = interiorPoint(room.polygon);
    add(ctx, { id: `elec-luz-${room.id}-techo`, ...P('electricidad', 'luz'), label: `Luz de techo · ${room.name.toLowerCase()}`, roomId: room.id, levelId: room.levelId, x: p[0], y: p[1], height: ceilingAt(l, p, room.levelId), circuit: 'C1 · alumbrado (propuesto)', zone: room.name, note: nota('Punto de techo en una estancia sin lámpara dibujada; tipo de luminaria por decidir.') });
  }
  if (entrance && entranceWall && entranceInside) {
    const outSide = -entranceInside.side as 1 | -1;
    const freeEnd = entrance.swing?.hinge === 'fin' ? entrance.offset : entrance.offset + entrance.width;
    const sign = entrance.swing?.hinge === 'fin' ? -1 : 1;
    const p = pointOnWall(entranceWall, freeEnd + sign * 0.35, outSide * (entranceWall.thickness / 2));
    add(ctx, { id: 'elec-luz-exterior-entrada', ...P('electricidad', 'luz'), label: 'Luz exterior junto a la puerta de entrada', roomId: null, levelId: entranceWall.levelId, x: p[0], y: p[1], height: Math.min(2.2, entrance.sill + entrance.height - 0.2), circuit: 'C1 · alumbrado (propuesto)', zone: 'Fachada de la entrada', note: nota('Aplique exterior en la fachada de la entrada, del lado de la manilla.') });
  }
  if (l.outdoor) {
    const lights = l.outdoor.lights;
    if (lights.length) {
      for (const lt of lights) add(ctx, { id: `elec-luz-${lt.id}`, ...P('electricidad', 'luz'), label: 'Luz del comedor exterior', roomId: null, levelId: groundLevel, x: lt.c[0], y: lt.c[1], height: lt.h, circuit: 'Alumbrado exterior (propuesto)', zone: 'Comedor del algarrobo', note: nota('Alimentación del farol dibujado en el comedor exterior; canalización enterrada por definir.') });
    } else if (l.outdoor.pavements.length) {
      const [x0, y0] = l.outdoor.pavements[l.outdoor.pavements.length - 1].rect;
      add(ctx, { id: 'elec-luz-comedor-exterior', ...P('electricidad', 'luz'), label: 'Luz del comedor exterior', roomId: null, levelId: groundLevel, x: x0 + 0.3, y: y0 + 0.3, height: 2.3, circuit: 'Alumbrado exterior (propuesto)', zone: 'Comedor del algarrobo', note: nota('Punto de luz en el comedor exterior.') });
    }
  }

  // --- interruptores ---
  const switches: { id: string; spot: SwitchSpot; controls: Room }[] = [];
  const controlled = new Set<string>();
  const orderedOpenings = [
    ...(entrance ? [entrance] : []),
    ...l.openings.filter((o) => o !== entrance && (o.kind === 'puerta' || o.kind === 'paso') && wallOf(o)?.kind === 'tabique'),
    ...l.openings.filter((o) => o !== entrance && o.kind === 'puerta' && wallOf(o)?.kind === 'exterior'),
  ];
  for (const o of orderedOpenings) {
    const w = wallOf(o);
    if (!w) continue;
    const sides = roomSide(l, w, o.offset + o.width / 2, w.levelId);
    if (!sides.length) continue;
    let target = sides[0];
    let controls = sides[0].room;
    if (sides.length === 2) {
      const [a, b] = sides;
      const small = polygonArea(a.room.polygon) <= polygonArea(b.room.polygon) ? a : b;
      const big = small === a ? b : a;
      if (o.kind === 'paso') target = big; // hueco sin puerta (armario): mando desde fuera
      else if (o.swing) target = sides.find((s) => s.side === o.swing!.dir) ?? small;
      else target = small;
      // controla la estancia a la que se entra: hacia donde abre la hoja o, si no, la más pequeña
      controls = o.kind === 'paso' ? small.room : target.room;
    }
    const spot = switchNearOpening(l, o, w, target.side, target.room);
    if (!spot) continue;
    const id = `elec-int-${controls.id}-${o.id}`;
    switches.push({ id, spot, controls });
    controlled.add(controls.id);
    add(ctx, { id, ...P('electricidad', 'interruptor'), label: `Interruptor · ${controls.name.toLowerCase()} (${o.label.toLowerCase()})`, roomId: spot.room.id, levelId: spot.room.levelId, x: spot.p[0], y: spot.p[1], height: 1.1, circuit: 'C1 · alumbrado (propuesto)', zone: controls.name, note: nota(`Junto a «${o.label}», en la cara interior del muro${o.swing ? ', del lado de la manilla' : ''}.`) });
  }
  // estancias sin puerta propia: junto al paso abierto o a la llegada de la escalera
  for (const room of l.rooms) {
    if (controlled.has(room.id)) continue;
    const valid = (p: Vec2) => pointInPolygon(p, room.polygon, 0.02) && !!wallFaceAt(l, p, room.levelId) && !inOpening(l, p, room.levelId) && !blockedBy(l, p, room.levelId, (f) => TALL.has(f.type));
    let p: Vec2 | null = null;
    let why = '';
    for (const nid of room.openTo ?? []) {
      const n = roomById(l, nid);
      if (!n || n.levelId !== room.levelId) continue;
      const seg = sharedEdge(room, n);
      if (!seg) continue;
      const [A, B] = seg;
      const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
      const d: Vec2 = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
      // más allá del extremo del paso, donde continúa el muro
      for (const c of [[B[0] + d[0] * 0.15, B[1] + d[1] * 0.15], [A[0] - d[0] * 0.15, A[1] - d[1] * 0.15]] as Vec2[]) if (!p && valid(c)) p = c;
      // en el muro perpendicular junto al extremo del paso
      for (const v of [B, A]) if (!p) p = spotNearVertex(room, v, valid);
      if (p) { why = `Junto al paso abierto hacia «${n.name}».`; break; }
    }
    if (!p) {
      const st = l.stairs.find((s) => s.toLevel === room.levelId);
      if (st) {
        const [x0, y0, x1, y1] = st.rect;
        const meseta = st.u ? uStairPieces(st, 1).find((pc) => pc.kind === 'meseta') : undefined;
        const top: Vec2 = meseta ? [meseta.rect[0], (meseta.rect[1] + meseta.rect[3]) / 2] : st.up === '+y' ? [(x0 + x1) / 2, y1] : st.up === '-y' ? [(x0 + x1) / 2, y0] : st.up === '+x' ? [x1, (y0 + y1) / 2] : [x0, (y0 + y1) / 2];
        const v = [...room.polygon].sort((a, b) => Math.hypot(a[0] - top[0], a[1] - top[1]) - Math.hypot(b[0] - top[0], b[1] - top[1]))[0];
        p = spotNearVertex(room, v, valid);
        if (p) why = 'Junto a la llegada de la escalera.';
      }
    }
    if (!p) {
      const spots = wallSpots(l, room, (q) => !blockedBy(l, q, room.levelId, (f) => TALL.has(f.type)));
      if (spots.length) { p = spots[0].p; why = 'En el primer tramo de muro libre de la estancia.'; }
    }
    if (!p) continue;
    const id = `elec-int-${room.id}`;
    switches.push({ id, spot: { p, room, wall: wallFaceAt(l, p, room.levelId)?.wall ?? null }, controls: room });
    controlled.add(room.id);
    add(ctx, { id, ...P('electricidad', 'interruptor'), label: `Interruptor · ${room.name.toLowerCase()}`, roomId: room.id, levelId: room.levelId, x: p[0], y: p[1], height: 1.1, circuit: 'C1 · alumbrado (propuesto)', zone: room.name, note: nota(why) });
  }
  // salón: mando propio en la zona de estar (junto a la mesa o el sofá)
  const salonRef = dayRoom && l.furniture.find((f) => f.roomId === dayRoom.id && (f.type === 'mesa-centro' || f.type === 'sofa-l' || f.type === 'sofa'));
  if (dayRoom && salonRef) {
    const spots = wallSpots(l, dayRoom, (q, n) => !blockedBy(l, [q[0] + n[0] * 0.15, q[1] + n[1] * 0.15], dayRoom.levelId, (f) => !LIGHT_PIECES.has(f.type)));
    const taken = switches.map((s) => s.spot.p);
    const best = spots
      .filter((s) => taken.every((t) => Math.hypot(t[0] - s.p[0], t[1] - s.p[1]) > 1))
      .sort((a, b) => Math.hypot(a.p[0] - salonRef.x, a.p[1] - salonRef.y) - Math.hypot(b.p[0] - salonRef.x, b.p[1] - salonRef.y))[0];
    if (best) {
      switches.push({ id: 'elec-int-salon', spot: { p: best.p, room: dayRoom, wall: wallFaceAt(l, best.p, dayRoom.levelId)?.wall ?? null }, controls: dayRoom });
      add(ctx, { id: 'elec-int-salon', ...P('electricidad', 'interruptor'), label: 'Interruptor · zona de estar (salón)', roomId: dayRoom.id, levelId: dayRoom.levelId, x: best.p[0], y: best.p[1], height: 1.1, circuit: 'C1 · alumbrado (propuesto)', zone: 'Salón', note: nota('Mando de la zona de estar, en el muro libre más próximo al sofá y la mesa.') });
    }
  }

  // --- enchufes ---
  for (const room of l.rooms) {
    const area = polygonArea(room.polygon);
    if (area < 2 || isWet(l, room)) continue; // armarios y baños: solo los enchufes específicos
    const k = area < 6 ? 2 : area < 15 ? 3 : 4;
    const spots = wallSpots(l, room, (q, n) => !blockedBy(l, [q[0] + n[0] * 0.15, q[1] + n[1] * 0.15], room.levelId, (f) => !LIGHT_PIECES.has(f.type)));
    spread(spots, k, perimeter(room.polygon)).forEach((s, i) => {
      add(ctx, { id: `elec-enchufe-${room.id}-${i + 1}`, ...P('electricidad', 'enchufe'), label: `Enchufe ${i + 1} · ${room.name.toLowerCase()}`, roomId: room.id, levelId: room.levelId, x: s.p[0], y: s.p[1], height: 0.3, circuit: 'C2 · tomas de uso general (propuesto)', zone: room.name, note: nota('Toma de uso general a 0,30 m, repartida por el perímetro libre de la estancia.') });
    });
  }
  for (const f of encimeras) {
    const lv = furnitureLevel(l, f);
    [-0.25, 0.25].forEach((fr, i) => {
      const p = local(f, f.w * fr, -f.d / 2);
      add(ctx, { id: `elec-enchufe-${f.id}-${i + 1}`, ...P('electricidad', 'enchufe'), label: `Enchufe sobre la encimera ${i + 1}`, roomId: roomById(l, f.roomId) ? f.roomId : null, levelId: lv, x: p[0], y: p[1], height: 1.1, circuit: 'C5 · cocina y baño (propuesto)', zone: roomName(f.roomId), note: nota('Toma sobre la encimera, a 1,10 m, en el frente de trabajo.') });
    });
  }
  for (const f of l.furniture.filter((x) => x.type === 'lavabo')) {
    const p = local(f, f.w / 2 - 0.15, -f.d / 2);
    add(ctx, { id: `elec-enchufe-${f.id}`, ...P('electricidad', 'enchufe'), label: 'Enchufe junto al lavabo', roomId: roomById(l, f.roomId) ? f.roomId : null, levelId: furnitureLevel(l, f), x: p[0], y: p[1], height: 1.1, circuit: 'C5 · cocina y baño (propuesto)', zone: roomName(f.roomId), note: nota('Toma junto al lavabo, a 1,10 m; respetar los volúmenes de protección del baño (REBT ITC-BT-27).') });
  }
  for (const f of l.furniture.filter((x) => x.type === 'cama')) {
    [-1, 1].forEach((sg, i) => {
      const p = local(f, sg * (f.w / 2 + 0.22), -f.d / 2);
      add(ctx, { id: `elec-enchufe-${f.id}-${i + 1}`, ...P('electricidad', 'enchufe'), label: `Enchufe junto a la cama ${i + 1}`, roomId: roomById(l, f.roomId) ? f.roomId : null, levelId: furnitureLevel(l, f), x: p[0], y: p[1], height: 0.7, circuit: 'C2 · tomas de uso general (propuesto)', zone: roomName(f.roomId), note: nota('Toma a cada lado del cabecero, sobre la mesita (0,70 m).') });
    });
  }

  // --- cuadro eléctrico, central Ajax y actuadores KNX ---
  const entranceSwitch = entrance ? switches.find((s) => s.id.endsWith(`-${entrance.id}`)) : undefined;
  let panel: { p: Vec2; room: Room } | null = null;
  let hub: Vec2 | null = null;
  if (entranceSwitch?.spot.wall && entranceSwitch.spot.wall.id === entranceWall?.id && entrance && entranceInside) {
    const w = entranceSwitch.spot.wall;
    const d = wallDir(w);
    const s0 = (entranceSwitch.spot.p[0] - w.a[0]) * d[0] + (entranceSwitch.spot.p[1] - w.a[1]) * d[1];
    const away = s0 >= entrance.offset + entrance.width / 2 ? 1 : -1;
    const room = entranceInside.room;
    const okAt = (s: number) => {
      const p = pointOnWall(w, s, entranceInside.side * (w.thickness / 2));
      return pointInPolygon(p, room.polygon, 0.02) && !inOpening(l, p, room.levelId) ? p : null;
    };
    for (const ds of [0.45, 0.6, 0.8]) { const p = okAt(s0 + away * ds); if (p) { panel = { p, room }; hub = okAt(s0 + away * (ds + 0.35)); break; } }
  }
  if (!panel && dayRoom) {
    const spots = wallSpots(l, dayRoom, (q, n) => !blockedBy(l, [q[0] + n[0] * 0.15, q[1] + n[1] * 0.15], dayRoom.levelId, (f) => TALL.has(f.type)));
    if (spots.length) { panel = { p: spots[0].p, room: dayRoom }; hub = spots[Math.min(3, spots.length - 1)].p; }
  }
  if (panel) {
    add(ctx, { id: 'elec-cuadro', ...P('electricidad', 'cuadro'), label: 'Cuadro general de mando y protección', roomId: panel.room.id, levelId: panel.room.levelId, x: panel.p[0], y: panel.p[1], height: 1.6, circuit: '', zone: panel.room.name, note: nota('Junto a la puerta de entrada, en el interior, a 1,60 m (ubicación propuesta; acometida y derivación individual por confirmar).') });
    add(ctx, { id: 'knx-actuadores-cuadro', ...P('knx', 'knx-actuador'), label: 'Actuadores KNX (en el cuadro)', roomId: panel.room.id, levelId: panel.room.levelId, x: panel.p[0], y: panel.p[1], height: 1.6, circuit: 'Línea KNX 1 (propuesta)', zone: panel.room.name, note: nota('Actuadores de iluminación y persianas en carril DIN dentro del cuadro; número de canales por definir.') });
    const h = hub ?? panel.p;
    add(ctx, { id: 'ajax-hub', ...P('ajax', 'ajax-hub'), label: 'Central Ajax (hub)', roomId: panel.room.id, levelId: panel.room.levelId, x: h[0], y: h[1], height: 1.6, circuit: '', zone: panel.room.name, note: nota('Junto al cuadro, con alimentación y conexión de red.') });
  }

  // ================= KNX =================
  const mainSwitch = (room: Room | undefined) => (room ? switches.find((s) => s.controls.id === room.id && s.id !== 'elec-int-salon') : undefined);
  const knxTargets: { key: string; label: string; sw: (typeof switches)[number] | undefined }[] = [
    { key: 'entrada', label: 'entrada', sw: entranceSwitch },
    ...bedRooms.map((r) => ({ key: r.id, label: r.name.toLowerCase(), sw: mainSwitch(r) })),
    ...(bathRoom ? [{ key: bathRoom.id, label: bathRoom.name.toLowerCase(), sw: mainSwitch(bathRoom) }] : []),
    { key: 'salon', label: 'salón', sw: switches.find((s) => s.id === 'elec-int-salon') },
  ];
  const usedSw = new Set<string>();
  for (const t of knxTargets) {
    if (!t.sw || usedSw.has(t.sw.id)) continue;
    usedSw.add(t.sw.id);
    const { p, room } = t.sw.spot;
    add(ctx, { id: `knx-pulsador-${t.key}`, ...P('knx', 'knx-pulsador'), label: `Pulsador KNX · ${t.label}`, roomId: room.id, levelId: room.levelId, x: p[0], y: p[1], height: 1.1, circuit: 'Línea KNX 1 (propuesta)', zone: t.sw.controls.id === dayRoom?.id && t.key === 'salon' ? 'Salón' : t.sw.controls.name, note: nota(`Junto al interruptor «${t.sw.id}» (o en su lugar, si se decide KNX).`) });
  }
  if (bathRoom) {
    const ref = interiorPoint(bathRoom.polygon);
    add(ctx, { id: `knx-presencia-${bathRoom.id}`, ...P('knx', 'knx-sensor'), label: `Sensor de presencia KNX · ${bathRoom.name.toLowerCase()}`, roomId: bathRoom.id, levelId: bathRoom.levelId, x: ref[0], y: ref[1], height: ceilingAt(l, ref, bathRoom.levelId), circuit: 'Línea KNX 1 (propuesta)', zone: bathRoom.name, note: nota('Detector de presencia en techo para encendido de luz y extracción.') });
  }

  // ================= AJAX =================
  const cornerDetector = (room: Room, id: string, label: string, awayFrom: Vec2) => {
    const verts = room.polygon.filter((v) => wallFaceAt(l, v, room.levelId, 0.04));
    const v = [...(verts.length ? verts : room.polygon)].sort((a, b) => Math.hypot(b[0] - awayFrom[0], b[1] - awayFrom[1]) - Math.hypot(a[0] - awayFrom[0], a[1] - awayFrom[1]))[0];
    if (!v) return;
    const c = centroid(room.polygon);
    const L = Math.hypot(c[0] - v[0], c[1] - v[1]) || 1;
    const p: Vec2 = [v[0] + ((c[0] - v[0]) / L) * 0.1, v[1] + ((c[1] - v[1]) / L) * 0.1];
    add(ctx, { id, ...P('ajax', 'ajax-movimiento'), label, roomId: room.id, levelId: room.levelId, x: p[0], y: p[1], height: 2.2, circuit: '', zone: room.name, note: nota('Detector en esquina, orientado hacia los accesos.') });
  };
  if (dayRoom) {
    const ref = entrance && entranceWall ? pointOnWall(entranceWall, entrance.offset + entrance.width / 2) : centroid(dayRoom.polygon);
    cornerDetector(dayRoom, `ajax-movimiento-${dayRoom.id}`, `Detector de movimiento · ${dayRoom.name.toLowerCase()}`, ref);
  }
  if (corridor) {
    const ref = dayRoom ? centroid(dayRoom.polygon) : centroid(corridor.polygon);
    cornerDetector(corridor, `ajax-movimiento-${corridor.id}`, `Detector de movimiento · ${corridor.name.toLowerCase()}`, ref);
  }
  for (const o of [...(entrance ? [entrance] : []), ...extDoors.filter((x) => x !== entrance)]) {
    const w = wallOf(o);
    if (!w) continue;
    const inside = roomSide(l, w, o.offset + o.width / 2, w.levelId)[0];
    if (!inside) continue;
    const freeEnd = o.swing?.hinge === 'fin' ? o.offset + 0.1 : o.offset + o.width - 0.1;
    const p = pointOnWall(w, freeEnd, inside.side * (w.thickness / 2));
    add(ctx, { id: `ajax-contacto-${o.id}`, ...P('ajax', 'ajax-contacto'), label: `Contacto de apertura · ${o.label.toLowerCase()}`, roomId: inside.room.id, levelId: inside.room.levelId, x: p[0], y: p[1], height: Math.max(0.3, o.sill + o.height - 0.05), circuit: '', zone: inside.room.name, note: nota('Contacto magnético en la parte alta de la hoja, lado de cierre.') });
  }
  if (entrance && entranceWall && entranceInside) {
    const outSide = -entranceInside.side as 1 | -1;
    const hingeEnd = entrance.swing?.hinge === 'fin' ? entrance.offset + entrance.width : entrance.offset;
    const sign = entrance.swing?.hinge === 'fin' ? 1 : -1;
    const s = Math.min(Math.max(hingeEnd + sign * 0.6, 0.3), wallLength(entranceWall) - 0.3);
    const p = pointOnWall(entranceWall, s, outSide * (entranceWall.thickness / 2));
    add(ctx, { id: 'ajax-sirena-exterior', ...P('ajax', 'ajax-sirena'), label: 'Sirena exterior · fachada de la entrada', roomId: null, levelId: entranceWall.levelId, x: p[0], y: p[1], height: Math.min(entranceWall.height - 0.3, Math.max(2.6, entrance.sill + entrance.height + 0.2)), circuit: '', zone: 'Fachada de la entrada', note: nota('Sirena en la fachada de la entrada, por encima de la puerta y fuera del alcance.') });
  }

  // ================= AUDIO =================
  if (dayRoom) {
    const b = bbox(dayRoom.polygon);
    const alongX = b.maxX - b.minX >= b.maxY - b.minY;
    [1 / 3, 2 / 3].forEach((fr, i) => {
      let p: Vec2 = alongX ? [b.minX + (b.maxX - b.minX) * fr, (b.minY + b.maxY) / 2] : [(b.minX + b.maxX) / 2, b.minY + (b.maxY - b.minY) * fr];
      if (!pointInPolygon(p, dayRoom.polygon, -1)) p = interiorPoint(dayRoom.polygon);
      add(ctx, { id: `audio-interior-${i + 1}`, ...P('audio', 'altavoz'), label: `Altavoz de techo ${i + 1} · zona de día`, roomId: dayRoom.id, levelId: dayRoom.levelId, x: p[0], y: p[1], height: ceilingAt(l, p, dayRoom.levelId), circuit: '', zone: 'Interior', note: nota('Altavoz empotrado en techo, zona «interior». Si el techo es de doble altura o de volta, valorar altavoces de pared.') });
    });
  }
  if (entrance && entranceWall && entranceInside) {
    const outSide = -entranceInside.side as 1 | -1;
    const mid = entrance.offset + entrance.width / 2;
    const L = wallLength(entranceWall);
    [-1, 1].forEach((sg, i) => {
      let s = mid + sg * 1.8;
      for (let k = 0; k < 10; k++) {
        const p = pointOnWall(entranceWall, s, outSide * (entranceWall.thickness / 2));
        if (!inOpening(l, p, entranceWall.levelId, 0.2) && s > 0.3 && s < L - 0.3) break;
        s += sg * 0.3;
      }
      s = Math.min(Math.max(s, 0.3), L - 0.3);
      const p = pointOnWall(entranceWall, s, outSide * (entranceWall.thickness / 2));
      add(ctx, { id: `audio-terraza-${i + 1}`, ...P('audio', 'altavoz'), label: `Altavoz exterior ${i + 1} · terraza delantera`, roomId: null, levelId: entranceWall.levelId, x: p[0], y: p[1], height: 2.4, circuit: '', zone: 'Terraza delantera', note: nota('Altavoz de exterior en la fachada delantera (la de la puerta de entrada), a 2,40 m.') });
    });
  }
  if (l.outdoor?.pavements.length) {
    const pav = [...l.outdoor.pavements].sort((a, b) => (a.rect[2] - a.rect[0]) * (a.rect[3] - a.rect[1]) - (b.rect[2] - b.rect[0]) * (b.rect[3] - b.rect[1]))[0];
    const [x0, y0, x1, y1] = pav.rect;
    const pts: Vec2[] = [[x0 + 0.3, y1 - 0.3], [x1 - 0.3, y0 + 0.3]];
    pts.forEach((p, i) => add(ctx, { id: `audio-algarrobo-${i + 1}`, ...P('audio', 'altavoz'), label: `Altavoz exterior ${i + 1} · comedor del algarrobo`, roomId: null, levelId: groundLevel, x: p[0], y: p[1], height: 0.5, circuit: '', zone: 'Comedor del algarrobo', note: nota('Altavoz de jardín sobre estaca en esquinas opuestas del comedor exterior; canalización enterrada por definir.') }));
  }

  // ================= AGUA, SANEAMIENTO, VENTILACIÓN =================
  const water = (f: Furniture, key: string, lx: number, what: string, tomaH: number, desH: number, desAtFloor = false) => {
    const lv = furnitureLevel(l, f);
    const roomId = roomById(l, f.roomId) ? f.roomId : null;
    const t = local(f, lx - 0.08, -f.d / 2);
    add(ctx, { id: `agua-toma-${key}`, ...P('agua', 'toma-agua'), label: `Toma de agua · ${what}`, roomId, levelId: lv, x: t[0], y: t[1], height: tomaH, circuit: '', zone: roomName(f.roomId), note: nota(`Toma de agua fría${what.includes('lavavajillas') || what.includes('inodoro') ? '' : ' y caliente'} para ${what}.`) });
    const d = desAtFloor ? local(f, lx, -f.d / 2 + 0.25) : local(f, lx + 0.08, -f.d / 2);
    add(ctx, { id: `agua-desague-${key}`, ...P('agua', 'desague'), label: `Desagüe · ${what}`, roomId, levelId: lv, x: d[0], y: d[1], height: desH, circuit: '', zone: roomName(f.roomId), note: nota(`Desagüe de ${what}; trazado y pendientes por definir.`) });
  };
  for (const f of encimeras) {
    const fx = moduleX(f, 'fregadero');
    water(f, encimeras.length > 1 ? `fregadero-${f.id}` : 'fregadero', fx ?? 0, 'fregadero', 0.55, 0.45);
    const lx = moduleX(f, 'lavavajillas');
    if (lx !== null) water(f, encimeras.length > 1 ? `lavavajillas-${f.id}` : 'lavavajillas', lx, 'lavavajillas', 0.4, 0.4);
  }
  for (const f of l.furniture.filter((x) => x.type === 'lavabo')) water(f, f.id, 0, 'lavabo', 0.55, 0.45);
  for (const f of l.furniture.filter((x) => x.type === 'inodoro')) water(f, f.id, 0, 'inodoro', 0.2, 0, true);

  // duchas enfrentadas: un rociador y un mando por ducha, en paredes opuestas
  const showerPts: { key: string; f: Furniture; head: Vec2; valve: Vec2; drain: Vec2; where: string }[] = [];
  if (duchas.length === 1) {
    const f = duchas[0];
    const longX = f.w >= f.d;
    const half = (longX ? f.w : f.d) / 2 - 0.03;
    [-1, 1].forEach((sg, i) => {
      const head = longX ? local(f, sg * half, 0) : local(f, 0, sg * half);
      const valve = longX ? local(f, sg * half, -Math.min(0.25, f.d / 2 - 0.05)) : local(f, -Math.min(0.25, f.w / 2 - 0.05), sg * half);
      const drain = longX ? local(f, (sg * f.w) / 4, 0) : local(f, 0, (sg * f.d) / 4);
      showerPts.push({ key: `ducha-${i + 1}`, f, head, valve, drain, where: `extremo ${i === 0 ? 'inicial' : 'final'} del lado largo de «${f.label}»` });
    });
  } else {
    duchas.forEach((f, i) => {
      const lv = furnitureLevel(l, f);
      const fp = furnitureFootprint(f);
      let best: { mid: Vec2; a: Vec2; b: Vec2; d: number } | null = null;
      for (let k = 0; k < 4; k++) {
        const a = fp[k];
        const b = fp[(k + 1) % 4];
        const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        let d = Infinity;
        for (const w of wallsAt(l, lv)) d = Math.min(d, distPointSegment(mid, w.a, w.b) - w.thickness / 2);
        if (!best || d < best.d) best = { mid, a, b, d };
      }
      if (!best) return;
      const e: Vec2 = [best.b[0] - best.a[0], best.b[1] - best.a[1]];
      const L = Math.hypot(e[0], e[1]) || 1;
      const off = Math.min(0.25, L / 2 - 0.05);
      const valve: Vec2 = [best.mid[0] + (e[0] / L) * off, best.mid[1] + (e[1] / L) * off];
      showerPts.push({ key: `ducha-${i + 1}`, f, head: best.mid, valve, drain: [f.x, f.y], where: `muro más próximo a «${f.label}»` });
    });
  }
  for (const s of showerPts) {
    const lv = furnitureLevel(l, s.f);
    const roomId = roomById(l, s.f.roomId) ? s.f.roomId : null;
    const zone = roomName(s.f.roomId);
    const n = s.key.split('-').pop();
    add(ctx, { id: `agua-rociador-${s.key}`, ...P('agua', 'rociador'), label: `Rociador · ducha ${n}`, roomId, levelId: lv, x: s.head[0], y: s.head[1], height: 2.1, circuit: '', zone, note: nota(`Dos duchas enfrentadas: rociador en el ${s.where}, frente al de la otra ducha.`) });
    add(ctx, { id: `agua-mando-${s.key}`, ...P('agua', 'mando-ducha'), label: `Mando · ducha ${n}`, roomId, levelId: lv, x: s.valve[0], y: s.valve[1], height: 1.1, circuit: '', zone, note: nota('Mezclador empotrado junto a su rociador, a 1,10 m.') });
    add(ctx, { id: `agua-desague-${s.key}`, ...P('agua', 'desague'), label: `Desagüe · ducha ${n}`, roomId, levelId: lv, x: s.drain[0], y: s.drain[1], height: 0, circuit: '', zone, note: nota('Sumidero en el suelo de la ducha; tipo (puntual o lineal) y pendientes por definir.') });
  }
  if (bathRoom) {
    const c = interiorPoint(bathRoom.polygon);
    const wet = duchas.length ? (() => { const fs = duchas.filter((f) => f.roomId === bathRoom.id); return fs.length ? ([fs.reduce((s, f) => s + f.x, 0) / fs.length, fs.reduce((s, f) => s + f.y, 0) / fs.length] as Vec2) : c; })() : c;
    let p: Vec2 = [(wet[0] + c[0]) / 2, (wet[1] + c[1]) / 2];
    if (!pointInPolygon(p, bathRoom.polygon, -1)) p = c;
    add(ctx, { id: `agua-extraccion-${bathRoom.id}`, ...P('agua', 'extraccion'), label: `Extracción mecánica · ${bathRoom.name.toLowerCase()}`, roomId: bathRoom.id, levelId: bathRoom.levelId, x: p[0], y: p[1], height: ceilingAt(l, p, bathRoom.levelId), circuit: '', zone: bathRoom.name, note: nota('Boca de extracción en techo junto a la zona húmeda; conducto y salida a fachada o cubierta por definir.') });
  }

  // ================= BODEGA =================
  add(ctx, { id: 'bodega-sensor-th', ...P('bodega', 'sensor-th'), label: 'Sensor de temperatura y humedad · pequeña bodega', roomId: null, levelId: groundLevel, x: null, y: null, height: 1.5, circuit: '', zone: 'Pequeña bodega', status: 'pendiente', note: 'Ubicación de la pequeña bodega no identificada en el plano. Altura propuesta a confirmar. Propuesta pendiente de validación por el instalador; no es un dispositivo contratado.' });

  return ctx.out;
}
