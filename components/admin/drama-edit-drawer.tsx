"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Series } from "@/constants/mock-data";
import { showToast } from "@/components/ui/toast";

interface DramaEditDrawerProps {
  open: boolean;
  series: Series | null;
  onClose: () => void;
  onSaved: () => void;
}

export function DramaEditDrawer({
  open,
  series,
  onClose,
  onSaved
}: DramaEditDrawerProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    title: "",
    originalName: "",
    localOrTranslated: "" as "" | "local" | "translated",
    description: "",
    tagIds: [] as string[],
    lockStartIndex: 1,
    coverUrl: "",
    listed: true
  });
  const [tags, setTags] = useState<{ id: string; nameZh: string; nameEn: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/admin/api/tags")
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && Array.isArray(json.tags)) setTags(json.tags);
      })
      .catch(() => setTags([]));
  }, []);

  useEffect(() => {
    if (series && tags.length > 0) {
      const tagIds = (series.tags ?? [])
        .map((t) => tags.find((x) => x.nameEn === t)?.id)
        .filter((id): id is string => Boolean(id));
      setForm({
        title: series.title ?? "",
        originalName: series.originalName ?? "",
        localOrTranslated: series.localOrTranslated ?? "",
        description: series.description ?? "",
        tagIds,
        lockStartIndex: series.lockStartIndex ?? 1,
        coverUrl: series.cover ?? "",
        listed: series.listed !== false
      });
    } else if (series) {
      setForm({
        title: series.title ?? "",
        originalName: series.originalName ?? "",
        localOrTranslated: series.localOrTranslated ?? "",
        description: series.description ?? "",
        tagIds: [],
        lockStartIndex: series.lockStartIndex ?? 1,
        coverUrl: series.cover ?? "",
        listed: series.listed !== false
      });
    }
  }, [series, tags]);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/admin/api/upload/cover", { method: "POST", body: fd });
    const json = await res.json();
    if (json?.ok && json.coverUrl) {
      setForm((f) => ({ ...f, coverUrl: json.coverUrl }));
    }
    e.target.value = "";
  };

  const save = async () => {
    if (!series) return;
    if (!form.title.trim()) {
      showToast(t("admin.toastTitleEmpty"));
      return;
    }

    setSaving(true);
    try {
      const tagNames = form.tagIds
        .map((id) => tags.find((t) => t.id === id)?.nameEn)
        .filter(Boolean);
      const finalTags = tagNames.length
        ? (tagNames.filter((t) =>
            ["Romance", "Revenge", "Werewolf", "CEO", "Fantasy", "Time Travel"].includes(t!)
          ) as any[])
        : (series.tags ?? ["Romance"]);

      const res = await fetch(`/admin/api/series/${series.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          originalName: form.originalName.trim() || undefined,
          localOrTranslated: form.localOrTranslated || undefined,
          description: form.description.trim() || undefined,
          tags: finalTags,
          lockStartIndex: form.lockStartIndex,
          cover: form.coverUrl || undefined,
          poster: form.coverUrl || undefined,
          listed: form.listed
        })
      });
      const json = await res.json();
      if (json?.ok) {
        showToast(t("admin.saveSuccess"), "success");
        onSaved();
      } else {
        showToast(json?.error ?? t("admin.saveFailed"));
      }
    } catch {
      showToast(t("admin.networkErrorShort"));
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = (id: string) => {
    setForm((f) => ({
      ...f,
      tagIds: f.tagIds.includes(id) ? f.tagIds.filter((t) => t !== id) : [...f.tagIds, id]
    }));
  };

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
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col bg-zinc-950 shadow-2xl",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-800/80 p-4">
          <h2 className="text-lg font-bold text-zinc-100">{t("admin.editDramaTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400">{t("admin.editFieldTitle")}</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400">{t("admin.editFieldOriginal")}</label>
              <input
                value={form.originalName}
                onChange={(e) => setForm({ ...form, originalName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400">{t("admin.editFieldType")}</label>
              <select
                value={form.localOrTranslated}
                onChange={(e) =>
                  setForm({
                    ...form,
                    localOrTranslated: e.target.value as typeof form.localOrTranslated
                  })
                }
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100"
              >
                <option value="">{t("admin.phSelect")}</option>
                <option value="local">{t("admin.localDrama")}</option>
                <option value="translated">{t("admin.translatedDrama")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400">{t("admin.editFieldSynopsis")}</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400">{t("admin.editFieldTags")}</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tagItem) => (
                  <button
                    key={tagItem.id}
                    type="button"
                    onClick={() => toggleTag(tagItem.id)}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-medium ring-1 transition",
                      form.tagIds.includes(tagItem.id)
                        ? "bg-brand/20 text-brand ring-brand/50"
                        : "bg-zinc-800/60 text-zinc-400 ring-zinc-700"
                    )}
                  >
                    {tagItem.nameZh}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400">{t("admin.editFieldLock")}</label>
              <select
                value={form.lockStartIndex}
                onChange={(e) =>
                  setForm({ ...form, lockStartIndex: parseInt(e.target.value, 10) })
                }
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100"
              >
                {Array.from(
                  { length: Math.max(series?.episodes?.length ?? 1, 1) },
                  (_, i) => i + 1
                ).map((n) => (
                  <option key={n} value={n}>
                    {t("admin.lockFromEpisodeLabel", { n })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400">{t("admin.editFieldCover")}</label>
              <div className="mt-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-700/60">
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp"
                    onChange={handleCoverUpload}
                    className="hidden"
                  />
                  {t("admin.clickUpload")}
                </label>
                {form.coverUrl && (
                  <div className="mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.coverUrl}
                      alt={t("admin.coverAlt")}
                      className="aspect-[3/4] h-24 rounded-lg object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400">{t("admin.editFieldListed")}</label>
              <select
                value={form.listed ? "1" : "0"}
                onChange={(e) => setForm({ ...form, listed: e.target.value === "1" })}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100"
              >
                <option value="1">{t("admin.listedOn")}</option>
                <option value="0">{t("admin.listedOff")}</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-800/80 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-300"
          >
            {t("admin.cancel")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
          >
            {saving ? t("admin.savingShort") : t("admin.submit")}
          </button>
        </div>
      </div>
    </>
  );
}
