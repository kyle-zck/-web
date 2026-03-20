"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Episode, Series } from "@/constants/mock-data";
import { usePlayerStore } from "@/lib/store/player";
import { Dialog } from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import type { AppLanguage } from "@/lib/i18n/languages";

const LOCK_COST = 10;

export function ImmersivePlayer({
  series,
  episode
}: {
  series: Series;
  episode: Episode;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const [lockedOpen, setLockedOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;

  const { isEpisodeUnlocked, unlockEpisode, episodeIndex, setEpisodeIndex, saveProgress, getProgress } =
    usePlayerStore();

  const unlocked = isEpisodeUnlocked(series, episode);
  const initialSeek = useMemo(
    () => getProgress(series.id, episode.index),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series.id, episode.index]
  );

  useEffect(() => {
    setReady(false);
    setLockedOpen(!unlocked);
  }, [episode.id, unlocked]);

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
    // 自动播放下一集：由外层根据 episodeIndex 变化切换 episode
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

  const handleUnlock = () => {
    const ok = unlockEpisode(series, episode, LOCK_COST);
    if (ok) setLockedOpen(false);
  };

  const handleTryNextFree = () => {
    // 如果当前锁定，尝试跳到下一集（可能仍锁），但符合“自动下一集/选集体验”
    goNext();
  };

  const episodeLabel =
    lang === "zh-CN"
      ? t("series.episodeLabelZh", { index: episode.index })
      : t("series.episodeLabel", { index: episode.index });

  const hint = episode.index <= 3 ? t("locked.hintFree") : t("locked.hintLocked", { cost: LOCK_COST });

  return (
    <section className="relative h-full w-full min-h-0">
      <div className="relative h-full w-full min-h-0 overflow-hidden rounded-none border-0 bg-[#000000] shadow-none ring-0">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          src={episode.videoUrl}
          controls
          playsInline
          muted
          autoPlay={unlocked}
          onCanPlay={handleReady}
          onEnded={handleEnded}
          onTimeUpdate={() => {
            if (!unlocked) return;
            const seconds = videoRef.current?.currentTime ?? 0;
            saveProgress(series.id, episode.index, seconds);
          }}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-black/80 via-black/30 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        <div className="absolute left-3 top-3 z-20 rounded-full bg-black/65 px-3 py-1 text-[11px] font-medium text-zinc-200 ring-1 ring-zinc-800/80">
          {episodeLabel} · {hint}
        </div>

        {!ready ? (
          <div className="absolute inset-0 grid place-items-center text-xs text-zinc-400">
            {t("loading")}
          </div>
        ) : null}
      </div>

      <Dialog
        open={lockedOpen}
        onClose={() => setLockedOpen(false)}
        title={t("locked.title")}
        footer={
          <div className="flex gap-2">
            <button
              onClick={handleUnlock}
              className="flex-1 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white"
            >
              {t("locked.unlock", { cost: LOCK_COST })}
            </button>
            <button
              onClick={handleTryNextFree}
              className="rounded-full bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-100 ring-1 ring-zinc-800/80"
            >
              {t("locked.next")}
            </button>
          </div>
        }
      >
        <p className="text-sm text-zinc-200">{t("locked.body", { index: episode.index })}</p>
      </Dialog>

      {/* 同步外层选集：当自动下一集触发 episodeIndex 变化时，父组件会切换 episode */}
      <input type="hidden" value={episodeIndex} readOnly />
    </section>
  );
}

