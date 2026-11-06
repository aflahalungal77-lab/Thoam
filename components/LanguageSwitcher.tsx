"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="thoam-language-switcher" role="group" aria-label="Choose language">
      <Languages size={15} aria-hidden="true" />
      <button
        type="button"
        className={language === "ml" ? "is-active" : ""}
        aria-pressed={language === "ml"}
        onClick={() => setLanguage("ml")}
      >
        മലയാളം
      </button>
      <span aria-hidden="true">/</span>
      <button
        type="button"
        className={language === "en" ? "is-active" : ""}
        aria-pressed={language === "en"}
        onClick={() => setLanguage("en")}
      >
        English
      </button>
    </div>
  );
}
