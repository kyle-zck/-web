"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "@/components/ui/toast";
import { translateAdminApiError } from "@/lib/admin/api-error";
import { fetchAdminJson } from "@/lib/admin/fetch-admin-json";

export type DramaCatalogItem = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onCatalogChange?: () => void;
};

export function DramaTagCatalogModal({ open, onClose, onCatalogChange }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<DramaCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  /** 输入框草稿 */
  const [filterDraft, setFilterDraft] = useState("");
  /** 点击「筛选」后生效的关键词 */
  const [filterApplied, setFilterApplied] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { res, json } = await fetchAdminJson<{ ok?: boolean; items?: DramaCatalogItem[] }>(
        "/admin/api/drama-tag-catalog"
      );
      if (res.ok && json?.ok && Array.isArray(json.items)) setItems(json.items);
      else setItems([]);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      load();
      setNewName("");
      setFilterDraft("");
      setFilterApplied("");
      setEditingId(null);
      setEditValue("");
    }
  }, [open, load]);

  const applyFilter = () => {
    setFilterApplied(filterDraft.trim());
  };

  const filtered = useMemo(() => {
    const q = filterApplied.toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, filterApplied]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      showToast(t("common.admin.tagNameRequiredToast"));
      return;
    }
    try {
      const { res, json } = await fetchAdminJson<{
        ok?: boolean;
        errorKey?: string;
        error?: string;
      }>("/admin/api/drama-tag-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", name })
      });
      if (!res.ok) {
        showToast(translateAdminApiError(json, t, "admin.tagAddFailed"));
        return;
      }
      if (!json?.ok) {
        showToast(translateAdminApiError(json, t, "admin.tagAddFailed"));
        return;
      }
      setNewName("");
      await load();
      onCatalogChange?.();
      showToast(t("common.admin.tagAdded"), "success");
    } catch {
      showToast(t("common.admin.networkErrorShort"));
    }
  };

  const startEdit = (item: DramaCatalogItem) => {
    setEditingId(item.id);
    setEditValue(item.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async (id: string) => {
    const name = editValue.trim();
    if (!name) {
      showToast(t("common.admin.tagNameEmpty"));
      return;
    }
    try {
      const { res, json } = await fetchAdminJson<{
        ok?: boolean;
        errorKey?: string;
        error?: string;
      }>("/admin/api/drama-tag-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id, name })
      });
      if (!res.ok) {
        showToast(translateAdminApiError(json, t, "admin.tagSaveFailed"));
        return;
      }
      if (!json?.ok) {
        showToast(translateAdminApiError(json, t, "admin.tagSaveFailed"));
        return;
      }
      cancelEdit();
      await load();
      onCatalogChange?.();
      showToast(t("common.admin.tagSaved"), "success");
    } catch {
      showToast(t("common.admin.networkErrorShort"));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = confirm(t("common.admin.confirmDeleteCatalogTag", { name }));
    if (!ok) return;
    try {
      const { res, json } = await fetchAdminJson<{
        ok?: boolean;
        errorKey?: string;
        error?: string;
      }>("/admin/api/drama-tag-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id })
      });
      if (!res.ok) {
        showToast(translateAdminApiError(json, t, "admin.deleteFailed"));
        return;
      }
      if (!json?.ok) {
        showToast(translateAdminApiError(json, t, "admin.deleteFailed"));
        return;
      }
      await load();
      onCatalogChange?.();
      showToast(t("common.admin.tagDeletedToast"), "success");
    } catch {
      showToast(t("common.admin.networkErrorShort"));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("common.admin.close")}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-base font-bold text-zinc-100">{t("common.admin.tagCatalogTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          <div>
            <p className="text-xs font-semibold text-zinc-400">{t("common.admin.tagCatalogAddSection")}</p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("common.admin.tagCatalogPhNew")}
                className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <button
                type="button"
                onClick={handleAdd}
                className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                {t("common.admin.addButton")}
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-zinc-400">{t("common.admin.tagCatalogFilterSection")}</p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={filterDraft}
                onChange={(e) => setFilterDraft(e.target.value)}
                placeholder={t("common.admin.tagCatalogPhFilter")}
                className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
                onKeyDown={(e) => e.key === "Enter" && applyFilter()}
              />
              <button
                type="button"
                onClick={applyFilter}
                className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
              >
                {t("common.admin.filterAction")}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40">
            <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-500">
              <span>{t("common.admin.tagCatalogNameCol")}</span>
              <span className="text-right">{t("common.admin.action")}</span>
            </div>
            {loading ? (
              <div className="px-3 py-8 text-center text-sm text-zinc-500">{t("common.admin.tableLoading")}</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-zinc-500">{t("common.admin.tagCatalogNoTags")}</div>
            ) : (
              <ul className="max-h-64 divide-y divide-zinc-800/80 overflow-y-auto">
                {filtered.map((item) => (
                  <li
                    key={item.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2.5 text-sm"
                  >
                    {editingId === item.id ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(item.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                    ) : (
                      <span className="truncate text-zinc-200" title={item.name}>
                        {item.name}
                      </span>
                    )}
                    <div className="flex shrink-0 justify-end gap-1.5">
                      {editingId === item.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveEdit(item.id)}
                            className="rounded-lg bg-blue-600/20 px-2 py-1 text-xs font-semibold text-blue-300 hover:bg-blue-600/30"
                          >
                            {t("common.admin.saveBtn")}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-lg border border-zinc-600 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
                          >
                            {t("common.admin.cancel")}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="rounded-lg bg-blue-600/20 px-2 py-1 text-xs font-semibold text-blue-300 hover:bg-blue-600/30"
                          >
                            {t("common.admin.edit")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id, item.name)}
                            className="rounded-lg border border-red-500/40 px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/15"
                          >
                            {t("common.admin.delete")}
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="border-t border-zinc-800 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-zinc-600 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800/80"
          >
            {t("common.admin.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
