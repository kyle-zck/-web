import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { getAllSeries, updateEpisodeStreamState } from "@/lib/series-repo";
import { getEngagementCountsBatch } from "@/lib/user-repo";
import { tryCreateStreamByUrl } from "@/lib/video/cloudflare-stream";
import { getEpisodeVideoMode } from "@/lib/video/series-video-mode";
import type { Episode, Series } from "@/constants/mock-data";

type Job = {
  seriesId: string;
  episodeId: string;
  sourceUrl: string;
};

function toAbsoluteHttpUrl(input: string, origin: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw, origin);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    return null;
  } catch {
    return null;
  }
}

function episodeNeedTranscode(ep: Episode): boolean {
  if (ep.videoStatus === "processing") return false;
  const mode = getEpisodeVideoMode(ep);
  return mode === "mp4" || mode === "failed";
}

function buildJobs(items: Series[], origin: string, firstNEpisodesPerSeries: number): Job[] {
  const jobs: Job[] = [];
  for (const s of items) {
    const baseEpisodes = [...(s.episodes ?? [])].sort((a, b) => a.index - b.index);
    const episodes =
      firstNEpisodesPerSeries > 0
        ? baseEpisodes.filter((ep) => ep.index <= firstNEpisodesPerSeries)
        : baseEpisodes;
    for (const ep of episodes) {
      if (!episodeNeedTranscode(ep)) continue;
      const sourceUrl = toAbsoluteHttpUrl(ep.videoUrl, origin);
      if (!sourceUrl) continue;
      jobs.push({
        seriesId: s.id,
        episodeId: ep.id,
        sourceUrl
      });
    }
  }
  return jobs;
}

async function runJobsWithRetry(
  jobs: Job[],
  opts: { concurrency: number; maxRetries: number }
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  const queue = [...jobs];
  const workers = Array.from({ length: Math.min(opts.concurrency, queue.length) }).map(
    async () => {
      while (queue.length > 0) {
        const job = queue.shift();
        if (!job) break;

        let done = false;
        for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt += 1) {
          const stream = await tryCreateStreamByUrl(job.sourceUrl);
          if (stream.streamId && stream.playbackUrl) {
            await updateEpisodeStreamState(job.seriesId, job.episodeId, {
              videoStreamId: stream.streamId,
              videoPlaybackUrl: stream.playbackUrl,
              videoStatus: stream.status ?? "processing"
            });
            ok += 1;
            done = true;
            break;
          }
        }

        if (!done) {
          await updateEpisodeStreamState(job.seriesId, job.episodeId, {
            videoStatus: "failed"
          });
          failed += 1;
        }
      }
    }
  );
  await Promise.all(workers);
  return { ok, failed };
}

export async function POST(req: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const body = (await req.json().catch(() => ({}))) as {
    seriesIds?: string[];
    minViews?: number;
    maxSeries?: number;
    mode?: "manual" | "hot";
    concurrency?: number;
    maxRetries?: number;
    firstNEpisodesPerSeries?: number;
  };
  const mode = body.mode ?? "manual";
  const minViews = Math.max(0, Number(body.minViews ?? 0));
  const maxSeries = Math.max(1, Number(body.maxSeries ?? 20));
  const concurrency = Math.max(1, Math.min(8, Number(body.concurrency ?? 4)));
  const maxRetries = Math.max(0, Math.min(5, Number(body.maxRetries ?? 2)));
  const firstNEpisodesPerSeries = Math.max(0, Number(body.firstNEpisodesPerSeries ?? 0));
  const origin = new URL(req.url).origin;

  const all = await getAllSeries();
  let selected: Series[] = [];
  if (mode === "hot") {
    const viewsById = await getEngagementCountsBatch(all.map((s) => s.id));
    const withViews = all.map((s) => ({
      s,
      views: viewsById[s.id]?.viewsCount ?? 0
    }));
    selected = withViews
      .filter((x) => x.views >= minViews)
      .sort((a, b) => b.views - a.views)
      .slice(0, maxSeries)
      .map((x) => x.s);
  } else {
    const wanted = new Set((body.seriesIds ?? []).filter(Boolean));
    selected = all.filter((s) => wanted.has(s.id));
  }

  const jobs = buildJobs(selected, origin, firstNEpisodesPerSeries);
  if (jobs.length === 0) {
    return NextResponse.json({
      ok: true,
      totalJobs: 0,
      okCount: 0,
      failedCount: 0
    });
  }

  const result = await runJobsWithRetry(jobs, { concurrency, maxRetries });
  return NextResponse.json({
    ok: true,
    totalJobs: jobs.length,
    okCount: result.ok,
    failedCount: result.failed
  });
}
