"use client";

import { useEffect, useState } from "react";

type Language = "en" | "ml";

const STORAGE_KEY = "thoam-language";

const translations: Record<string, string> = {
  "Home": "ഹോം",
  "Restaurants": "റെസ്റ്റോറന്റുകൾ",
  "For restaurants": "റെസ്റ്റോറന്റുകൾക്ക്",
  "Log in": "ലോഗിൻ",
  "Log out": "ലോഗ് ഔട്ട്",
  "Order food": "ഭക്ഷണം ഓർഡർ ചെയ്യുക",
  "Explore food": "ഭക്ഷണം കണ്ടെത്തുക",
  "Become a partner": "പങ്കാളിയാകുക",
  "My Orders": "എന്റെ ഓർഡറുകൾ",
  "Challenges": "ചലഞ്ചുകൾ",
  "Search food": "ഭക്ഷണം തിരയുക",
  "Search": "തിരയുക",
  "Search biryani, burgers, restaurants...": "ബിരിയാണി, ബർഗർ, റെസ്റ്റോറന്റുകൾ തിരയുക...",
  "GOOD FOOD. RIGHT AROUND YOU.": "നല്ല ഭക്ഷണം. നിങ്ങളുടെ തൊട്ടടുത്ത്.",
  "Your next": "നിങ്ങളുടെ അടുത്ത",
  "favourite": "പ്രിയപ്പെട്ട",
  "bite.": "വിഭവം.",
  "Discover local restaurants, explore delicious food and order your favourites with Tho’am.": "നാട്ടിലെ റെസ്റ്റോറന്റുകൾ കണ്ടെത്തൂ, രുചികരമായ വിഭവങ്ങൾ തിരയൂ, ഇഷ്ടപ്പെട്ട ഭക്ഷണം Tho’am വഴി ഓർഡർ ചെയ്യൂ.",
  "Local restaurants": "പ്രാദേശിക റെസ്റ്റോറന്റുകൾ",
  "Cash on delivery": "പണം നൽകി ഓർഡർ സ്വീകരിക്കുക",
  "QR table ordering": "QR വഴി ടേബിൾ ഓർഡർ",
  "Something delicious.": "രുചികരമായ എന്തോ ഒന്ന്.",
  "Just around the corner.": "തൊട്ടടുത്ത് തന്നെ.",
  "Dining in?": "റെസ്റ്റോറന്റിൽ ഇരുന്ന് കഴിക്കുകയാണോ?",
  "Scan. Order. Enjoy.": "സ്കാൻ ചെയ്യൂ. ഓർഡർ ചെയ്യൂ. ആസ്വദിക്കൂ.",
  "EXPLORE THE MENU": "മെനു കാണാം",
  "What are you craving?": "ഇന്ന് എന്താണ് കഴിക്കാൻ തോന്നുന്നത്?",
  "All restaurants": "എല്ലാ റെസ്റ്റോറന്റുകളും",
  "All": "എല്ലാം",
  "Biryani": "ബിരിയാണി",
  "Meals": "ഊണ്",
  "Fast Food": "ഫാസ്റ്റ് ഫുഡ്",
  "Snacks": "ലഘുഭക്ഷണം",
  "Drinks": "പാനീയങ്ങൾ",
  "MADE BY LOCAL KITCHENS": "നാട്ടിലെ അടുക്കളകളിൽ തയ്യാറാക്കിയത്",
  "Worth every bite.": "ഓരോ കടിയും രുചികരം.",
  "Discover dishes from restaurants around you.": "നിങ്ങളുടെ അടുത്തുള്ള റെസ്റ്റോറന്റുകളിലെ വിഭവങ്ങൾ കണ്ടെത്തൂ.",
  "View menu": "മെനു കാണുക",
  "Discovering delicious food...": "രുചികരമായ ഭക്ഷണം കണ്ടെത്തുന്നു...",
  "Freshly prepared": "പുതുതായി തയ്യാറാക്കിയത്",
  "Explore restaurant": "റെസ്റ്റോറന്റ് കാണുക",
  "No matching dishes": "ചേരുന്ന വിഭവങ്ങളൊന്നും കണ്ടെത്തിയില്ല",
  "Good food is on its way.": "നല്ല ഭക്ഷണം ഉടൻ ലഭ്യമാകും.",
  "Try another search or choose a different category.": "മറ്റൊരു വാക്ക് തിരയുകയോ വേറെ വിഭാഗം തിരഞ്ഞെടുക്കുകയോ ചെയ്യൂ.",
  "Explore our restaurant directory to discover available menus.": "ലഭ്യമായ മെനുകൾ കാണാൻ റെസ്റ്റോറന്റുകളുടെ പട്ടിക പരിശോധിക്കൂ.",
  "Clear filters": "ഫിൽട്ടറുകൾ നീക്കുക",
  "Explore restaurants": "റെസ്റ്റോറന്റുകൾ കണ്ടെത്തുക",
  "Vegetarian": "വെജിറ്റേറിയൻ",
  "Non-vegetarian": "നോൺ വെജിറ്റേറിയൻ",
  "VEG": "വെജ്",
  "NON-VEG": "നോൺ വെജ്",
  "Loading...": "ലോഡ് ചെയ്യുന്നു...",
  "Please wait...": "ദയവായി കാത്തിരിക്കുക...",
  "Save": "സേവ് ചെയ്യുക",
  "Cancel": "റദ്ദാക്കുക",
  "Close": "അടയ്ക്കുക",
  "Back": "തിരികെ",
  "Continue": "തുടരുക",
  "Submit": "സമർപ്പിക്കുക",
  "Confirm": "സ്ഥിരീകരിക്കുക",
  "Delete": "ഡിലീറ്റ് ചെയ്യുക",
  "Edit": "എഡിറ്റ് ചെയ്യുക",
  "Add": "ചേർക്കുക",
  "Update": "അപ്ഡേറ്റ് ചെയ്യുക",
  "Name": "പേര്",
  "Phone": "ഫോൺ",
  "Email": "ഇമെയിൽ",
  "Address": "വിലാസം",
  "Price": "വില",
  "Quantity": "എണ്ണം",
  "Status": "നില",
  "Available": "ലഭ്യമാണ്",
  "Unavailable": "ലഭ്യമല്ല",
  "Open": "തുറന്നിരിക്കുന്നു",
  "Closed": "അടച്ചിരിക്കുന്നു",
  "Today": "ഇന്ന്",
  "Yesterday": "ഇന്നലെ",
  "Total": "ആകെ",
  "Orders": "ഓർഡറുകൾ",
  "Products": "ഉൽപ്പന്നങ്ങൾ",
  "Dashboard": "ഡാഷ്ബോർഡ്",
  "Settings": "ക്രമീകരണങ്ങൾ",
  "Profile": "പ്രൊഫൈൽ",
  "My Profile": "എന്റെ പ്രൊഫൈൽ",
  "Cart": "കാർട്ട്",
  "Checkout": "ചെക്ക്ഔട്ട്",
  "Place order": "ഓർഡർ നൽകുക",
  "Order now": "ഇപ്പോൾ ഓർഡർ ചെയ്യുക",
  "Track order": "ഓർഡർ ട്രാക്ക് ചെയ്യുക",
  "Order details": "ഓർഡർ വിവരങ്ങൾ",
  "Order history": "ഓർഡർ ചരിത്രം",
  "Payment": "പേയ്മെന്റ്",
  "Cash on Delivery": "ക്യാഷ് ഓൺ ഡെലിവറി",
  "Delivery": "ഡെലിവറി",
  "Dine in": "റെസ്റ്റോറന്റിൽ ഇരുന്ന് കഴിക്കുക",
  "Table": "ടേബിൾ",
  "Scan QR code": "QR കോഡ് സ്കാൻ ചെയ്യുക",
  "Add to cart": "കാർട്ടിൽ ചേർക്കുക",
  "Remove": "നീക്കം ചെയ്യുക",
  "Subtotal": "ആകെ തുക",
  "Grand total": "മൊത്തം തുക",
  "Your cart is empty": "നിങ്ങളുടെ കാർട്ട് കാലിയാണ്",
  "No orders yet": "ഇതുവരെ ഓർഡറുകളില്ല",
  "Login": "ലോഗിൻ",
  "Sign up": "സൈൻ അപ്പ്",
  "Sign in": "സൈൻ ഇൻ",
  "Create account": "അക്കൗണ്ട് സൃഷ്ടിക്കുക",
  "Password": "പാസ്‌വേഡ്",
  "Forgot password?": "പാസ്‌വേഡ് മറന്നോ?",
  "Welcome back": "വീണ്ടും സ്വാഗതം",
  "Restaurant": "റെസ്റ്റോറന്റ്",
  "Restaurant name": "റെസ്റ്റോറന്റിന്റെ പേര്",
  "Manage restaurant": "റെസ്റ്റോറന്റ് നിയന്ത്രിക്കുക",
  "Manage products": "ഉൽപ്പന്നങ്ങൾ നിയന്ത്രിക്കുക",
  "Manage orders": "ഓർഡറുകൾ നിയന്ത്രിക്കുക",
  "Today's orders": "ഇന്നത്തെ ഓർഡറുകൾ",
  "Top selling product": "ഏറ്റവും കൂടുതൽ വിറ്റ ഉൽപ്പന്നം",
  "No data found": "വിവരങ്ങളൊന്നും കണ്ടെത്തിയില്ല",
  "Something went wrong": "എന്തോ പിശക് സംഭവിച്ചു",
  "Try again": "വീണ്ടും ശ്രമിക്കുക",
  "Required": "നിർബന്ധമാണ്",
  "Language": "ഭാഷ",
};

