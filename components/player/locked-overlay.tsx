"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { playbackUrlIndicatesHls } from "@/lib/video/playback";
import { attachHls, supportsNativeHls } from "@/lib/video/hls-loader";

interface LockedOverlayProps {
  onUnlock: () => void;
  /** 已归一化的海报/缩略图 URL（含本站代理） */
  posterUrl: string;
  /** 当前集可播地址（与主播放器一致，可为 HLS）；锁屏时在后台拉首帧 */
  previewPlayableUrl?: string;
}

function LockPreviewMedia({
  posterUrl,
  previewPlayableUrl = ""
}: {
  posterUrl: string;
  previewPlayableUrl?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playUrl = previewPlayableUrl.trim();
  const poster = posterUrl.trim();
  const isHls = playUrl ? playbackUrlIndicatesHls(playUrl) : false;

  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const bumpToFirstFrame = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (v.duration && !Number.isNaN(v.duration) && v.duration > 0) {
        const t = Math.min(0.15, Math.max(0.05, v.duration * 0.02));
        if (Math.abs(v.currentTime - t) > 0.05) v.currentTime = t;
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setVideoReady(false);
    setVideoFailed(false);

    const video = videoRef.current;
    if (!playUrl || !video) return;

    const markReady = () => {
      bumpToFirstFrame();
      setVideoReady(true);
    };

    const onError = () => setVideoFailed(true);

    video.addEventListener("loadeddata", bumpToFirstFrame);
    video.addEventListener("canplay", markReady);
    video.addEventListener("seeked", markReady);
    video.addEventListener("error", onError);

    let disposed = false;
    let hlsInstance: { destroy: () => void } | null = null;

    /**
     * preload="none" + 海报优先渲染，视频在 poster 就绪后才启动加载，
     * 避免锁屏时与海报争夺同一连接池的带宽。
     */
    const startVideo = () => {
      if (disposed) return;
      if (!isHls) {
        video.src = playUrl;
      } else if (supportsNativeHls(video)) {
        video.src = playUrl;
      } else {
        attachHls(video, playUrl)
          .then((result) => {
            if (disposed) {
              result?.hls.destroy();
              return;
            }
            if (!result) video.src = playUrl;
            else hlsInstance = result.hls;
          })
          .catch(() => {
            if (disposed) return;
            setVideoFailed(true);
          });
      }
    };

    // 等海报先渲染完成（img onload），再启动视频加载
    const img = new Image();
    img.onload = startVideo;
    img.src = poster;
    // 如果海报本身就是视频 poster 属性（同源），img onload 会在 poster 渲染后触发
    // 超时 2s 仍启动视频（海报加载失败时不让视频也卡住）
    const timeout = setTimeout(startVideo, 2000);
    img.onerror = () => {
      clearTimeout(timeout);
      startVideo();
    };

    return () => {
      disposed = true;
      clearTimeout(timeout);
      video.removeEventListener("loadeddata", bumpToFirstFrame);
      video.removeEventListener("canplay", markReady);
      video.removeEventListener("seeked", markReady);
      video.removeEventListener("error", onError);
      if (hlsInstance) hlsInstance.destroy();
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {
        /* ignore */
      }
    };
  }, [playUrl, isHls, bumpToFirstFrame]);

  const hasPlay = Boolean(playUrl);
  const hasPoster = Boolean(poster);
  const showVideoLayer = hasPlay && !videoFailed && videoReady;
  const hidePosterLayer = showVideoLayer;

  if (!hasPlay && !hasPoster) {
    return <div className="absolute inset-0 bg-black" aria-hidden />;
  }

  return (
    <>
      {hasPoster ? (
        <img
          src={poster}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            hidePosterLayer ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
          draggable={false}
          aria-hidden
        />
      ) : null}
      {hasPlay ? (
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            showVideoLayer ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          muted
          playsInline
          preload="none"
          aria-hidden
        />
      ) : null}
    </>
  );
}

export function LockedOverlay({ onUnlock, posterUrl, previewPlayableUrl }: LockedOverlayProps) {
  const { t } = useTranslation();

  return (
    <div
      className="absolute inset-0 z-[50] overflow-hidden"
      style={{ pointerEvents: "auto" }}
    >
      <LockPreviewMedia posterUrl={posterUrl} previewPlayableUrl={previewPlayableUrl} />
      <div className="absolute inset-0 bg-black/25" aria-hidden />
      <div className="relative flex h-full flex-col items-center justify-center px-6">
        <div className="flex flex-col items-center gap-6">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]"
            aria-hidden
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p className="text-center text-lg font-bold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
            {t("locked.paidMessage", "This is a paid episode. Please unlock to watch.")}
          </p>
          <button
            type="button"
            onClick={onUnlock}
            className="rounded-xl bg-brand px-8 py-3 text-base font-semibold text-white shadow-lg shadow-black/40 transition-colors hover:bg-red-600"
          >
            {t("locked.unlockNow", "Unlock Now")}
          </button>
        </div>
      </div>
    </div>
  );
}
