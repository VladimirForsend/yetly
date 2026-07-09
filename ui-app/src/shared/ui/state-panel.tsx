import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import { Button } from "./button";

export function LoadingState({ label = "Cargando información…" }: { label?: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white p-6" role="status" aria-live="polite">
      <LoaderCircle className="mr-3 h-5 w-5 animate-spin text-brand-600" aria-hidden="true" />
      <span className="font-medium text-ink-700">{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-danger-600/20 bg-danger-50 p-6" role="alert">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger-600" aria-hidden="true" />
        <div>
          <h2 className="font-bold text-danger-700">No pudimos cargar esta vista</h2>
          <p className="mt-1 text-sm leading-6 text-danger-700">{message}</p>
          {onRetry && <Button className="mt-4" size="sm" onClick={onRetry}>Reintentar</Button>}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <Inbox className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
      <h2 className="mt-3 font-bold text-ink-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-600">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
