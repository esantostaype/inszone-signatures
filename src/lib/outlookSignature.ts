// src/lib/outlookSignature.ts
export type SignatureType = "powered-by" | "formerly";

export type SignatureInput = {
  fullName: string;
  title: string;
  contactLines: string;
  email: string;
  address: string;
  lic?: string;
  /** Processed Cloudinary URL (white bg + padding + resize) */
  partnerLogoUrl?: string;
  /** Visual width from upload response (box.w) */
  partnerLogoWidth?: number;
  /** Visual height from upload response (box.h) */
  partnerLogoHeight?: number;
  /** Signature layout type — defaults to "powered-by" */
  signatureType?: SignatureType;
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
  type: SignatureType
): string {
  const partnerImg = partnerLogoUrl
    ? `<img src="${partnerLogoUrl}" alt="Partner" style="display:block;margin:0 auto 6px;object-fit:contain;">`
    : "";

  const inszoneImg = `<img src="${INSZONE_LOGO_URL}" alt="Inszone Insurance" style="display:inline">`;

  if (type === "formerly") {
    return `
      <p style="margin:0;text-align:center;">
        ${inszoneImg}</p>
        <p style="display:block;margin:8px 0;color:#6F8CC0;font-weight:bold; text-align:center;">formerly operating as</p>
        <p style="margin:0;text-align:center;">${partnerImg}
      </p>`;
  }

  // default: "powered-by"
  return `
    <p style="margin:0;text-align:center;">
      ${partnerImg}</p>
      <p style="display:block;margin:0 0 8px;color:#6F8CC0;font-weight:bold; text-align:center;">powered by</p>
      <p style="margin:0;text-align:center;">${inszoneImg}
    </p>`;
}

// ── Main builder ──────────────────────────────────────────────

export function buildOutlookSignatureHtml(input: SignatureInput): string {
  const fullName = esc(input.fullName.trim());
  const title = esc(input.title.trim()).toUpperCase();
  const contactLines = nl2br((input.contactLines ?? "").trim());
  const email = esc(input.email.trim());
  const address = nl2br((input.address ?? "").trim());
  const lic = input.lic ? esc(input.lic.trim()) : "";
  const partnerLogoUrl = input.partnerLogoUrl ?? "";
  const logoW = input.partnerLogoWidth ?? 96;
  const logoH = input.partnerLogoHeight ?? 96;
  const signatureType = input.signatureType ?? "powered-by";

  const rightColumn = buildRightColumn(partnerLogoUrl, logoW, logoH, signatureType);

  return `
<!-- START SIGNATURE -->
<table cellpadding="0" cellspacing="0" border="0"
  style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;line-height:16px;color:#364153;">
  <tr>
    <!-- LEFT COLUMN -->
    <td valign="top" style="text-align:right;padding-right:16px;border-right:2px solid #6F8CC0;">
      <p style="margin:0 0 2px;font-size:18px;color:#6F8CC0;"><b>${fullName}</b></p>
      <p style="margin:0;color:#364153;">${title}</p>
      <p style="margin:12px 0 0;color:#364153;">
        ${contactLines}<br>
        <a href="mailto:${email}" style="color:#6F8CC0;text-decoration:underline">${email}</a>
      </p>
      <p style="margin:12px 0 0;color:#364153;">${address} aaa</p>
      ${lic ? `<p style="margin:12px 0 0;letter-spacing:1.5pt;">${lic}</p>` : ""}
        <table cellpadding="0" cellspacing="0" border="0" style="margin-top:12px; display:inline-table;border-collapse:collapse;">
          <tr>
            <td style="padding:0;">
              <a href="https://www.facebook.com/InszoneInsuranceServices/"
                target="_blank" style="text-decoration:none;">
                <img src="${FACEBOOK_URL}" alt="Facebook" style="display:block;border:0;">
              </a>
            </td>
            <td style="width:4px;"></td>
            <td style="padding:0;">
              <a href="https://twitter.com/InszoneIns"
                target="_blank" style="text-decoration:none;">
                <img src="${TWITTER_URL}" alt="Twitter" style="display:block;border:0;">
              </a>
            </td>
            <td style="width:4px;"></td>
            <td style="padding:0;">
              <a href="https://www.linkedin.com/company/inszone-insurance-services-inc-"
                target="_blank" style="text-decoration:none;">
                <img src="${LINKEDIN_URL}" alt="Linkedin" style="display:block;border:0;">
              </a>
            </td>
          </tr>
        </table>
    </td>

    <!-- RIGHT COLUMN -->
    <td valign="top" style="padding-left:16px;">
      ${rightColumn}
      <p style="margin:16px 0 8px;">
        <a href="https://inszoneinsurance.com/" target="_blank" style="color:#6F8CC0;text-decoration:underline;">INSZONEINSURANCE.COM</a>
      </p>
      <p style="margin:0;letter-spacing:1.5pt;">LIC #0F82764</p>
    </td>
  </tr>
</table>
<!-- END SIGNATURE -->
`.trim();
}