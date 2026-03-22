export default function SeriesDetailLoading() {
  return (
    <main className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-600 border-t-red-500"
        aria-hidden
      />
      <p className="text-sm text-zinc-500">加载中…</p>
    </main>
  );
}
