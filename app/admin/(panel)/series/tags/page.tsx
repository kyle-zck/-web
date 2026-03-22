"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DramaTagCatalogModal } from "@/components/admin/drama-tag-catalog-modal";
import { showToast } from "@/components/ui/toast";
import { fetchAdminJson } from "@/lib/admin/fetch-admin-json";
import type { Series } from "@/constants/mock-data";

type Row = { series: Series; tag: string | null };

export default function AdminSeriesTagsPage() {
  const { t } = useTranslation();
  const [series, setSeries] = useState<Series[]>([]);
  const [catalogNames, setCatalogNames] = useState<string[]>([]);
  const [draft, setDraft] = useState({ tag: "", title: "" });
  const [applied, setApplied] = useState({ tag: "", title: "" });
  const [manageOpen, setManageOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSeries = useCallback(async () => {
    try {
      const { res, json } = await fetchAdminJson<{ ok?: boolean; series?: Series[] }>(
        "/admin/api/series"
      );
      if (res.ok && json?.ok && Array.isArray(json.series)) setSeries(json.series);
      else setSeries([]);
    } catch {
      setSeries([]);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      const { res, json } = await fetchAdminJson<{ ok?: boolean; items?: { name: string }[] }>(
        "/admin/api/drama-tag-catalog"
      );
      if (res.ok && json?.ok && Array.isArray(json.items)) {
        setCatalogNames(json.items.map((x) => x.name));
      } else setCatalogNames([]);
    } catch {
      setCatalogNames([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await Promise.all([loadSeries(), loadCatalog()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSeries, loadCatalog]);

  const handleQuery = () => {
    setApplied({ tag: draft.tag.trim(), title: draft.title.trim() });
  };

  const handleReset = () => {
    setDraft({ tag: "", title: "" });
    setApplied({ tag: "", title: "" });
  };

  const filteredSeries = useMemo(() => {
    let list = [...series];
    if (applied.title) {
      const q = applied.title.toLowerCase();
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.originalName ?? "").toLowerCase().includes(q)
      );
    }
    if (applied.tag) {
      const exact = applied.tag;
      list = list.filter((s) => (s.tags ?? []).some((t) => t === exact));
    }
    return list;
  }, [series, applied]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const s of filteredSeries) {
      const tags = s.tags ?? [];
      if (tags.length === 0) {
        out.push({ series: s, tag: null });
      } else {
        for (const tag of tags) {
          out.push({ series: s, tag });
        }
      }
    }
    return out;
  }, [filteredSeries]);

  const removeTagFromSeries = async (s: Series, tag: string) => {
    const ok = confirm(t("admin.confirmRemoveTagFromDrama", { title: s.title, tag }));
    if (!ok) return;
    const nextTags = (s.tags ?? []).filter((tg) => tg !== tag);
    try {
      const res = await fetch(`/admin/api/series/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: nextTags })
      });
      const json = await res.json();
      if (!json?.ok) {
        showToast(t("admin.tagRemoveFailed"));
        return;
      }
      showToast(t("admin.tagRemoved"), "success");
      await loadSeries();
    } catch {
      showToast(t("admin.networkErrorShort"));
    }
  };

  return (
    <main>
      <p className="text-xs font-medium text-zinc-500">{t("admin.dramaResourceManagement")}</p>
      <h3 className="mt-1 text-lg font-bold text-zinc-100">{t("admin.tagLibrary")}</h3>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
        {t("admin.tagManagementIntro")}
      </p>

      {/* 筛选 */}
      <section className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400">{t("admin.tags")}</label>
          <input
            type="text"
            list="drama-tag-catalog-datalist"
            value={draft.tag}
            onChange={(e) => setDraft((d) => ({ ...d, tag: e.target.value }))}
            placeholder={t("admin.tagExactFilterPlaceholder")}
            className="mt-1 w-48 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
          />
          <datalist id="drama-tag-catalog-datalist">
            {catalogNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-400">
            {t("admin.dramaTitleFuzzy")}
          </label>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder={t("admin.dramaTitleFuzzyPlaceholder")}
            className="mt-1 w-52 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
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
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            {t("admin.manageTagCatalog")}
          </button>
        </div>
      </section>

      <DramaTagCatalogModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        onCatalogChange={loadCatalog}
      />

      {/* 剧目 × 标签 明细表 */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/60">
        <div className="max-h-[calc(100vh-320px)] overflow-auto">
          {loading ? (
            <div className="py-12 text-center text-zinc-500">{t("admin.tableLoading")}</div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[520px] border-collapse">
                <thead className="sticky top-0 z-10 border-b border-zinc-700/80 bg-zinc-900/95 backdrop-blur">
                  <tr className="text-left text-xs text-zinc-400">
                    <th className="min-w-[200px] px-4 py-3 font-semibold">{t("admin.tagColDramaTitle")}</th>
                    <th className="min-w-[160px] px-4 py-3 font-semibold">{t("admin.tagColTag")}</th>
                    <th className="w-28 whitespace-nowrap px-4 py-3 font-semibold">
                      {t("admin.action")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-12 text-center text-sm text-zinc-500">
                        {t("admin.noDataShort")}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => (
                      <tr
                        key={`${row.series.id}-${row.tag ?? "none"}-${idx}`}
                        className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40"
                      >
                        <td className="px-4 py-3 text-sm text-zinc-200">
                          <span className="whitespace-nowrap" title={row.series.title}>
                            {row.series.title}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-300">
                          {row.tag ? (
                            <span className="inline-flex rounded-full border border-zinc-600/80 bg-zinc-900/60 px-2.5 py-0.5 text-xs whitespace-nowrap">
                              {row.tag}
                            </span>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {row.tag ? (
                            <button
                              type="button"
                              onClick={() => removeTagFromSeries(row.series, row.tag!)}
                              className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/15"
                            >
                              {t("admin.delete")}
                            </button>
                          ) : (
                            <span className="text-xs text-zinc-600">—</span>
                          )}
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
