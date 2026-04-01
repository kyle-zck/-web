"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { MultiImageUpload } from "@/components/admin/multi-image-upload";
import { showToast } from "@/components/ui/toast";

export interface DramaFormData {
  id?: string;
  title: string;
  alias: string;
  description: string;
  totalEpisodes: number;
  releaseDate: string;
  region: string;
  status: "draft" | "published" | "off";
  coverVertical?: string;
  coverHorizontal?: string;
  coverLogo?: string;
}

const STATUS_OPTIONS = [
  { value: "draft", labelKey: "draft" },
  { value: "published", labelKey: "published" },
  { value: "off", labelKey: "off" }
] as const;

interface DramaFormDrawerProps {
  open: boolean;
  onClose: () => void;
  initialData?: Partial<DramaFormData>;
  onSave?: (data: DramaFormData) => void;
}

export function DramaFormDrawer({
  open,
  onClose,
  initialData,
  onSave
}: DramaFormDrawerProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<DramaFormData>({
    title: initialData?.title ?? "",
    alias: initialData?.alias ?? "",
    description: initialData?.description ?? "",
    totalEpisodes: initialData?.totalEpisodes ?? 0,
    releaseDate: initialData?.releaseDate ?? "",
    region: initialData?.region ?? "",
    status: initialData?.status ?? "draft",
    coverVertical: initialData?.coverVertical,
    coverHorizontal: initialData?.coverHorizontal,
    coverLogo: initialData?.coverLogo
  });

  const validateStep0 = () => {
    if (!form.coverVertical) {
      showToast(t("common.admin.uploadCoverRequired"));
      return false;
    }
    if (!form.title.trim()) {
      showToast(t("common.admin.titleRequired"));
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 0 && !validateStep0()) return;
    if (step < 1) setStep(step + 1);
    else {
      onSave?.(form);
      onClose();
    }
  };

  const steps = [t("common.admin.dramaBasicInfo"), t("common.admin.dramaExtended")];

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col bg-zinc-950 shadow-2xl transition-transform md:max-w-xl",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-800/80 p-4">
          <h2 className="text-lg font-bold text-zinc-100">
            {initialData?.id ? t("common.admin.dramaFormEdit") : t("common.admin.dramaFormCreate")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label={t("common.admin.close")}
          >
            ✕
          </button>
        </div>

        {/* 步骤指示 */}
        <div className="flex gap-2 border-b border-zinc-800/60 px-4 py-3">
          {steps.map((label, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-semibold transition",
                step === i
                  ? "bg-brand/20 text-brand"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <MultiImageUpload
                  type="vertical"
                  value={form.coverVertical}
                  onChange={(url) => setForm({ ...form, coverVertical: url })}
                  onError={(msg) => showToast(msg)}
                />
                <MultiImageUpload
                  type="horizontal"
                  value={form.coverHorizontal}
                  onChange={(url) => setForm({ ...form, coverHorizontal: url })}
                  onError={(msg) => showToast(msg)}
                />
                <div className="sm:col-span-2">
                  <MultiImageUpload
                    type="logo"
                    value={form.coverLogo}
                    onChange={(url) => setForm({ ...form, coverLogo: url })}
                    onError={(msg) => showToast(msg)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400">
                  {t("common.admin.title")} *
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={t("common.admin.dramaFormPhTitle")}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400">
                  {t("common.admin.dramaFormAlias")}
                </label>
                <input
                  value={form.alias}
                  onChange={(e) => setForm({ ...form, alias: e.target.value })}
                  placeholder={t("common.admin.dramaFormPhAlias")}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400">
                  {t("common.admin.dramaFormSynopsisStar")}
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={t("common.admin.descriptionPlaceholder")}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500"
                />
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400">
                  {t("common.admin.dramaFormTotalEpStar")}
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.totalEpisodes || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      totalEpisodes: Number(e.target.value) || 0
                    })
                  }
                  placeholder={t("common.admin.dramaFormPhEpisodes")}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400">
                  {t("common.admin.dramaFormReleaseDate")}
                </label>
                <input
                  type="date"
                  value={form.releaseDate}
                  onChange={(e) => setForm({ ...form, releaseDate: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400">
                  {t("common.admin.dramaFormRegion")}
                </label>
                <input
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  placeholder={t("common.admin.dramaFormPhRegion")}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400">
                  {t("common.admin.dramaFormStatusStar")}
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as DramaFormData["status"]
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.value === "draft"
                        ? t("common.admin.statusDraft")
                        : o.value === "published"
                          ? t("common.admin.statusPublished")
                          : t("common.admin.statusOff")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-zinc-800/80 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
          >
            {t("common.admin.cancel")}
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
          >
            {step < 1 ? t("common.admin.dramaFormNext") : t("common.admin.dramaFormConfirm")}
          </button>
        </div>
      </div>
    </>
  );
}
