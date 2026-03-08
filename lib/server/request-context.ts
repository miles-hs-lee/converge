import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getRscSupabase = cache(async () => {
  return createClient();
});

export const getRscUser = cache(async () => {
  const supabase = await getRscSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user;
});
