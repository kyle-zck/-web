import type { SubscriptionPlan } from "@/constants/mock-data";

/** SEO / 站点元信息 */
export interface AppConfigSeo {
  /** 浏览器标签与 Open Graph 标题（默认用 brandName） */
  siteTitle?: string;
  siteDescription?: string;
  ogImageUrl?: string;
  /** html lang */
  defaultLocale?: "en" | "zh-CN";
}

/** 主导航可见性（首页始终保留为品牌入口） */
export interface AppConfigNav {
  showExplore?: boolean;
  showProfile?: boolean;
}

/** 首页模块开关与置顶剧目 */
export interface AppConfigHome {
  showContinueWatching?: boolean;
  showNewRelease?: boolean;
  showTrending?: boolean;
  /** 分类标签行（Romance / Revenge 等四行） */
  showCategoryRows?: boolean;
  /** 轮播优先展示的剧目 ID，顺序即轮播顺序；空则按「新上线」逻辑 */
  featuredSeriesIds?: string[];
}

/** 页脚法务外链 */
export interface AppConfigLegal {
  termsUrl?: string;
  privacyUrl?: string;
}

export type StorePaymentMethod = {
  id: string;
  label: string;
  icon: string;
};

export interface AppConfigStore {
  title?: string;
  subtitle?: string;
  tips?: string[];
  paymentMethods?: StorePaymentMethod[];
}

/**
 * 全站可配置项（公开 API 返回；含订阅套餐等敏感度低的展示数据）
 * 与旧版兼容：brandName + subscriptionPlans 为必填语义
 */
export interface AppConfig {
  brandName: string;
  /** 可选：顶栏 Logo 图片 URL；留空则用默认圆形 Rs 图标 */
  logoUrl?: string;
  subscriptionPlans: SubscriptionPlan[];
  seo?: AppConfigSeo;
  nav?: AppConfigNav;
  home?: AppConfigHome;
  legal?: AppConfigLegal;
  store?: AppConfigStore;
}
