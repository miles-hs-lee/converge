function getPublicEnv(key: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
}

export const publicEnv = {
  supabaseUrl: getPublicEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: getPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
};
