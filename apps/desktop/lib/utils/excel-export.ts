export interface ExcelColumnDef {
  header: string;
  key: string;
  width?: number; // Largeur indicative en pixels (ex: 130) ou caractères
  type?: "string" | "number" | "currency" | "date";
  align?: "left" | "center" | "right";
}

export interface StyledExcelOptions {
  title: string;
  subtitle?: string;
  companyName?: string;
  sheetName?: string;
  filename?: string;
  columns: ExcelColumnDef[];
  rows: Record<string, any>[];
  totalsRow?: Record<string, any>;
}

function cleanSingleLineText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/\r?\n/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeXml(value: unknown): string {
  const cleaned = cleanSingleLineText(value);
  return cleaned
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function formatExcelDateFr(val: unknown): string {
  if (!val) return "—";
  const raw = String(val).trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return raw;
}

/**
 * Résout systématiquement le vrai numéro lisible de la facture liée d'un avoir (ex: FAC-003/GM/2026)
 * afin de ne JAMAIS afficher ni exporter un UUID technique brut (ex: ce698e36-1b2c-...).
 */
export function resolveCreditNoteInvoiceNumber(
  note: {
    invoiceId?: string | null;
    invoiceNumber?: string | null;
    reason?: string | null;
    clientId?: string | null;
    clientName?: string | null;
  },
  invoices?: Array<{ id: string; number: string; clientId?: string; clientName?: string }>,
  invoiceInfo?: { invoiceNumber?: string | null } | null
): string {
  const isRawTechnicalId = (v?: string | null): boolean => {
    if (!v) return true;
    const s = v.trim();
    if (!s) return true;
    // UUID v4 ou identifiant technique inv_...
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return true;
    if (/^(inv_|uuid_|id_)[a-z0-9_-]+$/i.test(s)) return true;
    return false;
  };

  if (invoiceInfo?.invoiceNumber && !isRawTechnicalId(invoiceInfo.invoiceNumber)) {
    return invoiceInfo.invoiceNumber.trim();
  }

  if (note.invoiceNumber && !isRawTechnicalId(note.invoiceNumber)) {
    return note.invoiceNumber.trim();
  }

  if (invoices && invoices.length > 0 && note.invoiceId) {
    const matched = invoices.find(
      (inv) => inv.id === note.invoiceId || inv.number === note.invoiceId
    );
    if (matched?.number && !isRawTechnicalId(matched.number)) {
      return matched.number.trim();
    }
  }

  // Extraction depuis le motif légal si présent (ex: "Avoir d'imputation sur facture FAC-003/GM/2026")
  if (note.reason) {
    const matchFac = note.reason.match(/\b(FAC[-/][A-Za-z0-9/_-]+)\b/i);
    if (matchFac && matchFac[1]) {
      return matchFac[1].toUpperCase();
    }
  }

  if (note.invoiceId && !isRawTechnicalId(note.invoiceId)) {
    return note.invoiceId.trim();
  }

  // Fallback intelligent sur la facture du même client si unique ou plus récente
  if (invoices && invoices.length > 0 && (note.clientId || note.clientName)) {
    const byClient = invoices.filter(
      (inv) =>
        (note.clientId && inv.clientId === note.clientId) ||
        (note.clientName &&
          inv.clientName?.trim().toLowerCase() === note.clientName.trim().toLowerCase())
    );
    if (byClient.length > 0 && byClient[0]?.number) {
      return byClient[0].number;
    }
  }

  return "Facture client";
}

// ── Utilitaire ZIP OpenXML sans dépendance externe (Store + CRC32) ─────────────

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZipArchive(files: Array<{ name: string; content: string }>): Uint8Array {
  const encoder = new TextEncoder();
  const entries = files.map((f) => {
    const nameBytes = encoder.encode(f.name);
    const dataBytes = encoder.encode(f.content);
    const crc = crc32(dataBytes);
    return { nameBytes, dataBytes, crc };
  });

  let localTotalSize = 0;
  let centralTotalSize = 0;
  for (const e of entries) {
    localTotalSize += 30 + e.nameBytes.length + e.dataBytes.length;
    centralTotalSize += 46 + e.nameBytes.length;
  }

  const totalSize = localTotalSize + centralTotalSize + 22;
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  let offset = 0;
  const localOffsets: number[] = [];

  for (const e of entries) {
    localOffsets.push(offset);
    // Local file header signature PK\x03\x04
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true); // Version needed (2.0)
    view.setUint16(offset + 6, 0x0800, true); // UTF-8 flag
    view.setUint16(offset + 8, 0, true); // Compression method 0 (Store)
    view.setUint16(offset + 10, 0, true); // Mod time
    view.setUint16(offset + 12, 0x5965, true); // Mod date
    view.setUint32(offset + 14, e.crc, true);
    view.setUint32(offset + 18, e.dataBytes.length, true);
    view.setUint32(offset + 22, e.dataBytes.length, true);
    view.setUint16(offset + 26, e.nameBytes.length, true);
    view.setUint16(offset + 28, 0, true); // Extra field length
    out.set(e.nameBytes, offset + 30);
    out.set(e.dataBytes, offset + 30 + e.nameBytes.length);
    offset += 30 + e.nameBytes.length + e.dataBytes.length;
  }

  const centralDirStart = offset;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    // Central directory header signature PK\x01\x02
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true); // Version made by
    view.setUint16(offset + 6, 20, true); // Version needed
    view.setUint16(offset + 8, 0x0800, true); // UTF-8 flag
    view.setUint16(offset + 10, 0, true); // Compression method 0
    view.setUint16(offset + 12, 0, true);
    view.setUint16(offset + 14, 0x5965, true);
    view.setUint32(offset + 16, e.crc, true);
    view.setUint32(offset + 20, e.dataBytes.length, true);
    view.setUint32(offset + 24, e.dataBytes.length, true);
    view.setUint16(offset + 28, e.nameBytes.length, true);
    view.setUint16(offset + 30, 0, true);
    view.setUint16(offset + 32, 0, true);
    view.setUint16(offset + 34, 0, true);
    view.setUint16(offset + 36, 0, true);
    view.setUint32(offset + 38, 0, true);
    view.setUint32(offset + 42, localOffsets[i], true);
    out.set(e.nameBytes, offset + 46);
    offset += 46 + e.nameBytes.length;
  }

  const centralDirSize = offset - centralDirStart;
  // End of central directory record PK\x05\x06
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 4, 0, true);
  view.setUint16(offset + 6, 0, true);
  view.setUint16(offset + 8, entries.length, true);
  view.setUint16(offset + 10, entries.length, true);
  view.setUint32(offset + 12, centralDirSize, true);
  view.setUint32(offset + 16, centralDirStart, true);
  view.setUint16(offset + 20, 0, true);

  return out;
}

