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
  getAllSeries as getAllSqlite,
  getSeriesById as getSeriesByIdSqlite,
  createSeries as createSeriesSqlite,
  deleteSeries as deleteSeriesSqlite
} from "./storage-sqlite";

import {
  getAllSeries as getAllPg,
  getSeriesById as getSeriesByIdPg,
  createSeries as createSeriesPg,
  deleteSeries as deleteSeriesPg
} from "./storage-pg";

type StorageMode = "local" | "sqlite" | "pg";

const mode = (process.env.SERIES_STORAGE as StorageMode | undefined) ?? "local";

async function updateSeriesStub(
  _id: string,
  _patch: { lockStartIndex?: number }
): Promise<Series | null> {
  return null;
}

const provider = (() => {
  if (mode === "sqlite") {
    return {
      getAllSeries: getAllSqlite,
      getSeriesById: getSeriesByIdSqlite,
      createSeries: createSeriesSqlite,
      deleteSeries: deleteSeriesSqlite,
      deleteEpisodeFromSeries: async () => null,
      updateSeries: updateSeriesStub
    };
  }
  if (mode === "pg") {
    return {
      getAllSeries: getAllPg,
      getSeriesById: getSeriesByIdPg,
      createSeries: createSeriesPg,
      deleteSeries: deleteSeriesPg,
      deleteEpisodeFromSeries: async () => null,
      updateSeries: updateSeriesStub
    };
  }

  return {
    getAllSeries: getAllLocal,
    getSeriesById: getSeriesByIdLocal,
    createSeries: createSeriesLocal,
    deleteSeries: deleteSeriesLocal,
    deleteEpisodeFromSeries: deleteEpisodeFromSeriesLocal,
    updateSeries: updateSeriesLocal
  };
})();

export async function getAllSeries(): Promise<Series[]> {
  return provider.getAllSeries();
}

export async function getSeriesById(id: string): Promise<Series | null> {
  return provider.getSeriesById(id);
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
  return provider.createSeries(data);
}

export async function deleteSeries(id: string): Promise<void> {
  return provider.deleteSeries(id);
}

export async function deleteEpisodeFromSeries(
  seriesId: string,
  episodeId: string
): Promise<Series | null> {
  return provider.deleteEpisodeFromSeries(seriesId, episodeId);
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
  return provider.updateSeries(id, patch);
}

