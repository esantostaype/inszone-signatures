"use client";
// src/components/organisms/SignaturesTable.tsx
import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { TanstackTable } from "@/components/TanstackTable";
import { useConfirmationStore } from "@/stores/confirmationStore";
import { useModalStore } from "@/stores/modalStore";
import { toast } from "react-toastify";
import { buildOutlookSignatureHtml } from "@/lib/outlookSignature";
import { SignaturePreview } from "@/components/signatures/SignaturePreview";
import Button from "@mui/joy/Button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  EyeIcon,
  Copy01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";

// ── Types ─────────────────────────────────────────────────────

export interface SavedSignature {
  id:                string;
  name:              string;
  fullName:          string;
  title:             string;
  phone:             string | null;   // ← agrega
  fax:               string | null;   // ← agrega
  contactLines:      string;
  email:             string;
  address:           string;
  lic:               string | null;
  partnerLogoUrl:    string | null;
  partnerLogoWidth:  number | null;
  partnerLogoHeight: number | null;
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

async function triggerLetterheadDownload(row: SavedSignature): Promise<void> {
  const res = await fetch("/api/letterhead", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      partnerName:       row.name,
      phone:             row.phone             || "",
      fax:               row.fax               || "",
      address:           row.address,
      website:           "",
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

// ── Signature Preview content (inside modal) ──────────────────

function SignaturePreviewContent({ row }: { row: SavedSignature }) {
  const contactLines = row.contactLines ?? "";
  const phone = row.phone?.trim() || contactLines.match(/Phone:\s*(.+)/)?.[1]?.trim() || "";
  const fax   = row.fax?.trim()   || contactLines.match(/Fax:\s*(.+)/)?.[1]?.trim()   || "";

  return (
    <SignaturePreview
      values={{
        name:     row.name,
        fullName: row.fullName,
        title:    row.title,
        phone,
        fax,
        email:   row.email,
        address: row.address,
        website: "",
        lic:     row.lic ?? "",
      }}
      logoUrl={row.partnerLogoUrl    ?? ""}
      logoWidth={row.partnerLogoWidth  ?? 96}
      logoHeight={row.partnerLogoHeight ?? 96}
      logoLoading={false}
      isPending={false}
      withTitle={false}
    />
  );
}

// ── Row actions ───────────────────────────────────────────────

interface RowActionsProps {
  row:      SavedSignature;
  onDelete: (id: string) => void;
}

function RowActions({ row, onDelete }: RowActionsProps) {
  const { openModal } = useModalStore();
  const [copying, setCopying] = React.useState<"powered-by" | "formerly" | null>(null);
  const [downloading,  setDownloading]  = React.useState(false);

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

  function handlePreview() {
    openModal({
      title:   `Preview — ${row.name}`,
      size:    "md",
      content: <SignaturePreviewContent row={row} />,
    });
  }

  async function handleCopy(type: "powered-by" | "formerly") {
  setCopying(type);
  try {
    const contactLines = [
      row.phone ? `Phone: ${row.phone}` : null,
      row.fax   ? `Fax: ${row.fax}`     : null,
    ].filter(Boolean).join("\n");

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
      signatureType:     type,
    });

    await copyHtmlToClipboard(html);
    toast.success(
      type === "powered-by" ? "Powered By signature copied!" : "Formerly signature copied!"
    );
  } catch {
    toast.error("Failed to copy signature");
  } finally {
    setCopying(null);
  }
}

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
        onClick={() => handleCopy("powered-by")}
        disabled={copying !== null}
        startDecorator={
          copying === "powered-by"
            ? <HugeiconsIcon icon={Copy01Icon} size={14} />
            : <HugeiconsIcon icon={Copy01Icon} size={14} />
        }
        sx={{ whiteSpace: "nowrap", fontSize: 11 }}
      >
        Copy Powered By
      </Button>

      <Button
        size="sm"
        variant="soft"
        color="neutral"
        onClick={() => handleCopy("formerly")}
        disabled={copying !== null}
        startDecorator={
          copying === "formerly"
            ? <HugeiconsIcon icon={Copy01Icon} size={14} />
            : <HugeiconsIcon icon={Copy01Icon} size={14} />
        }
        sx={{ whiteSpace: "nowrap", fontSize: 11 }}
      >
        Copy Formerly
      </Button>

      <Button size="sm" variant="soft" color="neutral" onClick={handleDownloadLetterhead}
        disabled={copying !== null || downloading}
        loading={downloading}
        sx={{ whiteSpace: "nowrap", fontSize: 11 }}>
        {downloading ? "Generating…" : "Download Letterhead"}
      </Button>


      <Button
        size="sm"
        variant="soft"
        color="danger"
        onClick={() => onDelete(row.id)}
        disabled={copying !== null}
        startDecorator={<HugeiconsIcon icon={Delete02Icon} size={14} />}
        sx={{ fontSize: 11 }}
      >
        Delete
      </Button>
    </div>
  );
}

// ── Logo cell ─────────────────────────────────────────────────

function LogoCell({ url }: {
  url:    string | null;
}) {
  if (!url) {
    return (
      <div className="w-12 h-12 rounded-md flex items-center justify-center text-[10px] text-gray-500"
        style={{ background: "rgba(100,100,120,0.15)" }}>
        No logo
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Partner logo"
      style={{ objectFit: "contain", display: "block" }}
    />
  );
}

// ── Main component ────────────────────────────────────────────

interface SignaturesTableProps {
  data:      SavedSignature[];
  onRefresh: () => void;
}

export function SignaturesTable({ data, onRefresh }: SignaturesTableProps) {
  const { openConfirmation } = useConfirmationStore();

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
      header: "Partner Logo",
      id:     "partnerLogo",
      cell: ({ row }) => (
        <LogoCell
          url={row.original.partnerLogoUrl}
        />
      ),
    },
    {
      header: "Actions",
      id:     "actions",
      cell: ({ row }) => (
        <RowActions
          row={row.original}
          onDelete={handleDeleteClick}
        />
      ),
    },
  ];

  return (
    <TanstackTable
      data={data}
      columns={columns}
      placeholder="Search by name…"
    />
  );
}