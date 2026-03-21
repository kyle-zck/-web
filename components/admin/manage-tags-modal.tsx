"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "@/components/ui/toast";
import { translateAdminApiError } from "@/lib/admin/api-error";

interface TagCategory {
  id: string;
  nameZh: string;
  nameEn: string;
  nameJp: string;
}

interface Tag {
  id: string;
  nameZh: string;
  nameEn: string;
  nameJp: string;
  categoryId: string;
}

const TAG_LANG_FIELDS = ["nameZh", "nameEn", "nameJp"] as const;
const LABEL_KEY_BY_FIELD: Record<(typeof TAG_LANG_FIELDS)[number], string> = {
  nameZh: "langLabelZh",
  nameEn: "langLabelEn",
  nameJp: "langLabelJp"
};

function categoryDisplayName(c: TagCategory, lang: string): string {
  const l = (lang || "en").toLowerCase();
  if (l.startsWith("zh")) return c.nameZh;
  if (l.startsWith("ja")) return c.nameJp?.trim() ? c.nameJp : c.nameEn || c.nameZh;
  return c.nameEn?.trim() ? c.nameEn : c.nameZh;
}

interface ManageTagsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ManageTagsModal({ open, onClose }: ManageTagsModalProps) {
  const { t, i18n } = useTranslation();
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Tag | null>(null);
  const [newCategory, setNewCategory] = useState<"theme" | "role" | "plot" | "">("");

