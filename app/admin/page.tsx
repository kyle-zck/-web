"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { useAdminSeriesStore } from "@/lib/store/admin-series";

function hashScore(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) % 1000;
  return h;
}

export default function AdminDashboardPage() {
  const { series } = useAdminSeriesStore();
  const [brandName, setBrandName] = useState("ReelShorts");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/admin/api/app-config")
      .then((r) => r.json())
      .then((json) => {
        if (json?.brandName) setBrandName(json.brandName);
      })
      .catch(() => {});
  }, []);

  const saveConfig = async () => {
    try {
      setSaving(true);
      await fetch("/admin/api/app-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName, tagline })
      });
    } finally {
      setSaving(false);
    }
  };

  const topTrending = useMemo(() => {
    return [...series]
      .map((s) => ({ id: s.id, title: s.title, cover: s.cover, score: hashScore(s.id) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [series]);

  const revenueData = [
    { day: "Mon", revenue: 2200 },
    { day: "Tue", revenue: 2600 },
    { day: "Wed", revenue: 2400 },
    { day: "Thu", revenue: 2900 },
    { day: "Fri", revenue: 3100 },
    { day: "Sat", revenue: 2750 },
    { day: "Sun", revenue: 3300 }
  ];

  const retentionData = [
    { label: "D1", value: 62 },
    { label: "D7", value: 41 },
    { label: "D30", value: 18 }
  ];

  return (
    <main>
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-zinc-100">Admin Dashboard</h1>
            <p className="mt-1 text-xs text-zinc-400">
              Internal metrics UI（示例数据 + 本地存储）
            </p>
          </div>
          <Badge variant="pill" className="bg-zinc-900 text-zinc-200 ring-1 ring-zinc-700">
            App Branding Config
          </Badge>
        </div>

        {/* App 品牌配置：Navbar Logo & 标题文案 */}
        <section className="rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          <h2 className="text-sm font-semibold text-zinc-100">Branding</h2>
          <p className="mt-1 text-xs text-zinc-500">
            设置导航栏左侧的 Logo 文本与副标题，保存后会同步到前台网站。
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              Brand name
              <input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="rounded-2xl border border-zinc-800/80 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand/60"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={saveConfig}
            disabled={saving}
            className="mt-3 inline-flex items-center rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save branding"}
          </button>
        </section>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">Daily Revenue</h2>
            <p className="text-xs text-zinc-500">Last 7 days</p>
          </div>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData} margin={{ top: 10, left: 0, right: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="day" stroke="#a1a1aa" fontSize={12} />
                <YAxis stroke="#a1a1aa" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "#0a0a0a",
                    border: "1px solid rgba(63,63,70,0.8)",
                    borderRadius: 12
                  }}
                  formatter={(value: unknown) => [`$${value}`, "Revenue"]}
                />
                <Line type="monotone" dataKey="revenue" stroke="#7C3AED" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">User Retention</h2>
            <p className="text-xs text-zinc-500">示例漏斗</p>
          </div>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={retentionData} margin={{ top: 10, left: 0, right: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} />
                <YAxis stroke="#a1a1aa" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "#0a0a0a",
                    border: "1px solid rgba(63,63,70,0.8)",
                    borderRadius: 12
                  }}
                  formatter={(value: unknown) => [`${value}%`, "Retention"]}
                />
                <Bar dataKey="value" fill="#7C3AED" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">Top 5 Trending Dramas</h2>
          <p className="text-xs text-zinc-500">Based on local series list</p>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {topTrending.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-2xl border border-zinc-800/80 bg-black/20 p-3"
            >
              <div className="relative h-14 w-10 overflow-hidden rounded-xl border border-zinc-800/80">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.cover} alt={s.title} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0">
                <p className="line-clamp-1 text-xs font-semibold text-zinc-100">{s.title}</p>
                <p className="mt-1 text-[11px] text-zinc-500">Score: {s.score}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

