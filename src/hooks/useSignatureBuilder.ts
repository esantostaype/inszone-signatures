/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
// src/hooks/useSignatureBuilder.ts
import * as React from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "react-toastify";
import { buildOutlookSignatureHtml } from "@/lib/outlookSignature";
import { useInvalidateSignatures } from "@/hooks/useSignatures";

// ── Constants ─────────────────────────────────────────────────────────────────

export const DEFAULT_LOGO_URL    = "https://inszoneinsurance.com/wp-content/uploads/2026/02/default-logo-1.png";
export const DEFAULT_LOGO_WIDTH  = 152;
export const DEFAULT_LOGO_HEIGHT = 44;

export type SignatureType = "basic" | "powered-by" | "formerly";

// ── Types ─────────────────────────────────────────────────────────────────────

type SmartPlan =
  | { kind: "HAS_ALPHA" }
  | { kind: "SOLID_BG"; bgHex: string; bgR: number; bgG: number; bgB: number }
  | { kind: "COMPLEX_BG" }
  | { kind: "SVG" }
  | { kind: "BADGE" };

export const FIELD_MAX_LENGTH = {
  name:       128,
  fullName:    64,
  title:       64,
  phone:       14,
  fax:         14,
  direct:      14,
  sms:         14,
  email:      64,
  address:    128,
  website:    64,
  lic:         16,
  reviewLink: 256,
} as const;

export type UploadResult = {
  public_id:        string | null;
  secure_url:       string | null;
  display_url:      string | null;
  width:            number;
  height:           number;
  bytes:            number;
  format:           string;
  trimmed_ar?:      number;
  skipEnhancement?: boolean;
  plan?:            SmartPlan;
  processed_base64?: string;
  blob_url?:        string;
};

export type SignatureFormValues = {
  name:     string;
  fullName: string;
  title:    string;
  // Contact order: Phone, Office (direct), SMS, Fax
  phone:    string;
  direct:   string;  // labelled "Office" in UI
  sms:      string;
  fax:      string;
  email:    string;
  address:  string;
  website:  string;
  lic:      string;
  reviewLink: string;
};

// ── Validation ────────────────────────────────────────────────────────────────

function buildSchema(_signatureType: SignatureType) {
  return Yup.object({
    name:     Yup.string().trim().min(2).max(FIELD_MAX_LENGTH.name, `Max ${FIELD_MAX_LENGTH.name} characters`).required("Signature name is required"),
    fullName: Yup.string().trim().min(2).max(FIELD_MAX_LENGTH.fullName, `Max ${FIELD_MAX_LENGTH.fullName} characters`).required("Full name is required"),
    title:    Yup.string().trim().min(2).max(FIELD_MAX_LENGTH.title, `Max ${FIELD_MAX_LENGTH.title} characters`).required("Job title is required"),
    phone:    Yup.string().trim().min(2).max(FIELD_MAX_LENGTH.phone).required("Phone is required"),
    direct:   Yup.string().trim().max(FIELD_MAX_LENGTH.direct).optional(),
    sms:      Yup.string().trim().max(FIELD_MAX_LENGTH.sms).optional(),
    fax:      Yup.string().trim().max(FIELD_MAX_LENGTH.fax).optional(),
    email:    Yup.string().trim().email("Invalid email").max(FIELD_MAX_LENGTH.email, `Max ${FIELD_MAX_LENGTH.email} characters`).required("Email is required"),
    address:  Yup.string().trim().max(FIELD_MAX_LENGTH.address, `Max ${FIELD_MAX_LENGTH.address} characters`)
      .test("max-lines", "Address can have at most 2 lines", (val) => {
        if (!val) return true;
        return (val.match(/\n/g) || []).length < 2;
      }).optional(),
    website:  Yup.string().trim().max(FIELD_MAX_LENGTH.website, `Max ${FIELD_MAX_LENGTH.website} characters`).optional(),
    lic:      Yup.string().trim().max(FIELD_MAX_LENGTH.lic, `Max ${FIELD_MAX_LENGTH.lic} characters`).optional(),
    reviewLink: Yup.string().trim().max(256).optional(),
  });
}

