import type { AppConfig } from "./types";

export const DEFAULT_APP_CONFIG: AppConfig = {
  brandName: "ReelShorts",
  logoUrl: "",
  subscriptionPlans: [
    {
      id: "monthly",
      label: "Monthly VIP",
      priceUsd: 29.9,
      durationDays: 30,
      paymentUrl: "/store?plan=monthly"
    },
    {
      id: "weekly",
      label: "Weekly VIP",
      priceUsd: 19.99,
      durationDays: 7,
      paymentUrl: "/store?plan=weekly"
    },
    {
      id: "yearly",
      label: "Yearly VIP",
      priceUsd: 199.99,
      durationDays: 365,
      paymentUrl: "/store?plan=yearly"
    }
  ],
  seo: {
    siteTitle: "ReelShorts",
    siteDescription: "Watch bite-sized dramas anytime.",
    ogImageUrl: "",
    defaultLocale: "zh-CN",
  },
  nav: {
    showExplore: true,
    showProfile: true,
  },
  home: {
    showContinueWatching: true,
    showNewRelease: true,
    showTrending: true,
    showCategoryRows: true,
    featuredSeriesIds: [],
  },
  legal: {
    termsUrl: "",
    privacyUrl: "",
  },
};
