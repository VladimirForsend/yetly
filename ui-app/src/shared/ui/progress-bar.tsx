import { cn } from "../lib/cn";

export function ProgressBar({
  value,
  label = "Progreso",
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const safe = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn("h-2 overflow-hidden rounded-full bg-slate-100", className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safe)}
    >
      <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${safe}%` }} />
    </div>
  );
}
