import type { Episode, Series } from "@/constants/mock-data";

/**
 * 列表/首页等仅需封面与文案，去掉分集可显著减小 RSC 与 JSON 体积（episodes 常含长 videoUrl）。
 */
export function slimSeriesForPublicCard(s: Series): Series {
  return { ...s, episodes: [] };
}

export function slimSeriesListForPublic(list: Series[]): Series[] {
  return list.map(slimSeriesForPublicCard);
}

/** 在仅持有 lite 剧目（无分集）时，用进度里的集数构造最小 Episode，避免再拉全量 /api/series */
export function stubEpisodeForProgress(seriesId: string, episodeIndex: number): Episode {
  return {
    id: `${seriesId}-ep-${episodeIndex}`,
    index: episodeIndex,
    title: `Ep. ${episodeIndex}`,
    duration: "0:00",
    thumbnail: "",
    videoUrl: "",
    isFree: true
  };
}
