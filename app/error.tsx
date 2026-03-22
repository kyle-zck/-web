"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-lg font-bold text-white">页面出错了</p>
      <p className="max-w-md text-sm text-zinc-400">
        {error?.message || "未知错误。请重试或刷新页面。"}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
      >
        重试
      </button>
    </div>
  );
}
