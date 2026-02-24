"use client";
// src/components/signatures/LogoUploader.tsx
import * as React from "react";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Typography from "@mui/joy/Typography";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import CircularProgress from "@mui/joy/CircularProgress";
import Chip from "@mui/joy/Chip";
import { HugeiconsIcon } from "@hugeicons/react";
import { SparklesIcon, SquareArrowExpand01Icon } from "@hugeicons/core-free-icons";
import { useResizeLogoModal } from "@/components/signatures/ResizeLogoModal";

interface LogoUploaderProps {
  onUpload:          (file: File) => void;
  onEnhance:         () => void;
  onResizeSave:      (w: number, h: number) => void;
  canEnhance:        boolean;
  busyUpload:        boolean;
  busyEnhance:       boolean;
  uploadMsg:         string;
  uploadErr:         string;
  logoError:         string;
  hasLogo:           boolean;
  hasEnhanced:       boolean;
  skipEnhancement?:  boolean;
  logoUrl:           string;
  logoDisplayWidth:  number;
  logoDisplayHeight: number;
  originalWidth:     number;
  originalHeight:    number;
  logoSecureUrl:     string;
}

export function LogoUploader({
  onUpload,
  onEnhance,
  onResizeSave,
  canEnhance,
  busyUpload,
  busyEnhance,
  uploadMsg,
  uploadErr,
  logoError,
  hasLogo,
  hasEnhanced,
  skipEnhancement,
  logoUrl,
  logoDisplayWidth,
  logoDisplayHeight,
  originalWidth,
  originalHeight,
  logoSecureUrl
}: LogoUploaderProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { openResizeModal } = useResizeLogoModal();

  function handleDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) onUpload(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  }

  function handleResizeClick() {
    openResizeModal({
      imageUrl:       logoUrl,
      secureUrl:      logoSecureUrl,   // ← nuevo — viene del hook
      originalWidth,
      originalHeight,
      currentWidth:   logoDisplayWidth,
      currentHeight:  logoDisplayHeight,
      onSave:         onResizeSave,
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── Drop zone ─────────────────────────────────────────── */}
      <FormControl error={!!logoError}>
        <FormLabel>Partner Logo *</FormLabel>
        <label
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            cursor:  busyUpload ? "not-allowed" : "pointer",
            opacity: busyUpload ? 0.6 : 1,
          }}
          className="flex items-center justify-center w-full h-28 px-4 transition bg-[var(--soft-bg)] border-2 border-[var(--soft-bg-active)] border-dashed rounded-md appearance-none hover:border-accent hover:bg-[var(--soft-bg-hover)] focus:outline-none"
        >
          <div className="flex flex-col justify-center items-center w-full text-center">
            <svg className="w-7 h-7 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span className="font-medium text-gray-400 text-sm">
              Drag your partner logo here, or{" "}
              <span className="text-accent underline">browse</span>
            </span>
            <span className="text-xs text-gray-500 mt-1">PNG, JPG, SVG, WEBP accepted</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.svg"
            onChange={handleInputChange}
            className="hidden"
            disabled={busyUpload || busyEnhance}
          />
        </label>
        {logoError && (
          <Typography level="body-xs" color="danger" sx={{ mt: 0.5 }}>{logoError}</Typography>
        )}
      </FormControl>

      {/* ── Status row ────────────────────────────────────────── */}
      {(busyUpload || busyEnhance || uploadMsg || uploadErr) && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          {(busyUpload || busyEnhance) && <CircularProgress size="sm" />}
          {!busyUpload && !busyEnhance && hasEnhanced && (
            <Chip color="primary" variant="soft" size="sm">✨ AI Enhanced</Chip>
          )}
          {!busyUpload && !busyEnhance && !hasEnhanced && hasLogo && (
            <Chip color="success" variant="soft" size="sm">✓ Processed</Chip>
          )}
          {uploadMsg && (
            <Typography level="body-xs" sx={{ opacity: 0.75 }}>{uploadMsg}</Typography>
          )}
          {uploadErr && (
            <Typography level="body-xs" color="danger">{uploadErr}</Typography>
          )}
        </Box>
      )}

      {/* ── Action buttons (Enhance + Resize) ─────────────────── */}
      {hasLogo && (
        <div className="flex items-center gap-2">

          {/* Enhance with AI */}
          {!skipEnhancement && (
            <Button
              variant="outlined"
              color="neutral"
              size="sm"
              onClick={onEnhance}
              disabled={!canEnhance}
              startDecorator={
                busyEnhance
                  ? <CircularProgress size="sm" />
                  : <HugeiconsIcon icon={SparklesIcon} size={14} />
              }
            >
              {busyEnhance ? "Enhancing…" : "Enhance with AI"}
            </Button>
          )}

          {/* Resize */}
          <Button
            variant="outlined"
            color="neutral"
            size="sm"
            onClick={handleResizeClick}
            disabled={busyUpload || busyEnhance}
            startDecorator={<HugeiconsIcon icon={SquareArrowExpand01Icon} size={14} />}
          >
            Resize
          </Button>
        </div>
      )}

    </div>
  );
}