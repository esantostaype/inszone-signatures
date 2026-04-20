"use client";
// src/components/organisms/SignaturesTable.tsx
import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { TanstackTable } from "@/components/TanstackTable";
import { useConfirmationStore } from "@/stores/confirmationStore";
import { useModalStore } from "@/stores/modalStore";
import { toast } from "react-toastify";
import { buildOutlookSignatureHtml, type SignatureType } from "@/lib/outlookSignature";
import { buildContactLines } from "@/hooks/useSignatureBuilder";
import { SignaturePreview } from "@/components/signatures/SignaturePreview";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  EyeIcon,
  Copy01Icon,
  Delete02Icon,
  Add01Icon,
} from "@hugeicons/core-free-icons";

// ── Types ─────────────────────────────────────────────────────

export interface SavedSignature {
  id:                string;
  name:              string;
  fullName:          string;
  title:             string;
  type:              SignatureType;
  phone:             string | null;
  fax:               string | null;
  direct:            string | null;
  sms:               string | null;
  contactLines:      string;   // legacy field, kept for compat
  email:             string;
  address:           string;
  website:           string | null;
  lic:               string | null;
  partnerLogoUrl:    string | null;
  partnerLogoWidth:  number | null;
  partnerLogoHeight: number | null;
  certRequest:       boolean | null;
  reviewLink:        string | null;
  createdAt:         string;
}

// ── Clipboard helper ──────────────────────────────────────────

async function copyHtmlToClipboard(html: string) {
  const blobHtml = new Blob([html], { type: "text/html" });
  const blobTxt  = new Blob([stripHtml(html)], { type: "text/plain" });
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ "text/html": blobHtml, "text/plain": blobTxt }),
    ]);
  } catch {
    await navigator.clipboard.writeText(html);
  }
}

function stripHtml(html: string) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.innerText || div.textContent || "";
}

// ── Letterhead helper ─────────────────────────────────────────

