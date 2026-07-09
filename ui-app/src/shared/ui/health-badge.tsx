import { AlertTriangle, CircleHelp, CircleCheck, Siren } from "lucide-react";
import type { ProjectHealth } from "../../application/ports/workspace-port";
import { cn } from "../lib/cn";

const config = {
  green: { label: "En buen estado", className: "bg-success-50 text-success-700", Icon: CircleCheck },
  yellow: { label: "Atención", className: "bg-warning-50 text-warning-700", Icon: AlertTriangle },
  red: { label: "En riesgo", className: "bg-danger-50 text-danger-700", Icon: Siren },
  unknown: { label: "Sin datos", className: "bg-slate-100 text-slate-600", Icon: CircleHelp },
} satisfies Record<ProjectHealth, { label: string; className: string; Icon: typeof CircleCheck }>;

export function HealthBadge({ health, compact = false }: { health: ProjectHealth; compact?: boolean }) {
  const item = config[health];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", item.className)}>
      <item.Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {!compact && item.label}
      <span className={compact ? "sr-only" : "hidden"}>{item.label}</span>
    </span>
  );
}
