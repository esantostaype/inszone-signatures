"use client";
// src/components/molecules/SignatureActions.tsx
import * as React from "react";
import Button from "@mui/joy/Button";
import CircularProgress from "@mui/joy/CircularProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

interface SignatureActionsProps {
  onSave:    () => void;
  onCopy:    () => void;
  isPending: boolean;
  busySave:  boolean;
  busy:      boolean; // busyUpload || busyEnhance
}

export function SignatureActions({
  onSave,
  onCopy,
  isPending,
  busySave,
  busy,
}: SignatureActionsProps) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ mt: 1, alignItems: "center" }}>
      <Button
        variant="solid"
        color="neutral"
        onClick={onSave}
        disabled={busy || busySave || isPending}
        startDecorator={busySave ? <CircularProgress size="sm" /> : undefined}
      >
        {busySave ? "Saving…" : "Save Signature"}
      </Button>

      <Button
        variant="outlined"
        color="primary"
        onClick={onCopy}
        disabled={isPending || busy}
      >
        Copy Signature
      </Button>

      {isPending && (
        <Typography level="body-xs" sx={{ opacity: 0.6 }}>
          Updating preview…
        </Typography>
      )}
    </Stack>
  );
}