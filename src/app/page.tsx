"use client";
// src/app/page.tsx
import * as React from "react";
import { MainTitle } from "@/components/MainTitle";
import { SignatureIcon } from "@hugeicons/core-free-icons";
import { SignatureForm } from "@/components/signatures/SignatureForm";
import { useSignatureBuilder } from "@/hooks/useSignatureBuilder";
import { SignaturePreview } from "@/components/signatures/SignaturePreview";

export default function SignatureGeneratorPage() {
  const state = useSignatureBuilder();

  return (
    <>
      {/* ── Left panel: form ──────────────────────────────── */}
      <div className="flex-2 py-10">
        <div className="mx-auto w-3xl">
          <MainTitle title="Outlook Signature Generator" icon={SignatureIcon} />
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
      />
    </>
  );
}