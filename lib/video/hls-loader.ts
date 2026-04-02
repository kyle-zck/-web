/**
 * HLS.js 懒加载封装，提供统一的初始化逻辑供 ImmersivePlayer / LockedOverlay 共享。
 * 避免两个组件各自 import("hls.js") 产生重复 chunk。
 */

type HlsConstructor = {
  isSupported?: () => boolean;
  new (config?: {
    enableWorker?: boolean;
    lowLatencyMode?: boolean;
    /** 解析 manifest 后尽早拉首片，缩短首帧时间 */
    startFragPrefetch?: boolean;
  }): HlsInstance;
};

type HlsInstance = {
  loadSource: (src: string) => void;
  attachMedia: (el: HTMLMediaElement) => void;
  destroy: () => void;
};

/** 已解析的 HlsCtor，缓存后不再重新加载 */
let cachedHls: HlsConstructor | null = null;
let loadingPromise: Promise<HlsConstructor> | null = null;

/** 加载 HlsCtor（Promise 单例，不会重复加载） */
export function loadHls(): Promise<HlsConstructor> {
  if (cachedHls) return Promise.resolve(cachedHls);
  if (loadingPromise) return loadingPromise;
  loadingPromise = import("hls.js")
    .then((m) => {
      cachedHls = m.default ?? null;
      loadingPromise = null;
      return cachedHls;
    })
    .catch((e) => {
      loadingPromise = null;
      throw e;
    });
  return loadingPromise;
}

/** 是否支持原生 HLS（iOS Safari 等） */
export function supportsNativeHls(video: HTMLVideoElement): boolean {
  return Boolean(video.canPlayType("application/vnd.apple.mpegurl"));
}

/**
 * 为 video 元素加载并附加 HLS 流。
 * 返回 HlsInstance（或 null 表示走原生方案），外部负责在适当时机 destroy。
 */
export function attachHls(
  video: HTMLVideoElement,
  src: string
): Promise<{ hls: HlsInstance } | null> {
  return loadHls().then((HlsCtor) => {
    if (!HlsCtor?.isSupported?.()) return null;
    const hls = new HlsCtor({ enableWorker: true, lowLatencyMode: false });
    hls.loadSource(src);
    hls.attachMedia(video);
    return { hls };
  });
}
