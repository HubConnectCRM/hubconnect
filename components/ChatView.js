"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader } from "@/components/ui";
import { changeChatMember, createChat, deleteChatMessage, editChatMessage, leaveChat, markChatRead, sendChatMessage, updateChatGroup } from "@/app/(app)/chat/actions";
import { createClient } from "@/lib/supabase/client";
import { calendarColor } from "@/lib/calendarPalette";

function initials(name) {
  return String(name || "?").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

async function compressChatImage(file) {
  if (!file?.type?.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.6));
  } catch { return file; }
}

export default function ChatView({ currentUser, groups, messages, members, readStates, profiles, loadError, initialGroupId = null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(initialGroupId || groups[0]?.id || null);
  const [showNew, setShowNew] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [hiddenGroups, setHiddenGroups] = useState(() => new Set());
  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const selected = groups.find((group) => group.id === selectedId && !hiddenGroups.has(group.id)) || groups.find((group) => !hiddenGroups.has(group.id)) || null;

  useEffect(() => {
    if (!groups.some((group) => group.id === selectedId && !hiddenGroups.has(group.id))) setSelectedId(groups.find((group) => !hiddenGroups.has(group.id))?.id || null);
  }, [groups, selectedId, hiddenGroups]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("hubconnect-web-chat")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_read_state" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_group_members" }, () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [router]);

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [router]);

  useEffect(() => {
    if (selected?.id) markChatRead(selected.id);
  }, [selected?.id, messages.length]);

  const orderedGroups = useMemo(() => groups.filter((group) => !hiddenGroups.has(group.id)).sort((a, b) => {
    const aLast = messages.filter((message) => message.group_id === a.id).at(-1)?.created_at || a.created_at;
    const bLast = messages.filter((message) => message.group_id === b.id).at(-1)?.created_at || b.created_at;
    return new Date(bLast) - new Date(aLast);
  }), [groups, messages, hiddenGroups]);

  if (loadError) return <div className="mx-auto max-w-5xl"><PageHeader title={t("chat.title")} subtitle={t("chat.subtitle")} /><Card className="border-red-400/30 p-6 text-red-300">Chat verisi yüklenemedi: {loadError}</Card></div>;

  return <div className="mx-auto max-w-[1500px]">
    <PageHeader title={t("chat.title")} subtitle={t("chat.subtitle")}><Button type="button" onClick={() => setShowNew(true)}>＋ {t("chat.newChat")}</Button></PageHeader>
    <Card className="grid min-h-[72vh] overflow-hidden lg:grid-cols-[350px_minmax(0,1fr)]">
      <aside className="border-b border-[var(--border)] lg:border-b-0 lg:border-r">
        <div className="border-b border-[var(--border)] p-3"><Input placeholder={t("common.search")} onChange={(event) => { const value = event.target.value.toLowerCase(); document.querySelectorAll("[data-chat-name]").forEach((node) => { node.hidden = !node.dataset.chatName.includes(value); }); }} /></div>
        <div className="max-h-[68vh] overflow-auto p-2">{orderedGroups.length === 0 ? <EmptyState>{t("chat.empty")}</EmptyState> : orderedGroups.map((group) => <ChatListItem key={group.id} group={group} selected={group.id === selected?.id} messages={messages.filter((message) => message.group_id === group.id)} members={members.filter((member) => member.group_id === group.id)} readStates={readStates} currentUser={currentUser} profileMap={profileMap} onClick={() => setSelectedId(group.id)} onLeft={(id) => { setHiddenGroups((current) => new Set(current).add(id)); if (selectedId === id) setSelectedId(null); }} />)}</div>
      </aside>
      {selected ? <Thread group={selected} currentUser={currentUser} messages={messages.filter((message) => message.group_id === selected.id)} members={members.filter((member) => member.group_id === selected.id)} readStates={readStates.filter((read) => read.group_id === selected.id)} profileMap={profileMap} onInfo={() => setShowInfo(true)} /> : <div className="flex items-center justify-center p-10"><EmptyState>{t("chat.empty")}</EmptyState></div>}
    </Card>
    {showNew && <NewChatModal profiles={profiles.filter((profile) => profile.id !== currentUser.id)} onClose={() => setShowNew(false)} onCreated={(id) => { setSelectedId(id); setShowNew(false); router.refresh(); }} />}
    {showInfo && selected && <GroupInfoModal group={selected} currentUser={currentUser} profiles={profiles} members={members.filter((member) => member.group_id === selected.id)} onClose={() => setShowInfo(false)} onLeft={() => { setShowInfo(false); setSelectedId(null); router.refresh(); }} />}
  </div>;
}

