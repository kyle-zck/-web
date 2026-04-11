import type { Series } from "@/constants/mock-data";
import { cache } from "react";
import { getDatabaseUrl } from "@/lib/db/url";
import { normalizeSeriesPublicUrls } from "@/lib/video/public-asset-url";
import {
  getAllSeries as getAllLocal,
  getSeriesById as getSeriesByIdLocal,
  createSeries as createSeriesLocal,
  deleteSeries as deleteSeriesLocal,
  deleteEpisodeFromSeries as deleteEpisodeFromSeriesLocal,
  appendEpisodeToSeries as appendEpisodeToSeriesLocal,
  updateEpisodeStreamState as updateEpisodeStreamStateLocal,
  updateSeries as updateSeriesLocal
} from "./storage-local";

import {
  getAllSeries as getAllPg,
  getSeriesById as getSeriesByIdPg,
  createSeries as createSeriesPg,
  deleteSeries as deleteSeriesPg,
  updateSeries as updateSeriesPg,
  deleteEpisodeFromSeries as deleteEpisodeFromSeriesPg,
  appendEpisodeToSeries as appendEpisodeToSeriesPg,
  updateEpisodeStreamState as updateEpisodeStreamStatePg
} from "./storage-pg";

/**
 * 不在文件顶层 import storage-sqlite：其依赖 better-sqlite3 原生模块，
 * 在 Vercel 等 Linux 构建上会拖垮 next build。仅在 SERIES_STORAGE=sqlite 时动态加载。
 */

type StorageMode = "local" | "sqlite" | "pg";

const mode = (process.env.SERIES_STORAGE as StorageMode | undefined) ?? "local";

type RepoProvider = {
  getAllSeries: () => Promise<Series[]>;
  getSeriesById: (id: string) => Promise<Series | null>;
  createSeries: (data: {
    title: string;
    description: string;
    tags: Series["tags"];
    coverDataUrl: string;
    episodeVideoUrls: string[];
    episodeVideoMeta?: import("./storage-local").EpisodeVideoMetaItem[];
    lockStartIndex?: number;
    listed?: boolean;
    originalName?: string;
    localOrTranslated?: "local" | "translated";
  }) => Promise<Series>;
  deleteSeries: (id: string) => Promise<void>;
  deleteEpisodeFromSeries: (
    seriesId: string,
    episodeId: string
  ) => Promise<Series | null>;
  appendEpisodeToSeries: (
    seriesId: string,
    data: {
      videoUrl: string;
      sourceFileName?: string;
      localVideoUrl?: string;
      videoStreamId?: string;
      videoPlaybackUrl?: string;
      videoStatus?: "processing" | "ready" | "failed";
    }
  ) => Promise<Series | null>;
  updateEpisodeStreamState: (
    seriesId: string,
    episodeId: string,
    patch: {
      videoUrl?: string;
      videoStreamId?: string;
      videoPlaybackUrl?: string;
      videoStatus?: "processing" | "ready" | "failed";
      title?: string;
    }
  ) => Promise<Series | null>;
  updateSeries: (
    id: string,
    patch: {
      lockStartIndex?: number;
      title?: string;
      originalName?: string;
      localOrTranslated?: "local" | "translated";
      description?: string;
      tags?: Series["tags"];
      cover?: string;
      poster?: string;
      listed?: boolean;
    }
  ) => Promise<Series | null>;
};

const localProvider: RepoProvider = {
  getAllSeries: getAllLocal,
  getSeriesById: getSeriesByIdLocal,
  createSeries: createSeriesLocal,
  deleteSeries: deleteSeriesLocal,
  deleteEpisodeFromSeries: deleteEpisodeFromSeriesLocal,
  appendEpisodeToSeries: appendEpisodeToSeriesLocal,
  updateEpisodeStreamState: updateEpisodeStreamStateLocal,
  updateSeries: updateSeriesLocal
};

const pgProvider: RepoProvider = {
  getAllSeries: getAllPg,
  getSeriesById: getSeriesByIdPg,
  createSeries: createSeriesPg,
  deleteSeries: deleteSeriesPg,
  deleteEpisodeFromSeries: deleteEpisodeFromSeriesPg,
  appendEpisodeToSeries: appendEpisodeToSeriesPg,
  updateEpisodeStreamState: updateEpisodeStreamStatePg,
  updateSeries: updateSeriesPg
};

let sqliteProviderCache: RepoProvider | null = null;