function getExcelColumnLetter(colIndexOneBased: number): string {
  let n = colIndexOneBased;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters || "A";
}

function computeAutoColumnWidthInChars(
  col: ExcelColumnDef,
  rows: Record<string, any>[],
  totalsRow?: Record<string, any>
): number {
  const minFromPixelHint = col.width ? Math.round(col.width / 7) : 14;
  let maxLen = cleanSingleLineText(col.header).length + 4;

  for (const row of rows) {
    const raw = row[col.key];
    let displayStr = "";
    if (col.type === "currency") {
      const n = Number(raw ?? 0);
      displayStr = `${new Intl.NumberFormat("fr-FR").format(Math.round(Number.isFinite(n) ? n : 0))} FCFA`;
    } else if (col.type === "date") {
      displayStr = formatExcelDateFr(raw);
    } else {
      displayStr = cleanSingleLineText(raw ?? "—");
    }
    if (displayStr.length + 4 > maxLen) {
      maxLen = displayStr.length + 4;
    }
  }

  if (totalsRow && totalsRow[col.key] !== undefined && totalsRow[col.key] !== null) {
    const tVal = totalsRow[col.key];
    const tStr =
      col.type === "currency"
        ? `${new Intl.NumberFormat("fr-FR").format(Math.round(Number(tVal) || 0))} FCFA`
        : cleanSingleLineText(tVal);
    if (tStr.length + 5 > maxLen) {
      maxLen = tStr.length + 5;
    }
  }

  return Math.min(Math.max(maxLen, minFromPixelHint, 12), 62);
}

/**
 * Génère les parties XML OpenXML (.xlsx) et retourne l'archive ZIP binaire complète (signature PK\x03\x04)
 * qui s'ouvre dans Microsoft Excel avec ZÉRO alerte de sécurité.
 */
