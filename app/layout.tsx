import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "@/frontend/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VocalLytics — Voice-to-SQL BI Copilot",
  description:
    "Ask a business question out loud and get an interactive chart plus the SQL behind it.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-ink font-sans text-slate-100 antialiased">
        <div className="aurora">
          <div className="aurora-blob" />
        </div>
        <div className="grid-overlay" />
        {children}
      </body>
    </html>
  );
}