// ── Debounce hook ─────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): [T, boolean] {
  const [debounced, setDebounced] = React.useState<T>(value);
  const [pending, setPending]     = React.useState(false);

  React.useEffect(() => {
    setPending(true);
    const timer = setTimeout(() => { setDebounced(value); setPending(false); }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return [debounced, pending];
}

// ── Clipboard helper ──────────────────────────────────────────────────────────

async function copyHtmlToClipboard(html: string) {
  const blobHtml = new Blob([html], { type: "text/html" });
  const blobTxt  = new Blob([stripHtml(html)], { type: "text/plain" });
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ "text/html": blobHtml, "text/plain": blobTxt }),
    ]);
  } catch {
    await navigator.clipboard.writeText(html);
  }
}

function stripHtml(html: string) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.innerText || div.textContent || "";
}

// ── Phone formatter ───────────────────────────────────────────────────────────
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// ── Address formatter ─────────────────────────────────────────────────────────

/** Full name → 2-letter USPS abbreviation */
const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR",
  california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
  "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};

/** All valid 2-letter USPS state abbreviations */
const VALID_STATE_ABBRS = new Set(Object.values(STATE_NAME_TO_ABBR));

/**
 * Normalises a state token (full name or abbreviation) to a 2-letter abbreviation.
 * Returns the original token (uppercased) if it cannot be resolved.
 */
function normalizeState(token: string): string {
  const lower = token.trim().toLowerCase();
  if (STATE_NAME_TO_ABBR[lower]) return STATE_NAME_TO_ABBR[lower];
  const upper = token.trim().toUpperCase();
  if (VALID_STATE_ABBRS.has(upper)) return upper;
  return upper; // unknown → return as-is uppercased
}

/**
 * Formats a free-form address string into exactly 2 lines:
 *
 *   Line 1: street + suite/unit
 *   Line 2: City, ST ZIPCODE
 *
 * Handles separators:  newline · pipe (|) · em-dash (—) · en-dash (–) · hyphen (-)
 * and the common "Street, Suite, City, State Zip" comma-separated pattern.
 *
 * If the input is already 2 lines and the second line already looks like
 * "City, ST ZIP", it is returned normalised (state abbreviated) without
 * further splitting.
 */
