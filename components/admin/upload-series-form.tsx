"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "@/components/ui/toast";
import { translateAdminApiError } from "@/lib/admin/api-error";
import { CATEGORY_TAGS } from "@/constants/mock-data";
import { Badge } from "@/components/ui/badge";

export function UploadSeriesForm({
  onUploaded
}: {
  onUploaded?: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>(["Romance"]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string>("");
  const [episodesText, setEpisodesText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const episodes = useMemo(() => {
    return episodesText
      .split(/\n/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
  }, [episodesText]);

  const onToggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      // 最少保留 1 个分类，避免 category 为空
      if (prev.length >= 1) return [...prev, tag];
      return [tag];
    });
  };

  const onPickCover = async (file: File | null) => {
    setError(null);
    setSuccess(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      const msg = t("admin.coverMustBeImage");
      setError(msg);
      showToast(msg);
      return;
    }
    const maxSize = 4 * 1024 * 1024;
    if (file.size > maxSize) {
      const msg = t("admin.coverTooLarge");
      setError(msg);
      showToast(msg);
      return;
    }

    if (coverPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(coverPreviewUrl);
    }
    const objectUrl = URL.createObjectURL(file);
    setCoverPreviewUrl(objectUrl);
    setCoverFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      const msg = t("admin.titleRequired");
      setError(msg);
      showToast(msg);
      return;
    }
    if (!description.trim()) {
      const msg = t("admin.descriptionRequired");
      setError(msg);
      showToast(msg);
      return;
    }
    if (!selectedTags.length) {
      const msg = t("admin.selectAtLeastOneTag");
      setError(msg);
      showToast(msg);
      return;
    }
    if (!coverFile) {
      const msg = t("admin.uploadCoverRequired");
      setError(msg);
      showToast(msg);
      return;
    }
    if (episodes.length === 0) {
      const msg = t("admin.episodeUrlRequired");
      setError(msg);
      showToast(msg);
      return;
    }

    setBusy(true);
    try {
      // 1) 上传封面到对象存储，得到 coverUrl
      const fd = new FormData();
      fd.append("file", coverFile);
      const uploadRes = await fetch("/admin/api/upload/cover", {
        method: "POST",
        body: fd,
        credentials: "include"
      });
      const uploadJson = (await uploadRes.json()) as {
        ok?: boolean;
        coverUrl?: string;
      };
      if (!uploadRes.ok || !uploadJson.ok || !uploadJson.coverUrl) {
        throw new Error("upload cover failed");
      }

      const res = await fetch("/admin/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          description: description.trim(),
          tags: selectedTags,
          coverDataUrl: uploadJson.coverUrl,
          episodeVideoUrls: episodes
        })
      });
      const seriesJson = (await res.json()) as {
        ok?: boolean;
        error?: string;
        errorKey?: string;
      };
      if (!seriesJson?.ok) {
        const msg = translateAdminApiError(seriesJson, t, "admin.uploadFailed");
        setError(msg);
        showToast(msg);
        return;
      }

      setSuccess(t("admin.uploadSuccess"));
      setTitle("");
      setDescription("");
      setSelectedTags(["Romance"]);
      if (coverPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
      setCoverPreviewUrl("");
      setCoverFile(null);
      setEpisodesText("");

      onUploaded?.();
    } catch {
      setError(t("admin.uploadFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-zinc-100">{t("admin.addNewSeries")}</h2>
          <p className="mt-1 text-xs text-zinc-400">{t("admin.uploadHint")}</p>
        </div>
        <Badge variant="pill" className="bg-brand/15 text-brand ring-1 ring-brand/40">
          {t("admin.demoCms")}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-zinc-400">{t("admin.title")}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Hidden Marriage CEO"
            className="mt-1 w-full rounded-2xl border border-zinc-800/80 bg-black/30 px-4 py-3 text-sm font-semibold text-zinc-100 outline-none ring-0 focus:border-brand/60"
          />
        </label>

        <div className="rounded-2xl border border-zinc-800/80 bg-black/20 p-3">
          <p className="text-xs font-semibold text-zinc-400">{t("admin.coverImageUpload")}</p>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onPickCover(e.target.files?.[0] ?? null)}
            className="mt-2 w-full text-sm text-zinc-200 file:mr-3 file:rounded-full file:border-0 file:bg-brand/20 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand hover:file:bg-brand/30"
          />

          {coverPreviewUrl ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-800/80 bg-black/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverPreviewUrl}
                alt="cover preview"
                className="h-40 w-full object-cover"
              />
            </div>
          ) : (
            <div className="mt-3 text-xs text-zinc-500">
              {t("admin.coverUploadHint")}
            </div>
          )}
        </div>

        <label className="block md:col-span-2">
          <span className="text-xs font-semibold text-zinc-400">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("admin.descriptionPlaceholder")}
            className="mt-1 min-h-[110px] w-full rounded-2xl border border-zinc-800/80 bg-black/30 px-4 py-3 text-sm font-semibold text-zinc-100 outline-none ring-0 focus:border-brand/60"
          />
        </label>

        <div className="md:col-span-2">
          <p className="text-xs font-semibold text-zinc-400">{t("admin.tagsMultiSelect")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORY_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onToggleTag(tag)}
                  className={[
                    "rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-zinc-800/80",
                    active ? "bg-brand/15 text-brand ring-brand/40" : "bg-black/30 text-zinc-200 hover:bg-black/40"
                  ].join(" ")}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block md:col-span-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-zinc-400">
                {t("admin.episodeUrlBulk")}
              </span>
              <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                {t("admin.episodeUrlHint")}
              </p>
            </div>
            <div className="text-right text-[11px] text-zinc-500">
              {t("admin.estimatedEpisodes", { count: episodes.length })}
            </div>
          </div>
          <textarea
            value={episodesText}
            onChange={(e) => setEpisodesText(e.target.value)}
            placeholder="https://.../ep1.mp4&#10;https://.../ep2.mp4"
            className="mt-2 min-h-[140px] w-full rounded-2xl border border-zinc-800/80 bg-black/30 px-4 py-3 text-sm font-semibold text-zinc-100 outline-none ring-0 focus:border-brand/60"
          />
        </label>
      </div>

      {error ? <p className="mt-3 text-xs text-red-400">{error}</p> : null}
      {success ? <p className="mt-3 text-xs text-emerald-300">{success}</p> : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-3xl bg-brand px-4 py-3 text-sm font-extrabold text-white shadow-soft-glow disabled:opacity-70"
        >
          {busy ? t("admin.uploading") : t("admin.uploadSeries")}
        </button>
      </div>
    </form>
  );
}

