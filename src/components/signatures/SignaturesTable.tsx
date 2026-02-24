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

// ── Signature Preview content (inside modal) ──────────────────

function SignaturePreviewContent({ row }: { row: SavedSignature }) {
  return (
    <SignaturePreview
      values={{
        name:         row.name,
        fullName:     row.fullName,
        title:        row.title,
        contactLines: row.contactLines,
        email:        row.email,
        address:      row.address,
        lic:          row.lic ?? "",
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
      const html = buildOutlookSignatureHtml({
        fullName:          row.fullName,
        title:             row.title,
        contactLines:      row.contactLines,
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
        color="success"
        onClick={handlePreview}
        startDecorator={<HugeiconsIcon icon={EyeIcon} size={14} />}
        sx={{ whiteSpace: "nowrap", fontSize: 11 }}
      >
        Preview
      </Button>

      <Button
        size="sm"
        variant="soft"
        color="primary"
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