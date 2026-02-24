"use client";
// src/components/signatures/ResizeLogoModal.tsx
import * as React from "react";
import Slider from "@mui/joy/Slider";
import Input from "@mui/joy/Input";
import Button from "@mui/joy/Button";
import Typography from "@mui/joy/Typography";
import Divider from "@mui/joy/Divider";
import { HugeiconsIcon } from "@hugeicons/react";
import { SquareLock01Icon, SquareUnlock01Icon } from "@hugeicons/core-free-icons";
import { useModalStore } from "@/stores/modalStore";

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_PX = 20;
const MAX_PX = 600;

function clamp(val: number) {
  return Math.min(MAX_PX, Math.max(MIN_PX, val));
}

// ─── Cloudinary helper ────────────────────────────────────────────────────────
// Usa secure_url (sin transforms previas) para pedir la imagen a la resolución
// exacta — Cloudinary la genera y cachea sin pérdida de calidad.

function buildCloudinaryResizedUrl(url: string, w: number, h: number): string {
  if (!url || !url.includes("res.cloudinary.com")) return url;
  return url.replace(
    /\/upload\/((?:v\d+\/)?)/,
    (_match, version) => `/upload/w_${w},h_${h},c_fit,q_auto,f_auto/${version}`
  );
}

// ─── Debounce para el preview (no llamar Cloudinary en cada px) ───────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState<T>(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ResizeLogoContentProps {
  imageUrl:       string;  // display_url actual (fallback si no es Cloudinary)
  secureUrl:      string;  // secure_url sin transformaciones (base para resize)
  originalWidth:  number;
  originalHeight: number;
  initialWidth:   number;
  initialHeight:  number;
  onSave:         (width: number, height: number) => void;
}

// ─── Interior del modal ───────────────────────────────────────────────────────

