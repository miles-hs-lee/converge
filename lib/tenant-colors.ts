export type TenantColorMap = Record<string, string>;

const tenantPalette = ["#0891b2", "#0284c7", "#0ea5e9", "#1d4ed8", "#334155", "#14b8a6", "#f59e0b", "#ef4444"];

export function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isValidHexColor(trimmed)) return trimmed.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`;
  return null;
}

export function defaultColorForTenant(tenantName: string): string {
  let hash = 0;
  for (let i = 0; i < tenantName.length; i += 1) {
    hash = (hash * 31 + tenantName.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % tenantPalette.length;
  return tenantPalette[idx] ?? "#0f766e";
}

export function colorForTenant(tenantName: string, overrides?: TenantColorMap): string {
  const override = overrides?.[tenantName];
  if (override && isValidHexColor(override)) {
    return override.toLowerCase();
  }
  return defaultColorForTenant(tenantName);
}

export function sanitizeTenantColorMap(raw: unknown): TenantColorMap {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const entries = Object.entries(raw as Record<string, unknown>);
  const clean: TenantColorMap = {};

  for (const [tenant, value] of entries) {
    if (!tenant || typeof value !== "string") {
      continue;
    }
    const normalized = normalizeHexColor(value);
    if (!normalized) {
      continue;
    }
    clean[tenant] = normalized;
  }

  return clean;
}
