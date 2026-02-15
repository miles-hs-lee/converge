import type { ReactNode } from "react";
import { TopNav } from "@/components/top-nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="page-wrap pb-10 pt-6 md:pt-8">{children}</main>
    </div>
  );
}
