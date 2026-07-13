import { CheckCircle2, KeyRound, Loader2, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../../../app/providers/app-providers";
import { clearPasswordRecoveryIntent, consumePasswordRecoveryReturnPath, getAuthRedirectError } from "../../../infrastructure/supabase/supabase-connection";
import { Button } from "../../../shared/ui/button";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { cloudUserEmail, updateCloudPassword } = useWorkspace();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState(() => getAuthRedirectError() ?? "");

  async function submit() {
    setError("");
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirmation) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    try {
      await updateCloudPassword(password);
      setComplete(true);
      setPassword("");
      setConfirmation("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos actualizar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  function leave() {
    const recoveryReturn = complete ? consumePasswordRecoveryReturnPath() : undefined;
    clearPasswordRecoveryIntent();
    navigate(recoveryReturn ?? (complete ? "/home" : "/connect-supabase"), { replace: true });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#ede9fe_0,transparent_35%),linear-gradient(180deg,#fff,#f8fafc)] px-4 py-10">
      <section className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-float sm:p-9" aria-labelledby="reset-password-heading">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          {complete ? <CheckCircle2 className="h-6 w-6" /> : <LockKeyhole className="h-6 w-6" />}
        </span>
        <p className="mt-5 text-xs font-black uppercase tracking-[.14em] text-brand-700">Seguridad de la cuenta</p>
        <h1 id="reset-password-heading" className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink-950">{complete ? "Contraseña actualizada" : "Crea una contraseña nueva"}</h1>

        {complete ? (
          <div>
            <p className="mt-3 text-sm leading-6 text-ink-600">La nueva contraseña ya está activa. Puedes continuar trabajando en Yetly.</p>
            <Button className="mt-7" onClick={leave}>Continuar a Yetly</Button>
          </div>
        ) : cloudUserEmail ? (
          <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="mt-7 space-y-5">
            <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-bold text-brand-800">Recuperando la cuenta {cloudUserEmail}</p>
            <label className="block">
              <span className="flex items-center gap-2 text-sm font-black text-ink-900"><KeyRound className="h-4 w-4" /> Nueva contraseña</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required autoComplete="new-password" className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
            </label>
            <label className="block">
              <span className="text-sm font-black text-ink-900">Repite la contraseña</span>
              <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={8} required autoComplete="new-password" className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
            </label>
            <Button type="submit" disabled={busy || password.length < 8 || confirmation.length < 8}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Guardar contraseña</Button>
          </form>
        ) : (
          <div className="mt-6">
            <p className="text-sm leading-6 text-ink-600">Abre el enlace del correo de recuperación en este navegador. Si ya lo hiciste, estamos validando la sesión segura.</p>
            <div className="mt-5 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-ink-600"><Loader2 className="h-4 w-4 animate-spin text-brand-600" /> Verificando enlace…</div>
            <Button variant="secondary" className="mt-5" onClick={leave}>Volver al inicio de sesión</Button>
          </div>
        )}

        {error && <p className="mt-5 rounded-xl bg-danger-50 px-4 py-3 text-sm font-bold text-danger-700" role="alert">{error.replace(/\+/g, " ")}</p>}
      </section>
    </main>
  );
}
