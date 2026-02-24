/* eslint-disable @typescript-eslint/no-unused-vars */
// src/lib/generateLetterhead.ts
import JSZip from "jszip";
import fs   from "fs";
import path from "path";

export interface LetterheadParams {
  partnerName:       string;
  phone:             string;
  fax:               string;
  address:           string;    // líneas separadas por \n
  website:           string;    // opcional
  partnerLogoUrl:    string;    // Cloudinary secure_url sin transforms
  partnerLogoWidth:  number;    // px display width
  partnerLogoHeight: number;    // px display height
}

// ── px → EMU (96 DPI): 1px = 9525 EMU ───────────────────────────────────────
const PX_TO_EMU = 9525;

// ── Valores originales del template (confirmados inspeccionando header1.xml) ─
const ORIG_LOGO_W_EMU     = 1238250;
const ORIG_LOGO_H_EMU     = 400050;
const ORIG_LOGO_V_OFFSET  = 153007;
const INSZONE_V_OFFSET    = 75565;
const ORIG_POWERED_OFFSET = 877700;
const ORIG_INSZONE_OFFSET = 1729870;

// ── Placeholders de texto ────────────────────────────────────────────────────
const PH_PHONE   = "(123) 456-7890";
const PH_FAX     = "(123) 456-7890";
const PH_ADDR1   = "Address Line 1";
const PH_ADDR2   = "Address Line 2";

// ── Ajustes cuando NO hay fax ────────────────────────────────────────────────
// Header: PHONE etiqueta + valor bajan, websites suben
const NO_FAX_HDR_PHONE_LABEL_DOWN = 90_000;   // EMU — cuánto baja el label PHONE
const NO_FAX_HDR_PHONE_VALUE_DOWN = 90_000;   // EMU — cuánto baja el valor phone
const NO_FAX_HDR_WEBSITE_UP       = -110_000; // EMU — cuánto suben los websites (negativo = subir)

// Footer: sin fax, la sección PHONE se centra en el documento.
// Cálculo: centro columna (≈2_971_800) - centro grupo phone (≈2_501_265) = +470_535
// Positivo = hacia la derecha. Ajusta si el resultado visual no es exacto.
const NO_FAX_FTR_PHONE_SHIFT = 470_535;

