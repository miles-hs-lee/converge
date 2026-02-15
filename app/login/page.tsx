import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { requestMagicLink } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";
import { BrandLogo } from "@/components/brand-logo";
import { getServerLocale } from "@/lib/i18n-server";
import { t, type I18nKey } from "@/lib/i18n";

const loginStatusKey: Record<string, I18nKey> = {
  magic_link_sent: "login.status.magic_link_sent",
  invalid_email: "login.status.invalid_email",
  magic_link_error: "login.status.magic_link_error",
  auth_callback_error: "login.status.auth_callback_error",
  signed_out: "login.status.signed_out"
};

type LoginPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const locale = await getServerLocale();
  const tt = (key: Parameters<typeof t>[1], vars?: Parameters<typeof t>[2]) => t(locale, key, vars);

  const params = await searchParams;
  const status = params.status;

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/calendar");
  }

  return (
    <main className="page-wrap flex min-h-screen max-w-xl items-center py-12">
      <section className="panel-glass card w-full p-7 md:p-9">
        <BrandLogo subtitle={tt("brand.subtitle")} />
        <h1 className="title-xl mt-5">{tt("login.title")}</h1>
        <p className="muted mt-2">{tt("login.subtitle")}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="surface-chip">{tt("login.feature.calendar")}</span>
          <span className="surface-chip">{tt("login.feature.people")}</span>
          <span className="surface-chip">{tt("login.feature.multitenant")}</span>
        </div>

        {status && loginStatusKey[status] ? (
          <p className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertCircle className="mt-0.5" size={16} />
            {tt(loginStatusKey[status]!)}
          </p>
        ) : null}

        <form action={requestMagicLink} className="mt-6 space-y-3">
          <label className="text-sm font-medium" htmlFor="email">
            {tt("login.emailLabel")}
          </label>
          <input className="input-control" id="email" name="email" placeholder="you@company.com" required type="email" />
          <button className="btn btn-primary w-full" type="submit">
            {tt("login.magicLinkCta")}
          </button>
        </form>

        <Link className="btn btn-secondary mt-3 w-full" href="/api/auth/microsoft/start">
          {tt("login.microsoftCta")}
        </Link>

        <Link className="mt-6 inline-flex text-sm text-muted underline decoration-accent/30 underline-offset-4" href="/onboarding">
          {tt("login.onboardingCta")}
        </Link>
      </section>
    </main>
  );
}
