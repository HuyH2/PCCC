import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Dependency-free PDF writer. Noto Sans is embedded as a CID font so Vietnamese text is
 * preserved without relying on fonts installed on the server. This is a data report, not
 * an official form template (Q04/BR-12); template configuration only changes labels/notes.
 */
const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM = PAGE_HEIGHT - 46;
const TABLE_FONT = 7.5;
const TABLE_LINE = 8.6;

const fontPath = fileURLToPath(new URL("../../../assets/NotoSans-Regular.ttf", import.meta.url));
let cachedFont = null;

export async function buildReportPdf({
  title,
  typeName,
  typeCode,
  columns,
  rows,
  summary,
  filters,
  template,
  exporter,
  exportedAt,
}) {
  const font = loadFont();
  const painter = new PdfPainter(font);
  painter.page();
  const titleLines = fitLines(
    painter,
    wrapAll(painter, title, 15, CONTENT_WIDTH),
    2,
    CONTENT_WIDTH,
    15,
  );
  let y = MARGIN + 2;
  for (const line of titleLines) {
    painter.text(line, PAGE_WIDTH / 2, y + 12, 15, { color: 0.08, center: true });
    y += 19;
  }
  painter.text(`${typeCode} — ${typeName}`, PAGE_WIDTH / 2, y + 6, 9, {
    color: 0.35,
    center: true,
  });
  y += 18;

  const meta = [];
  if (filters.from)
    meta.push(`Kỳ báo cáo: ${formatDate(filters.from)} – ${formatDate(filters.to)}`);
  else meta.push("Kỳ báo cáo: Toàn bộ dữ liệu");
  if (filters.regionName) meta.push(`Khu vực: ${filters.regionName}`);
  if (filters.officerName) meta.push(`Cán bộ: ${filters.officerName}`);
  meta.push(`Người xuất: ${exporter} · ${formatDateTime(exportedAt)}`);
  if (template) meta.push(`Biểu mẫu: ${template.name}`);
  if (template?.header_note) meta.push(template.header_note);
  for (const line of meta) {
    for (const wrapped of wrapAll(painter, line, 8, CONTENT_WIDTH)) {
      painter.text(wrapped, MARGIN, y + 8, 8, { color: 0.28 });
      y += 11;
    }
  }
  y += 4;
  painter.y = y;

  painter.text("TỔNG HỢP", MARGIN, painter.y + 9, 9, { color: 0.1 });
  painter.y += 15;
  drawSummary(painter, summary);

  painter.y += 8;
  painter.text("DANH SÁCH CHI TIẾT", MARGIN, painter.y + 9, 9, { color: 0.1 });
  painter.y += 16;

  const widths = columnWidths(columns);
  drawTable(painter, columns, rows, widths);
  if (template?.footer_note) {
    painter.y += 10;
    for (const line of wrapAll(painter, template.footer_note, 8, CONTENT_WIDTH)) {
      if (painter.y + 12 > BOTTOM) painter.page();
      painter.text(line, MARGIN, painter.y + 8, 8, { color: 0.35 });
      painter.y += 11;
    }
  }
  painter.finish(`${typeName} · ${typeCode}`);
  return painter.toPdf({ title, author: "Hệ thống quản lý PCCC & CNCH" });
}

function drawSummary(painter, summary) {
  if (!summary.length) return;
  const cellWidth = CONTENT_WIDTH / 2;
  const cellHeight = 19;
  const rowCount = Math.ceil(summary.length / 2);
  painter.ensureSpace(rowCount * cellHeight);
  const startY = painter.y;
  summary.forEach((item, index) => {
    const row = Math.floor(index / 2);
    const column = index % 2;
    const x = MARGIN + column * cellWidth;
    const y = startY + row * cellHeight;
    painter.rect(x, y, cellWidth, cellHeight, { fill: 0.975, stroke: 0.86 });
    painter.text(item.label, x + 6, y + 13, 8, { color: 0.25 });
    const value =
      item.unit === "%" ? `${item.value}%` : `${item.value}${item.unit ? ` ${item.unit}` : ""}`;
    painter.text(value, x + cellWidth - 6, y + 13, 9, { color: 0.08, right: true });
  });
  painter.y = startY + rowCount * cellHeight + 4;
}

