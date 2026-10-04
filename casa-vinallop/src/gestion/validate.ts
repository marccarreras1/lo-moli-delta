/**
 * Validación de los datos de gestión.
 *  - modo «estricto» (importación): cualquier dato inválido rechaza el archivo entero.
 *  - modo «tolerante» (carga local): se descartan los elementos inválidos y se conserva el resto.
 * Los campos ausentes toman su valor por defecto (vacío/pendiente); un tipo incorrecto es un error.
 */
import {
  CONDICIONES, DECISION_ESTADOS, FASE_ESTADOS, OFERTA_ESTADOS, UNIDADES,
  type Asignacion, type Bloqueo, type Capitulo, type Comentario, type Decision, type Documento, type Fase, type GestionData,
  type Oferta, type Pago, type Partida, type Presupuesto, type Tarea, type TotalesImpresos,
} from './types';

export const GESTION_APP = 'casa-vinallop-gestion';
export const GESTION_FORMATO = 1;

export class GestionInvalida extends Error {}

type Obj = Record<string, unknown>;
const fail = (path: string, msg: string): never => { throw new GestionInvalida(`${path}: ${msg}`); };

function obj(x: unknown, path: string): Obj {
  if (!x || typeof x !== 'object' || Array.isArray(x)) fail(path, 'se esperaba un objeto');
  return x as Obj;
}
function str(o: Obj, k: string, path: string, max = 4000): string {
  const v = o[k];
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') fail(`${path}.${k}`, 'se esperaba texto');
  return (v as string).slice(0, max);
}
function reqStr(o: Obj, k: string, path: string, max = 200): string {
  const v = str(o, k, path, max);
  if (!v) fail(`${path}.${k}`, 'falta el identificador');
  return v;
}
function fecha(o: Obj, k: string, path: string): string {
  const v = str(o, k, path, 40);
  if (v && !/^\d{4}-\d{2}-\d{2}/.test(v)) fail(`${path}.${k}`, 'fecha no válida (AAAA-MM-DD)');
  return v;
}
function num(o: Obj, k: string, path: string, min = -1e12, max = 1e12): number | null {
  const v = o[k];
  if (v === undefined || v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${path}.${k}`, 'se esperaba un número o vacío');
  if ((v as number) < min || (v as number) > max) fail(`${path}.${k}`, 'número fuera de rango');
  return v as number;
}
function reqNum(o: Obj, k: string, path: string, min?: number, max?: number): number {
  const v = num(o, k, path, min, max);
  if (v == null) fail(`${path}.${k}`, 'falta el número');
  return v as number;
}
function bool(o: Obj, k: string, path: string): boolean {
  const v = o[k];
  if (v === undefined || v === null) return false;
  if (typeof v !== 'boolean') fail(`${path}.${k}`, 'se esperaba verdadero/falso');
  return v as boolean;
}
function pick<T extends string>(o: Obj, k: string, path: string, opts: readonly T[], def?: T): T {
  const v = o[k];
  if ((v === undefined || v === null) && def !== undefined) return def;
  if (typeof v !== 'string' || !opts.includes(v as T)) fail(`${path}.${k}`, `valor no permitido (${opts.join(', ')})`);
  return v as T;
}
function strList(o: Obj, k: string, path: string): string[] {
  const v = o[k];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) fail(`${path}.${k}`, 'se esperaba una lista');
  return (v as unknown[]).slice(0, 500).map((x, i) => {
    if (typeof x !== 'string') fail(`${path}.${k}[${i}]`, 'se esperaba texto');
    return (x as string).slice(0, 2000);
  });
}

/** Lista con ids únicos; en modo tolerante se descartan los elementos inválidos o repetidos. */
function list<T extends { id: string }>(o: Obj, k: string, path: string, strict: boolean, f: (x: unknown, p: string) => T, max = 2000): T[] {
  const v = o[k];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    if (strict) fail(`${path}.${k}`, 'se esperaba una lista');
    return [];
  }
  const out: T[] = [];
  const ids = new Set<string>();
  (v as unknown[]).slice(0, max).forEach((x, i) => {
    const p = `${path}.${k}[${i}]`;
    try {
      const item = f(x, p);
      if (ids.has(item.id)) fail(p, `identificador repetido «${item.id}»`);
      ids.add(item.id);
      out.push(item);
    } catch (e) {
      if (strict) throw e;
    }
  });
  return out;
}

// ---------------------------------------------------------------- entidades

function decision(x: unknown, p: string): Decision {
  const o = obj(x, p);
  return {
    id: reqStr(o, 'id', p), elemento: str(o, 'elemento', p, 300), estancia: str(o, 'estancia', p, 200), opcion: str(o, 'opcion', p), alternativas: str(o, 'alternativas', p),
    estado: pick(o, 'estado', p, DECISION_ESTADOS), fecha: fecha(o, 'fecha', p), notas: str(o, 'notas', p),
  };
}

function tarea(x: unknown, p: string): Tarea {
  const o = obj(x, p);
  return { id: reqStr(o, 'id', p), texto: str(o, 'texto', p, 1000), hecha: bool(o, 'hecha', p), partida: str(o, 'partida', p, 60) };
}
function bloqueo(x: unknown, p: string): Bloqueo {
  const o = obj(x, p);
  return { id: reqStr(o, 'id', p), texto: str(o, 'texto', p, 2000), fecha: fecha(o, 'fecha', p), resuelto: bool(o, 'resuelto', p) };
}
const faseOf = (strict: boolean) => (x: unknown, p: string): Fase => {
  const o = obj(x, p);
  return {
    id: reqStr(o, 'id', p), nombre: str(o, 'nombre', p, 300), descripcion: str(o, 'descripcion', p),
    tareas: list(o, 'tareas', p, strict, tarea), dependencias: strList(o, 'dependencias', p), requisitos: strList(o, 'requisitos', p),
    previstoInicio: fecha(o, 'previstoInicio', p), previstoFin: fecha(o, 'previstoFin', p), realInicio: fecha(o, 'realInicio', p), realFin: fecha(o, 'realFin', p),
    responsable: str(o, 'responsable', p, 200), estado: pick(o, 'estado', p, FASE_ESTADOS, 'sin empezar'),
    documentos: strList(o, 'documentos', p), observaciones: str(o, 'observaciones', p), bloqueos: list(o, 'bloqueos', p, strict, bloqueo), avisos: strList(o, 'avisos', p),
  };
};

function pago(x: unknown, p: string): Pago {
  const o = obj(x, p);
  return { id: reqStr(o, 'id', p), fecha: fecha(o, 'fecha', p), importe: reqNum(o, 'importe', p), nota: str(o, 'nota', p, 1000) };
}
const partidaOf = (strict: boolean) => (x: unknown, p: string): Partida => {
  const o = obj(x, p);
  const vinculo = o.vinculo;
  if (vinculo !== undefined && vinculo !== null && vinculo !== 'solera-l-area') fail(`${p}.vinculo`, 'vínculo desconocido');
  const r: Partida = {
    id: reqStr(o, 'id', p), codigo: str(o, 'codigo', p, 60), descripcion: str(o, 'descripcion', p), capitulo: str(o, 'capitulo', p, 200), fase: str(o, 'fase', p, 200),
    cantidad: num(o, 'cantidad', p, 0), unidad: pick(o, 'unidad', p, UNIDADES, 'PA'), precio: num(o, 'precio', p),
    proveedor: str(o, 'proveedor', p, 300), referencia: str(o, 'referencia', p, 300),
    contratado: num(o, 'contratado', p), extras: num(o, 'extras', p), real: num(o, 'real', p), pagos: list(o, 'pagos', p, strict, pago),
    notas: str(o, 'notas', p), origenPrecio: str(o, 'origenPrecio', p, 500), fechaPrecio: fecha(o, 'fechaPrecio', p),
    condicion: pick(o, 'condicion', p, CONDICIONES, 'estimación'), impuesto: num(o, 'impuesto', p, 0, 100), base: num(o, 'base', p),
  };
  if (vinculo === 'solera-l-area') r.vinculo = 'solera-l-area';
  if (bool(o, 'noSeleccionada', p)) r.noSeleccionada = true;
  return r;
};
function capitulo(x: unknown, p: string): Capitulo {
  const o = obj(x, p);
  const c: Capitulo = { id: reqStr(o, 'id', p), nombre: str(o, 'nombre', p, 300) };
  if (bool(o, 'reserva', p)) c.reserva = true;
  return c;
}
function totales(x: unknown, p: string): TotalesImpresos | null {
  if (x === undefined || x === null) return null;
  const o = obj(x, p);
  return { subtotal: num(o, 'subtotal', p), descuento: num(o, 'descuento', p), base: num(o, 'base', p), impuestos: num(o, 'impuestos', p), total: num(o, 'total', p), nota: str(o, 'nota', p) };
}
function oferta(x: unknown, p: string): Oferta {
  const o = obj(x, p);
  return {
    id: reqStr(o, 'id', p), proveedor: str(o, 'proveedor', p, 300), referencia: str(o, 'referencia', p, 300), fecha: fecha(o, 'fecha', p), alcance: str(o, 'alcance', p),
    partidas: strList(o, 'partidas', p), importeBase: num(o, 'importeBase', p), descuentoPct: num(o, 'descuentoPct', p, 0, 100), ajuste: num(o, 'ajuste', p),
    ajusteNota: str(o, 'ajusteNota', p), impuestoPct: num(o, 'impuestoPct', p, 0, 100), estado: pick(o, 'estado', p, OFERTA_ESTADOS, 'recibida'),
    documentos: strList(o, 'documentos', p), notas: str(o, 'notas', p), totalesImpresos: totales(o.totalesImpresos, `${p}.totalesImpresos`),
    condiciones: str(o, 'condiciones', p), avisos: strList(o, 'avisos', p),
  };
}
function documento(x: unknown, p: string): Documento {
  const o = obj(x, p);
  return { id: reqStr(o, 'id', p), titulo: str(o, 'titulo', p, 300), referencia: str(o, 'referencia', p, 2000), fecha: fecha(o, 'fecha', p), nota: str(o, 'nota', p) };
}
function asignacion(x: unknown, p: string): Asignacion {
  const o = obj(x, p);
  return { id: reqStr(o, 'id', p), partida: str(o, 'partida', p, 60), importe: reqNum(o, 'importe', p), fecha: fecha(o, 'fecha', p), nota: str(o, 'nota', p) };
}
function presupuesto(x: unknown, p: string, strict: boolean): Presupuesto {
  const o = obj(x, p);
  const r = o.reserva === undefined || o.reserva === null ? {} : obj(o.reserva, `${p}.reserva`);
  return {
    capitulos: list(o, 'capitulos', p, strict, capitulo, 200),
    partidas: list(o, 'partidas', p, strict, partidaOf(strict)),
    ofertas: list(o, 'ofertas', p, strict, oferta, 500),
    documentos: list(o, 'documentos', p, strict, documento),
    reserva: { importe: num(r, 'importe', `${p}.reserva`), nota: str(r, 'nota', `${p}.reserva`), asignaciones: list(r, 'asignaciones', `${p}.reserva`, strict, asignacion) },
    avisos: strList(o, 'avisos', p),
  };
}
function comentario(x: unknown, p: string): Comentario {
  const o = obj(x, p);
  const pos = obj(o.posicion, `${p}.posicion`);
  const z = num(pos, 'z', `${p}.posicion`);
  const c: Comentario = {
    id: reqStr(o, 'id', p), texto: str(o, 'texto', p), nivel: str(o, 'nivel', p, 200),
    posicion: { x: reqNum(pos, 'x', `${p}.posicion`, -1e5, 1e5), y: reqNum(pos, 'y', `${p}.posicion`, -1e5, 1e5), ...(z == null ? {} : { z }) },
    vista: pick(o, 'vista', p, ['plano', '3d'] as const, 'plano'), estado: pick(o, 'estado', p, ['pendiente', 'resuelto'] as const, 'pendiente'),
    creado: str(o, 'creado', p, 40),
  };
  const est = str(o, 'estancia', p, 200);
  if (est) c.estancia = est;
  return c;
}

/** Valida un sobre de exportación `{ app, formato, ... }`. Lanza GestionInvalida en modo estricto. */
export function parseGestion(x: unknown, strict: boolean): GestionData {
  const o = obj(x, 'archivo');
  if (o.app !== GESTION_APP) fail('archivo', 'no es un archivo de gestión de Casa Vinallop');
  if (typeof o.formato !== 'number' || o.formato < 1) fail('archivo.formato', 'versión de formato no válida');
  if ((o.formato as number) > GESTION_FORMATO) fail('archivo.formato', `formato ${o.formato} más reciente que el admitido (${GESTION_FORMATO})`);
  if (strict) for (const k of ['decisiones', 'fases', 'comentarios']) if (!Array.isArray(o[k])) fail(`archivo.${k}`, 'se esperaba una lista');
  return {
    decisiones: list(o, 'decisiones', 'decisiones', strict, decision),
    fases: list(o, 'fases', 'fases', strict, faseOf(strict), 500),
    presupuesto: presupuesto(o.presupuesto, 'presupuesto', strict),
    comentarios: list(o, 'comentarios', 'comentarios', strict, comentario, 5000),
  };
}

export function envelope(d: GestionData) {
  return { app: GESTION_APP, formato: GESTION_FORMATO, exportado: new Date().toISOString(), ...d };
}
