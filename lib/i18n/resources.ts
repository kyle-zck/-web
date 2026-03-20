import type { AppLanguage } from "./languages";

export const resources: Record<AppLanguage, any> = {
  "en": {
    common: {
      nav: {
        home: "Home",
        explore: "Explore",
        library: "My Library",
        profile: "My Profile",
        search: "Search"
      },
      open: "Open",
      loading: "Loading...",
      backHome: "Back to Home",
      uidLabel: "UID",
      brandTagline: "每一秒都是剧情",
      auth: {
        signinTitle: "Sign In",
        signupTitle: "Sign Up",
        signinTab: "Sign In",
        signupTab: "Sign Up",
        later: "Not now",
        loggedInDemo: "Logged in (Demo). You can close this dialog and continue using the app.",
        socialDemo: "Quick access via third-party social accounts (UI demo).",
        continueGoogle: "Continue with Google",
        continueFacebook: "Continue with Facebook",
        continueApple: "Continue with Apple",
        note: "Note: This page has no real OAuth logic; it only demonstrates the Sign In / Sign Up UI."
      },
      search: {
        placeholder: "Search by drama name or description...",
        button: "Search",
        help: "Search will match title + description."
      },
      home: {
        continueWatching: "Continue Watching",
        categories: "Categories",
        newRelease: "New Release",
        trendingDramas: "Trending Dramas",
        hiddenIdentity: "Hidden Identity",
        loveAtFirstSight: "Love at First Sight",
        magicAndMates: "Magic & Mates",
        secondChance: "Second Chance",
        moreMovies: "More Movies",
        featured: "Featured Drama",
        episodesCount: "{{count}} Episodes",
        watched: "watched",
        itemsCount: "{{count}} items",
        resultsFound: "Found {{count}} results for “{{query}}”",
        viewAll: "View all",
        moreMoviesCta: "More Movies"
      },
      explore: {
        all: "All",
        expand: "Expand",
        collapse: "Collapse",
        moviesOfAllActors: "Movies of All Actors",
        actors: "Actors",
        tabs: {
          actors: "Actors",
          actresses: "Actresses",
          identities: "Identities",
          storyBeats: "Story Beats"
        }
      },
      library: {
        title: "My Library",
        subtitle: "Saved, Continue Watching, and History"
      },
      libraryPage: {
        placeholderTitle: "Placeholder",
        placeholderSubtitle: "Content will be connected later."
      },
      series: {
        play: "Play",
        free: "Free",
        locked: "Locked",
        episodeLabel: "Episode {{index}}",
        episodeLabelZh: "第 {{index}} 集"
      },
      tags: {
        Romance: "Romance",
        Revenge: "Revenge",
        Werewolf: "Werewolf",
        CEO: "CEO",
        Fantasy: "Fantasy",
        timeTravel: "Time Travel"
      },
      profile: {
        myTitle: "My",
        manageSubtitle: "Account & Coin Management",
        login: "Login",
        logout: "Logout",
        userId: "User ID",
        coins: "Coins",
        coinBalance: "Coin Balance",
        watchedHistory: "Watched History",
        notLoggedIn: "Not logged in",
        watchAdToEarn: "Watch Ad to Earn",
        toStore: "Top Up",
        guest: "Guest",
        user: "User",
        bonus: "Bonus",
        watchHistoryCount: "Watched {{count}} items",
        noHistory: "No records",
        emptyGrid: "Watch any episode to see your progress records.",
        goToMore: "Go check more",
        moreHistory: "More Watching History",
        recentUpdates: "Recent",
        topN: "Top {{count}}",
        noGridContent: "No content yet. Start watching any drama from the home page.",
        earnCoinsDemoTitle: "Earn Coins (Demo)",
        iKnow: "Got it",
        earnCoinsDemoBody:
          "This is the UI demo entry for “Watch Ad to Earn Coins”. Next we will connect real ads & billing.",
        watchedAt: "Watched {{time}}",
        earnAdHint: "UI demo button - it will not actually add coins.",
        emptyHistory: "Watch any episode to see your history."
      },
      store: {
        title: "Coin Store",
        bestValue: "Best Value",
        rechargeHint: "Top up Coins to unlock more content",
        currentBalance: "Current Balance",
        best: "Best",
        demoOnlyHint: "This demo UI only shows the payment entry; backend payment is not connected.",
        priceLabel: "Price",
        coinsLabel: "金币",
        unlockHint: "Unlockable: Paid content from 4+ episodes",
        choosePay: "Choose and Pay",
        paymentMethodTitle: "Payment Methods (Demo)",
        paymentHint: "Next: integrate real Stripe/PayPal SDK to handle callbacks and order validation.",
        checkoutTitle: "Checkout (Demo)",
        close: "Close",
        selectedProvider: "Selected: {{provider}}. Here we should call the payment SDK and handle callbacks. (Demo: no real transaction.)",
        selectProviderCta: "Please select Stripe or PayPal to continue (Demo).",
        noPackageSelected: "No package selected."
      },
      seriesDetail: {
        selectEpisodes: "Select Episodes",
        description: "Description",
        youMayAlsoLike: "You May Also Like",
        recommendedForYou: "Recommended For You",
        episodesHint: "Episodes 1-3 are free preview. Episodes 4+ are locked (Coins required).",
        copiedLink: "Link copied",
        plotOfEpisode: "Plot of Episode {{index}}",
        more: "...More",
        less: "Less",
        allEpisodes: "All Episodes",
        coinBalance: "Coin Balance",
        addCoins: "+ Coins",
        likes: "Likes",
        favorites: "Favorites",
        share: "Share"
      },
      locked: {
        title: "This episode is locked",
        hintFree: "FREE",
        hintLocked: "LOCKED · Need {{cost}} Coins",
        unlock: "Use {{cost}} Coins to unlock",
        next: "Next episode",
        body: "Episode {{index}} is paid content. Episodes 1-3 are free preview."
      },
    }
  },
  "zh-CN": {
    common: {
      nav: {
        home: "首页",
        explore: "探索",
        library: "片单",
        profile: "我的",
        search: "搜索"
      },
      open: "打开",
      loading: "加载中…",
      backHome: "返回首页",
      uidLabel: "UID",
      brandTagline: "Every Second Is Drama",
      auth: {
        signinTitle: "登录",
        signupTitle: "注册",
        signinTab: "登录",
        signupTab: "注册",
        later: "以后再说",
        loggedInDemo: "已登录（Demo）。你可以关闭弹窗继续使用。",
        socialDemo: "通过第三方社交账号快速进入（UI 演示）。",
        continueGoogle: "继续使用 Google",
        continueFacebook: "继续使用 Facebook",
        continueApple: "继续使用 Apple",
        note: "注：本页面无真实 OAuth 逻辑，仅用于展示“登录/注册”交互与布局。"
      },
      search: {
        placeholder: "通过剧集名称或简介搜索...",
        button: "搜索"
      },
      home: {
        continueWatching: "继续观看",
        categories: "分类",
        newRelease: "最新上架",
        trendingDramas: "正在热播",
        hiddenIdentity: "Hidden Identity",
        loveAtFirstSight: "Love at First Sight",
        magicAndMates: "Magic & Mates",
        secondChance: "Second Chance",
        moreMovies: "更多电影",
        featured: "精选短剧",
        episodesCount: "共 {{count}} 集",
        watched: "已观看",
        itemsCount: "{{count}} 条",
        resultsFound: "找到 {{count}} 条结果：“{{query}}”",
        viewAll: "查看全部",
        moreMoviesCta: "更多电影"
      },
      explore: {
        all: "全部",
        expand: "展开",
        collapse: "收起",
        moviesOfAllActors: "全部演员的作品",
        actors: "演员",
        tabs: {
          actors: "演员",
          actresses: "女演员",
          identities: "身份",
          storyBeats: "情节"
        }
      },
      library: {
        title: "片单",
        subtitle: "收藏、继续观看与历史记录"
      },
      libraryPage: {
        placeholderTitle: "占位内容",
        placeholderSubtitle: "后续可接入：继续观看、收藏列表、观看历史。"
      },
      series: {
        play: "播放",
        free: "免费",
        locked: "已锁定",
        episodeLabel: "第 {{index}} 集",
        episodeLabelZh: "第 {{index}} 集"
      },
      tags: {
        Romance: "爱情",
        Revenge: "复仇",
        Werewolf: "狼人",
        CEO: "总裁",
        Fantasy: "奇幻",
        timeTravel: "时间旅行"
      },
      profile: {
        myTitle: "我的",
        manageSubtitle: "账号与金币管理",
        login: "登录 / 注册",
        logout: "退出",
        userId: "用户 ID",
        coins: "金币",
        coinBalance: "金币余额",
        watchedHistory: "观看历史",
        notLoggedIn: "未登录",
        watchAdToEarn: "看广告得金币",
        toStore: "充值",
        guest: "游客",
        user: "用户",
        bonus: "奖金",
        watchHistoryCount: "已观看 {{count}} 条",
        noHistory: "暂无记录",
        emptyGrid: "播放任意一集后，这里会出现观看进度记录。",
        goToMore: "去看看更多",
        moreHistory: "更多观看历史",
        recentUpdates: "最近更新",
        topN: "Top {{count}}",
        noGridContent: "暂无内容。你可以先在首页点任意剧集开始观看。",
        earnCoinsDemoTitle: "Earn Coins（Demo）",
        iKnow: "我知道了",
        earnCoinsDemoBody:
          "这里是“看广告得金币”的 UI 演示入口（下一步接入真实广告与计费）。",
        watchedAt: "已看 {{time}}",
        earnAdHint: "UI 演示按钮，不会真实增加金币。",
        emptyHistory: "观看任意一集后会显示你的历史记录。"
      },
      store: {
        title: "金币商店",
        bestValue: "最佳性价比",
        rechargeHint: "充值 Coins 以解锁更多内容",
        currentBalance: "当前余额",
        best: "最佳",
        demoOnlyHint: "本演示页面仅展示 UI 与交易入口占位，后端支付未接入。",
        priceLabel: "价格",
        coinsLabel: "Coins",
        unlockHint: "适合解锁：4+ 集付费内容",
        choosePay: "选择并支付",
        paymentMethodTitle: "支付方式（占位）",
        paymentHint: "下一步：接入真实 Stripe/PayPal SDK，完成支付回调与订单验证。",
        checkoutTitle: "Checkout（占位）",
        close: "关闭",
        selectedProvider:
          "已选择：{{provider}}。此处应调用对应支付 SDK 并处理回调。（Demo 占位，不会产生真实交易）",
        selectProviderCta: "请选择 Stripe 或 PayPal 继续（占位）。",
        noPackageSelected: "没有选择套餐。"
      },
      seriesDetail: {
        selectEpisodes: "选集",
        description: "剧情简介",
        youMayAlsoLike: "猜你喜欢",
        recommendedForYou: "推荐给你",
        episodesHint: "1-3 集免费，4+ 集锁定（可用 Coins 解锁）",
        copiedLink: "已复制链接",
        plotOfEpisode: "第 {{index}} 集剧情",
        more: "...更多",
        less: "收起",
        allEpisodes: "全部剧集",
        coinBalance: "金币余额",
        addCoins: "+ 充值",
        likes: "点赞",
        favorites: "收藏",
        share: "分享"
      },
      locked: {
        title: "该集已锁定",
        hintFree: "免费",
        hintLocked: "已锁定 · 需要 {{cost}} Coins 解锁",
        unlock: "使用 {{cost}} Coins 解锁",
        next: "下一集",
        body: "第 {{index}} 集为付费内容。前 1-3 集免费试看。"
      }
    }
  }
};

