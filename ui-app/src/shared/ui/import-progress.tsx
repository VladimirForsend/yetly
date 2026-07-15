import { CheckCircle2, Loader2 } from "lucide-react";
import type { ImportProgress } from "../../application/ports/workspace-port";

interface ImportProgressCardProps {
  progress: ImportProgress;
  title?: string;
}

export function ImportProgressCard({ progress, title = "Importando proyectos y datos" }: ImportProgressCardProps) {
  const completed = progress.phase === "completed";

  return (
    <div className={`rounded-2xl border p-4 ${completed ? "border-success-600/20 bg-success-50" : "border-brand-200 bg-brand-50"}`} role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white ${completed ? "text-success-700" : "text-brand-700"}`}>
          {completed ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-black text-ink-950">{completed ? "Importación completada" : title}</p>
            <span className={`text-sm font-black ${completed ? "text-success-700" : "text-brand-700"}`}>{progress.percent}%</span>
          </div>
          <p className="mt-1 truncate text-sm text-ink-600">{progress.label}</p>
          <div
            className="mt-3 h-2.5 overflow-hidden rounded-full bg-white"
            role="progressbar"
            aria-label="Progreso de importación"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent}
            aria-valuetext={`${progress.percent}% · ${progress.label}`}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${completed ? "bg-success-600" : "bg-brand-600"}`}
              style={{ width: `${Math.max(3, progress.percent)}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-ink-500">
            <span>{progress.completed} de {progress.total} elementos procesados</span>
            {!completed && <span>No cierres esta ventana</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
