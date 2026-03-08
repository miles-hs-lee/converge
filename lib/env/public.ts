function getPublicSupabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error("Missing required env: NEXT_PUBLIC_SUPABASE_URL");
  }
  return value;
}

function getPublicSupabaseAnonKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) {
    throw new Error("Missing required env: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return value;
}

type PublicEnv = {
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
};

export const publicEnv: PublicEnv = {
  get supabaseUrl() {
    return getPublicSupabaseUrl();
  },
  get supabaseAnonKey() {
    return getPublicSupabaseAnonKey();
  }
};
