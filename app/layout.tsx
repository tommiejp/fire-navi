import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// ページのメタデータ設定
export const metadata: Metadata = {
  title: "FIREナビ | 経済的自立・早期退職シミュレーター",
  description:
    "総資産・年間支出・利回りを入力するだけで、FIRE達成までの年数と資産推移を瞬時に可視化します。",
};

// モバイル表示のビューポート設定
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
