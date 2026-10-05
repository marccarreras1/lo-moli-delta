/**
 * Validaciones del modelo. Detectan errores evidentes y conflictos sin
 * corregir nada automáticamente: la geometría no se deforma para "encajar".
 */
import type { Layout, Vec2, Wall } from '../data/types';
import {
  bbox, distPointSegment, doorSwing, pointOnWall, fmtM, wallDir, furnitureFootprint, isSelfIntersecting, overlapArea, pointInPolygon, polygonArea, wallLength,
} from './geometry';

export type IssueLevel = 'error' | 'conflicto' | 'aviso';

export interface Issue {
  level: IssueLevel;
  elementId: string;
  message: string;
}

export function validateLayout(layout: Layout): Issue[] {
  const issues: Issue[] = [];
  const add = (level: IssueLevel, elementId: string, message: string) => issues.push({ level, elementId, message });
  const wallById = new Map(layout.walls.map((w) => [w.id, w]));

  // Dimensiones básicas
  for (const w of layout.walls) {
    if (!(wallLength(w) > 0)) add('error', w.id, `El muro ${w.id} tiene longitud nula o negativa.`);
    if (!(w.thickness > 0)) add('error', w.id, `El muro ${w.id} tiene espesor no positivo.`);
    if (!(w.height > 0)) add('error', w.id, `El muro ${w.id} tiene altura no positiva.`);
  }

  // Huecos
  for (const o of layout.openings) {
    const w = wallById.get(o.wallId);
    if (!w) {
      add('error', o.id, `${o.label}: el muro ${o.wallId} no existe.`);
      continue;
    }
    if (!(o.width > 0) || !(o.height > 0)) add('error', o.id, `${o.label}: dimensiones no positivas.`);
    const L = wallLength(w);
    // la parte libre empieza tras el medio espesor de los muros perpendiculares que llegan a cada extremo
    const minS = endHalf(w, w.a, layout.walls);
    const maxS = L - endHalf(w, w.b, layout.walls);
    if (o.offset < minS - 1e-6 || o.offset + o.width > maxS + 1e-6)
      add('error', o.id, `${o.label}: el hueco sale de su muro (${fmtM(o.offset)}–${fmtM(o.offset + o.width)} m sobre ${fmtM(L)} m).`);
    if (o.sill < 0 || o.sill + o.height > w.height + 1e-6)
      add('error', o.id, `${o.label}: la altura del hueco (${fmtM(o.sill + o.height)} m) supera la del muro (${fmtM(w.height)} m).`);
  }
  // Solapes entre huecos del mismo muro
  for (const w of layout.walls) {
    const ops = layout.openings.filter((o) => o.wallId === w.id).sort((a, b) => a.offset - b.offset);
    for (let i = 0; i < ops.length; i++)
      for (let j = i + 1; j < ops.length; j++) {
        const a = ops[i];
        const b = ops[j];
        const vertical = b.sill < a.sill + a.height - 1e-6 && a.sill < b.sill + b.height - 1e-6;
        if (vertical && b.offset < a.offset + a.width - 1e-6 && a.offset < b.offset + b.width - 1e-6)
          add('conflicto', b.id, `${b.label} se solapa con ${a.label}.`);
      }
  }
  // Huecos que cortan el encuentro de un tabique con su muro
  for (const o of layout.openings) {
    const host = wallById.get(o.wallId);
    if (!host) continue;
    for (const t of layout.walls) {
      if (t.id === host.id || t.kind !== 'tabique') continue;
      for (const end of [t.a, t.b]) {
        // ¿el extremo del tabique toca la cara del muro anfitrión?
        const s = projectOnWall(host, end);
        if (s === null) continue;
        const half = t.thickness / 2;
        if (s + half > o.offset + 1e-6 && s - half < o.offset + o.width - 1e-6)
          add('conflicto', o.id, `${o.label} corta el encuentro del tabique ${t.id} con el muro ${host.id}. No se mueve ningún muro automáticamente.`);
      }
    }
  }

  // Huecos que atraviesan un forjado apoyado en su muro
  for (const o of layout.openings) {
    const w = wallById.get(o.wallId);
    if (!w) continue;
    const base = layout.levels.find((l) => l.id === w.levelId)?.elevation ?? 0;
    const z0 = base + o.sill;
    const z1 = z0 + o.height;
    for (const sl of layout.slabs) {
      const top = layout.levels.find((l) => l.id === sl.levelId)?.elevation ?? 0;
      const bottom = top - sl.thickness;
      if (!(z0 < top - 1e-6 && z1 > bottom + 1e-6)) continue;
      const k = w.thickness / 2 + 0.05;
      const touches = [0.1, 0.5, 0.9].some((t) => {
        const s = o.offset + o.width * t;
        return [k, -k].some((side) => pointInPolygon(pointOnWall(w, s, side), sl.polygon));
      });
      if (touches) add('conflicto', o.id, `${o.label} (hasta ${fmtM(z1)} m) atraviesa el forjado del ${layout.levels.find((l) => l.id === sl.levelId)?.name.toLowerCase() ?? 'nivel superior'} (${fmtM(bottom)}–${fmtM(top)} m). No se modifica nada automáticamente.`);
    }
  }

  // Huecos grandes: aviso estructural
  for (const o of layout.openings)
    if (o.width >= 3) add('aviso', o.id, `${o.label}: hueco de ${fmtM(o.width)} m. Requiere solución estructural y comprobación técnica; no está resuelta en este modelo.`);

  // Estancias
  const env: Vec2[] = [[layout.bounds.minX, layout.bounds.minY], [layout.bounds.maxX, layout.bounds.minY], [layout.bounds.maxX, layout.bounds.maxY], [layout.bounds.minX, layout.bounds.maxY]];
  for (const r of layout.rooms) {
    if (r.polygon.length < 3) {
      add('error', r.id, `${r.name}: polígono con menos de 3 vértices.`);
      continue;
    }
    if (polygonArea(r.polygon) < 1e-3) add('error', r.id, `${r.name}: superficie nula.`);
    if (isSelfIntersecting(r.polygon)) add('error', r.id, `${r.name}: el polígono se corta a sí mismo.`);
    if (!r.polygon.every((p) => pointInPolygon(p, env))) add('error', r.id, `${r.name}: queda fuera del edificio.`);
    const b = bbox(r.polygon);
    if (b.maxX - b.minX < 0.6 || b.maxY - b.minY < 0.6) add('aviso', r.id, `${r.name}: dimensión libre inferior a 0,60 m.`);
  }
  for (let i = 0; i < layout.rooms.length; i++)
    for (let j = i + 1; j < layout.rooms.length; j++) {
      const a = layout.rooms[i];
      const b = layout.rooms[j];
      if (a.levelId !== b.levelId) continue;
      const ov = overlapArea(a.polygon, b.polygon);
      if (ov > 0.05) add('error', a.id, `${a.name} y ${b.name} se solapan (${fmtM(ov)} m²).`);
    }
  // Estancias que invaden muros (solo muros presentes en el nivel de la estancia)
  const elevOf = (id: string) => layout.levels.find((l) => l.id === id)?.elevation ?? 0;
  const wallAtLevel = (w: { levelId: string; height: number }, levelId: string) => {
    const base = elevOf(w.levelId);
    const z = elevOf(levelId) + 0.5;
    return base <= z && z < base + w.height;
  };
  for (const r of layout.rooms)
    for (const w of layout.walls)
      if (wallAtLevel(w, r.levelId) && overlapArea(r.polygon, wallRect(w, 0, wallLength(w))) > 0.03) add('error', r.id, `${r.name} invade el muro ${w.id}.`);

  // Mobiliario
  const swings = layout.openings
    .map((o) => ({ o, w: wallById.get(o.wallId), sw: wallById.get(o.wallId) ? doorSwing(o, wallById.get(o.wallId)!) : null }))
    .filter((x) => x.sw);
  for (const f of layout.furniture) {
    const room = layout.rooms.find((r) => r.id === f.roomId);
    const fp = furnitureFootprint(f);
    if (!(f.w > 0 && f.d > 0 && f.h >= 0)) add('error', f.id, `${f.label}: dimensiones no válidas.`);
    if (!room) add('error', f.id, `${f.label}: estancia ${f.roomId} inexistente.`);
    else if (!fp.every((p) => pointInPolygon(p, room.polygon, 2e-3))) add('conflicto', f.id, `${f.label} no cabe en ${room.name} (atraviesa muros o límites).`);
    if (f.type !== 'alfombra')
      for (const { o, w, sw } of swings) {
        const z0 = elevOf(w!.levelId) + o.sill;
        const zr = room ? elevOf(room.levelId) + 0.3 : 0;
        if (!(z0 <= zr && zr < z0 + o.height)) continue;
        if (overlapArea(fp, sw!.zone, 0.02) > 0.01) add('conflicto', f.id, `${f.label} bloquea el barrido de ${o.label}.`);
      }
  }
  for (let i = 0; i < layout.furniture.length; i++)
    for (let j = i + 1; j < layout.furniture.length; j++) {
      const a = layout.furniture[i];
      const b = layout.furniture[j];
      if (a.type === 'alfombra' || b.type === 'alfombra') continue;
      // piezas colgadas en la pared (baldas, colgadores, apliques) pueden quedar sobre un mueble
      if (a.type === 'balda' || b.type === 'balda' || a.type === 'aplique' || b.type === 'aplique') continue;
      const la = layout.rooms.find((r) => r.id === a.roomId)?.levelId;
      const lb = layout.rooms.find((r) => r.id === b.roomId)?.levelId;
      if (la !== lb) continue;
      if (a.type === 'mesa-centro' || b.type === 'mesa-centro') continue;
      const ov = overlapArea(furnitureFootprint(a), furnitureFootprint(b), 0.02);
      if (ov > 0.01) add('conflicto', a.id, `${a.label} se solapa con ${b.label}.`);
    }

  return issues;
}

