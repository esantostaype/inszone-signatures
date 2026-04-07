"use client";
// src/app/page.tsx
import * as React from "react";
import { MainTitle } from "@/components/MainTitle";
import { SignatureIcon } from "@hugeicons/core-free-icons";
import { SignatureForm } from "@/components/signatures/SignatureForm";
import { useSignatureBuilder } from "@/hooks/useSignatureBuilder";
import { SignaturePreview } from "@/components/signatures/SignaturePreview";
import { Button } from "@mui/joy";
import Link from "next/link";

export default function SignatureGeneratorPage() {
  const state = useSignatureBuilder();

  return (
    <>
      {/* ── Left panel: form ──────────────────────────────── */}
      
      <div className="flex-2 py-6 px-6 md:py-10 md:px-10 xl:px-0">
        <div className="mx-auto xl:w-3xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <MainTitle title="Outlook Signature Generator" icon={SignatureIcon} />
            <Button component={Link} href="/signatures" variant="soft" color="primary" size="sm">
              All Signatures
            </Button>
          </div>
          <div className="mt-8">
            <SignatureForm state={state} />
          </div>
        </div>
      </div>

      {/* ── Right panel: preview ─────────────────────────── */}
      <SignaturePreview
        values={state.formik.values}
        logoUrl={state.logoUrl}
        logoWidth={state.logoWidth}
        logoHeight={state.logoHeight}
        logoLoading={state.logoLoading}
        isPending={state.isPending}
        signatureType={state.signatureType}
      />
    </>
  );
}