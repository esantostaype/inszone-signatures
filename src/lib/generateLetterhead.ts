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
// Partner logo: anchorId=6B451EAB, rId1 → media/image1.png
const ORIG_LOGO_W_EMU     = 1238250;  // cx real en header1.xml
const ORIG_LOGO_H_EMU     = 400050;   // cy real en header1.xml
// Posicion vertical: partner logo posV=153007, Inszone posV=75565
// Para alinear verticalmente, fijamos el partner al mismo Y que Inszone
const ORIG_LOGO_V_OFFSET  = 153007;
const INSZONE_V_OFFSET    = 75565;
// "Powered by" text box: anchorId=59D1F479, posH real=877700
const ORIG_POWERED_OFFSET = 877700;
// Inszone logo: anchorId=21F7BD10, posH real=1729870
const ORIG_INSZONE_OFFSET = 1729870;

// ── Placeholders de texto ────────────────────────────────────────────────────
const PH_PHONE   = "(123) 456-7890";   // placeholder real en el nuevo template
const PH_FAX     = "(123) 456-7890";   // mismo placeholder para phone y fax
const PH_WEBSITE_FULL = "website.com"; // placeholder completo (si está junto)
// El website en header está split en 2 runs: "website" + ".com"
// Lo reemplazamos sustituyendo el txbxContent del anchorId 191C097A
// Footer address — placeholders reales en el template XML
const PH_ADDR1   = "Address Line 1";
const PH_ADDR2   = "Address Line 2";

