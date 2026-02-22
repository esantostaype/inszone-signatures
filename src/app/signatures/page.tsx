"use client";
// src/app/signatures/page.tsx
import * as React from "react";
import { MainTitle } from "@/components/MainTitle";
import { SignatureIcon } from "@hugeicons/core-free-icons";
import { SignaturesTable, type SavedSignature } from "@/components/signatures/SignaturesTable";
import CircularProgress from "@mui/joy/CircularProgress";
import Typography from "@mui/joy/Typography";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Link from "next/link";

export default function SignaturesPage() {
  const [signatures, setSignatures] = React.useState<SavedSignature[]>([]);
  const [loading,    setLoading]    = React.useState(true);
  const [error,      setError]      = React.useState("");

  async function fetchSignatures() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/signatures");
      if (!res.ok) throw new Error("Failed to load signatures");
      const json = await res.json();
      setSignatures(json.data ?? []);
    } catch (e: unknown) {
      setError((e as Error)?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { fetchSignatures(); }, []);

  return (
    <div className="flex-1 py-10 px-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 6 }}>
          <MainTitle title="Saved Signatures" icon={SignatureIcon} />
          <Button component={Link} href="/" variant="outlined" color="neutral" size="sm">
            + New Signature
          </Button>
        </Box>

        {/* States */}
        {loading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 8, justifyContent: "center" }}>
            <CircularProgress size="md" />
            <Typography level="body-md" sx={{ opacity: 0.6 }}>Loading signatures…</Typography>
          </Box>
        )}

        {!loading && error && (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <Typography level="body-md" color="danger">{error}</Typography>
            <Button variant="soft" size="sm" sx={{ mt: 2 }} onClick={fetchSignatures}>
              Retry
            </Button>
          </Box>
        )}

        {!loading && !error && signatures.length === 0 && (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <Typography level="body-md" sx={{ opacity: 0.5 }}>
              No signatures saved yet.
            </Typography>
            <Button component={Link} href="/" variant="soft" color="primary" size="sm" sx={{ mt: 2 }}>
              Create your first signature
            </Button>
          </Box>
        )}

        {!loading && !error && signatures.length > 0 && (
          <SignaturesTable data={signatures} onRefresh={fetchSignatures} />
        )}
      </div>
    </div>
  );
}