const textOriginals = new WeakMap<Text, string>();
const textApplied = new WeakMap<Text, string>();
const attrOriginals = new WeakMap<Element, Map<string, string>>();
const attrApplied = new WeakMap<Element, Map<string, string>>();
const ATTRS = ["placeholder", "title", "aria-label"] as const;

function translateTextNode(node: Text, language: Language) {
  const current = node.nodeValue ?? "";
  const previousApplied = textApplied.get(node);
  let original = textOriginals.get(node);

  if (original === undefined || (previousApplied !== undefined && current !== previousApplied)) {
    original = current;
    textOriginals.set(node, original);
  }

  const trimmed = original.trim();
  const translated = language === "ml" ? translations[trimmed] : original;
  if (translated === undefined) return;

  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  const nextValue = language === "ml" ? leading + translated + trailing : original;

  if (current !== nextValue) {
    node.nodeValue = nextValue;
    textApplied.set(node, nextValue);
  } else if (previousApplied !== undefined) {
    textApplied.set(node, nextValue);
  }
}

function translateElement(element: Element, language: Language) {
  let originals = attrOriginals.get(element);
  if (!originals) {
    originals = new Map<string, string>();
    attrOriginals.set(element, originals);
  }

  let applied = attrApplied.get(element);
  if (!applied) {
    applied = new Map<string, string>();
    attrApplied.set(element, applied);
  }

  for (const attr of ATTRS) {
    const current = element.getAttribute(attr);
    if (current === null) continue;

    const previousApplied = applied.get(attr);
    let original = originals.get(attr);
    if (original === undefined || (previousApplied !== undefined && current !== previousApplied)) {
      original = current;
      originals.set(attr, original);
    }

    const translated = language === "ml" ? translations[original.trim()] : original;
    if (translated === undefined) continue;
    if (current !== translated) {
      element.setAttribute(attr, translated);
      applied.set(attr, translated);
    }
  }
}

