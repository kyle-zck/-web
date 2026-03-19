"use client";

import { useMemo, useState } from "react";
import type { CategoryTag } from "@/constants/mock-data";
import { CATEGORY_TAGS } from "@/constants/mock-data";
import { Badge } from "@/components/ui/badge";

export function UploadSeriesForm({
  onUploaded
}: {
  onUploaded?: () => void;
}) {

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<CategoryTag[]>(["Romance"]);
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

  const onToggleTag = (tag: CategoryTag) => {
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
      setError("Cover 必须是图片文件。");
      return;
    }
    const maxSize = 4 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("Cover 图片过大（Demo 限制 4MB）。");
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
    if (!cleanTitle) return setError("Title 不能为空。");
    if (!description.trim()) return setError("Description 不能为空。");
    if (!selectedTags.length) return setError("至少选择一个 Tag。");
    if (!coverFile) return setError("请上传 Cover Image。");

    if (episodes.length === 0) return setError("请在 Episode Video URL 中至少输入一条 URL（每行一个）。");

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
      if (!res.ok) throw new Error("upload failed");

      setSuccess("上传成功（已同步到用户端）。");
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
      setError("添加失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-zinc-100">Add New Series</h2>
          <p className="mt-1 text-xs text-zinc-400">封面上传 + Episode 视频 URL 批量录入</p>
        </div>
        <Badge variant="pill" className="bg-brand/15 text-brand ring-1 ring-brand/40">
          Demo CMS
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-zinc-400">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Hidden Marriage CEO"
            className="mt-1 w-full rounded-2xl border border-zinc-800/80 bg-black/30 px-4 py-3 text-sm font-semibold text-zinc-100 outline-none ring-0 focus:border-brand/60"
          />
        </label>

        <div className="rounded-2xl border border-zinc-800/80 bg-black/20 p-3">
          <p className="text-xs font-semibold text-zinc-400">Cover Image Upload</p>
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
              可上传图片文件（Demo：最多 4MB）
            </div>
          )}
        </div>

        <label className="block md:col-span-2">
          <span className="text-xs font-semibold text-zinc-400">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="短剧简介（会展示在详情页）"
            className="mt-1 min-h-[110px] w-full rounded-2xl border border-zinc-800/80 bg-black/30 px-4 py-3 text-sm font-semibold text-zinc-100 outline-none ring-0 focus:border-brand/60"
          />
        </label>

        <div className="md:col-span-2">
          <p className="text-xs font-semibold text-zinc-400">Tags（可多选）</p>
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
                Episode Video URL（Bulk）
              </span>
              <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                每行一个 URL。前 3 集将标记为 Free，其余为 Locked（需 Coins）。
              </p>
            </div>
            <div className="text-right text-[11px] text-zinc-500">
              预计：{episodes.length} 集（最多 50）
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
          {busy ? "添加中..." : "Upload Series"}
        </button>
      </div>
    </form>
  );
}