export function formatAddress(raw: string): string {
  if (!raw.trim()) return "";

  // ── Step 1: try explicit separators first (newline / pipe / dashes) ─────────
  const HARD_SEP = /\n|\r\n|\r|\s*[|]\s*|\s*[—–]\s*/;
  const hardParts = raw.split(HARD_SEP).map((p) => p.trim()).filter(Boolean);

  if (hardParts.length >= 2) {
    // Treat last part as "city, state zip" candidate
    const cityLine = hardParts[hardParts.length - 1];
    const streetLine = hardParts.slice(0, hardParts.length - 1).join(", ");
    const normalised = normalizeCityStateLine(cityLine);
    if (normalised) return `${streetLine}\n${normalised}`;
  }

  // ── Step 2: no hard separator – split by commas ──────────────────────────────
  // Example: "4025 E. La Palma Ave, Suite 101, Anaheim, CA 92807"
  //           seg[0]               seg[1]      seg[2]  seg[3]
  const segs = raw.split(",").map((s) => s.trim()).filter(Boolean);

  if (segs.length < 2) {
    // Nothing we can do – return as-is (single token)
    return raw.trim();
  }

  // Try to identify where "City  State  ZIP" starts by scanning from the end.
  // The ZIP is a 5-digit (optionally +4) number; state is 2-letter abbreviation
  // or a known full name; city is whatever comes before.
  //
  // We look for a segment matching: "State ZIP" or "State" followed by "ZIP".
  //
  // Walk backwards through segments:
  //   – if last seg is "ZIP" → state is second-to-last, city is third-to-last
  //   – if last seg is "State ZIP" → city is second-to-last
  //   – if last seg is "City, State ZIP" (already joined) → handled above

  const ZIP_RE   = /^\d{5}(?:-\d{4})?$/;
  const STATE_RE = /^[A-Za-z ]{2,20}$/;

  let zipToken   = "";
  let stateToken = "";
  let cityToken  = "";
  let streetEndIdx = segs.length; // exclusive index of last street segment

  const last = segs[segs.length - 1];

  // Case A: last segment = "State ZIP"  e.g. "CA 92807" or "California 92807"
  const stateZipMatch = last.match(/^([A-Za-z ]{2,20})\s+(\d{5}(?:-\d{4})?)$/);
  if (stateZipMatch) {
    stateToken  = stateZipMatch[1];
    zipToken    = stateZipMatch[2];
    cityToken   = segs[segs.length - 2] ?? "";
    streetEndIdx = segs.length - 2;
  }
  // Case B: last segment = ZIP only, second-to-last = State
  else if (ZIP_RE.test(last) && segs.length >= 3 && STATE_RE.test(segs[segs.length - 2])) {
    zipToken    = last;
    stateToken  = segs[segs.length - 2];
    cityToken   = segs[segs.length - 3] ?? "";
    streetEndIdx = segs.length - 3;
  }
  // Case C: last segment = "City State ZIP"  e.g. "Anaheim California 92807"
  else {
    const cityStateZip = last.match(/^(.+?)\s+([A-Za-z]{2,20})\s+(\d{5}(?:-\d{4})?)$/);
    if (cityStateZip) {
      cityToken   = cityStateZip[1];
      stateToken  = cityStateZip[2];
      zipToken    = cityStateZip[3];
      streetEndIdx = segs.length - 1;
    }
  }

  if (!zipToken || !stateToken || !cityToken) {
    // Cannot parse – return trimmed original
    return raw.trim();
  }

  const streetParts = segs.slice(0, streetEndIdx).filter(Boolean);
  if (streetParts.length === 0) return raw.trim();

  const streetLine = streetParts.join(", ");
  const abbr       = normalizeState(stateToken);
  const cityLine   = `${cityToken.trim()}, ${abbr} ${zipToken}`;

  return `${streetLine}\n${cityLine}`;
}

/**
 * Given a string that should represent "City, State ZIP", returns it normalised
 * (state abbreviated) or null if it doesn't look like one.
 */
function normalizeCityStateLine(line: string): string | null {
  // "Anaheim, CA 92807" or "Anaheim, California, 92807" or "Anaheim CA 92807"
  const m = line.match(/^(.+?)[,\s]+([A-Za-z ]{2,20})[,\s]+(\d{5}(?:-\d{4})?)$/);
  if (!m) return null;
  const city = m[1].trim();
  const abbr = normalizeState(m[2]);
  const zip  = m[3];
  return `${city}, ${abbr} ${zip}`;
}

// ── Cloudinary helpers ────────────────────────────────────────────────────────

function buildCloudinaryResizedUrl(url: string, w: number, h: number): string {
  if (!url || !url.includes("res.cloudinary.com")) return url;
  return url.replace(
    /\/upload\/((?:v\d+\/)?)/,
    (_match, version) => `/upload/w_${w},h_${h},c_fit,q_auto,f_auto/${version}`
  );
}

async function commitToCloudinary(logo: UploadResult): Promise<UploadResult> {
  if (!logo.processed_base64) {
    throw new Error("No processed image data available to upload");
  }

  const res = await fetch("/api/upload-logo/commit", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      processed_base64: logo.processed_base64,
      width:            logo.width,
      height:           logo.height,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to upload logo");
  }

  const data = await res.json() as { public_id: string; secure_url: string; display_url: string; bytes: number };
  return { ...logo, ...data };
}

// ── Letterhead download helper ────────────────────────────────────────────────

