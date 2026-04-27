/* eslint-disable @typescript-eslint/no-unused-vars */
// src/lib/outlookSignature.ts
export type SignatureType = "basic" | "powered-by" | "formerly";

export type SignatureInput = {
  fullName: string;
  title: string;
  contactLines: string;   // pre-built, ordered: Phone / Office / SMS / Fax
  email: string;
  address: string;
  lic?: string;
  /** Processed Cloudinary URL (white bg + padding + resize) — not used for "basic" */
  partnerLogoUrl?: string;
  /** Visual width from upload response (box.w) */
  partnerLogoWidth?: number;
  /** Visual height from upload response (box.h) */
  partnerLogoHeight?: number;
  /** Signature layout type — defaults to "powered-by" */
  signatureType?: SignatureType;
  /** Show certificate request info block (for basic and formerly types) */
  certRequest?: boolean;
  /** Optional review link URL — rendered as "Click here" at bottom of signature */
  reviewLink?: string;
};

// ─────────────────────────────────────────────────────────────

const INSZONE_LOGO_URL =
  "https://inszoneinsurance.com/wp-content/uploads/2026/01/logo-inszone.png";
const FACEBOOK_URL =
  "https://inszoneinsurance.com/wp-content/uploads/2026/02/facebook.png";
const TWITTER_URL =
  "https://inszoneinsurance.com/wp-content/uploads/2026/02/twitter.png";
const LINKEDIN_URL =
  "https://inszoneinsurance.com/wp-content/uploads/2026/02/linkedin.png";

