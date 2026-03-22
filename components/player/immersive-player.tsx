"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Episode, Series } from "@/constants/mock-data";
import { usePlayerStore, isEpisodeLocked } from "@/lib/store/player";
import { LockedOverlay } from "@/components/player/locked-overlay";
import { SubscriptionModal } from "@/components/player/subscription-modal";
import { useTranslation } from "react-i18next";
import type { AppLanguage } from "@/lib/i18n/languages";
import type { SubscriptionPlan } from "@/constants/mock-data";

export function ImmersivePlayer({
  series,
  episode
}: {
  series: Series;
  episode: Episode;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;

  const { isEpisodeUnlocked, episodeIndex, setEpisodeIndex, saveProgress, getProgress } =
    usePlayerStore();

  const locked = isEpisodeLocked(series, episode);
  const unlocked = isEpisodeUnlocked(series, episode);
  const initialSeek = useMemo(
    () => getProgress(series.id, episode.index),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series.id, episode.index]
  );

  /** 延后拉订阅套餐，避免与首帧视频抢带宽/主线程 */
  useEffect(() => {
    const run = () => {
      fetch("/api/app-config")
        .then((r) => r.json())
        .then((json) => setPlans(json.subscriptionPlans ?? []))
        .catch(() => setPlans([]));
    };
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = globalThis.setTimeout(run, 300);
    return () => globalThis.clearTimeout(t);
  }, []);

  useEffect(() => {
    setReady(false);
  }, [episode.id]);

  useEffect(() => {
    if (!unlocked) return;
    const id = window.setInterval(() => {
      const seconds = videoRef.current?.currentTime ?? 0;
      saveProgress(series.id, episode.index, seconds);
    }, 1500);
    return () => window.clearInterval(id);
  }, [episode.index, saveProgress, series.id, unlocked]);

  const goNext = () => {
    const nextIndex = episode.index + 1;
    const next = series.episodes.find((e) => e.index === nextIndex);
    if (!next) return;
    setEpisodeIndex(nextIndex);
  };

  const handleEnded = () => {
    goNext();
  };

  const handleReady = () => {
    setReady(true);
    if (!unlocked) return;
    if (initialSeek > 0) {
      try {
        if (videoRef.current) videoRef.current.currentTime = initialSeek;
      } catch {
        // ignore
      }
    }
  };

  const episodeLabel =
    lang === "zh-CN"
      ? t("series.episodeLabelZh", { index: episode.index })
      : t("series.episodeLabel", { index: episode.index });

  const hint = unlocked
    ? t("locked.hintFree", "FREE")
    : t("locked.hintLocked", "Subscribe to unlock");

  return (
    <section className="relative h-full w-full min-h-0">
      <div className="relative h-full w-full min-h-0 overflow-hidden rounded-none border-0 bg-[#000000] shadow-none ring-0">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          src={episode.videoUrl}
          controls={unlocked}
          playsInline
          muted
          autoPlay={unlocked}
          preload={unlocked ? "auto" : "metadata"}
          onCanPlay={handleReady}
          onEnded={handleEnded}
          onTimeUpdate={() => {
            if (!unlocked) return;
            const seconds = videoRef.current?.currentTime ?? 0;
            saveProgress(series.id, episode.index, seconds);
          }}
          style={locked ? { pointerEvents: "none" } : undefined}
        />

        {locked && (
          <LockedOverlay onUnlock={() => setSubscriptionModalOpen(true)} />
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-black/80 via-black/30 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-black/65 px-3 py-1 text-[11px] font-medium text-zinc-200 ring-1 ring-zinc-800/80">
          {episodeLabel} · {hint}
        </div>

        {!ready && unlocked ? (
          <div className="absolute inset-0 grid place-items-center text-xs text-zinc-400">
            {t("loading")}
          </div>
        ) : null}
      </div>

      <SubscriptionModal
        open={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        plans={plans}
      />

      <input type="hidden" value={episodeIndex} readOnly />
    </section>
  );
}
