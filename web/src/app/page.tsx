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
  { label: "home.imagesToPdf", desc: "home.imagesToPdf.desc", href: "/convert?taskType=images_to_pdf", icon: "📑" },
  { label: "home.ocrToWord", desc: "home.ocrToWord.desc", href: "/tools/ocr", icon: "🤖" },
];

const PDF_TOOLS: ToolCard[] = [
  { label: "home.mergePdf", desc: "home.mergePdf.desc", href: "/tools/merge", icon: "🔗" },
  { label: "home.splitPdf", desc: "home.splitPdf.desc", href: "/tools/split", icon: "✂️" },
  { label: "home.compressPdf", desc: "home.compressPdf.desc", href: "/tools/compress", icon: "🗜" },
  { label: "home.rotatePdf", desc: "home.rotatePdf.desc", href: "/tools/rotate", icon: "🔄" },
  { label: "home.watermarkPdf", desc: "home.watermarkPdf.desc", href: "/tools/watermark", icon: "💧" },
];

function ToolGroup({ title, tools, t }: {
  title: string;
  tools: ToolCard[];
  t: (key: keyof TranslationKeys) => string;
}) {
  return (
    <section className="w-full max-w-4xl">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="flex flex-col items-start gap-1.5 border rounded-xl p-4 bg-white hover:bg-blue-50 hover:border-blue-300 hover:shadow-sm transition-all text-left"
          >
            <span className="text-2xl">{tool.icon}</span>
            <span className="font-medium text-sm text-gray-900">{t(tool.label)}</span>
            <span className="text-xs text-gray-500 leading-snug">{t(tool.desc)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const { user, loading, logout } = useAuth();
  const { t, locale, setLocale } = useI18n();

  return (
    <main className="min-h-screen flex flex-col bg-gray-50">
      <nav className="border-b bg-white px-4 md:px-8 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg flex items-center gap-2">
          <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6" />
          </svg>
          Easy Convert AI
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

      <div className="flex-1 flex flex-col items-center px-4 py-12 gap-10">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
            {t("home.hero")}
          </h1>
          <p className="text-lg text-gray-500 mb-6">
            {t("home.subtitle")}
          </p>
          <p className="text-sm text-gray-400">{t("home.freeTrialNote")}</p>
        </div>

        <ToolGroup title={t("home.groupConvert")} tools={CONVERT_TOOLS} t={t} />
        <ToolGroup title={t("home.groupPdfTools")} tools={PDF_TOOLS} t={t} />
      </div>
    </main>
  );
}
