import { deflateRawSync } from "node:zlib";

/** Minimal, dependency-free XLSX writer for two sheets: summary + data. */
export function buildReportXlsx({
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
  const entries = [
    ["[Content_Types].xml", contentTypes()],
    ["_rels/.rels", rootRelations()],
    ["xl/workbook.xml", workbook()],
    ["xl/_rels/workbook.xml.rels", workbookRelations()],
    ["xl/styles.xml", styles()],
    [
      "xl/worksheets/sheet1.xml",
      summarySheet({ title, typeName, typeCode, summary, filters, template, exporter, exportedAt }),
    ],
    ["xl/worksheets/sheet2.xml", dataSheet(columns, rows)],
  ];
  return zip(entries.map(([name, xml]) => [name, Buffer.from(xml, "utf8")]));
}

function contentTypes() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
}

function rootRelations() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function workbook() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Tổng hợp" sheetId="1" r:id="rId1"/>
    <sheet name="Dữ liệu" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`;
}

function workbookRelations() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function styles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="10"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><name val="Calibri"/></font>
    <font><b/><sz val="14"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE7E6E6"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function summarySheet({
  title,
  typeName,
  typeCode,
  summary,
  filters,
  template,
  exporter,
  exportedAt,
}) {
  const rows = [
    ["A1", title, 2],
    ["A2", "Loại báo cáo", 1],
    ["B2", `${typeCode} — ${typeName}`, 0],
    ["A3", "Kỳ báo cáo", 1],
    [
      "B3",
      filters.from ? `${formatDate(filters.from)} → ${formatDate(filters.to)}` : "Toàn bộ dữ liệu",
      0,
    ],
    ["A4", "Bộ lọc", 1],
    ["B4", filterText(filters, template), 0],
    ["A5", "Người xuất", 1],
    ["B5", exporter, 0],
    ["A6", "Thời điểm xuất", 1],
    ["B6", formatDateTime(exportedAt), 0],
  ];
  if (template?.header_note) {
    rows.push(["A7", "Ghi chú đầu báo cáo", 1], ["B7", template.header_note, 0]);
  }
  rows.push(["A8", "TỔNG HỢP", 1], ["A9", "Chỉ tiêu", 1], ["B9", "Giá trị", 1]);
  summary.forEach((item, index) => {
    rows.push([`A${10 + index}`, item.label, 0]);
    rows.push([
      `B${10 + index}`,
      `${item.value}${item.unit ? (item.unit === "%" ? "%" : ` ${item.unit}`) : ""}`,
      0,
    ]);
  });
  let lastRow = 9 + summary.length;
  if (template?.footer_note) {
    lastRow += 1;
    rows.push([`A${lastRow}`, "Ghi chú cuối báo cáo", 1], [`B${lastRow}`, template.footer_note, 0]);
  }
  return worksheet(
    rowXml(rows),
    `<cols><col min="1" max="1" width="30"/><col min="2" max="2" width="48"/></cols>`,
    null,
    `A1:B${lastRow}`,
  );
}

function dataSheet(columns, rows) {
  const values = [];
  columns.forEach((column, index) => {
    values.push([`${columnLetter(index + 1)}1`, column.label, 1]);
  });
  rows.forEach((row, rowIndex) => {
    columns.forEach((column, columnIndex) => {
      const value = row[column.key];
      if (value === null || value === undefined || value === "") return;
      values.push([`${columnLetter(columnIndex + 1)}${rowIndex + 2}`, value, 3]);
    });
  });
  const cols = columns
    .map((column, index) => {
      const width = Math.max(10, Math.min(60, Math.round(15 * (column.width ?? 1))));
      return `<col min="${index + 1}" max="${index + 1}" width="${width}"/>`;
    })
    .join("");
  const lastColumn = columnLetter(Math.max(1, columns.length));
  const lastRow = rows.length + 1;
  return worksheet(
    rowXml(values),
    `<cols>${cols}</cols>`,
    `<autoFilter ref="A1:${lastColumn}${lastRow}"/>`,
    `A1:${lastColumn}${lastRow}`,
  );
}

function rowXml(cells) {
  const grouped = new Map();
  for (const [reference, value, style] of cells) {
    const rowNumber = Number(reference.replace(/^[A-Z]+/, ""));
    if (!grouped.has(rowNumber)) grouped.set(rowNumber, []);
    grouped.get(rowNumber).push(cell(reference, value, style));
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([rowNumber, rowCells]) => `<row r="${rowNumber}">${rowCells.join("")}</row>`)
    .join("");
}

function worksheet(cells, colsXml, tailXml, dimension) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimension}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  ${colsXml}
  <sheetData>${cells}</sheetData>
  ${tailXml ?? ""}
</worksheet>`;
}

function cell(ref, value, style) {
  if (typeof value === "number" && Number.isFinite(value))
    return `<c r="${ref}" s="${style}" t="n"><v>${value}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(
    String(value),
  )}</t></is></c>`;
}

function filterText(filters, template) {
  const parts = [];
  if (filters.regionName) parts.push(`Khu vực: ${filters.regionName}`);
  if (filters.officerName) parts.push(`Cán bộ: ${filters.officerName}`);
  if (template) parts.push(`Biểu mẫu: ${template.name}`);
  return parts.join("; ") || "Không lọc thêm";
}

function formatDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
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

function columnLetter(value) {
  let result = "";
  let number = value;
  while (number > 0) {
    const remainder = (number - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    number = Math.floor((number - 1) / 26);
  }
  return result;
}

function escapeXml(value) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

// --- ZIP (deflate, UTF-8 names, no extra fields) -----------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function zip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, raw] of entries) {
    const nameBuffer = Buffer.from(name, "utf8");
    const compressed = deflateRawSync(raw);
    const checksum = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + compressed.length;
  }
  const centralBuffer = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralBuffer, end]);
}
