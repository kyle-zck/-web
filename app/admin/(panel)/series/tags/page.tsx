"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DramaTagCatalogModal } from "@/components/admin/drama-tag-catalog-modal";
import { showToast } from "@/components/ui/toast";
import { fetchAdminJson } from "@/lib/admin/fetch-admin-json";
import { translateAdminApiError } from "@/lib/admin/api-error";
import type { Series } from "@/constants/mock-data";

export default function AdminSeriesTagsPage() {
  const { t } = useTranslation();
  const [series, setSeries] = useState<Series[]>([]);
  const [catalogNames, setCatalogNames] = useState<string[]>([]);
  const [draft, setDraft] = useState({ tag: "", title: "" });
  const [applied, setApplied] = useState({ tag: "", title: "" });
  const [manageOpen, setManageOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingSeries, setEditingSeries] = useState<Series | null>(null);
  const [editingTags, setEditingTags] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadSeries = useCallback(async () => {
    try {
      const { res, json } = await fetchAdminJson<{ ok?: boolean; series?: Series[] }>(
        "/admin/api/series"
      );
      if (res.ok && json?.ok && Array.isArray(json.series)) {
        setSeries(json.series);
        return true;
      }
      setSeries([]);
      return false;
    } catch {
      setSeries([]);
      return false;
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      const { res, json } = await fetchAdminJson<{ ok?: boolean; items?: { name: string }[] }>(
        "/admin/api/drama-tag-catalog"
      );
      if (res.ok && json?.ok && Array.isArray(json.items)) {
        setCatalogNames(json.items.map((x) => x.name));
        return true;
      }
      setCatalogNames([]);
      return false;
    } catch {
      setCatalogNames([]);
      return false;
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [seriesOk, catalogOk] = await Promise.all([loadSeries(), loadCatalog()]);
      if (!seriesOk && !catalogOk) {
        setLoadError(String(t("admin.submitFailed")));
      }
    } catch {
      setLoadError(String(t("admin.networkError")));
    } finally {
      setLoading(false);
    }
  }, [loadCatalog, loadSeries, t]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

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
      list = list.filter((s) => (s.tags ?? []).some((tg) => tg === exact));
    }
    return list;
  }, [series, applied]);

  const startEdit = (s: Series) => {
    setEditingSeries(s);
    setEditingTags((s.tags ?? []).filter(Boolean));
  };

  const closeEdit = () => {
    setEditingSeries(null);
    setEditingTags([]);
  };

  const toggleEditTag = (tag: string, checked: boolean) => {
    setEditingTags((prev) => {
      if (checked) {
        if (prev.includes(tag)) return prev;
        return [...prev, tag];
      }
      return prev.filter((x) => x !== tag);
    });
  };

  const saveEdit = async () => {
    if (!editingSeries) return;
    if (editingTags.length === 0) {
      showToast(t("admin.valTagsRequired"), "error");
      return;
    }
    setSavingEdit(true);
    try {
      const { res, json } = await fetchAdminJson<{ ok?: boolean; errorKey?: string }>(
        `/admin/api/series/${editingSeries.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: editingTags })
        },
        10000
      );
      if (!res.ok || !json?.ok) {
        showToast(translateAdminApiError(json, t, "admin.tagSaveFailed"), "error");
        return;
      }
      showToast(t("admin.tagSaved"), "success");
      setSeries((prev) =>
        prev.map((x) => (x.id === editingSeries.id ? { ...x, tags: [...editingTags] } : x))
      );
      closeEdit();
    } catch {
      showToast(t("admin.networkErrorShort"));
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <main>
      <p className="text-xs font-medium text-zinc-500">{t("admin.dramaResourceManagement")}</p>
      <h3 className="mt-1 text-lg font-bold text-zinc-100">{t("admin.tagLibrary")}</h3>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
        {t("admin.tagManagementIntro")}
      </p>

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

      {loadError ? (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={loadAll}
            className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/20"
          >
            {t("admin.query")}
          </button>
        </div>
      ) : null}

      <DramaTagCatalogModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        onCatalogChange={loadCatalog}
      />

      <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/60">
        <div className="max-h-[calc(100vh-320px)] overflow-auto">
          {loading ? (
            <div className="py-12 text-center text-zinc-500">{t("admin.tableLoading")}</div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[700px] border-collapse">
                <thead className="sticky top-0 z-10 border-b border-zinc-700/80 bg-zinc-900/95 backdrop-blur">
                  <tr className="text-left text-xs text-zinc-400">
                    <th className="min-w-[260px] px-4 py-3 font-semibold">{t("admin.tagColDramaTitle")}</th>
                    <th className="min-w-[280px] px-4 py-3 font-semibold">{t("admin.tagColTag")}</th>
                    <th className="w-40 whitespace-nowrap px-4 py-3 font-semibold">
                      {t("admin.action")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSeries.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-12 text-center text-sm text-zinc-500">
                        {t("admin.noDataShort")}
                      </td>
                    </tr>
                  ) : (
                    filteredSeries.map((s) => {
                      const displayTags = (s.tags ?? []).filter(Boolean);
                      return (
                        <tr
                          key={s.id}
                          className="border-b border-zinc-800/60 align-top last:border-0 hover:bg-zinc-900/40"
                        >
                          <td className="px-4 py-3 text-sm text-zinc-200">
                            <span className="whitespace-nowrap" title={s.title}>
                              {s.title}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-300">
                            <div className="flex flex-wrap gap-1.5">
                              {displayTags.length > 0 ? (
                                displayTags.map((tag) => (
                                  <span
                                    key={`${s.id}-${tag}`}
                                    className="inline-flex rounded-full border border-zinc-600/80 bg-zinc-900/60 px-2.5 py-0.5 text-xs whitespace-nowrap"
                                  >
                                    {tag}
                                  </span>
                                ))
                              ) : (
                                <span className="text-red-300">{t("admin.valTagsRequired")}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => startEdit(s)}
                              className="rounded-lg border border-blue-500/50 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/15"
                            >
                              {t("admin.edit")}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {editingSeries ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-800/80 bg-zinc-950 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-zinc-100">{t("admin.edit")}</h2>
                <p className="mt-1 text-xs text-zinc-500">{editingSeries.title}</p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-lg border border-zinc-700 bg-black/40 px-3 py-1.5 text-xs font-semibold text-zinc-200"
              >
                {t("admin.close")}
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-xs text-zinc-400">{t("admin.tagsPickHint")}</p>
              <div className="max-h-48 overflow-auto rounded-lg border border-zinc-700/80 bg-zinc-900/50 p-3">
                <div className="flex flex-wrap gap-2">
                  {catalogNames.map((tag) => {
                    const checked = editingTags.includes(tag);
                    return (
                      <label
                        key={`catalog-${tag}`}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-600/80 px-2 py-1 text-xs text-zinc-200"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleEditTag(tag, e.target.checked)}
                        />
                        <span>{tag}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              {editingTags.length === 0 ? (
                <p className="text-xs text-red-300">{t("admin.valTagsRequired")}</p>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                disabled={savingEdit}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700/50 disabled:opacity-50"
              >
                {t("admin.cancel")}
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={savingEdit}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {savingEdit ? t("admin.savingShort") : t("admin.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
