export type CategoryTag = "Romance" | "Revenge" | "Werewolf" | "CEO" | "Fantasy" | "Time Travel";

export interface Episode {
  id: string;
  title: string;
  duration: string;
  thumbnail: string;
  videoUrl: string;
  index: number;
  isFree: boolean;
}

export type AppLanguage = "en" | "zh-CN";

export interface SeriesI18nText {
  title: string;
  tagline: string;
  description?: string;
}

export interface Series {
  id: string;
  title: string;
  tagline: string;
  category: CategoryTag;
  tags: CategoryTag[];
  cover: string;
  poster: string;
  isTrending?: boolean;
  isNew?: boolean;
  episodes: Episode[];
  description?: string;
  i18n?: Partial<Record<AppLanguage, SeriesI18nText>>;
}

function svgDataUri(svg: string) {
  const encoded = encodeURIComponent(svg)
    .replace(/%0A/g, "")
    .replace(/%20/g, " ");
  return `data:image/svg+xml;utf8,${encoded}`;
}

function posterPlaceholder(title: string, subtitle: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1f1147"/>
      <stop offset="55%" stop-color="#0b1020"/>
      <stop offset="100%" stop-color="#000000"/>
    </linearGradient>
  </defs>
  <rect width="720" height="1280" fill="url(#g)"/>
  <circle cx="540" cy="260" r="220" fill="#7C3AED" opacity="0.22"/>
  <circle cx="160" cy="980" r="260" fill="#7C3AED" opacity="0.14"/>
  <rect x="36" y="900" width="648" height="320" rx="44" fill="#000" opacity="0.52"/>
  <text x="72" y="980" fill="#fff" font-family="ui-sans-serif, system-ui, -apple-system" font-size="54" font-weight="700">${title}</text>
  <text x="72" y="1046" fill="#cbd5e1" font-family="ui-sans-serif, system-ui, -apple-system" font-size="28">${subtitle}</text>
  <text x="72" y="1124" fill="#7C3AED" font-family="ui-sans-serif, system-ui, -apple-system" font-size="22" font-weight="600">Mock Poster · 9:16</text>
</svg>`;
  return svgDataUri(svg);
}

function coverPlaceholder(title: string, category: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1020"/>
      <stop offset="100%" stop-color="#120a2a"/>
    </linearGradient>
  </defs>
  <rect width="900" height="1200" fill="url(#g)"/>
  <rect x="44" y="44" width="812" height="1112" rx="56" fill="#000" opacity="0.35" stroke="#7C3AED" stroke-opacity="0.35"/>
  <text x="90" y="980" fill="#fff" font-family="ui-sans-serif, system-ui, -apple-system" font-size="44" font-weight="700">${title}</text>
  <text x="90" y="1042" fill="#a1a1aa" font-family="ui-sans-serif, system-ui, -apple-system" font-size="26">${category}</text>
  <text x="90" y="1110" fill="#7C3AED" font-family="ui-sans-serif, system-ui, -apple-system" font-size="20" font-weight="600">Mock Cover</text>
</svg>`;
  return svgDataUri(svg);
}

function buildEpisodes(seriesId: string, total: number) {
  // 使用同一个可公开访问的示例视频源，方便本地直接播放与测试自动连播
  const demoMp4 =
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";

  return Array.from({ length: total }).map((_, i) => {
    const index = i + 1;
    const isFree = index <= 3;
    return {
      id: `${seriesId}-ep-${index}`,
      index,
      title: `第 ${index} 集`,
      duration: `${5 + (index % 3)}:${(10 + index * 7) % 60}`.padStart(2, "0"),
      thumbnail: coverPlaceholder(`第 ${index} 集`, isFree ? "FREE" : "LOCKED"),
      videoUrl: demoMp4,
      isFree
    } satisfies Episode;
  });
}

export const CATEGORY_TAGS: CategoryTag[] = [
  "Romance",
  "Revenge",
  "Werewolf",
  "CEO",
  "Fantasy",
  "Time Travel"
];

export const SERIES_LIST: Series[] = [
  {
    id: "alpha-wolf-contract",
    title: "Alpha 的契约新娘",
    tagline: "一纸婚约，她成了狼族首领的猎物。",
    category: "Werewolf",
    tags: ["Werewolf", "Romance", "Revenge"],
    cover: coverPlaceholder("Alpha 的契约新娘", "Werewolf"),
    poster: posterPlaceholder("Alpha 的契约新娘", "一纸婚约，她成了狼族首领的猎物。"),
    isTrending: true,
    isNew: true,
    description:
      "她为了家族签下契约，误入狼族权力中心。爱与复仇交织，每一集都在逼近真相。",
    episodes: buildEpisodes("alpha-wolf-contract", 50),
    i18n: {
      en: {
        title: "Alpha's Contract Bride",
        tagline: "A contract. A dangerous alpha. A love tangled with revenge.",
        description:
          "She signs the contract to protect her family—then finds herself at the wolf kingdom’s heart. Love and revenge spiral together as the truth closes in."
      }
    }
  },
  {
    id: "ceo-revenge-marriage",
    title: "隐婚总裁的复仇",
    tagline: "他用婚姻布下复仇棋局，却先陷入爱里。",
    category: "Revenge",
    tags: ["CEO", "Revenge", "Romance"],
    cover: coverPlaceholder("隐婚总裁的复仇", "Revenge"),
    poster: posterPlaceholder("隐婚总裁的复仇", "他用婚姻布下复仇棋局，却先陷入爱里。"),
    isTrending: true,
    description:
      "一场隐婚交易引爆豪门暗线。每一次靠近都可能是陷阱，但他偏要把她护在局里。",
    episodes: buildEpisodes("ceo-revenge-marriage", 50),
    i18n: {
      en: {
        title: "The CEO's Revenge Marriage",
        tagline: "He plotted revenge through marriage—then fell in love first.",
        description:
          "An undercover deal ignites a secret battle inside the wealthy world. Every step toward him could be a trap, but he chooses to keep her safe."
      }
    }
  },
  {
    id: "back-to-18",
    title: "重返 18 岁",
    tagline: "带着一世记忆，她重回命运转折点。",
    category: "Time Travel",
    tags: ["Time Travel", "Romance", "Fantasy"],
    cover: coverPlaceholder("重返 18 岁", "Time Travel"),
    poster: posterPlaceholder("重返 18 岁", "带着一世记忆，她重回命运转折点。"),
    isNew: true,
    description:
      "如果能再来一次，她会如何改写被辜负的人生？命运给了机会，也给了更难的选择。",
    episodes: buildEpisodes("back-to-18", 50),
    i18n: {
      en: {
        title: "Back to 18",
        tagline: "With one life’s memory, she returns to rewrite the turning point.",
        description:
          "If she could start over, how would she change the story that betrayed her? Fate gives her one chance—then dares her with the harder choice."
      }
    }
  }
];

export const TRENDING_SERIES = SERIES_LIST.filter((s) => s.isTrending);

export const NEW_ARRIVALS = SERIES_LIST.filter((s) => s.isNew);
