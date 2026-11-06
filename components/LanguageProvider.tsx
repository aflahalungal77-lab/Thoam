"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Language = "en" | "ml";

const translations: Record<string, { en: string; ml: string }> = {
  "Home": { en: "Home", ml: "ഹോം" },
  "Restaurants": { en: "Restaurants", ml: "റെസ്റ്റോറന്റുകൾ" },
  "For restaurants": { en: "For restaurants", ml: "റെസ്റ്റോറന്റുകൾക്കായി" },
  "Log in": { en: "Log in", ml: "ലോഗിൻ" },
  "Log out": { en: "Log out", ml: "ലോഗ് ഔട്ട്" },
  "Order food": { en: "Order food", ml: "ഭക്ഷണം ഓർഡർ ചെയ്യുക" },
  "Challenges": { en: "Challenges", ml: "ചലഞ്ചുകൾ" },
  "My Orders": { en: "My Orders", ml: "എന്റെ ഓർഡറുകൾ" },
  "GOOD FOOD. RIGHT AROUND YOU.": { en: "GOOD FOOD. RIGHT AROUND YOU.", ml: "നല്ല ഭക്ഷണം. നിങ്ങൾക്ക് സമീപം." },
  "Your next": { en: "Your next", ml: "നിങ്ങളുടെ അടുത്ത" },
  "favourite bite.": { en: "favourite bite.", ml: "പ്രിയപ്പെട്ട രുചി." },
  "Discover local restaurants, explore delicious food and order your favourites with Tho’am.": { en: "Discover local restaurants, explore delicious food and order your favourites with Tho’am.", ml: "നാട്ടിലെ റെസ്റ്റോറന്റുകൾ കണ്ടെത്തൂ, രുചികരമായ വിഭവങ്ങൾ പരിചയപ്പെടൂ, ഇഷ്ടപ്പെട്ട ഭക്ഷണം Tho’am വഴി ഓർഡർ ചെയ്യൂ." },
  "Search biryani, burgers, restaurants...": { en: "Search biryani, burgers, restaurants...", ml: "ബിരിയാണി, ബർഗർ, റെസ്റ്റോറന്റുകൾ തിരയൂ..." },
  "Explore food": { en: "Explore food", ml: "ഭക്ഷണം കണ്ടെത്തൂ" },
  "Become a partner": { en: "Become a partner", ml: "പാർട്ണറാകൂ" },
  "Local restaurants": { en: "Local restaurants", ml: "പ്രാദേശിക റെസ്റ്റോറന്റുകൾ" },
  "Cash on delivery": { en: "Cash on delivery", ml: "ക്യാഷ് ഓൺ ഡെലിവറി" },
  "QR table ordering": { en: "QR table ordering", ml: "QR ടേബിൾ ഓർഡറിംഗ്" },
  "EXPLORE THE MENU": { en: "EXPLORE THE MENU", ml: "മെനു പരിചയപ്പെടാം" },
  "What are you craving?": { en: "What are you craving?", ml: "ഇന്ന് എന്താണ് കഴിക്കാൻ തോന്നുന്നത്?" },
  "All restaurants": { en: "All restaurants", ml: "എല്ലാ റെസ്റ്റോറന്റുകളും" },
  "All": { en: "All", ml: "എല്ലാം" },
  "Biryani": { en: "Biryani", ml: "ബിരിയാണി" },
  "Meals": { en: "Meals", ml: "ഊണ്" },
  "Fast Food": { en: "Fast Food", ml: "ഫാസ്റ്റ് ഫുഡ്" },
  "Snacks": { en: "Snacks", ml: "സ്നാക്ക്സ്" },
  "Drinks": { en: "Drinks", ml: "പാനീയങ്ങൾ" },
  "MADE BY LOCAL KITCHENS": { en: "MADE BY LOCAL KITCHENS", ml: "നാട്ടിലെ അടുക്കളകളിൽ നിന്ന്" },
  "Worth every bite.": { en: "Worth every bite.", ml: "ഓരോ കടിയും രുചികരം." },
  "Discover dishes from restaurants around you.": { en: "Discover dishes from restaurants around you.", ml: "നിങ്ങൾക്ക് സമീപമുള്ള റെസ്റ്റോറന്റുകളിലെ വിഭവങ്ങൾ കണ്ടെത്തൂ." },
  "View menu": { en: "View menu", ml: "മെനു കാണുക" },
  "Discovering delicious food...": { en: "Discovering delicious food...", ml: "രുചികരമായ ഭക്ഷണം കണ്ടെത്തുന്നു..." },
  "Vegetarian": { en: "Vegetarian", ml: "വെജിറ്റേറിയൻ" },
  "Non-vegetarian": { en: "Non-vegetarian", ml: "നോൺ വെജിറ്റേറിയൻ" },
  "Freshly prepared": { en: "Freshly prepared", ml: "പുതുതായി തയ്യാറാക്കിയത്" },
  "Explore restaurant": { en: "Explore restaurant", ml: "റെസ്റ്റോറന്റ് കാണുക" },
  "No matching dishes": { en: "No matching dishes", ml: "പൊരുത്തപ്പെടുന്ന വിഭവങ്ങളില്ല" },
  "Good food is on its way.": { en: "Good food is on its way.", ml: "രുചികരമായ വിഭവങ്ങൾ ഉടൻ ലഭ്യമാകും." },
  "Try another search or choose a different category.": { en: "Try another search or choose a different category.", ml: "മറ്റൊരു തിരച്ചിൽ നടത്തുക അല്ലെങ്കിൽ മറ്റൊരു വിഭാഗം തിരഞ്ഞെടുക്കുക." },
  "Explore our restaurant directory to discover available menus.": { en: "Explore our restaurant directory to discover available menus.", ml: "ലഭ്യമായ മെനുകൾ കാണാൻ റെസ്റ്റോറന്റ് ലിസ്റ്റ് പരിശോധിക്കുക." },
  "Clear filters": { en: "Clear filters", ml: "ഫിൽട്ടറുകൾ നീക്കുക" },
  "Explore restaurants": { en: "Explore restaurants", ml: "റെസ്റ്റോറന്റുകൾ കണ്ടെത്തൂ" },
  "Choose language": { en: "Choose language", ml: "ഭാഷ തിരഞ്ഞെടുക്കുക" },
};

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (text: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("thoam-language");
      if (saved === "en" || saved === "ml") setLanguageState(saved);
    } catch {
      // Keep English when browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "ml" ? "ml" : "en";
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem("thoam-language", next);
    } catch {
      // Language still changes for the current session.
    }
  }, []);

  const t = useCallback((text: string) => translations[text]?.[language] ?? text, [language]);
  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
