"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface StoredUser {
  clientId: string;
  uid: string;
  createdAt: string;
}

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/admin/api/users")
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && Array.isArray(json.users)) {
          setUsers(json.users);
        }
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-100">{t("admin.usersTitle")}</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {t("admin.usersHint")}
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-700/80 bg-zinc-900/50">
        {loading ? (
          <div className="p-8 text-center text-zinc-500">{t("admin.loading")}</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">{t("admin.noUsersYet")}</div>
        ) : (
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-zinc-700/80">
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("admin.clientId")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">UID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("admin.created")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.clientId} className="border-b border-zinc-800/60 last:border-0">
                  <td className="px-4 py-3 text-sm text-white">{u.clientId}</td>
                  <td className="px-4 py-3 text-sm font-mono font-semibold text-brand">{u.uid}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(u.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