function translateSubtree(root: Node, language: Language) {
  if (root.nodeType === Node.TEXT_NODE) {
    const text = root as Text;
    const parent = text.parentElement;
    if (parent && !parent.closest("script, style, noscript, textarea, input, select, option, [contenteditable='true'], [data-no-translate]")) {
      translateTextNode(text, language);
    }
    return;
  }

  if (!(root instanceof Element) && root !== document.body) return;
  const elementRoot = root as Element;
  if (elementRoot instanceof Element) translateElement(elementRoot, language);
  elementRoot.querySelectorAll("*").forEach((element) => translateElement(element, language));

  const walker = document.createTreeWalker(elementRoot, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    const parent = text.parentElement;
    if (!parent || parent.closest("script, style, noscript, textarea, input, select, option, [contenteditable='true'], [data-no-translate]")) continue;
    translateTextNode(text, language);
  }
}

function translatePage(language: Language) {
  document.documentElement.lang = language === "ml" ? "ml" : "en";
  translateSubtree(document.body, language);
}

export default function LanguageSystem() {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "ml" || saved === "en") setLanguage(saved);
    } catch {
      // Continue with English if browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Language still works for the current page if storage is unavailable.
    }

    translatePage(language);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData") {
          translateTextNode(record.target as Text, language);
        } else if (record.type === "attributes") {
          if (record.target instanceof Element) translateElement(record.target, language);
        } else {
          record.addedNodes.forEach((node) => translateSubtree(node, language));
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRS],
      subtree: true,
    });
    return () => observer.disconnect();
  }, [language]);

  return (
    <div
      role="group"
      aria-label="Choose language"
      data-no-translate
      style={{
        position: "fixed",
        right: 14,
        bottom: "calc(82px + env(safe-area-inset-bottom))",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 3,
        padding: 4,
        border: "1px solid #d4d4d4",
        borderRadius: 999,
        background: "#fff",
        color: "#111",
        boxShadow: "0 4px 18px rgba(0,0,0,.14)",
        fontFamily: "inherit",
      }}
    >
      <button
        type="button"
        onClick={() => setLanguage("ml")}
        aria-pressed={language === "ml"}
        style={{
          border: 0,
          borderRadius: 999,
          padding: "9px 12px",
          background: language === "ml" ? "#111" : "transparent",
          color: language === "ml" ? "#fff" : "#333",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        മലയാളം
      </button>
      <button
        type="button"
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
        style={{
          border: 0,
          borderRadius: 999,
          padding: "9px 12px",
          background: language === "en" ? "#111" : "transparent",
          color: language === "en" ? "#fff" : "#333",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        English
      </button>
    </div>
  );
}
