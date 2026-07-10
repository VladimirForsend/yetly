import { MessageCircle, Send, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../../../app/providers/app-providers";
import { getStorageMode, getSupabaseClient, getSupabaseConfig } from "../../../infrastructure/supabase/supabase-connection";
import { Button } from "../../../shared/ui/button";

export function TeamChat() {
  const { snapshot, sendTeamMessage } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [online, setOnline] = useState(1);
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, snapshot?.teamMessages.length]);

  useEffect(() => {
    if (!snapshot || getStorageMode() !== "supabase") {
      setOnline(1);
      return;
    }
    const config = getSupabaseConfig();
    if (!config) return;
    const client = getSupabaseClient(config);
    const channel = client.channel(`yetly-online-${snapshot.activeOrganization.id}`, { config: { presence: { key: snapshot.currentUser.id } } });
    const updateCount = () => {
      const count = Object.values(channel.presenceState()).reduce((total, presences) => total + presences.length, 0);
      setOnline(Math.max(1, count));
    };
    channel.on("presence", { event: "sync" }, updateCount).subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ userId: snapshot.currentUser.id, name: snapshot.currentUser.name, onlineAt: new Date().toISOString() });
      }
    });
    return () => { void client.removeChannel(channel); };
  }, [snapshot?.activeOrganization.id, snapshot?.currentUser.id]);

  if (!snapshot) return null;

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    setError("");
    try {
      await sendTeamMessage(body);
      setBody("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[65] sm:bottom-7 sm:right-7">
      {open && (
        <section className="mb-3 flex h-[min(620px,75vh)] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-float" aria-label="Chat en vivo del equipo">
          <header className="flex items-center gap-3 border-b border-slate-200 bg-ink-950 px-4 py-3 text-white">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500"><MessageCircle className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">Chat de {snapshot.activeOrganization.name}</p><p className="flex items-center gap-1.5 text-xs text-white/70"><span className="h-2 w-2 rounded-full bg-emerald-400" /> {online} conectado{online === 1 ? "" : "s"}</p></div>
            <button onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-white/10" aria-label="Cerrar chat"><X className="h-5 w-5" /></button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {snapshot.teamMessages.length ? snapshot.teamMessages.map((message) => {
              const mine = message.author.id === snapshot.currentUser.id;
              return <article key={message.id} className={`max-w-[88%] rounded-2xl px-3 py-2.5 ${mine ? "ml-auto bg-brand-600 text-white" : "bg-white text-ink-900 shadow-sm"}`}><p className="text-[11px] font-black opacity-70">{message.author.name}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-5">{message.body}</p><time className="mt-1 block text-right text-[10px] opacity-60">{new Date(message.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</time></article>;
            }) : <div className="grid h-full place-items-center text-center"><div><Users className="mx-auto h-8 w-8 text-ink-300" /><p className="mt-2 text-sm font-bold text-ink-600">Inicia la conversación del equipo</p></div></div>}
            <div ref={messagesEnd} />
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            {error && <p className="mb-2 text-xs font-bold text-danger-700" role="alert">{error}</p>}
            <div className="flex items-end gap-2">
              <textarea value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={2} placeholder="Mensaje al equipo…" className="min-w-0 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
              <Button onClick={() => void send()} disabled={sending || !body.trim()} aria-label="Enviar mensaje"><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </section>
      )}
      <button onClick={() => setOpen((value) => !value)} className="ml-auto flex h-14 items-center gap-2 rounded-2xl bg-ink-950 px-4 font-black text-white shadow-float transition hover:-translate-y-0.5 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200" aria-expanded={open} aria-label="Abrir chat del equipo"><MessageCircle className="h-5 w-5" /><span className="hidden sm:inline">Chat</span><span className="h-2 w-2 rounded-full bg-emerald-400" /></button>
    </div>
  );
}
