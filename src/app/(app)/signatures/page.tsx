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
import { MainTitle } from "@/components/MainTitle";
import Image from "next/image";
import { getSmartLogoSize } from "@/lib/logoSizing";

type UploadResult = {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
};

const schema = Yup.object({
  fullName:      Yup.string().trim().min(2).required("Nombre requerido"),
  title:         Yup.string().trim().min(2).required("Cargo requerido"),
  contactLines:  Yup.string().trim().min(2).required("Líneas de contacto requeridas"),
  email:         Yup.string().trim().email("Email inválido").required("Email requerido"),
  address:       Yup.string().trim().min(2).required("Dirección requerida"),
  lic:           Yup.string().trim().optional(),
});

export default function OutlookSignaturePage() {
  const [original, setOriginal] = React.useState<UploadResult | null>(null);
  const [enhanced, setEnhanced] = React.useState<UploadResult | null>(null);
  const [signatureHtml, setSignatureHtml] = React.useState("");
  const [busyUpload, setBusyUpload] = React.useState(false);
  const [busyEnhance, setBusyEnhance] = React.useState(false);
  const [busyGenerate, setBusyGenerate] = React.useState(false);
  const [err, setErr] = React.useState<string>("");

  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  const userLogoUrl = enhanced?.secure_url || original?.secure_url || "";

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
            userLogoUrl: userLogoUrl || undefined,
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

  async function handleUpload(file: File) {
    setErr("");
    setBusyUpload(true);
    setOriginal(null);
    setEnhanced(null);
    setSignatureHtml("");

    try {
      const fd = new FormData();
      fd.append("file", file);

      const r = await fetch("/api/outlook-signature/upload", { method: "POST", body: fd });
      const contentType = r.headers.get("content-type") || "";
const bodyText = await r.text();

if (!r.ok) {
  throw new Error(`Upload failed (${r.status}). ${bodyText.slice(0, 300)}`);
}

if (!contentType.includes("application/json")) {
  throw new Error(`Expected JSON but got: ${contentType}. Body: ${bodyText.slice(0, 300)}`);
}

const json = JSON.parse(bodyText);
setOriginal(json);

      if ((json?.width ?? 0) < 300 || (json?.height ?? 0) < 300) {
        setErr("⚠️ El logo parece pequeño. La IA puede ayudar, pero lo ideal es subir un PNG grande o SVG.");
      }
    } catch (e: any) {
      setErr(e?.message || "Error subiendo imagen");
    } finally {
      setBusyUpload(false);
    }
  }

  async function handleEnhance() {
    if (!original?.secure_url) return;
    setErr("");
    setBusyEnhance(true);
    setEnhanced(null);
    setSignatureHtml("");

    try {
      const r = await fetch("/api/outlook-signature/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: original.secure_url }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error || "Enhance failed");

      setEnhanced(json);
    } catch (e: any) {
      setErr(e?.message || "Error mejorando logo");
    } finally {
      setBusyEnhance(false);
    }
  }

  async function copyHtml(html: string) {
    try {
      const blobHtml = new Blob([html], { type: "text/html" });
      const plain = stripHtml(html);
      const blobTxt = new Blob([plain], { type: "text/plain" });
      const item = new ClipboardItem({ "text/html": blobHtml, "text/plain": blobTxt });
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
      <MainTitle title="Outlook Signature Generator" />

      {err && (
        <Alert color="warning" variant="soft" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}
      
      <div className="flex gap-10 w-full">
        <div className="flex-2">
          <form onSubmit={formik.handleSubmit} className="flex gap-8">
            <div className="flex flex-col gap-4 flex-1">

              {/* Full Name */}
              <FormControl error={Boolean(formik.touched.fullName && formik.errors.fullName)}>
                <FormLabel>Nombre completo</FormLabel>
                <Input name="fullName" value={formik.values.fullName} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                {formik.touched.fullName && formik.errors.fullName && (
                  <Typography level="body-xs" color="danger">{formik.errors.fullName}</Typography>
                )}
              </FormControl>

              {/* Title */}
              <FormControl error={Boolean(formik.touched.title && formik.errors.title)}>
                <FormLabel>Cargo</FormLabel>
                <Input name="title" value={formik.values.title} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                {formik.touched.title && formik.errors.title && (
                  <Typography level="body-xs" color="danger">{formik.errors.title}</Typography>
                )}
              </FormControl>

              {/* Contact Lines */}
              <FormControl error={Boolean(formik.touched.contactLines && formik.errors.contactLines)}>
                <FormLabel>Líneas de contacto</FormLabel>
                <Textarea
                  name="contactLines"
                  minRows={2}
                  value={formik.values.contactLines}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                {formik.touched.contactLines && formik.errors.contactLines && (
                  <Typography level="body-xs" color="danger">{formik.errors.contactLines}</Typography>
                )}
              </FormControl>

              {/* Email */}
              <FormControl error={Boolean(formik.touched.email && formik.errors.email)}>
                <FormLabel>Email</FormLabel>
                <Input name="email" value={formik.values.email} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                {formik.touched.email && formik.errors.email && (
                  <Typography level="body-xs" color="danger">{formik.errors.email}</Typography>
                )}
              </FormControl>

              {/* Address */}
              <FormControl error={Boolean(formik.touched.address && formik.errors.address)}>
                <FormLabel>Dirección</FormLabel>
                <Textarea
                  name="address"
                  minRows={2}
                  value={formik.values.address}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                {formik.touched.address && formik.errors.address && (
                  <Typography level="body-xs" color="danger">{formik.errors.address}</Typography>
                )}
              </FormControl>

              {/* LIC (opcional) */}
              <FormControl>
                <FormLabel>LIC (opcional)</FormLabel>
                <Input
                  name="lic"
                  placeholder="ej: LIC OK#108343"
                  value={formik.values.lic}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
              </FormControl>
            </div>
            <div className="flex flex-col gap-4 flex-1">

              {/* Logo upload */}
              <FormControl>
                <FormLabel>Logo del agente (opcional)</FormLabel>
                <label
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="flex items-center justify-center w-full h-32 px-4 transition bg-white/4 border-2 border-gray-700 border-dashed rounded-md appearance-none cursor-pointer hover:border-accent focus:outline-none"
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
                    accept="image/*"
                    onChange={handleInputChange}
                    className="hidden"
                    disabled={busyUpload}
                  />
                </label>
              </FormControl>

              <Typography level="title-md" sx={{ mt: 2 }}>
                Logos
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                <LogoCard title="Original" data={original} smart />
                <LogoCard title="Procesado" data={enhanced} />
              </Box>

              <Stack direction="row" spacing={1} className="mt-4">
                <Button variant="soft" onClick={handleEnhance} disabled={!original?.secure_url || busyEnhance}>
                  {busyEnhance ? "Mejorando..." : "Mejorar con IA"}
                </Button>
                <Button type="submit" disabled={!formik.isValid || busyGenerate}>
                  {busyGenerate ? "Generando..." : "Generar firma"}
                </Button>
              </Stack>
            </div>
          </form>
        </div>
        <div className="flex-1">
          <Typography level="title-md" sx={{ mb: 1 }}>
            Preview
          </Typography>
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

function LogoCard({
  title,
  data,
  smart = false,
}: {
  title: string;
  data: UploadResult | null;
  smart?: boolean;
}) {
  const size = smart ? getSmartLogoSize(data?.width, data?.height) : { w: 96, h: 96 };

  return (
    <div className="bg-white/4 rounded-lg p-4">
      <Typography level="title-sm" sx={{ mb: 1 }}>
        {title}
      </Typography>

      {/* Quitamos el aspect fijo para que el logo pueda tener su tamaño real */}
      <div className="flex flex-col gap-2 items-center justify-center">
        {data?.secure_url ? (
          <>
            <Image
              src={data.secure_url}
              alt={title}
              width={size.w}
              height={size.h}
              style={{ width: size.w, height: size.h, objectFit: "contain" }}
            />

            <Typography level="body-xs" sx={{ opacity: 0.8 }}>
              {data.width}×{data.height} • {Math.round((data.bytes ?? 0) / 1024)} KB • {data.format}
              {smart ? ` • render ${size.w}×${size.h}` : ""}
            </Typography>
          </>
        ) : (
          <Typography level="body-xs" sx={{ opacity: 0.8 }}>
            Sin imagen
          </Typography>
        )}
      </div>
    </div>
  );
}