function drawTable(painter, columns, rows, widths) {
  let headerHeight = 0;
  const drawHeader = () => {
    headerHeight = 26;
    painter.rect(MARGIN, painter.y, CONTENT_WIDTH, headerHeight, { fill: 0.88, stroke: 0.78 });
    let x = MARGIN;
    columns.forEach((column, index) => {
      const lines = fitLines(
        painter,
        wrapAll(painter, column.label, TABLE_FONT, widths[index] - 4),
        2,
        widths[index] - 4,
        TABLE_FONT,
      );
      lines.forEach((line, lineIndex) => {
        painter.text(line, x + 2, painter.y + 9 + lineIndex * TABLE_LINE, TABLE_FONT, {
          color: 0.1,
        });
      });
      if (index > 0) painter.line(x, painter.y, x, painter.y + headerHeight, 0.4, 0.78);
      x += widths[index];
    });
    painter.y += headerHeight;
  };

  drawHeader();
  if (!rows.length) {
    painter.text("Không có dữ liệu phù hợp.", MARGIN + 6, painter.y + 16, 9, { color: 0.35 });
    painter.y += 28;
    return;
  }
  rows.forEach((row, rowIndex) => {
    const cellLines = columns.map((column, index) =>
      fitLines(
        painter,
        wrapAll(painter, row[column.key] ?? "—", TABLE_FONT, widths[index] - 4),
        2,
        widths[index] - 4,
        TABLE_FONT,
      ),
    );
    const lineCount = Math.max(1, ...cellLines.map((lines) => lines.length));
    const rowHeight = lineCount * TABLE_LINE + 6;
    if (painter.y + rowHeight > BOTTOM) {
      painter.page();
      drawHeader();
    }
    if (rowIndex % 2 === 1)
      painter.rect(MARGIN, painter.y, CONTENT_WIDTH, rowHeight, { fill: 0.975, stroke: null });
    let x = MARGIN;
    cellLines.forEach((lines, index) => {
      lines.forEach((line, lineIndex) => {
        painter.text(line, x + 2, painter.y + 4 + TABLE_LINE + lineIndex * TABLE_LINE, TABLE_FONT, {
          color: 0.18,
        });
      });
      if (index > 0) painter.line(x, painter.y, x, painter.y + rowHeight, 0.35, 0.86);
      x += widths[index];
    });
    painter.line(
      MARGIN,
      painter.y + rowHeight,
      MARGIN + CONTENT_WIDTH,
      painter.y + rowHeight,
      0.35,
      0.86,
    );
    painter.y += rowHeight;
  });
}

function columnWidths(columns) {
  const total = columns.reduce((sum, column) => sum + (column.width ?? 1), 0) || 1;
  return columns.map((column) => ((column.width ?? 1) / total) * CONTENT_WIDTH);
}

class PdfPainter {
  constructor(font) {
    this.font = font;
    this.pages = [];
    this.current = null;
    this.y = MARGIN;
    this.usedChars = new Set();
  }

  page() {
    this.current = { ops: [] };
    this.pages.push(this.current);
    this.y = MARGIN;
  }

  ensureSpace(height) {
    if (this.y + height > BOTTOM) this.page();
  }

  text(value, x, baseline, size, { color = 0.1, center = false, right = false } = {}) {
    const string = String(value ?? "");
    if (!string) return;
    const width = this.width(string, size);
    let left = x;
    if (center) left = x - width / 2;
    if (right) left = x - width;
    for (const char of Array.from(string)) this.usedChars.add(char.codePointAt(0));
    const hex = this.hex(string);
    this.current.ops.push(
      `BT /F1 ${size} Tf ${color} ${color} ${color} rg 1 0 0 1 ${num(left)} ${num(PAGE_HEIGHT - baseline)} Tm <${hex}> Tj ET`,
    );
    return width;
  }

  width(string, size) {
    let total = 0;
    for (const char of Array.from(String(string))) {
      const glyph = this.font.glyph(char.codePointAt(0));
      total += (this.font.advance(glyph) / this.font.unitsPerEm) * size;
    }
    return total;
  }

  hex(string) {
    return Array.from(String(string))
      .map((char) => this.font.glyph(char.codePointAt(0)).toString(16).padStart(4, "0"))
      .join("")
      .toUpperCase();
  }

