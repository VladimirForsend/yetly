import * as Dialog from "@radix-ui/react-dialog";
import { Cloud, Copy, Plus, Trash2, UserPlus, Users, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../../../app/providers/app-providers";
import type { TeamSummary } from "../../../application/ports/workspace-port";
import { Avatar } from "../../../shared/ui/avatar";
import { Button } from "../../../shared/ui/button";
import { PageHeader } from "../../../shared/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "../../../shared/ui/state-panel";

function CreateTeamDialog() {
  const { createTeam, isMutating } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await createTeam({ name });
      setName("");
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible crear el equipo.");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild><Button><Plus className="h-4 w-4" aria-hidden="true" /> Nuevo equipo</Button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-ink-950/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[90] w-[min(94vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-slate-200 bg-white p-6 shadow-float focus:outline-none" aria-describedby="new-team-description">
          <div className="flex items-start justify-between gap-4">
            <div><Dialog.Title className="text-xl font-black text-ink-950">Crear equipo</Dialog.Title><Dialog.Description id="new-team-description" className="mt-1 text-sm text-ink-600">Agrupa personas y proyectos bajo un equipo.</Dialog.Description></div>
            <Dialog.Close asChild><button className="grid h-10 w-10 place-items-center rounded-xl text-ink-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200" aria-label="Cerrar"><X className="h-5 w-5" aria-hidden="true" /></button></Dialog.Close>
          </div>
          <form className="mt-6" onSubmit={submit}>
            <label className="block"><span className="text-sm font-black text-ink-900">Nombre</span><input autoFocus required minLength={2} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" placeholder="Ej. Producto" /></label>
            {error && <p className="mt-4 rounded-xl bg-danger-50 px-4 py-3 text-sm font-bold text-danger-700" role="alert">{error}</p>}
            <div className="mt-6 flex justify-end gap-3"><Dialog.Close asChild><Button type="button" variant="secondary">Cancelar</Button></Dialog.Close><Button type="submit" disabled={isMutating || name.trim().length < 2}>Crear equipo</Button></div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ManageMembersDialog({ team }: { team: TeamSummary }) {
  const { snapshot, addTeamMember, removeTeamMember, isMutating } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  if (!snapshot) return null;

  const people = snapshot.workload.map((item) => item.person);
  const memberIds = new Set(team.members.map((member) => member.id));

  async function toggle(userId: string, checked: boolean) {
    setError("");
    try {
      if (checked) await addTeamMember(team.id, userId);
      else await removeTeamMember(team.id, userId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos actualizar el equipo.");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="secondary"><UserPlus className="h-4 w-4" aria-hidden="true" /> Miembros</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-ink-950/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[90] max-h-[85vh] w-[min(94vw,560px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-float focus:outline-none" aria-describedby="manage-members-description">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-black text-ink-950">Miembros de {team.name}</Dialog.Title>
              <Dialog.Description id="manage-members-description" className="mt-1 text-sm leading-6 text-ink-600">Marca las personas de la organización que pertenecen a este equipo.</Dialog.Description>
            </div>
            <Dialog.Close asChild><button className="grid h-10 w-10 place-items-center rounded-xl text-ink-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200" aria-label="Cerrar"><X className="h-5 w-5" aria-hidden="true" /></button></Dialog.Close>
          </div>
          <div className="mt-6 space-y-3">
            {people.map((person) => (
              <label key={person.id} className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 hover:border-brand-300">
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar person={person} size="sm" />
                  <span className="min-w-0"><span className="block truncate text-sm font-black text-ink-950">{person.name}</span><span className="block text-xs text-ink-500">{person.role}</span></span>
                </span>
                <input type="checkbox" checked={memberIds.has(person.id)} disabled={isMutating} onChange={(event) => void toggle(person.id, event.target.checked)} className="h-5 w-5 accent-brand-600" />
              </label>
            ))}
          </div>
          {error && <p className="mt-4 rounded-xl bg-danger-50 px-4 py-3 text-sm font-bold text-danger-700" role="alert">{error}</p>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function TeamsPage() {
  const navigate = useNavigate();
  const { snapshot, storageMode, isLoading, isError, error, refetch, deleteTeam, isMutating } = useWorkspace();
  const [copyMessage, setCopyMessage] = useState("");

  if (isLoading) return <LoadingState label="Cargando equipos…" />;
  if (isError || !snapshot) return <ErrorState message={error?.message ?? "No fue posible cargar los equipos."} onRetry={refetch} />;

  async function remove(teamId: string, name: string) {
    if (!window.confirm(`¿Eliminar el equipo "${name}"?`)) return;
    try {
      await deleteTeam(teamId);
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "No fue posible eliminar el equipo.");
    }
  }

  async function copyInvite() {
    const code = snapshot?.activeOrganization.inviteCode;
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopyMessage("Código copiado.");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organización"
        title="Equipos"
        description={storageMode === "supabase" ? "Gestiona equipos compartidos y asigna miembros reales de tu organización." : "Crea equipos locales. Conecta Supabase cuando quieras colaboración multiusuario."}
        actions={<CreateTeamDialog />}
      />

      {storageMode === "local" ? (
        <section className="rounded-2xl border border-brand-200 bg-brand-50 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <Cloud className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
              <div><h2 className="font-black text-ink-950">¿Necesitas personas trabajando al mismo tiempo?</h2><p className="mt-1 text-sm leading-6 text-ink-600">Conecta tu propio Supabase. Yetly te guía sin pedir claves secretas.</p></div>
            </div>
            <Button onClick={() => navigate("/connect-supabase")}>Conectar Supabase</Button>
          </div>
        </section>
      ) : snapshot.activeOrganization.inviteCode ? (
        <section className="rounded-2xl border border-success-600/20 bg-success-50 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-black text-ink-950">Invita personas a {snapshot.activeOrganization.name}</h2>
              <p className="mt-1 text-sm leading-6 text-ink-600">Comparten el mismo proyecto Supabase, crean su cuenta y usan este código durante el onboarding.</p>
              <code className="mt-3 inline-block rounded-xl bg-slate-950 px-4 py-3 font-mono text-base font-black tracking-[.18em] text-white">{snapshot.activeOrganization.inviteCode}</code>
            </div>
            <Button onClick={() => void copyInvite()}><Copy className="h-4 w-4" aria-hidden="true" /> Copiar código</Button>
          </div>
          {copyMessage && <p className="mt-3 text-sm font-bold text-success-700" role="status">{copyMessage}</p>}
        </section>
      ) : null}

      {snapshot.teams.length === 0 ? (
        <EmptyState title="Aún no hay equipos" description="Crea tu primer equipo. También se crea automáticamente uno cuando asignas un nombre de equipo nuevo a un proyecto." action={<CreateTeamDialog />} />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Equipos">
          {snapshot.teams.map((team) => {
            const projects = snapshot.projects.filter((project) => project.teamName === team.name);
            return (
              <article key={team.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Users className="h-5 w-5" aria-hidden="true" /></span>
                  <button onClick={() => void remove(team.id, team.name)} disabled={isMutating} className="grid h-10 w-10 place-items-center rounded-xl text-ink-500 hover:bg-danger-50 hover:text-danger-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 disabled:opacity-50" aria-label={`Eliminar equipo ${team.name}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                </div>
                <h2 className="mt-4 text-lg font-black text-ink-950">{team.name}</h2>
                <p className="mt-1 text-sm text-ink-500">{projects.length} proyecto{projects.length === 1 ? "" : "s"} · {team.members.length} miembro{team.members.length === 1 ? "" : "s"}</p>
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-xs font-black uppercase tracking-wider text-ink-500">Miembros</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {team.members.length ? team.members.map((person) => <span key={person.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 py-1.5 pl-1.5 pr-3 text-xs font-bold text-ink-700"><Avatar person={person} size="sm" />{person.name}</span>) : <span className="text-sm text-ink-500">Sin miembros asignados.</span>}
                  </div>
                  {storageMode === "supabase" && <div className="mt-4"><ManageMembersDialog team={team} /></div>}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
