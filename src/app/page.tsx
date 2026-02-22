/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useColorScheme } from "@mui/joy";

import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import Stack from "@mui/joy/Stack";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Textarea from "@mui/joy/Textarea";
import Button from "@mui/joy/Button";
import CircularProgress from "@mui/joy/CircularProgress";
import Chip from "@mui/joy/Chip";
import { MainTitle } from "@/components/MainTitle";
import { EyeIcon, SignatureIcon } from "@hugeicons/core-free-icons";
import { buildOutlookSignatureHtml } from "@/lib/outlookSignature";

// ── Constantes ────────────────────────────────────────────────────────────────

const DEFAULT_LOGO_URL    = "https://inszoneinsurance.com/wp-content/uploads/2026/02/default-logo-1.png";
const DEFAULT_LOGO_WIDTH  = 152;
const DEFAULT_LOGO_HEIGHT = 44;
const INSZONE_LOGO_URL    = "https://inszoneinsurance.com/wp-content/uploads/2026/01/logo-inszone.png";
const FACEBOOK_URL        = "https://inszoneinsurance.com/wp-content/uploads/2026/02/facebook.png";
const TWITTER_URL         = "https://inszoneinsurance.com/wp-content/uploads/2026/02/twitter.png";
const LINKEDIN_URL        = "https://inszoneinsurance.com/wp-content/uploads/2026/02/linkedin.png";
const DEBOUNCE_MS         = 1000;

// ── Tipos ─────────────────────────────────────────────────────────────────────

type SmartPlan =
  | { kind: "HAS_ALPHA" }
  | { kind: "SOLID_BG"; bgHex: string; bgR: number; bgG: number; bgB: number }
  | { kind: "COMPLEX_BG" }
  | { kind: "SVG" }
  | { kind: "BADGE" };

