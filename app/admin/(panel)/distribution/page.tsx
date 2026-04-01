"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StoragePathDrawer } from "@/components/admin/storage-path-drawer";

export default function AdminDistributionPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState({ dramaId: "", status: "" });
  const [storageDrawerOpen, setStorageDrawerOpen] = useState(false);

  return (
    <main className="flex flex-col">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-extrabold text-zinc-100">
          {t("common.admin.distributionCenter")}
        </h1>
      </div>

      {/* 筛选与操作栏 */}
      <section className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400">
            {t("common.admin.distributionDramaId")}
          </label>
          <input
            type="text"
            value={filter.dramaId}
            onChange={(e) => setFilter({ ...filter, dramaId: e.target.value })}
            placeholder={t("common.admin.distributionPhInput")}
            className="mt-1 w-36 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-400">
            {t("common.admin.distributionStatus")}
          </label>
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className="mt-1 w-32 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="">{t("common.admin.distributionPhStatus")}</option>
            <option value="published">{t("common.admin.statusPublished")}</option>
            <option value="draft">{t("common.admin.statusDraft")}</option>
            <option value="off">{t("common.admin.statusOff")}</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilter({ dramaId: "", status: "" })}
            className="rounded-lg border border-zinc-600 bg-zinc-800/60 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700/60"
          >
            {t("common.admin.reset")}
          </button>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            {t("common.admin.query")}
          </button>
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
            {t("common.admin.distributionAdd")}
          </button>
          <button
            type="button"
            onClick={() => setStorageDrawerOpen(true)}
            className="rounded-lg border border-zinc-600 bg-zinc-800/60 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700/60"
          >
            {t("common.admin.storagePathManagement")}
          </button>
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
            {t("common.admin.distributionBatchPath")}
          </button>
        </div>
      </section>

      <StoragePathDrawer
        open={storageDrawerOpen}
        onClose={() => setStorageDrawerOpen(false)}
      />

      {/* 表格：固定表头 + 高度自适应 */}
      <section className="flex-1 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/60">
        <div className="max-h-[calc(100vh-280px)] min-h-[400px] overflow-auto">
          <table className="w-full min-w-[800px] border-collapse">
            <thead className="sticky top-0 z-10 border-b border-zinc-700/80 bg-zinc-900/95 backdrop-blur">
              <tr className="text-left text-xs text-zinc-400">
                <th className="px-4 py-3 font-semibold">
                  <input type="checkbox" className="rounded" />
                </th>
                <th className="px-4 py-3 font-semibold">{t("common.admin.distributionDramaId")}</th>
                <th className="px-4 py-3 font-semibold">{t("common.admin.distributionColName")}</th>
                <th className="px-4 py-3 font-semibold">{t("common.admin.distributionColChannel")}</th>
                <th className="px-4 py-3 font-semibold">{t("common.admin.distributionColTrack")}</th>
                <th className="px-4 py-3 font-semibold">{t("common.admin.distributionStatus")}</th>
                <th className="px-4 py-3 font-semibold">{t("common.admin.action")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-zinc-500">
                  {t("common.admin.distributionNoData")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
