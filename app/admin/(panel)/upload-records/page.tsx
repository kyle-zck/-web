"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  getAllUploadSessions,
  deleteUploadSession,
  isBackgroundUploadSupported
} from "@/lib/upload/background-upload-db";
import { backgroundUploadManager } from "@/lib/upload/background-upload-manager";
import { showToast } from "@/components/ui/toast";

const BG_UPLOAD_CHANNEL = "bg-upload-channel";

interface UploadFileRecord {
  fileName: string;
  fileSize: number;
  fileType: string;
  index: number;
  stage: string;
  percent: number;
  uploadUrl?: string;
  publicUrl?: string;
  key?: string;
  retryCount: number;
  error?: string;
}

interface UploadSessionRecord {
  id: string;
  ownerTabId: string | null;
  lastHeartbeat: number;
  formData: {
    title: string;
    originalName: string;
    totalEpisodes: number;
    listed: boolean;
    coverUrl: string;
    tagIds: string[];
  };
  files: UploadFileRecord[];
  status: string;
  currentIndex: number;
  createdAt: number;
  updatedAt: number;
  serverSeriesId?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function StageBadge({ stage }: { stage: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    done: { bg: "bg-emerald-500/20 text-emerald-400", text: "✓" },
    uploading: { bg: "bg-blue-500/20 text-blue-400", text: "↑" },
    presign: { bg: "bg-amber-500/20 text-amber-400", text: "◎" },
    completing: { bg: "bg-purple-500/20 text-purple-400", text: "⚙" },
    failed: { bg: "bg-red-500/20 text-red-400", text: "✕" },
    queued: { bg: "bg-zinc-500/20 text-zinc-400", text: "○" },
  };
  const s = map[stage] ?? { bg: "bg-zinc-500/20 text-zinc-400", text: stage };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.bg}`}>
      <span>{s.text}</span>
      {stage}
    </span>
  );
}

function SessionRow({ session }: { session: UploadSessionRecord }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const doneCount = session.files.filter((f) => f.stage === "done").length;
  const failCount = session.files.filter((f) => f.stage === "failed").length;
  const totalSize = session.files.reduce((sum, f) => sum + f.fileSize, 0);

  const statusColor: Record<string, string> = {
    completed: "text-emerald-400",
    uploading: "text-blue-400",
    pending: "text-amber-400",
    paused: "text-zinc-400",
    failed: "text-red-400",
  };

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/30 transition text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <svg
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100 truncate">
            {session.formData.title || session.id}
          </p>
          <p className="text-[11px] text-zinc-500 truncate">
            {session.formData.originalName}
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-xs text-zinc-400 shrink-0">
          <span className="font-medium">
            {doneCount}/{session.files.length}
            <span className="font-normal text-zinc-600"> files</span>
          </span>
          {failCount > 0 && (
            <span className="text-red-400 font-medium">{failCount} failed</span>
          )}
          <span className="text-zinc-500">{formatBytes(totalSize)}</span>
        </div>

        <span className={`text-xs font-semibold shrink-0 ${statusColor[session.status] ?? "text-zinc-400"}`}>
          {t(`common.admin.uploadStatus_${session.status}`)}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-zinc-800/60 px-4 py-3 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-zinc-500 mb-3">
            <div>
              <span className="text-zinc-600">ID</span>
              <p className="text-zinc-400 font-mono truncate">{session.id}</p>
            </div>
            <div>
              <span className="text-zinc-600">Created</span>
              <p className="text-zinc-400">{formatDate(session.createdAt)}</p>
            </div>
            <div>
              <span className="text-zinc-600">Updated</span>
              <p className="text-zinc-400">{formatDate(session.updatedAt)}</p>
            </div>
            <div>
              <span className="text-zinc-600">Series</span>
              <p className={`text-zinc-400 ${session.serverSeriesId ? "text-emerald-400" : ""}`}>
                {session.serverSeriesId ? `ID: ${session.serverSeriesId}` : "Not created"}
              </p>
            </div>
          </div>

          <table className="w-full min-w-[400px]">
            <thead>
              <tr className="border-b border-zinc-800/60">
                <th className="pb-2 text-left text-[11px] font-semibold text-zinc-500">#</th>
                <th className="pb-2 text-left text-[11px] font-semibold text-zinc-500">File</th>
                <th className="pb-2 text-left text-[11px] font-semibold text-zinc-500">Size</th>
                <th className="pb-2 text-left text-[11px] font-semibold text-zinc-500">Stage</th>
                <th className="pb-2 text-left text-[11px] font-semibold text-zinc-500">Retries</th>
                <th className="pb-2 text-left text-[11px] font-semibold text-zinc-500">Error</th>
                <th className="pb-2 text-left text-[11px] font-semibold text-zinc-500">Key</th>
              </tr>
            </thead>
            <tbody>
              {session.files
                .slice()
                .sort((a, b) => a.index - b.index)
                .map((f) => (
                  <tr key={f.index} className="border-b border-zinc-800/40 last:border-0">
                    <td className="py-2 text-xs text-zinc-500">{f.index + 1}</td>
                    <td className="py-2 text-xs text-zinc-300 max-w-[200px] truncate" title={f.fileName}>
                      {f.fileName}
                    </td>
                    <td className="py-2 text-xs text-zinc-500">{formatBytes(f.fileSize)}</td>
                    <td className="py-2"><StageBadge stage={f.stage} /></td>
                    <td className="py-2 text-xs text-zinc-500">{f.retryCount}</td>
                    <td className="py-2 text-xs text-red-400 max-w-[150px] truncate" title={f.error}>
                      {f.error || "—"}
                    </td>
                    <td className="py-2 text-xs text-zinc-600 font-mono max-w-[100px] truncate" title={f.key}>
                      {f.key ? f.key.split("/").pop() : "—"}
                    </td>
                    <td className="py-2">
                      {f.stage === "failed" && bgSupported ? (
                        <div className="flex items-center gap-1">
                          <label
                            title={t("common.admin.reuploadFile")}
                            className={[
                              "flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition",
                              reuploadSessionId === session.id && reuploadFileIdx === f.index
                                ? "border-amber-500/50 bg-amber-500/10 text-amber-400 opacity-60 cursor-not-allowed"
                                : "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                            ].join(" ")}
                          >
                            <input
                              ref={(el) => { fileInputRef.current[`${session.id}-${f.index}`] = el; }}
                              type="file"
                              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.mkv"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) await handleReuploadFile(session.id, f.index, file);
                                e.target.value = "";
                              }}
                            />
                            {reuploadSessionId === session.id && reuploadFileIdx === f.index
                              ? "..."
                              : t("common.admin.reupload")}
                          </label>
                          <button
                            title={t("common.admin.retry")}
                            onClick={() => {
                              const el = fileInputRef.current[`${session.id}-${f.index}`];
                              if (el) el.click();
                            }}
                            className="rounded-lg border border-zinc-600 px-2 py-1 text-[10px] font-semibold text-zinc-300 hover:bg-zinc-700/60"
                          >
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        </div>
                      ) : f.stage === "failed" ? (
                        <span className="text-[10px] text-red-400">{"—"}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminUploadRecordsPage() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<UploadSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "done" | "failed">("all");
  const [bgSupported, setBgSupported] = useState(false);
  const [reuploadSessionId, setReuploadSessionId] = useState<string | null>(null);
  const [reuploadFileIdx, setReuploadFileIdx] = useState<number | null>(null);
  const fileInputRef = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await getAllUploadSessions();
      setSessions(all.slice().sort((a, b) => b.createdAt - a.createdAt));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load records");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const supported = await isBackgroundUploadSupported();
      if (mounted) setBgSupported(supported);
    };
    init();
    return () => { mounted = false; };
  }, []);

  useEffect(() => { load(); }, [load]);

  // Subscribe to upload events so the page auto-refreshes when sessions change.
  useEffect(() => {
    const ch = new BroadcastChannel(BG_UPLOAD_CHANNEL);
    ch.onmessage = () => { load(); };
    return () => { ch.close(); };
  }, [load]);

  const handleReuploadFile = async (sessionId: string, fileIndex: number, file: File) => {
    setReuploadSessionId(sessionId);
    setReuploadFileIdx(fileIndex);
    try {
      await backgroundUploadManager.reuploadFile(sessionId, fileIndex, file);
      showToast(t("common.admin.fileReuploadStarted"), "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("common.admin.networkErrorShort"), "error");
    } finally {
      setReuploadSessionId(null);
      setReuploadFileIdx(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("common.admin.confirmDeleteUploadRecord") ?? "Delete this record?")) return;
    await deleteUploadSession(id);
    await load();
  };

  const filtered = sessions.filter((s) => {
    if (filter === "active") return s.status === "pending" || s.status === "uploading";
    if (filter === "done") return s.status === "completed";
    if (filter === "failed") return s.status === "failed";
    return true;
  });

  const statCards = [
    {
      label: t("common.admin.totalUploadSessions"),
      value: sessions.length,
      color: "text-zinc-100",
    },
    {
      label: t("common.admin.activeUploadSessions"),
      value: sessions.filter((s) => s.status === "pending" || s.status === "uploading").length,
      color: "text-blue-400",
    },
    {
      label: t("common.admin.completedSessions"),
      value: sessions.filter((s) => s.status === "completed").length,
      color: "text-emerald-400",
    },
    {
      label: t("common.admin.failedSessions"),
      value: sessions.filter((s) => s.status === "failed").length,
      color: "text-red-400",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">{t("common.admin.uploadRecords")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("common.admin.uploadRecordsHint")}</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-50"
        >
          <svg className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {t("common.admin.refresh")}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-3">
            <p className="text-[11px] text-zinc-500">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2 flex-wrap">
        {(["all", "active", "done", "failed"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === f
                ? "bg-brand text-white"
                : "border border-zinc-700 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {t(`common.admin.uploadFilter_${f}`)}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-12 text-center text-zinc-500">
            {t("common.admin.loading")}...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-12 text-center text-zinc-500">
            {t("common.admin.noUploadRecords")}
          </div>
        ) : (
          filtered.map((session) => (
            <div key={session.id} className="flex gap-2 items-start">
              <div className="flex-1">
                <SessionRow session={session} />
              </div>
              <button
                type="button"
                title={t("common.admin.deleteRecord")}
                onClick={() => handleDelete(session.id)}
                className="mt-3 shrink-0 rounded-lg border border-zinc-700/60 bg-zinc-900/50 p-2 text-zinc-500 hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400 transition"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
