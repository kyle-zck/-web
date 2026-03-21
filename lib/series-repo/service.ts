import type { Series } from "@/constants/mock-data";
import {
  getAllSeries as getAllLocal,
  getSeriesById as getSeriesByIdLocal,
  createSeries as createSeriesLocal,
  deleteSeries as deleteSeriesLocal,
  deleteEpisodeFromSeries as deleteEpisodeFromSeriesLocal,
  updateSeries as updateSeriesLocal
} from "./storage-local";

import {
  getAllSeries as getAllPg,
  getSeriesById as getSeriesByIdPg,
  createSeries as createSeriesPg,
  deleteSeries as deleteSeriesPg
} from "./storage-pg";

/**
 * 不在文件顶层 import storage-sqlite：其依赖 better-sqlite3 原生模块，
 * 在 Vercel 等 Linux 构建上会拖垮 next build。仅在 SERIES_STORAGE=sqlite 时动态加载。
 */

type StorageMode = "local" | "sqlite" | "pg";

const mode = (process.env.SERIES_STORAGE as StorageMode | undefined) ?? "local";

async function updateSeriesStub(
  _id: string,
  _patch: {
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
  return null;
}

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
  updateSeries: updateSeriesLocal
};

const pgProvider: RepoProvider = {
  getAllSeries: getAllPg,
  getSeriesById: getSeriesByIdPg,
  createSeries: createSeriesPg,
  deleteSeries: deleteSeriesPg,
  deleteEpisodeFromSeries: async () => null,
  updateSeries: updateSeriesStub
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
    deleteEpisodeFromSeries: async () => null,
    updateSeries: updateSeriesStub
  };
  return sqliteProviderCache;
}

async function getProvider(): Promise<RepoProvider> {
  if (mode === "sqlite") return getSqliteProvider();
  if (mode === "pg") return pgProvider;
  return localProvider;
}

export async function getAllSeries(): Promise<Series[]> {
  return (await getProvider()).getAllSeries();
}

export async function getSeriesById(id: string): Promise<Series | null> {
  return (await getProvider()).getSeriesById(id);
}

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
  return (await getProvider()).createSeries(data);
}

export async function deleteSeries(id: string): Promise<void> {
  return (await getProvider()).deleteSeries(id);
}

export async function deleteEpisodeFromSeries(
  seriesId: string,
  episodeId: string
): Promise<Series | null> {
  return (await getProvider()).deleteEpisodeFromSeries(seriesId, episodeId);
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
  return (await getProvider()).updateSeries(id, patch);
}