  rect(x, y, width, height, { fill = null, stroke = null } = {}) {
    const top = PAGE_HEIGHT - y - height;
    if (fill !== null)
      this.current.ops.push(
        `q ${fill} ${fill} ${fill} rg ${num(x)} ${num(top)} ${num(width)} ${num(height)} re f Q`,
      );
    if (stroke !== null)
      this.current.ops.push(
        `q ${stroke} ${stroke} ${stroke} RG 0.5 w ${num(x)} ${num(top)} ${num(width)} ${num(height)} re S Q`,
      );
  }

  line(x1, y1, x2, y2, lineWidth = 0.4, gray = 0.8) {
    this.current.ops.push(
      `q ${gray} ${gray} ${gray} RG ${lineWidth} w ${num(x1)} ${num(PAGE_HEIGHT - y1)} m ${num(x2)} ${num(PAGE_HEIGHT - y2)} l S Q`,
    );
  }

  finish(documentTitle) {
    const total = this.pages.length;
    this.pages.forEach((page, index) => {
      const previous = this.current;
      this.current = page;
      this.line(MARGIN, PAGE_HEIGHT - 30, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 30, 0.4, 0.82);
      this.text(documentTitle, MARGIN, PAGE_HEIGHT - 18, 7.5, { color: 0.45 });
      this.text(`Trang ${index + 1}/${total}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 18, 7.5, {
        color: 0.45,
        right: true,
      });
      this.current = previous;
    });
  }

  toPdf({ title, author }) {
    return serializePdf(this.font, this.pages, this.usedChars, { title, author });
  }
}

function fitLines(painter, lines, maxLines, maxWidth, fontSize) {
  if (!lines.length) return ["—"];
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[kept.length - 1] = ellipsize(painter, kept[kept.length - 1], maxWidth, fontSize);
  return kept;
}

function wrapAll(painter, value, fontSize, maxWidth) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return ["—"];
  const words = text.split(" ");
  const lines = [];
  let line = "";
  const push = () => {
    if (line) lines.push(line);
    line = "";
  };
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (painter.width(candidate, fontSize) <= maxWidth) {
      line = candidate;
      continue;
    }
    push();
    if (painter.width(word, fontSize) <= maxWidth) {
      line = word;
      continue;
    }
    let rest = word;
    while (rest && painter.width(rest, fontSize) > maxWidth) {
      let chunk = "";
      for (const char of Array.from(rest)) {
        if (painter.width(chunk + char, fontSize) > maxWidth) break;
        chunk += char;
      }
      if (!chunk) chunk = Array.from(rest)[0] ?? "";
      if (!chunk) break;
      lines.push(chunk);
      rest = rest.slice(chunk.length);
    }
    line = rest;
  }
  push();
  return lines.length ? lines : ["—"];
}

function ellipsize(painter, value, maxWidth, fontSize) {
  const suffix = "…";
  let text = value;
  while (text && painter.width(text + suffix, fontSize) > maxWidth) text = text.slice(0, -1);
  return `${text}${suffix}`;
}

function num(value) {
  return Number(value.toFixed(2)).toString();
}

// --- TrueType parser ---------------------------------------------------------------------
function loadFont() {
  if (cachedFont) return cachedFont;
  const buffer = readFileSync(fontPath);
  cachedFont = parseTrueType(buffer);
  return cachedFont;
}

function parseTrueType(buffer) {
  const numTables = buffer.readUInt16BE(4);
  const tables = new Map();
  for (let index = 0; index < numTables; index++) {
    const offset = 12 + index * 16;
    const tag = buffer.toString("ascii", offset, offset + 4);
    tables.set(tag, {
      offset: buffer.readUInt32BE(offset + 8),
      length: buffer.readUInt32BE(offset + 12),
    });
  }
  const head = mustTable(tables, "head");
  const hhea = mustTable(tables, "hhea");
  const hmtx = mustTable(tables, "hmtx");
  const maxp = mustTable(tables, "maxp");
  const cmap = mustTable(tables, "cmap");
  const unitsPerEm = buffer.readUInt16BE(head.offset + 18);
  const ascender = buffer.readInt16BE(hhea.offset + 4);
  const descender = buffer.readInt16BE(hhea.offset + 6);
  const numberOfHMetrics = buffer.readUInt16BE(hhea.offset + 34);
  const numGlyphs = buffer.readUInt16BE(maxp.offset + 4);
  const xMin = buffer.readInt16BE(head.offset + 36);
  const yMin = buffer.readInt16BE(head.offset + 38);
  const xMax = buffer.readInt16BE(head.offset + 40);
  const yMax = buffer.readInt16BE(head.offset + 42);
  const cmapLookup = parseCmap(buffer, cmap.offset);
  const cache = new Map();
  return {
    buffer,
    unitsPerEm,
    ascender,
    descender,
    numGlyphs,
    bbox: [xMin, yMin, xMax, yMax],
    advance(glyph) {
      const index = Math.min(Math.max(0, glyph), numberOfHMetrics - 1);
      return buffer.readUInt16BE(hmtx.offset + index * 4);
    },
    glyph(codePoint) {
      if (cache.has(codePoint)) return cache.get(codePoint);
      const glyph = cmapLookup(codePoint) || 0;
      cache.set(codePoint, glyph);
      return glyph;
    },
  };
}

function mustTable(tables, tag) {
  const table = tables.get(tag);
  if (!table) throw new Error(`Font is missing ${tag} table.`);
  return table;
}

function parseCmap(buffer, cmapOffset) {
  const count = buffer.readUInt16BE(cmapOffset + 2);
  let format4 = null;
  let format12 = null;
  for (let index = 0; index < count; index++) {
    const record = cmapOffset + 4 + index * 8;
    const platform = buffer.readUInt16BE(record);
    const encoding = buffer.readUInt16BE(record + 2);
    const offset = cmapOffset + buffer.readUInt32BE(record + 4);
    const format = buffer.readUInt16BE(offset);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode) continue;
    if (format === 12) format12 = offset;
    else if (format === 4 && format4 === null) format4 = offset;
  }
  if (format12 !== null) {
    const groups = buffer.readUInt32BE(format12 + 12);
    return (codePoint) => {
      for (let index = 0; index < groups; index++) {
        const group = format12 + 16 + index * 12;
        const start = buffer.readUInt32BE(group);
        const end = buffer.readUInt32BE(group + 4);
        if (codePoint >= start && codePoint <= end)
          return buffer.readUInt32BE(group + 8) + (codePoint - start);
      }
      return 0;
    };
  }
  if (format4 !== null) {
    const segCount = buffer.readUInt16BE(format4 + 6) / 2;
    const endCodes = format4 + 14;
    const startCodes = endCodes + segCount * 2 + 2;
    const deltas = startCodes + segCount * 2;
    const rangeOffsets = deltas + segCount * 2;
    return (codePoint) => {
      if (codePoint > 0xffff) return 0;
      for (let index = 0; index < segCount; index++) {
        const end = buffer.readUInt16BE(endCodes + index * 2);
        if (codePoint > end) continue;
        const start = buffer.readUInt16BE(startCodes + index * 2);
        if (codePoint < start) return 0;
        const delta = buffer.readInt16BE(deltas + index * 2);
        const rangeOffset = buffer.readUInt16BE(rangeOffsets + index * 2);
        if (rangeOffset === 0) return (codePoint + delta) & 0xffff;
        const glyphPosition = rangeOffsets + index * 2 + rangeOffset + (codePoint - start) * 2;
        if (glyphPosition + 2 > buffer.length) return 0;
        const glyph = buffer.readUInt16BE(glyphPosition);
        return glyph ? (glyph + delta) & 0xffff : 0;
      }
      return 0;
    };
  }
  return () => 0;
}

// --- PDF object serialization ------------------------------------------------------------
function serializePdf(font, pages, usedChars, { title, author }) {
  const pageCount = pages.length;
  const contentIds = pages.map((_, index) => 8 + index * 2);
  const pageIds = pages.map((_, index) => 9 + index * 2);
  const infoId = 8 + pageCount * 2;
  const objects = new Map();
  objects.set(1, ascii("<< /Type /Catalog /Pages 2 0 R >>"));
  objects.set(
    2,
    ascii(
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`,
    ),
  );
  objects.set(
    3,
    ascii(
      "<< /Type /Font /Subtype /Type0 /BaseFont /NotoSans /Encoding /Identity-H /DescendantFonts [4 0 R] /ToUnicode 7 0 R >>",
    ),
  );
  objects.set(4, ascii(cidFont(font, usedChars)));
  objects.set(5, ascii(fontDescriptor(font)));
  objects.set(6, stream(font.buffer, `/Length1 ${font.buffer.length}`));
  objects.set(7, stream(Buffer.from(toUnicode(font, usedChars), "latin1")));
  pages.forEach((page, index) => {
    objects.set(contentIds[index], stream(Buffer.from(page.ops.join("\n"), "latin1")));
    objects.set(
      pageIds[index],
      ascii(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentIds[index]} 0 R >>`,
      ),
    );
  });
  objects.set(
    infoId,
    ascii(
      `<< /Title ${pdfString(title)} /Author ${pdfString(author)} /Creator ${pdfString(
        "PCCC & CNCH",
      )} /Producer ${pdfString("PCCC report export")} /CreationDate (${pdfDate()}) >>`,
    ),
  );
  const total = infoId;
  const parts = [Buffer.from("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  const offsets = new Array(total + 1).fill(0);
  let offset = parts[0].length;
  for (let id = 1; id <= total; id++) {
    const body = objects.get(id);
    if (!body) throw new Error(`Missing PDF object ${id}.`);
    offsets[id] = offset;
    const prefix = Buffer.from(`${id} 0 obj\n`, "ascii");
    const suffix = Buffer.from("\nendobj\n", "ascii");
    parts.push(prefix, body, suffix);
    offset += prefix.length + body.length + suffix.length;
  }
  const xrefOffset = offset;
  const xref = [`xref\n0 ${total + 1}\n`, "0000000000 65535 f \n"];
  for (let id = 1; id <= total; id++)
    xref.push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  xref.push(
    `trailer\n<< /Size ${total + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );
  parts.push(Buffer.from(xref.join(""), "ascii"));
  return Buffer.concat(parts);
}

function cidFont(font, usedChars) {
  const glyphs = [...new Set([...usedChars].map((char) => font.glyph(char)))].sort((a, b) => a - b);
  const widths = glyphs
    .map((glyph) => `${glyph} [${Math.round((font.advance(glyph) * 1000) / font.unitsPerEm)}]`)
    .join(" ");
  return `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /NotoSans /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 5 0 R /DW 1000 /W [${widths}] /CIDToGIDMap /Identity >>`;
}

function fontDescriptor(font) {
  const scale = 1000 / font.unitsPerEm;
  return `<< /Type /FontDescriptor /FontName /NotoSans /Flags 32 /FontBBox [${font.bbox
    .map((value) => Math.round(value * scale))
    .join(" ")}] /ItalicAngle 0 /Ascent ${Math.round(font.ascender * scale)} /Descent ${Math.round(
    font.descender * scale,
  )} /CapHeight ${Math.round(font.ascender * scale)} /StemV 80 /FontFile2 6 0 R >>`;
}

function toUnicode(font, usedChars) {
  const entries = [];
  const seen = new Set();
  for (const char of usedChars) {
    const glyph = font.glyph(char);
    if (!glyph || seen.has(glyph)) continue;
    seen.add(glyph);
    entries.push(
      `<${glyph.toString(16).padStart(4, "0")}> <${char.toString(16).padStart(4, "0")}>`,
    );
  }
  return `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
${entries.length} beginbfchar
${entries.join("\n")}
endbfchar
endcmap
CMapName currentdict /CMap defineresource pop
end
end`;
}

function stream(data, extra = "") {
  const dictionary = `<< /Length ${data.length}${extra ? ` ${extra}` : ""} >>\nstream\n`;
  return Buffer.concat([
    Buffer.from(dictionary, "latin1"),
    data,
    Buffer.from("\nendstream", "latin1"),
  ]);
}

function ascii(value) {
  return Buffer.from(value, "latin1");
}

function pdfString(value) {
  const bytes = Buffer.from(String(value), "utf16le");
  for (let index = 0; index < bytes.length; index += 2) {
    const temporary = bytes[index];
    bytes[index] = bytes[index + 1];
    bytes[index + 1] = temporary;
  }
  return `<FEFF${bytes.toString("hex").toUpperCase()}>`;
}

function pdfDate() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `D:${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}+07'00'`;
}

function formatDate(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  return value;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
