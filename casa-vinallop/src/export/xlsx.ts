/**
 * Libro de Excel (.xlsx) mínimo, sin dependencias: hojas con texto, números, fechas y fórmulas
 * (con su valor calculado, para que se vea bien también sin recalcular), estilos básicos,
 * anchos de columna, fila de cabecera fija y autofiltro.
 */
import { makeZip } from './zip';

export type XlsxStyle = 'text' | 'head' | 'title' | 'muted' | 'eur' | 'eurBold' | 'bold' | 'date' | 'wrap' | 'pct' | 'num';

export interface XlsxCellObj {
  v?: string | number | null;
  /** fórmula sin «=» */
  f?: string;
  /** fecha ISO (AAAA-MM-DD): se guarda como fecha de Excel */
  date?: string;
  s?: XlsxStyle;
}
export type XlsxCell = string | number | null | undefined | XlsxCellObj;

export interface XlsxSheet {
  name: string;
  /** anchos de columna (caracteres) */
  cols?: number[];
  rows: XlsxCell[][];
  /** filas superiores fijas */
  freeze?: number;
  /** autofiltro: fila de cabecera y última fila (1-based) y número de columnas */
  filter?: { head: number; last: number; cols: number };
}

const STYLE_ID: Record<XlsxStyle, number> = { text: 0, head: 1, eur: 2, eurBold: 3, bold: 4, date: 5, wrap: 6, pct: 7, title: 8, muted: 9, num: 10 };

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/><numFmt numFmtId="165" formatCode="0&quot; %&quot;"/></numFmts>
<fonts count="4"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="14"/><name val="Arial"/></font><font><i/><sz val="9"/><color rgb="FF666666"/><name val="Arial"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8E4DA"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF4F1EA"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF999999"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="11">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="164" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // caracteres de control no válidos en XML
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

/** letra de columna (0 → A, 26 → AA) */
export function colName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** número de serie de Excel de una fecha ISO (sistema 1900) */
export function excelDate(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return Math.round(t / 86400000) + 25569;
}

function cellXml(c: XlsxCell, ref: string): string {
  if (c == null || c === '') return '';
  const o: XlsxCellObj = typeof c === 'object' ? c : { v: c };
  if (o.date !== undefined) {
    const n = excelDate(o.date);
    if (n == null) return o.date ? `<c r="${ref}" t="inlineStr" s="${STYLE_ID[o.s ?? 'text']}"><is><t>${esc(o.date)}</t></is></c>` : '';
    return `<c r="${ref}" s="${STYLE_ID[o.s ?? 'date']}"><v>${n}</v></c>`;
  }
  const s = STYLE_ID[o.s ?? (typeof o.v === 'number' ? 'eur' : 'text')];
  if (o.f) {
    const cached = typeof o.v === 'number' && Number.isFinite(o.v) ? `<v>${o.v}</v>` : '';
    return `<c r="${ref}" s="${s}"><f>${esc(o.f)}</f>${cached}</c>`;
  }
  if (typeof o.v === 'number') return Number.isFinite(o.v) ? `<c r="${ref}" s="${s}"><v>${o.v}</v></c>` : '';
  if (o.v == null || o.v === '') return s ? `<c r="${ref}" s="${s}"/>` : '';
  return `<c r="${ref}" t="inlineStr" s="${s}"><is><t xml:space="preserve">${esc(String(o.v))}</t></is></c>`;
}

function sheetXml(sh: XlsxSheet): string {
  const views = sh.freeze
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sh.freeze}" topLeftCell="A${sh.freeze + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const cols = sh.cols?.length ? `<cols>${sh.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const rows = sh.rows.map((r, i) => {
    const cells = r.map((c, j) => cellXml(c, `${colName(j)}${i + 1}`)).join('');
    return cells ? `<row r="${i + 1}">${cells}</row>` : '';
  }).join('');
  const filter = sh.filter ? `<autoFilter ref="A${sh.filter.head}:${colName(sh.filter.cols - 1)}${Math.max(sh.filter.last, sh.filter.head)}"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${views}<sheetFormatPr defaultRowHeight="13"/>${cols}<sheetData>${rows}</sheetData>${filter}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToHeight="0"/></worksheet>`;
}

/** nombre de hoja válido en Excel (≤ 31 caracteres, sin : \ / ? * [ ]) */
const sheetName = (s: string) => s.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Hoja';

export function buildXlsx(sheets: XlsxSheet[], meta: { title?: string; creator?: string } = {}) {
  const enc = new TextEncoder();
  const names = sheets.map((s) => sheetName(s.name));
  const defined = sheets.map((s, i) => (s.filter
    ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${names[i].replace(/'/g, "''")}'!$A$${s.filter.head}:$${colName(s.filter.cols - 1)}$${Math.max(s.filter.last, s.filter.head)}</definedName>`
    : '')).join('');
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const files: { name: string; data: string }[] = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(meta.title ?? '')}</dc:title><dc:creator>${esc(meta.creator ?? '')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${defined ? `<definedNames>${defined}</definedNames>` : ''}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: STYLES },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) })),
  ];
  return makeZip(files.map((f) => ({ name: f.name, data: enc.encode(f.data) })));
}
