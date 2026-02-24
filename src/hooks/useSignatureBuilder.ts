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
  contactLines: string;
  email:        string;
  address:      string;
  lic:          string;
};

// ── Validation ────────────────────────────────────────────────────────────────

const schema = Yup.object({
  name:         Yup.string().trim().min(2).required("Signature name is required"),
  fullName:     Yup.string().trim().min(2).required("Full name is required"),
  title:        Yup.string().trim().min(2).required("Job title is required"),
  contactLines: Yup.string().trim().min(2).required("Contact lines are required"),
  email:        Yup.string().trim().email("Invalid email").required("Email is required"),
  address:      Yup.string().trim().min(2).required("Address is required"),
  lic:          Yup.string().trim().optional(),
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

// ── Cloudinary URL builder ────────────────────────────────────────────────────
// Inyecta transformaciones w_X,h_Y,c_fit en la URL de Cloudinary para que
// el CDN sirva la imagen en la resolución exacta pedida — sin estirar píxeles.

function buildCloudinaryResizedUrl(url: string, w: number, h: number): string {
  if (!url.includes("res.cloudinary.com")) return url;
  // https://res.cloudinary.com/cloud/image/upload/v123/file.png
  // → .../upload/w_90,h_60,c_fit,q_auto,f_auto/v123/file.png
  return url.replace(
    /\/upload\/((?:v\d+\/)?)/,
    (_match, version) => `/upload/w_${w},h_${h},c_fit,q_auto,f_auto/${version}`
  );
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
  // URL con transformaciones Cloudinary para el tamaño solicitado en resize
  const [resizedLogoUrl,    setResizedLogoUrl]     = React.useState<string | null>(null);

  const activeLogo = enhanced ?? uploadedLogo;
  // logoUrl usa la URL resizada (con transformación Cloudinary) si existe, si no la original
  const logoUrl    = resizedLogoUrl || activeLogo?.display_url || DEFAULT_LOGO_URL;
  const logoSecureUrl = activeLogo?.secure_url || "";
  const logoWidth  = logoDisplayWidth;
  const logoHeight = logoDisplayHeight;
  // Dimensiones originales del archivo (para el modal de resize)
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
      contactLines: "Phone: 479-394-2244\nFax: 479-394-2249",
      email:        "rbancifra@inszoneins.com",
      address:      "206 Highway 71 N.\nMena, AR 71953",
      lic:          "LIC OK#108343",
    },
    validationSchema: schema,
    onSubmit: () => {},
  });

  const [debouncedValues, isPending] = useDebounce(formik.values, 800);

  // ── Upload ────────────────────────────────────────────────────────────────

  async function handleUpload(file: File) {
    setUploadErr("");
    setLogoError("");
    setUploadedLogo(null);
    setEnhanced(null);
    setRawFile(null);
    setResizedLogoUrl(null); // reset resize al subir nuevo logo
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
    setResizedLogoUrl(null); // reset resize al enhancear
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
  // Pide a Cloudinary la imagen en la resolución exacta — no estira píxeles.

  function handleResizeSave(w: number, h: number) {
    setLogoDisplayWidth(w);
    setLogoDisplayHeight(h);

    const sourceUrl = activeLogo?.secure_url;
    if (sourceUrl) {
      // Genera URL de Cloudinary con las dimensiones exactas
      const resized = buildCloudinaryResizedUrl(sourceUrl, w, h);
      setResizedLogoUrl(resized);
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
        contactLines:      formik.values.contactLines,
        email:             formik.values.email,
        address:           formik.values.address,
        lic:               formik.values.lic || null,
        // Guarda la URL resizada (con transformación Cloudinary) si existe
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
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Error saving signature");
    } finally {
      setBusySave(false);
    }
  }

  // ── Copy ──────────────────────────────────────────────────────────────────

  async function handleCopy() {
    if (!hasUploadedLogo) {
      setLogoError("Please upload a partner logo before copying");
      return;
    }

    const errors = await formik.validateForm();
    const errorsWithoutName = Object.fromEntries(
      Object.entries(errors).filter(([key]) => key !== "name")
    );

    if (Object.keys(errorsWithoutName).length > 0) {
      formik.setTouched(
        Object.fromEntries(Object.keys(errorsWithoutName).map((k) => [k, true]))
      );
      return;
    }

    const html = buildOutlookSignatureHtml({
      fullName:          debouncedValues.fullName,
      title:             debouncedValues.title,
      contactLines:      debouncedValues.contactLines,
      email:             debouncedValues.email,
      address:           debouncedValues.address,
      lic:               debouncedValues.lic || undefined,
      // Usa la URL resizada (Cloudinary sirve la imagen a la resolución correcta)
      partnerLogoUrl:    logoUrl,
      partnerLogoWidth:  logoDisplayWidth,
      partnerLogoHeight: logoDisplayHeight,
      signatureType:     "powered-by",
    });

    await copyHtmlToClipboard(html);
    toast.success("Signature copied!");
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
  };
}