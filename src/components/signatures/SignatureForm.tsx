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
import type { useSignatureBuilder } from "@/hooks/useSignatureBuilder";

type BuilderState = ReturnType<typeof useSignatureBuilder>;

interface SignatureFormProps {
  state: BuilderState;
}

export function SignatureForm({ state }: SignatureFormProps) {
  const {
    formik,
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
    handleFaxChange,
  } = state;

  const { values, errors, touched, handleChange, handleBlur } = formik;

  return (
    <div>
      {/* ── Grid 2 columns ──────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Name — col span 2 */}
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
          />
          <Typography level="body-sm" sx={{ mt: 0.5 }} color="neutral">
            Use the partner company name — this is how you'll find this signature later.
          </Typography>
          {touched.name && errors.name && (
            <Typography level="body-xs" color="danger">{errors.name}</Typography>
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
          />
          {touched.fullName && errors.fullName && (
            <Typography level="body-xs" color="danger">{errors.fullName}</Typography>
          )}
        </FormControl>

        {/* Title */}
        <FormControl error={Boolean(touched.title && errors.title)}>
          <FormLabel>Job Title *</FormLabel>
          <Input
            name="title"
            value={values.title}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          {touched.title && errors.title && (
            <Typography level="body-xs" color="danger">{errors.title}</Typography>
          )}
        </FormControl>

        <FormControl error={Boolean(touched.phone && errors.phone)}>
          <FormLabel>Phone *</FormLabel>
          <Input
            name="phone"
            placeholder="e.g. (479) 394-2244"
            value={values.phone}
            onChange={handlePhoneChange}
            onBlur={handleBlur}
          />
          {touched.phone && errors.phone && (
            <Typography level="body-xs" color="danger">{errors.phone}</Typography>
          )}
        </FormControl>

        {/* Fax */}
        <FormControl>
          <FormLabel>Fax (optional)</FormLabel>
          <Input
            name="fax"
            placeholder="e.g. (479) 394-2249"
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
          />
          {touched.email && errors.email && (
            <Typography level="body-xs" color="danger">{errors.email}</Typography>
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
          />
        </FormControl>

        {/* Address */}
        <FormControl error={Boolean(touched.address && errors.address)} className="col-span-2">
          <FormLabel>Address *</FormLabel>
          <Textarea
            name="address"
            minRows={2}
            placeholder={"e.g. 206 Highway 71 N.\nMena, AR 71953"}
            value={values.address}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          {touched.address && errors.address && (
            <Typography level="body-xs" color="danger">{errors.address}</Typography>
          )}
        </FormControl>

        {/* Website */}
        <FormControl className="col-span-2">
          <FormLabel>Website (optional)</FormLabel>
          <Input
            name="website"
            placeholder="e.g. cayias.com"
            value={values.website}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        </FormControl>

        {/* Partner Logo — col span 2 */}
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
      </div>

      {/* ── Actions ─────────────────────────────────────────── */}
      {/* Save Signature also auto-downloads the letterhead */}
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