export async function generateLetterhead(params: LetterheadParams): Promise<Uint8Array> {
  const {
    phone, fax, address, website,
    partnerLogoUrl, partnerLogoWidth, partnerLogoHeight,
  } = params;

  const hasFax = Boolean(fax?.trim());

  // ── Carga la plantilla ─────────────────────────────────────────────────────
  const templatePath = path.join(process.cwd(), "public", "templates", "letterhead-template.docx");
  const templateBuffer = fs.readFileSync(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);

  // ── 1. Reemplaza el logo del partner ───────────────────────────────────────
  const logoWidthEMU  = Math.round(partnerLogoWidth  * PX_TO_EMU);
  const logoHeightEMU = Math.round(partnerLogoHeight * PX_TO_EMU);

  if (partnerLogoUrl) {
    try {
      const cleanUrl = partnerLogoUrl.replace(
        /\/upload\/(?!(v\d|[^/]+\.(png|jpg|jpeg|webp|gif|svg)))[^/]+\//,
        "/upload/"
      );
      const logoRes = await fetch(cleanUrl);
      if (logoRes.ok) {
        const logoBytes = new Uint8Array(await logoRes.arrayBuffer());
        zip.file("word/media/image1.png", logoBytes);
        console.log(`generateLetterhead: replaced image1.png (${logoBytes.length} bytes)`);
      } else {
        console.warn(`generateLetterhead: logo fetch ${logoRes.status} — ${cleanUrl}`);
      }
    } catch (e) {
      console.error("generateLetterhead: failed to fetch partner logo", e);
    }
  }

  // ── 2. Actualiza header1.xml ───────────────────────────────────────────────
  const header1File = zip.file("word/header1.xml");
  if (!header1File) throw new Error("word/header1.xml not found in template");
  let header1 = await header1File.async("string");

  // 2a. Dimensiones del logo del partner
  header1 = replaceAll(
    header1,
    `cx="${ORIG_LOGO_W_EMU}" cy="${ORIG_LOGO_H_EMU}"`,
    `cx="${logoWidthEMU}" cy="${logoHeightEMU}"`
  );

  // 2b. Alineación vertical del logo del partner
  const inszoneHeight  = 571313;
  const centerAdjust   = Math.max(0, Math.round((inszoneHeight - logoHeightEMU) / 2));
  const newLogoVOffset = INSZONE_V_OFFSET + centerAdjust;
  header1 = header1.replace(
    `anchorId="6B451EAB" wp14:editId="06E16EEE"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>-463550</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>${ORIG_LOGO_V_OFFSET}</wp:posOffset>`,
    `anchorId="6B451EAB" wp14:editId="06E16EEE"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>-463550</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>${newLogoVOffset}</wp:posOffset>`
  );

  // 2c. Reposiciona "Powered by" e Inszone logo según ancho del partner
  const partnerLogoLeft = -463550;
  const poweredByGap    =  103000;
  const poweredByWidth  =  728345;
  const inszoneGap      =  123825;

  const newPoweredByOffset = partnerLogoLeft + logoWidthEMU + poweredByGap;
  const newInszoneOffset   = newPoweredByOffset + poweredByWidth + inszoneGap;

  header1 = header1.replace(
    `<wp:posOffset>${ORIG_POWERED_OFFSET}</wp:posOffset>`,
    `<wp:posOffset>${newPoweredByOffset}</wp:posOffset>`
  );
  header1 = header1.replace(
    `<wp:posOffset>${ORIG_INSZONE_OFFSET}</wp:posOffset>`,
    `<wp:posOffset>${newInszoneOffset}</wp:posOffset>`
  );

  // 2d. Teléfono y fax en header
  header1 = replaceInAnchor(header1, "19088A23", "(123) 456-7890", escapeXml(phone));
  header1 = replaceInAnchor(header1, "10D4234C", "(123) 456-7890", escapeXml(hasFax ? (fax ?? phone) : phone));
  header1 = replaceAll(header1, PH_PHONE, escapeXml(phone));

  // 2e. Website del partner
  if (website?.trim()) {
    header1 = replaceWebsiteTxbxContent(header1, website.trim());
  } else {
    header1 = replaceWebsiteTxbxContent(header1, "");
  }

  // 2f. Ajustes cuando NO hay fax ─────────────────────────────────────────────
  if (!hasFax) {
    // Elimina etiqueta FAX (anchorId="3B25121F") y valor FAX (anchorId="10D4234C")
    header1 = removeRunContainingAnchorId(header1, "3B25121F");
    header1 = removeRunContainingAnchorId(header1, "10D4234C");

    // El label PHONE (49113BA1) y el valor phone (19088A23) bajan un poco
    header1 = adjustWpAnchorPosV(header1, "49113BA1", NO_FAX_HDR_PHONE_LABEL_DOWN);
    header1 = adjustWpAnchorPosV(header1, "19088A23", NO_FAX_HDR_PHONE_VALUE_DOWN);

    // Los websites suben un poco: inszone (7627EFE0), partner (191C097A) e ícono globo (4B56BAE3)
    header1 = adjustWpAnchorPosV(header1, "7627EFE0", NO_FAX_HDR_WEBSITE_UP);
    header1 = adjustWpAnchorPosV(header1, "191C097A", NO_FAX_HDR_WEBSITE_UP);
    header1 = adjustWpAnchorPosV(header1, "4B56BAE3", NO_FAX_HDR_WEBSITE_UP);
  }

  zip.file("word/header1.xml", header1);

  // ── 3. Actualiza footer1.xml ───────────────────────────────────────────────
  const footer1File = zip.file("word/footer1.xml");
  if (!footer1File) throw new Error("word/footer1.xml not found in template");
  let footer1 = await footer1File.async("string");

  // 3a. Teléfono y fax en footer
  footer1 = replaceInAnchor(footer1, "57287E4F", "(123) 456-7890", escapeXml(phone));
  footer1 = replaceInAnchor(footer1, "3BD21793", "(123) 456-7890", escapeXml(hasFax ? (fax ?? phone) : phone));

  // 3b. Dirección
  const addressLines = address.trim().split("\n").filter(Boolean);
  footer1 = replaceAddressTxbxContent(footer1, addressLines);

  // 3c. Ajustes cuando NO hay fax ─────────────────────────────────────────────
  if (!hasFax) {
    // Elimina icono FAX (573D981B), etiqueta FAX (19071B4E) y valor FAX (3BD21793)
    footer1 = removeRunContainingAnchorId(footer1, "573D981B");
    footer1 = removeRunContainingAnchorId(footer1, "19071B4E");
    footer1 = removeRunContainingAnchorId(footer1, "3BD21793");

    // Desplaza la sección PHONE a la izquierda (~mitad del bloque FAX)
    // Icono PHONE (65524ED4), etiqueta PHONE (79D1B25D), valor phone (57287E4F)
    footer1 = adjustWpAnchorPosH(footer1, "65524ED4", NO_FAX_FTR_PHONE_SHIFT);
    footer1 = adjustWpAnchorPosH(footer1, "79D1B25D", NO_FAX_FTR_PHONE_SHIFT);
    footer1 = adjustWpAnchorPosH(footer1, "57287E4F", NO_FAX_FTR_PHONE_SHIFT);
  }

  zip.file("word/footer1.xml", footer1);

  // ── 4. Genera el buffer de salida ──────────────────────────────────────────
  return zip.generateAsync({
    type:               "uint8array",
    compression:        "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

// ── Helpers de texto ──────────────────────────────────────────────────────────

function replaceAll(xml: string, search: string, replacement: string): string {
  return xml.split(search).join(replacement);
}

function replaceInAnchor(xml: string, anchorId: string, search: string, replacement: string): string {
  const startMarker = `wp14:anchorId="${anchorId}"`;
  const startIdx = xml.indexOf(startMarker);
  if (startIdx === -1) return xml;

  const endMarker = "</wp:anchor>";
  const endIdx = xml.indexOf(endMarker, startIdx);
  if (endIdx === -1) return xml;

  const endIdxFull = endIdx + endMarker.length;
  const before = xml.slice(0, startIdx);
  let   anchor = xml.slice(startIdx, endIdxFull);
  const after  = xml.slice(endIdxFull);

  const searchIdx = anchor.indexOf(search);
  if (searchIdx !== -1) {
    anchor = anchor.slice(0, searchIdx) + replacement + anchor.slice(searchIdx + search.length);
  }

  return before + anchor + after;
}

function replaceWebsiteTxbxContent(xml: string, websiteValue: string): string {
  const rpr = `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="6F8CC0"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-PE"/></w:rPr>`;
  const newContent = websiteValue
    ? `<w:txbxContent><w:p w14:paraId="1DA1BCF0" w14:textId="4981B0EC" w:rsidR="0086766E" w:rsidRDefault="00482B11" w:rsidP="00C8244B"><w:pPr><w:jc w:val="right"/>${rpr}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="6F8CC0"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-PE"/></w:rPr><w:t>${escapeXml(websiteValue)}</w:t></w:r></w:p></w:txbxContent>`
    : `<w:txbxContent><w:p w14:paraId="1DA1BCF0" w14:textId="4981B0EC" w:rsidR="0086766E" w:rsidRDefault="00482B11" w:rsidP="00C8244B"><w:pPr><w:jc w:val="right"/></w:pPr></w:p></w:txbxContent>`;

  const pattern = /(wp14:anchorId="191C097A"[\s\S]*?<wps:txbx>\s*)<w:txbxContent>[\s\S]*?<\/w:txbxContent>(\s*<\/wps:txbx>)/;
  if (pattern.test(xml)) {
    return xml.replace(pattern, `$1${newContent}$2`);
  }
  xml = xml.replace(/<w:t>website<\/w:t>[\s\S]*?<w:t>\.com<\/w:t>/, `<w:t>${escapeXml(websiteValue)}</w:t>`);
  return xml;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function replaceAddressTxbxContent(xml: string, lines: string[]): string {
  const paraIds = ["109CDFD0", "3B000054", "AA1BB2CC", "DD3EE4FF"];
  const newParagraphs = lines.slice(0, 4)
    .map((line, i) => makeAddressParagraph(escapeXml(line), paraIds[i] ?? `AAAA${i}000`))
    .join("\n");

  const pattern = /(wp14:anchorId="3A1005E1"[\s\S]*?<wps:txbx>\s*<w:txbxContent>)([\s\S]*?)(<\/w:txbxContent>\s*<\/wps:txbx>)/;
  if (pattern.test(xml)) {
    xml = xml.replace(pattern, `$1\n${newParagraphs}\n$3`);
  } else {
    xml = replaceAll(xml, PH_ADDR1, escapeXml(lines[0] || ""));
    xml = replaceAll(xml, PH_ADDR2, escapeXml(lines[1] || ""));
  }

  xml = replaceAll(xml, PH_ADDR1, escapeXml(lines[0] || ""));
  xml = replaceAll(xml, PH_ADDR2, escapeXml(lines[1] || ""));

  return xml;
}

function makeAddressParagraph(text: string, paraId: string): string {
  return `<w:p w14:paraId="${paraId}" w14:textId="77777777" w:rsidR="001D0B62" w:rsidRDefault="001D0B62" w:rsidP="001D0B62"><w:pPr><w:spacing w:after="0" w:line="200" w:lineRule="exact"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="FFFFFF" w:themeColor="background1"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="FFFFFF" w:themeColor="background1"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

// ── Helpers de posicionamiento ────────────────────────────────────────────────

/**
 * Encuentra los límites del elemento <wp:anchor> que contiene el anchorId dado.
 * El anchorId puede estar en <wp:anchor> directamente (imágenes) o dentro de
 * <mc:AlternateContent> (text boxes). En ambos casos el anchorId está dentro
 * del bloque <wp:anchor>...</wp:anchor>.
 */
function findWpAnchorBounds(xml: string, anchorId: string, fromIdx = 0): [number, number] | null {
  const marker = `wp14:anchorId="${anchorId}"`;
  const markerIdx = xml.indexOf(marker, fromIdx);
  if (markerIdx === -1) return null;

  // Retrocede hasta encontrar <wp:anchor (máximo 800 chars atrás)
  let anchorStart = -1;
  for (let i = markerIdx; i >= Math.max(0, markerIdx - 800); i--) {
    if (xml.slice(i, i + 10) === "<wp:anchor") {
      anchorStart = i;
      break;
    }
  }
  if (anchorStart === -1) return null;

  const endMarker = "</wp:anchor>";
  const endIdx = xml.indexOf(endMarker, markerIdx);
  if (endIdx === -1) return null;

  return [anchorStart, endIdx + endMarker.length];
}

/**
 * Ajusta el posOffset de positionH de un <wp:anchor> en deltaEMU.
 */
function adjustWpAnchorPosH(xml: string, anchorId: string, deltaEMU: number): string {
  const bounds = findWpAnchorBounds(xml, anchorId);
  if (!bounds) return xml;
  const [start, end] = bounds;

  let anchor = xml.slice(start, end);
  anchor = anchor.replace(
    /(<wp:positionH\b[^>]*>\s*<wp:posOffset>)(-?\d+)(<\/wp:posOffset>)/,
    (_, pre, val, post) => `${pre}${Math.round(parseInt(val, 10) + deltaEMU)}${post}`
  );

  return xml.slice(0, start) + anchor + xml.slice(end);
}

/**
 * Ajusta el posOffset de positionV de un <wp:anchor> en deltaEMU.
 */
function adjustWpAnchorPosV(xml: string, anchorId: string, deltaEMU: number): string {
  const bounds = findWpAnchorBounds(xml, anchorId);
  if (!bounds) return xml;
  const [start, end] = bounds;

  let anchor = xml.slice(start, end);
  anchor = anchor.replace(
    /(<wp:positionV\b[^>]*>\s*<wp:posOffset>)(-?\d+)(<\/wp:posOffset>)/,
    (_, pre, val, post) => `${pre}${Math.round(parseInt(val, 10) + deltaEMU)}${post}`
  );

  return xml.slice(0, start) + anchor + xml.slice(end);
}

/**
 * Elimina el <w:r>...</w:r> que contiene un anchor con el anchorId dado.
 *
 * Estructura esperada:
 *   <w:r [attrs?]><w:rPr>...</w:rPr><w:drawing>..anchor..</w:drawing></w:r>
 *   <w:r [attrs?]><w:rPr>...</w:rPr><mc:AlternateContent>..anchor..</mc:AlternateContent></w:r>
 *
 * El anchorId aparece dentro del <wp:anchor> que está dentro de uno de los dos
 * formatos anteriores. Buscamos el <w:r> más cercano antes del marker y
 * rastreamos la profundidad para encontrar el </w:r> correcto.
 */
function removeRunContainingAnchorId(xml: string, anchorId: string): string {
  const marker = `wp14:anchorId="${anchorId}"`;
  const markerIdx = xml.indexOf(marker);
  if (markerIdx === -1) return xml;

  // Busca el <w:r que abre este run (hasta 4000 chars atrás)
  let runStart = -1;
  for (let i = markerIdx; i >= Math.max(0, markerIdx - 4000); i--) {
    if (xml[i] === "<" && xml[i + 1] === "w" && xml[i + 2] === ":" && xml[i + 3] === "r") {
      const next = xml[i + 4];
      if (next === ">" || next === " " || next === "\t" || next === "\n" || next === "\r") {
        runStart = i;
        break;
      }
    }
  }
  if (runStart === -1) {
    console.warn(`removeRunContainingAnchorId: no <w:r> found for anchorId="${anchorId}"`);
    return xml;
  }

  // Avanza hasta el final del tag de apertura <w:r ...>
  const openTagEnd = xml.indexOf(">", runStart) + 1;

  // Rastrea profundidad para encontrar el </w:r> correcto
  let depth = 1;
  let pos = openTagEnd;
  let runEnd = -1;

  while (pos < xml.length && depth > 0) {
    const nextOpen  = findNextWrOpen(xml, pos);
    const nextClose = xml.indexOf("</w:r>", pos);

    if (nextClose === -1) break;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      // Avanza past el tag de apertura
      pos = xml.indexOf(">", nextOpen) + 1;
    } else {
      depth--;
      pos = nextClose + 6; // 6 = "</w:r>".length
      if (depth === 0) {
        runEnd = pos;
        break;
      }
    }
  }

  if (runEnd === -1) {
    console.warn(`removeRunContainingAnchorId: no closing </w:r> found for anchorId="${anchorId}"`);
    return xml;
  }

  return xml.slice(0, runStart) + xml.slice(runEnd);
}

/**
 * Encuentra el índice del siguiente <w:r> (o <w:r attr...>) sin coincidir con
 * <w:rPr>, <w:rsidR>, <w:rStyle>, etc.
 */
function findNextWrOpen(xml: string, from: number): number {
  let pos = from;
  while (pos < xml.length) {
    const idx = xml.indexOf("<w:r", pos);
    if (idx === -1) return -1;
    const next = xml[idx + 4];
    if (next === ">" || next === " " || next === "\t" || next === "\n" || next === "\r") {
      return idx;
    }
    pos = idx + 1;
  }
  return -1;
}