function ChatListItem({ group, selected, messages, members, readStates, currentUser, profileMap, onClick, onLeft }) {
  const last = messages.at(-1);
  const myRead = readStates.find((read) => read.group_id === group.id && read.user_id === currentUser.id)?.last_read_at;
  const unread = messages.filter((message) => message.sender_id !== currentUser.id && (!myRead || new Date(message.created_at) > new Date(myRead))).length;
  const directOther = members.length === 2 ? profileMap.get(members.find((member) => member.user_id !== currentUser.id)?.user_id) : null;
  const name = directOther && group.kind === "custom" ? directOther.full_name || directOther.email : group.name;
  const sender = last ? profileMap.get(last.sender_id) : null;
  const preview = last ? `${last.sender_id === currentUser.id ? "Sen" : sender?.full_name || sender?.email || "—"}: ${last.image_url ? "📷 Fotoğraf" : last.body || ""}` : group.kind;
  return <div data-chat-name={String(name || "").toLowerCase()} className={`group/list mb-1 flex items-center rounded-2xl transition ${selected ? "bg-[var(--brand)]/15 ring-1 ring-[var(--brand)]/35" : "hover:bg-white/5"}`}><button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left">
    <ChatAvatar group={group} name={name} directOther={directOther} />
    <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{name}</strong>{last && <small className="text-[10px] text-[var(--muted)]">{new Date(last.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>}</span><span className="mt-1 flex items-center justify-between gap-2"><span className="truncate text-xs text-[var(--muted)]">{preview}</span>{unread > 0 && <Badge color="brand">{unread}</Badge>}</span></span>
  </button><button type="button" title="Sil" className="mr-2 hidden rounded-lg px-2 py-1 text-xs text-red-300 group-hover/list:block" onClick={() => { const warning = group.kind === "custom" ? "Bu sohbetten kalıcı olarak ayrılmak istiyor musun?" : "Bu hazır sohbet listeden kaldırılacak; Chat'i bir sonraki açışında otomatik geri eklenecek."; if (confirm(warning)) leaveChat(group.id).then(() => onLeft(group.id)); }}>×</button></div>;
}

function ChatAvatar({ group, name, directOther }) {
  if (group.avatar_url) return <img src={group.avatar_url} alt="" className="h-11 w-11 rounded-2xl object-cover" />;
  if (directOther) return <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-semibold text-black" style={{ background: calendarColor(directOther.id) }}>{initials(name)}</span>;
  const icon = group.kind === "company" ? "▦" : group.kind === "position" ? "♟" : group.kind === "event" ? "▣" : "◌";
  return <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand)] text-lg font-semibold text-[var(--brand-ink)]">{icon}</span>;
}

