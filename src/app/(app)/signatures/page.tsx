/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { useFormik } from "formik";
import * as Yup from "yup";

import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import Stack from "@mui/joy/Stack";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Textarea from "@mui/joy/Textarea";
import Button from "@mui/joy/Button";
import Alert from "@mui/joy/Alert";
import CircularProgress from "@mui/joy/CircularProgress";
import Chip from "@mui/joy/Chip";
import { MainTitle } from "@/components/MainTitle";
import Image from "next/image";
import { SignatureIcon } from "@hugeicons/core-free-icons";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type UploadResult = {
  public_id:       string;
  secure_url:      string;
  display_url:     string;
  width:           number;
  height:          number;
  bytes:           number;
  format:          string;
  trimmed_ar?:     number;
  skipEnhancement?: boolean;
};

type LogoPhase =
  | null
  | "uploading"
  | "analyzing"
  | "enhancing"
  | "perfect"
  | "enhanced";

// ── Validación ─────────────────────────────────────────────────────────────────

const schema = Yup.object({
  fullName:     Yup.string().trim().min(2).required("Nombre requerido"),
  title:        Yup.string().trim().min(2).required("Cargo requerido"),
  contactLines: Yup.string().trim().min(2).required("Líneas de contacto requeridas"),
  email:        Yup.string().trim().email("Email inválido").required("Email requerido"),
  address:      Yup.string().trim().min(2).required("Dirección requerida"),
  lic:          Yup.string().trim().optional(),
});

// ── Página ─────────────────────────────────────────────────────────────────────

