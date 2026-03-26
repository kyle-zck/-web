"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "@/components/ui/toast";
import { fetchAdminJson } from "@/lib/admin/fetch-admin-json";
import { translateAdminApiError } from "@/lib/admin/api-error";
import type { AccessListConfig } from "@/lib/admin/asset-config";

function linesToIds(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const s = raw.trim();
    if (!s) continue;
    out.push(s);
  }
  return Array.from(new Set(out));
}

function idsToText(ids: string[] | undefined): string {
  return (ids ?? []).join("\n");
}

export default function AdminAccessListPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [whitelistText, setWhitelistText] = useState("");
  const [blacklistText, setBlacklistText] = useState("");

  useEffect(() => {
    fetchAdminJson<{ ok?: boolean; accessList?: AccessListConfig }>("/admin/api/access-list")
      .then(({ json }) => {
        if (json?.ok && json.accessList) {
          setWhitelistText(idsToText(json.accessList.whitelistClientIds));
          setBlacklistText(idsToText(json.accessList.blacklistClientIds));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const whitelistIds = useMemo(() => linesToIds(whitelistText), [whitelistText]);
  const blacklistIds = useMemo(() => linesToIds(blacklistText), [blacklistText]);

  const save = async () => {
    try {
      setSaving(true);
      const { res, json } = await fetchAdminJson<{ ok?: boolean; errorKey?: string; accessList?: AccessListConfig }>(
        "/admin/api/access-list",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            whitelistClientIds: whitelistIds,
            blacklistClientIds: blacklistIds
          })
        }
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

  return (
    <main className="max-w-3xl space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-zinc-100">{t("admin.blackWhiteListManagement")}</h1>
          <p className="mt-1 text-xs text-zinc-400">{t("admin.blackWhiteListHint")}</p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {saving ? t("admin.saving") : t("admin.save")}
        </button>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-8 text-center text-zinc-500">
          {t("admin.loading")}
        </div>
      ) : (
        <>
          <section className="rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-4">
            <h2 className="text-sm font-semibold text-zinc-100">{t("admin.whitelist")}</h2>
            <p className="mt-1 text-xs text-zinc-500">{t("admin.whitelistHint")}</p>
            <textarea
              value={whitelistText}
              onChange={(e) => setWhitelistText(e.target.value)}
              rows={8}
              placeholder="clientId-1\nclientId-2"
              className="mt-3 w-full rounded-2xl border border-zinc-800/80 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand/60"
            />
            <p className="mt-2 text-xs text-zinc-500">
              {t("admin.count")}: {whitelistIds.length}
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-4">
            <h2 className="text-sm font-semibold text-zinc-100">{t("admin.blacklist")}</h2>
            <p className="mt-1 text-xs text-zinc-500">{t("admin.blacklistHint")}</p>
            <textarea
              value={blacklistText}
              onChange={(e) => setBlacklistText(e.target.value)}
              rows={8}
              placeholder="clientId-1\nclientId-2"
              className="mt-3 w-full rounded-2xl border border-zinc-800/80 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand/60"
            />
            <p className="mt-2 text-xs text-zinc-500">
              {t("admin.count")}: {blacklistIds.length}
            </p>
          </section>
        </>
      )}
    </main>
  );
}

