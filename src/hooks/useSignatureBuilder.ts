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

// ── Types ─────────────────────────────────────────────────────────────────────

type SmartPlan =
  | { kind: "HAS_ALPHA" }
  | { kind: "SOLID_BG"; bgHex: string; bgR: number; bgG: number; bgB: number }
  | { kind: "COMPLEX_BG" }
  | { kind: "SVG" }
  | { kind: "BADGE" };

export const FIELD_MAX_LENGTH = {
  name:     64,
  fullName:  32,
  title:     32,
  phone:     14,
  fax:       14,
  email:    32,
  address:  64,
  website:  32,
  lic:       16,
} as const;

export type UploadResult = {
  public_id:        string;
  secure_url:       string;
  display_url:      string;
  width:            number;
  height:           number;
  bytes:            number;
  format:           string;
  trimmed_ar?:      number;
  skipEnhancement?: boolean;
  plan?:            SmartPlan;
};

export type SignatureFormValues = {
  name:         string;
  fullName:     string;
  title:        string;
  phone:        string;
  fax:          string;
  email:        string;
  address:      string;
  website:      string;
  lic:          string;
};

// ── Validation ────────────────────────────────────────────────────────────────

const schema = Yup.object({
  name:     Yup.string().trim().min(2).max(FIELD_MAX_LENGTH.name, `Max ${FIELD_MAX_LENGTH.name} characters`).required("Signature name is required"),
  fullName: Yup.string().trim().min(2).max(FIELD_MAX_LENGTH.fullName, `Max ${FIELD_MAX_LENGTH.fullName} characters`).required("Full name is required"),
  title:    Yup.string().trim().min(2).max(FIELD_MAX_LENGTH.title, `Max ${FIELD_MAX_LENGTH.title} characters`).required("Job title is required"),
  phone:    Yup.string().trim().min(2).max(FIELD_MAX_LENGTH.phone).required("Phone is required"),
  fax:      Yup.string().trim().max(FIELD_MAX_LENGTH.fax).optional(),
  email:    Yup.string().trim().email("Invalid email").max(FIELD_MAX_LENGTH.email, `Max ${FIELD_MAX_LENGTH.email} characters`).required("Email is required"),
  address:  Yup.string().trim().min(2)
    .max(FIELD_MAX_LENGTH.address, `Max ${FIELD_MAX_LENGTH.address} characters`)
    .test("max-lines", "Address can have at most 2 lines", (val) => {
      if (!val) return true;
      return (val.match(/\n/g) || []).length < 2;
    })
    .required("Address is required"),
  website:  Yup.string().trim().max(FIELD_MAX_LENGTH.website, `Max ${FIELD_MAX_LENGTH.website} characters`).optional(),
  lic:      Yup.string().trim().max(FIELD_MAX_LENGTH.lic, `Max ${FIELD_MAX_LENGTH.lic} characters`).optional(),
});

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
// Formats any digit input to (123) 456-7890
export function formatPhone(raw: string): string {
  // Strip all non-digit characters
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// ── Cloudinary URL builder ────────────────────────────────────────────────────

function buildCloudinaryResizedUrl(url: string, w: number, h: number): string {
  if (!url.includes("res.cloudinary.com")) return url;
  return url.replace(
    /\/upload\/((?:v\d+\/)?)/,
    (_match, version) => `/upload/w_${w},h_${h},c_fit,q_auto,f_auto/${version}`
  );
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

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useSignatureBuilder() {
  const invalidateSignatures = useInvalidateSignatures();

  const [uploadedLogo,      setUploadedLogo]      = React.useState<UploadResult | null>(null);
  const [enhanced,          setEnhanced]           = React.useState<UploadResult | null>(null);
  const [rawFile,           setRawFile]            = React.useState<File | null>(null);
  const [busyUpload,        setBusyUpload]         = React.useState(false);
  const [busyEnhance,       setBusyEnhance]        = React.useState(false);
  const [busySave,          setBusySave]           = React.useState(false);
  const [uploadMsg,         setUploadMsg]          = React.useState("");
  const [uploadErr,         setUploadErr]          = React.useState("");
  const [logoError,         setLogoError]          = React.useState("");
  const [logoDisplayWidth,  setLogoDisplayWidth]   = React.useState(DEFAULT_LOGO_WIDTH);
  const [logoDisplayHeight, setLogoDisplayHeight]  = React.useState(DEFAULT_LOGO_HEIGHT);
  const [resizedLogoUrl,    setResizedLogoUrl]     = React.useState<string | null>(null);

  const activeLogo = enhanced ?? uploadedLogo;
  const logoUrl    = resizedLogoUrl || activeLogo?.display_url || DEFAULT_LOGO_URL;
  const logoSecureUrl = activeLogo?.secure_url || "";
  const logoWidth  = logoDisplayWidth;
  const logoHeight = logoDisplayHeight;
  const originalLogoWidth  = activeLogo?.width  || DEFAULT_LOGO_WIDTH;
  const originalLogoHeight = activeLogo?.height || DEFAULT_LOGO_HEIGHT;
  const hasUploadedLogo = !!activeLogo;
  const isBadge         = uploadedLogo?.plan?.kind === "BADGE";
  const canEnhance      = !!uploadedLogo && !!rawFile && !uploadedLogo.skipEnhancement && !busyEnhance && !busyUpload;
  const logoLoading     = busyUpload || busyEnhance;

  const formik = useFormik<SignatureFormValues>({
    initialValues: {
      name:         "",
      fullName:     "Reinalyn Bancifra",
      title:        "Marketing Coordinator",
      phone:        "",
      fax:          "",
      email:        "rbancifra@inszoneins.com",
      address:      "",
      website:      "",
      lic:          "",
    },
    validationSchema: schema,
    onSubmit: () => {},
  });

  const [debouncedValues, isPending] = useDebounce(formik.values, 800);

  // ── Phone/Fax formatting handlers ────────────────────────────────────────

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatPhone(e.target.value);
    formik.setFieldValue("phone", formatted);
  }

  function handleFaxChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatPhone(e.target.value);
    formik.setFieldValue("fax", formatted);
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  async function handleUpload(file: File) {
    setUploadErr("");
    setLogoError("");
    setUploadedLogo(null);
    setEnhanced(null);
    setRawFile(null);
    setResizedLogoUrl(null);
    setUploadMsg("Uploading and processing partner logo…");
    setBusyUpload(true);

    try {
      setRawFile(file);
      const fd = new FormData();
      fd.append("file", file);

      const res  = await fetch("/api/upload-logo", { method: "POST", body: fd });
      const text = await res.text();

      if (!res.ok) throw new Error(`Upload failed (${res.status}). ${text.slice(0, 300)}`);
      if (!res.headers.get("content-type")?.includes("application/json"))
        throw new Error(`Expected JSON. Body: ${text.slice(0, 300)}`);

      const json: UploadResult = JSON.parse(text);
      setUploadedLogo(json);
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
      const resized = buildCloudinaryResizedUrl(sourceUrl, w, h);
      setResizedLogoUrl(resized);
    }
  }

  // ── Save (+ auto-download letterhead) ────────────────────────────────────

  async function handleSave() {
    const errors = await formik.validateForm();
    if (Object.keys(errors).length > 0) {
      formik.setTouched(
        Object.fromEntries(Object.keys(errors).map((k) => [k, true]))
      );
      return;
    }
    if (!hasUploadedLogo) {
      setLogoError("Please upload a partner logo before saving");
      return;
    }

    setBusySave(true);
    try {
      const payload = {
        name:              formik.values.name,
        fullName:          formik.values.fullName,
        title:             formik.values.title,
        phone:             formik.values.phone,
        fax:               formik.values.fax || null,
        email:             formik.values.email,
        address:           formik.values.address,
        lic:               formik.values.lic || null,
        website:           formik.values.website || null,
        partnerLogoUrl:    logoUrl,
        partnerLogoWidth:  logoDisplayWidth,
        partnerLogoHeight: logoDisplayHeight,
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

      // ── Auto-download letterhead after successful save ──────────────────
      if (hasUploadedLogo) {
        try {
          await triggerLetterheadDownload({
            partnerName:       formik.values.name || formik.values.fullName,
            phone:             formik.values.phone,
            fax:               formik.values.fax || "",
            address:           formik.values.address,
            website:           formik.values.website || "",
            // Usa secure_url sin transforms para que el docx tenga la imagen original
            partnerLogoUrl:    activeLogo?.secure_url || logoUrl,
            partnerLogoWidth:  logoDisplayWidth,
            partnerLogoHeight: logoDisplayHeight,
          });
          toast.success("Letterhead downloaded!");
        } catch (e: unknown) {
          // No falla el save si el letterhead falla — solo muestra warning
          toast.warn((e as Error)?.message || "Signature saved but letterhead download failed");
        }
      }
    } catch (e: unknown) {
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

  if (!hasUploadedLogo) {
    setLogoError("Please upload a partner logo before copying");
  }

  // Solo bloquea si hay cualquier error
  if (Object.keys(errorsWithoutName).length > 0 || !hasUploadedLogo) return;

  // ... resto del copy sin cambios
  const contactLines = [
    `Phone: ${debouncedValues.phone}`,
    debouncedValues.fax ? `Fax: ${debouncedValues.fax}` : null,
  ].filter(Boolean).join("\n");

    const html = buildOutlookSignatureHtml({
      fullName:          debouncedValues.fullName,
      title:             debouncedValues.title,
      contactLines,
      email:             debouncedValues.email,
      address:           debouncedValues.address,
      lic:               debouncedValues.lic || undefined,
      partnerLogoUrl:    logoUrl,
      partnerLogoWidth:  logoDisplayWidth,
      partnerLogoHeight: logoDisplayHeight,
      signatureType:     "powered-by",
    });

    await copyHtmlToClipboard(html);
    toast.success("Signature copied!");
  }

  function handleAddressChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    const lines = val.split("\n");
    // Block a 3rd line from being typed
    if (lines.length > 2) return;
    // Also respect overall char limit
    if (val.length > FIELD_MAX_LENGTH.address) return;
    formik.setFieldValue("address", val);
  }

  return {
    formik,
    debouncedValues,
    isPending,
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
    handleFaxChange,
    handleAddressChange
  };
}