export default function OutlookSignaturePage() {
  const [original,      setOriginal]      = React.useState<UploadResult | null>(null);
  const [enhanced,      setEnhanced]      = React.useState<UploadResult | null>(null);
  const [rawPreviewUrl, setRawPreviewUrl] = React.useState<string | null>(null);
  const [signatureHtml, setSignatureHtml] = React.useState("");
  const [busyGenerate,  setBusyGenerate]  = React.useState(false);
  const [err,           setErr]           = React.useState<string>("");
  const [phase,         setPhase]         = React.useState<LogoPhase>(null);
  const [phaseMsg,      setPhaseMsg]      = React.useState<string>("");

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // El logo activo: si hay versión mejorada la usamos, si no la original
  const activeLogo   = enhanced ?? original;
  const userLogoUrl  = activeLogo?.display_url || "";
  const isProcessing = phase === "uploading" || phase === "analyzing" || phase === "enhancing";

  React.useEffect(() => {
    return () => {
      if (rawPreviewUrl) URL.revokeObjectURL(rawPreviewUrl);
    };
  }, [rawPreviewUrl]);

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

  const formik = useFormik({
    initialValues: {
      fullName:     "Reinalyn Bancifra",
      title:        "Marketing Coordinator",
      contactLines: "Phone: 479-394-2244\nFax: 479-394-2249",
      email:        "rbancifra@inszoneins.com",
      address:      "206 Highway 71 N.\nMena, AR 71953",
      lic:          "LIC OK#108343",
    },
    validationSchema: schema,
    onSubmit: async (values) => {
      setErr("");
      setBusyGenerate(true);
      setSignatureHtml("");
      try {
        const r = await fetch("/api/outlook-signature/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...values,
            userLogoUrl:    userLogoUrl || undefined,
            userLogoWidth:  activeLogo?.width  || undefined,
            userLogoHeight: activeLogo?.height || undefined,
          }),
        });
        const json = await r.json();
        if (!r.ok) throw new Error(json?.error || "No se pudo generar la firma");
        setSignatureHtml(json.html);
      } catch (e: any) {
        setErr(e?.message || "Error generando firma");
      } finally {
        setBusyGenerate(false);
      }
    },
  });

  // ── Pipeline: upload → analyze → enhance ─────────────────────────────────────

  async function handleUpload(file: File) {
    setErr("");
    setOriginal(null);
    setEnhanced(null);
    setSignatureHtml("");
    setPhase("uploading");
    setPhaseMsg("Subiendo logo…");

    if (rawPreviewUrl) URL.revokeObjectURL(rawPreviewUrl);
    setRawPreviewUrl(URL.createObjectURL(file));

    try {
      // PASO 1: Upload a Cloudinary
      // El servidor ya aplica: remoción de fondo + trim + fondo blanco + 20px padding
      const fd = new FormData();
      fd.append("file", file);

      const uploadRes  = await fetch("/api/upload-logo", { method: "POST", body: fd });
      const uploadText = await uploadRes.text();

      if (!uploadRes.ok) {
        throw new Error(`Upload failed (${uploadRes.status}). ${uploadText.slice(0, 300)}`);
      }
      if (!uploadRes.headers.get("content-type")?.includes("application/json")) {
        throw new Error(`Expected JSON. Body: ${uploadText.slice(0, 300)}`);
      }

      const uploadJson: UploadResult = JSON.parse(uploadText);
      setOriginal(uploadJson);

      // Si es SVG u otro caso que no necesita análisis → terminamos aquí
      if (uploadJson.skipEnhancement) {
        setPhase("perfect");
        setPhaseMsg(
          uploadJson.format === "svg"
            ? "SVG convertido a PNG con fondo blanco ✓"
            : "Logo listo ✓"
        );
        return;
      }

      // PASO 2: Analizar calidad con GPT-4o Vision
      setPhase("analyzing");
      setPhaseMsg("Analizando calidad del logo con IA…");

      const analyzeRes  = await fetch("/api/outlook-signature/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: uploadJson.secure_url }),
      });
      const analyzeJson = await analyzeRes.json();
      const needsWork: boolean = analyzeJson?.needsWork ?? false;
      const reason: string     = analyzeJson?.reason    ?? "";

      if (!needsWork) {
        // Logo de buena calidad → usar el procesado del upload (ya tiene fondo blanco + padding)
        setPhase("perfect");
        setPhaseMsg(reason || "Logo de buena calidad ✓");
        return;
      }

      // PASO 3: Mejorar calidad con GPT image generation
      setPhase("enhancing");
      setPhaseMsg((reason || "Calidad insuficiente") + " — generando versión mejorada…");

      // Enviamos la secure_url (imagen con fondo blanco procesada) para que AI mejore calidad
      const enhanceRes  = await fetch("/api/outlook-signature/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: uploadJson.secure_url }),
      });
      const enhanceJson = await enhanceRes.json();
      if (!enhanceRes.ok) throw new Error(enhanceJson?.error || "Enhance failed");

      setEnhanced({
        ...enhanceJson,
        // Los width/height vienen del enhance con el AR correcto
      });
      setPhase("enhanced");
      setPhaseMsg("Logo mejorado con IA ✓");

    } catch (e: any) {
      setErr(e?.message || "Error procesando logo");
      setPhase(null);
      setPhaseMsg("");
    }
  }

  async function copyHtml(html: string) {
    try {
      const blobHtml = new Blob([html], { type: "text/html" });
      const plain    = stripHtml(html);
      const blobTxt  = new Blob([plain], { type: "text/plain" });
      const item     = new ClipboardItem({ "text/html": blobHtml, "text/plain": blobTxt });
      await navigator.clipboard.write([item]);
    } catch {
      await navigator.clipboard.writeText(html);
    }
  }

  function stripHtml(html: string) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.innerText || div.textContent || "";
  }

  return (
    <>
      <MainTitle title="Outlook Signature Generator" icon={ SignatureIcon } />

      {err && (
        <Alert color="warning" variant="soft" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      <div className="flex gap-10 w-full">
        <div className="flex-2">
          <form onSubmit={formik.handleSubmit} className="flex gap-8">

            <div className="flex flex-col gap-4 flex-1">
              <FormControl error={Boolean(formik.touched.fullName && formik.errors.fullName)}>
                <FormLabel>Nombre completo</FormLabel>
                <Input name="fullName" value={formik.values.fullName} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                {formik.touched.fullName && formik.errors.fullName && (
                  <Typography level="body-xs" color="danger">{formik.errors.fullName}</Typography>
                )}
              </FormControl>

              <FormControl error={Boolean(formik.touched.title && formik.errors.title)}>
                <FormLabel>Cargo</FormLabel>
                <Input name="title" value={formik.values.title} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                {formik.touched.title && formik.errors.title && (
                  <Typography level="body-xs" color="danger">{formik.errors.title}</Typography>
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

            <div className="flex flex-col gap-4 flex-1">
              <FormControl>
                <FormLabel>Logo del agente (opcional)</FormLabel>
                <label
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  style={{ cursor: isProcessing ? "not-allowed" : "pointer", opacity: isProcessing ? 0.6 : 1 }}
                  className="flex items-center justify-center w-full h-32 px-4 transition bg-white/4 border-2 border-gray-700 border-dashed rounded-md appearance-none hover:border-accent focus:outline-none"
                >
                  <div className="flex flex-col justify-center items-center w-full text-center">
                    <svg className="w-8 h-8 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="font-medium text-gray-400">
                      Arrastra tu logo aquí, o <span className="text-accent underline">selecciona</span>
                    </span>
                    <span className="text-xs text-gray-500 mt-1">PNG, JPG, SVG, etc.</span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.svg"
                    onChange={handleInputChange}
                    className="hidden"
                    disabled={isProcessing}
                  />
                </label>
              </FormControl>

              {phase && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                  {isProcessing && <CircularProgress size="sm" />}
                  {phase === "perfect" && (
                    <Chip color="success" variant="soft" size="sm">✓ Logo listo</Chip>
                  )}
                  {phase === "enhanced" && (
                    <Chip color="primary" variant="soft" size="sm">✨ Mejorado con IA</Chip>
                  )}
                  <Typography level="body-xs" sx={{ opacity: 0.75 }}>
                    {phaseMsg}
                  </Typography>
                </Box>
              )}

              <Typography level="title-md">Logos</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                {/* Original: muestra el archivo tal cual lo subió el usuario */}
                <RawLogoCard title="Original" previewUrl={rawPreviewUrl} />
                {/* Procesado: resultado final con fondo blanco y dimensiones correctas */}
                <LogoCard
                  title={enhanced ? "Mejorado con IA" : "Procesado"}
                  data={enhanced ?? original}
                />
              </Box>

              <Stack direction="row" spacing={1} className="mt-4">
                <Button type="submit" disabled={!formik.isValid || busyGenerate || isProcessing}>
                  {busyGenerate ? "Generando…" : "Generar firma"}
                </Button>
              </Stack>
            </div>
          </form>
        </div>

        <div className="flex-1">
          <Typography level="title-md" sx={{ mb: 1 }}>Preview</Typography>
          <div className="bg-white p-8 rounded-lg">
            {signatureHtml ? (
              <div dangerouslySetInnerHTML={{ __html: signatureHtml }} />
            ) : (
              <Typography level="body-sm" sx={{ opacity: 0.8 }}>
                Genera la firma para ver el preview.
              </Typography>
            )}
          </div>
          {signatureHtml && (
            <Button variant="outlined" sx={{ mt: 1 }} onClick={() => copyHtml(signatureHtml)}>
              Copy Signature
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

// ── RawLogoCard — muestra el archivo local sin ningún procesamiento ────────────

function RawLogoCard({ title, previewUrl }: { title: string; previewUrl: string | null }) {
  return (
    <div className="bg-white/4 rounded-lg p-4">
      <Typography level="title-sm" sx={{ mb: 1 }}>{title}</Typography>
      <div className="flex flex-col gap-2 items-center justify-center min-h-[80px]">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={title}
            style={{ maxWidth: "100%", maxHeight: 120, objectFit: "contain" }}
          />
        ) : (
          <Typography level="body-xs" sx={{ opacity: 0.5 }}>Sin imagen</Typography>
        )}
      </div>
    </div>
  );
}

// ── LogoCard — muestra el resultado procesado con dimensiones reales ──────────

function LogoCard({ title, data }: { title: string; data: UploadResult | null }) {
  // width/height vienen de getSmartLogoBox (basado en AR del contenido real)
  const w      = data?.width  ?? 96;
  const h      = data?.height ?? 96;
  const imgUrl = data?.display_url || data?.secure_url || null;

  return (
    <div className="bg-white/4 rounded-lg p-4">
      <Typography level="title-sm" sx={{ mb: 1 }}>{title}</Typography>
      <div className="flex flex-col gap-2 items-center justify-center min-h-[80px]">
        {imgUrl ? (
          <>
            <Image
              src={imgUrl}
              alt={title}
              width={w}
              height={h}
              style={{ width: w, height: h, objectFit: "contain" }}
            />
            <Typography level="body-xs" sx={{ opacity: 0.8 }}>
              {w}×{h}px
              {data?.trimmed_ar ? ` • AR ${data.trimmed_ar.toFixed(2)}` : ""}
              {data?.bytes ? ` • ${Math.round(data.bytes / 1024)} KB` : ""}
            </Typography>
          </>
        ) : (
          <Typography level="body-xs" sx={{ opacity: 0.5 }}>Sin imagen</Typography>
        )}
      </div>
    </div>
  );
}