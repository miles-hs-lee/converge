import { NextResponse } from "next/server";
import { getServerLocale } from "@/lib/i18n-server";
import { localeToSegment } from "@/lib/locale-path";

export async function GET(request: Request) {
  const locale = await getServerLocale();
  const segment = localeToSegment(locale);
  return NextResponse.redirect(new URL(`/${segment}/onboarding`, request.url));
}
