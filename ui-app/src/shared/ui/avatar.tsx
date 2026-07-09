import { cn } from "../lib/cn";
import type { PersonSummary } from "../../application/ports/workspace-port";

const tones: Record<string, string> = {
  violet: "bg-brand-100 text-brand-900",
  blue: "bg-blue-50 text-blue-600",
  rose: "bg-rose-100 text-rose-700",
  amber: "bg-amber-100 text-amber-800",
  emerald: "bg-emerald-100 text-emerald-800",
};

export function Avatar({
  person,
  size = "md",
  className,
}: {
  person: PersonSummary;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        tones[person.avatarTone] ?? "bg-slate-100 text-slate-700",
        size === "sm" && "h-7 w-7 text-[10px]",
        size === "md" && "h-9 w-9 text-xs",
        size === "lg" && "h-11 w-11 text-sm",
        className,
      )}
      title={`${person.name} · ${person.role}`}
      aria-label={person.name}
    >
      {person.initials}
    </span>
  );
}
