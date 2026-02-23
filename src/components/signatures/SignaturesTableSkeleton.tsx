"use client";

function SkeletonCell({ width = "w-full" }: { width?: string }) {
  return (
    <div className={`h-4 ${width} bg-white/10 rounded animate-pulse`} />
  );
}

function SkeletonLogoCell() {
  return (
    <div className="w-12 h-12 bg-white/10 rounded animate-pulse" />
  );
}

function SkeletonActionsCell() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-7 w-16 bg-white/10 rounded animate-pulse" />
      <div className="h-7 w-28 bg-white/10 rounded animate-pulse" />
      <div className="h-7 w-24 bg-white/10 rounded animate-pulse" />
      <div className="h-7 w-16 bg-white/10 rounded animate-pulse" />
    </div>
  );
}

function SkeletonRow({ index }: { index: number }) {
  return (
    <tr key={index} className="group">
      {/* # */}
      <td className="first:w-12 px-6 py-4 bg-surface border-t border-t-gray50">
        <SkeletonCell width="w-4" />
      </td>
      {/* Name */}
      <td className="px-6 py-4 bg-surface border-t border-t-gray50">
        <SkeletonCell width="w-32" />
      </td>
      {/* Full Name */}
      <td className="px-6 py-4 bg-surface border-t border-t-gray50">
        <SkeletonCell width="w-40" />
      </td>
      {/* Partner Logo */}
      <td className="px-6 py-4 bg-surface border-t border-t-gray50">
        <SkeletonLogoCell />
      </td>
      {/* Actions */}
      <td className="px-6 py-4 bg-surface border-t border-t-gray50">
        <SkeletonActionsCell />
      </td>
    </tr>
  );
}

export function SignaturesTableSkeleton() {
  return (
    <div className="border border-gray50 rounded-lg overflow-x-auto max-w-full bg-surface">
      {/* Header bar (search + pagination) */}
      <div className="flex justify-between px-6 py-4 bg-background border-b border-b-gray50">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white/10 rounded animate-pulse" />
          <div className="w-32 h-4 bg-white/10 rounded animate-pulse" />
        </div>
        <div className="w-24 h-4 bg-white/10 rounded animate-pulse" />
      </div>

      {/* Table */}
      <table className="w-full">
        <thead className="sticky top-[3.375rem] z-20">
          <tr>
            {["#", "Name", "Full Name", "Partner Logo", "Actions"].map((col) => (
              <th
                key={col}
                className="bg-background px-6 py-4 text-left border-b-2 border-b-gray50 first:w-12"
              >
                <span className="text-xs uppercase opacity-40">{col}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} index={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}