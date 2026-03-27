import type { AppConfig } from "./types";

export const DEFAULT_APP_CONFIG: AppConfig = {
  brandName: "ReelShorts",
  logoUrl: "",
  subscriptionPlans: [
    {
      id: "monthly",
      templateName: "Monthly VIP",
      label: "Monthly VIP",
      priceUsd: 29.9,
      durationDays: 30,
      discountPercent: 100,
      discountDays: 0,
      paymentUrl: "/store?plan=monthly"
    },
    {
      id: "weekly",
      templateName: "Weekly VIP",
      label: "Weekly VIP",
      priceUsd: 19.99,
      durationDays: 7,
      discountPercent: 100,
      discountDays: 0,
      paymentUrl: "/store?plan=weekly"
    },
    {
      id: "yearly",
      templateName: "Yearly VIP",
      label: "Yearly VIP",
      priceUsd: 199.99,
      durationDays: 365,
      discountPercent: 100,
      discountDays: 0,
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
  store: {
    title: "VIP Unlock all series for free",
    subtitle: "Auto renew. Cancel anytime.",
    tips: [
      "Free and paid content available. You decide which to unlock.",
      "VIP subscription unlocks all paid content.",
      "Refill and countdown days are equal value. Recharge does not support refund.",
      "Contact us if you have other problems."
    ]
  }
};
