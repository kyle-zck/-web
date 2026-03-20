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
  ,
  {
    id: "midnight-pack-secret",
    title: "午夜狼群密约",
    tagline: "她签下的，不只是契约，而是整支狼群的命运。",
    category: "Werewolf",
    tags: ["Werewolf", "Romance", "Fantasy"],
    cover: coverPlaceholder("午夜狼群密约", "Werewolf"),
    poster: posterPlaceholder("午夜狼群密约", "她签下的，不只是契约，而是整支狼群的命运。"),
    isTrending: true,
    description:
      "一纸深夜签下的合约，把她推向狼群纷争中心。每当月圆，真相就更近一步。",
    episodes: buildEpisodes("midnight-pack-secret", 40),
    i18n: {
      en: {
        title: "Midnight Pack Secret",
        tagline: "The contract she signed bound the fate of a whole wolf pack.",
        description:
          "A midnight deal throws her into the heart of a pack war. With every full moon, the hidden truth claws closer to the surface."
      }
    }
  },
  {
    id: "alpha-rejected-mate",
    title: "被拒绝的月光伴侣",
    tagline: "被 Alpha 当场拒绝的那一刻，她的命运被彻底改写。",
    category: "Werewolf",
    tags: ["Werewolf", "Revenge", "Romance"],
    cover: coverPlaceholder("被拒绝的月光伴侣", "Werewolf"),
    poster: posterPlaceholder("被拒绝的月光伴侣", "被 Alpha 当场拒绝的那一刻，她的命运被彻底改写。"),
    description:
      "所有人都以为她是最差的选择，直到她觉醒隐藏血统，整个狼界开始重新洗牌。",
    episodes: buildEpisodes("alpha-rejected-mate", 36),
    i18n: {
      en: {
        title: "The Rejected Moon Mate",
        tagline: "The moment the Alpha rejected her, destiny rewrote itself.",
        description:
          "Everyone thought she was the weakest choice—until her hidden bloodline awakened and the wolf world had to reshuffle the board."
      }
    }
  },
  {
    id: "cold-ceo-secret-baby",
    title: "冷面总裁的隐藏萌宝",
    tagline: "她带着萌宝重返城市，却发现孩子爸是冷血前任。",
    category: "CEO",
    tags: ["CEO", "Romance", "Revenge"],
    cover: coverPlaceholder("冷面总裁的隐藏萌宝", "CEO"),
    poster: posterPlaceholder("冷面总裁的隐藏萌宝", "她带着萌宝重返城市，却发现孩子爸是冷血前任。"),
    isTrending: true,
    description:
      "五年前的一场误会让她离开，如今带着天才萌宝回归，却和冰山总裁展开一场拉扯甜虐战。",
    episodes: buildEpisodes("cold-ceo-secret-baby", 42),
    i18n: {
      en: {
        title: "Cold CEO & Secret Baby",
        tagline: "She returns with a secret baby—only to meet her cold ex again.",
        description:
          "A misunderstanding tore them apart five years ago. Now she comes back with a genius child, and the icy CEO can no longer pretend nothing happened."
      }
    }
  },
  {
    id: "exclusive-contract-lover",
    title: "总裁的专属合约恋人",
    tagline: "一年合约，条款写尽冷酷，却逐条被他亲手撕碎。",
    category: "CEO",
    tags: ["CEO", "Romance"],
    cover: coverPlaceholder("总裁的专属合约恋人", "CEO"),
    poster: posterPlaceholder("总裁的专属合约恋人", "一年合约，条款写尽冷酷，却逐条被他亲手撕碎。"),
    description:
      "她签下“禁止动心”的条款，却在每一晚并肩作战中，逐渐沦陷在他伪装下的温柔里。",
    episodes: buildEpisodes("exclusive-contract-lover", 30),
    i18n: {
      en: {
        title: "Exclusive Contract Lover",
        tagline: "A one-year contract written in cold terms—torn apart by him.",
        description:
          "She signs a no-love clause, but every late night at his side makes it harder to keep her heart out of the deal."
      }
    }
  },
  {
    id: "queen-back-from-hell",
    title: "地狱归来的复仇王后",
    tagline: "前世她被踩成尘埃，这一世她踩着仇人的血开局。",
    category: "Revenge",
    tags: ["Revenge", "Fantasy"],
    cover: coverPlaceholder("地狱归来的复仇王后", "Revenge"),
    poster: posterPlaceholder("地狱归来的复仇王后", "前世她被踩成尘埃，这一世她踩着仇人的血开局。"),
    description:
      "涅槃重生，她带着地狱印记回到权力中心，微笑着一层层揭开昔日背叛者的伪装。",
    episodes: buildEpisodes("queen-back-from-hell", 48),
    i18n: {
      en: {
        title: "Queen Back from Hell",
        tagline: "Crushed in her past life, she rises by stepping on her enemies.",
        description:
          "Reborn from the ashes, she returns to the throne with hell’s mark, calmly stripping away the masks of those who once destroyed her."
      }
    }
  },
  {
    id: "shadow-palace-time-loop",
    title: "影宫无限回档",
    tagline: "每一次死亡，都是下一次反杀的起点。",
    category: "Time Travel",
    tags: ["Time Travel", "Fantasy"],
    cover: coverPlaceholder("影宫无限回档", "Time Travel"),
    poster: posterPlaceholder("影宫无限回档", "每一次死亡，都是下一次反杀的起点。"),
    description:
      "她被困在同一天里，在一次次死亡与回档中，摸清皇宫每一道暗线，只为最后一击。",
    episodes: buildEpisodes("shadow-palace-time-loop", 32),
    i18n: {
      en: {
        title: "Shadow Palace Time Loop",
        tagline: "Every death is the starting point of the next counterattack.",
        description:
          "Trapped in the same deadly day, she uses each reset to map every hidden scheme in the palace—until she’s ready to strike once and for all."
      }
    }
  },
  {
    id: "witch-of-midnight-market",
    title: "午夜集市的契约女巫",
    tagline: "她用一纸契约，替人改命，也一步步改写自己的命运。",
    category: "Fantasy",
    tags: ["Fantasy", "Romance"],
    cover: coverPlaceholder("午夜集市的契约女巫", "Fantasy"),
    poster: posterPlaceholder("午夜集市的契约女巫", "她用一纸契约，替人改命，也一步步改写自己的命运。"),
    description:
      "午夜集市只对绝望之人开放，而她是唯一能和命运谈条件的女巫，却被一个闯入者盯上了心。",
    episodes: buildEpisodes("witch-of-midnight-market", 28),
    i18n: {
      en: {
        title: "The Witch of Midnight Market",
        tagline: "She rewrites others’ fates—and accidentally changes her own.",
        description:
          "The midnight market opens only for the desperate. She is the witch who bargains with destiny, until one uninvited guest starts bargaining for her heart."
      }
    }
  },
  {
    id: "parallel-world-roommate",
    title: "平行世界的隔壁室友",
    tagline: "她和隔壁的人从未见面，却共享同一段命运轨迹。",
    category: "Fantasy",
    tags: ["Fantasy", "Time Travel", "Romance"],
    cover: coverPlaceholder("平行世界的隔壁室友", "Fantasy"),
    poster: posterPlaceholder("平行世界的隔壁室友", "她和隔壁的人从未见面，却共享同一段命运轨迹。"),
    description:
      "每天凌晨零点，墙上的留言会被另一个世界的人回复，他们开始一点点改写彼此的人生。",
    episodes: buildEpisodes("parallel-world-roommate", 34),
    i18n: {
      en: {
        title: "Parallel World Roommate",
        tagline: "They never meet, yet share the same fate line.",
        description:
          "At midnight, messages on her wall are answered by someone from a parallel world. Their late-night notes slowly start to rewrite both timelines."
      }
    }
  },
  {
    id: "runaway-bride-back-to-boss",
    title: "逃婚新娘重返总裁身边",
    tagline: "她在婚礼上落跑，却被迫成了总裁的贴身秘书。",
    category: "Romance",
    tags: ["Romance", "CEO"],
    cover: coverPlaceholder("逃婚新娘重返总裁身边", "Romance"),
    poster: posterPlaceholder("逃婚新娘重返总裁身边", "她在婚礼上落跑，却被迫成了总裁的贴身秘书。"),
    description:
      "逃婚后她以为一切结束，没想到第一天上班就被分配到“前未婚夫”的办公室。",
    episodes: buildEpisodes("runaway-bride-back-to-boss", 30),
    i18n: {
      en: {
        title: "Runaway Bride Returns to the Boss",
        tagline: "She ran away from the wedding—only to become his assistant.",
        description:
          "She thought running from the wedding would end everything, until her new job assigned her straight into her ex-groom’s office."
      }
    }
  },
  {
    id: "werewolf-campus-secret",
    title: "狼人学院的隐藏校规",
    tagline: "新生手册里没有写的，是关于血脉觉醒的残酷真相。",
    category: "Werewolf",
    tags: ["Werewolf", "Fantasy"],
    cover: coverPlaceholder("狼人学院的隐藏校规", "Werewolf"),
    poster: posterPlaceholder("狼人学院的隐藏校规", "新生手册里没有写的，是关于血脉觉醒的残酷真相。"),
    description:
      "她以为自己拿到的是普通录取通知书，却被卷入一所只对狼族开放的学院。",
    episodes: buildEpisodes("werewolf-campus-secret", 26),
    i18n: {
      en: {
        title: "Werewolf Campus Secret",
        tagline: "The handbook never mentioned the bloody awakening rule.",
        description:
          "Accepted into what she thinks is a normal academy, she discovers the campus only truly opens to those with wolf blood."
      }
    }
  }
];

export const TRENDING_SERIES = SERIES_LIST.filter((s) => s.isTrending);

export const NEW_ARRIVALS = SERIES_LIST.filter((s) => s.isNew);
