"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "@/components/ui/toast";
import { translateAdminApiError } from "@/lib/admin/api-error";

interface TagItem {
  id: string;
  nameZh: string;
  nameEn: string;
  categoryId: string;
}

export default function AdminDramaUploadPage() {
  const { t } = useTranslation();
  const [tags, setTags] = useState<TagItem[]>([]);
  const [form, setForm] = useState({
    title: "",
    originalName: "",
    localOrTranslated: "" as "" | "local" | "translated",
    totalEpisodes: 0,
    description: "",
    tagIds: [] as string[],
    lockStartIndex: 1,
    coverUrl: "",
    videoFiles: [] as { file: File; index: number }[],
    listed: true
  });
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/admin/api/tags")
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && Array.isArray(json.tags)) setTags(json.tags);
      })
      .catch(() => setTags([]));
  }, []);

  const checkDuplicate = async () => {
    const name = form.title.trim();
    if (!name) return true;
    setChecking(true);
    try {
      const res = await fetch("/admin/api/series/check-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: name })
      });
      const json = await res.json();
      if (json?.duplicate) {
        showToast(t("admin.toastTitleExists"));
        return false;
      }
      return true;
    } finally {
      setChecking(false);
    }
  };

  const validate = (): string | null => {
    if (!form.title.trim()) return t("admin.valTitleRequired");
    if (!form.originalName.trim()) return t("admin.valOriginalRequired");
    if (!form.localOrTranslated) return t("admin.valLocalTypeRequired");
    if (!form.totalEpisodes || form.totalEpisodes < 1) return t("admin.valEpisodesPositive");
    if (!form.description.trim()) return t("admin.valSynopsisRequired");
    if (form.tagIds.length === 0) return t("admin.valTagsRequired");
    if (!form.lockStartIndex || form.lockStartIndex < 1) return t("admin.valLockRequired");
    if (!form.coverUrl) return t("admin.valCoverRequired");
    if (form.videoFiles.length === 0) return t("admin.valVideosRequired");
    if (form.videoFiles.length !== form.totalEpisodes) {
      return t("admin.valVideoCountMismatch", {
        a: form.videoFiles.length,
        b: form.totalEpisodes
      });
    }
    return null;
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      showToast(t("admin.toastCoverFormat"));
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/admin/api/upload/cover", { method: "POST", body: fd });
    const json = await res.json();
    if (json?.ok && json.coverUrl) {
      setForm((f) => ({ ...f, coverUrl: json.coverUrl }));
    } else {
      showToast(t("admin.toastCoverUploadFail"));
    }
    e.target.value = "";
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const parsed = files
      .map((f) => {
        const m = f.name.match(/(\d+)/);
        const index = m ? parseInt(m[1], 10) : 0;
        return { file: f, index: index || 0 };
      })
      .filter((x) => x.index > 0)
      .sort((a, b) => a.index - b.index);
    if (parsed.length === 0 && files.length > 0) {
      showToast(t("admin.toastVideoNameParse"));
      return;
    }
    setForm((f) => ({ ...f, videoFiles: parsed }));
    e.target.value = "";
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      showToast(err);
      return;
    }
    const dupOk = await checkDuplicate();
    if (!dupOk) return;

    setSubmitting(true);
    try {
      // 封面上传已完成，视频需逐个上传到存储 - 简化：使用 URL 占位，实际需对接视频上传 API
      const coverUrl = form.coverUrl;
      const VALID_TAGS = ["Romance", "Revenge", "Werewolf", "CEO", "Fantasy", "Time Travel"] as const;
      const tagNamesEn = form.tagIds
        .map((id) => tags.find((t) => t.id === id)?.nameEn)
        .filter((e): e is string => Boolean(e));
      const categoryTags = tagNamesEn.filter((t) =>
        VALID_TAGS.includes(t as (typeof VALID_TAGS)[number])
      ) as (typeof VALID_TAGS)[number][];
      const finalTags = categoryTags.length ? categoryTags : (["Romance"] as const);

      // 视频上传：Demo 使用占位 URL，生产需对接真实上传；元数据保留原始文件名供剧集管理展示
      const sortedVideos = [...form.videoFiles].sort((a, b) => a.index - b.index);
      const episodeUrls = sortedVideos.map(() => {
        return "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";
      });
      const episodeVideoMeta = sortedVideos.map((v) => ({
        fileName: v.file.name,
        localVideoUrl: `file:///${v.file.name.replace(/\\/g, "/")}`
      }));

      const res = await fetch("/admin/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          originalName: form.originalName.trim(),
          localOrTranslated: form.localOrTranslated || undefined,
          description: form.description.trim(),
          tags: finalTags,
          coverDataUrl: coverUrl,
          episodeVideoUrls: episodeUrls,
          episodeVideoMeta,
          lockStartIndex: form.lockStartIndex,
          listed: form.listed
        })
      });
      const json = await res.json();
      if (json?.ok) {
        showToast(t("admin.uploadSuccessShort"), "success");
        setForm({
          title: "",
          originalName: "",
          localOrTranslated: "",
          totalEpisodes: 0,
          description: "",
          tagIds: [],
          lockStartIndex: 1,
          coverUrl: "",
          videoFiles: [],
          listed: true
        });
      } else {
        showToast(translateAdminApiError(json, t, "admin.submitFailed"));
      }
    } catch {
      showToast(t("admin.networkErrorShort"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setForm({
      title: "",
      originalName: "",
      localOrTranslated: "",
      totalEpisodes: 0,
      description: "",
      tagIds: [],
      lockStartIndex: 1,
      coverUrl: "",
      videoFiles: [],
      listed: true
    });
    showToast(t("admin.toastCancelled"), "info");
  };

  const toggleTag = (id: string) => {
    setForm((f) => ({
      ...f,
      tagIds: f.tagIds.includes(id) ? f.tagIds.filter((t) => t !== id) : [...f.tagIds, id]
    }));
  };

  return (
    <main className="max-w-2xl">
      <h1 className="text-xl font-extrabold text-zinc-100">
        {t("admin.dramaUpload")}
      </h1>
      <p className="mt-1 text-xs text-zinc-400">{t("admin.uploadPageSubtitle")}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="mt-6 space-y-5 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6"
      >
        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("admin.fieldDramaTitle")} <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t("admin.phTitleDupCheck")}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100 placeholder-zinc-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("admin.fieldOriginalTitle")} <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.originalName}
            onChange={(e) => setForm({ ...form, originalName: e.target.value })}
            placeholder={t("admin.phManualInput")}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100 placeholder-zinc-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("admin.fieldLocalOrTranslated")} <span className="text-red-400">*</span>
          </label>
          <select
            value={form.localOrTranslated}
            onChange={(e) =>
              setForm({
                ...form,
                localOrTranslated: e.target.value as "" | "local" | "translated"
              })
            }
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100"
          >
            <option value="">{t("admin.phSelect")}</option>
            <option value="local">{t("admin.localDrama")}</option>
            <option value="translated">{t("admin.translatedDrama")}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("admin.fieldTotalEpisodes")} <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            min={1}
            value={form.totalEpisodes || ""}
            onChange={(e) =>
              setForm({
                ...form,
                totalEpisodes: Math.max(0, parseInt(e.target.value, 10) || 0)
              })
            }
            placeholder={t("admin.phManualInput")}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100 placeholder-zinc-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("admin.fieldSynopsis")} <span className="text-red-400">*</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            placeholder={t("admin.phSynopsis")}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100 placeholder-zinc-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("admin.fieldTagsRequired")} <span className="text-red-400">*</span>
          </label>
          <p className="mt-1 text-xs text-zinc-500">{t("admin.tagsPickHint")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((tagItem) => (
              <button
                key={tagItem.id}
                type="button"
                onClick={() => toggleTag(tagItem.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium ring-1 transition ${
                  form.tagIds.includes(tagItem.id)
                    ? "bg-brand/20 text-brand ring-brand/50"
                    : "bg-zinc-800/60 text-zinc-400 ring-zinc-700 hover:text-zinc-200"
                }`}
              >
                {tagItem.nameZh}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("admin.fieldLockStart")} <span className="text-red-400">*</span>
          </label>
          <p className="mt-1 text-xs text-zinc-500">{t("admin.lockStartHint")}</p>
          <select
            value={form.lockStartIndex}
            onChange={(e) =>
              setForm({ ...form, lockStartIndex: parseInt(e.target.value, 10) })
            }
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100"
          >
            {Array.from(
              { length: Math.max(form.totalEpisodes || 1, 1) },
              (_, i) => i + 1
            ).map((n) => (
              <option key={n} value={n}>
                {t("admin.lockFromEpisodeLabel", { n })}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("admin.fieldCover")} <span className="text-red-400">*</span>
          </label>
          <p className="mt-1 text-xs text-zinc-500">{t("admin.coverFormatHint")}</p>
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
              <div className="mt-2 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.coverUrl}
                  alt={t("admin.coverAlt")}
                  className="aspect-[3/4] h-24 rounded-lg object-cover"
                />
                <span className="text-xs text-emerald-400">{t("admin.uploaded")}</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("admin.fieldVideoFiles")} <span className="text-red-400">*</span>
          </label>
          <p className="mt-1 text-xs text-zinc-500">{t("admin.videoBatchHint")}</p>
          <div className="mt-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-700/60">
              <input
                type="file"
                accept="video/*"
                multiple
                onChange={handleVideoUpload}
                className="hidden"
              />
              {t("admin.clickUpload")}
            </label>
            {form.videoFiles.length > 0 && (
              <p className="mt-2 text-xs text-emerald-400">
                {t("admin.selectedEpisodes", { count: form.videoFiles.length })}
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("admin.fieldListed")} <span className="text-red-400">*</span>
          </label>
          <select
            value={form.listed ? "1" : "0"}
            onChange={(e) => setForm({ ...form, listed: e.target.value === "1" })}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100"
          >
            <option value="1">{t("admin.listedVisible")}</option>
            <option value="0">{t("admin.listedHidden")}</option>
          </select>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg border border-zinc-600 px-6 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
          >
            {t("admin.cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting || checking}
            className="rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
          >
            {submitting || checking ? t("admin.submitting") : t("admin.submit")}
          </button>
        </div>
      </form>
    </main>
  );
}
