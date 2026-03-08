import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { t } from "@/lib/i18n";
import { getUpdatesFeed, type UpdateEntry } from "@/lib/updates-feed";
import { localeFromSegment, localeSegmentParams } from "@/lib/locale-path";

const MAX_ITEMS_PER_DAY = 15;

type UpdatesPageProps = {
  params: Promise<{ locale: string }>;
};

export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams() {
  return localeSegmentParams();
}

type UpdateSection = {
  title: string;
  highlights: string[];
};

type UpdateDayGroup = {
  date: string;
  sections: UpdateSection[];
};

function formatUpdateDate(locale: string, isoDate: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function groupUpdatesByDate(updates: UpdateEntry[]): UpdateDayGroup[] {
  const map = new Map<
    string,
    {
      sectionOrder: string[];
      sectionsByTitle: Map<string, { title: string; highlights: string[]; dedupe: Set<string> }>;
    }
  >();
  const orderedDates: string[] = [];

  for (const entry of updates) {
    if (!map.has(entry.date)) {
      map.set(entry.date, { sectionOrder: [], sectionsByTitle: new Map() });
      orderedDates.push(entry.date);
    }

    const group = map.get(entry.date)!;
    if (!group.sectionsByTitle.has(entry.title)) {
      group.sectionsByTitle.set(entry.title, { title: entry.title, highlights: [], dedupe: new Set<string>() });
      group.sectionOrder.push(entry.title);
    }

    const section = group.sectionsByTitle.get(entry.title)!;
    for (const highlight of entry.highlights) {
      const item = highlight.trim();
      if (!item) {
        continue;
      }
      if (!section.dedupe.has(item)) {
        section.dedupe.add(item);
        section.highlights.push(item);
      }
    }
  }

  return orderedDates.map((date) => {
    const group = map.get(date)!;
    let remaining = MAX_ITEMS_PER_DAY;

    const sections = group.sectionOrder
      .map((title) => {
        if (remaining <= 0) {
          return null;
        }

        const section = group.sectionsByTitle.get(title);
        if (!section || section.highlights.length === 0) {
          return null;
        }

        const highlights = section.highlights.slice(0, remaining);
        remaining -= highlights.length;

        if (highlights.length === 0) {
          return null;
        }

        return { title: section.title, highlights };
      })
      .filter((section): section is UpdateSection => Boolean(section));

    return { date, sections };
  });
}

export default async function UpdatesPage({ params }: UpdatesPageProps) {
  const { locale: localeSegment } = await params;
  const locale = localeFromSegment(localeSegment);
  const tt = (key: Parameters<typeof t>[1], vars?: Parameters<typeof t>[2]) => t(locale, key, vars);
  const updates = getUpdatesFeed(locale);
  const dayGroups = groupUpdatesByDate(updates);
  const latestDate = dayGroups[0]?.date ? formatUpdateDate(locale, dayGroups[0].date) : null;

  return (
    <main className="page-wrap py-10 md:py-14" data-testid="page-updates">
      <section className="panel-glass card p-7 md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <BrandLogo subtitle={tt("brand.subtitle")} />
          <div className="flex flex-wrap items-center gap-2">
            <a className="btn btn-secondary" href={`/${localeSegment}/onboarding`}>
              {tt("updates.back")}
            </a>
            <Link className="btn btn-primary" href="/login">
              {tt("onboarding.start")}
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="surface-chip">
            <Sparkles size={14} />
            {tt("updates.title")}
          </span>
          {latestDate ? <span className="surface-chip">{tt("updates.latest", { date: latestDate })}</span> : null}
        </div>

        <p className="muted mt-3 max-w-3xl md:text-base">{tt("updates.subtitle")}</p>

        {dayGroups.length > 0 ? (
          <ol className="mt-7 space-y-3">
            {dayGroups.map((group) => {
              const formattedDate = formatUpdateDate(locale, group.date);
              return (
                <li className="rounded-2xl border border-line bg-white/85 p-4 md:p-5" key={group.date}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge">{formattedDate}</span>
                    <h2 className="text-base font-semibold text-text">{formattedDate}</h2>
                  </div>
                  <div className="mt-4 space-y-4">
                    {group.sections.map((section, sectionIndex) => (
                      <section className="rounded-xl border border-line/70 bg-white/80 p-3" key={`${group.date}-section-${sectionIndex}`}>
                        <h3 className="text-sm font-semibold text-text">{section.title}</h3>
                        <ul className="mt-2 list-disc space-y-1.5 pl-5">
                          {section.highlights.map((highlight, itemIndex) => (
                            <li className="text-sm leading-relaxed text-muted" key={`${group.date}-section-${sectionIndex}-item-${itemIndex}`}>
                              {highlight}
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="muted mt-7">{tt("updates.empty")}</p>
        )}
      </section>
    </main>
  );
}
