"use client";

import { useEffect, useState } from "react";

interface RechargeRecord {
  id: string;
  uid: string;
  date: string;
  price: number;
  tier: string;
  createdAt?: string;
}

export default function AdminRechargePage() {
  const [records, setRecords] = useState<RechargeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ uid: "", date: "", price: 29.9, tier: "Monthly VIP" });

  const load = () => {
    fetch("/admin/api/recharge")
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && Array.isArray(json.records)) {
          setRecords(json.records);
        }
      })
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.uid || !form.date || !form.tier) return;
    const res = await fetch("/admin/api/recharge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: form.uid.trim(),
        date: form.date,
        price: Number(form.price),
        tier: form.tier.trim()
      })
    });
    const json = await res.json();
    if (json?.ok) {
      setForm({ ...form, uid: "", date: "", price: 29.9, tier: "Monthly VIP" });
      load();
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-100">Recharge Records</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Add recharge records manually. Users see these in My Wallet. UID comes from Users page.
      </p>

      <form onSubmit={handleAdd} className="mt-6 flex flex-wrap items-end gap-4 rounded-xl border border-zinc-700/80 bg-zinc-900/50 p-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400">UID</label>
          <input
            type="text"
            value={form.uid}
            onChange={(e) => setForm({ ...form, uid: e.target.value })}
            placeholder="e.g. 684991731"
            className="mt-1 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-400">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="mt-1 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-400">Price (USD)</label>
          <input
            type="number"
            step="0.01"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            className="mt-1 w-24 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-400">Tier</label>
          <select
            value={form.tier}
            onChange={(e) => setForm({ ...form, tier: e.target.value })}
            className="mt-1 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white"
          >
            <option value="Monthly VIP">Monthly VIP</option>
            <option value="Weekly VIP">Weekly VIP</option>
            <option value="Yearly VIP">Yearly VIP</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
        >
          Add Record
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-700/80 bg-zinc-900/50">
        {loading ? (
          <div className="p-8 text-center text-zinc-500">Loading...</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">No recharge records yet.</div>
        ) : (
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-zinc-700/80">
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">UID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">Tier</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">Time</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-zinc-800/60 last:border-0">
                  <td className="px-4 py-3 text-sm font-mono text-brand">{r.uid}</td>
                  <td className="px-4 py-3 text-sm text-white">{r.date}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-white">
                    ${r.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-300">{r.tier}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {r.createdAt ? new Date(r.createdAt).toLocaleTimeString() : "—"}
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
