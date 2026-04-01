"use client";

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type ImageType = "vertical" | "horizontal" | "logo";

const ASPECT_MAP: Record<ImageType, string> = {
  vertical: "aspect-[9/16]",
  horizontal: "aspect-video",
  logo: "aspect-square"
};

interface MultiImageUploadProps {
  type: ImageType;
  value?: string;
  onChange?: (url: string) => void;
  onError?: (msg: string) => void;
  className?: string;
}

export function MultiImageUpload({
  type,
  value,
  onChange,
  onError,
  className
}: MultiImageUploadProps) {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(value ?? null);

  const labelKey: Record<ImageType, string> = {
    vertical: "admin.multiVertical",
    horizontal: "admin.multiHorizontal",
    logo: "admin.multiLogo"
  };

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        onError?.(t("common.admin.multiErrImage"));
        return;
      }
      if (file.size > 4 * 1024 * 1024) {
        onError?.(t("common.admin.multiErrSize"));
        return;
      }
      const url = URL.createObjectURL(file);
      setPreview(url);
      onChange?.(url);
    },
    [onChange, onError, t]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0] ?? null);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] ?? null);
    e.target.value = "";
  };

  const displayUrl = preview ?? value;

  return (
    <div className={cn("space-y-2", className)}>
      <label className="block text-xs font-semibold text-zinc-400">
        {t(labelKey[type])}
      </label>
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 border-dashed transition-colors",
          ASPECT_MAP[type],
          dragging
            ? "border-brand/60 bg-brand/10"
            : "border-zinc-700/80 bg-zinc-900/40 hover:border-zinc-600"
        )}
      >
        <input
          type="file"
          accept="image/*"
          onChange={onInputChange}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        {displayUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayUrl}
              alt={t("common.admin.coverAlt")}
              className="h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100">
              <span className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold text-zinc-800">
                {t("common.admin.multiClickReplace")}
              </span>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <svg
              className="h-12 w-12 text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"
              />
            </svg>
            <span className="text-xs text-zinc-500">{t("common.admin.multiDragHint")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
