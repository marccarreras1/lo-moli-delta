/**
 * Validaciones del modelo. Detectan errores evidentes y conflictos sin
 * corregir nada automáticamente: la geometría no se deforma para "encajar".
 */
import type { Layout, Vec2 } from '../data/types';
import {
  bbox, doorSwing, fmtM, furnitureFootprint, isSelfIntersecting, overlapArea, pointInPolygon, polygonArea, wallLength,
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
    // en muros exteriores el eje empieza en la esquina: la parte libre va de t/2 a L - t/2
    const minS = w.kind === 'exterior' ? w.thickness / 2 : 0;
    const maxS = w.kind === 'exterior' ? L - w.thickness / 2 : L;
    if (o.offset < minS - 1e-6 || o.offset + o.width > maxS + 1e-6)
      add('error', o.id, `${o.label}: el hueco sale de su muro (${fmtM(o.offset)}–${fmtM(o.offset + o.width)} m sobre ${fmtM(L)} m).`);
    if (o.sill < 0 || o.sill + o.height > w.height + 1e-6)
      add('error', o.id, `${o.label}: la altura del hueco (${fmtM(o.sill + o.height)} m) supera la del muro (${fmtM(w.height)} m).`);
  }
  // Solapes entre huecos del mismo muro
  for (const w of layout.walls) {
    const ops = layout.openings.filter((o) => o.wallId === w.id).sort((a, b) => a.offset - b.offset);
    for (let i = 1; i < ops.length; i++) {
      if (ops[i].offset < ops[i - 1].offset + ops[i - 1].width - 1e-6)
        add('conflicto', ops[i].id, `${ops[i].label} se solapa con ${ops[i - 1].label}.`);
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
      const ov = overlapArea(a.polygon, b.polygon);
      if (ov > 0.05) add('error', a.id, `${a.name} y ${b.name} se solapan (${fmtM(ov)} m²).`);
    }
  // Estancias que invaden muros
  for (const r of layout.rooms)
    for (const w of layout.walls) {
        if (overlapArea(r.polygon, wallRect(w, 0, wallLength(w))) > 0.03) add('error', r.id, `${r.name} invade el muro ${w.id}.`);
    }

  // Mobiliario
  const swings = layout.openings
    .map((o) => ({ o, sw: wallById.get(o.wallId) ? doorSwing(o, wallById.get(o.wallId)!) : null }))
    .filter((x) => x.sw);
  for (const f of layout.furniture) {
    const room = layout.rooms.find((r) => r.id === f.roomId);
    const fp = furnitureFootprint(f);
    if (!(f.w > 0 && f.d > 0 && f.h >= 0)) add('error', f.id, `${f.label}: dimensiones no válidas.`);
    if (!room) add('error', f.id, `${f.label}: estancia ${f.roomId} inexistente.`);
    else if (!fp.every((p) => pointInPolygon(p, room.polygon, 2e-3))) add('conflicto', f.id, `${f.label} no cabe en ${room.name} (atraviesa muros o límites).`);
    if (f.type !== 'alfombra')
      for (const { o, sw } of swings)
        if (overlapArea(fp, sw!.zone, 0.02) > 0.01) add('conflicto', f.id, `${f.label} bloquea el barrido de ${o.label}.`);
  }
  for (let i = 0; i < layout.furniture.length; i++)
    for (let j = i + 1; j < layout.furniture.length; j++) {
      const a = layout.furniture[i];
      const b = layout.furniture[j];
      if (a.type === 'alfombra' || b.type === 'alfombra') continue;
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
