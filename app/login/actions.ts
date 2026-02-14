"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function requestMagicLink(formData: FormData): Promise<void> {
  const emailValue = formData.get("email");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";

  if (!email || !email.includes("@")) {
    redirect("/login?status=invalid_email");
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
