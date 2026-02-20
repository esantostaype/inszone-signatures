// src/lib/outlookSignature.ts
export type SignatureInput = {
  fullName: string;
  title: string;
  contactLines: string;
  email: string;
  address: string;
  lic?: string;
  /** URL procesada por Cloudinary (con trim + transparencia + resize) */
  userLogoUrl?: string;
  /** Ancho visual del logo — viene del upload response (box.w) */
  userLogoWidth?: number;
  /** Alto visual del logo — viene del upload response (box.h) */
  userLogoHeight?: number;
};

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

export function buildOutlookSignatureHtml(input: SignatureInput) {
  const fullName     = esc(input.fullName.trim());
  const title        = esc(input.title.trim()).toUpperCase();
  const contactLines = nl2br((input.contactLines ?? "").trim());
  const email        = esc(input.email.trim());
  const address      = nl2br((input.address ?? "").trim());
  const lic          = input.lic ? esc(input.lic.trim()) : "";
  const userLogoUrl  = input.userLogoUrl ?? "";

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
      <p style="margin:12px 0 0;color:#364153;">${address}</p>
      ${lic ? `<p style="margin:12px 0 0;letter-spacing:1.5pt;">${lic}</p>` : ""}
      <p style="margin:12px 0 0;">
        <a href="https://www.facebook.com/InszoneInsuranceServices/" target="_blank" style="display:inline;text-decoration:none;">
          <img src="https://inszoneinsurance.com/wp-content/uploads/2026/02/facebook.png" alt="Facebook" style="display:inline">
        </a>
        <a href="https://twitter.com/InszoneIns" target="_blank" style="display:inline;text-decoration:none;">
          <img src="https://inszoneinsurance.com/wp-content/uploads/2026/02/twitter.png" alt="Twitter" style="display:inline">
        </a>
        <a href="https://www.linkedin.com/company/inszone-insurance-services-inc-" target="_blank" style="display:inline;text-decoration:none;">
          <img src="https://inszoneinsurance.com/wp-content/uploads/2026/02/linkedin.png" alt="Linkedin" style="display:inline">
        </a>
      </p>
    </td>

    <!-- RIGHT COLUMN -->
    <td valign="top" style="padding-left:16px;">
      <p style="margin:0;text-align:center;">
        ${userLogoUrl
          ? `<img src="${userLogoUrl}" alt="Partner" style="display:block;margin:0 auto 6px;">`
          : ""}
        <span style="display:block;margin:0 0 8px;color:#6F8CC0;font-weight:bold;">powered by</span>
        <img src="https://inszoneinsurance.com/wp-content/uploads/2026/01/logo-inszone.png" alt="Inszone Insurance" style="display:inline">
      </p>
      <p style="margin:16px 0 8px;">
        <a href="https://inszoneinsurance.com/" target="_blank" style="color:#6F8CC0;">INSZONEINSURANCE.COM</a>
      </p>
      <p style="margin:0;letter-spacing:1.5pt;">LIC #0F82764</p>
    </td>
  </tr>
</table>
<!-- END SIGNATURE -->
`.trim();
}