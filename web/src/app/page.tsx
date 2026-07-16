"use client";

import Link from "next/link";
import { useState } from "react";
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

interface ToolCard {
  label: keyof TranslationKeys;
  desc: keyof TranslationKeys;
  href: string;
  icon: string;
}

const CONVERT_TOOLS: ToolCard[] = [
  { label: "home.pdfToWord", desc: "home.pdfToWord.desc", href: "/convert?taskType=pdf_to_word", icon: "📄" },
  { label: "home.wordToPdf", desc: "home.wordToPdf.desc", href: "/convert?taskType=word_to_pdf", icon: "📝" },
  { label: "home.excelToPdf", desc: "home.excelToPdf.desc", href: "/convert?taskType=excel_to_pdf", icon: "📊" },
  { label: "home.pptToPdf", desc: "home.pptToPdf.desc", href: "/convert?taskType=ppt_to_pdf", icon: "📽" },
  { label: "home.pdfToImage", desc: "home.pdfToImage.desc", href: "/convert?taskType=pdf_to_image", icon: "🖼" },
  { label: "home.imagesToPdf", desc: "home.imagesToPdf.desc", href: "/tools/images-to-pdf", icon: "📑" },
  { label: "home.ocrToWord", desc: "home.ocrToWord.desc", href: "/tools/ocr", icon: "🤖" },
];

const PDF_TOOLS: ToolCard[] = [
  { label: "home.mergePdf", desc: "home.mergePdf.desc", href: "/tools/merge", icon: "🔗" },
  { label: "home.splitPdf", desc: "home.splitPdf.desc", href: "/tools/split", icon: "✂️" },
  { label: "home.compressPdf", desc: "home.compressPdf.desc", href: "/tools/compress", icon: "🗜" },
  { label: "home.rotatePdf", desc: "home.rotatePdf.desc", href: "/tools/rotate", icon: "🔄" },
  { label: "home.watermarkPdf", desc: "home.watermarkPdf.desc", href: "/tools/watermark", icon: "💧" },
];

export default function Home() {
  const { user, loading, logout } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const [activeTab, setActiveTab] = useState<"convert" | "pdf">("convert");

  return (
    <main className="min-h-screen flex flex-col bg-page">
      <nav className="border-b border-border-soft bg-card px-4 md:px-8 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg flex items-center gap-2">
          <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6" />
          </svg>
          {/* Easy Convert AI */}
        </Link>
        <div className="flex items-center gap-2 text-sm flex-shrink-0">
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="border border-border rounded px-2 py-1 text-xs bg-card cursor-pointer"
          >
            {(Object.keys(LOCALE_LABELS) as Locale[]).map((l) => (
              <option key={l} value={l}>
                {LOCALE_LABELS[l]}
              </option>
            ))}
          </select>
          {!loading && user && (
            <>
              <Link href="/history" className="hover:text-brand">
                {t("nav.history")}
              </Link>
              <button onClick={logout} className="text-muted hover:text-secondary">
                {t("nav.logout")}
              </button>
            </>
          )}
          {!loading && !user && (
            <>
              <Link href="/login" className="hover:text-brand whitespace-nowrap">
                {t("nav.login")}
              </Link>
              <Link
                href="/register"
                className="bg-brand text-on-brand px-3 py-1.5 rounded-md hover:bg-brand-hover whitespace-nowrap"
              >
                {t("nav.register")}
              </Link>
            </>
          )}
        </div>
      </nav>

      <div className="flex-1 flex flex-col items-center px-4 py-12 gap-10">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary font-content">
            {t("home.hero")}
          </h1>
          <p className="text-lg text-tertiary mb-6 font-content">
            {t("home.subtitle")}
          </p>
          <p className="text-sm text-muted">{t("home.freeTrialNote")}</p>
        </div>

        <section className="w-full max-w-4xl">
          <div className="flex border-b border-border mb-6">
            <button
              onClick={() => setActiveTab("convert")}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === "convert"
                  ? "border-brand text-brand"
                  : "border-transparent text-muted hover:text-secondary"
              }`}
            >
              {t("home.groupConvert")}
            </button>
            <button
              onClick={() => setActiveTab("pdf")}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === "pdf"
                  ? "border-brand text-brand"
                  : "border-transparent text-muted hover:text-secondary"
              }`}
            >
              {t("home.groupPdfTools")}
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {(activeTab === "convert" ? CONVERT_TOOLS : PDF_TOOLS).map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="flex flex-col items-start gap-1.5 border border-border rounded-xl p-4 bg-card hover:bg-brand-surface hover:border-brand-light transition-colors text-left"
              >
                <span className="text-2xl">{tool.icon}</span>
                <span className="font-medium text-sm text-primary font-content">{t(tool.label)}</span>
                <span className="text-xs text-tertiary leading-snug">{t(tool.desc)}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
