import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/components/locale-provider";
import { AppPreferencesProvider } from "@/components/app-preferences-provider";
import { getServerLocale } from "@/lib/i18n-server";
import { htmlLang } from "@/lib/i18n";
import { PwaRegister } from "@/components/pwa-register";
import { THEME_MODE_STORAGE_KEY } from "@/lib/preferences";

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
  colorScheme: "light dark"
};

const themeBootScript = `
(() => {
  try {
    const key = ${JSON.stringify(THEME_MODE_STORAGE_KEY)};
    const saved = localStorage.getItem(key);
    const mode = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolved = mode === "dark" || (mode === "system" && prefersDark) ? "dark" : "light";
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark");
    root.classList.add(resolved === "dark" ? "theme-dark" : "theme-light");
    root.style.colorScheme = resolved;
  } catch {}
})();
`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getServerLocale();
  return (
    <html className="theme-light" lang={htmlLang(locale)} suppressHydrationWarning>
      <body className={`${jakarta.variable} ${noto.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <PwaRegister />
        <AppPreferencesProvider>
          <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
        </AppPreferencesProvider>
      </body>
    </html>
  );
}
