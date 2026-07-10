import { Bot, ChevronDown, CircleHelp, Cloud, Database, FolderKanban, ShieldCheck, Timer, Users } from "lucide-react";
import { PageHeader } from "../../../shared/ui/page-header";

const groups = [
  {
    title: "Primeros pasos",
    Icon: FolderKanban,
    items: [
      ["¿Tengo que crear una cuenta para usar Yetly?", "No. Al abrir Yetly por primera vez se crea un espacio local vacío y puedes trabajar inmediatamente. No hay login obligatorio."],
      ["¿Yetly trae proyectos o tareas de ejemplo?", "No. El workspace operativo comienza vacío. Tú creas proyectos, tareas y horas reales."],
      ["¿Puedo cambiar el estado de una tarea?", "Sí. Puedes moverla entre Backlog, Por hacer, En progreso, Revisión y Hecho. El cambio persiste en el modo de almacenamiento activo."],
    ],
  },
  {
    title: "Modo local",
    Icon: Database,
    items: [
      ["¿Dónde se guardan mis datos si no conecto Supabase?", "En el almacenamiento local de este navegador. No se envían a un servidor por sí solos."],
      ["¿Se pierden al recargar?", "No. Sí puedes perderlos si borras los datos del sitio o cambias de navegador sin exportar un respaldo."],
      ["¿Cómo hago un backup?", "Ve a Configuración y usa Exportar respaldo. Puedes importar el JSON más adelante."],
    ],
  },
  {
    title: "Supabase Cloud",
    Icon: Cloud,
    items: [
      ["¿Qué necesito para conectar Supabase?", "Project URL y Publishable Key de tu propio proyecto. Yetly nunca necesita Secret Key ni service_role en el navegador."],
      ["¿Yetly instala las tablas automáticamente?", "No pide claves administrativas. El onboarding entrega un instalador SQL completo para copiar y ejecutar en el SQL Editor de tu proyecto Supabase, y luego verifica la instalación."],
      ["¿Puedo volver al modo local?", "Sí. Desde Configuración puedes desconectar Supabase. Los datos cloud no se borran y tu workspace local previo permanece en este navegador."],
    ],
  },
  {
    title: "Usuarios y equipos",
    Icon: Users,
    items: [
      ["¿Cómo invito a otra persona?", "Ambos deben conectar el mismo proyecto Supabase. La persona crea su propia cuenta y usa el código de invitación de la organización durante el onboarding."],
      ["¿Puedo tener varios equipos?", "Sí. Una organización puede tener múltiples equipos y una persona puede pertenecer a más de uno. Desde Equipos puedes marcar o desmarcar miembros."],
      ["¿Los cambios aparecen sin recargar?", "En modo Supabase, Yetly escucha cambios Realtime de proyectos, tareas, horas y equipos para refrescar las vistas conectadas."],
    ],
  },
  {
    title: "Tiempo y productividad",
    Icon: Timer,
    items: [
      ["¿Cómo funciona el timer?", "Inicia el timer desde una tarea. Yetly permite un timer activo por usuario. Al detenerlo crea una entrada de tiempo y recalcula totales."],
      ["¿Puedo registrar horas manualmente?", "Sí. En Timesheets selecciona proyecto, tarea opcional, fecha y duración."],
      ["¿Cómo se calcula la carga?", "Se suman estimaciones de tareas abiertas asignadas a cada persona y se comparan con una capacidad semanal base de 40 horas."],
    ],
  },
  {
    title: "Yetly AI y Ollama",
    Icon: Bot,
    items: [
      ["¿Dónde se guarda mi API key de Ollama?", "Solo en este navegador: durante la sesión por defecto o en este dispositivo si marcas Recordar. No se guarda en Supabase ni en los respaldos de Yetly."],
      ["¿Qué información recibe la IA?", "Únicamente el proyecto o tarea que selecciones, junto con fechas, tiempos, checklist, mensajes recientes, carga y dependencias. Los archivos adjuntos no se envían; solo se incluyen sus metadatos."],
      ["¿La IA puede modificar tareas sola?", "No. Si el modelo soporta herramientas puede preparar una propuesta. Yetly muestra cada diferencia y solo aplica los cambios que selecciones y confirmes."],
    ],
  },
  {
    title: "Seguridad y accesibilidad",
    Icon: ShieldCheck,
    items: [
      ["¿Es segura la Publishable Key?", "Está diseñada para clientes públicos como páginas web. La protección de datos depende de Auth, RLS y permisos del proyecto; por eso el instalador Yetly activa políticas RLS."],
      ["¿Por qué Yetly rechaza Secret Key?", "Porque una clave secreta no debe entrar a una página pública. Yetly bloquea claves sb_secret_ y nunca solicita service_role."],
      ["¿Puedo usar Yetly con teclado?", "Los flujos principales usan HTML semántico, foco visible y alternativas sin drag obligatorio."],
    ],
  },
];

export function FaqPage() {
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Centro de ayuda"
        title="Preguntas frecuentes"
        description="Respuestas sobre modo local, Supabase, colaboración, tiempo y seguridad."
      />

      <section className="rounded-3xl bg-gradient-to-br from-ink-950 to-brand-900 p-6 text-white sm:p-8" aria-labelledby="faq-intro">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10"><CircleHelp className="h-6 w-6" aria-hidden="true" /></span>
          <div>
            <h2 id="faq-intro" className="text-2xl font-black tracking-[-0.04em]">Empieza local. Conecta nube cuando te haga falta.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Yetly no obliga a registrarte. Supabase es opcional y sirve para identidad, organizaciones compartidas, equipos y sincronización entre personas.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {groups.map(({ title, Icon, items }) => (
          <section key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6" aria-labelledby={`faq-${title.replace(/\s+/g, "-")}`}>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <h2 id={`faq-${title.replace(/\s+/g, "-")}`} className="text-lg font-black text-ink-950">{title}</h2>
            </div>
            <div className="mt-5 divide-y divide-slate-100">
              {items.map(([question, answer]) => (
                <details key={question} className="group py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-1 text-left text-sm font-black text-ink-900 outline-none focus-visible:ring-4 focus-visible:ring-brand-200">
                    {question}
                    <ChevronDown className="h-4 w-4 shrink-0 text-ink-500 transition group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="pb-2 pt-3 text-sm leading-6 text-ink-600">{answer}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
