"use client";
// src/components/organisms/SignaturePreview.tsx
import * as React from "react";
import { useColorScheme } from "@mui/joy";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Typography from "@mui/joy/Typography";
import { MainTitle } from "@/components/MainTitle";
import { EyeIcon } from "@hugeicons/core-free-icons";
import type { SignatureFormValues } from "@/hooks/useSignatureBuilder";
import type { SignatureType } from "@/hooks/useSignatureBuilder";
import { DEFAULT_LOGO_WIDTH, DEFAULT_LOGO_HEIGHT } from "@/hooks/useSignatureBuilder";

// ── Constants ─────────────────────────────────────────────────

const INSZONE_LOGO_URL     = "https://inszoneinsurance.com/wp-content/uploads/2026/01/logo-inszone.png";
const FACEBOOK_URL         = "https://inszoneinsurance.com/wp-content/uploads/2026/02/facebook.png";
const TWITTER_URL          = "https://inszoneinsurance.com/wp-content/uploads/2026/02/twitter.png";
const LINKEDIN_URL         = "https://inszoneinsurance.com/wp-content/uploads/2026/02/linkedin.png";

// ── Colors ────────────────────────────────────────────────────

type PreviewColors = {
  bg: string; border: string; nameColor: string;
  textColor: string; linkColor: string; mutedColor: string;
};

function getPreviewColors(isDark: boolean, signatureType: SignatureType): PreviewColors {
  const isBasic = signatureType === "basic";
  if (isDark) {
    return {
      bg:         "#1e1e35",
      border:     "#A4B6D8",
      nameColor:  isBasic ? "#fff" : "#A4B6D8",   // basic: same as text
      textColor:  "#fff",
      linkColor:  "#A4B6D8",
      mutedColor: "#fff",
    };
  }
  return {
    bg:         "#ffffff",
    border:     "#6F8CC0",
    nameColor:  isBasic ? "#000" : "#6F8CC0",     // basic: same as text
    textColor:  "#000",
    linkColor:  "#6F8CC0",
    mutedColor: "#000",
  };
}

// ── Right column by type ──────────────────────────────────────

function RightColumn({
  signatureType, logoUrl, logoWidth, logoHeight, logoLoading, isDark, c, basicAddress,
}: {
  signatureType: SignatureType;
  logoUrl:       string;
  logoWidth:     number;
  logoHeight:    number;
  logoLoading:   boolean;
  isDark:        boolean;
  c:             PreviewColors;
  basicAddress:  string;
}) {
  const inszoneImg = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={INSZONE_LOGO_URL} alt="Inszone Insurance" style={{ display: "inline" }} />
  );

  const partnerImg = logoLoading ? (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      width: DEFAULT_LOGO_WIDTH, height: DEFAULT_LOGO_HEIGHT, margin: "0 auto 6px",
      borderRadius: 6,
      backgroundColor: isDark ? "rgba(164,182,216,0.10)" : "rgba(111,140,192,0.08)",
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={isDark ? "#A4B6D8" : "#6F8CC0"} strokeWidth="2.5" strokeLinecap="round"
        style={{ animation: "spin 0.9s linear infinite", flexShrink: 0 }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      <span style={{ fontSize: 11, color: isDark ? "#A4B6D8" : "#6F8CC0", whiteSpace: "nowrap" }}>
        Processing…
      </span>
    </div>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="Partner logo" width={logoWidth} height={logoHeight}
      style={{ display: "block", margin: "0 auto 6px", width: logoWidth, height: logoHeight, objectFit: "contain" }} />
  );

  if (signatureType === "basic") {
    return (
      <>
        <p style={{ margin: "0", textAlign: "left" }}>
          {inszoneImg}
        </p>
        {basicAddress.trim() && (
        <p style={{ margin: "12px 0 0", textAlign: "left", color: c.textColor, fontSize: 12, lineHeight: "16px" }}>
          {basicAddress.trim().split("\n").map((line, i) => (
            <React.Fragment key={i}>{line}<br /></React.Fragment>
          ))}
        </p>
        )}
      </>
    );
  }

  if (signatureType === "formerly") {
    return (
      <>
        <p style={{ margin: "0", textAlign: "center" }}>{inszoneImg}</p>
        <p style={{ margin: "12px 0", color: c.linkColor, fontWeight: "bold", textAlign: "center" }}>
          formerly operating as
        </p>
        <p style={{ margin: "0", textAlign: "center" }}>{partnerImg}</p>
      </>
    );
  }

  // powered-by (default)
  return (
    <>
      <p style={{ margin: "0", textAlign: "center" }}>{partnerImg}</p>
      <p style={{ margin: "0 0 8px", color: c.linkColor, fontWeight: "bold", textAlign: "center" }}>
        powered by
      </p>
      <p style={{ margin: "0", textAlign: "center" }}>{inszoneImg}</p>
    </>
  );
}

