import { Check, Hash, MessageCircle, Pencil, Plus, Send, Trash2, UserRound, Users, X } from "lucide-react";
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
  const {
    snapshot, createChatChannel, startDirectChat, sendChatMessage,
    updateChatMessage, deleteChatMessage, updateChatChannel, deleteChatChannel,
  } = useWorkspace();
  const [activeId, setActiveId] = useState<string>();
  const [body, setBody] = useState("");
  const [channelName, setChannelName] = useState("");
  const [directUserId, setDirectUserId] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string>();
  const [editingMessageBody, setEditingMessageBody] = useState("");
  const [editingChannel, setEditingChannel] = useState(false);
  const [channelDraft, setChannelDraft] = useState("");
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
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.id, messages.length]);

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
    const pendingBody = body;
    setBody("");
    setSending(true);
    setError("");
    try {
      await sendChatMessage(activeConversation.id, pendingBody);
    } catch (cause) {
      setBody((current) => current || pendingBody);
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

  async function saveMessageEdit() {
    if (!editingMessageId || !editingMessageBody.trim()) return;
    setBusyAction(true);
    setError("");
    try {
      await updateChatMessage(editingMessageId, editingMessageBody);
      setEditingMessageId(undefined);
      setEditingMessageBody("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos editar el mensaje.");
    } finally {
      setBusyAction(false);
    }
  }

  async function removeMessage(messageId: string) {
    if (!window.confirm("¿Eliminar este mensaje? Esta acción no se puede deshacer.")) return;
    setBusyAction(true);
    setError("");
    try {
      await deleteChatMessage(messageId);
      if (editingMessageId === messageId) setEditingMessageId(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos eliminar el mensaje.");
    } finally {
      setBusyAction(false);
    }
  }

  async function saveChannelEdit() {
    if (!activeConversation || !channelDraft.trim()) return;
    setBusyAction(true);
    setError("");
    try {
      await updateChatChannel(activeConversation.id, channelDraft);
      setEditingChannel(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos editar el canal.");
    } finally {
      setBusyAction(false);
    }
  }

  async function removeChannel() {
    if (!activeConversation || !window.confirm(`¿Eliminar #${activeConversation.name} y todos sus mensajes? Esta acción no se puede deshacer.`)) return;
    setBusyAction(true);
    setError("");
    try {
      await deleteChatChannel(activeConversation.id);
      setEditingChannel(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos eliminar el canal.");
    } finally {
      setBusyAction(false);
    }
  }

  const isOrganizationAdmin = snapshot.activeOrganization.memberRole === "owner" || snapshot.activeOrganization.memberRole === "admin";
  const canManageActiveChannel = activeConversation?.type === "channel"
    && (activeConversation.createdBy === snapshot.currentUser.id || isOrganizationAdmin);

  return (
        <section className="flex min-h-[calc(100vh-15rem)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card" aria-label="Canales y mensajes del equipo">
          <aside className="hidden w-72 flex-col border-r border-slate-200 bg-ink-950 text-white md:flex">
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
                {editingChannel ? (
                  <div className="flex max-w-md items-center gap-2">
                    <input value={channelDraft} onChange={(event) => setChannelDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void saveChannelEdit(); if (event.key === "Escape") setEditingChannel(false); }} autoFocus className="h-9 min-w-0 flex-1 rounded-lg border border-brand-300 px-3 text-sm font-black outline-none focus:ring-4 focus:ring-brand-100" />
                    <button type="button" onClick={() => void saveChannelEdit()} disabled={busyAction || !channelDraft.trim()} className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white disabled:opacity-50" aria-label="Guardar nombre"><Check className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setEditingChannel(false)} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-ink-600" aria-label="Cancelar"><X className="h-4 w-4" /></button>
                  </div>
                ) : <p className="truncate text-sm font-black text-ink-950">{activeConversation ? conversationLabel(activeConversation) : "Chat"}</p>}
                <p className="truncate text-xs font-bold text-ink-500">{activeConversation?.type === "direct" ? "Mensaje directo" : "Canal de texto"}</p>
              </div>
              {canManageActiveChannel && !editingChannel && (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => { setChannelDraft(activeConversation.name); setEditingChannel(true); }} className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-slate-100 hover:text-brand-700" aria-label="Editar canal" title="Editar canal"><Pencil className="h-4 w-4" /></button>
                  <button type="button" onClick={() => void removeChannel()} disabled={busyAction} className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-danger-50 hover:text-danger-700 disabled:opacity-50" aria-label="Eliminar canal" title="Eliminar canal"><Trash2 className="h-4 w-4" /></button>
                </div>
              )}
            </header>

            <div className="space-y-3 border-b border-slate-200 bg-slate-50 p-3 md:hidden">
              <div className="flex gap-2 overflow-x-auto">
              {conversations.map((conversation) => (
                <button key={conversation.id} onClick={() => setActiveId(conversation.id)} className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black ${activeConversation?.id === conversation.id ? "bg-ink-950 text-white" : "bg-white text-ink-600"}`}>
                  {conversationIcon(conversation)}
                  <span>{conversationLabel(conversation)}</span>
                </button>
              ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <form onSubmit={(event) => { event.preventDefault(); void createChannel(); }} className="flex gap-2">
                  <input value={channelName} onChange={(event) => setChannelName(event.target.value)} placeholder="nuevo-canal" className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-ink-950 outline-none focus:border-brand-500" />
                  <button className="grid h-9 w-9 place-items-center rounded-xl bg-ink-950 text-white" aria-label="Crear canal"><Plus className="h-4 w-4" /></button>
                </form>
                <form onSubmit={(event) => { event.preventDefault(); void openDirect(); }} className="flex gap-2">
                  <select value={directUserId} onChange={(event) => setDirectUserId(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-ink-950 outline-none focus:border-brand-500">
                    <option value="">Elegir persona</option>
                    {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                  <button className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white" aria-label="Abrir mensaje directo"><MessageCircle className="h-4 w-4" /></button>
                </form>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
              {messages.length ? messages.map((message) => {
                const mine = message.author.id === snapshot.currentUser.id;
                const pending = message.id.startsWith("pending-");
                const canModerate = activeConversation?.type !== "direct" && (activeConversation?.createdBy === snapshot.currentUser.id || isOrganizationAdmin);
                const canDelete = !pending && (mine || canModerate);
                const isEditing = editingMessageId === message.id;
                return (
                  <article key={message.id} className={`group relative max-w-[88%] rounded-2xl px-3 py-2.5 ${mine ? "ml-auto bg-brand-600 text-white" : "bg-white text-ink-900 shadow-sm"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[11px] font-black opacity-70">{message.author.name}</p>
                      {(mine || canDelete) && !isEditing && (
                        <div className={`flex items-center gap-0.5 transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${mine ? "text-white" : "text-ink-500"}`}>
                          {mine && !pending && <button type="button" onClick={() => { setEditingMessageId(message.id); setEditingMessageBody(message.body); }} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-black/10" aria-label="Editar mensaje" title="Editar mensaje"><Pencil className="h-3.5 w-3.5" /></button>}
                          {canDelete && <button type="button" onClick={() => void removeMessage(message.id)} disabled={busyAction} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-black/10 disabled:opacity-50" aria-label="Eliminar mensaje" title="Eliminar mensaje"><Trash2 className="h-3.5 w-3.5" /></button>}
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="mt-2">
                        <textarea value={editingMessageBody} onChange={(event) => setEditingMessageBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setEditingMessageId(undefined); if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void saveMessageEdit(); } }} autoFocus rows={3} className="w-full resize-none rounded-xl border border-white/30 bg-white px-3 py-2 text-sm text-ink-950 outline-none focus:ring-4 focus:ring-white/20" />
                        <div className="mt-2 flex justify-end gap-2">
                          <button type="button" onClick={() => setEditingMessageId(undefined)} className="rounded-lg px-2.5 py-1 text-xs font-black hover:bg-black/10">Cancelar</button>
                          <button type="button" onClick={() => void saveMessageEdit()} disabled={busyAction || !editingMessageBody.trim()} className={`rounded-lg px-2.5 py-1 text-xs font-black disabled:opacity-50 ${mine ? "bg-white text-brand-700" : "bg-brand-600 text-white"}`}>Guardar</button>
                        </div>
                      </div>
                    ) : <p className="mt-1 whitespace-pre-wrap text-sm leading-5">{message.body}</p>}
                    <time className="mt-1 block text-right text-[10px] opacity-60">{message.updatedAt ? "editado · " : ""}{new Date(message.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</time>
                  </article>
                );
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
  );
}
