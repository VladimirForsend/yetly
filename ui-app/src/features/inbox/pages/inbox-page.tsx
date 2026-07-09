import { AlertTriangle, Bell, CheckCheck, Info, Siren } from "lucide-react";
import { useWorkspace } from "../../../app/providers/app-providers";
import { cn } from "../../../shared/lib/cn";
import { Button } from "../../../shared/ui/button";
import { PageHeader } from "../../../shared/ui/page-header";
import { ErrorState, LoadingState } from "../../../shared/ui/state-panel";

const toneMeta = {
  info: { Icon: Info, className: "bg-blue-50 text-blue-600" },
  warning: { Icon: AlertTriangle, className: "bg-warning-50 text-warning-700" },
  danger: { Icon: Siren, className: "bg-danger-50 text-danger-700" },
};

export function InboxPage() {
  const { snapshot, isLoading, isError, error, refetch, markAllNotificationsRead, isMutating } = useWorkspace();

  if (isLoading) return <LoadingState label="Cargando notificaciones…" />;
  if (isError || !snapshot) return <ErrorState message={error?.message ?? "No fue posible cargar la bandeja."} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bandeja"
        title="Señales que requieren contexto"
        description="Alertas derivadas de tus tareas y señales operativas que requieren atención."
        actions={<Button variant="secondary" onClick={() => void markAllNotificationsRead()} disabled={isMutating || snapshot.notifications.every((item) => !item.unread)}><CheckCheck className="h-4 w-4" aria-hidden="true" /> Marcar todo leído</Button>}
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card" aria-labelledby="notifications-heading">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 id="notifications-heading" className="font-bold text-ink-950">Notificaciones</h2>
          <p className="mt-0.5 text-xs text-ink-500">{snapshot.notifications.filter((item) => item.unread).length} sin leer</p>
        </div>
        <div className="divide-y divide-slate-100">
          {snapshot.notifications.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Bell className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
              <p className="mt-3 font-black text-ink-950">Tu bandeja está al día</p>
              <p className="mt-1 text-sm text-ink-500">Las alertas reales aparecerán cuando una regla operativa las genere.</p>
            </div>
          ) : snapshot.notifications.map((notification) => {
            const item = toneMeta[notification.tone];
            return (
              <article key={notification.id} className={cn("flex gap-4 px-5 py-5", notification.unread && "bg-brand-50/30")}>
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", item.className)}>
                  <item.Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-ink-950">{notification.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-ink-600">{notification.description}</p>
                    </div>
                    {notification.unread && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600"><span className="sr-only">Sin leer</span></span>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
        <Bell className="mx-auto h-6 w-6 text-ink-500" aria-hidden="true" />
        <p className="mt-2 text-sm font-bold text-ink-950">Fin de la bandeja actual</p>
        <p className="mt-1 text-xs text-ink-500">Las nuevas alertas de la organización aparecerán aquí.</p>
      </div>
    </div>
  );
}