function esc(s: string) {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nl2br(s: string) {
  return esc(s).replaceAll("\n", "<br>");
}

// ── Right column HTML ─────────────────────────────────────────

function buildRightColumn(
  partnerLogoUrl: string,
  logoW: number,
  logoH: number,
  type: SignatureType,
  basicAddress: string,
  certRequest: boolean
): string {
  const inszoneImg = `<img src="${INSZONE_LOGO_URL}" alt="Inszone Insurance" style="display:inline">`;

  if (type === "basic") {
    const addressHtml = nl2br(basicAddress.trim());
    return `
      <p style="margin:0;text-align:left;">
        ${inszoneImg}
      </p>
      <p style="font-family:Arial,sans-serif;font-size:12px;margin:12px 0 0;text-align:left;color:#000;line-height:16px;">${addressHtml}</p>`;
  }

  const partnerImg = partnerLogoUrl
    ? `<img src="${partnerLogoUrl}" alt="Partner" width="${logoW}" height="${logoH}" style="display:block;margin:0 auto 6px;width:${logoW}px;height:${logoH}px;object-fit:contain;">`
    : "";

  if (type === "formerly") {
    return `
      <p style="margin:0;text-align:center;">
        ${inszoneImg}
      </p>
      <p style="font-family:Arial,sans-serif;font-size:12px;display:block;margin:12px 0;color:#6F8CC0;font-weight:bold;text-align:center;">formerly operating as</p>
      <p style="margin:0;text-align:center;">
        ${partnerImg}
      </p>`;
  }

  // default: "powered-by"
  return `
    <p style="margin:0;text-align:center;">
      ${partnerImg}
    </p>
    <p style="font-family:Arial,sans-serif;font-size:12px;display:block;margin:0 0 8px;color:#6F8CC0;font-weight:bold;text-align:center;">powered by</p>
    <p style="margin:0;text-align:center;">
      ${inszoneImg}
    </p>`;
}

// ── Main builder ──────────────────────────────────────────────

export function buildOutlookSignatureHtml(input: SignatureInput): string {
  const signatureType = input.signatureType ?? "powered-by";

  // Name color: basic uses text color, others use accent
  const nameColor = signatureType === "basic" ? "#000" : "#6F8CC0";

  const fullName     = esc(input.fullName.trim());
  const title        = nl2br(input.title.trim()).toUpperCase();
  const contactLines = nl2br((input.contactLines ?? "").trim());
  const email        = esc(input.email.trim());
  const rawAddress   = (input.address ?? "").trim() || (signatureType === "basic" ? "" : "");
  const address      = nl2br(rawAddress);
  const lic          = input.lic ? esc(input.lic.trim()) : "";
  const partnerLogoUrl = input.partnerLogoUrl ?? "";
  const logoW        = input.partnerLogoWidth  ?? 96;
  const logoH        = input.partnerLogoHeight ?? 96;
  const certRequest  = input.certRequest ?? false;
  const reviewLink   = input.reviewLink?.trim() ?? "";

  const rightColumn  = buildRightColumn(partnerLogoUrl, logoW, logoH, signatureType, rawAddress, certRequest);

  const certBlock = certRequest && (signatureType === "basic" || signatureType === "formerly")
    ? `<p style="font-family:Arial,sans-serif;margin:12px 0 0;font-size:12px;line-height:16px;text-align:left;">
        <span style="color:#f00;">Certificate Request</span><br>
        Fax: 916-636-0134<br>
        Email: <a href="mailto:certs@inszoneins.com" style="color:#6F8CC0;text-decoration:underline;">certs@inszoneins.com</a>
      </p>`
    : "";

  const reviewBlock = reviewLink
    ? `<p style="margin:24px 0 0;font-family:Arial,sans-serif;font-size:12px;line-height:16px;color:#000;">Did I provide you with excellent service? Click <a href="${esc(reviewLink)}" target="_blank" style="color:#6F8CC0;text-decoration:underline;">here</a> to submit a review!</p>`
    : "";

  return `
<!-- START SIGNATURE -->
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;line-height:16px;color:#000;">
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr>
          <!-- LEFT COLUMN -->
          <td valign="top" style="text-align:right;padding-right:16px;border-right:2px solid #6F8CC0;">
            <p style="font-family:Arial,sans-serif;margin:0 0 4px;font-size:19px;color:${nameColor};"><b>${fullName}</b></p>
            <p style="font-family:Arial,sans-serif;margin:0;font-size:12px;color:#000;line-height:16px;">${title}</p>
            <p style="font-family:Arial,sans-serif;margin:12px 0 0;font-size:12px;line-height:16px;color:#000;">
              ${contactLines}<br>
              <a href="mailto:${email}" style="font-family:Arial,sans-serif;font-size:12px;color:#6F8CC0;text-decoration:underline">${email}</a>
            </p>
            ${signatureType !== "basic" && address ? `<p style="font-family:Arial,sans-serif;margin:12px 0 0;font-size:12px;line-height:16px;color:#000;">${address}</p>` : ""}
            ${lic ? `<p style="font-family:Arial,sans-serif;margin:12px 0 0;font-size:12px;letter-spacing:1.5pt;">${lic}</p>` : ""}
            <table cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;display:inline-table;border-collapse:collapse;">
              <tr>
                <td style="padding:0;">
                  <a href="https://www.facebook.com/InszoneInsuranceServices/" target="_blank" style="text-decoration:none;">
                    <img src="${FACEBOOK_URL}" alt="Facebook" style="display:block;border:0;">
                  </a>
                </td>
                <td style="width:4px;"></td>
                <td style="padding:0;">
                  <a href="https://twitter.com/InszoneIns" target="_blank" style="text-decoration:none;">
                    <img src="${TWITTER_URL}" alt="Twitter" style="display:block;border:0;">
                  </a>
                </td>
                <td style="width:4px;"></td>
                <td style="padding:0;">
                  <a href="https://www.linkedin.com/company/inszone-insurance-services-inc-" target="_blank" style="text-decoration:none;">
                    <img src="${LINKEDIN_URL}" alt="Linkedin" style="display:block;border:0;">
                  </a>
                </td>
              </tr>
            </table>
          </td>

          <!-- RIGHT COLUMN -->
          <td valign="top" style="padding-left:16px;">
            ${rightColumn}
            <p style="font-family:Arial,sans-serif;font-size:12px;margin:16px 0 8px;text-align:left;">
              <a href="https://inszoneinsurance.com/" target="_blank" style="color:#6F8CC0;text-decoration:underline;">INSZONEINSURANCE.COM</a>
            </p>
            <p style="font-family:Arial,sans-serif;font-size:12px;margin:0;letter-spacing:1.5pt;text-align:left;">LIC #0F82764</p>
            ${certBlock}
          </td>
        </tr>
      </table>
      ${reviewBlock}
    </td>
  </tr>
</table>
<!-- END SIGNATURE -->
`.trim();
}