type UploadResult = {
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

type FormValues = {
  fullName:     string;
  title:        string;
  contactLines: string;
  email:        string;
  address:      string;
  lic:          string;
};

// ── Validación ─────────────────────────────────────────────────────────────────

const schema = Yup.object({
  fullName:     Yup.string().trim().min(2).required("Nombre requerido"),
  title:        Yup.string().trim().min(2).required("Cargo requerido"),
  contactLines: Yup.string().trim().min(2).required("Líneas de contacto requeridas"),
  email:        Yup.string().trim().email("Email inválido").required("Email requerido"),
  address:      Yup.string().trim().min(2).required("Dirección requerida"),
  lic:          Yup.string().trim().optional(),
});

// ── Hook: debounce ────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): [T, boolean] {
  const [debounced, setDebounced] = React.useState<T>(value);
  const [pending,   setPending]   = React.useState(false);

  React.useEffect(() => {
    setPending(true);
    const timer = setTimeout(() => {
      setDebounced(value);
      setPending(false);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return [debounced, pending];
}

// ── Colores del preview según modo ───────────────────────────────────────────

type PreviewColors = {
  bg:         string;
  border:     string;
  nameColor:  string;
  textColor:  string;
  linkColor:  string;
  mutedColor: string;
};

function getPreviewColors(isDark: boolean): PreviewColors {
  if (isDark) {
    return {
      bg:         "#1e1e35",
      border:     "#A4B6D8",
      nameColor:  "#A4B6D8",
      textColor:  "#D1D5DB",
      linkColor:  "#A4B6D8",
      mutedColor: "#9CA3AF",
    };
  }
  return {
    bg:         "#ffffff",
    border:     "#6F8CC0",
    nameColor:  "#6F8CC0",
    textColor:  "#364153",
    linkColor:  "#6F8CC0",
    mutedColor: "#6B7280",
  };
}

// ── Preview Component ─────────────────────────────────────────────────────────

type SignaturePreviewProps = {
  values:       FormValues;
  logoUrl:      string;
  logoWidth:    number;
  logoHeight:   number;
  isDark:       boolean;
  logoLoading:  boolean; // true mientras se procesa un logo nuevo
};

function SignaturePreview({ values, logoUrl, logoWidth, logoHeight, isDark, logoLoading }: SignaturePreviewProps) {
  const c = getPreviewColors(isDark);

  const contactLines = values.contactLines.trim().split("\n").map((line, i) => (
    <React.Fragment key={i}>{line}<br /></React.Fragment>
  ));

  const addressLines = values.address.trim().split("\n").map((line, i) => (
    <React.Fragment key={i}>{line}<br /></React.Fragment>
  ));

  return (
    <table cellPadding={0} cellSpacing={0} style={{
      borderCollapse: "collapse",
      fontFamily: "Arial, sans-serif",
      fontSize: 12,
      lineHeight: "16px",
      color: c.textColor,
    }}>
      <tbody>
        <tr>
          {/* LEFT COLUMN */}
          <td valign="top" style={{
            textAlign: "right",
            paddingRight: 16,
            borderRight: `2px solid ${c.border}`,
            whiteSpace: "nowrap",
          }}>
            <p style={{ margin: "0 0 2px", fontSize: 18, color: c.nameColor }}>
              <strong>{values.fullName || "Nombre Completo"}</strong>
            </p>
            <p style={{ margin: 0, color: c.textColor, fontSize: 11, letterSpacing: "0.05em" }}>
              {(values.title || "Cargo").toUpperCase()}
            </p>
            <p style={{ margin: "12px 0 0", color: c.textColor }}>
              {contactLines}
              <a href={`mailto:${values.email}`} style={{ color: c.linkColor, textDecoration: "underline" }}>
                {values.email || "email@ejemplo.com"}
              </a>
            </p>
            <p style={{ margin: "12px 0 0", color: c.textColor }}>
              {addressLines}
            </p>
            {values.lic && (
              <p style={{ margin: "12px 0 0", letterSpacing: "1.5pt", color: c.textColor }}>
                {values.lic}
              </p>
            )}
            <p style={{ margin: "12px 0 0", display: "flex", justifyContent: "flex-end", gap: 4 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a href="https://www.facebook.com/InszoneInsuranceServices/" target="_blank" rel="noreferrer" style={{ display: "inline", textDecoration: "none" }}>
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

          {/* RIGHT COLUMN */}
          <td valign="top" style={{ paddingLeft: 16, textAlign: "center" }}>
            <p style={{ margin: "0 0 6px", textAlign: "center" }}>

              {/* Logo — placeholder mientras carga, imagen cuando está listo */}
              {logoLoading ? (
                // Placeholder con las dimensiones exactas del default logo (152×44)
                // para que no haya salto de layout al cambiar
                <div style={{
                  display:         "flex",
                  alignItems:      "center",
                  justifyContent:  "center",
                  gap:             6,
                  width:           DEFAULT_LOGO_WIDTH,
                  height:          DEFAULT_LOGO_HEIGHT,
                  margin:          "0 auto 6px",
                  borderRadius:    6,
                  backgroundColor: isDark ? "rgba(164,182,216,0.10)" : "rgba(111,140,192,0.08)",
                }}>
                  {/* Spinner SVG inline — no deps adicionales */}
                  <svg
                    width="20" height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={isDark ? "#A4B6D8" : "#6F8CC0"}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    style={{ animation: "spin 0.9s linear infinite", flexShrink: 0 }}
                  >
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  <span style={{
                    fontSize:    12,
                    color:       isDark ? "#A4B6D8" : "#6F8CC0",
                    letterSpacing: "0.03em",
                    whiteSpace:  "nowrap",
                  }}>
                    Procesando logo…
                  </span>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Partner logo"
                  width={logoWidth}
                  height={logoHeight}
                  style={{
                    display:     "block",
                    margin:      "0 auto 6px",
                    width:       logoWidth,
                    height:      logoHeight,
                    objectFit:   "contain",
                  }}
                />
              )}

              <span style={{ display: "block", margin: "0 0 8px", color: c.nameColor, fontWeight: "bold" }}>
                powered by
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={INSZONE_LOGO_URL} alt="Inszone Insurance" style={{ display: "inline" }} />
            </p>
            <p style={{ margin: "16px 0 8px" }}>
              <a href="https://inszoneinsurance.com/" target="_blank" rel="noreferrer" style={{ color: c.linkColor, textDecoration: "underline" }}>
                INSZONEINSURANCE.COM
              </a>
            </p>
            <p style={{ margin: 0, letterSpacing: "1.5pt", color: c.mutedColor }}>
              LIC #0F82764
            </p>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function OutlookSignaturePage() {
  const { mode, systemMode } = useColorScheme();
  const isDark = mode === "dark" || (mode === "system" && systemMode === "dark");

  const [uploadedLogo,  setUploadedLogo]  = React.useState<UploadResult | null>(null);
  const [enhanced,      setEnhanced]      = React.useState<UploadResult | null>(null);
  const [rawFile,       setRawFile]       = React.useState<File | null>(null);
  const [busyUpload,    setBusyUpload]    = React.useState(false);
  const [busyEnhance,   setBusyEnhance]   = React.useState(false);
  const [uploadMsg,     setUploadMsg]     = React.useState<string>("");
  const [uploadErr,     setUploadErr]     = React.useState<string>("");
  const [logoError,     setLogoError]     = React.useState<string>("");
  const [copySuccess,   setCopySuccess]   = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const activeLogo      = enhanced ?? uploadedLogo;
  const logoUrl         = activeLogo?.display_url || DEFAULT_LOGO_URL;
  const logoWidth       = activeLogo?.width        || DEFAULT_LOGO_WIDTH;
  const logoHeight      = activeLogo?.height       || DEFAULT_LOGO_HEIGHT;
  const hasUploadedLogo = !!activeLogo;
  const isBadge         = uploadedLogo?.plan?.kind === "BADGE";
  const canEnhance      = !!uploadedLogo && !!rawFile && !uploadedLogo.skipEnhancement && !busyEnhance && !busyUpload;

  // logoLoading: true desde que el usuario elige el archivo hasta que llega el resultado
  // También true durante el enhance (el logo se va a reemplazar)
  const logoLoading = busyUpload || busyEnhance;

  const formik = useFormik<FormValues>({
    initialValues: {
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

  const [debouncedValues, isPending] = useDebounce(formik.values, DEBOUNCE_MS);

  // ── Drag & drop ─────────────────────────────────────────────────────────────

  function handleDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
  }
  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }

  // ── Upload logo ─────────────────────────────────────────────────────────────

  async function handleUpload(file: File) {
    setUploadErr("");
    setLogoError("");
    setUploadedLogo(null);   // <- limpia inmediatamente → logoLoading=true → placeholder aparece
    setEnhanced(null);
    setRawFile(null);
    setUploadMsg("Subiendo y procesando logo…");
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
      setUploadedLogo(json);  // <- llega el logo → logoLoading=false → imagen aparece
      setUploadMsg(
        json.skipEnhancement
          ? "Logo listo ✓"
          : "Logo procesado ✓ — puedes mejorarlo con IA si lo deseas"
      );
    } catch (e: any) {
      setRawFile(null);
      setUploadErr(e?.message || "Error procesando logo");
      setUploadMsg("");
    } finally {
      setBusyUpload(false);
    }
  }

  // ── Mejorar con IA ──────────────────────────────────────────────────────────

  async function handleEnhance() {
    if (!uploadedLogo || !rawFile) return;
    setUploadErr("");
    setBusyEnhance(true);    // <- logoLoading=true → placeholder mientras mejora
    setUploadMsg("Mejorando logo con IA…");

    try {
      const fd = new FormData();
      fd.append("file", rawFile);
      fd.append("isBadge", String(isBadge));

      const res  = await fetch("/api/outlook-signature/enhance", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Enhance failed");

      setEnhanced(json);     // <- llega → logoLoading=false → imagen mejorada
      setUploadMsg("Logo mejorado con IA ✓");
    } catch (e: any) {
      setUploadErr(e?.message || "Error mejorando logo");
      setUploadMsg("");
    } finally {
      setBusyEnhance(false);
    }
  }

  // ── Copiar firma ─────────────────────────────────────────────────────────────

  async function handleCopy() {
    if (!hasUploadedLogo) {
      setLogoError("Debes subir un logo para copiar la firma");
      return;
    }
    if (!formik.isValid) {
      formik.submitForm();
      return;
    }

    const html = buildOutlookSignatureHtml({
      fullName:       debouncedValues.fullName,
      title:          debouncedValues.title,
      contactLines:   debouncedValues.contactLines,
      email:          debouncedValues.email,
      address:        debouncedValues.address,
      lic:            debouncedValues.lic || undefined,
      userLogoUrl:    activeLogo?.display_url,
      userLogoWidth:  activeLogo?.width,
      userLogoHeight: activeLogo?.height,
    });

    try {
      const blobHtml = new Blob([html], { type: "text/html" });
      const blobTxt  = new Blob([stripHtml(html)], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": blobHtml, "text/plain": blobTxt }),
      ]);
    } catch {
      await navigator.clipboard.writeText(html);
    }

    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  }

  function stripHtml(html: string) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.innerText || div.textContent || "";
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex-2 py-10">
        <div className="mx-auto w-3xl">
          <MainTitle title="Outlook Signature Generator" icon={SignatureIcon} />
          <div className="flex-1 flex flex-col gap-4 min-w-0 mt-8">

            <div className="flex gap-6">
              {/* Columna izquierda */}
              <div className="flex flex-col gap-4 flex-1">
                <FormControl error={Boolean(formik.touched.fullName && formik.errors.fullName)}>
                  <FormLabel>Nombre completo</FormLabel>
                  <Input name="fullName" value={formik.values.fullName} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                  {formik.touched.fullName && formik.errors.fullName && (
                    <Typography level="body-xs" color="danger">{formik.errors.fullName}</Typography>
                  )}
                </FormControl>

                <FormControl error={Boolean(formik.touched.contactLines && formik.errors.contactLines)}>
                  <FormLabel>Líneas de contacto</FormLabel>
                  <Textarea name="contactLines" minRows={2} value={formik.values.contactLines} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                  {formik.touched.contactLines && formik.errors.contactLines && (
                    <Typography level="body-xs" color="danger">{formik.errors.contactLines}</Typography>
                  )}
                </FormControl>

                <FormControl error={Boolean(formik.touched.email && formik.errors.email)}>
                  <FormLabel>Email</FormLabel>
                  <Input name="email" value={formik.values.email} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                  {formik.touched.email && formik.errors.email && (
                    <Typography level="body-xs" color="danger">{formik.errors.email}</Typography>
                  )}
                </FormControl>
              </div>

              {/* Columna derecha */}
              <div className="flex flex-col gap-4 flex-1">
                <FormControl error={Boolean(formik.touched.title && formik.errors.title)}>
                  <FormLabel>Cargo</FormLabel>
                  <Input name="title" value={formik.values.title} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                  {formik.touched.title && formik.errors.title && (
                    <Typography level="body-xs" color="danger">{formik.errors.title}</Typography>
                  )}
                </FormControl>

                <FormControl error={Boolean(formik.touched.address && formik.errors.address)}>
                  <FormLabel>Dirección</FormLabel>
                  <Textarea name="address" minRows={2} value={formik.values.address} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                  {formik.touched.address && formik.errors.address && (
                    <Typography level="body-xs" color="danger">{formik.errors.address}</Typography>
                  )}
                </FormControl>

                <FormControl>
                  <FormLabel>LIC (opcional)</FormLabel>
                  <Input name="lic" placeholder="ej: LIC OK#108343" value={formik.values.lic} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                </FormControl>
              </div>
            </div>

            {/* Logo upload */}
            <FormControl error={!!logoError}>
              <FormLabel>Logo del agente *</FormLabel>
              <label
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                style={{ cursor: busyUpload ? "not-allowed" : "pointer", opacity: busyUpload ? 0.6 : 1 }}
                className="flex items-center justify-center w-full h-32 px-4 transition bg-[var(--soft-bg)] border-2 border-[var(--soft-bg-active)] border-dashed rounded-md appearance-none hover:border-accent hover:bg-[var(--soft-bg-hover)] focus:outline-none"
              >
                <div className="flex flex-col justify-center items-center w-full text-center">
                  <svg className="w-8 h-8 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="font-medium text-gray-400">
                    Arrastra tu logo aquí, o <span className="text-accent underline">selecciona</span>
                  </span>
                  <span className="text-xs text-gray-500 mt-1">PNG, JPG, SVG, WEBP, etc.</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.svg"
                  onChange={handleInputChange}
                  className="hidden"
                  disabled={busyUpload || busyEnhance}
                />
              </label>
              {logoError && (
                <Typography level="body-xs" color="danger">{logoError}</Typography>
              )}
            </FormControl>

            {/* Estado del upload */}
            {(busyUpload || busyEnhance || uploadMsg || uploadErr) && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                {(busyUpload || busyEnhance) && <CircularProgress size="sm" />}
                {!busyUpload && !busyEnhance && enhanced && (
                  <Chip color="primary" variant="soft" size="sm">✨ Mejorado con IA</Chip>
                )}
                {!busyUpload && !busyEnhance && !enhanced && uploadedLogo && (
                  <Chip color="success" variant="soft" size="sm">✓ Procesado</Chip>
                )}
                {uploadMsg && (
                  <Typography level="body-xs" sx={{ opacity: 0.75 }}>{uploadMsg}</Typography>
                )}
                {uploadErr && (
                  <Typography level="body-xs" color="danger">{uploadErr}</Typography>
                )}
              </Box>
            )}

            {/* Botón mejorar con IA */}
            {uploadedLogo && !uploadedLogo.skipEnhancement && (
              <Button
                variant="outlined"
                color="neutral"
                size="sm"
                onClick={handleEnhance}
                disabled={!canEnhance}
                startDecorator={busyEnhance ? <CircularProgress size="sm" /> : undefined}
              >
                {busyEnhance ? "Mejorando…" : "✨ Mejorar con IA"}
              </Button>
            )}

            {/* Botón copiar */}
            <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: "center" }}>
              <Button
                onClick={handleCopy}
                disabled={isPending || busyUpload || busyEnhance}
                color={copySuccess ? "success" : "primary"}
              >
                {isPending
                  ? "Actualizando firma…"
                  : copySuccess
                    ? "✓ Firma copiada"
                    : "Copiar firma"}
              </Button>
              {isPending && (
                <Typography level="body-xs" sx={{ opacity: 0.6 }}>
                  Esperando que termines de escribir…
                </Typography>
              )}
            </Stack>
          </div>
        </div>
      </div>

      {/* PREVIEW */}
      <Box
        sx={{
          background: isDark ? "#1e1e35" : "#fff",
          overflow: "hidden",
          transition: "background 0.2s ease",
          padding: "32px",
          flex: "1",
        }}
      >
        <div className="flex-1 min-w-0 mb-8">
          <Box sx={{ display: "flex", alignItems: "center", gap: "24px", mb: 1.5 }}>
            <MainTitle title="Preview" icon={EyeIcon} />
            {isPending && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size="sm" />
                <Typography level="body-xs" sx={{ opacity: 0.6 }}>Actualizando…</Typography>
              </Box>
            )}
          </Box>
        </div>
        <div className="flex justify-center">
          <SignaturePreview
            values={formik.values}
            logoUrl={logoUrl}
            logoWidth={logoWidth}
            logoHeight={logoHeight}
            isDark={isDark}
            logoLoading={logoLoading}
          />
        </div>
      </Box>
    </>
  );
}