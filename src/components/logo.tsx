/** The Halves mark: a coin split in two. Drawn inline so it stays sharp at any size. */
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={className}>
      <rect width="64" height="64" rx="15" fill="rgb(var(--c-accent))" />
      <path d="M30 14 A18 18 0 0 0 30 50 Z" fill="#fff" />
      <path d="M34 14 A18 18 0 0 1 34 50 Z" fill="none" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}

/** Mark + wordmark. */
export function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <LogoMark size={size} />
      <span style={{ fontSize: size * 0.68 }}>Halves</span>
    </span>
  );
}