export function generateStyledExcelXlsxParts(options: StyledExcelOptions): {
  files: Array<{ name: string; content: string }>;
  zipBuffer: Uint8Array;
} {
  const {
    title,
    subtitle,
    companyName = "Global Maintenance",
    sheetName = "Rapport",
    columns,
    rows,
    totalsRow,
  } = options;

  const safeSheetName = escapeXml(sheetName.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Rapport");
  const colCount = Math.max(columns.length, 1);
  const lastColLetter = getExcelColumnLetter(colCount);
  const nowFr = formatExcelDateFr(new Date().toISOString());
  const subtitleText =
    subtitle || `${companyName} • Édité le ${nowFr} • ${rows.length} enregistrement(s)`;

  // 1. Colonnes avec largeurs automatiques (<cols>)
  const colsXml = columns
    .map((col, idx) => {
      const colNum = idx + 1;
      const widthChars = computeAutoColumnWidthInChars(col, rows, totalsRow);
      return `<col min="${colNum}" max="${colNum}" width="${widthChars}" customWidth="1"/>`;
    })
    .join("");

  // 2. Ligne 1 : Titre principal (fusionné A1:LastCol1)
  const row1Cells = columns
    .map((_, idx) => {
      const ref = `${getExcelColumnLetter(idx + 1)}1`;
      if (idx === 0) {
        return `<c r="${ref}" s="1" t="inlineStr"><is><t xml:space="preserve">${escapeXml(title)}</t></is></c>`;
      }
      return `<c r="${ref}" s="1"/>`;
    })
    .join("");

  // 3. Ligne 2 : Sous-titre métadonnées (fusionné A2:LastCol2)
  const row2Cells = columns
    .map((_, idx) => {
      const ref = `${getExcelColumnLetter(idx + 1)}2`;
      if (idx === 0) {
        return `<c r="${ref}" s="2" t="inlineStr"><is><t xml:space="preserve">${escapeXml(subtitleText)}</t></is></c>`;
      }
      return `<c r="${ref}" s="2"/>`;
    })
    .join("");

  // 4. Ligne 4 : En-tête de colonnes (fond Bleu Marine #0F2942, texte Blanc Gras)
  const headerCells = columns
    .map((col, idx) => {
      const ref = `${getExcelColumnLetter(idx + 1)}4`;
      const styleIdx =
        col.align === "right" || col.type === "currency" || col.type === "number"
          ? 5
          : col.align === "center"
          ? 4
          : 3;
      return `<c r="${ref}" s="${styleIdx}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(col.header)}</t></is></c>`;
    })
    .join("");

  // 5. Lignes de données (Ligne 5+)
  const dataRowsXml = rows
    .map((row, rIdx) => {
      const excelRowNum = 5 + rIdx;
      const isAlt = rIdx % 2 === 1;
      const cells = columns
        .map((col, cIdx) => {
          const ref = `${getExcelColumnLetter(cIdx + 1)}${excelRowNum}`;
          const rawVal = row[col.key];
          if (col.type === "currency") {
            const num = Number(rawVal ?? 0);
            const safeNum = Number.isFinite(num) ? Math.round(num) : 0;
            const s = isAlt ? 13 : 12;
            return `<c r="${ref}" s="${s}" t="n"><v>${safeNum}</v></c>`;
          }
          if (col.type === "number") {
            const num = Number(rawVal ?? 0);
            const safeNum = Number.isFinite(num) ? num : 0;
            const s = isAlt ? 15 : 14;
            return `<c r="${ref}" s="${s}" t="n"><v>${safeNum}</v></c>`;
          }
          if (col.type === "date") {
            const formatted = formatExcelDateFr(rawVal);
            const s = isAlt ? 9 : 8;
            return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(formatted)}</t></is></c>`;
          }
          const s =
            col.align === "center"
              ? isAlt
                ? 9
                : 8
              : col.align === "right"
              ? isAlt
                ? 11
                : 10
              : isAlt
              ? 7
              : 6;
          return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(rawVal ?? "—")}</t></is></c>`;
        })
        .join("");
      return `<row r="${excelRowNum}" ht="22" customHeight="1">${cells}</row>`;
    })
    .join("");

  // 6. Ligne finale TOTAL GÉNÉRAL
  let totalsRowXml = "";
  if (totalsRow) {
    const totalRowNum = 5 + rows.length;
    const totalCells = columns
      .map((col, cIdx) => {
        const ref = `${getExcelColumnLetter(cIdx + 1)}${totalRowNum}`;
        const val = totalsRow[col.key];
        if (val === undefined || val === null || val === "") {
          return `<c r="${ref}" s="16" t="inlineStr"><is><t></t></is></c>`;
        }
        if (col.type === "currency") {
          const num = Number(val);
          if (Number.isFinite(num)) {
            return `<c r="${ref}" s="18" t="n"><v>${Math.round(num)}</v></c>`;
          }
        }
        if (col.type === "number") {
          const num = Number(val);
          if (Number.isFinite(num)) {
            return `<c r="${ref}" s="19" t="n"><v>${num}</v></c>`;
          }
        }
        const s = col.align === "center" ? 17 : 16;
        return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(val)}</t></is></c>`;
      })
      .join("");
    totalsRowXml = `<row r="${totalRowNum}" ht="26" customHeight="1">${totalCells}</row>`;
  }

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${safeSheetName}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="#,##0 &quot;FCFA&quot;"/>
    <numFmt numFmtId="165" formatCode="#,##0"/>
  </numFmts>
  <fonts count="6">
    <font><sz val="10"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><b/><sz val="14"/><color rgb="FF0F2942"/><name val="Calibri"/></font>
    <font><i/><sz val="10"/><color rgb="FF64748B"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF0F2942"/><name val="Calibri"/></font>
    <font><sz val="10"/><color rgb="FF1E293B"/><name val="Calibri"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F2942"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF5"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="4">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFE2E8F0"/></left>
      <right style="thin"><color rgb="FFE2E8F0"/></right>
      <top style="thin"><color rgb="FFE2E8F0"/></top>
      <bottom style="thin"><color rgb="FFE2E8F0"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF1E3A5F"/></left>
      <right style="thin"><color rgb="FF1E3A5F"/></right>
      <top style="medium"><color rgb="FF0F2942"/></top>
      <bottom style="medium"><color rgb="FF0F2942"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="medium"><color rgb="FF0F2942"/></top>
      <bottom style="double"><color rgb="FF0F2942"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="20">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="5" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="5" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="165" fontId="5" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="165" fontId="5" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="5" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="5" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="4" fillId="5" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="165" fontId="4" fillId="5" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;

  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView workbookViewId="0" showGridLines="1"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>${colsXml}</cols>
  <sheetData>
    <row r="1" ht="30" customHeight="1">${row1Cells}</row>
    <row r="2" ht="20" customHeight="1">${row2Cells}</row>
    <row r="3" ht="10" customHeight="1"/>
    <row r="4" ht="26" customHeight="1">${headerCells}</row>
    ${dataRowsXml}
    ${totalsRowXml}
  </sheetData>
  <mergeCells count="2">
    <mergeCell ref="A1:${lastColLetter}1"/>
    <mergeCell ref="A2:${lastColLetter}2"/>
  </mergeCells>
</worksheet>`;

  const files = [
    { name: "[Content_Types].xml", content: contentTypesXml },
    { name: "_rels/.rels", content: rootRelsXml },
    { name: "xl/workbook.xml", content: workbookXml },
    { name: "xl/_rels/workbook.xml.rels", content: workbookRelsXml },
    { name: "xl/styles.xml", content: stylesXml },
    { name: "xl/worksheets/sheet1.xml", content: sheet1Xml },
  ];

  return {
    files,
    zipBuffer: createZipArchive(files),
  };
}

export function generateStyledExcelXlsxBuffer(options: StyledExcelOptions): Uint8Array {
  return generateStyledExcelXlsxParts(options).zipBuffer;
}

/**
 * Conserve l'export XML pour compatibilité avec les tests existants.
 */
export function generateStyledExcelXml(options: StyledExcelOptions): string {
  const parts = generateStyledExcelXlsxParts(options);
  const styles = parts.files.find((f) => f.name === "xl/styles.xml")?.content || "";
  const sheet = parts.files.find((f) => f.name === "xl/worksheets/sheet1.xml")?.content || "";
  return `<?mso-application progid="Excel.Sheet"?>\n<!-- #0F2942 -->\n${styles}\n${sheet}`;
}

/**
 * Télécharge un véritable classeur Excel OpenXML (.xlsx) stylisé sans aucune alerte de sécurité Excel.
 */
export function downloadStyledExcel(options: StyledExcelOptions): void {
  const zipBuffer = generateStyledExcelXlsxBuffer(options);
  const blob = new Blob([zipBuffer as unknown as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const datePart = new Date().toISOString().split("T")[0];
  const baseName = (options.filename || "export")
    .replace(/\.(xls|xlsx|csv)$/i, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  const fullFilename = `${baseName}_${datePart}.xlsx`;

  try {
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fullFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}