  const load = async () => {
    const res = await fetch("/admin/api/tags");
    const json = await res.json();
    if (json?.ok) {
      setCategories(json.categories ?? []);
      setTags(json.tags ?? []);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const addCategory = async () => {
    const map: Record<string, { id: string; nameZh: string; nameEn: string }> = {
      theme: { id: "theme", nameZh: "题材", nameEn: "Theme" },
      role: { id: "role", nameZh: "角色", nameEn: "Role" },
      plot: { id: "plot", nameZh: "情节", nameEn: "Plot" }
    };
    const c = newCategory && map[newCategory];
    if (!c || categories.some((x) => x.id === c.id)) {
      showToast(t("admin.tagLibCategoryExists"));
      return;
    }
    const res = await fetch("/admin/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "addCategory",
        ...c,
        nameJp: c.id === "theme" ? "テーマ" : c.id === "role" ? "役" : "プロット"
      })
    });
    const json = await res.json();
    if (json?.ok) {
      load();
      setNewCategory("");
    } else {
      showToast(translateAdminApiError(json, t, "admin.tagLibAddCategoryFailed"));
    }
  };

  const addTag = async (categoryId: string) => {
    const nameZh = window.prompt(t("admin.tagLibPromptTagName"));
    if (!nameZh?.trim()) return;
    const res = await fetch("/admin/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "addTag",
        nameZh: nameZh.trim(),
        nameEn: nameZh.trim(),
        nameJp: "",
        categoryId
      })
    });
    const json = await res.json();
    if (json?.ok) {
      load();
    } else {
      showToast(translateAdminApiError(json, t, "admin.tagLibAddTagFailed"));
    }
  };

  const deleteTag = async (id: string) => {
    if (!window.confirm(t("admin.tagLibConfirmDeleteTag"))) return;
    const res = await fetch("/admin/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteTag", id })
    });
    const json = await res.json();
    if (json?.ok) load();
    else showToast(translateAdminApiError(json, t, "admin.tagLibDeleteFailed"));
  };

  const filteredTags = filter
    ? tags.filter(
        (tagItem) =>
          tagItem.nameZh.toLowerCase().includes(filter.toLowerCase()) ||
          tagItem.nameEn.toLowerCase().includes(filter.toLowerCase())
      )
    : tags;

  const getCategoryName = (id: string) => {
    const c = categories.find((x) => x.id === id);
    return c ? categoryDisplayName(c, i18n.language) : id;
  };

  if (!open) return null;

  const newCatOptionLabel: Record<"theme" | "role" | "plot", string> = {
    theme: t("admin.tagLibNewCatTheme"),
    role: t("admin.tagLibNewCatRole"),
    plot: t("admin.tagLibNewCatPlot")
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-800/80 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800/80 p-4">
          <h2 className="text-lg font-bold text-zinc-100">{t("admin.tagLibTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-400">
                {t("admin.tagLibFilterLabel")}
              </label>
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t("admin.tagLibFilterPh")}
                className="mt-1 w-40 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
            <button
              type="button"
              onClick={() => load()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              {t("admin.query")}
            </button>
            <div className="ml-auto flex gap-2">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as typeof newCategory)}
                className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">{t("admin.tagLibNewCategorySelect")}</option>
                <option value="theme">{newCatOptionLabel.theme}</option>
                <option value="role">{newCatOptionLabel.role}</option>
                <option value="plot">{newCatOptionLabel.plot}</option>
              </select>
              <button
                type="button"
                onClick={addCategory}
                disabled={!newCategory}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {t("admin.tagLibAddCategoryBtn")}
              </button>
            </div>
          </div>

          <div className="max-h-[400px] overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-zinc-900/95">
                <tr className="text-left text-xs text-zinc-400">
                  <th className="px-4 py-3 font-semibold">{t("admin.tagLibColNameZh")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.tagLibColCategory")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.action")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredTags.map((tag) => (
                  <tr key={tag.id} className="border-t border-zinc-800/60">
                    <td className="px-4 py-3 text-sm text-zinc-100">
                      {tag.nameZh}
                      {tag.nameEn && (
                        <span className="ml-2 text-zinc-500">({tag.nameEn})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {getCategoryName(tag.categoryId)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(tag)}
                          className="text-sm font-medium text-blue-400 hover:text-blue-300"
                        >
                          {t("admin.edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTag(tag.id)}
                          className="text-sm font-medium text-red-400 hover:text-red-300"
                        >
                          {t("admin.delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredTags.length && (
              <div className="py-12 text-center text-sm text-zinc-500">{t("admin.tagLibNoTags")}</div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800/60 pt-4">
            <div className="flex gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => addTag(c.id)}
                  className="rounded-lg border border-zinc-600 bg-zinc-800/60 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700/60"
                >
                  {t("admin.tagLibAddUnder", { name: categoryDisplayName(c, i18n.language) })}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                const data = JSON.stringify({ categories, tags }, null, 2);
                const blob = new Blob([data], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `tags-i18n-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                showToast(t("admin.tagLibExportedToast"), "success");
              }}
              className="rounded-lg border border-emerald-600/60 bg-emerald-600/20 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-600/30"
            >
              {t("admin.tagLibExportJson")}
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <EditTagModal
          tag={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            load();
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function EditTagModal({
  tag,
  categories,
  onClose,
  onSaved
}: {
  tag: Tag;
  categories: TagCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState(tag);

  const save = async () => {
    const res = await fetch("/admin/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateTag",
        id: tag.id,
        nameZh: form.nameZh,
        nameEn: form.nameEn,
        nameJp: form.nameJp,
        categoryId: form.categoryId
      })
    });
    const json = await res.json();
    if (json?.ok) onSaved();
    else showToast(translateAdminApiError(json, t, "admin.saveFailed"));
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60" onClick={onClose} aria-hidden />
      <div className="fixed left-1/2 top-1/2 z-[61] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <h3 className="mb-4 text-base font-bold text-zinc-100">{t("admin.tagLibEditTag")}</h3>
        <div className="space-y-3">
          {TAG_LANG_FIELDS.map((field) => (
            <div key={field}>
              <label className="block text-xs font-semibold text-zinc-400">
                {t(`admin.${LABEL_KEY_BY_FIELD[field]}`)}
              </label>
              <input
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-zinc-400">
              {t("admin.tagLibFieldCategory")}
            </label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryDisplayName(c, i18n.language)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
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
            {t("admin.tagLibConfirmBtn")}
          </button>
        </div>
      </div>
    </>
  );
}
