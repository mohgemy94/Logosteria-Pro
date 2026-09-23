import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { Language, translations, autoTranslateToEnglish, ARABIC_TO_ENGLISH_MAP } from './translations';

interface LanguageContextType {
  language: Language;
  isRtl: boolean;
  dir: 'rtl' | 'ltr';
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, defaultText?: string) => string;
  translateText: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'logustria_app_language_v1';

// Extend Node type for storing original Arabic text
interface CustomTextNode extends Node {
  __orig_text_val?: string;
  __translated_lang?: string;
}

interface CustomElement extends HTMLElement {
  __orig_placeholder?: string;
  __orig_title?: string;
  __orig_aria_label?: string;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === 'en' || saved === 'ar') return saved;
    }
    return 'ar';
  });

  const isRtl = language === 'ar';
  const dir = isRtl ? 'rtl' : 'ltr';

  // Apply Document Direction, Class, and Global Text Node / Attribute Translation
  useEffect(() => {
    if (typeof document === 'undefined') return;

    document.documentElement.lang = language;
    document.documentElement.dir = dir;

    if (language === 'en') {
      document.documentElement.classList.add('lang-en');
      document.documentElement.classList.remove('lang-ar');
    } else {
      document.documentElement.classList.add('lang-ar');
      document.documentElement.classList.remove('lang-en');
    }

    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      window.dispatchEvent(new CustomEvent('app-language-changed', { detail: { language, dir } }));
    } catch (e) {
      console.error(e);
    }

    // Comprehensive DOM Auto-Translator for English Mode
    const translateNode = (node: Node) => {
      // Check if node or its ancestor is excluded from auto-translation
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.getAttribute('data-no-auto-translate') === 'true' || el.classList.contains('notranslate') || el.getAttribute('translate') === 'no') {
          return;
        }
      }

      // 1. Text Nodes
      if (node.nodeType === Node.TEXT_NODE) {
        const textNode = node as CustomTextNode;
        const text = textNode.nodeValue || '';

        // Avoid translating code blocks, scripts, or excluded components
        const parent = textNode.parentElement;
        if (parent && (
          parent.tagName === 'SCRIPT' || 
          parent.tagName === 'STYLE' || 
          parent.tagName === 'CODE' ||
          parent.closest('[data-no-auto-translate="true"]') ||
          parent.closest('.notranslate') ||
          parent.closest('[translate="no"]')
        )) {
          return;
        }

        if (language === 'en') {
          if (/[\u0600-\u06FF]/.test(text)) {
            if (textNode.__orig_text_val === undefined) {
              textNode.__orig_text_val = text;
            }
            const translated = autoTranslateToEnglish(textNode.__orig_text_val || text);
            if (translated !== text) {
              textNode.nodeValue = translated;
              textNode.__translated_lang = 'en';
            }
          }
        } else {
          // Revert back to original Arabic if stored
          if (textNode.__orig_text_val !== undefined) {
            textNode.nodeValue = textNode.__orig_text_val;
            delete textNode.__orig_text_val;
            delete textNode.__translated_lang;
          }
        }
      }

      // 2. Element Attributes (placeholder, title, aria-label)
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as CustomElement;

        // Skip excluded elements
        if (el.getAttribute('data-no-auto-translate') === 'true' || el.classList.contains('notranslate') || el.getAttribute('translate') === 'no') {
          return;
        }

        // Placeholder
        const placeholder = el.getAttribute('placeholder');
        if (placeholder) {
          if (language === 'en') {
            if (/[\u0600-\u06FF]/.test(placeholder)) {
              if (el.__orig_placeholder === undefined) el.__orig_placeholder = placeholder;
              el.setAttribute('placeholder', autoTranslateToEnglish(el.__orig_placeholder));
            }
          } else if (el.__orig_placeholder !== undefined) {
            el.setAttribute('placeholder', el.__orig_placeholder);
            delete el.__orig_placeholder;
          }
        }

        // Title
        const title = el.getAttribute('title');
        if (title) {
          if (language === 'en') {
            if (/[\u0600-\u06FF]/.test(title)) {
              if (el.__orig_title === undefined) el.__orig_title = title;
              el.setAttribute('title', autoTranslateToEnglish(el.__orig_title));
            }
          } else if (el.__orig_title !== undefined) {
            el.setAttribute('title', el.__orig_title);
            delete el.__orig_title;
          }
        }

        // Aria-label
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) {
          if (language === 'en') {
            if (/[\u0600-\u06FF]/.test(ariaLabel)) {
              if (el.__orig_aria_label === undefined) el.__orig_aria_label = ariaLabel;
              el.setAttribute('aria-label', autoTranslateToEnglish(el.__orig_aria_label));
            }
          } else if (el.__orig_aria_label !== undefined) {
            el.setAttribute('aria-label', el.__orig_aria_label);
            delete el.__orig_aria_label;
          }
        }

        // Walk children
        const children = node.childNodes;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child) {
            translateNode(child);
          }
        }
      }
    };

    // Initial pass on current DOM
    translateNode(document.body);

    // Dynamic MutationObserver to catch newly opened modals, tabs, added table rows, etc.
    let isTranslating = false;
    const observer = new MutationObserver((mutations) => {
      if (isTranslating) return;
      isTranslating = true;
      try {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => translateNode(node));
          } else if (mutation.type === 'characterData') {
            translateNode(mutation.target);
          }
        }
      } finally {
        isTranslating = false;
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [language, dir]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const toggleLanguage = () => {
    setLanguageState(prev => (prev === 'ar' ? 'en' : 'ar'));
  };

  const translateText = (text: string): string => {
    if (language === 'ar') return text;
    return autoTranslateToEnglish(text);
  };

  const t = (key: string, defaultText?: string): string => {
    const entry = translations[key];
    if (entry && entry[language]) {
      return entry[language];
    }

    if (language === 'en') {
      const source = defaultText !== undefined ? defaultText : key;
      if (ARABIC_TO_ENGLISH_MAP[source]) {
        return ARABIC_TO_ENGLISH_MAP[source];
      }
      return autoTranslateToEnglish(source);
    }

    return defaultText !== undefined ? defaultText : key;
  };

  const value = useMemo(
    () => ({
      language,
      isRtl,
      dir: (isRtl ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
      setLanguage,
      toggleLanguage,
      t,
      translateText,
    }),
    [language, isRtl, dir]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
