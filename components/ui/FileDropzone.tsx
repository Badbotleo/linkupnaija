"use client";

import { useRef, useState } from "react";
import LineIcon from "@/components/ui/LineIcon";
import { toast } from "@/lib/toast";

/**
 * Picking documents: tap, or drag onto it.
 *
 * Size and count are checked here as well as on the server. Not because the
 * client can be trusted, but because waiting out an upload of a 20MB photo on
 * a Nigerian mobile connection only to be told no is a cruel way to find out.
 */

export const MAX_FILES = 12;
export const MAX_BYTES = 8 * 1024 * 1024;

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileDropzone({
  files,
  onChange,
  accept = "application/pdf,image/*",
  hint,
  maxFiles = MAX_FILES,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  accept?: string;
  hint?: string;
  maxFiles?: number;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function add(incoming: FileList | File[]) {
    const next: File[] = [];
    const rejected: string[] = [];

    for (const f of Array.from(incoming)) {
      if (f.size > MAX_BYTES) {
        rejected.push(`${f.name} is over 8MB`);
        continue;
      }
      // Same name and size twice is a double-tap, not two documents.
      if (files.some((e) => e.name === f.name && e.size === f.size)) continue;
      next.push(f);
    }

    const room = maxFiles - files.length;
    if (next.length > room) {
      rejected.push(`${maxFiles} documents is the limit`);
      next.length = Math.max(0, room);
    }

    if (rejected.length) toast.error(rejected.join(", "));
    if (next.length) onChange([...files, ...next]);
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) add(e.dataTransfer.files);
        }}
        onClick={() => !disabled && input.current?.click()}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            input.current?.click();
          }
        }}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          disabled
            ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
            : dragging
              ? "cursor-pointer border-brand bg-brand-50"
              : "cursor-pointer border-gray-200 bg-gray-50 hover:border-brand/40 hover:bg-brand-50/40"
        }`}
      >
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-brand shadow-sm">
          <LineIcon name="upload" size={18} />
        </span>
        <span className="text-[15px] font-bold text-gray-900">
          Tap to choose files
        </span>
        <span className="text-xs text-gray-500">or drag them here</span>
      </div>

      <input
        ref={input}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) add(e.target.files);
          // Reset, or picking the same file twice in a row does nothing.
          e.target.value = "";
        }}
      />

      {hint && (
        <p className="mt-2 text-xs leading-relaxed text-gray-500">{hint}</p>
      )}

      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${file.size}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <LineIcon
                name={file.type === "application/pdf" ? "file-text" : "image"}
                size={15}
                className="shrink-0 text-gray-400"
              />
              <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                {file.name}
              </span>
              <span className="shrink-0 text-xs text-gray-400">
                {prettySize(file.size)}
              </span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                aria-label={`Remove ${file.name}`}
                className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
              >
                <LineIcon name="x" size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
