"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "@/components/ui/toast";
import { translateAdminApiError } from "@/lib/admin/api-error";
import type { Episode, Series } from "@/constants/mock-data";

type Row = { series: Series; episode: Episode };

export default function AdminEpisodeManagementPage() {
  const { t } = useTranslation();
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState("");
  const [draft, setDraft] = useState({ dramaId: "", originalName: "", title: "" });
  const [applied, setApplied] = useState({ dramaId: "", originalName: "", title: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/admin/api/series");
      const json = await res.json();
      if (json?.ok && Array.isArray(json.series)) setSeries(json.series as Series[]);
      else setSeries([]);
    } catch {
      setSeries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const handleQuery = () => {
    setApplied({
      dramaId: draft.dramaId.trim(),
      originalName: draft.originalName.trim(),
      title: draft.title.trim()
    });
  };

  const handleReset = () => {
    setDraft({ dramaId: "", originalName: "", title: "" });
    setApplied({ dramaId: "", originalName: "", title: "" });
  };

  const filteredSeries = useMemo(() => {
    return series.filter((s) => {
      if (applied.dramaId) {
        const idStr = String(s.dramaId ?? "");
        if (!idStr.toLowerCase().includes(applied.dramaId.toLowerCase())) return false;
      }
      if (applied.originalName) {
        const q = applied.originalName.toLowerCase();
        if (!(s.originalName ?? "").toLowerCase().includes(q)) return false;
      }
      if (applied.title) {
        const q = applied.title.toLowerCase();
        if (!s.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [series, applied]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const s of filteredSeries) {
      for (const e of s.episodes ?? []) {
        out.push({ series: s, episode: e });
      }
    }
    return out;
  }, [filteredSeries]);

  const deleteEpisode = async (s: Series, e: Episode) => {
    const ok = confirm(t("admin.confirmDeleteEpisode", { title: s.title, n: e.index }));
    if (!ok) return;
    try {
      const res = await fetch(`/admin/api/series/${s.id}/episodes/${e.id}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (!json?.ok) {
        showToast(translateAdminApiError(json, t, "admin.episodeDeleteFailed"));
        return;
      }
      showToast(t("admin.episodeDeleted"), "success");
      await load();
    } catch {
      showToast(t("admin.networkErrorShort"));
    }
  };

  const localHref = (e: Episode) =>
    (e.localVideoUrl && e.localVideoUrl.trim()) || e.videoUrl;

  const siteHref = (s: Series, e: Episode) =>
    `${origin}/series/${encodeURIComponent(s.id)}?episode=${e.index}`;

  return (
    <main>
      <p className="text-xs font-medium text-zinc-500">{t("admin.dramaResourceManagement")}</p>
      <h4 className="mt-1 text-base font-bold text-zinc-100">{t("admin.episodeManagement")}</h4>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
        {t("admin.episodeManagementIntro")}
      </p>

      <section className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400">
            {t("admin.dramaIdFilter")}
          </label>
          <input
            type="text"
            value={draft.dramaId}
            onChange={(e) => setDraft((d) => ({ ...d, dramaId: e.target.value }))}
            placeholder={t("admin.dramaIdFilterPh")}
            className="mt-1 w-40 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-400">
            {t("admin.originalNameFilter")}
          </label>
          <input
            type="text"
            value={draft.originalName}
            onChange={(e) => setDraft((d) => ({ ...d, originalName: e.target.value }))}
            placeholder={t("admin.originalNameFilterPh")}
            className="mt-1 w-44 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-400">
            {t("admin.dramaTitleFilter")}
          </label>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder={t("admin.dramaTitleFilterPh")}
            className="mt-1 w-44 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-zinc-600 bg-zinc-800/60 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700/60"
          >
            {t("admin.reset")}
          </button>
          <button
            type="button"
            onClick={handleQuery}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            {t("admin.query")}
          </button>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/60">
        <div className="max-h-[calc(100vh-340px)] overflow-auto">
          {loading ? (
            <div className="py-12 text-center text-zinc-500">{t("admin.tableLoading")}</div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[1100px] border-collapse">
                <thead className="sticky top-0 z-10 border-b border-zinc-700/80 bg-zinc-900/95 backdrop-blur">
                  <tr className="text-left text-xs text-zinc-400">
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("admin.episodeColDramaId")}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("admin.episodeColIndex")}</th>
                    <th className="min-w-[100px] px-3 py-2 font-semibold">{t("admin.colOriginalName")}</th>
                    <th className="min-w-[100px] px-3 py-2 font-semibold">{t("admin.colDramaTitle")}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("admin.episodeColCover")}</th>
                    <th className="min-w-[120px] px-3 py-2 font-semibold">{t("admin.episodeColLocalVideo")}</th>
                    <th className="min-w-[120px] px-3 py-2 font-semibold">{t("admin.episodeColSiteLink")}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("admin.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-zinc-500">
                        {t("admin.noEpisodeRows")}
                      </td>
                    </tr>
                  ) : (
                    rows.map(({ series: s, episode: e }) => (
                      <tr
                        key={`${s.id}-${e.id}`}
                        className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40"
                      >
                        <td className="whitespace-nowrap px-3 py-2 text-sm font-mono text-zinc-200">
                          {s.dramaId ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-sm text-zinc-200">
                          <div className="whitespace-nowrap">{t("admin.episodeRowLabel", { n: e.index })}</div>
                          {e.sourceFileName ? (
                            <div
                              className="mt-0.5 max-w-[200px] truncate text-[11px] text-zinc-500"
                              title={e.sourceFileName}
                            >
                              {t("admin.episodeFileName", { name: e.sourceFileName })}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-sm text-zinc-300">
                          <span className="whitespace-nowrap" title={s.originalName ?? ""}>
                            {s.originalName ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-zinc-200">
                          <span className="whitespace-nowrap" title={s.title}>
                            {s.title}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <a
                            href={s.cover}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-10 shrink-0"
                            title={t("admin.clickViewCover")}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={s.cover}
                              alt={s.title}
                              className="aspect-[3/4] h-12 w-10 rounded object-cover ring-1 ring-zinc-700/80"
                              loading="lazy"
                            />
                          </a>
                        </td>
                        <td className="px-3 py-2">
                          <a
                            href={localHref(e)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:underline"
                            title={
                              e.localVideoUrl?.startsWith("file:")
                                ? t("admin.fileLinkBlockedHint")
                                : e.sourceFileName ?? t("admin.localResourceFallback")
                            }
                          >
                            {t("admin.openLocalResource")}
                          </a>
                        </td>
                        <td className="px-3 py-2">
                          {origin ? (
                            <a
                              href={siteHref(s, e)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-emerald-400 hover:underline"
                            >
                              {t("admin.frontendPlayPage")}
                            </a>
                          ) : (
                            <span className="text-xs text-zinc-500">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <button
                            type="button"
                            onClick={() => deleteEpisode(s, e)}
                            className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/15"
                          >
                            {t("admin.delete")}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