export async function generateLetterhead(params: LetterheadParams): Promise<Uint8Array> {
  const {
    phone, fax, address, website,
    partnerLogoUrl, partnerLogoWidth, partnerLogoHeight,
  } = params;

  // ── Carga la plantilla ─────────────────────────────────────────────────────
  const templatePath = path.join(process.cwd(), "public", "templates", "letterhead-template.docx");
  const templateBuffer = fs.readFileSync(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);

  // ── 1. Reemplaza el logo del partner ───────────────────────────────────────
  // El logo del partner está en word/media/image1.png (rId1 en header1.xml.rels)
  const logoWidthEMU  = Math.round(partnerLogoWidth  * PX_TO_EMU);
  const logoHeightEMU = Math.round(partnerLogoHeight * PX_TO_EMU);

  if (partnerLogoUrl) {
    try {
      // Descarga la imagen limpia — elimina transforms de Cloudinary si los hay
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

  // 2a. Dimensiones del logo del partner — reemplaza wp:extent y a:ext
  header1 = replaceAll(
    header1,
    `cx="${ORIG_LOGO_W_EMU}" cy="${ORIG_LOGO_H_EMU}"`,
    `cx="${logoWidthEMU}" cy="${logoHeightEMU}"`
  );

  // 2b. Alineación vertical: fija el partner logo al mismo Y que el Inszone logo (75565 EMU)
  //     Originalmente el partner tiene posV=153007, pero el Inszone tiene posV=75565.
  //     Para que ambos queden a la misma altura (imagen 2 = correcto), ajustamos el partner.
  //     También centramos verticalmente: si el partner es más pequeño, añadimos padding.
  const inszoneHeight    = 571313;  // cy del Inszone logo (del XML)
  const centerAdjust     = Math.max(0, Math.round((inszoneHeight - logoHeightEMU) / 2));
  const newLogoVOffset   = INSZONE_V_OFFSET + centerAdjust;
  header1 = header1.replace(
    `anchorId="6B451EAB" wp14:editId="06E16EEE"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>-463550</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>${ORIG_LOGO_V_OFFSET}</wp:posOffset>`,
    `anchorId="6B451EAB" wp14:editId="06E16EEE"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>-463550</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>${newLogoVOffset}</wp:posOffset>`
  );

  // 2c. Reposiciona "Powered by" e Inszone logo según el ancho del partner logo.
  //     partnerLogoLeft=-463550 (fijo en XML), gap y ancho de cada elemento son constantes.
  const partnerLogoLeft = -463550;
  const poweredByGap    =  103000;   // gap logo → "Powered by"
  const poweredByWidth  =  728345;   // ancho text box "Powered by"
  const inszoneGap      =  123825;   // gap "Powered by" → Inszone logo

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

  // 2d. Teléfono y fax: en el nuevo template AMBOS tienen el mismo placeholder "(123) 456-7890".
  //     Hay 4 instancias: 2 en header (phone grande, fax grande) + en mc:Fallback.
  //     Estrategia: reemplazar por anchorId para controlar qué va a cada uno.
  // Phone boxes: anchorId 19088A23 (phone grande) y 10D4234C (fax grande)
  // mc:Choice (wps shape) — reemplazo por anchorId
  header1 = replaceInAnchor(header1, "19088A23", "(123) 456-7890", escapeXml(phone));
  header1 = replaceInAnchor(header1, "10D4234C", "(123) 456-7890", escapeXml(fax || phone));
  // mc:Fallback (VML) también usa los mismos anchorIds via w14:anchorId en v:shape
  // replaceInAnchor los cubre también. El safety replaceAll solo queda para casos residuales.
  header1 = replaceAll(header1, PH_PHONE, escapeXml(phone));  // safety net para cualquier resto

  // 2e. Website del partner: en el template está split en 2 runs "website" + ".com"
  //     Reemplazamos el txbxContent completo del anchorId 191C097A
  if (website?.trim()) {
    header1 = replaceWebsiteTxbxContent(header1, website.trim());
  } else {
    // Si no hay website, vaciamos la caja
    header1 = replaceWebsiteTxbxContent(header1, "");
  }

  zip.file("word/header1.xml", header1);

  // ── 3. Actualiza footer1.xml ───────────────────────────────────────────────
  const footer1File = zip.file("word/footer1.xml");
  if (!footer1File) throw new Error("word/footer1.xml not found in template");
  let footer1 = await footer1File.async("string");

  // 3a. Teléfono y fax en el footer
  //     En el footer los anchorIds son 3BD21793 (phone) y 57287E4F (fax)
  //     Mismo placeholder "(123) 456-7890" para ambos → reemplazar por anchorId
  footer1 = replaceInAnchor(footer1, "57287E4F", "(123) 456-7890", escapeXml(phone));
  footer1 = replaceInAnchor(footer1, "3BD21793", "(123) 456-7890", escapeXml(fax || phone));
  // replaceAll como safety net para mc:Fallback

  // 3b. Dirección — reemplaza el txbxContent del address box (anchorId=3A1005E1).
  //     Los placeholders reales son "Address Line 1" y "Address Line 2",
  //     pero están distribuidos en múltiples runs con <w:proofErr> entre ellos.
  //     La estrategia es reemplazar el txbxContent completo con párrafos limpios.
  const addressLines = address.trim().split("\n").filter(Boolean);
  footer1 = replaceAddressTxbxContent(footer1, addressLines);

  zip.file("word/footer1.xml", footer1);

  // ── 4. Genera el buffer de salida ──────────────────────────────────────────
  return zip.generateAsync({
    type:               "uint8array",
    compression:        "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function replaceAll(xml: string, search: string, replacement: string): string {
  return xml.split(search).join(replacement);
}

/**
 * Reemplaza un texto SOLO dentro del anchor que tenga el anchorId dado.
 * Estrategia: divide el XML en 3 partes (antes, anchor, después) y solo
 * modifica la parte del anchor. Más seguro que un regex greedy.
 */
function replaceInAnchor(xml: string, anchorId: string, search: string, replacement: string): string {
  // Marca de inicio: el atributo anchorId único
  const startMarker = `wp14:anchorId="${anchorId}"`;
  const startIdx = xml.indexOf(startMarker);
  if (startIdx === -1) return xml; // anchorId no encontrado, no modificar

  // Marca de fin: </wp:anchor> — buscar desde startIdx
  const endMarker = "</wp:anchor>";
  const endIdx = xml.indexOf(endMarker, startIdx);
  if (endIdx === -1) return xml;

  const endIdxFull = endIdx + endMarker.length;

  // Divide el XML en 3 partes
  const before  = xml.slice(0, startIdx);
  let   anchor  = xml.slice(startIdx, endIdxFull);
  const after   = xml.slice(endIdxFull);

  // Reemplaza SOLO la primera ocurrencia del placeholder dentro del anchor
  const searchIdx = anchor.indexOf(search);
  if (searchIdx !== -1) {
    anchor = anchor.slice(0, searchIdx) + replacement + anchor.slice(searchIdx + search.length);
  }

  return before + anchor + after;
}

/**
 * Reemplaza el txbxContent del website box del partner (anchorId=191C097A).
 * El template tiene el website split en 2 runs: "website" + ".com"
 * Reemplazamos todo el txbxContent con un único run limpio.
 */
function replaceWebsiteTxbxContent(xml: string, websiteValue: string): string {
  const rpr = `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="6F8CC0"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-PE"/></w:rPr>`;
  const newContent = websiteValue
    ? `<w:txbxContent><w:p w14:paraId="1DA1BCF0" w14:textId="4981B0EC" w:rsidR="0086766E" w:rsidRDefault="00482B11" w:rsidP="00C8244B"><w:pPr><w:jc w:val="right"/>${rpr}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="6F8CC0"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-PE"/></w:rPr><w:t>${escapeXml(websiteValue)}</w:t></w:r></w:p></w:txbxContent>`
    : `<w:txbxContent><w:p w14:paraId="1DA1BCF0" w14:textId="4981B0EC" w:rsidR="0086766E" w:rsidRDefault="00482B11" w:rsidP="00C8244B"><w:pPr><w:jc w:val="right"/></w:pPr></w:p></w:txbxContent>`;

  const pattern = /(wp14:anchorId="191C097A"[\s\S]*?<wps:txbx>\s*)<w:txbxContent>[\s\S]*?<\/w:txbxContent>(\s*<\/wps:txbx>)/;
  if (pattern.test(xml)) {
    return xml.replace(pattern, `$1${newContent}$2`);
  }
  // Fallback: reemplazar los runs individuales
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

/**
 * Reemplaza el txbxContent del address box (anchorId=3A1005E1) en footer1.xml.
 *
 * El template tiene 2 párrafos con texto "Address Line 1" / "Address Line 2"
 * separados en múltiples <w:r> con <w:proofErr> tags intermedios.
 * El patrón busca el anchorId único y reemplaza todo el txbxContent.
 */
function replaceAddressTxbxContent(xml: string, lines: string[]): string {
  const paraIds = ["109CDFD0", "3B000054", "AA1BB2CC", "DD3EE4FF"];
  const newParagraphs = lines.slice(0, 4)
    .map((line, i) => makeAddressParagraph(escapeXml(line), paraIds[i] ?? `AAAA${i}000`))
    .join("\n");

  // Localiza el txbxContent dentro del anchor con anchorId="3A1005E1"
  // El anchorId es único en el footer, así que el patrón es inequívoco.
  const pattern = /(wp14:anchorId="3A1005E1"[\s\S]*?<wps:txbx>\s*<w:txbxContent>)([\s\S]*?)(<\/w:txbxContent>\s*<\/wps:txbx>)/;

  if (pattern.test(xml)) {
    xml = xml.replace(pattern, `$1\n${newParagraphs}\n$3`);
  } else {
    // Fallback: reemplazo por texto plano (cubre mc:Fallback VML)
    // "Address" y "Line 1" pueden estar en runs separados — reemplazamos el compuesto
    xml = replaceAll(xml, PH_ADDR1, escapeXml(lines[0] || ""));
    xml = replaceAll(xml, PH_ADDR2, escapeXml(lines[1] || ""));
  }

  // Siempre también reemplaza en el VML fallback (mc:Fallback)
  xml = replaceAll(xml, PH_ADDR1, escapeXml(lines[0] || ""));
  xml = replaceAll(xml, PH_ADDR2, escapeXml(lines[1] || ""));

  return xml;
}

/** Párrafo con estilo texto blanco, Arial 9pt, espaciado compacto */
function makeAddressParagraph(text: string, paraId: string): string {
  return `<w:p w14:paraId="${paraId}" w14:textId="77777777" w:rsidR="001D0B62" w:rsidRDefault="001D0B62" w:rsidP="001D0B62"><w:pPr><w:spacing w:after="0" w:line="180" w:lineRule="exact"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="FFFFFF" w:themeColor="background1"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="FFFFFF" w:themeColor="background1"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}