async function triggerLetterheadDownload(payload: {
  partnerName:       string;
  phone:             string;
  fax:               string;
  address:           string;
  website:           string;
  partnerLogoUrl:    string;
  partnerLogoWidth:  number;
  partnerLogoHeight: number;
}): Promise<void> {
  const res = await fetch("/api/letterhead", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Letterhead generation failed");
  }

  const blob     = await res.blob();
  const url      = URL.createObjectURL(blob);
  const anchor   = document.createElement("a");
  const safeName = payload.partnerName
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("-");

  anchor.href     = url;
  anchor.download = `INS-Branding-Letterhead-Acquisition-${safeName}.docx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

// ── Build contact lines (ordered: Phone, Office, SMS, Fax) ───────────────────

export function buildContactLines(values: {
  phone: string;
  direct?: string | null;
  sms?: string | null;
  fax?: string | null;
}): string {
  return [
    values.phone  ? `Phone: ${values.phone}`    : null,
    values.direct ? `Office: ${values.direct}`  : null,
    values.sms    ? `SMS: ${values.sms}`        : null,
    values.fax    ? `Fax: ${values.fax}`        : null,
  ].filter(Boolean).join("\n");
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useSignatureBuilder() {
  const invalidateSignatures = useInvalidateSignatures();

  const [signatureType,     setSignatureType]      = React.useState<SignatureType>("powered-by");
  const [certRequest,       setCertRequest]         = React.useState(false);
  const [uploadedLogo,      setUploadedLogo]        = React.useState<UploadResult | null>(null);
  const [enhanced,          setEnhanced]             = React.useState<UploadResult | null>(null);
  const [rawFile,           setRawFile]              = React.useState<File | null>(null);
  const [busyUpload,        setBusyUpload]           = React.useState(false);
  const [busyEnhance,       setBusyEnhance]          = React.useState(false);
  const [busySave,          setBusySave]             = React.useState(false);
  const [uploadMsg,         setUploadMsg]            = React.useState("");
  const [uploadErr,         setUploadErr]            = React.useState("");
  const [logoError,         setLogoError]            = React.useState("");
  const [logoDisplayWidth,  setLogoDisplayWidth]     = React.useState(DEFAULT_LOGO_WIDTH);
  const [logoDisplayHeight, setLogoDisplayHeight]    = React.useState(DEFAULT_LOGO_HEIGHT);
  const [resizedLogoUrl,    setResizedLogoUrl]       = React.useState<string | null>(null);

  const blobUrlRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  // Reset logo when switching to/from basic type; pre-fill address for basic
  React.useEffect(() => {
    if (signatureType === "basic") {
      setUploadedLogo(null);
      setEnhanced(null);
      setRawFile(null);
      setResizedLogoUrl(null);
      setLogoError("");
      setUploadMsg("");
      setUploadErr("");
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      // Pre-fill address with default HQ address for basic type
      if (!formik.values.address.trim()) {
        formik.setFieldValue("address", "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signatureType]);

  const activeLogo = enhanced ?? uploadedLogo;

  const logoUrl        = resizedLogoUrl || activeLogo?.blob_url || activeLogo?.display_url || DEFAULT_LOGO_URL;
  const logoSecureUrl  = activeLogo?.secure_url || activeLogo?.blob_url || "";
  const logoWidth      = logoDisplayWidth;
  const logoHeight     = logoDisplayHeight;
  const originalLogoWidth  = activeLogo?.width  || DEFAULT_LOGO_WIDTH;
  const originalLogoHeight = activeLogo?.height || DEFAULT_LOGO_HEIGHT;
  const hasUploadedLogo    = !!activeLogo;
  const isBadge            = uploadedLogo?.plan?.kind === "BADGE";
  const canEnhance         = !!uploadedLogo && !!rawFile && !uploadedLogo.skipEnhancement && !busyEnhance && !busyUpload;
  const logoLoading        = busyUpload || busyEnhance;

  // Logo is required only for powered-by and formerly types
  const logoRequired = signatureType !== "basic";

  const validationSchema = React.useMemo(() => buildSchema(signatureType), [signatureType]);

  const formik = useFormik<SignatureFormValues>({
    initialValues: {
      name:     "",
      fullName: "",
      title:    "",
      phone:    "",
      direct:   "",
      sms:      "",
      fax:      "",
      email:    "",
      address:  "",
      website:  "",
      lic:      "",
      reviewLink: "",
    },
    validationSchema,
    onSubmit: () => {},
  });

  const [debouncedValues, isPending] = useDebounce(formik.values, 800);

  // ── Phone formatters ──────────────────────────────────────────────────────

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    formik.setFieldValue("phone", formatPhone(e.target.value));
  }
  function handleDirectChange(e: React.ChangeEvent<HTMLInputElement>) {
    formik.setFieldValue("direct", formatPhone(e.target.value));
  }
  function handleSmsChange(e: React.ChangeEvent<HTMLInputElement>) {
    formik.setFieldValue("sms", formatPhone(e.target.value));
  }
  function handleFaxChange(e: React.ChangeEvent<HTMLInputElement>) {
    formik.setFieldValue("fax", formatPhone(e.target.value));
  }

  // ── Address handler ───────────────────────────────────────────────────────

  function handleAddressChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    const lines = val.split("\n");
    if (lines.length > 2) return;
    if (val.length > FIELD_MAX_LENGTH.address) return;
    formik.setFieldValue("address", val);
  }

  /**
   * Called onBlur on the address textarea.
   * Attempts to auto-format the pasted/typed value into 2 canonical lines.
   */
  function handleAddressBlur() {
    const raw = formik.values.address;
    if (!raw.trim()) return;

    const formatted = formatAddress(raw);
    // Only update if the formatter actually changed something
    if (formatted && formatted !== raw) {
      formik.setFieldValue("address", formatted);
    }
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  async function handleUpload(file: File) {
    setUploadErr("");
    setLogoError("");
    setUploadedLogo(null);
    setEnhanced(null);
    setRawFile(null);
    setResizedLogoUrl(null);
    setUploadMsg("Processing partner logo…");
    setBusyUpload(true);

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    try {
      setRawFile(file);
      const fd = new FormData();
      fd.append("file", file);

      const res  = await fetch("/api/upload-logo", { method: "POST", body: fd });
      const text = await res.text();

      if (!res.ok) throw new Error(`Upload failed (${res.status}). ${text.slice(0, 300)}`);
      if (!res.headers.get("content-type")?.includes("application/json"))
        throw new Error(`Expected JSON. Body: ${text.slice(0, 300)}`);

      const json = JSON.parse(text) as UploadResult & { processed_base64: string };

      const byteArray = Uint8Array.from(atob(json.processed_base64), (c) => c.charCodeAt(0));
      const blob      = new Blob([byteArray], { type: "image/png" });
      const blobUrl   = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;

      const logoResult: UploadResult = {
        ...json,
        blob_url:    blobUrl,
        public_id:   null,
        secure_url:  null,
        display_url: null,
      };

      setUploadedLogo(logoResult);
      setLogoDisplayWidth(json.width   || DEFAULT_LOGO_WIDTH);
      setLogoDisplayHeight(json.height || DEFAULT_LOGO_HEIGHT);
      setUploadMsg(
        json.skipEnhancement
          ? "Logo ready ✓"
          : "Logo processed ✓ — enhance it with AI if needed"
      );
    } catch (e: unknown) {
      setRawFile(null);
      setUploadErr((e as Error)?.message || "Error processing logo");
      setUploadMsg("");
    } finally {
      setBusyUpload(false);
    }
  }

  // ── Commit a Cloudinary (lazy) ────────────────────────────────────────────

  async function ensureCommitted(logo: UploadResult): Promise<UploadResult> {
    if (logo.secure_url && logo.public_id && logo.display_url) return logo;

    const committed = await commitToCloudinary(logo);

    if (enhanced && logo === enhanced) {
      setEnhanced(committed);
    } else if (uploadedLogo && logo === uploadedLogo) {
      setUploadedLogo(committed);
    }

    return committed;
  }

  function resolveLogoUrl(committed: UploadResult, w: number, h: number, currentResizedUrl: string | null): string {
    if (currentResizedUrl) {
      return buildCloudinaryResizedUrl(committed.secure_url!, w, h);
    }
    return committed.display_url || committed.secure_url!;
  }

  // ── Enhance ───────────────────────────────────────────────────────────────

  async function handleEnhance() {
    if (!uploadedLogo || !rawFile) return;
    setUploadErr("");
    setBusyEnhance(true);
    setResizedLogoUrl(null);
    setUploadMsg("Enhancing logo with AI…");

    try {
      const fd = new FormData();
      fd.append("file", rawFile);
      fd.append("isBadge", String(isBadge));

      const res  = await fetch("/api/outlook-signature/enhance", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Enhance failed");

      setEnhanced(json);
      setLogoDisplayWidth(json.width   || DEFAULT_LOGO_WIDTH);
      setLogoDisplayHeight(json.height || DEFAULT_LOGO_HEIGHT);
      setUploadMsg("Logo enhanced with AI ✓");
    } catch (e: unknown) {
      setUploadErr((e as Error)?.message || "Error enhancing logo");
      setUploadMsg("");
    } finally {
      setBusyEnhance(false);
    }
  }

  // ── Resize save ───────────────────────────────────────────────────────────

  function handleResizeSave(w: number, h: number) {
    setLogoDisplayWidth(w);
    setLogoDisplayHeight(h);

    const sourceUrl = activeLogo?.secure_url;
    if (sourceUrl) {
      setResizedLogoUrl(buildCloudinaryResizedUrl(sourceUrl, w, h));
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    const errors = await formik.validateForm();
    if (Object.keys(errors).length > 0) {
      formik.setTouched(
        Object.fromEntries(Object.keys(errors).map((k) => [k, true]))
      );
      return;
    }

    if (logoRequired && !hasUploadedLogo) {
      setLogoError("Please upload a partner logo before saving");
      return;
    }

    setBusySave(true);
    try {
      let finalLogoUrl    = "";
      let finalLogoWidth  = logoDisplayWidth;
      let finalLogoHeight = logoDisplayHeight;

      if (logoRequired && activeLogo) {
        setUploadMsg("Uploading logo…");
        const committed = await ensureCommitted(activeLogo);
        setUploadMsg("");
        finalLogoUrl    = resolveLogoUrl(committed, logoDisplayWidth, logoDisplayHeight, resizedLogoUrl);
        finalLogoWidth  = logoDisplayWidth;
        finalLogoHeight = logoDisplayHeight;
      }

      const payload = {
        name:              formik.values.name,
        fullName:          formik.values.fullName,
        title:             formik.values.title,
        type:              signatureType,
        phone:             formik.values.phone,
        direct:            formik.values.direct || null,
        sms:               formik.values.sms    || null,
        fax:               formik.values.fax    || null,
        email:             formik.values.email,
        address:           formik.values.address?.trim() || null,
        lic:               formik.values.lic    || null,
        website:           formik.values.website || null,
        partnerLogoUrl:    finalLogoUrl    || null,
        partnerLogoWidth:  finalLogoUrl    ? finalLogoWidth  : null,
        partnerLogoHeight: finalLogoUrl    ? finalLogoHeight : null,
        certRequest,
        reviewLink:        formik.values.reviewLink || null,
      };

      const res = await fetch("/api/signatures", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Save failed");
      }

      toast.success("Signature saved!");
      invalidateSignatures();

      // Auto-download letterhead only for powered-by
      if (signatureType === "powered-by" && activeLogo) {
        try {
          const committed = await ensureCommitted(activeLogo);
          await triggerLetterheadDownload({
            partnerName:       formik.values.name || formik.values.fullName,
            phone:             formik.values.phone,
            fax:               formik.values.fax || "",
            address:           formik.values.address || "",
            website:           formik.values.website || "",
            partnerLogoUrl:    committed.secure_url!,
            partnerLogoWidth:  logoDisplayWidth,
            partnerLogoHeight: logoDisplayHeight,
          });
          toast.success("Letterhead downloaded!");
        } catch (e: unknown) {
          toast.warn((e as Error)?.message || "Signature saved but letterhead download failed");
        }
      }
    } catch (e: unknown) {
      setUploadMsg("");
      toast.error((e as Error)?.message || "Error saving signature");
    } finally {
      setBusySave(false);
    }
  }

  // ── Copy ──────────────────────────────────────────────────────────────────

  async function handleCopy() {
    const errors = await formik.validateForm();
    const errorsWithoutName = Object.fromEntries(
      Object.entries(errors).filter(([key]) => key !== "name")
    );

    if (Object.keys(errorsWithoutName).length > 0) {
      formik.setTouched(
        Object.fromEntries(Object.keys(errorsWithoutName).map((k) => [k, true]))
      );
    }

    if (logoRequired && !hasUploadedLogo) {
      setLogoError("Please upload a partner logo before copying");
    }

    if (Object.keys(errorsWithoutName).length > 0 || (logoRequired && !hasUploadedLogo)) return;

    try {
      let finalLogoUrl    = "";
      let finalLogoWidth  = logoDisplayWidth;
      let finalLogoHeight = logoDisplayHeight;

      if (logoRequired && activeLogo) {
        setUploadMsg("Uploading logo…");
        const committed = await ensureCommitted(activeLogo!);
        setUploadMsg("");
        finalLogoUrl    = resolveLogoUrl(committed, logoDisplayWidth, logoDisplayHeight, resizedLogoUrl);
        finalLogoWidth  = logoDisplayWidth;
        finalLogoHeight = logoDisplayHeight;
      }

      const contactLines = buildContactLines({
        phone:  debouncedValues.phone,
        direct: debouncedValues.direct,
        sms:    debouncedValues.sms,
        fax:    debouncedValues.fax,
      });

      const html = buildOutlookSignatureHtml({
        fullName:          debouncedValues.fullName,
        title:             debouncedValues.title,
        contactLines,
        email:             debouncedValues.email,
        address:           debouncedValues.address?.trim() || "",
        lic:               debouncedValues.lic || undefined,
        partnerLogoUrl:    finalLogoUrl || undefined,
        partnerLogoWidth:  finalLogoWidth,
        partnerLogoHeight: finalLogoHeight,
        signatureType,
        certRequest,
        reviewLink:        debouncedValues.reviewLink || undefined,
      });

      await copyHtmlToClipboard(html);
      toast.success("Signature copied!");
    } catch (e: unknown) {
      setUploadMsg("");
      toast.error((e as Error)?.message || "Error copying signature");
    }
  }

  return {
    formik,
    debouncedValues,
    isPending,
    signatureType,
    setSignatureType,
    certRequest,
    setCertRequest,
    uploadedLogo,
    enhanced,
    logoUrl,
    logoSecureUrl,
    logoWidth,
    logoHeight,
    originalLogoWidth,
    originalLogoHeight,
    logoDisplayWidth,
    logoDisplayHeight,
    hasUploadedLogo,
    logoRequired,
    canEnhance,
    logoLoading,
    busyUpload,
    busyEnhance,
    busySave,
    uploadMsg,
    uploadErr,
    logoError,
    setLogoError,
    handleUpload,
    handleEnhance,
    handleResizeSave,
    handleSave,
    handleCopy,
    handlePhoneChange,
    handleDirectChange,
    handleSmsChange,
    handleFaxChange,
    handleAddressChange,
    handleAddressBlur,   // ← nuevo: conectar al onBlur del textarea
  };
}