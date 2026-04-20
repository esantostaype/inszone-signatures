/* eslint-disable react/no-unescaped-entities */
"use client";
// src/components/organisms/SignatureForm.tsx
import * as React from "react";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { LogoUploader } from "@/components/signatures/LogoUploader";
import { SignatureActions } from "@/components/signatures/SignatureActions";
import { FIELD_MAX_LENGTH, type useSignatureBuilder, type SignatureType } from "@/hooks/useSignatureBuilder";

type BuilderState = ReturnType<typeof useSignatureBuilder>;

interface SignatureFormProps {
  state: BuilderState;
}

// ── Type selector ─────────────────────────────────────────────

const SIGNATURE_TYPES: { value: SignatureType; label: string; description: string }[] = [
  { value: "basic",       label: "Basic",                description: "Inszone logo only, no partner branding" },
  { value: "powered-by",  label: "Powered By",           description: "Partner logo + powered by Inszone" },
  { value: "formerly",    label: "Formerly Operating As", description: "Inszone logo + formerly partner name" },
];

function TypeSelector({
  value,
  onChange,
}: {
  value: SignatureType;
  onChange: (v: SignatureType) => void;
}) {
  return (
    <div>
      <FormLabel sx={{ mb: 1 }}>Signature Type *</FormLabel>
      <div className="flex gap-2 flex-wrap">
        {SIGNATURE_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            style={{
              flex: "1 1 auto",
              minWidth: 120,
              padding: "10px 14px",
              borderRadius: 8,
              border: value === t.value
                ? "2px solid var(--joy-palette-primary-500, #0B6BCB)"
                : "2px solid var(--joy-palette-neutral-outlinedBorder, rgba(99,107,116,0.3))",
              background: value === t.value
                ? "var(--joy-palette-primary-softBg, rgba(11,107,203,0.12))"
                : "var(--joy-palette-background-surface, #fff)",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s",
            }}
          >
            <div style={{
              fontWeight: 600,
              fontSize: 13,
              color: value === t.value
                ? "var(--joy-palette-primary-600, #0B6BCB)"
                : "var(--joy-palette-text-primary)",
              marginBottom: 2,
            }}>
              {t.label}
            </div>
            <div style={{
              fontSize: 11,
              color: "var(--joy-palette-text-tertiary)",
              lineHeight: 1.3,
            }}>
              {t.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────

export function SignatureForm({ state }: SignatureFormProps) {
  const {
    formik,
    signatureType,
    setSignatureType,
    certRequest,
    setCertRequest,
    uploadedLogo,
    enhanced,
    hasUploadedLogo,
    canEnhance,
    busyUpload,
    busyEnhance,
    busySave,
    isPending,
    uploadMsg,
    uploadErr,
    logoError,
    logoUrl,
    logoSecureUrl,
    logoDisplayWidth,
    logoDisplayHeight,
    originalLogoWidth,
    originalLogoHeight,
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
  } = state;

  const { values, errors, touched, handleChange, handleBlur } = formik;

  const showLogoUploader = signatureType !== "basic";

  return (
    <div>
      <div className="grid md:grid-cols-2 gap-4">

        {/* ── Type selector — col span 2 ───────────────────────── */}
        <div className="col-span-2">
          <TypeSelector value={signatureType} onChange={setSignatureType} />
        </div>

        {/* ── Signature Name — col span 2 ─────────────────────── */}
        <FormControl
          error={Boolean(touched.name && errors.name)}
          className="col-span-2"
        >
          <FormLabel>Signature Name *</FormLabel>
          <Input
            name="name"
            placeholder="e.g. Farmers Insurance, State Farm, AAA Insurance…"
            value={values.name}
            onChange={handleChange}
            onBlur={handleBlur}
            slotProps={{ input: { maxLength: FIELD_MAX_LENGTH.name } }}
          />
          <Typography level="body-sm" sx={{ mt: 0.5 }} color="neutral">
            Use the partner company name — this is how you'll find this signature later.
          </Typography>
          {touched.name && errors.name && (
            <Typography level="body-xs" color="danger" sx={{ mt: 0.5 }}>{errors.name}</Typography>
          )}
        </FormControl>

        {/* Full Name */}
        <FormControl error={Boolean(touched.fullName && errors.fullName)}>
          <FormLabel>Full Name *</FormLabel>
          <Input
            name="fullName"
            value={values.fullName}
            onChange={handleChange}
            onBlur={handleBlur}
            slotProps={{ input: { maxLength: FIELD_MAX_LENGTH.fullName } }}
          />
          {touched.fullName && errors.fullName && (
            <Typography level="body-xs" color="danger" sx={{ mt: 0.5 }}>{errors.fullName}</Typography>
          )}
        </FormControl>

        {/* Title */}
        <FormControl error={Boolean(touched.title && errors.title)}>
          <FormLabel>Job Title *</FormLabel>
          <Textarea
            name="title"
            minRows={1}
            maxRows={2}
            value={values.title}
            onChange={handleChange}
            onBlur={handleBlur}
            slotProps={{ textarea: { maxLength: FIELD_MAX_LENGTH.title } }}
          />
          {touched.title && errors.title && (
            <Typography level="body-xs" color="danger" sx={{ mt: 0.5 }}>{errors.title}</Typography>
          )}
        </FormControl>

        {/* Phone */}
        <FormControl error={Boolean(touched.phone && errors.phone)}>
          <FormLabel>Phone *</FormLabel>
          <Input
            name="phone"
            placeholder="e.g. 479-394-2244"
            value={values.phone}
            onChange={handlePhoneChange}
            onBlur={handleBlur}
          />
          {touched.phone && errors.phone && (
            <Typography level="body-xs" color="danger" sx={{ mt: 0.5 }}>{errors.phone}</Typography>
          )}
        </FormControl>

        {/* Office (direct) */}
        <FormControl>
          <FormLabel>Office (optional)</FormLabel>
          <Input
            name="direct"
            placeholder="e.g. 479-394-2250"
            value={values.direct}
            onChange={handleDirectChange}
            onBlur={handleBlur}
          />
        </FormControl>

        {/* SMS */}
        <FormControl>
          <FormLabel>SMS (optional)</FormLabel>
          <Input
            name="sms"
            placeholder="e.g. 479-394-2251"
            value={values.sms}
            onChange={handleSmsChange}
            onBlur={handleBlur}
          />
        </FormControl>

        {/* Fax */}
        <FormControl>
          <FormLabel>Fax (optional)</FormLabel>
          <Input
            name="fax"
            placeholder="e.g. 479-394-2249"
            value={values.fax}
            onChange={handleFaxChange}
            onBlur={handleBlur}
          />
        </FormControl>

        {/* Email */}
        <FormControl error={Boolean(touched.email && errors.email)}>
          <FormLabel>Email *</FormLabel>
          <Input
            name="email"
            type="email"
            value={values.email}
            onChange={handleChange}
            onBlur={handleBlur}
            slotProps={{ input: { maxLength: FIELD_MAX_LENGTH.email } }}
          />
          {touched.email && errors.email && (
            <Typography level="body-xs" color="danger" sx={{ mt: 0.5 }}>{errors.email}</Typography>
          )}
        </FormControl>

        {/* LIC */}
        <FormControl>
          <FormLabel>LIC (optional)</FormLabel>
          <Input
            name="lic"
            placeholder="e.g. LIC OK#108343"
            value={values.lic}
            onChange={handleChange}
            onBlur={handleBlur}
            slotProps={{ input: { maxLength: FIELD_MAX_LENGTH.lic } }}
          />
        </FormControl>

        {/* Address — always shown, always optional */}
        <FormControl error={Boolean(touched.address && errors.address)} className="col-span-2">
          <FormLabel>
            {signatureType === "basic" ? "Address (defaults to Inszone HQ)" : "Address (optional)"}
          </FormLabel>
          <Textarea
            name="address"
            minRows={2}
            maxRows={2}
            placeholder={signatureType === "basic"
              ? "4025 E. La Palma Ave, Suite 101\nAnaheim, CA 92807"
              : "e.g. 206 Highway 71 N.\nMena, AR 71953"}
            value={values.address}
            onChange={handleAddressChange}
            onBlur={handleBlur}
            slotProps={{ textarea: { maxLength: FIELD_MAX_LENGTH.address } }}
          />
          {touched.address && errors.address && (
            <Typography level="body-xs" color="danger" sx={{ mt: 0.5 }}>{errors.address}</Typography>
          )}
        </FormControl>

        {/* Website — only for powered-by and formerly */}
        {signatureType !== "basic" && (
          <FormControl className="col-span-2">
            <FormLabel>Website (optional)</FormLabel>
            <Input
              name="website"
              placeholder="e.g. cayias.com"
              value={values.website}
              onChange={handleChange}
              onBlur={handleBlur}
              slotProps={{ input: { maxLength: FIELD_MAX_LENGTH.website } }}
            />
          </FormControl>
        )}

        {/* Certificate Request — only for basic and formerly */}
        {(signatureType === "basic" || signatureType === "formerly") && (
          <div className="col-span-2" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
              <div
                role="switch"
                aria-checked={certRequest}
                onClick={() => setCertRequest(!certRequest)}
                style={{
                  position: "relative",
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: certRequest
                    ? "var(--joy-palette-primary-500, #0B6BCB)"
                    : "var(--joy-palette-neutral-outlinedBorder, rgba(99,107,116,0.4))",
                  cursor: "pointer",
                  transition: "background 0.2s",
                  flexShrink: 0,
                }}
              >
                <div style={{
                  position: "absolute",
                  top: 3,
                  left: certRequest ? 23 : 3,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  backgroundColor: "#fff",
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--joy-palette-text-primary)" }}>
                Certificate Request?
              </span>
            </label>
          </div>
        )}

        {/* Review Link — all types */}
        <FormControl className="col-span-2">
          <FormLabel>Review Link (optional)</FormLabel>
          <Input
            name="reviewLink"
            placeholder="e.g. https://g.page/r/..."
            value={values.reviewLink}
            onChange={handleChange}
            onBlur={handleBlur}
            slotProps={{ input: { maxLength: FIELD_MAX_LENGTH.reviewLink } }}
          />
        </FormControl>

        {/* Partner Logo — only for powered-by and formerly */}
        {showLogoUploader && (
          <div className="col-span-2">
            <LogoUploader
              onUpload={handleUpload}
              onEnhance={handleEnhance}
              onResizeSave={handleResizeSave}
              canEnhance={canEnhance}
              busyUpload={busyUpload}
              busyEnhance={busyEnhance}
              uploadMsg={uploadMsg}
              uploadErr={uploadErr}
              logoError={logoError}
              hasLogo={hasUploadedLogo}
              hasEnhanced={!!enhanced}
              skipEnhancement={uploadedLogo?.skipEnhancement}
              logoUrl={logoUrl}
              logoSecureUrl={logoSecureUrl}
              logoDisplayWidth={logoDisplayWidth}
              logoDisplayHeight={logoDisplayHeight}
              originalWidth={originalLogoWidth}
              originalHeight={originalLogoHeight}
            />
          </div>
        )}
      </div>

      {/* ── Actions ─────────────────────────────────────────── */}
      <SignatureActions
        onSave={handleSave}
        onCopy={handleCopy}
        isPending={isPending}
        busySave={busySave}
        busy={busyUpload || busyEnhance}
      />
    </div>
  );
}