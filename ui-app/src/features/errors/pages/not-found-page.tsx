import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-card sm:p-12" aria-labelledby="not-found-heading">
      <p className="text-sm font-black uppercase tracking-[0.14em] text-brand-600">404</p>
      <h1 id="not-found-heading" className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink-950">Esta vista no existe</h1>
      <p className="mt-3 text-sm leading-6 text-ink-600">La ruta puede haber cambiado o el recurso ya no está disponible dentro de la organización activa.</p>
      <Link to="/home" className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver al inicio
      </Link>
    </section>
  );
}
