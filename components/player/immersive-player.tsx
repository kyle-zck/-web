"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Episode, Series } from "@/constants/mock-data";
import { usePlayerStore, isEpisodeLocked } from "@/lib/store/player";
import { LockedOverlay } from "@/components/player/locked-overlay";
import { SubscriptionModal } from "@/components/player/subscription-modal";
import { useTranslation } from "react-i18next";
import type { AppLanguage } from "@/lib/i18n/languages";
import type { SubscriptionPlan } from "@/constants/mock-data";
import { getEpisodePlaybackUrl, isHlsUrl } from "@/lib/video/playback";
import { normalizeAssetUrl } from "@/lib/video/public-asset-url";

function toRuntimePlayableUrl(raw: string): string {
  const src = raw.trim();
  if (!src) return src;
  if (/^https?:\/\/[^/]+\.r2\.dev\/.+/i.test(src)) {
    return `/api/video/proxy?src=${encodeURIComponent(src)}`;
  }
  return src;
}

export function ImmersivePlayer({
  series,
  episode,
  sessionKey = 0
}: {
  series: Series;
  episode: Episode;
  sessionKey?: number;
}) {
  const playerRootRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const initialSeekAppliedKeyRef = useRef<string>("");
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;

  const { isEpisodeUnlocked, episodeIndex, setEpisodeIndex, saveProgress, getProgress, resetProgress } =
    usePlayerStore();

  const locked = isEpisodeLocked(series, episode);
  const unlocked = isEpisodeUnlocked(series, episode);
  const initialSeek = useMemo(
    () => getProgress(series.id, episode.index),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series.id, episode.index, sessionKey]
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
    setLoadFailed(false);
    initialSeekAppliedKeyRef.current = "";
  }, [episode.id, sessionKey]);

  useEffect(() => {
    const syncFullscreen = () => {
      const fs = document.fullscreenElement;
      const onPlayer =
        !!playerRootRef.current && (fs === playerRootRef.current || playerRootRef.current.contains(fs));
      const onVideo = fs === videoRef.current;
      document.body.classList.toggle("player-immersive-fullscreen", onPlayer || onVideo);
      document.body.classList.toggle("player-native-video-fullscreen", onVideo);
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.body.classList.remove("player-immersive-fullscreen");
      document.body.classList.remove("player-native-video-fullscreen");
    };
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    const id = window.setInterval(() => {
      const seconds = videoRef.current?.currentTime ?? 0;
      saveProgress(series.id, episode.index, seconds);
    }, 3000);
    return () => window.clearInterval(id);
  }, [episode.index, saveProgress, series.id, unlocked]);

  const goNext = () => {
    const nextIndex = episode.index + 1;
    const next = series.episodes.find((e) => e.index === nextIndex);
    if (!next) return;
    setEpisodeIndex(nextIndex);
  };

  const handleEnded = () => {
    // 确保“看完”的最终进度也会写入本地进度（Profile 同步到后台依赖 progressSeconds>0）
    if (unlocked && videoRef.current) {
      const seconds = videoRef.current.currentTime ?? 0;
      saveProgress(series.id, episode.index, seconds);
    }
    goNext();
  };

  const handleReady = () => {
    setLoadFailed(false);
    setReady(true);
    if (!unlocked) return;
    const seekKey = `${episode.id}::${playbackUrl}`;
    if (initialSeek > 0 && initialSeekAppliedKeyRef.current !== seekKey) {
      initialSeekAppliedKeyRef.current = seekKey;
      try {
        if (videoRef.current) {
          const current = videoRef.current.currentTime ?? 0;
          if (Math.abs(current - initialSeek) > 1) {
            videoRef.current.currentTime = initialSeek;
          }
        }
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
  const [runtimePlaybackUrl, setRuntimePlaybackUrl] = useState<string>(() =>
    getEpisodePlaybackUrl(episode)
  );
  const [runtimePlaybackIndex, setRuntimePlaybackIndex] = useState(0);
  const [runtimeVideoStatus, setRuntimeVideoStatus] = useState<
    "processing" | "ready" | "failed"
  >(episode.videoStatus ?? "ready");
  const playbackCandidates = useMemo(() => {
    const urls = [episode.videoPlaybackUrl, episode.videoUrl]
      .map((item) => normalizeAssetUrl(item) ?? "")
      .map((item) => toRuntimePlayableUrl(item))
      .map((item) => item.trim())
      .filter(Boolean);
    return Array.from(new Set(urls));
  }, [episode.videoPlaybackUrl, episode.videoUrl]);
  const playbackUrl = runtimePlaybackUrl;
  const hls = isHlsUrl(playbackUrl);

  const handleLoadError = () => {
    const nextIndex = runtimePlaybackIndex + 1;
    if (nextIndex < playbackCandidates.length) {
      setRuntimePlaybackIndex(nextIndex);
      setRuntimePlaybackUrl(playbackCandidates[nextIndex]);
      setLoadFailed(false);
      setReady(false);
      return;
    }
    setLoadFailed(true);
    setReady(false);
  };

  useEffect(() => {
    setRuntimePlaybackUrl(playbackCandidates[0] ?? getEpisodePlaybackUrl(episode));
    setRuntimePlaybackIndex(0);
    setRuntimeVideoStatus(episode.videoStatus ?? "ready");
  }, [episode, playbackCandidates]);

  useEffect(() => {
    if (!unlocked) return;
    if (runtimeVideoStatus !== "processing") return;
    if (!episode.videoStreamId) return;

    let cancelled = false;
    let tries = 0;
    const maxTries = 40;
    const timer = window.setInterval(async () => {
      if (cancelled) return;
      tries += 1;
      if (tries > maxTries) {
        window.clearInterval(timer);
        return;
      }
      try {
        const res = await fetch("/api/video/stream-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seriesId: series.id,
            episodeId: episode.id,
            streamId: episode.videoStreamId
          })
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          ok?: boolean;
          videoPlaybackUrl?: string;
          videoStatus?: "processing" | "ready" | "failed";
        };
        if (!json.ok) return;
        if (json.videoPlaybackUrl) {
          const resolved = normalizeAssetUrl(json.videoPlaybackUrl) ?? json.videoPlaybackUrl;
          setRuntimePlaybackUrl(toRuntimePlayableUrl(resolved));
          setRuntimePlaybackIndex(0);
        }
        if (json.videoStatus) setRuntimeVideoStatus(json.videoStatus);
        if (json.videoStatus === "ready" || json.videoStatus === "failed") {
          window.clearInterval(timer);
        }
      } catch {
        // ignore transient poll errors
      }
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [episode.id, episode.videoStreamId, runtimeVideoStatus, series.id, unlocked]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !unlocked) return;

    if (!hls) {
      video.src = playbackUrl;
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playbackUrl;
      return;
    }

    let disposed = false;
    let hlsInstance: {
      loadSource: (src: string) => void;
      attachMedia: (el: HTMLMediaElement) => void;
      destroy: () => void;
    } | null = null;

    import("hls.js")
      .then((m) => {
        if (disposed) return;
        const HlsCtor = m.default;
        if (!HlsCtor?.isSupported?.()) {
          video.src = playbackUrl;
          return;
        }
        hlsInstance = new HlsCtor({
          enableWorker: true,
          lowLatencyMode: false
        });
        hlsInstance.loadSource(playbackUrl);
        hlsInstance.attachMedia(video);
      })
      .catch(() => {
        video.src = playbackUrl;
      });

    return () => {
      disposed = true;
      if (hlsInstance) hlsInstance.destroy();
    };
  }, [hls, playbackUrl, unlocked, episode.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !unlocked) return;
    video.muted = true;
    void video.play().catch(() => {
      // Keep manual controls as fallback when autoplay is blocked.
    });
  }, [episode.id, playbackUrl, unlocked]);

  return (
    <section
      ref={playerRootRef}
      className="immersive-player-root relative h-full w-full min-h-0"
    >
      <div className="relative h-full w-full min-h-0 overflow-hidden rounded-none border-0 bg-[#000000] shadow-none ring-0">
        <video
          ref={videoRef}
          className="immersive-video-el h-full w-full object-cover"
          src={hls ? undefined : playbackUrl}
          controls={unlocked}
          playsInline
          muted
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          disableRemotePlayback
          autoPlay={unlocked}
          preload={unlocked ? "auto" : "metadata"}
          onCanPlay={handleReady}
          onError={handleLoadError}
          onEnded={handleEnded}
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

        {runtimeVideoStatus === "processing" && unlocked ? (
          <div className="absolute inset-0 grid place-items-center text-xs text-zinc-400">
            {t("loading")} · Transcoding...
          </div>
        ) : null}

        {(runtimeVideoStatus === "failed" || loadFailed) && unlocked ? (
          <div className="absolute inset-0 grid place-items-center px-6 text-center text-xs text-zinc-300">
            <div>
              <p className="font-medium">{t("loading")} failed</p>
              <p className="mt-1 text-zinc-400">
                Video source is unavailable. Please refresh status or replace URL.
              </p>
            </div>
          </div>
        ) : null}

        {!ready && !loadFailed && unlocked && runtimeVideoStatus !== "processing" ? (
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
