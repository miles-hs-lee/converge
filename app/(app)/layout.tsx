import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?status=auth_required");
  }

  return (
    <div className="min-h-screen">
      <TopNav userEmail={user.email} />
      <main className="page-wrap pb-10 pt-6 md:pt-8">{children}</main>
    </div>
  );
}