// ── Inner signature table ─────────────────────────────────────

interface SignatureTableProps {
  values:        SignatureFormValues;
  signatureType: SignatureType;
  logoUrl:       string;
  logoWidth:     number;
  logoHeight:    number;
  isDark:        boolean;
  logoLoading:   boolean;
  certRequest:   boolean;
  reviewLink:    string;
}

function SignatureTable({ values, signatureType, logoUrl, logoWidth, logoHeight, isDark, logoLoading, certRequest, reviewLink }: SignatureTableProps) {
  const c = getPreviewColors(isDark, signatureType);

  // Contact lines: Phone, Office (direct), SMS, Fax
  const contactLineElements = [
    values.phone  ? `Phone: ${values.phone}`    : null,
    values.direct ? `Office: ${values.direct}`  : null,
    values.sms    ? `SMS: ${values.sms}`        : null,
    values.fax    ? `Fax: ${values.fax}`        : null,
  ].filter(Boolean)
  .map((line, i) => (
    <React.Fragment key={i}>{line}<br /></React.Fragment>
  ));

  const resolvedAddress = (values.address ?? "").trim();

  const addressLines = resolvedAddress.trim().split("\n").map((line, i) => (
    <React.Fragment key={i}>{line}<br /></React.Fragment>
  ));

  const titleLines = values.title.toUpperCase().trim().split("\n").map((line, i) => (
    <React.Fragment key={i}>{line}<br /></React.Fragment>
  ));

  return (
    <div style={{ display: "inline-block" }}>
      <table cellPadding={0} cellSpacing={0} style={{
        borderCollapse: "collapse",
        fontFamily: "Arial, sans-serif",
        fontSize: 12,
        lineHeight: "16px",
        color: c.textColor,
      }}>
        <tbody>
          <tr>
            {/* Left column */}
            <td valign="top" style={{ textAlign: "right", paddingRight: 16, borderRight: `2px solid ${c.border}`, whiteSpace: "nowrap" }}>
              <p style={{ margin: "0 0 6px", fontSize: 19, color: c.nameColor }}>
                <strong>{values.fullName || "Full Name"}</strong>
              </p>
              <p style={{ margin: 0, color: c.textColor, fontSize: 12, lineHeight: "14px" }}>
                {titleLines || "Job Title"}
              </p>
              <p style={{ margin: "12px 0 0", color: c.textColor }}>
                {contactLineElements}
                <a href={`mailto:${values.email}`} style={{ color: c.linkColor, textDecoration: "underline" }}>
                  {values.email || "email@example.com"}
                </a>
              </p>
              {signatureType !== "basic" && resolvedAddress.trim() && (
                <p style={{ margin: "12px 0 0", color: c.textColor }}>{addressLines}</p>
              )}
              {values.lic && (
                <p style={{ margin: "12px 0 0", letterSpacing: "1.5pt", color: c.textColor }}>{values.lic}</p>
              )}
              <p style={{ margin: "12px 0 0", display: "flex", justifyContent: "flex-end", gap: 4 }}>
                <a href="https://www.facebook.com/InszoneInsuranceServices/" target="_blank" rel="noreferrer" style={{ display: "inline", textDecoration: "none" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={FACEBOOK_URL} alt="Facebook" style={{ display: "inline" }} />
                </a>
                <a href="https://twitter.com/InszoneIns" target="_blank" rel="noreferrer" style={{ display: "inline", textDecoration: "none" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={TWITTER_URL} alt="Twitter" style={{ display: "inline" }} />
                </a>
                <a href="https://www.linkedin.com/company/inszone-insurance-services-inc-" target="_blank" rel="noreferrer" style={{ display: "inline", textDecoration: "none" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={LINKEDIN_URL} alt="LinkedIn" style={{ display: "inline" }} />
                </a>
              </p>
            </td>

            {/* Right column */}
            <td valign="top" style={{ paddingLeft: 16, textAlign: "center" }}>
              <RightColumn
                signatureType={signatureType}
                logoUrl={logoUrl}
                logoWidth={logoWidth}
                logoHeight={logoHeight}
                logoLoading={logoLoading}
                isDark={isDark}
                c={c}
                basicAddress={resolvedAddress}
              />
              <p style={{ margin: "12px 0", textAlign: "left" }}>
                <a href="https://inszoneinsurance.com/" target="_blank" rel="noreferrer" style={{ color: c.linkColor, textDecoration: "underline" }}>
                  INSZONEINSURANCE.COM
                </a>
              </p>
              <p style={{ margin: 0, letterSpacing: "1.5pt", color: c.mutedColor, textAlign: "left" }}>LIC #0F82764</p>
              {certRequest && (signatureType === "basic" || signatureType === "formerly") && (
                <p style={{ margin: "12px 0 0", fontSize: 12, lineHeight: "16px", textAlign: "left" }}>
                  <span style={{ color: "#f00", fontWeight: "bold" }}>Certificate Request</span><br />
                  Fax: 916-636-0134<br />
                  Email:{" "}
                  <a href="mailto:certs@inszoneins.com" style={{ color: c.linkColor, textDecoration: "underline" }}>
                    certs@inszoneins.com
                  </a>
                </p>
              )}
            </td>
          </tr>
        </tbody>
      </table>
      {reviewLink && (
        <div style={{ marginTop: 24, fontFamily: "Arial, sans-serif", fontSize: 12, lineHeight: "16px", color: c.textColor }}>
          Did I provide you with excellent service? Click{" "}
          <a href={reviewLink} target="_blank" rel="noreferrer" style={{ color: c.linkColor, textDecoration: "underline" }}>here</a>
          {" "}to submit a review!
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────

interface SignaturePreviewProps {
  values:        SignatureFormValues;
  signatureType: SignatureType;
  logoUrl:       string;
  logoWidth:     number;
  logoHeight:    number;
  logoLoading:   boolean;
  isPending:     boolean;
  withTitle?:    boolean;
  certRequest:   boolean;
  reviewLink:    string;
}

export function SignaturePreview({
  values, signatureType, logoUrl, logoWidth, logoHeight, logoLoading, isPending, withTitle = true, certRequest, reviewLink
}: SignaturePreviewProps) {
  const { mode, systemMode } = useColorScheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted
    ? mode === "dark" || (mode === "system" && systemMode === "dark")
    : true;

  return (
    <Box sx={{
      background: isDark ? "#1e1e35" : "#fff",
      padding: "32px 32px 48px",
      flex: 1,
      overflow: "hidden",
      transition: mounted ? "background 0.2s ease" : "none",
    }}>
      {withTitle && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 4 }}>
          <MainTitle title="Preview" icon={EyeIcon} />
          {isPending && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size="sm" />
              <Typography level="body-xs" sx={{ opacity: 0.6 }}>Updating…</Typography>
            </Box>
          )}
        </Box>
      )}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <SignatureTable
          values={values}
          signatureType={signatureType}
          logoUrl={logoUrl}
          logoWidth={logoWidth}
          logoHeight={logoHeight}
          isDark={isDark}
          logoLoading={logoLoading}
          certRequest={certRequest}
          reviewLink={reviewLink}
        />
      </div>
    </Box>
  );
}