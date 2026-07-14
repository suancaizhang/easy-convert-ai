"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { user, loading, logout } = useAuth();

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="border-b px-4 md:px-8 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg">
          Easy Convert AI
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/convert" className="hover:text-blue-600">
            开始转换
          </Link>
          {!loading && user && (
            <>
              <Link href="/history" className="hover:text-blue-600">
                转换历史
              </Link>
              <button onClick={logout} className="text-gray-500 hover:text-gray-700">
                退出
              </button>
            </>
          )}
          {!loading && !user && (
            <>
              <Link href="/login" className="hover:text-blue-600">
                登录
              </Link>
              <Link
                href="/register"
                className="bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700"
              >
                注册
              </Link>
            </>
          )}
        </div>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          AI 驱动的文档转换
        </h1>
        <p className="text-lg text-gray-600 mb-8 max-w-md">
          支持 PDF、Word、Excel、PPT、图片互转，图片文字提取(OCR 识别)，快速高质量输出
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8 text-sm">
          {[
            { label: "PDF → Word", taskType: "pdf_to_word", icon: "📄" },
            { label: "Word → PDF", taskType: "word_to_pdf", icon: "📝" },
            { label: "图片 → PDF", taskType: "images_to_pdf", icon: "🖼" },
            { label: "图片转文字(OCR 识别)", taskType: "ocr_to_word", icon: "🤖" },
            { label: "Excel → PDF", taskType: "excel_to_pdf", icon: "📊" },
            { label: "PPT → PDF", taskType: "ppt_to_pdf", icon: "📽" },
          ].map((link) => (
            <Link
              key={link.taskType}
              href={`/convert?taskType=${link.taskType}`}
              className="border rounded-md px-4 py-3 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 transition-colors text-center block"
            >
              <span className="text-lg mr-1">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </div>

        <Link
          href="/convert"
          className="bg-blue-600 text-white px-8 py-3 rounded-md text-lg font-medium hover:bg-blue-700"
        >
          免费开始转换
        </Link>

        <p className="mt-4 text-sm text-gray-400">
          无需注册即可体验，每日 3 次免费转换
        </p>
      </div>
    </main>
  );
}
