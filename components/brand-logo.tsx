type BrandLogoProps = {
  className?: string;
  subtitle?: string;
  compact?: boolean;
};

export function BrandLogo({ className = "", subtitle, compact = false }: BrandLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`.trim()}>
      <svg
        aria-hidden="true"
        className={compact ? "h-8 w-8" : "h-10 w-10"}
        viewBox="0 0 240 240"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect fill="#0F172A" height="240" rx="32" width="240" />
        <path d="M42 120C42 78.6 75.6 45 117 45H130" stroke="#7DD3FC" strokeLinecap="round" strokeWidth="20" />
        <path d="M198 120C198 161.4 164.4 195 123 195H110" stroke="#38BDF8" strokeLinecap="round" strokeWidth="20" />
        <path d="M72 66L168 174" opacity="0.8" stroke="#E2E8F0" strokeLinecap="round" strokeWidth="12" />
        <circle cx="120" cy="120" fill="#22D3EE" r="26" />
        <circle cx="120" cy="120" fill="#0F172A" r="9" />
      </svg>
      <div className="leading-none">
        <p className={compact ? "text-sm font-semibold tracking-tight" : "text-xl font-semibold tracking-tight"}>Converge</p>
        {subtitle ? <p className="mt-1 text-xs text-muted">{subtitle}</p> : null}
      </div>
    </div>
  );
}