function projectOnWall(w: { a: Vec2; b: Vec2; thickness: number }, p: Vec2): number | null {
  const dx = w.b[0] - w.a[0];
  const dy = w.b[1] - w.a[1];
  const L = Math.hypot(dx, dy);
  const ux = dx / L;
  const uy = dy / L;
  const s = (p[0] - w.a[0]) * ux + (p[1] - w.a[1]) * uy;
  const d = Math.abs(-(p[0] - w.a[0]) * uy + (p[1] - w.a[1]) * ux);
  return d <= w.thickness / 2 + 1e-3 && s >= -1e-6 && s <= L + 1e-6 ? s : null;
}

function wallRect(w: { a: Vec2; b: Vec2; thickness: number }, s0: number, s1: number): Vec2[] {
  const dx = w.b[0] - w.a[0];
  const dy = w.b[1] - w.a[1];
  const L = Math.hypot(dx, dy);
  const u: Vec2 = [dx / L, dy / L];
  const n: Vec2 = [-u[1], u[0]];
  const h = w.thickness / 2 - 0.005; // margen para no detectar el contacto de caras
  const p = (s: number, k: number): Vec2 => [w.a[0] + u[0] * s + n[0] * k, w.a[1] + u[1] * s + n[1] * k];
  return [p(s0, -h), p(s1, -h), p(s1, h), p(s0, h)];
}

/** medio espesor del muro perpendicular que llega al extremo `p` de `w` (0 si no hay ninguno) */
function endHalf(w: Wall, p: Vec2, walls: Wall[]) {
  const d = wallDir(w);
  let half = 0;
  for (const x of walls) {
    if (x === w || x.levelId !== w.levelId) continue;
    const dx = wallDir(x);
    if (Math.abs(d[0] * dx[0] + d[1] * dx[1]) > 0.1) continue; // solo perpendiculares
    if (distPointSegment(p, x.a, x.b) <= w.thickness / 2 + 1e-3) half = Math.max(half, x.thickness / 2);
  }
  return half;
}
