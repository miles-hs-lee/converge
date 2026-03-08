import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_KR } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { DEFAULT_LOCALE, htmlLang } from "@/lib/i18n";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-jakarta"
});

const noto = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-noto"
});

export const metadata: Metadata = {
  title: "Converge",
  description: "Unified M365 calendar and people workspace",
  applicationName: "Converge",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    title: "Converge",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  themeColor: "#0891B2",
  colorScheme: "light dark"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = DEFAULT_LOCALE;
  return (
    <html className="theme-light" lang={htmlLang(locale)} suppressHydrationWarning>
      <body className={`${jakarta.variable} ${noto.variable}`}>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
