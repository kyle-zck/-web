import type { Series } from "@/constants/mock-data";
import {
  getAllSeries as getAllLocal,
  getSeriesById as getSeriesByIdLocal,
  createSeries as createSeriesLocal,
  deleteSeries as deleteSeriesLocal
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

const provider = (() => {
  if (mode === "sqlite") {
    return {
      getAllSeries: getAllSqlite,
      getSeriesById: getSeriesByIdSqlite,
      createSeries: createSeriesSqlite,
      deleteSeries: deleteSeriesSqlite
    };
  }
  if (mode === "pg") {
    return {
      getAllSeries: getAllPg,
      getSeriesById: getSeriesByIdPg,
      createSeries: createSeriesPg,
      deleteSeries: deleteSeriesPg
    };
  }

  return {
    getAllSeries: getAllLocal,
    getSeriesById: getSeriesByIdLocal,
    createSeries: createSeriesLocal,
    deleteSeries: deleteSeriesLocal
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
}): Promise<Series> {
  return provider.createSeries(data);
}

export async function deleteSeries(id: string): Promise<void> {
  return provider.deleteSeries(id);
}

