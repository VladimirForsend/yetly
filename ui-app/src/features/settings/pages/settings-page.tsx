import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Copy,
  Download,
  HardDrive,
  LogOut,
  Monitor,
  Moon,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sun,
  Upload,
  Users,
} from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../../../app/providers/app-providers";
import { createYetlyInviteMessage } from "../../../shared/lib/yetly-invite";
import { Button } from "../../../shared/ui/button";
import { PageHeader } from "../../../shared/ui/page-header";
import { OllamaSettings } from "../../ai/components/ollama-settings";

export function SettingsPage() {
  const navigate = useNavigate();
  const {
    snapshot,
    storageMode,
    supabaseConfig,
    cloudUserEmail,
    disconnectSupabase,
    signOutCloud,
    rotateInviteCode,
    exportSnapshot,
    importSnapshot,
    resetWorkspace,
    refetch,
    isMutating,
  } = useWorkspace();
  const [density, setDensity] = useState("compact");
  const [saved, setSaved] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [backupError, setBackupError] = useState("");
  const [connectionMessage, setConnectionMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function downloadBackup() {
    setBackupError("");
    setBackupMessage("");
    try {
      const data = await exportSnapshot();
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `yetly-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setBackupMessage("Respaldo exportado correctamente.");
    } catch (cause) {
      setBackupError(cause instanceof Error ? cause.message : "No fue posible exportar.");
    }
  }

  async function importFile(file?: File) {
    if (!file) return;
    setBackupError("");
    setBackupMessage("");
    try {
      const result = await importSnapshot(await file.text());
      setBackupMessage(`Respaldo importado: ${result.projects} proyectos, ${result.tasks} tareas y ${result.timeEntries} entradas de tiempo.`);
    } catch (cause) {
      setBackupError(cause instanceof Error ? cause.message : "El respaldo no es válido.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function reset() {
    if (storageMode !== "local") return;
    const confirmed = window.confirm("¿Borrar todo el workspace local? Esta acción elimina proyectos, tareas y tiempo de este navegador. Exporta un respaldo antes si lo necesitas.");
    if (!confirmed) return;
    await resetWorkspace();
  }

  async function copyInviteCode() {
    const code = snapshot?.activeOrganization.inviteCode;
    if (!code || !supabaseConfig) return;
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    await navigator.clipboard.writeText(createYetlyInviteMessage(baseUrl, code, supabaseConfig));
    setConnectionMessage("Invitación copiada. Envíala a la persona que quieres sumar.");
  }

  async function renewInviteCode() {
    setConnectionMessage("");
    try {
      const code = await rotateInviteCode();
      if (!supabaseConfig) throw new Error("Falta la conexión pública de Supabase.");
      const baseUrl = `${window.location.origin}${window.location.pathname}`;
      await navigator.clipboard.writeText(createYetlyInviteMessage(baseUrl, code, supabaseConfig));
      refetch();
      setConnectionMessage("Invitación renovada y copiada con su enlace completo. La anterior ya no sirve.");
    } catch (cause) {
      setConnectionMessage(cause instanceof Error ? cause.message : "No pudimos renovar el código.");
    }
  }

  async function disconnect() {
    const confirmed = window.confirm("¿Desconectar Supabase de este navegador? Tus datos cloud no se borrarán. Yetly volverá al modo local.");
    if (!confirmed) return;
    await disconnectSupabase();
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <PageHeader
        eyebrow="Preferencias y datos"
        title="Configuración"
        description="Elige dónde viven tus datos, gestiona acceso compartido y administra respaldos."
      />

      <section className={`rounded-2xl border p-5 sm:p-6 ${storageMode === "supabase" ? "border-success-600/20 bg-success-50" : "border-warning-600/20 bg-warning-50"}`} aria-labelledby="storage-mode-heading">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-brand-700">
              {storageMode === "supabase" ? <Cloud className="h-5 w-5" aria-hidden="true" /> : <HardDrive className="h-5 w-5" aria-hidden="true" />}
            </span>
            <div>
              <h2 id="storage-mode-heading" className="font-black text-ink-950">
                {storageMode === "supabase" ? "Supabase conectado" : "Modo local sin login"}
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-700">
                {storageMode === "supabase"
                  ? "Usuarios, organizaciones, equipos y cambios operativos se leen desde tu propio proyecto Supabase."
                  : "Abres Yetly y trabajas. Los datos quedan en este navegador; no necesitas cuenta ni conexión cloud."}
              </p>
              {storageMode === "supabase" && (
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="font-black text-ink-700">Proyecto</dt><dd className="mt-0.5 break-all text-ink-600">{supabaseConfig?.url}</dd></div>
                  <div><dt className="font-black text-ink-700">Sesión</dt><dd className="mt-0.5 text-ink-600">{cloudUserEmail ?? "Sin sesión activa"}</dd></div>
                </dl>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {storageMode === "local" ? (
              <Button onClick={() => navigate("/connect-supabase")}>
                <Cloud className="h-4 w-4" aria-hidden="true" /> Conectar mi Supabase
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => navigate("/connect-supabase")}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> Revisar instalación
                </Button>
                {cloudUserEmail && (
                  <Button variant="secondary" onClick={() => void signOutCloud()}>
                    <LogOut className="h-4 w-4" aria-hidden="true" /> Cerrar sesión
                  </Button>
                )}
                <Button variant="secondary" onClick={() => void disconnect()}>
                  Volver a modo local
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      <OllamaSettings />

      {storageMode === "supabase" && snapshot?.activeOrganization.inviteCode && (
        <section className="rounded-2xl border border-brand-200 bg-white p-5 shadow-card sm:p-6" aria-labelledby="invite-heading">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-brand-700" aria-hidden="true" />
                <h2 id="invite-heading" className="font-black text-ink-950">Invitar al espacio compartido</h2>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-600">
                Tu compañero abre el enlace de invitación, crea su cuenta o inicia sesión y entra directo con este código.
              </p>
              <div className="mt-4 inline-flex items-center gap-3 rounded-xl bg-slate-950 px-4 py-3 text-white">
                <code className="font-mono text-base font-black tracking-[.18em]">{snapshot.activeOrganization.inviteCode}</code>
              </div>
              <p className="mt-2 text-xs leading-5 text-ink-500">
                Rol actual: {snapshot.activeOrganization.memberRole ?? "member"}. Solo owner/admin pueden renovar el código.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void copyInviteCode()}><Copy className="h-4 w-4" aria-hidden="true" /> Copiar invitación</Button>
              <Button variant="secondary" onClick={() => void renewInviteCode()}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Renovar</Button>
            </div>
          </div>
          {connectionMessage && <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-bold text-brand-800" role="status" aria-live="polite">{connectionMessage}</p>}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6" aria-labelledby="backup-heading">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="backup-heading" className="font-black text-ink-950">Respaldo y restauración</h2>
            <p className="mt-1 text-sm leading-6 text-ink-600">
              {storageMode === "local"
                ? "Exporta un JSON completo antes de cambiar de navegador o borrar datos del sitio."
                : "Exporta una copia legible del workspace cloud. La importación recrea proyectos, tareas y horas en la organización activa."}
            </p>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-700">{snapshot?.projects.length ?? 0} proyectos</span>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => void downloadBackup()} disabled={isMutating}><Download className="h-4 w-4" aria-hidden="true" /> Exportar respaldo</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={isMutating}><Upload className="h-4 w-4" aria-hidden="true" /> Importar respaldo</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(event) => void importFile(event.target.files?.[0])} />
        </div>

        {backupError && <p className="mt-4 rounded-xl bg-danger-50 px-4 py-3 text-sm font-bold text-danger-700" role="alert">{backupError}</p>}
        {backupMessage && <p className="mt-4 rounded-xl bg-success-50 px-4 py-3 text-sm font-bold text-success-700" role="status" aria-live="polite">{backupMessage}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" className="font-black text-ink-950">Apariencia</h2>
        <p className="mt-1 text-sm text-ink-500">Estas preferencias son de interfaz; no alteran datos operativos.</p>

        <fieldset className="mt-6">
          <legend className="text-sm font-black text-ink-950">Tema</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              { id: "light", label: "Claro", Icon: Sun },
              { id: "system", label: "Sistema", Icon: Monitor },
              { id: "dark", label: "Oscuro", Icon: Moon },
            ].map(({ id, label, Icon }) => (
              <label key={id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-brand-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                <input type="radio" name="theme" value={id} defaultChecked={id === "light"} className="h-4 w-4 accent-brand-600" />
                <Icon className="h-5 w-5 text-ink-600" aria-hidden="true" />
                <span className="text-sm font-black text-ink-900">{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-7">
          <legend className="text-sm font-black text-ink-950">Densidad</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              { id: "comfortable", label: "Cómoda", hint: "Más aire" },
              { id: "compact", label: "Compacta", hint: "Recomendada" },
              { id: "dense", label: "Densa", hint: "Más datos" },
            ].map((option) => (
              <label key={option.id} className="cursor-pointer rounded-xl border border-slate-200 p-4 hover:border-brand-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                <div className="flex items-center gap-2">
                  <input type="radio" name="density" value={option.id} checked={density === option.id} onChange={() => setDensity(option.id)} className="h-4 w-4 accent-brand-600" />
                  <span className="text-sm font-black text-ink-900">{option.label}</span>
                </div>
                <p className="mt-1 pl-6 text-xs text-ink-500">{option.hint}</p>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-7 flex items-center gap-3">
          <Button onClick={() => setSaved(true)}>Guardar preferencias</Button>
          {saved && <span className="text-sm font-bold text-success-700" role="status" aria-live="polite">Preferencias aplicadas en esta sesión.</span>}
        </div>
      </section>

      <section className={`rounded-2xl border p-5 sm:p-6 ${storageMode === "local" ? "border-danger-600/20 bg-danger-50" : "border-slate-200 bg-slate-50"}`} aria-labelledby="danger-heading">
        <div className="flex items-start gap-3">
          {storageMode === "local" ? <AlertTriangle className="mt-0.5 h-5 w-5 text-danger-700" aria-hidden="true" /> : <ShieldAlert className="mt-0.5 h-5 w-5 text-ink-500" aria-hidden="true" />}
          <div className="flex-1">
            <h2 id="danger-heading" className="font-black text-ink-950">{storageMode === "local" ? "Zona de riesgo local" : "Borrado cloud protegido"}</h2>
            <p className="mt-1 text-sm leading-6 text-ink-600">
              {storageMode === "local"
                ? "Reiniciar elimina el workspace local de este navegador."
                : "Yetly no borra una organización cloud completa desde una página pública. Administra borrados masivos directamente en tu proyecto Supabase."}
            </p>
            {storageMode === "local" && (
              <Button variant="secondary" className="mt-4 border-danger-600/30 text-danger-700 hover:bg-white" onClick={() => void reset()} disabled={isMutating}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reiniciar workspace
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
