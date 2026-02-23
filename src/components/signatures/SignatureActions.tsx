"use client";
// src/components/molecules/SignatureActions.tsx
import * as React from "react";
import Button from "@mui/joy/Button";
import CircularProgress from "@mui/joy/CircularProgress";
import Typography from "@mui/joy/Typography";
import { HugeiconsIcon } from "@hugeicons/react";
import { FloppyDiskIcon, Copy01Icon } from "@hugeicons/core-free-icons";

interface SignatureActionsProps {
  onSave:    () => void;
  onCopy:    () => void;
  isPending: boolean;
  busySave:  boolean;
  busy:      boolean;
}

export function SignatureActions({
  onSave,
  onCopy,
  isPending,
  busySave,
  busy,
}: SignatureActionsProps) {
  return (
    <div className="mt-4 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
      <Button
        variant="solid"
        color="neutral"
        onClick={onSave}
        disabled={busy || busySave || isPending}
        startDecorator={
          busySave
            ? <CircularProgress size="sm" />
            : <HugeiconsIcon icon={FloppyDiskIcon} size={20} />
        }
        className="w-full sm:w-auto"
      >
        {busySave ? "Saving…" : "Save Signature"}
      </Button>

      <Button
        variant="soft"
        color="primary"
        onClick={onCopy}
        disabled={isPending || busy}
        startDecorator={<HugeiconsIcon icon={Copy01Icon} size={20} />}
        className="w-full sm:w-auto"
      >
        Copy Signature
      </Button>

      {isPending && (
        <Typography level="body-xs" sx={{ opacity: 0.6 }}>
          Updating preview…
        </Typography>
      )}
    </div>
  );
}