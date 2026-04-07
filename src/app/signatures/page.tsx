"use client";
import * as React from "react";
import { MainTitle } from "@/components/MainTitle";
import { SignatureIcon } from "@hugeicons/core-free-icons";
import { SignaturesTable } from "@/components/signatures/SignaturesTable";
import { useSignatures, useInvalidateSignatures } from "@/hooks/useSignatures";
import CircularProgress from "@mui/joy/CircularProgress";
import Typography from "@mui/joy/Typography";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Link from "next/link";

export default function SignaturesPage() {
  const { data: signatures, isLoading, isError, error } = useSignatures();
  const invalidate = useInvalidateSignatures();

  return (
    <div className="flex-1 p-6">
      <div className="mx-auto">
        <div className="flex flex-col md:flex-row gap-2 md:gap-8 md:items-center mb-6">
          <MainTitle title="Saved Signatures" icon={SignatureIcon} />
          <Button component={Link} href="/" color="primary" size="sm">
            + New Signature
          </Button>
        </div>

        {isLoading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 8, justifyContent: "center" }}>
            <CircularProgress size="md" />
            <Typography level="body-md" sx={{ opacity: 0.6 }}>Loading signatures…</Typography>
          </Box>
        )}

        {isError && (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <Typography level="body-md" color="danger">
              {(error as Error)?.message || "Unknown error"}
            </Typography>
            <Button variant="soft" size="sm" sx={{ mt: 2 }} onClick={invalidate}>
              Retry
            </Button>
          </Box>
        )}

        {!isLoading && !isError && (!signatures || signatures.length === 0) && (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <Typography level="body-md" sx={{ opacity: 0.5 }}>
              No signatures saved yet.
            </Typography>
            <Button component={Link} href="/" variant="soft" color="primary" size="sm" sx={{ mt: 2 }}>
              Create your first signature
            </Button>
          </Box>
        )}

        {!isLoading && !isError && signatures && signatures.length > 0 && (
          <SignaturesTable data={signatures} onRefresh={invalidate} />
        )}
      </div>
    </div>
  );
}