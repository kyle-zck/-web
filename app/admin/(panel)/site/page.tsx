"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AppConfig, AppConfigHomeRow } from "@/lib/app-config/types";
import { fetchAdminJson } from "@/lib/admin/fetch-admin-json";
import { translateAdminApiError } from "@/lib/admin/api-error";
import { showToast } from "@/components/ui/toast";
import type { Series } from "@/constants/mock-data";

type HomeRowDraft = AppConfigHomeRow;

function emptyConfig(): AppConfig {
  return {
    brandName: "ReelShorts",
    logoUrl: "",
    subscriptionPlans: [],
    seo: {
      siteTitle: "",
      siteDescription: "",
      ogImageUrl: "",
      defaultLocale: "zh-CN"
    },
    nav: { showExplore: true, showProfile: true },
    home: {
      showContinueWatching: true,
      showNewRelease: true,
      showTrending: true,
      showCategoryRows: true,
      featuredSeriesIds: [],
      titleRows: []
    },
    legal: { termsUrl: "", privacyUrl: "" }
  };
}

function newHomeRow(): HomeRowDraft {
  return {
    id: `row-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title: "",
    seriesIds: []
  };
}

export default function AdminSiteSettingsPage() {
  const { t } = useTranslation();
  const [cfg, setCfg] = useState<AppConfig>(emptyConfig);
  const [featuredText, setFeaturedText] = useState("");
  const [homeRows, setHomeRows] = useState<HomeRowDraft[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [rowFilterMap, setRowFilterMap] = useState<Record<string, string>>({});
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadConfig = async () => {
    setLoaded(false);
    setLoadError(null);
    try {
      const [{ res, json }, seriesRes] = await Promise.all([
        fetchAdminJson<{ ok?: boolean; config?: AppConfig; errorKey?: string }>(
          "/admin/api/app-config",
          undefined,
          10000
        ),
        fetchAdminJson<{ ok?: boolean; series?: Series[] }>("/admin/api/series", undefined, 10000)
      ]);

      if (!res.ok || !json?.ok) {
        setLoadError(translateAdminApiError(json, t));
        return;
      }
      const c = (json?.config ?? {}) as AppConfig;
      setCfg({
        ...emptyConfig(),
        ...c,
        seo: { ...emptyConfig().seo, ...c.seo },
        nav: { ...emptyConfig().nav, ...c.nav },
        home: { ...emptyConfig().home, ...c.home },
        legal: { ...emptyConfig().legal, ...c.legal }
      });
      setFeaturedText((c.home?.featuredSeriesIds ?? []).join(", "));
      setHomeRows((c.home?.titleRows ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        seriesIds: [...(r.seriesIds ?? [])]
      })));

      if (seriesRes.res.ok && seriesRes.json?.ok && Array.isArray(seriesRes.json.series)) {
        setSeriesList(seriesRes.json.series.filter((s) => s.listed !== false));
      } else {
        setSeriesList([]);
      }
    } catch {
      setLoadError(String(t("admin.networkError")));
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seriesById = useMemo(() => new Map(seriesList.map((s) => [s.id, s])), [seriesList]);

  const patch = (partial: Partial<AppConfig>) => {
    setCfg((prev) => ({ ...prev, ...partial }));
  };

  const updateHomeRow = (id: string, patchRow: Partial<HomeRowDraft>) => {
    setHomeRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patchRow } : r)));
  };

  const removeHomeRow = (id: string) => {
    setHomeRows((prev) => prev.filter((r) => r.id !== id));
    setRowFilterMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const toggleSeriesInRow = (rowId: string, seriesId: string, checked: boolean) => {
    setHomeRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        if (checked) {
          if (r.seriesIds.includes(seriesId)) return r;
          return { ...r, seriesIds: [...r.seriesIds, seriesId] };
        }
        return { ...r, seriesIds: r.seriesIds.filter((id) => id !== seriesId) };
      })
    );
  };

  const moveRow = (dragId: string, targetId: string) => {
    if (dragId === targetId) return;
    setHomeRows((prev) => {
      const from = prev.findIndex((r) => r.id === dragId);
      const to = prev.findIndex((r) => r.id === targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [picked] = next.splice(from, 1);
      next.splice(to, 0, picked);
      return next;
    });
  };

  const moveSeriesInRow = (rowId: string, seriesId: string, direction: "up" | "down") => {
    setHomeRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const idx = r.seriesIds.indexOf(seriesId);
        if (idx < 0) return r;
        const target = direction === "up" ? idx - 1 : idx + 1;
        if (target < 0 || target >= r.seriesIds.length) return r;
        const nextIds = [...r.seriesIds];
        const [picked] = nextIds.splice(idx, 1);
        nextIds.splice(target, 0, picked);
        return { ...r, seriesIds: nextIds };
      })
    );
  };

  const save = async () => {
    const ids = featuredText
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const normalizedRows: HomeRowDraft[] = homeRows
      .map((r) => ({
        id: r.id.trim() || `row-${Date.now()}`,
        title: r.title.trim(),
        seriesIds: r.seriesIds.map((x) => x.trim()).filter(Boolean)
      }))
      .filter((r) => r.title.length > 0);

    if (normalizedRows.some((r) => r.seriesIds.length === 0)) {
      showToast("每个标题分支至少选择一个剧目", "error");
      return;
    }

    try {
      setSaving(true);
      const { res, json } = await fetchAdminJson<{ ok?: boolean; errorKey?: string }>(
        "/admin/api/app-config",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandName: cfg.brandName,
            logoUrl: cfg.logoUrl || "",
            seo: cfg.seo,
            nav: cfg.nav,
            home: {
              ...cfg.home,
              showContinueWatching: cfg.home?.showContinueWatching !== false,
              featuredSeriesIds: ids,
              titleRows: normalizedRows
            },
            legal: cfg.legal
          })
        },
        10000
      );
      if (!res.ok || !json?.ok) {
        showToast(translateAdminApiError(json, t), "error");
        return;
      }
      showToast(t("admin.saved"), "success");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <main>
        <p className="text-sm text-zinc-400">{t("admin.loading")}</p>
      </main>
    );
  }

  return (
    <main className="max-w-5xl space-y-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-zinc-100">{t("admin.siteSettings")}</h1>
          <p className="mt-1 text-xs text-zinc-400">{t("admin.siteSettingsHint")}</p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? t("admin.saving") : t("admin.save")}
        </button>
      </div>

      {loadError ? (
        <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={loadConfig}
            className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/20"
          >
            {t("admin.query")}
          </button>
        </div>
      ) : null}

      <section className="rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">{t("admin.homeBlock")}</h2>
        <div className="mt-3 space-y-2">
          {(
            [
              ["showContinueWatching", t("admin.homeShowContinue")] as const,
              ["showNewRelease", t("admin.homeShowNewRelease")] as const,
              ["showTrending", t("admin.homeShowTrending")] as const,
              ["showCategoryRows", t("admin.homeShowCategoryRows")] as const
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={cfg.home?.[key] !== false}
                onChange={(e) =>
                  patch({
                    home: { ...cfg.home, [key]: e.target.checked }
                  })
                }
              />
              {label}
            </label>
          ))}
          <label className="mt-3 flex flex-col gap-1 text-xs text-zinc-400">
            {t("admin.featuredSeriesIds")}
            <input
              value={featuredText}
              onChange={(e) => setFeaturedText(e.target.value)}
              placeholder="id1, id2, id3"
              className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
            />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">{t("admin.branding")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {t("admin.brandName")}
            <input
              value={cfg.brandName}
              onChange={(e) => patch({ brandName: e.target.value })}
              className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {t("admin.logoUrl")}
            <input
              value={cfg.logoUrl ?? ""}
              onChange={(e) => patch({ logoUrl: e.target.value })}
              placeholder="https://"
              className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
            />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">{t("admin.seoBlock")}</h2>
        <div className="mt-3 space-y-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {t("admin.seoTitle")}
            <input
              value={cfg.seo?.siteTitle ?? ""}
              onChange={(e) =>
                patch({ seo: { ...cfg.seo, siteTitle: e.target.value } })
              }
              className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {t("admin.seoDescription")}
            <textarea
              value={cfg.seo?.siteDescription ?? ""}
              onChange={(e) =>
                patch({ seo: { ...cfg.seo, siteDescription: e.target.value } })
              }
              rows={3}
              className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {t("admin.ogImageUrl")}
            <input
              value={cfg.seo?.ogImageUrl ?? ""}
              onChange={(e) =>
                patch({ seo: { ...cfg.seo, ogImageUrl: e.target.value } })
              }
              placeholder="https://"
              className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {t("admin.defaultLocale")}
            <select
              value={cfg.seo?.defaultLocale ?? "zh-CN"}
              onChange={(e) =>
                patch({
                  seo: {
                    ...cfg.seo,
                    defaultLocale: e.target.value as "en" | "zh-CN"
                  }
                })
              }
              className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
            >
              <option value="zh-CN">zh-CN</option>
              <option value="en">en</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">{t("admin.navBlock")}</h2>
        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={cfg.nav?.showExplore !== false}
              onChange={(e) =>
                patch({ nav: { ...cfg.nav, showExplore: e.target.checked } })
              }
            />
            {t("admin.navShowExplore")}
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={cfg.nav?.showProfile !== false}
              onChange={(e) =>
                patch({ nav: { ...cfg.nav, showProfile: e.target.checked } })
              }
            />
            {t("admin.navShowProfile")}
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">{t("admin.legalBlock")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {t("admin.legalTermsUrl")}
            <input
              value={cfg.legal?.termsUrl ?? ""}
              onChange={(e) =>
                patch({ legal: { ...cfg.legal, termsUrl: e.target.value } })
              }
              placeholder="https://"
              className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {t("admin.legalPrivacyUrl")}
            <input
              value={cfg.legal?.privacyUrl ?? ""}
              onChange={(e) =>
                patch({ legal: { ...cfg.legal, privacyUrl: e.target.value } })
              }
              placeholder="https://"
              className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
            />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">Homepage custom title rows</h2>
          <button
            type="button"
            onClick={() => setHomeRows((prev) => [...prev, newHomeRow()])}
            className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            + Add row
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {homeRows.length === 0 ? (
            <div className="rounded-xl border border-zinc-800/80 bg-black/30 p-4 text-sm text-zinc-500">
              No custom rows yet.
            </div>
          ) : null}

          {homeRows.map((row) => {
            const filter = rowFilterMap[row.id] ?? "";
            const filteredSeries = seriesList.filter((s) =>
              !filter
                ? true
                : `${s.title} ${(s.originalName ?? "")} ${s.id}`
                    .toLowerCase()
                    .includes(filter.toLowerCase())
            );
            return (
              <div
                key={row.id}
                draggable
                onDragStart={() => setDraggingRowId(row.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggingRowId) moveRow(draggingRowId, row.id);
                  setDraggingRowId(null);
                }}
                className="rounded-2xl border border-zinc-800/80 bg-black/40 p-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="cursor-grab select-none text-xs text-zinc-500" title="Drag to reorder">
                    ↕
                  </span>
                  <input
                    value={row.title}
                    onChange={(e) => updateHomeRow(row.id, { title: e.target.value })}
                    placeholder="Row title"
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100"
                  />
                  <span className="text-xs text-zinc-400">{row.seriesIds.length} selected</span>
                  <button
                    type="button"
                    onClick={() => removeHomeRow(row.id)}
                    className="rounded-lg border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/15"
                  >
                    Delete
                  </button>
                </div>

                <input
                  value={filter}
                  onChange={(e) => setRowFilterMap((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  placeholder="Filter series by title / id"
                  className="mb-2 w-full rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-xs text-zinc-200"
                />

                <div className="max-h-44 overflow-auto rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2">
                  <div className="grid gap-1">
                    {filteredSeries.map((s) => {
                      const checked = row.seriesIds.includes(s.id);
                      return (
                        <label key={`${row.id}-${s.id}`} className="flex items-center gap-2 text-xs text-zinc-200">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleSeriesInRow(row.id, s.id, e.target.checked)}
                          />
                          <span className="truncate">{s.title}</span>
                          <span className="text-zinc-500">({s.id})</span>
                        </label>
                      );
                    })}
                    {filteredSeries.length === 0 ? (
                      <p className="text-xs text-zinc-500">No series matched.</p>
                    ) : null}
                  </div>
                </div>

                {row.seriesIds.length > 0 ? (
                  <div className="mt-2 rounded-lg border border-zinc-800/80 bg-zinc-900/35 p-2">
                    <p className="mb-1 text-[11px] text-zinc-500">Selected order</p>
                    <div className="space-y-1.5">
                      {row.seriesIds.map((id, index) => (
                        <div
                          key={`${row.id}-picked-${id}`}
                          className="flex items-center justify-between rounded-md border border-zinc-700/70 bg-zinc-900/70 px-2 py-1 text-[11px] text-zinc-200"
                        >
                          <span className="truncate">{seriesById.get(id)?.title ?? id}</span>
                          <div className="ml-2 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveSeriesInRow(row.id, id, "up")}
                              disabled={index === 0}
                              className="rounded border border-zinc-600 px-1.5 py-0.5 text-[10px] text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveSeriesInRow(row.id, id, "down")}
                              disabled={index === row.seriesIds.length - 1}
                              className="rounded border border-zinc-600 px-1.5 py-0.5 text-[10px] text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
