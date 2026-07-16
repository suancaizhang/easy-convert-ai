"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useI18n, type Locale } from "@/lib/i18n";
import type { TranslationKeys } from "@/i18n/types";

const LOCALE_LABELS: Record<Locale, string> = {
  "zh-CN": "中文",
  en: "English",
  id: "Bahasa Indonesia",
  vi: "Tiếng Việt",
  th: "ภาษาไทย",
  fil: "Filipino",
  ms: "Bahasa Melayu",
};

export default function Home() {
  const { user, loading, logout } = useAuth();
  const { t, locale, setLocale } = useI18n();

  const links: { label: keyof TranslationKeys; href: string; icon: string }[] = [
    { label: "home.pdfToWord", href: "/convert?taskType=pdf_to_word", icon: "📄" },
    { label: "home.wordToPdf", href: "/convert?taskType=word_to_pdf", icon: "📝" },
    { label: "home.imagesToPdf", href: "/convert?taskType=images_to_pdf", icon: "🖼" },
    { label: "home.mergeImages", href: "/merge-images", icon: "📑" },
    { label: "home.ocrToWord", href: "/convert?taskType=ocr_to_word", icon: "🤖" },
    { label: "home.excelToPdf", href: "/convert?taskType=excel_to_pdf", icon: "📊" },
    { label: "home.pptToPdf", href: "/convert?taskType=ppt_to_pdf", icon: "📽" },
  ];

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="border-b px-4 md:px-8 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg flex items-center gap-2">
          <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6" />
          </svg>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="border rounded px-2 py-1 text-xs bg-white cursor-pointer"
          >
            {(Object.keys(LOCALE_LABELS) as Locale[]).map((l) => (
              <option key={l} value={l}>
                {LOCALE_LABELS[l]}
              </option>
            ))}
          </select>
          {!loading && user && (
            <>
              <Link href="/history" className="hover:text-blue-600">
                {t("nav.history")}
              </Link>
              <button onClick={logout} className="text-gray-500 hover:text-gray-700">
                {t("nav.logout")}
              </button>
            </>
          )}
          {!loading && !user && (
            <>
              <Link href="/login" className="hover:text-blue-600">
                {t("nav.login")}
              </Link>
              <Link
                href="/register"
                className="bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700"
              >
                {t("nav.register")}
              </Link>
            </>
          )}
        </div>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          {t("home.hero")}
        </h1>
        <p className="text-lg text-gray-600 mb-8 max-w-md">
          {t("home.subtitle")}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="border rounded-md px-4 py-3 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 transition-colors text-center block"
            >
              <span className="text-lg mr-1">{link.icon}</span>
              {t(link.label)}
            </Link>
          ))}
        </div>

        <Link
          href="/convert"
          className="bg-blue-600 text-white px-8 py-3 rounded-md text-lg font-medium hover:bg-blue-700"
        >
          {t("home.cta")}
        </Link>

        <p className="mt-4 text-sm text-gray-400">
          {t("home.freeTrialNote")}
        </p>
      </div>
    </main>
  );
}
