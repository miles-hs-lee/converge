import type { Metadata } from "next";
import { IBM_Plex_Sans, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex"
});

const noto = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto"
});

export const metadata: Metadata = {
  title: "Converge",
  description: "Unified M365 calendar and people workspace"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={`${plex.variable} ${noto.variable}`}>{children}</body>
    </html>
  );
}
