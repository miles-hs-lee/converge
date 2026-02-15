const tenantPalette = ["#0891b2", "#0284c7", "#0ea5e9", "#1d4ed8", "#334155", "#14b8a6"];

export function colorForTenant(tenantName: string): string {
  // Deterministic color mapping so tenant colors remain stable across filters/order.
  let hash = 0;
  for (let i = 0; i < tenantName.length; i += 1) {
    hash = (hash * 31 + tenantName.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % tenantPalette.length;
  return tenantPalette[idx] ?? "#0f766e";
}

