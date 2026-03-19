"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    google?: any;
    googleTranslateElementInit?: () => void;
  }
}

const SCRIPT_SRC =
  "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";

const INCLUDED_LANGS =
  "en,zh-CN,es,fr,de,ja,ko";

export function GoogleTranslateWidget({ language }: { language: string }) {
  useEffect(() => {
    // Avoid double-injecting
    if (document.getElementById("google-translate-script")) return;

    window.googleTranslateElementInit = () => {
      if (!window.google?.translate) return;
      new window.google.translate.TranslateElement(
        {
          pageLanguage: "en",
          includedLanguages: INCLUDED_LANGS,
          layout: window.google.translate.TranslateElement.InlineLayout
        },
        "google_translate_element"
      );
    };

    const script = document.createElement("script");
    script.id = "google-translate-script";
    script.src = SCRIPT_SRC;
    script.async = true;
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    // Apply language after widget is initialized
    const apply = () => {
      const select = document.querySelector(
        "select.goog-te-combo"
      ) as HTMLSelectElement | null;
      if (!select) return false;
      const option = Array.from(select.options).find(
        (o) => o.value === language
      );
      if (!option) return false;
      select.value = language;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    };

    // Poll briefly because widget initializes async
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      if (apply() || tries > 30) window.clearInterval(id);
    }, 250);

    return () => window.clearInterval(id);
  }, [language]);

  return (
    <div
      id="google_translate_element"
      className="hidden"
      // Helps prevent layout shift
      aria-hidden="true"
    />
  );
}

