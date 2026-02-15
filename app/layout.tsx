import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/components/locale-provider";
import { getServerLocale } from "@/lib/i18n-server";
import { htmlLang } from "@/lib/i18n";
import { PwaRegister } from "@/components/pwa-register";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta"
});

const noto = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
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
  colorScheme: "light"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getServerLocale();
  return (
    <html lang={htmlLang(locale)}>
      <body className={`${jakarta.variable} ${noto.variable}`}>
        <PwaRegister />
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
