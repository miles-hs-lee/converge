"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/rate-limit";

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

async function resolveRateLimitActor(email: string): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  return `${email.toLowerCase()}|${ip}`;
}

export async function requestMagicLink(formData: FormData): Promise<void> {
  const emailValue = formData.get("email");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";

  if (!email || !email.includes("@")) {
    redirect("/login?status=invalid_email");
  }

  const allowed = await consumeRateLimit({
    scope: "login_magic_link",
    actor: await resolveRateLimitActor(email),
    limit: 5,
    windowSeconds: 60 * 10
  });
  if (!allowed) {
    redirect("/login?status=rate_limited");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${getAppUrl()}/auth/callback?next=/calendar`
    }
  });

  if (error) {
    redirect("/login?status=magic_link_error");
  }

  redirect("/login?status=magic_link_sent");
}
