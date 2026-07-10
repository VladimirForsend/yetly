import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clipboard,
  Cloud,
  Database,
  ExternalLink,
  KeyRound,
  Link2,
  LockKeyhole,
  LogIn,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useWorkspace } from "../../../app/providers/app-providers";
import {
  dashboardLinks,
  getPublishedSupabaseConfig,
  probeSupabase,
  saveSupabaseConfig,
  validateSupabaseConfig,
  type SupabaseConnectionConfig,
} from "../../../infrastructure/supabase/supabase-connection";
import { YETLY_SUPABASE_SCHEMA_SQL } from "../../../infrastructure/supabase/yetly-schema-sql";
import { Button } from "../../../shared/ui/button";

type AuthMode = "signup" | "signin";
type WorkspaceMode = "create" | "join";

function ExternalGuideLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-ink-800 transition hover:border-brand-300 hover:bg-brand-50 focus:outline-none focus:ring-4 focus:ring-brand-100"
    >
      {children}
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    storageMode,
    supabaseConfig,
    cloudUserEmail,
    connectSupabase,
    signUpCloud,
    signInCloud,
    createWorkspace,
    joinOrganization,
    isMutating,
  } = useWorkspace();

  const [step, setStep] = useState(() => (supabaseConfig ? 3 : 0));
  const [url, setUrl] = useState(supabaseConfig?.url ?? "");
  const [publishableKey, setPublishableKey] = useState(supabaseConfig?.publishableKey ?? "");
  const [probeMessage, setProbeMessage] = useState("");
  const [schemaReady, setSchemaReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState(cloudUserEmail ?? "");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("create");
  const [userName, setUserName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const inviteHandledRef = useRef(false);
  const schemaCheckedRef = useRef(false);

  const config: SupabaseConnectionConfig = useMemo(() => ({
    url: url.trim(),
    publishableKey: publishableKey.trim(),
  }), [url, publishableKey]);
  const links = useMemo(() => dashboardLinks(url || supabaseConfig?.url || ""), [url, supabaseConfig?.url]);

  useEffect(() => {
    if (schemaCheckedRef.current || searchParams.get("invite") || !supabaseConfig) return;
    schemaCheckedRef.current = true;
    void probeSupabase(supabaseConfig).then((result) => {
      setSchemaReady(result.schemaReady);
      setProbeMessage(result.message);
      if (!result.schemaReady) setStep(2);
    }).catch((cause) => {
      setError(cause instanceof Error ? cause.message : "No pudimos revisar la instalación Supabase.");
      setStep(1);
    });
  }, [searchParams, supabaseConfig]);

  useEffect(() => {
    if (inviteHandledRef.current) return;
    const invite = searchParams.get("invite")?.trim().toUpperCase() ?? "";
    const invitedUrl = searchParams.get("supabaseUrl")?.trim() ?? "";
    const invitedKey = searchParams.get("publishableKey")?.trim() ?? "";
    if (!invite) return;

    inviteHandledRef.current = true;
    setUrl(invitedUrl);
    setPublishableKey(invitedKey);
    setInviteCode(invite);
    setWorkspaceMode("join");

    let embeddedConfig: SupabaseConnectionConfig | null = null;
    try {
      embeddedConfig = invitedUrl && invitedKey
        ? validateSupabaseConfig({ url: invitedUrl, publishableKey: invitedKey })
        : getPublishedSupabaseConfig() ?? supabaseConfig;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La invitación no es válida.");
      setStep(1);
      return;
    }

    if (!embeddedConfig) {
      setError("Esta invitación no trae la conexión del espacio. Pide una invitación nueva.");
      setStep(1);
      return;
    }

    setUrl(embeddedConfig.url);
    setPublishableKey(embeddedConfig.publishableKey);

    const needsConfigRefresh = !supabaseConfig
      || supabaseConfig.url !== embeddedConfig.url
      || supabaseConfig.publishableKey !== embeddedConfig.publishableKey;

    if (needsConfigRefresh) {
      saveSupabaseConfig(embeddedConfig);
      const cleanParams = new URLSearchParams({ invite });
      window.location.replace(`${window.location.origin}${window.location.pathname}#/connect-supabase?${cleanParams.toString()}`);
      return;
    }

    setSchemaReady(true);
    setProbeMessage("Invitación lista. Crea tu cuenta o inicia sesión para unirte.");
    setStep(cloudUserEmail ? 4 : 3);
  }, [cloudUserEmail, searchParams, supabaseConfig]);

  async function testConnection() {
    setError("");
    setProbeMessage("");
    try {
      const result = await connectSupabase(config);
      setSchemaReady(result.schemaReady);
      setProbeMessage(result.message);
      setStep(result.schemaReady ? 3 : 2);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos conectar con Supabase.");
    }
  }

  async function verifySchema() {
    setError("");
    setProbeMessage("");
    try {
      const activeConfig = supabaseConfig ?? config;
      const result = await probeSupabase(activeConfig);
      setSchemaReady(result.schemaReady);
      setProbeMessage(result.message);
      if (result.schemaReady) setStep(3);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos verificar el esquema.");
    }
  }

  async function copySchema() {
    setError("");
    try {
      await navigator.clipboard.writeText(YETLY_SUPABASE_SCHEMA_SQL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Tu navegador bloqueó el portapapeles. Selecciona el SQL manualmente.");
    }
  }

  async function submitAuth() {
    setError("");
    setAuthMessage("");
    try {
      if (authMode === "signup") {
        const result = await signUpCloud(email, password);
        if (result.needsEmailConfirmation) {
          setAuthMessage("Cuenta creada. Revisa tu correo, confirma la cuenta y luego vuelve para iniciar sesión.");
          setAuthMode("signin");
          return;
        }
        setAuthMessage("Cuenta creada y sesión iniciada.");
      } else {
        await signInCloud(email, password);
        setAuthMessage("Sesión iniciada correctamente.");
      }
      setStep(4);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos completar el acceso.");
    }
  }

  async function finishWorkspace() {
    setError("");
    try {
      if (workspaceMode === "create") {
        await createWorkspace({
          userName,
          organizationName,
          role: "Owner",
        });
      } else {
        await joinOrganization({
          inviteCode,
          userName,
          role: "Member",
        });
      }
      navigate("/home", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos abrir el espacio compartido.");
    }
  }

  const totalSteps = 5;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ede9fe_0,transparent_30%),linear-gradient(180deg,#fff,#f8fafc)] px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-blue-500 text-xl font-black text-white shadow-card">Y</span>
            <div>
              <p className="text-lg font-black tracking-[-0.04em] text-ink-950">Yetly Cloud</p>
              <p className="text-xs font-semibold text-ink-500">Conecta tu propio Supabase, paso a paso</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {storageMode === "local" && (
              <Button variant="secondary" onClick={() => navigate("/home")}>
                Seguir en local
              </Button>
            )}
            <p className="text-sm font-bold text-ink-500" aria-live="polite">
              Paso {Math.min(step + 1, totalSteps)} de {totalSteps}
            </p>
          </div>
        </header>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={Math.min(step + 1, totalSteps)} aria-label="Progreso de conexión Supabase">
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(Math.min(step + 1, totalSteps) / totalSteps) * 100}%` }} />
        </div>

        <section className="mt-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-float sm:p-9">
          {step === 0 && (
            <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-brand-700">
                  <Sparkles className="h-4 w-4" aria-hidden="true" /> Opcional
                </span>
                <h1 className="mt-5 text-4xl font-black tracking-[-0.055em] text-ink-950 sm:text-5xl">Local si quieres. Cloud cuando lo necesites.</h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-ink-600">
                  Yetly funciona sin login en este navegador. Conectar Supabase sirve para iniciar sesión, compartir datos con otras personas y ver cambios entre equipos.
                </p>
                <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                  <p className="font-black">Tus datos locales no se borran ni se suben automáticamente</p>
                  <p className="mt-1">La nube será un espacio separado. Si quieres llevar tu trabajo actual, exporta un respaldo antes y luego impórtalo dentro del espacio Supabase.</p>
                </div>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Button onClick={() => setStep(1)}>
                    Conectar Supabase <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button variant="secondary" onClick={() => navigate("/home")}>
                    No gracias, seguir local
                  </Button>
                </div>
              </div>
              <aside className="rounded-3xl bg-ink-950 p-6 text-white">
                <Cloud className="h-8 w-8 text-brand-200" aria-hidden="true" />
                <h2 className="mt-4 text-xl font-black">¿Qué ganas con Supabase?</h2>
                <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
                  {[
                    "Cuenta con email y contraseña",
                    "Organizaciones compartidas",
                    "Equipos y miembros reales",
                    "Cambios Realtime entre navegadores",
                    "Tus datos viven en tu propio proyecto Supabase",
                  ].map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-success-500" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          )}

          {step === 1 && (
            <div>
              <p className="text-sm font-black uppercase tracking-wider text-brand-700">1. Crea y conecta tu proyecto</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink-950">No necesitas saber backend.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-600">
                Supabase será la “caja fuerte online” de tu Yetly. Crea un proyecto, copia dos datos públicos y vuelve aquí.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
                  <p className="text-sm font-black text-brand-900">Si eres dueño del espacio</p>
                  <p className="mt-1 text-sm leading-6 text-brand-800">Sigue estos pasos una sola vez, instala el SQL v1.7 y después invita al equipo mediante el enlace que genera Yetly.</p>
                </div>
                <div className="rounded-2xl border border-success-600/20 bg-success-50 p-4">
                  <p className="text-sm font-black text-success-800">Si recibiste una invitación</p>
                  <p className="mt-1 text-sm leading-6 text-success-700">Abre el enlace completo enviado por el dueño. No debes crear otro Supabase ni ejecutar SQL.</p>
                </div>
              </div>

              <ol className="mt-7 grid gap-4 lg:grid-cols-3">
                <li className="rounded-2xl border border-slate-200 p-5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-950 text-sm font-black text-white">1</span>
                  <h2 className="mt-4 font-black text-ink-950">Crea el proyecto</h2>
                  <p className="mt-2 text-sm leading-6 text-ink-600">Abre Supabase, inicia sesión y crea un proyecto nuevo. Puedes usar el plan gratuito.</p>
                  <div className="mt-4"><ExternalGuideLink href={links.createProject}>Crear proyecto</ExternalGuideLink></div>
                </li>
                <li className="rounded-2xl border border-slate-200 p-5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-950 text-sm font-black text-white">2</span>
                  <h2 className="mt-4 font-black text-ink-950">Busca “Connect”</h2>
                  <p className="mt-2 text-sm leading-6 text-ink-600">Dentro del proyecto, abre el diálogo Connect. Copia la Project URL.</p>
                  <div className="mt-4"><ExternalGuideLink href={links.projects}>Abrir Dashboard</ExternalGuideLink></div>
                </li>
                <li className="rounded-2xl border border-slate-200 p-5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-950 text-sm font-black text-white">3</span>
                  <h2 className="mt-4 font-black text-ink-950">Copia Publishable Key</h2>
                  <p className="mt-2 text-sm leading-6 text-ink-600">En Settings → API Keys copia la clave que empieza normalmente por <code>sb_publishable_</code>.</p>
                  <div className="mt-4"><ExternalGuideLink href={links.apiKeys}>Abrir API Keys</ExternalGuideLink></div>
                </li>
              </ol>

              <div className="mt-7 grid gap-5 lg:grid-cols-2">
                <label className="block">
                  <span className="flex items-center gap-2 text-sm font-black text-ink-900"><Link2 className="h-4 w-4" aria-hidden="true" /> Project URL</span>
                  <input
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                    placeholder="https://abcxyz.supabase.co"
                    inputMode="url"
                    autoComplete="url"
                  />
                </label>
                <label className="block">
                  <span className="flex items-center gap-2 text-sm font-black text-ink-900"><KeyRound className="h-4 w-4" aria-hidden="true" /> Publishable Key</span>
                  <input
                    value={publishableKey}
                    onChange={(event) => setPublishableKey(event.target.value)}
                    className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 font-mono text-xs outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                    placeholder="sb_publishable_..."
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
              </div>

              <div className="mt-5 rounded-2xl border border-danger-600/20 bg-danger-50 p-4">
                <div className="flex gap-3">
                  <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-danger-700" aria-hidden="true" />
                  <div>
                    <h2 className="font-black text-danger-800">Nunca pegues Secret Key ni service_role</h2>
                    <p className="mt-1 text-sm leading-6 text-danger-700">Yetly las rechaza. En un navegador solo corresponde la Publishable Key y la seguridad real se aplica con RLS.</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => void testConnection()} disabled={!url.trim() || !publishableKey.trim() || isMutating}>
                  Probar conexión <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <ExternalGuideLink href={links.docsKeys}>Ver documentación oficial de claves</ExternalGuideLink>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
              <div>
                <p className="text-sm font-black uppercase tracking-wider text-brand-700">2. Instala Yetly v1.7 en tu base</p>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink-950">Copiar, pegar, ejecutar.</h1>
                <p className="mt-3 text-sm leading-6 text-ink-600">
                  El instalador actual corresponde al esquema interno 17. Crea o actualiza las tablas de Yetly, permisos RLS, invitaciones, mensajes directos, chat, checklist, IA y Realtime.
                </p>
                <div className="mt-4 rounded-2xl border border-warning-200 bg-warning-50 p-4 text-sm leading-6 text-warning-900">
                  <p className="font-black">Solo el dueño realiza esta instalación</p>
                  <p className="mt-1">Copia y ejecuta el bloque completo, incluso si instalaste una versión anterior. El SQL está preparado para actualizar la instalación existente sin borrar proyectos ni tareas.</p>
                </div>
                <ol className="mt-6 space-y-4">
                  {[
                    ["Abre SQL Editor", "Usa el botón directo de abajo."],
                    ["Pulsa “New query”", "Se abrirá un editor grande."],
                    ["Pega todo el SQL v1.7", "Copia el bloque completo; no ejecutes fragmentos sueltos."],
                    ["Pulsa Run", "Espera el mensaje de éxito."],
                    ["Vuelve aquí", "Pulsa Verificar instalación."],
                  ].map(([title, text], index) => (
                    <li key={title} className="flex gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-xs font-black text-brand-700">{index + 1}</span>
                      <div><h2 className="text-sm font-black text-ink-950">{title}</h2><p className="mt-0.5 text-sm leading-6 text-ink-600">{text}</p></div>
                    </li>
                  ))}
                </ol>
                <div className="mt-6 flex flex-wrap gap-3">
                  <ExternalGuideLink href={links.sqlEditor}>Abrir SQL Editor</ExternalGuideLink>
                  <Button variant="secondary" onClick={() => void copySchema()}>
                    <Clipboard className="h-4 w-4" aria-hidden="true" /> {copied ? "SQL copiado" : "Copiar instalador SQL"}
                  </Button>
                </div>
                <div className="mt-4">
                  <Button onClick={() => void verifySchema()}>
                    Verificar instalación <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-black text-ink-900" htmlFor="yetly-schema-sql">Instalador completo</label>
                  <span className="rounded-full bg-success-50 px-3 py-1 text-xs font-black text-success-700">Actual · v1.7 / esquema 17</span>
                </div>
                <textarea
                  id="yetly-schema-sql"
                  readOnly
                  value={YETLY_SUPABASE_SCHEMA_SQL}
                  className="mt-2 h-[420px] w-full rounded-2xl border border-slate-300 bg-slate-950 p-4 font-mono text-[11px] leading-5 text-slate-200 outline-none focus:ring-4 focus:ring-brand-100"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-8 lg:grid-cols-[1fr_.9fr]">
              <div>
                <p className="text-sm font-black uppercase tracking-wider text-brand-700">3. Crea o entra a tu cuenta</p>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink-950">Ahora sí: usuarios reales.</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600">
                  Esta cuenta vive en tu propio proyecto Supabase. Cada persona del equipo usa su email y contraseña.
                </p>

                {cloudUserEmail ? (
                  <div className="mt-7 rounded-2xl border border-success-600/20 bg-success-50 p-5">
                    <CheckCircle2 className="h-7 w-7 text-success-700" aria-hidden="true" />
                    <h2 className="mt-3 font-black text-ink-950">Sesión iniciada</h2>
                    <p className="mt-1 text-sm text-ink-700">{cloudUserEmail}</p>
                    <div className="mt-5">
                      <Button onClick={() => setStep(4)}>Continuar al equipo <ArrowRight className="h-4 w-4" aria-hidden="true" /></Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mt-6 inline-flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Acceso Supabase">
                      <button type="button" role="tab" aria-selected={authMode === "signup"} onClick={() => setAuthMode("signup")} className={`rounded-lg px-4 py-2 text-sm font-black ${authMode === "signup" ? "bg-white text-ink-950 shadow-sm" : "text-ink-600"}`}>Crear cuenta</button>
                      <button type="button" role="tab" aria-selected={authMode === "signin"} onClick={() => setAuthMode("signin")} className={`rounded-lg px-4 py-2 text-sm font-black ${authMode === "signin" ? "bg-white text-ink-950 shadow-sm" : "text-ink-600"}`}>Iniciar sesión</button>
                    </div>
                    <form onSubmit={(event) => { event.preventDefault(); void submitAuth(); }} className="mt-6 max-w-xl space-y-5">
                      <label className="block">
                        <span className="text-sm font-black text-ink-900">Email</span>
                        <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" autoComplete="email" />
                      </label>
                      <label className="block">
                        <span className="text-sm font-black text-ink-900">Contraseña</span>
                        <input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" autoComplete={authMode === "signup" ? "new-password" : "current-password"} />
                      </label>
                      <Button type="submit" disabled={isMutating || email.trim().length < 3 || password.length < 6}>
                        {authMode === "signup" ? <UserPlus className="h-4 w-4" aria-hidden="true" /> : <LogIn className="h-4 w-4" aria-hidden="true" />}
                        {authMode === "signup" ? "Crear cuenta" : "Entrar"}
                      </Button>
                    </form>
                  </>
                )}
              </div>

              <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <ShieldCheck className="h-8 w-8 text-brand-700" aria-hidden="true" />
                <h2 className="mt-4 text-xl font-black text-ink-950">¿Te pide confirmar email?</h2>
                <p className="mt-2 text-sm leading-6 text-ink-600">
                  Es normal. Revisa tu bandeja, pulsa el enlace de confirmación y vuelve a Yetly para iniciar sesión.
                </p>
                <div className="mt-5 flex flex-col gap-3">
                  <ExternalGuideLink href={links.authProviders}>Abrir Auth Providers</ExternalGuideLink>
                  <ExternalGuideLink href={links.authUrlConfig}>Abrir URL Configuration</ExternalGuideLink>
                  <ExternalGuideLink href={links.docsAuth}>Documentación oficial de Auth</ExternalGuideLink>
                </div>
                <p className="mt-5 text-xs leading-5 text-ink-500">
                  Para despliegues públicos, configura en Supabase la URL de tu sitio Yetly como Site URL y redirect permitida.
                </p>
              </aside>
            </div>
          )}

          {step === 4 && (
            <div>
              <p className="text-sm font-black uppercase tracking-wider text-brand-700">4. Crea un espacio o únete a uno</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink-950">Aquí nace el trabajo en equipo.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-600">
                La primera persona crea la organización. Las demás usan el código de invitación que aparece en Yetly.
              </p>

              <div className="mt-6 inline-flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Configurar organización">
                <button type="button" role="tab" aria-selected={workspaceMode === "create"} onClick={() => setWorkspaceMode("create")} className={`rounded-lg px-4 py-2 text-sm font-black ${workspaceMode === "create" ? "bg-white text-ink-950 shadow-sm" : "text-ink-600"}`}>Crear organización</button>
                <button type="button" role="tab" aria-selected={workspaceMode === "join"} onClick={() => setWorkspaceMode("join")} className={`rounded-lg px-4 py-2 text-sm font-black ${workspaceMode === "join" ? "bg-white text-ink-950 shadow-sm" : "text-ink-600"}`}>Unirme con código</button>
              </div>

              <form onSubmit={(event) => { event.preventDefault(); void finishWorkspace(); }} className="mt-7 max-w-2xl">
                <label className="block">
                  <span className="text-sm font-black text-ink-900">Tu nombre visible</span>
                  <input required minLength={2} value={userName} onChange={(event) => setUserName(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" placeholder="Ej. Catalina Rojas" />
                </label>

                {workspaceMode === "create" ? (
                  <label className="mt-5 block">
                    <span className="text-sm font-black text-ink-900">Nombre de la organización</span>
                    <input required minLength={2} value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" placeholder="Ej. Acme Chile" />
                  </label>
                ) : (
                  <label className="mt-5 block">
                    <span className="text-sm font-black text-ink-900">Código de invitación</span>
                    <input required minLength={4} value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 font-mono text-sm uppercase tracking-wider outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" placeholder="A1B2C3D4E5" />
                  </label>
                )}

                <div className="mt-7 rounded-2xl bg-brand-50 p-4 text-sm leading-6 text-brand-900">
                  {workspaceMode === "create"
                    ? "Serás owner. Después copia el código de invitación desde Equipos o Configuración y compártelo con tus compañeros."
                    : "Al entrar, verás los proyectos, tareas y equipos de esa organización según las políticas RLS del proyecto Supabase."}
                </div>

                <div className="mt-6">
                  <Button type="submit" disabled={isMutating || userName.trim().length < 2 || (workspaceMode === "create" ? organizationName.trim().length < 2 : inviteCode.trim().length < 4)}>
                    <Users className="h-4 w-4" aria-hidden="true" />
                    {isMutating ? "Configurando…" : workspaceMode === "create" ? "Crear y entrar" : "Unirme y entrar"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {(probeMessage || authMessage || error) && (
            <div className="mt-7" aria-live="polite">
              {probeMessage && <p className={`rounded-xl px-4 py-3 text-sm font-bold ${schemaReady ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-800"}`}>{probeMessage}</p>}
              {authMessage && <p className="mt-3 rounded-xl bg-info-50 px-4 py-3 text-sm font-bold text-info-800">{authMessage}</p>}
              {error && <p className="mt-3 rounded-xl bg-danger-50 px-4 py-3 text-sm font-bold text-danger-700" role="alert">{error}</p>}
            </div>
          )}

          <footer className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
            <Button variant="secondary" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || isMutating}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Atrás
            </Button>
            <p className="max-w-xl text-right text-xs leading-5 text-ink-500">
              Yetly guarda la conexión pública en este navegador. Nunca almacena Secret Key ni service_role.
            </p>
          </footer>
        </section>
      </div>
    </main>
  );
}
