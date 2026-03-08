import Link from "next/link";
import Image from "next/image";
import { BrandLogo } from "@/components/brand-logo";
import { TrackEventOnMount } from "@/components/analytics/track-event-on-mount";
import { t } from "@/lib/i18n";
import { getUpdatesFeed } from "@/lib/updates-feed";
import { analyticsEvents } from "@/lib/analytics/events";
import { localeFromSegment, localeSegmentParams } from "@/lib/locale-path";

type OnboardingPageProps = {
  params: Promise<{ locale: string }>;
};

export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams() {
  return localeSegmentParams();
}

function formatUpdateDate(locale: string, isoDate: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

export default async function OnboardingPage({ params }: OnboardingPageProps) {
  const { locale: localeSegment } = await params;
  const locale = localeFromSegment(localeSegment);
  const tt = (key: Parameters<typeof t>[1], vars?: Parameters<typeof t>[2]) => t(locale, key, vars);
  const recentUpdates = getUpdatesFeed(locale).slice(0, 2);
  const latestDate = recentUpdates[0]?.date ? formatUpdateDate(locale, recentUpdates[0].date) : null;

  return (
    <main className="page-wrap py-10 md:py-14" data-testid="page-onboarding">
      <TrackEventOnMount event={analyticsEvents.onboardingViewed} />
      <section className="panel-glass card p-7 md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <BrandLogo subtitle={tt("brand.subtitle")} />
          <div className="flex flex-wrap items-center gap-2">
            <a className="btn btn-secondary" data-testid="onboarding-updates" href={`/${localeSegment}/updates`}>
              {tt("onboarding.updates")}
            </a>
            <Link className="btn btn-primary" data-testid="onboarding-start" href="/login">
              {tt("onboarding.start")}
            </Link>
          </div>
        </div>
        <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight md:text-5xl md:whitespace-nowrap">{tt("onboarding.heroTitle")}</h1>
        <p className="muted mt-4 w-full md:text-base">{tt("onboarding.heroDesc")}</p>

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

        {recentUpdates.length > 0 ? (
          <section className="mt-8 rounded-2xl border border-line bg-white/82 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="title-lg">{tt("updates.title")}</h2>
                <p className="muted mt-1">{tt("updates.subtitle")}</p>
              </div>
              {latestDate ? <span className="surface-chip">{tt("updates.latest", { date: latestDate })}</span> : null}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {recentUpdates.map((entry, index) => {
                const highlights = entry.highlights.slice(0, 3);
                return (
                  <article className="rounded-xl border border-line bg-white p-4" key={`${entry.date}-${index}`}>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">{formatUpdateDate(locale, entry.date)}</p>
                    <h3 className="mt-2 text-sm font-semibold text-text">{entry.title}</h3>
                    <ul className="mt-2 list-disc space-y-1.5 pl-5">
                      {highlights.map((highlight, highlightIndex) => (
                        <li className="text-xs leading-relaxed text-muted" key={`${entry.date}-${index}-hl-${highlightIndex}`}>
                          {highlight}
                        </li>
                      ))}
                    </ul>
                    <a className="mt-3 inline-flex text-xs font-medium text-accent hover:underline" href={`/${localeSegment}/updates`}>
                      {tt("onboarding.updates")}
                    </a>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="mt-8 rounded-2xl border border-line bg-white/80 p-5">
          <h2 className="title-lg">{tt("onboarding.howTitle")}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <article className="rounded-xl border border-line bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">{tt("onboarding.stepLabel", { index: 1 })}</p>
              <p className="mt-2 text-sm font-medium">{tt("onboarding.step1Title")}</p>
              <p className="muted mt-1">{tt("onboarding.step1Desc")}</p>
            </article>
            <article className="rounded-xl border border-line bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">{tt("onboarding.stepLabel", { index: 2 })}</p>
              <p className="mt-2 text-sm font-medium">{tt("onboarding.step2Title")}</p>
              <p className="muted mt-1">{tt("onboarding.step2Desc")}</p>
            </article>
            <article className="rounded-xl border border-line bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">{tt("onboarding.stepLabel", { index: 3 })}</p>
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
                  sizes="(max-width: 768px) 100vw, 1200px"
                  src="/onboarding/calendar-desktop.jpg"
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
                  loading="lazy"
                  sizes="(max-width: 768px) 100vw, 1200px"
                  src="/onboarding/people-desktop.jpg"
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
                  loading="lazy"
                  sizes="(max-width: 768px) 100vw, 1200px"
                  src="/onboarding/settings-desktop.jpg"
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
