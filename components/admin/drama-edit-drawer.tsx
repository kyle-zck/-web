"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Episode, Series } from "@/constants/mock-data";
import { showToast } from "@/components/ui/toast";
import { translateAdminApiError } from "@/lib/admin/api-error";
import { fetchAdminJson } from "@/lib/admin/fetch-admin-json";

/** 与上传页、标签目录一致：drama-tag-catalog */
interface CatalogTag {
  id: string;
  name: string;
}

interface DramaEditDrawerProps {
  open: boolean;
  series: Series | null;
  onClose: () => void;
  onSaved: () => void;
  /** 分集增删后返回最新剧目数据，用于列表与抽屉同步且不关闭 */
  onSeriesUpdated?: (s: Series) => void;
}

export function DramaEditDrawer({
  open,
  series,
  onClose,
  onSaved,
  onSeriesUpdated
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
  const [tags, setTags] = useState<CatalogTag[]>([]);
  const [saving, setSaving] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [deletingEpId, setDeletingEpId] = useState<string | null>(null);
  const [addingEpisode, setAddingEpisode] = useState(false);

  useEffect(() => {
    fetchAdminJson<{ ok?: boolean; items?: CatalogTag[] }>("/admin/api/drama-tag-catalog")
      .then(({ res, json }) => {
        if (res.ok && json?.ok && Array.isArray(json.items)) setTags(json.items);
        else setTags([]);
      })
      .catch(() => setTags([]));
  }, []);

  useEffect(() => {
    if (series && tags.length > 0) {
      const tagIds = (series.tags ?? [])
        .map((tagName) => tags.find((x) => x.name === tagName)?.id)
        .filter((id): id is string => Boolean(id));
      setForm({
        title: series.title ?? "",
        originalName: series.originalName ?? "",
        localOrTranslated: series.localOrTranslated ?? "",
        description: series.description ?? "",
        tagIds,
        lockStartIndex: series.lockStartIndex ?? 4,
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
        lockStartIndex: series.lockStartIndex ?? 4,
        coverUrl: series.cover ?? "",
        listed: series.listed !== false
      });
    }
  }, [series, tags]);

  useEffect(() => {
    setNewVideoUrl("");
  }, [series?.id]);

  const sampleVideoUrl = () =>
    process.env.NEXT_PUBLIC_SAMPLE_VIDEO_URL?.trim() ||
    "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

  const postAppendEpisode = async (payload: {
    videoUrl: string;
    sourceFileName?: string;
    localVideoUrl?: string;
  }) => {
    if (!series) return;
    const { res, json } = await fetchAdminJson<{
      ok?: boolean;
      series?: Series;
      error?: string;
      errorKey?: string;
    }>(`/admin/api/series/${series.id}/episodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok && json?.ok && json.series) {
      showToast(t("admin.episodeAddedToast"), "success");
      onSeriesUpdated?.(json.series);
      setNewVideoUrl("");
      return;
    }
    showToast(translateAdminApiError(json, t, "admin.saveFailed"));
  };

  const handleDeleteEpisode = async (ep: Episode) => {
    if (!series) return;
    const ok = confirm(
      t("admin.confirmDeleteEpisode", { title: series.title, n: ep.index })
    );
    if (!ok) return;
    setDeletingEpId(ep.id);
    try {
      const { res, json } = await fetchAdminJson<{
        ok?: boolean;
        series?: Series;
        error?: string;
        errorKey?: string;
      }>(`/admin/api/series/${series.id}/episodes/${ep.id}`, { method: "DELETE" });
      if (res.ok && json?.ok && json.series) {
        showToast(t("admin.episodeDeletedToast"), "success");
        onSeriesUpdated?.(json.series);
      } else {
        showToast(translateAdminApiError(json, t, "admin.saveFailed"));
      }
    } catch {
      showToast(t("admin.networkErrorShort"));
    } finally {
      setDeletingEpId(null);
    }
  };

  const handleAddEpisodeByUrl = async () => {
    if (!series) return;
    const url = newVideoUrl.trim();
    if (!url) {
      showToast(t("admin.apiErrEpisodeVideoUrlRequired"));
      return;
    }
    setAddingEpisode(true);
    try {
      await postAppendEpisode({ videoUrl: url });
    } finally {
      setAddingEpisode(false);
    }
  };

  const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !series) return;
    setAddingEpisode(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { res, json } = await fetchAdminJson<{ ok?: boolean; videoUrl?: string; errorKey?: string }>(
        "/admin/api/upload/video",
        { method: "POST", body: fd }
      );
      if (res.ok && json?.ok && json.videoUrl) {
        const localVu = `file:///${file.name.replace(/\\/g, "/")}`;
        await postAppendEpisode({
          videoUrl: json.videoUrl,
          sourceFileName: file.name,
          localVideoUrl: localVu
        });
        return;
      }
      if (json?.errorKey === "apiErrVideoTooLarge") {
        showToast(translateAdminApiError(json, t, "admin.saveFailed"));
        return;
      }
      showToast(t("admin.episodeSampleVideoFallback"), "info");
      await postAppendEpisode({
        videoUrl: sampleVideoUrl(),
        sourceFileName: file.name,
        localVideoUrl: `file:///${file.name.replace(/\\/g, "/")}`
      });
    } catch {
      showToast(t("admin.networkErrorShort"));
    } finally {
      setAddingEpisode(false);
    }
  };

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
        .map((id) => tags.find((x) => x.id === id)?.name)
        .filter((n): n is string => Boolean(n));
      const finalTags =
        tagNames.length > 0 ? tagNames : (series.tags?.length ? series.tags : []);

      const { res, json } = await fetchAdminJson<{
        ok?: boolean;
        error?: string;
        errorKey?: string;
      }>(`/admin/api/series/${series.id}`, {
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
      if (res.ok && json?.ok) {
        showToast(t("admin.saveSuccess"), "success");
        onSaved();
      } else {
        showToast(translateAdminApiError(json, t, "admin.saveFailed"));
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
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-zinc-950 shadow-2xl",
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
                    {tagItem.name}
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
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
              <label className="block text-xs font-semibold text-zinc-400">
                {t("admin.editFieldEpisodes")}
              </label>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                {t("admin.editEpisodesHint")}
              </p>
              <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                {(series?.episodes?.length ?? 0) === 0 ? (
                  <p className="text-xs text-zinc-500">{t("admin.episodeListEmpty")}</p>
                ) : (
                  (series?.episodes ?? []).map((ep) => (
                    <div
                      key={ep.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/80 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-zinc-200">
                          {t("admin.episodeRowLabel", { n: ep.index })}
                        </div>
                        {ep.sourceFileName ? (
                          <div className="truncate text-[11px] text-zinc-500" title={ep.sourceFileName}>
                            {ep.sourceFileName}
                          </div>
                        ) : (
                          <div className="truncate text-[11px] text-zinc-500" title={ep.videoUrl}>
                            {ep.videoUrl}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={deletingEpId === ep.id || addingEpisode}
                        onClick={() => handleDeleteEpisode(ep)}
                        className="shrink-0 rounded-lg border border-red-500/40 px-2 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-500/15 disabled:opacity-50"
                      >
                        {t("admin.delete")}
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-3 space-y-2">
                <input
                  type="url"
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  placeholder={t("admin.episodeVideoUrlPlaceholder")}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={addingEpisode || !series}
                    onClick={handleAddEpisodeByUrl}
                    className="rounded-lg bg-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-600 disabled:opacity-50"
                  >
                    {addingEpisode ? t("admin.savingShort") : t("admin.episodeAddByUrl")}
                  </button>
                  <label className="inline-flex cursor-pointer items-center rounded-lg border border-zinc-600 bg-zinc-800/60 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700/60 disabled:opacity-50">
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.mkv"
                      className="hidden"
                      disabled={addingEpisode || !series}
                      onChange={handleVideoFile}
                    />
                    {t("admin.episodePickVideoFile")}
                  </label>
                </div>
              </div>
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