function ResizeLogoContent({
  imageUrl,
  secureUrl,
  originalWidth,
  originalHeight,
  initialWidth,
  initialHeight,
  onSave,
}: ResizeLogoContentProps) {
  const { closeModal } = useModalStore();
  const aspectRatio = originalWidth / originalHeight;

  const [width,  setWidth]  = React.useState(initialWidth);
  const [height, setHeight] = React.useState(initialHeight);
  const [locked, setLocked] = React.useState(true);

  // Strings independientes para los inputs → escritura libre sin clamp inmediato
  const [widthStr,  setWidthStr]  = React.useState(String(initialWidth));
  const [heightStr, setHeightStr] = React.useState(String(initialHeight));

  const scaleFromWidth = (w: number) => Math.round((w / originalWidth) * 100);
  const [scale, setScale] = React.useState(scaleFromWidth(initialWidth));

  // Debounce de dimensiones para el preview — no spammea Cloudinary
  const debouncedWidth  = useDebounce(width,  350);
  const debouncedHeight = useDebounce(height, 350);

  // URL del preview: Cloudinary sirve la imagen a la resolución exacta
  const previewUrl = React.useMemo(
    () => buildCloudinaryResizedUrl(secureUrl || imageUrl, debouncedWidth, debouncedHeight),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [secureUrl, imageUrl, debouncedWidth, debouncedHeight]
  );

  function commitSize(w: number, h: number) {
    setWidth(w);
    setHeight(h);
    setWidthStr(String(w));
    setHeightStr(String(h));
  }

  function applyScale(newScale: number) {
    const s    = newScale / 100;
    const newW = clamp(Math.round(originalWidth  * s));
    const newH = clamp(Math.round(originalHeight * s));
    setScale(newScale);
    commitSize(newW, newH);
  }

  function handleWidthStrChange(raw: string) {
    setWidthStr(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setWidth(parsed);
      setScale(scaleFromWidth(parsed));
      if (locked) {
        const h = Math.round(parsed / aspectRatio);
        setHeight(h);
        setHeightStr(String(h));
      }
    }
  }

  function handleHeightStrChange(raw: string) {
    setHeightStr(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setHeight(parsed);
      if (locked) {
        const w = Math.round(parsed * aspectRatio);
        setWidth(w);
        setWidthStr(String(w));
        setScale(scaleFromWidth(w));
      }
    }
  }

  function handleWidthBlur() {
    const parsed = parseInt(widthStr, 10);
    const w = clamp(isNaN(parsed) || parsed <= 0 ? width : parsed);
    const h = locked ? clamp(Math.round(w / aspectRatio)) : clamp(height);
    setScale(scaleFromWidth(w));
    commitSize(w, h);
  }

  function handleHeightBlur() {
    const parsed = parseInt(heightStr, 10);
    const h = clamp(isNaN(parsed) || parsed <= 0 ? height : parsed);
    if (locked) {
      const w = clamp(Math.round(h * aspectRatio));
      setScale(scaleFromWidth(w));
      commitSize(w, h);
    } else {
      setHeight(h);
      setHeightStr(String(h));
    }
  }

  function handleSave() {
    onSave(clamp(width), clamp(height));
    closeModal();
  }

  return (
    // px-4 (no px-8) para que no haya scroll horizontal
    <div className="flex flex-col gap-4 px-4 pb-5 pt-1 w-full overflow-x-hidden">

      {/* ── Preview ──────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: 160, padding: 16, borderRadius: 8, overflow: "hidden",
        background: "repeating-conic-gradient(rgba(128,128,128,0.12) 0% 25%, transparent 0% 50%) 0 0 / 16px 16px",
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={previewUrl}
          src={previewUrl}
          alt="Logo preview"
          style={{
            width,
            height,
            objectFit: "contain",
            maxWidth:  "100%",
            maxHeight: 280,
            display:   "block",
          }}
        />
      </div>

      <Typography level="body-xs" sx={{ opacity: 0.4, textAlign: "center" }}>
        Original: {originalWidth}×{originalHeight}px · Display: {width}×{height}px
      </Typography>

      <Divider />

      {/* ── Scale slider ─────────────────────────────────────────── */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <Typography level="body-sm" fontWeight="md">Scale</Typography>
          <Typography level="body-xs" sx={{ opacity: 0.6 }}>{scale}%</Typography>
        </div>
        <Slider
          min={10}
          max={300}
          step={1}
          value={scale}
          onChange={(_, val) => applyScale(val as number)}
          marks={[
            { value: 50,  label: "50%"  },
            { value: 100, label: "100%" },
            { value: 200, label: "200%" },
          ]}
          sx={{ mb: 2 }}
        />
      </div>

      {/* ── W / H inputs ─────────────────────────────────────────── */}
      {/* min-w-0 en los flex-1 es clave para que no desborden */}
      <div className="flex items-end gap-2 w-full">
        <div className="flex-1 min-w-0">
          <Typography level="body-xs" sx={{ mb: 0.5, opacity: 0.7 }}>Width (px)</Typography>
          <Input
            size="sm"
            value={widthStr}
            onChange={(e) => handleWidthStrChange(e.target.value)}
            onBlur={handleWidthBlur}
            onFocus={(e) => e.target.select()}
            slotProps={{ input: { inputMode: "numeric", pattern: "[0-9]*" } }}
          />
        </div>

        <div className="flex flex-col items-center gap-1 pb-0.5 flex-shrink-0">
          <Typography level="body-xs" sx={{ opacity: 0.5 }}>ratio</Typography>
          <button
            onClick={() => setLocked(!locked)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 4, borderRadius: 6, opacity: locked ? 1 : 0.4,
            }}
            title={locked ? "Unlock aspect ratio" : "Lock aspect ratio"}
          >
            <HugeiconsIcon icon={locked ? SquareLock01Icon : SquareUnlock01Icon} size={18} />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <Typography level="body-xs" sx={{ mb: 0.5, opacity: 0.7 }}>Height (px)</Typography>
          <Input
            size="sm"
            value={heightStr}
            onChange={(e) => handleHeightStrChange(e.target.value)}
            onBlur={handleHeightBlur}
            onFocus={(e) => e.target.select()}
            slotProps={{ input: { inputMode: "numeric", pattern: "[0-9]*" } }}
          />
        </div>
      </div>

      <Divider />

      {/* ── Actions ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <Button variant="outlined" color="neutral" size="sm" onClick={() => applyScale(100)}>
          Reset to original
        </Button>
        <div className="flex-1" />
        <Button variant="plain" color="neutral" size="sm" onClick={closeModal}>Cancel</Button>
        <Button variant="solid" color="primary" size="sm" onClick={handleSave}>Save Logo</Button>
      </div>
    </div>
  );
}

// ─── Hook público ─────────────────────────────────────────────────────────────

interface OpenResizeLogoModal {
  imageUrl:       string;
  secureUrl:      string;  // ← requerido para Cloudinary
  originalWidth:  number;
  originalHeight: number;
  currentWidth:   number;
  currentHeight:  number;
  onSave:         (width: number, height: number) => void;
}

export function useResizeLogoModal() {
  const { openModal } = useModalStore();

  function openResizeModal(opts: OpenResizeLogoModal) {
    openModal({
      title:   "Resize Logo",
      size:    "sm",
      content: (
        <ResizeLogoContent
          imageUrl={opts.imageUrl}
          secureUrl={opts.secureUrl}
          originalWidth={opts.originalWidth}
          originalHeight={opts.originalHeight}
          initialWidth={opts.currentWidth}
          initialHeight={opts.currentHeight}
          onSave={opts.onSave}
        />
      ),
    });
  }

  return { openResizeModal };
}