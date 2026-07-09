import * as Dialog from "@radix-ui/react-dialog";
import { Settings2, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../../../app/providers/app-providers";
import type { ProjectStatus, ProjectSummary } from "../../../application/ports/workspace-port";
import { Button } from "../../../shared/ui/button";

export function EditProjectDialog({ project }: { project: ProjectSummary }) {
  const { updateProject, deleteProject, isMutating } = useWorkspace();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [teamName, setTeamName] = useState(project.teamName);
  const [targetDate, setTargetDate] = useState(project.targetDate === "Sin fecha objetivo" ? "" : project.targetDate);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setName(project.name);
    setTeamName(project.teamName);
    setTargetDate(project.targetDate === "Sin fecha objetivo" ? "" : project.targetDate);
    setStatus(project.status);
  }, [project]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      await updateProject(project.id, { name, teamName, targetDate, status });
      setSuccess("Proyecto actualizado.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible actualizar.");
    }
  }

  async function remove() {
    const confirmed = window.confirm(`¿Eliminar "${project.name}"? Se eliminarán también sus tareas y registros de tiempo asociados.`);
    if (!confirmed) return;
    try {
      await deleteProject(project.id);
      setOpen(false);
      navigate("/projects");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible eliminar.");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="secondary"><Settings2 className="h-4 w-4" aria-hidden="true" /> Configurar</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-ink-950/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[90] max-h-[90vh] w-[min(94vw,560px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-float focus:outline-none sm:p-7" aria-describedby="edit-project-description">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-black text-ink-950">Configurar proyecto</Dialog.Title>
              <Dialog.Description id="edit-project-description" className="mt-1 text-sm text-ink-600">Edita campos persistentes o elimina el proyecto.</Dialog.Description>
            </div>
            <Dialog.Close asChild><button className="grid h-10 w-10 place-items-center rounded-xl text-ink-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200" aria-label="Cerrar"><X className="h-5 w-5" aria-hidden="true" /></button></Dialog.Close>
          </div>

          <form className="mt-6 space-y-4" onSubmit={submit}>
            <label className="block"><span className="text-sm font-black text-ink-900">Nombre</span><input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="text-sm font-black text-ink-900">Equipo</span><input value={teamName} onChange={(e) => setTeamName(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" /></label>
              <label className="block"><span className="text-sm font-black text-ink-900">Estado</span><select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"><option value="planned">Planificado</option><option value="active">Activo</option><option value="on_hold">En pausa</option><option value="completed">Completado</option></select></label>
            </div>
            <label className="block"><span className="text-sm font-black text-ink-900">Fecha objetivo</span><input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" /></label>

            {error && <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-bold text-danger-700" role="alert">{error}</p>}
            {success && <p className="rounded-xl bg-success-50 px-4 py-3 text-sm font-bold text-success-700" role="status" aria-live="polite">{success}</p>}

            <div className="flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-5">
              <Button type="button" variant="secondary" className="text-danger-700 hover:bg-danger-50" onClick={() => void remove()} disabled={isMutating}><Trash2 className="h-4 w-4" aria-hidden="true" /> Eliminar</Button>
              <Button type="submit" disabled={isMutating}>{isMutating ? "Guardando…" : "Guardar cambios"}</Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
