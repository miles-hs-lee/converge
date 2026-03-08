import { createAdminClient } from "@/lib/supabase/admin";

function normalizeActor(actor: string): string {
  return actor.trim().toLowerCase().slice(0, 180);
}

type FallbackBucket = {
  count: number;
  expiresAt: number;
};

const fallbackBuckets = new Map<string, FallbackBucket>();

function consumeFallbackBucket(params: {
  scope: string;
  actor: string;
  limit: number;
  windowSeconds: number;
}): boolean {
  const now = Date.now();
  const windowMs = params.windowSeconds * 1000;
  const bucketStart = Math.floor(now / windowMs) * windowMs;
  const expiresAt = bucketStart + windowMs;
  const key = `${params.scope}:${params.actor}:${params.windowSeconds}`;
  const current = fallbackBuckets.get(key);

  if (!current || current.expiresAt <= now) {
    fallbackBuckets.set(key, { count: 1, expiresAt });
  } else {
    current.count += 1;
  }

  for (const [bucketKey, bucket] of fallbackBuckets.entries()) {
    if (bucket.expiresAt + 60_000 < now) {
      fallbackBuckets.delete(bucketKey);
    }
  }

  return (fallbackBuckets.get(key)?.count ?? 0) <= params.limit;
}

export async function consumeRateLimit(params: {
  scope: string;
  actor: string;
  limit: number;
  windowSeconds: number;
}): Promise<boolean> {
  const scope = params.scope.trim().toLowerCase().slice(0, 80);
  const actor = normalizeActor(params.actor);
  const limit = Math.max(1, Math.floor(params.limit));
  const windowSeconds = Math.max(1, Math.floor(params.windowSeconds));

  if (!scope || !actor) {
    return false;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_scope: scope,
    p_actor: actor,
    p_limit: limit,
    p_window_seconds: windowSeconds
  });

  if (error) {
    // Avoid fail-open bypass when DB-backed limiter is unavailable.
    return consumeFallbackBucket({ scope, actor, limit, windowSeconds });
  }
  return Boolean(data);
}
