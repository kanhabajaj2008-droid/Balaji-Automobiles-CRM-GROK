import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warn" | "good" | "bad";
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 font-display text-3xl tabular-nums leading-none",
          tone === "warn" && "text-warn",
          tone === "good" && "text-sold",
          tone === "bad" && "text-lost",
          (!tone || tone === "default") && "text-ink",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sold/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-sold">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-2 animate-ping rounded-full bg-sold opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-sold" />
      </span>
      Live
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl text-ink lg:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}
