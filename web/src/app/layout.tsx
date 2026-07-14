import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Easy Convert AI",
  description: "AI-powered document conversion platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