function Thread({ group, currentUser, messages, members, readStates, profileMap, onInfo }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [pendingMessages, setPendingMessages] = useState([]);
  const [sendError, setSendError] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [draft, setDraft] = useState("");
  const [pending, startSending] = useTransition();
  const formRef = useRef(null);
  const bottomRef = useRef(null);
  const shownMessages = [...messages, ...pendingMessages];
  const memberNames = members.map((member) => member.user_id === currentUser.id ? t("chat.you") : profileMap.get(member.user_id)?.full_name || profileMap.get(member.user_id)?.email).filter(Boolean).join(", ");
  useEffect(() => { setPendingMessages([]); setEditingMessage(null); setDraft(""); }, [group.id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [shownMessages.length, group.id]);
  function submitMessage(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = String(formData.get("body") || "").trim();
    const file = formData.get("image");
    if (editingMessage) {
      if (!body) return;
      startSending(async () => {
        const result = await editChatMessage(editingMessage.id, body);
        if (result?.ok) { setEditingMessage(null); setDraft(""); router.refresh(); }
        else setSendError(result?.error || "edit_failed");
      });
      return;
    }
    if (!body && (!file || !file.size)) return;
    const optimisticId = crypto.randomUUID();
    const previewUrl = file?.size ? URL.createObjectURL(file) : null;
    setPendingMessages((current) => [...current, { id: optimisticId, group_id: group.id, sender_id: currentUser.id, body, image_url: previewUrl, created_at: new Date().toISOString(), pending: true }]);
    form.reset(); setDraft("");
    setSendError(null);
    startSending(async () => {
      if (file?.size) {
        const compressed = await compressChatImage(file);
        formData.set("image", compressed, `${String(file.name || "photo").replace(/\.[^.]+$/, "")}.jpg`);
      }
      const result = await sendChatMessage({}, formData);
      if (result?.ok) {
        setPendingMessages((current) => current.filter((message) => message.id !== optimisticId));
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        router.refresh();
      } else setSendError(result?.error || "message_failed");
    });
  }
  return <section className="flex min-h-[72vh] min-w-0 flex-col">
    <button type="button" onClick={onInfo} className="flex items-center justify-between border-b border-[var(--border)] p-4 text-left hover:bg-white/[.03]"><div className="min-w-0"><h2 className="font-semibold">{group.name}</h2><p className="mt-0.5 truncate text-xs text-[var(--muted)]">{memberNames || `${members.length} ${t("chat.members").toLowerCase()}`}</p></div><span className="ml-3 text-[var(--brand)]">•••</span></button>
    <div className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top,#1c2115_0,transparent_38%)] p-4 sm:p-6">{shownMessages.length === 0 ? <EmptyState>{t("chat.noMessages")}</EmptyState> : <div className="space-y-2">{shownMessages.map((message) => <MessageBubble key={message.id} message={message} mine={message.sender_id === currentUser.id} sender={profileMap.get(message.sender_id)} members={members} readStates={readStates} profileMap={profileMap} onEdit={() => { setEditingMessage(message); setDraft(message.body || ""); }} />)}<div ref={bottomRef} /></div>}</div>
    <form ref={formRef} onSubmit={submitMessage} className="border-t border-[var(--border)] p-3">{editingMessage && <div className="mb-2 flex items-center justify-between rounded-xl bg-[var(--brand)]/10 px-3 py-2 text-xs text-[var(--brand)]"><span>Mesajı düzenliyorsun</span><button type="button" onClick={() => { setEditingMessage(null); setDraft(""); }}>×</button></div>}<input type="hidden" name="group_id" value={group.id} /><div className="flex items-end gap-2">{!editingMessage && <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[var(--border)] text-[var(--brand)] hover:bg-white/5">＋<input className="hidden" type="file" name="image" accept="image/*" /></label>}<Input name="body" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t("chat.messagePlaceholder")} autoComplete="off" /><Button type="submit" disabled={pending}>{pending ? "◷" : editingMessage ? "✓" : t("chat.send")}</Button></div>{sendError && <p className="mt-2 text-xs text-red-300">{sendError}{!editingMessage ? " · mesaj pending olarak kaldı" : ""}</p>}</form>
  </section>;
}

function MessageBubble({ message, mine, sender, members, readStates, profileMap, onEdit }) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const seen = readStates
    .filter((read) => read.user_id !== message.sender_id && new Date(read.last_read_at) >= new Date(message.created_at))
    .map((read) => ({ profile: profileMap.get(read.user_id), lastReadAt: read.last_read_at }))
    .filter((item) => item.profile)
    .sort((a, b) => new Date(b.lastReadAt) - new Date(a.lastReadAt));
  const delivered = !!message.delivered_at;
  const status = message.pending ? <span className="text-zinc-500">◷</span> : seen.length ? <span className="text-sky-400">✓✓</span> : delivered ? <span className="text-zinc-400">✓✓</span> : <span className="text-zinc-500">✓</span>;
  return <div className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
    {!mine && <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-black" style={{ background: calendarColor(sender?.id) }}>{initials(sender?.full_name || sender?.email)}</span>}
    <div className={`group max-w-[82%] rounded-2xl px-3 py-2 shadow ${mine ? "rounded-br-md bg-[var(--brand)] text-[var(--brand-ink)]" : "rounded-bl-md border border-white/10 bg-[#20211e]"}`}>
    {!mine && <p className="mb-1 text-[10px] font-semibold" style={{ color: calendarColor(sender?.id) }}>{sender?.full_name || sender?.email || "—"}</p>}
    {message.image_url && <a href={message.image_url} target="_blank"><img src={message.image_url} alt="" className="mb-2 max-h-80 rounded-xl object-cover" /></a>}
    {message.body && <p className="whitespace-pre-wrap text-sm leading-5">{message.body}</p>}
    <div className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${mine ? "text-black/60" : "text-[var(--muted)]"}`}><span>{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>{message.edited_at && <span>· ({t("chat.edited")})</span>}{mine && <details className="relative"><summary className="cursor-pointer list-none" title={t("chat.seenBy")}>{status}</summary><div className="absolute bottom-5 right-0 z-20 w-56 rounded-xl border border-white/10 bg-[#171815] p-3 text-left text-xs text-white shadow-xl"><strong>{t("chat.seenBy")}</strong>{seen.length ? seen.map(({ profile, lastReadAt }) => <p key={profile.id} className="mt-2"><span className="block truncate">{profile.full_name || profile.email}</span><small className="text-[var(--muted)]">{new Date(lastReadAt).toLocaleString()}</small></p>) : <p className="mt-1 text-[var(--muted)]">{message.pending ? "Pending" : delivered ? t("chat.delivered") : t("chat.sent")}</p>}</div></details>}</div>
    {mine && !message.pending && <div className="mt-1 hidden justify-end gap-2 text-[10px] group-hover:flex">{!message.image_url && <button type="button" onClick={onEdit}>✎</button>}<button type="button" disabled={pending} onClick={() => { if (confirm("Mesaj silinsin mi?")) startTransition(() => deleteChatMessage(message.id)); }}>⌫</button></div>}
  </div></div>;
}

function NewChatModal({ profiles, onClose, onCreated }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState("direct");
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState(null);
  const [pending, startCreating] = useTransition();
  const filteredProfiles = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return profiles;
    return profiles.filter((profile) => `${profile.full_name || ""} ${profile.email || ""} ${profile.role || ""}`.toLocaleLowerCase().includes(needle));
  }, [profiles, query]);
  function toggle(id) {
    setError(null);
    setSelected((current) => mode === "direct"
      ? (current.includes(id) ? [] : [id])
      : (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }
  const direct = profiles.find((profile) => profile.id === selected[0]);
  const canSubmit = mode === "direct" ? selected.length === 1 : groupName.trim().length > 0 && selected.length > 0;
  function submit(event) {
    event.preventDefault();
    if (!canSubmit || pending) return;
    const formData = new FormData();
    formData.set("mode", mode);
    formData.set("name", groupName);
    formData.set("direct_name", direct?.full_name || direct?.email || "");
    selected.forEach((id) => formData.append("member_id", id));
    setError(null);
    startCreating(async () => {
      const result = await createChat({}, formData);
      if (result?.ok && result.groupId) onCreated(result.groupId);
      else setError(result?.error || t("chat.createFailed"));
    });
  }
  return <Modal onClose={pending ? undefined : onClose}>
    <div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-semibold">{t("chat.newChat")}</h2><p className="mt-1 text-xs text-[var(--muted)]">{mode === "direct" ? t("chat.directHint") : t("chat.groupHint")}</p></div><Button type="button" variant="secondary" onClick={onClose} disabled={pending}>×</Button></div>
    <div className="mb-4 grid grid-cols-2 gap-2">{[["direct", t("chat.directMessage")], ["group", t("chat.newGroup")]].map(([value, label]) => <button key={value} type="button" onClick={() => { setMode(value); setSelected([]); setQuery(""); setError(null); }} className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${mode === value ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-white/5 hover:bg-white/10"}`}>{label}</button>)}</div>
    <form onSubmit={submit}>
      {mode === "group" && <Field label={t("chat.groupName")}><Input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder={t("chat.groupNamePlaceholder")} autoFocus /></Field>}
      <div className={mode === "group" ? "mt-4" : ""}><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("chat.searchPeople")} autoFocus={mode === "direct"} /></div>
      <div className="mt-3 flex items-center justify-between text-xs"><span className="text-[var(--muted)]">{mode === "direct" ? t("chat.selectPerson") : t("chat.selectPeople")}</span><span className={selected.length ? "font-semibold text-[var(--brand)]" : "text-[var(--muted)]"}>{t("chat.selectedCount", { count: selected.length })}</span></div>
      <div className="mt-2 max-h-72 space-y-1 overflow-auto pr-1">{filteredProfiles.length === 0 ? <EmptyState>{t("chat.noPeople")}</EmptyState> : filteredProfiles.map((profile) => {
        const active = selected.includes(profile.id);
        return <button key={profile.id} type="button" onClick={() => toggle(profile.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${active ? "border-[var(--brand)]/60 bg-[var(--brand)]/15" : "border-transparent hover:bg-white/5"}`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold text-black" style={{ background: calendarColor(profile.id) }}>{initials(profile.full_name || profile.email)}</span>
          <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{profile.full_name || profile.email}</strong><small className="text-[var(--muted)]">{profile.role}</small></span>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${active ? "border-[var(--brand)] bg-[var(--brand)] text-black" : "border-white/20 text-transparent"}`}>✓</span>
        </button>;
      })}</div>
      {error && <div className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">{error}</div>}
      <Button type="submit" className="mt-5 w-full" disabled={pending || !canSubmit}>{pending ? t("chat.creating") : mode === "direct" ? t("chat.startChat") : t("chat.createGroup")}</Button>
    </form>
  </Modal>;
}

function GroupInfoModal({ group, currentUser, profiles, members, onClose, onLeft }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [state, action, pending] = useActionState(updateChatGroup, {});
  const [busy, startTransition] = useTransition();
  const groupAdmin = !!members.find((member) => member.user_id === currentUser.id)?.is_admin;
  const canEditInfo = group.kind === "custom" ? groupAdmin : currentUser.role === "admin";
  const memberProfiles = members.map((member) => ({ ...profiles.find((profile) => profile.id === member.user_id), membership: member })).filter((profile) => profile.id);
  const availableProfiles = profiles.filter((profile) => !members.some((member) => member.user_id === profile.id));
  function change(userId, operation) {
    startTransition(async () => {
      const result = await changeChatMember(group.id, userId, operation);
      if (result?.error) alert(result.error);
      router.refresh();
    });
  }
  return <Modal onClose={onClose}>
    <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">{t("chat.editGroup")}</h2><Button type="button" variant="secondary" onClick={onClose}>×</Button></div>
    <div className="mb-5 text-center">{group.avatar_url ? <img src={group.avatar_url} alt="" className="mx-auto h-24 w-24 rounded-3xl object-cover" /> : <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-[var(--brand)] text-3xl font-semibold text-black">{initials(group.name)}</span>}<h3 className="mt-3 text-xl font-semibold">{group.name}</h3><p className="text-xs text-[var(--muted)]">{members.length} {t("chat.members").toLowerCase()}</p></div>
    {canEditInfo && <form action={action} className="grid gap-3 rounded-2xl border border-[var(--border)] p-4"><input type="hidden" name="group_id" value={group.id} /><Field label={t("chat.groupName")}><Input name="name" defaultValue={group.name} required /></Field><Field label="Logo"><Input name="avatar" type="file" accept="image/*" /></Field><Button type="submit" disabled={pending}>{t("common.save")}</Button>{state?.error && <p className="text-xs text-red-300">{state.error}</p>}</form>}
    <h3 className="mb-2 mt-6 text-sm font-semibold">{t("chat.members")}</h3>
    <div className="space-y-1">{memberProfiles.map((profile) => <div key={profile.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/[.04] p-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-black" style={{ background: calendarColor(profile.id, profile.id === currentUser.id) }}>{initials(profile.full_name || profile.email)}</span><div className="min-w-0"><strong className="block truncate text-sm">{profile.id === currentUser.id ? `${profile.full_name || profile.email} · ${t("chat.you")}` : profile.full_name || profile.email}</strong>{group.kind === "custom" && profile.membership.is_admin && <small className="text-[var(--brand)]">Yönetici</small>}</div></div>{profile.id !== currentUser.id && <div className="flex gap-1">{group.kind === "custom" && groupAdmin && !profile.membership.is_admin && <button type="button" disabled={busy} onClick={() => change(profile.id, "admin")} className="rounded-lg border border-[var(--brand)]/40 px-2 py-1 text-[10px] text-[var(--brand)]">{t("chat.makeAdmin")}</button>}<button type="button" disabled={busy} onClick={() => change(profile.id, "remove")} className="rounded-lg border border-red-400/30 px-2 py-1 text-[10px] text-red-300">{t("chat.remove")}</button></div>}</div>)}</div>
    <h3 className="mb-2 mt-6 text-sm font-semibold">{t("chat.addMembers")}</h3>
    {availableProfiles.length === 0 ? <p className="text-xs text-[var(--muted)]">Tüm çalışanlar bu grupta.</p> : <div className="max-h-48 space-y-1 overflow-auto">{availableProfiles.map((profile) => <div key={profile.id} className="flex items-center justify-between rounded-xl bg-white/[.03] p-3"><span className="text-sm">{profile.full_name || profile.email}</span><button type="button" disabled={busy} onClick={() => change(profile.id, "add")} className="rounded-lg border border-[var(--brand)]/40 px-2 py-1 text-[10px] text-[var(--brand)]">＋ {t("common.add")}</button></div>)}</div>}
    {group.kind === "custom" && <Button type="button" variant="danger" className="mt-5" disabled={busy} onClick={() => { if (confirm("Gruptan ayrılmak istiyor musun?")) startTransition(async () => { await leaveChat(group.id); onLeft(); }); }}>{t("chat.leave")}</Button>}
  </Modal>;
}

function Modal({ children, onClose }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onMouseDown={() => onClose?.()}><Card className="max-h-[92vh] w-full max-w-xl overflow-auto p-5" onMouseDown={(event) => event.stopPropagation()}>{children}</Card></div>;
}