async function getSqliteProvider(): Promise<RepoProvider> {
  if (sqliteProviderCache) return sqliteProviderCache;
  const m = await import("./storage-sqlite");
  sqliteProviderCache = {
    getAllSeries: m.getAllSeries,
    getSeriesById: m.getSeriesById,
    createSeries: m.createSeries,
    deleteSeries: m.deleteSeries,
    deleteEpisodeFromSeries: m.deleteEpisodeFromSeries,
    appendEpisodeToSeries: m.appendEpisodeToSeries,
    updateEpisodeStreamState: m.updateEpisodeStreamState,
    updateSeries: m.updateSeries
  };
  return sqliteProviderCache;
}

async function getProvider(): Promise<RepoProvider> {
  if (mode === "sqlite") return getSqliteProvider();
  if (mode === "pg") {
    if (!getDatabaseUrl()) {
      console.warn(
        "[series-repo] SERIES_STORAGE=pg 但未配置 DATABASE_URL / SUPABASE_DB_URL / PG_URL，已回退到本地 data/series-store.json"
      );
      return localProvider;
    }
    return pgProvider;
  }
  return localProvider;
}

async function getAllSeriesOnce(): Promise<Series[]> {
  const p = await getProvider();
  try {
    const list = await p.getAllSeries();
    return list.map((s) => normalizeSeriesPublicUrls(s)).filter((s): s is Series => s !== null);
  } catch (e) {
    if (mode === "pg") {
      console.error("[series-repo] Postgres getAllSeries 失败，回退本地 JSON", e);
      const list = await getAllLocal();
      return list.map((s) => normalizeSeriesPublicUrls(s)).filter((s): s is Series => s !== null);
    }
    throw e;
  }
}

/** 同一请求内多处调用只查一次库/磁盘 */
export const getAllSeries = cache(getAllSeriesOnce);

async function getSeriesByIdOnce(id: string): Promise<Series | null> {
  const p = await getProvider();
  try {
    const s = await p.getSeriesById(id);
    return s ? normalizeSeriesPublicUrls(s) : null;
  } catch (e) {
    if (mode === "pg") {
      console.error("[series-repo] Postgres getSeriesById 失败，回退本地 JSON", e);
      const s = await getSeriesByIdLocal(id);
      return s ? normalizeSeriesPublicUrls(s) : null;
    }
    throw e;
  }
}

export const getSeriesById = cache(getSeriesByIdOnce);

export async function createSeries(data: {
  title: string;
  description: string;
  tags: Series["tags"];
  coverDataUrl: string;
  episodeVideoUrls: string[];
  episodeVideoMeta?: import("./storage-local").EpisodeVideoMetaItem[];
  lockStartIndex?: number;
  listed?: boolean;
  originalName?: string;
  localOrTranslated?: "local" | "translated";
}): Promise<Series> {
  const created = await (await getProvider()).createSeries(data);
  return normalizeSeriesPublicUrls(created)!;
}

export async function deleteSeries(id: string): Promise<void> {
  return (await getProvider()).deleteSeries(id);
}

export async function deleteEpisodeFromSeries(
  seriesId: string,
  episodeId: string
): Promise<Series | null> {
  const s = await (await getProvider()).deleteEpisodeFromSeries(seriesId, episodeId);
  return s ? normalizeSeriesPublicUrls(s) : null;
}

export async function appendEpisodeToSeries(
  seriesId: string,
  data: {
    videoUrl: string;
    sourceFileName?: string;
    localVideoUrl?: string;
    videoStreamId?: string;
    videoPlaybackUrl?: string;
    videoStatus?: "processing" | "ready" | "failed";
  }
): Promise<Series | null> {
  const s = await (await getProvider()).appendEpisodeToSeries(seriesId, data);
  return s ? normalizeSeriesPublicUrls(s) : null;
}

export async function updateEpisodeStreamState(
  seriesId: string,
  episodeId: string,
  patch: {
    videoUrl?: string;
    videoStreamId?: string;
    videoPlaybackUrl?: string;
    videoStatus?: "processing" | "ready" | "failed";
    title?: string;
  }
): Promise<Series | null> {
  const s = await (await getProvider()).updateEpisodeStreamState(seriesId, episodeId, patch);
  return s ? normalizeSeriesPublicUrls(s) : null;
}

export async function updateSeries(
  id: string,
  patch: {
    lockStartIndex?: number;
    title?: string;
    originalName?: string;
    localOrTranslated?: "local" | "translated";
    description?: string;
    tags?: Series["tags"];
    cover?: string;
    poster?: string;
    listed?: boolean;
  }
): Promise<Series | null> {
  const s = await (await getProvider()).updateSeries(id, patch);
  return s ? normalizeSeriesPublicUrls(s) : null;
}
