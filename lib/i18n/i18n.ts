import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import type { AppLanguage } from "./languages";
import { en } from "./en";

const defaultLng: AppLanguage = "en";

/** 中文翻译：默认用户不需要，首次切换语言时通过动态 import 按需加载 */
const lazyLoadZh = () => import("./zh-CN").then((m) => ({ default: m.zhCN }));

if (!i18next.isInitialized) {
  void i18next
    .use(initReactI18next)
    .init({
      resources: {
        en: { common: en }
      },
      lng: defaultLng,
      fallbackLng: defaultLng,
      supportedLngs: ["en", "zh-CN"],
      ns: ["common"],
      defaultNS: "common",
      interpolation: { escapeValue: false },
      // i18next-http-backend 不使用；中文通过 lazyLoadZh 注入
      partialBundledLanguages: true
    })
    .then(() => {
      // 注册中文 namespace（内容在切换语言时才真正加载）
      if (!i18next.hasResourceBundle("zh-CN", "common")) {
        i18next.addResourceBundle("zh-CN", "common", {}, true, true);
      }
    });
}

/**
 * 切换语言时，异步加载对应翻译文件。
 * i18next 发现某语言没有已加载资源时会调用此函数（需要 i18next-http-backend，
 * 但我们这里直接手动注入：通过 loadLanguages → hasLoadedNamespace 判断。
 */
export function preloadLanguageBundle(lang: AppLanguage): Promise<void> {
  if (lang === "zh-CN") {
    return lazyLoadZh().then((bundle) => {
      i18next.addResourceBundle("zh-CN", "common", bundle.default, true, true);
    });
  }
  return Promise.resolve();
}

export default i18next;
