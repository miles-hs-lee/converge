import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShellProviders } from "@/components/app-shell-providers";
import { TopNav } from "@/components/top-nav";
import { SecurityReauthStatusGate } from "@/components/security-reauth-status-gate";
import { getServerLocale } from "@/lib/i18n-server";
import { getMessages, t } from "@/lib/i18n";
import { getRscUser } from "@/lib/server/request-context";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getRscUser();

  if (!user) {
    redirect("/login?status=auth_required");
  }

  const locale = await getServerLocale({ dbFallback: true });
  const messages = getMessages(locale);
  const tt = (key: Parameters<typeof t>[1]) => t(locale, key);

  return (
    <AppShellProviders locale={locale} messages={messages} userId={user.id}>
      <div className="min-h-screen">
        <SecurityReauthStatusGate
          body={tt("settings.reauthModalBody")}
          ctaLabel={tt("settings.reauthModalCta")}
          dismissLabel={tt("settings.reauthModalDismiss")}
          title={tt("settings.reauthModalTitle")}
        />
        <TopNav locale={locale} userEmail={user.email} />
        <main className="page-wrap pb-10 pt-6 md:pt-8">{children}</main>
      </div>
    </AppShellProviders>
  );
}
