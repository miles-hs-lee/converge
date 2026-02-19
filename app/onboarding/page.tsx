import Link from "next/link";
import Image from "next/image";
import { BrandLogo } from "@/components/brand-logo";
import { getServerLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export default async function OnboardingPage() {
  const locale = await getServerLocale();
  const tt = (key: Parameters<typeof t>[1], vars?: Parameters<typeof t>[2]) => t(locale, key, vars);

  return (
    <main className="page-wrap py-10 md:py-14" data-testid="page-onboarding">
      <section className="panel-glass card p-7 md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <BrandLogo subtitle={tt("brand.subtitle")} />
          <Link className="btn btn-primary" data-testid="onboarding-start" href="/login">
            {tt("onboarding.start")}
          </Link>
        </div>
        <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight md:text-5xl">{tt("onboarding.heroTitle")}</h1>
        <p className="muted mt-4 max-w-3xl md:text-base">{tt("onboarding.heroDesc")}</p>

        <div className="mt-7 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-line bg-white/85 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">{tt("onboarding.coreLabel", { index: 1 })}</p>
            <h2 className="mt-2 text-sm font-semibold">{tt("onboarding.core1Title")}</h2>
            <p className="muted mt-1">{tt("onboarding.core1Desc")}</p>
          </article>
          <article className="rounded-2xl border border-line bg-white/85 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">{tt("onboarding.coreLabel", { index: 2 })}</p>
            <h2 className="mt-2 text-sm font-semibold">{tt("onboarding.core2Title")}</h2>
            <p className="muted mt-1">{tt("onboarding.core2Desc")}</p>
          </article>
          <article className="rounded-2xl border border-line bg-white/85 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">{tt("onboarding.coreLabel", { index: 3 })}</p>
            <h2 className="mt-2 text-sm font-semibold">{tt("onboarding.core3Title")}</h2>
            <p className="muted mt-1">{tt("onboarding.core3Desc")}</p>
          </article>
          <article className="rounded-2xl border border-line bg-white/85 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">{tt("onboarding.coreLabel", { index: 4 })}</p>
            <h2 className="mt-2 text-sm font-semibold">{tt("onboarding.core4Title")}</h2>
            <p className="muted mt-1">{tt("onboarding.core4Desc")}</p>
          </article>
        </div>

        <section className="mt-8 rounded-2xl border border-line bg-white/80 p-5">
          <h2 className="title-lg">{tt("onboarding.howTitle")}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <article className="rounded-xl border border-line bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Step 1</p>
              <p className="mt-2 text-sm font-medium">{tt("onboarding.step1Title")}</p>
              <p className="muted mt-1">{tt("onboarding.step1Desc")}</p>
            </article>
            <article className="rounded-xl border border-line bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Step 2</p>
              <p className="mt-2 text-sm font-medium">{tt("onboarding.step2Title")}</p>
              <p className="muted mt-1">{tt("onboarding.step2Desc")}</p>
            </article>
            <article className="rounded-xl border border-line bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Step 3</p>
              <p className="mt-2 text-sm font-medium">{tt("onboarding.step3Title")}</p>
              <p className="muted mt-1">{tt("onboarding.step3Desc")}</p>
            </article>
          </div>
        </section>

        <section className="mt-8 space-y-4">
          <div>
            <h2 className="title-lg">{tt("onboarding.screensTitle")}</h2>
            <p className="muted mt-1">{tt("onboarding.screensDesc")}</p>
          </div>

          <div className="grid gap-4">
            <article className="rounded-2xl border border-line bg-white/85 p-3 md:p-4">
              <div className="relative max-h-[560px] overflow-auto rounded-xl border border-line bg-white">
                <Image
                  alt="Converge calendar screenshot"
                  className="h-auto w-full"
                  height={1028}
                  priority
                  src="/onboarding/calendar-desktop.png"
                  width={1280}
                  style={{ marginTop: -76 }}
                />
              </div>
              <p className="mt-3 text-sm font-medium">{tt("onboarding.screen.calendarTitle")}</p>
              <p className="muted mt-1">{tt("onboarding.screen.calendarDesc")}</p>
            </article>

            <article className="rounded-2xl border border-line bg-white/85 p-3 md:p-4">
              <div className="relative max-h-[360px] overflow-auto rounded-xl border border-line bg-white md:max-h-[560px]">
                <Image
                  alt="Converge people screenshot"
                  className="h-auto w-full"
                  height={3624}
                  src="/onboarding/people-desktop.png"
                  width={1280}
                  style={{ marginTop: -76 }}
                />
              </div>
              <p className="mt-3 text-sm font-medium">{tt("onboarding.screen.peopleTitle")}</p>
              <p className="muted mt-1">{tt("onboarding.screen.peopleDesc")}</p>
            </article>

            <article className="rounded-2xl border border-line bg-white/85 p-3 md:p-4">
              <div className="relative max-h-[560px] overflow-auto rounded-xl border border-line bg-white">
                <Image
                  alt="Converge settings screenshot"
                  className="h-auto w-full"
                  height={758}
                  src="/onboarding/settings-desktop.png"
                  width={1280}
                  style={{ marginTop: -76 }}
                />
              </div>
              <p className="mt-3 text-sm font-medium">{tt("onboarding.screen.settingsTitle")}</p>
              <p className="muted mt-1">{tt("onboarding.screen.settingsDesc")}</p>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}