async function triggerLetterheadDownload(row: SavedSignature): Promise<void> {
  const res = await fetch("/api/letterhead", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      partnerName:       row.name,
      phone:             row.phone  || "",
      fax:               row.fax   || "",
      address:           row.address ?? "",
      website:           row.website || "",
      partnerLogoUrl:    row.partnerLogoUrl    || "",
      partnerLogoWidth:  row.partnerLogoWidth  || 152,
      partnerLogoHeight: row.partnerLogoHeight || 44,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Letterhead generation failed");
  }

  const blob   = await res.blob();
  const url    = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href     = url;
  anchor.download = `INS-Branding-Letterhead-Acquisition-${row.name.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("-")}.docx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

// ── Resolve row contact fields (handles legacy contactLines) ──

function resolveRowContacts(row: SavedSignature) {
  const legacy = row.contactLines ?? "";
  return {
    phone:  row.phone?.trim()  || legacy.match(/Phone:\s*(.+)/)?.[1]?.trim()  || "",
    direct: row.direct?.trim() || legacy.match(/Direct:\s*(.+)/)?.[1]?.trim() || "",
    sms:    row.sms?.trim()    || legacy.match(/SMS:\s*(.+)/)?.[1]?.trim()    || "",
    fax:    row.fax?.trim()    || legacy.match(/Fax:\s*(.+)/)?.[1]?.trim()    || "",
  };
}

// ── Type badge ────────────────────────────────────────────────

const TYPE_LABELS: Record<SignatureType, { label: string; color: "primary" | "neutral" | "warning" }> = {
  "basic":       { label: "Basic",       color: "neutral"  },
  "powered-by":  { label: "Powered By",  color: "primary"  },
  "formerly":    { label: "Formerly",    color: "warning"  },
};

function TypeBadge({ type }: { type: SignatureType }) {
  const { label, color } = TYPE_LABELS[type] ?? TYPE_LABELS["basic"];
  return <Chip size="sm" color={color} variant="soft">{label}</Chip>;
}

// ── Signature Preview content (inside modal) ──────────────────

function SignaturePreviewContent({ row }: { row: SavedSignature }) {
  const { phone, direct, sms, fax } = resolveRowContacts(row);
  const signatureType: SignatureType = row.type ?? "powered-by";

  return (
    <SignaturePreview
      values={{
        name:     row.name,
        fullName: row.fullName,
        title:    row.title,
        phone,
        direct,
        sms,
        fax,
        email:      row.email,
        address:    row.address    ?? "",
        website:    row.website ?? "",
        lic:        row.lic ?? "",
        reviewLink: row.reviewLink ?? "",
      }}
      signatureType={signatureType}
      logoUrl={row.partnerLogoUrl ?? ""}
      logoWidth={row.partnerLogoWidth   ?? 96}
      logoHeight={row.partnerLogoHeight ?? 96}
      logoLoading={false}
      isPending={false}
      withTitle={false}
      certRequest={row.certRequest ?? false}
      reviewLink={row.reviewLink ?? ""}
    />
  );
}

// ── Row actions ───────────────────────────────────────────────

interface RowActionsProps {
  row:      SavedSignature;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

function RowActions({ row, onDelete, onRefresh }: RowActionsProps) {
  const { openModal }  = useModalStore();
  const [copying,      setCopying]      = React.useState(false);
  const [downloading,  setDownloading]  = React.useState(false);
  const [generating,   setGenerating]   = React.useState(false);

  const signatureType: SignatureType = row.type ?? "powered-by";
  const showLetterhead    = signatureType === "powered-by";
  const showGenFormerly   = signatureType === "powered-by";

  function handlePreview() {
    openModal({
      title:   `Preview — ${row.name}`,
      size:    "md",
      content: <SignaturePreviewContent row={row} />,
    });
  }

  async function handleCopy() {
    setCopying(true);
    try {
      const { phone, direct, sms, fax } = resolveRowContacts(row);

      const contactLines = buildContactLines({ phone, direct, sms, fax });

      const html = buildOutlookSignatureHtml({
        fullName:          row.fullName,
        title:             row.title,
        contactLines,
        email:             row.email,
        address:           row.address,
        lic:               row.lic ?? undefined,
        partnerLogoUrl:    row.partnerLogoUrl    ?? undefined,
        partnerLogoWidth:  row.partnerLogoWidth  ?? undefined,
        partnerLogoHeight: row.partnerLogoHeight ?? undefined,
        signatureType,
        certRequest:       row.certRequest ?? false,
        reviewLink:        row.reviewLink  ?? undefined,
      });

      await copyHtmlToClipboard(html);
      toast.success("Signature copied!");
    } catch {
      toast.error("Failed to copy signature");
    } finally {
      setCopying(false);
    }
  }

  async function handleDownloadLetterhead() {
    setDownloading(true);
    try {
      await triggerLetterheadDownload(row);
      toast.success("Letterhead downloaded!");
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed to download letterhead");
    } finally {
      setDownloading(false);
    }
  }

  async function handleGenerateFormerly() {
    setGenerating(true);
    try {
      const payload = {
        name:              row.name,
        fullName:          row.fullName,
        title:             row.title,
        type:              "formerly" as SignatureType,
        phone:             row.phone    || "",
        direct:            row.direct   || null,
        sms:               row.sms      || null,
        fax:               row.fax      || null,
        email:             row.email,
        address:           row.address,
        lic:               row.lic      || null,
        website:           row.website  || null,
        partnerLogoUrl:    row.partnerLogoUrl    || null,
        partnerLogoWidth:  row.partnerLogoWidth  || null,
        partnerLogoHeight: row.partnerLogoHeight || null,
        certRequest:       row.certRequest ?? false,
        reviewLink:        row.reviewLink  || null,
      };

      const res = await fetch("/api/signatures", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || "Failed to generate");
      }

      toast.success("Formerly signature created!");
      onRefresh();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed to generate formerly signature");
    } finally {
      setGenerating(false);
    }
  }

  const busy = copying || downloading || generating;

  return (
    <div className="flex items-center gap-2 flex-nowrap">
      <Button
        size="sm"
        variant="soft"
        color="primary"
        onClick={handlePreview}
        startDecorator={<HugeiconsIcon icon={EyeIcon} size={14} />}
        sx={{ whiteSpace: "nowrap", fontSize: 11 }}
      >
        Preview
      </Button>

      <Button
        size="sm"
        variant="soft"
        color="neutral"
        onClick={handleCopy}
        disabled={busy}
        loading={copying}
        startDecorator={<HugeiconsIcon icon={Copy01Icon} size={14} />}
        sx={{ whiteSpace: "nowrap", fontSize: 11 }}
      >
        Copy
      </Button>

      {showGenFormerly && (
        <Button
          size="sm"
          variant="soft"
          color="warning"
          onClick={handleGenerateFormerly}
          disabled={busy}
          loading={generating}
          startDecorator={<HugeiconsIcon icon={Add01Icon} size={14} />}
          sx={{ whiteSpace: "nowrap", fontSize: 11 }}
        >
          Generate Formerly
        </Button>
      )}

      {showLetterhead && (
        <Button
          size="sm"
          variant="soft"
          color="neutral"
          onClick={handleDownloadLetterhead}
          disabled={busy}
          loading={downloading}
          sx={{ whiteSpace: "nowrap", fontSize: 11 }}
        >
          Download Letterhead
        </Button>
      )}

      <Button
        size="sm"
        variant="soft"
        color="danger"
        onClick={() => onDelete(row.id)}
        disabled={busy}
        startDecorator={<HugeiconsIcon icon={Delete02Icon} size={14} />}
        sx={{ fontSize: 11 }}
      >
        Delete
      </Button>
    </div>
  );
}

// ── Logo cell ─────────────────────────────────────────────────

function LogoCell({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="w-12 h-12 rounded-md flex items-center justify-center text-[10px] text-gray-500"
        style={{ background: "rgba(100,100,120,0.15)" }}>
        No logo
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Partner logo" style={{ objectFit: "contain", display: "block" }} />;
}

// ── Type filter ───────────────────────────────────────────────

type FilterType = SignatureType | "all";

const FILTER_OPTIONS: { value: FilterType; label: string; description: string }[] = [
  { value: "all",        label: "All",                  description: "Show all signature types" },
  { value: "basic",      label: "Basic",                description: "Inszone logo only" },
  { value: "powered-by", label: "Powered By",           description: "Partner logo + Inszone" },
  { value: "formerly",   label: "Formerly Operating As", description: "Inszone + formerly partner" },
];

function TypeFilter({
  value,
  onChange,
}: {
  value: FilterType;
  onChange: (v: FilterType) => void;
}) {
  return (
    <div className="mb-4 max-w-2xl">
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--joy-palette-text-secondary)" }}>
        Filter by type
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {FILTER_OPTIONS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
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
              fontSize: 12,
              color: value === t.value
                ? "var(--joy-palette-primary-600, #0B6BCB)"
                : "var(--joy-palette-text-primary)"
            }}>
              {t.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

interface SignaturesTableProps {
  data:      SavedSignature[];
  onRefresh: () => void;
}

export function SignaturesTable({ data, onRefresh }: SignaturesTableProps) {
  const { openConfirmation } = useConfirmationStore();
  const [typeFilter, setTypeFilter] = React.useState<FilterType>("all");

  const filteredData = typeFilter === "all"
    ? data
    : data.filter((row) => (row.type ?? "powered-by") === typeFilter);

  function handleDeleteClick(id: string) {
    openConfirmation({
      title:       "Delete Signature",
      description: "Are you sure you want to delete this signature? This action cannot be undone.",
      type:        "danger",
      confirmText: "Yes, delete",
      cancelText:  "Cancel",
      onConfirm:   async () => {
        const res = await fetch(`/api/signatures/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed");
        toast.success("Signature deleted");
        onRefresh();
      },
    });
  }

  const columns: ColumnDef<SavedSignature>[] = [
    {
      header:      "Name",
      accessorKey: "name",
      cell: ({ getValue }) => (
        <span className="font-medium">{String(getValue())}</span>
      ),
    },
    {
      header: "Type",
      id:     "type",
      cell: ({ row }) => <TypeBadge type={row.original.type ?? "powered-by"} />,
    },
    {
      header: "Partner Logo",
      id:     "partnerLogo",
      cell: ({ row }) => <LogoCell url={row.original.partnerLogoUrl} />,
    },
    {
      header: "Actions",
      id:     "actions",
      cell: ({ row }) => (
        <RowActions
          row={row.original}
          onDelete={handleDeleteClick}
          onRefresh={onRefresh}
        />
      ),
    },
  ];

  return (
    <>
      <TypeFilter value={typeFilter} onChange={setTypeFilter} />
      <TanstackTable
        data={filteredData}
        columns={columns}
        placeholder="Search by name…"
      />
    </>
  );
}