/** 播放页重型组件 chunk 加载前的占位，减轻白屏感 */
export function SeriesDetailSkeleton() {
  return (
    <div className="flex h-full min-h-[100dvh] flex-col bg-black lg:flex-row">
      <div className="relative flex aspect-[9/16] w-full max-w-[min(100%,420px)] shrink-0 items-center justify-center bg-zinc-950 lg:fixed lg:left-0 lg:top-20 lg:aspect-auto lg:h-[calc(100dvh-5rem)] lg:w-[65vw] lg:max-w-none">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-zinc-800/40 to-zinc-950" />
        <div className="relative z-[1] h-10 w-10 animate-spin rounded-full border-2 border-zinc-600 border-t-red-500" aria-hidden />
        <p className="relative z-[1] mt-4 text-xs text-zinc-500">加载播放器…</p>
      </div>
      <div className="min-h-[40vh] flex-1 space-y-4 p-5 lg:ml-[65vw] lg:min-h-0 lg:w-[35vw] lg:p-6">
        <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
        <div className="h-8 w-full animate-pulse rounded bg-zinc-800/80" />
        <div className="h-20 w-full animate-pulse rounded bg-zinc-900" />
        <div className="flex gap-3">
          <div className="h-12 flex-1 animate-pulse rounded-lg bg-zinc-800/60" />
          <div className="h-12 flex-1 animate-pulse rounded-lg bg-zinc-800/60" />
        </div>
      </div>
    </div>
  );
}
