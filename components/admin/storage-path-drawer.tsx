"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { showToast } from "@/components/ui/toast";

interface StoragePath {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
}

interface StoragePathDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function StoragePathDrawer({ open, onClose }: StoragePathDrawerProps) {
  const { t } = useTranslation();
  const [paths, setPaths] = useState<StoragePath[]>([]);

  const load = async () => {
    try {
      const res = await fetch("/admin/api/storage-paths");
      const json = await res.json();
      if (json?.ok && Array.isArray(json.paths)) {
        setPaths(json.paths);
      }
    } catch {
      setPaths([]);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const updatePath = (index: number, patch: Partial<StoragePath>) => {
    const next = [...paths];
    next[index] = { ...next[index], ...patch };
    setPaths(next);
  };

  const save = async () => {
    for (const p of paths) {
      if (!p.baseUrl?.trim()) {
        showToast(t("admin.pathEmptyToast"));
        return;
      }
    }
    try {
      const res = await fetch("/admin/api/storage-paths", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths })
      });
      const json = await res.json();
      if (json?.ok) {
        showToast(t("admin.pathSavedToast"), "success");
        onClose();
      } else {
        showToast(json?.error ?? t("admin.pathSaveFailedToast"));
      }
    } catch {
      showToast(t("admin.networkErrorShort"));
    }
  };

  const addPath = () => {
    setPaths([
      ...paths,
      { id: `p${Date.now()}`, name: t("admin.newPathDefault"), baseUrl: "", enabled: true }
    ]);
  };

  const removePath = (index: number) => {
    setPaths(paths.filter((_, i) => i !== index));
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-zinc-950 shadow-2xl",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-800/80 p-4">
          <h2 className="text-lg font-bold text-zinc-100">
            {t("admin.storagePathManagement")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <p className="mb-4 text-xs text-zinc-500">{t("admin.storagePathHint")}</p>
          <div className="space-y-4">
            {paths.map((p, i) => (
              <div
                key={p.id}
                className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4"
              >
                <div className="flex items-center justify-between">
                  <input
                    value={p.name}
                    onChange={(e) => updatePath(i, { name: e.target.value })}
                    placeholder={t("admin.namePh")}
                    className="w-32 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
                  />
                  <button
                    type="button"
                    onClick={() => removePath(i)}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    {t("admin.delete")}
                  </button>
                </div>
                <input
                  value={p.baseUrl}
                  onChange={(e) => updatePath(i, { baseUrl: e.target.value })}
                  placeholder="https://cdn.example.com/video/"
                  className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
                />
                <label className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={(e) => updatePath(i, { enabled: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-xs text-zinc-400">{t("admin.enabledLabel")}</span>
                </label>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addPath}
            className="mt-4 w-full rounded-lg border border-dashed border-zinc-600 py-3 text-sm font-semibold text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
          >
            {t("admin.addPathBtn")}
          </button>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-800/80 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-300"
          >
            {t("admin.cancel")}
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            {t("admin.save")}
          </button>
        </div>
      </div>
    </>
  );
}
