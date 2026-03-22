"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AppConfig } from "@/lib/app-config/types";

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
      featuredSeriesIds: []
    },
    legal: { termsUrl: "", privacyUrl: "" }
  };
}

export default function AdminSiteSettingsPage() {
  const { t } = useTranslation();
  const [cfg, setCfg] = useState<AppConfig>(emptyConfig);
  const [featuredText, setFeaturedText] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/admin/api/app-config")
      .then((r) => r.json())
      .then((json) => {
        const c = (json?.config ?? json) as AppConfig;
        setCfg({
          ...emptyConfig(),
          ...c,
          seo: { ...emptyConfig().seo, ...c.seo },
          nav: { ...emptyConfig().nav, ...c.nav },
          home: { ...emptyConfig().home, ...c.home },
          legal: { ...emptyConfig().legal, ...c.legal }
        });
        setFeaturedText((c.home?.featuredSeriesIds ?? []).join(", "));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const patch = (partial: Partial<AppConfig>) => {
    setCfg((prev) => ({ ...prev, ...partial }));
  };

  const save = async () => {
    const ids = featuredText
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      setSaving(true);
      await fetch("/admin/api/app-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: cfg.brandName,
          logoUrl: cfg.logoUrl || "",
          seo: cfg.seo,
          nav: cfg.nav,
          home: {
            ...cfg.home,
            featuredSeriesIds: ids
          },
          legal: cfg.legal
        })
      });
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
    <main className="max-w-3xl space-y-8">
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
    </main>
  );
}
