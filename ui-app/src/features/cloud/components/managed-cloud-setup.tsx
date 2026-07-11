import { CheckCircle2, Cloud, ExternalLink, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { saveManagedSupabaseConfig } from "../../../infrastructure/supabase/supabase-connection";
import { Button } from "../../../shared/ui/button";
import {
  beginManagedCloudOAuth,
  captureManagedCloudTicket,
  clearManagedCloudTicket,
  getProvisioningJob,
  listProvisioningTargets,
  managedCloudBaseUrl,
  retryProvisioningJob,
  startProvisioning,
} from "../services/managed-cloud-client";
import { downloadMigrationBackup, savePendingMigration } from "../services/local-migration-store";
import type { ProvisioningJob, ProvisioningTarget } from "../types";

interface ManagedCloudSetupProps {
  workspaceName: string;
  exportLocalWorkspace: () => Promise<string>;
  onUseAdvanced: () => void;
  currentProjectRef?: string;
}

export function ManagedCloudSetup({ workspaceName, exportLocalWorkspace, onUseAdvanced, currentProjectRef }: ManagedCloudSetupProps) {
  const [targets, setTargets] = useState<ProvisioningTarget>();
  const [mode, setMode] = useState<"create" | "existing">("create");
  const [organizationId, setOrganizationId] = useState("");
  const [projectRef, setProjectRef] = useState("");
  const [job, setJob] = useState<ProvisioningJob>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ticket = useMemo(() => captureManagedCloudTicket(), []);

  useEffect(() => {
    if (!ticket) return;
    setBusy(true);
    void listProvisioningTargets()
      .then((result) => {
        setTargets(result);
        setOrganizationId(result.organizations[0]?.id ?? "");
        const current = result.projects.find((project) => project.ref === currentProjectRef && project.compatible);
        setProjectRef(current?.ref ?? result.projects[0]?.ref ?? "");
        if (current) {
          setMode("existing");
          setOrganizationId(current.organizationId);
        }
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "No pudimos leer tus proyectos Supabase."))
      .finally(() => setBusy(false));
  }, [ticket]);

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed" || job.status === "needs_reauthorization") return;
    const timer = window.setTimeout(() => {
      void getProvisioningJob(job.id).then(setJob).catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Perdimos el seguimiento de la instalación.");
      });
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [job]);

  useEffect(() => {
    if (job?.status !== "completed" || !job.connection) return;
    saveManagedSupabaseConfig(job.connection);
    clearManagedCloudTicket();
    window.setTimeout(() => {
      if (currentProjectRef && currentProjectRef === job.connection?.projectRef) window.location.hash = "#/settings";
      window.location.reload();
    }, 700);
  }, [currentProjectRef, job]);

  async function authorize() {
    setError("");
    setBusy(true);
    try {
      const backup = await savePendingMigration(await exportLocalWorkspace());
      downloadMigrationBackup(backup);
      const returnUrl = `${window.location.origin}${window.location.pathname}#/connect-supabase`;
      await beginManagedCloudOAuth({ returnUrl, workspaceName });
    } catch (cause) {
      setBusy(false);
      setError(cause instanceof Error ? cause.message : "No pudimos iniciar la conexión segura.");
    }
  }

  async function provision() {
    setError("");
    setBusy(true);
    try {
      const result = await startProvisioning({
        mode,
        organizationId,
        projectRef: mode === "existing" ? projectRef : undefined,
        workspaceName,
        siteUrl: `${window.location.origin}${window.location.pathname}`,
      });
      setJob(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos iniciar la instalación.");
    } finally {
      setBusy(false);
    }
  }

  if (job) {
    const done = job.status === "completed";
    return (
      <div className="mx-auto max-w-3xl py-4 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-brand-50 text-brand-700">
          {done ? <CheckCircle2 className="h-8 w-8" /> : <Loader2 className="h-8 w-8 animate-spin" />}
        </span>
        <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] text-ink-950">
          {done ? "Yetly Cloud está listo" : "Configurando tu Cloud"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-600">{job.message}</p>
        <div className="mx-auto mt-6 h-3 max-w-xl overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${Math.max(4, job.progress)}%` }} />
        </div>
        <p className="mt-3 text-xs font-black uppercase tracking-wider text-brand-700">{job.phase.replace("-", " ")} · {job.progress}%</p>
        {job.projectDashboardUrl && (
          <a className="mt-6 inline-flex items-center gap-2 text-sm font-black text-brand-700" href={job.projectDashboardUrl} target="_blank" rel="noreferrer">
            Ver proyecto en Supabase <ExternalLink className="h-4 w-4" />
          </a>
        )}
        {job.status === "failed" && (
          <div className="mt-6">
            <Button onClick={() => void retryProvisioningJob(job.id).then(setJob).catch((cause) => setError(cause instanceof Error ? cause.message : "No pudimos reintentar."))}><RefreshCw className="h-4 w-4" /> Continuar instalación</Button>
          </div>
        )}
      </div>
    );
  }

  if (ticket && targets) {
    const compatibleProjects = targets.projects.filter((project) => project.compatible);
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-black uppercase tracking-wider text-brand-700">Supabase autorizado</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink-950">¿Dónde instalamos Yetly?</h1>
        <p className="mt-3 text-sm leading-6 text-ink-600">Yetly hará toda la configuración. No tendrás que copiar claves, SQL ni comandos.</p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => setMode("create")} className={`rounded-2xl border p-5 text-left ${mode === "create" ? "border-brand-500 bg-brand-50" : "border-slate-200"}`}>
            <span className="font-black text-ink-950">Crear proyecto nuevo</span>
            <span className="mt-2 block text-sm leading-6 text-ink-600">Recomendado. Queda limpio y dedicado a Yetly.</span>
          </button>
          <button type="button" disabled={!targets.canInstallExistingProjects || compatibleProjects.length === 0} onClick={() => setMode("existing")} className={`rounded-2xl border p-5 text-left disabled:cursor-not-allowed disabled:opacity-50 ${mode === "existing" ? "border-brand-500 bg-brand-50" : "border-slate-200"}`}>
            <span className="font-black text-ink-950">Usar proyecto existente</span>
            <span className="mt-2 block text-sm leading-6 text-ink-600">Yetly revisará permisos y compatibilidad antes de tocarlo.</span>
          </button>
        </div>

        <label className="mt-6 block text-sm font-black text-ink-900">Organización Supabase
          <select value={organizationId} onChange={(event) => {
            const nextOrganization = event.target.value;
            setOrganizationId(nextOrganization);
            if (mode === "existing") setProjectRef(compatibleProjects.find((project) => project.organizationId === nextOrganization)?.ref ?? "");
          }} className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4">
            {targets.organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
          </select>
        </label>

        {mode === "existing" && (
          <label className="mt-5 block text-sm font-black text-ink-900">Proyecto
            <select value={projectRef} onChange={(event) => setProjectRef(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4">
              {compatibleProjects.filter((project) => project.organizationId === organizationId).map((project) => <option key={project.ref} value={project.ref}>{project.name}</option>)}
            </select>
          </label>
        )}

        <div className="mt-7 flex flex-wrap gap-3">
          <Button onClick={() => void provision()} disabled={!organizationId || (mode === "existing" && !projectRef) || busy}>
            <Cloud className="h-4 w-4" /> Instalar Yetly automáticamente
          </Button>
          <Button variant="secondary" onClick={() => { clearManagedCloudTicket(); window.location.reload(); }}>Cancelar</Button>
        </div>
        {error && <p className="mt-5 rounded-xl bg-danger-50 px-4 py-3 text-sm font-bold text-danger-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.08fr_.92fr] lg:items-center">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-brand-700"><Cloud className="h-4 w-4" /> Configuración automática</span>
        <h1 className="mt-5 text-4xl font-black tracking-[-0.055em] text-ink-950 sm:text-5xl">Activa Yetly Cloud en pocos minutos.</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-ink-600">Inicia sesión en Supabase, autoriza a Yetly y elige dónde instalarlo. Yetly preparará la seguridad, archivos, tiempo real y Ollama por ti.</p>
        <div className="mt-5 rounded-2xl border border-success-600/20 bg-success-50 p-4 text-sm leading-6 text-success-800">
          <p className="font-black">Tu trabajo local está protegido</p>
          <p className="mt-1">Antes de salir crearemos un respaldo descargable. Después podrás copiar tus datos al Cloud sin borrar este navegador.</p>
        </div>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button onClick={() => void authorize()} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />} Activar Yetly Cloud</Button>
          <Button variant="secondary" onClick={onUseAdvanced}>Configuración avanzada</Button>
        </div>
        {error && <p className="mt-5 rounded-xl bg-danger-50 px-4 py-3 text-sm font-bold text-danger-700">{error}</p>}
      </div>
      <aside className="rounded-3xl bg-ink-950 p-6 text-white">
        <ShieldCheck className="h-8 w-8 text-brand-200" />
        <h2 className="mt-4 text-xl font-black">Yetly se encarga</h2>
        <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
          {["Base de datos y permisos RLS", "Archivos y cambios en tiempo real", "Cuentas e invitaciones de equipo", "Proxy seguro para Ollama Cloud", "Actualizaciones y reparación automática"].map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-success-500" />{item}</li>)}
        </ul>
        <p className="mt-6 text-xs leading-5 text-slate-400">El Control Plane solo administra la instalación. Los proyectos y tareas se copian directamente desde tu navegador a tu propio Supabase.</p>
        <p className="mt-3 break-all text-[10px] text-slate-600">Servicio: {managedCloudBaseUrl()}</p>
      </aside>
    </div>
  );
}
