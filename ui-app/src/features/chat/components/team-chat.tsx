import { Hash, MessageCircle, Plus, Send, UserRound, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatConversation } from "../../../application/ports/workspace-port";
import { useWorkspace } from "../../../app/providers/app-providers";
import { getStorageMode, getSupabaseClient, getSupabaseConfig } from "../../../infrastructure/supabase/supabase-connection";
import { Button } from "../../../shared/ui/button";

function conversationLabel(conversation: ChatConversation) {
  if (conversation.type === "general") return "general";
  return conversation.name;
}

function conversationIcon(conversation: ChatConversation) {
  if (conversation.type === "direct") return <UserRound className="h-4 w-4" />;
  return <Hash className="h-4 w-4" />;
}

export function TeamChat() {
  const { snapshot, createChatChannel, startDirectChat, sendChatMessage } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>();
  const [body, setBody] = useState("");
  const [channelName, setChannelName] = useState("");
  const [directUserId, setDirectUserId] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [online, setOnline] = useState(1);
  const messagesEnd = useRef<HTMLDivElement>(null);

  const conversations = useMemo(() => {
    if (!snapshot) return [];
    return [...snapshot.chatConversations].sort((a, b) => {
      const weight = (conversation: ChatConversation) => conversation.type === "general" ? 0 : conversation.type === "channel" ? 1 : 2;
      return weight(a) - weight(b) || conversationLabel(a).localeCompare(conversationLabel(b), "es");
    });
  }, [snapshot?.chatConversations]);

  const activeConversation = conversations.find((conversation) => conversation.id === activeId) ?? conversations[0];
  const messages = snapshot?.chatMessages.filter((message) => message.conversationId === activeConversation?.id) ?? [];
  const people = snapshot?.workload.map((item) => item.person).filter((person) => person.id !== snapshot.currentUser.id) ?? [];

  useEffect(() => {
    if (!activeId && conversations[0]) setActiveId(conversations[0].id);
    if (activeId && conversations.length && !conversations.some((conversation) => conversation.id === activeId)) {
      setActiveId(conversations[0].id);
    }
  }, [activeId, conversations]);

  useEffect(() => {
    if (open) messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, activeConversation?.id, messages.length]);

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
    if (!activeConversation || !body.trim()) return;
    setSending(true);
    setError("");
    try {
      await sendChatMessage(activeConversation.id, body);
      setBody("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  async function createChannel() {
    if (!channelName.trim()) return;
    setError("");
    try {
      await createChatChannel(channelName);
      setChannelName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos crear el canal.");
    }
  }

  async function openDirect() {
    if (!directUserId) return;
    setError("");
    try {
      const conversationId = await startDirectChat(directUserId);
      setActiveId(conversationId);
      setDirectUserId("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos abrir el chat directo.");
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[65] sm:bottom-7 sm:right-7">
      {open && (
        <section className="mb-3 flex h-[min(680px,78vh)] w-[min(860px,calc(100vw-2.5rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-float" aria-label="Chat en vivo del equipo">
          <aside className="hidden w-64 flex-col border-r border-slate-200 bg-ink-950 text-white sm:flex">
            <header className="border-b border-white/10 px-4 py-3">
              <p className="truncate text-sm font-black">{snapshot.activeOrganization.name}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-white/70"><span className="h-2 w-2 rounded-full bg-emerald-400" /> {online} conectado{online === 1 ? "" : "s"}</p>
            </header>
            <div className="flex-1 overflow-y-auto p-3">
              <p className="px-2 text-[11px] font-black uppercase tracking-wide text-white/45">Canales</p>
              <div className="mt-2 space-y-1">
                {conversations.filter((conversation) => conversation.type !== "direct").map((conversation) => (
                  <button key={conversation.id} onClick={() => setActiveId(conversation.id)} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold ${activeConversation?.id === conversation.id ? "bg-white text-ink-950" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
                    {conversationIcon(conversation)}
                    <span className="truncate">{conversationLabel(conversation)}</span>
                  </button>
                ))}
              </div>
              <form onSubmit={(event) => { event.preventDefault(); void createChannel(); }} className="mt-3 flex gap-2">
                <input value={channelName} onChange={(event) => setChannelName(event.target.value)} placeholder="nuevo-canal" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-white outline-none placeholder:text-white/35 focus:border-white/40" />
                <button className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 hover:bg-white/20" aria-label="Crear canal"><Plus className="h-4 w-4" /></button>
              </form>

              <p className="mt-5 px-2 text-[11px] font-black uppercase tracking-wide text-white/45">Mensajes directos</p>
              <div className="mt-2 space-y-1">
                {conversations.filter((conversation) => conversation.type === "direct").map((conversation) => (
                  <button key={conversation.id} onClick={() => setActiveId(conversation.id)} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold ${activeConversation?.id === conversation.id ? "bg-white text-ink-950" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
                    {conversationIcon(conversation)}
                    <span className="truncate">{conversationLabel(conversation)}</span>
                  </button>
                ))}
              </div>
              <form onSubmit={(event) => { event.preventDefault(); void openDirect(); }} className="mt-3 space-y-2">
                <select value={directUserId} onChange={(event) => setDirectUserId(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-white outline-none focus:border-white/40">
                  <option value="">Elegir persona</option>
                  {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
                <button className="flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 text-xs font-black hover:bg-brand-600"><MessageCircle className="h-4 w-4" /> Abrir DM</button>
              </form>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">{activeConversation ? conversationIcon(activeConversation) : <MessageCircle className="h-5 w-5" />}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-ink-950">{activeConversation ? conversationLabel(activeConversation) : "Chat"}</p>
                <p className="truncate text-xs font-bold text-ink-500">{activeConversation?.type === "direct" ? "Mensaje directo" : "Canal de texto"}</p>
              </div>
              <button onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-slate-100" aria-label="Cerrar chat"><X className="h-5 w-5" /></button>
            </header>

            <div className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50 p-2 sm:hidden">
              {conversations.map((conversation) => (
                <button key={conversation.id} onClick={() => setActiveId(conversation.id)} className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black ${activeConversation?.id === conversation.id ? "bg-ink-950 text-white" : "bg-white text-ink-600"}`}>
                  {conversationIcon(conversation)}
                  <span>{conversationLabel(conversation)}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
              {messages.length ? messages.map((message) => {
                const mine = message.author.id === snapshot.currentUser.id;
                return <article key={message.id} className={`max-w-[88%] rounded-2xl px-3 py-2.5 ${mine ? "ml-auto bg-brand-600 text-white" : "bg-white text-ink-900 shadow-sm"}`}><p className="text-[11px] font-black opacity-70">{message.author.name}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-5">{message.body}</p><time className="mt-1 block text-right text-[10px] opacity-60">{new Date(message.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</time></article>;
              }) : <div className="grid h-full place-items-center text-center"><div><Users className="mx-auto h-8 w-8 text-ink-300" /><p className="mt-2 text-sm font-bold text-ink-600">Sin mensajes todavía</p></div></div>}
              <div ref={messagesEnd} />
            </div>

            <div className="border-t border-slate-200 bg-white p-3">
              {error && <p className="mb-2 text-xs font-bold text-danger-700" role="alert">{error}</p>}
              <div className="flex items-end gap-2">
                <textarea value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={2} placeholder="Escribe un mensaje…" className="min-w-0 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
                <Button onClick={() => void send()} disabled={sending || !body.trim() || !activeConversation} aria-label="Enviar mensaje"><Send className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        </section>
      )}
      <button onClick={() => setOpen((value) => !value)} className="ml-auto flex h-14 items-center gap-2 rounded-2xl bg-ink-950 px-4 font-black text-white shadow-float transition hover:-translate-y-0.5 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200" aria-expanded={open} aria-label="Abrir chat del equipo"><MessageCircle className="h-5 w-5" /><span className="hidden sm:inline">Chat</span><span className="h-2 w-2 rounded-full bg-emerald-400" /></button>
    </div>
  );
}
