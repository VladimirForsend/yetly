import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, FolderPlus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useWorkspace } from "../../../app/providers/app-providers";
import type { ProjectStatus } from "../../../application/ports/workspace-port";
import { Button } from "../../../shared/ui/button";

export function CreateProjectDialog({ compact = false }: { compact?: boolean }) {
  const { createProject, isMutating } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      await createProject({ name, code, teamName, targetDate, status });
      setSuccess("Proyecto creado correctamente.");
      setName("");
      setCode("");
      setTeamName("");
      setTargetDate("");
      setStatus("active");
      window.setTimeout(() => setOpen(false), 500);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible crear el proyecto.");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size={compact ? "sm" : "md"}>
          <FolderPlus className="h-4 w-4" aria-hidden="true" />
          {compact ? "Proyecto" : "Nuevo proyecto"}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-ink-950/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[90] max-h-[90vh] w-[min(94vw,620px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-float focus:outline-none sm:p-7" aria-describedby="create-project-description">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-2xl font-black tracking-[-0.04em] text-ink-950">Crear proyecto</Dialog.Title>
              <Dialog.Description id="create-project-description" className="mt-1 text-sm leading-6 text-ink-600">El proyecto se guardará en el modo de datos activo y quedará disponible para crear tareas.</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ink-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200" aria-label="Cerrar">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <form className="mt-6 space-y-5" onSubmit={submit}>
            <label className="block">
              <span className="text-sm font-black text-ink-900">Nombre del proyecto</span>
              <input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" placeholder="Ej. Lanzamiento sitio corporativo" />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-black text-ink-900">Código <span className="font-semibold text-ink-500">(opcional)</span></span>
                <input value={code} onChange={(event) => setCode(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 text-sm uppercase outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" placeholder="WEB-01" maxLength={8} />
              </label>
              <label className="block">
                <span className="text-sm font-black text-ink-900">Equipo</span>
                <input value={teamName} onChange={(event) => setTeamName(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" placeholder="General" />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-black text-ink-900">Estado</span>
                <select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100">
                  <option value="planned">Planificado</option>
                  <option value="active">Activo</option>
                  <option value="on_hold">En pausa</option>
                  <option value="completed">Completado</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-black text-ink-900">Fecha objetivo</span>
                <span className="relative mt-2 block">
                  <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
                  <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="h-12 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
                </span>
              </label>
            </div>

            {error && <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-bold text-danger-700" role="alert">{error}</p>}
            {success && <p className="rounded-xl bg-success-50 px-4 py-3 text-sm font-bold text-success-700" role="status" aria-live="polite">{success}</p>}

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
              <Dialog.Close asChild><Button type="button" variant="secondary">Cancelar</Button></Dialog.Close>
              <Button type="submit" disabled={isMutating || name.trim().length < 2}>{isMutating ? "Creando…" : "Crear proyecto"}</Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
