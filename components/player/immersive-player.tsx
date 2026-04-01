"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Episode, Series } from "@/constants/mock-data";
import { isEpisodeLocked, usePlayerStore } from "@/lib/store/player";
import { LockedOverlay } from "@/components/player/locked-overlay";
import { useTranslation } from "react-i18next";
import type { AppLanguage } from "@/lib/i18n/languages";
import {
  buildMp4FirstCandidates,
  getEpisodePlaybackUrl,
  playbackUrlIndicatesHls,
  resolveNormalizedPlayableUrl
} from "@/lib/video/playback";
import { resolvePublicImageUrl } from "@/lib/video/public-asset-url";
import { attachHls, supportsNativeHls } from "@/lib/video/hls-loader";

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
  const router = useRouter();
  const initialSeekAppliedKeyRef = useRef<string>("");
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;

  const isSubscribed = usePlayerStore((s) => s.isSubscribed);
  const { episodeIndex, setEpisodeIndex, saveProgress, getProgress, resetProgress } =
    usePlayerStore();

  /** 与侧栏选集一致：订阅或免费/未达锁定集 → 可播；显式依赖 isSubscribed 避免订阅态更新未触发重渲染 */
  const unlocked = isSubscribed || !isEpisodeLocked(series, episode);
  const initialSeek = useMemo(
    () => getProgress(series.id, episode.index),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series.id, episode.index, sessionKey]
  );

  useEffect(() => {
    setReady(false);
    setLoadFailed(false);
    initialSeekAppliedKeyRef.current = "";
  }, [episode.id, sessionKey]);

  // 锁定态下由 LockedOverlay 承接用户点击，不自动弹出 SubscriptionModal

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
      ? t("common.series.episodeLabelZh", { index: episode.index })
      : t("common.series.episodeLabel", { index: episode.index });

  const lockPreviewPosterUrl = useMemo(() => {
    for (const raw of [episode.thumbnail, series.poster, series.cover]) {
      const resolved = resolvePublicImageUrl((raw ?? "").trim());
      if (resolved) return resolved;
    }
    return "";
  }, [episode.thumbnail, series.poster, series.cover]);
  const playbackPosterUrl = lockPreviewPosterUrl;
  const [runtimePlaybackUrl, setRuntimePlaybackUrl] = useState<string>(() =>
    getEpisodePlaybackUrl(episode)
  );
  const [runtimePlaybackIndex, setRuntimePlaybackIndex] = useState(0);
  const [runtimeVideoStatus, setRuntimeVideoStatus] = useState<
    "processing" | "ready" | "failed"
  >(episode.videoStatus ?? "ready");
  const playbackCandidates = useMemo(
    () => buildMp4FirstCandidates(episode),
    [episode]
  );
  const playbackUrl = runtimePlaybackUrl;
  const hls = playbackUrlIndicatesHls(playbackUrl);

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
          setRuntimePlaybackUrl(resolveNormalizedPlayableUrl(json.videoPlaybackUrl));
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
    if (!video) return;

    if (!unlocked) {
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {
        /* ignore */
      }
      return;
    }

    if (!hls) {
      video.src = playbackUrl;
      return;
    }

    if (supportsNativeHls(video)) {
      video.src = playbackUrl;
      return;
    }

    let disposed = false;
    let hlsInstance: { destroy: () => void } | null = null;
    attachHls(video, playbackUrl)
      .then((result) => {
        if (disposed) {
          result?.hls.destroy();
          return;
        }
        hlsInstance = result?.hls ?? null;
        // Fallback: if HLS not supported (result === null), the video src was already set
      })
      .catch(() => {
        if (disposed) return;
        video.src = playbackUrl;
      });

    return () => {
      disposed = true;
      if (hlsInstance) hlsInstance.destroy();
    };
  }, [hls, playbackUrl, unlocked, episode.id]);

  // 预连接媒体域名，减少首次 DNS/TLS 建连耗时（仅跨域 URL 生效）
  useEffect(() => {
    if (!unlocked) return;
    const u = playbackUrl.trim();
    if (!u) return;
    try {
      const url = new URL(u, window.location.origin);
      if (url.origin === window.location.origin) return;
      const id = `preconnect-${url.origin}`;
      if (document.getElementById(id)) return;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "preconnect";
      link.href = url.origin;
      link.crossOrigin = "";
      document.head.appendChild(link);
    } catch {
      // ignore invalid/relative urls
    }
  }, [playbackUrl, unlocked]);

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
      <div className="relative isolate h-full w-full min-h-0 overflow-hidden rounded-none border-0 bg-[#000000] shadow-none ring-0">
        <video
          ref={videoRef}
          className={
            unlocked
              ? "immersive-video-el relative z-0 h-full w-full object-cover"
              : "immersive-video-el pointer-events-none relative z-0 h-full w-full object-cover opacity-0"
          }
          src={unlocked && !hls ? playbackUrl : undefined}
          controls={unlocked}
          playsInline
          muted
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          disableRemotePlayback
          autoPlay={unlocked}
          preload={unlocked ? "auto" : "metadata"}
          poster={playbackPosterUrl || undefined}
          onCanPlay={handleReady}
          onError={handleLoadError}
          onEnded={handleEnded}
          aria-hidden={!unlocked}
        />
        {unlocked && playbackPosterUrl && !ready && !loadFailed ? (
          <Image
            src={playbackPosterUrl}
            alt=""
            fill
            className="pointer-events-none absolute inset-0 z-[1] object-cover"
            sizes="100vw"
            aria-hidden
          />
        ) : null}
        {!unlocked ? (
          <LockedOverlay
            posterUrl={lockPreviewPosterUrl}
            previewPlayableUrl={playbackUrl}
            onUnlock={() => router.push("/store")}
          />
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-black/80 via-black/30 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1 text-[11px] font-medium text-zinc-200 ring-1 ring-zinc-800/80">
          {episodeLabel}
        </div>

        {runtimeVideoStatus === "processing" && unlocked ? (
          <div className="absolute inset-0 grid place-items-center text-xs text-zinc-400">
            {t("common.loading")} · Transcoding...
          </div>
        ) : null}

        {(runtimeVideoStatus === "failed" || loadFailed) && unlocked ? (
          <div className="absolute inset-0 grid place-items-center px-6 text-center text-xs text-zinc-300">
            <div>
              <p className="font-medium">{t("common.loading")} failed</p>
              <p className="mt-1 text-zinc-400">
                Video source is unavailable. Please refresh status or replace URL.
              </p>
            </div>
          </div>
        ) : null}

        {!ready && !loadFailed && unlocked && runtimeVideoStatus !== "processing" ? (
          <div className="absolute inset-0 grid place-items-center text-xs text-zinc-400">
            {t("common.loading")}
          </div>
        ) : null}

      </div>

      <input type="hidden" value={episodeIndex} readOnly />
    </section>
  );
}
