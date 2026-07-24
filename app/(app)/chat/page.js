import { requireProfile } from "@/lib/auth";
import ChatView from "@/components/ChatView";

export default async function ChatPage({ searchParams }) {
  const params = await searchParams;
  const { supabase, user, profile } = await requireProfile();
  await supabase.rpc("join_default_chat_groups");

  const { data: visibleGroups } = await supabase.from("chat_groups").select("id,kind,position");
  async function createStandingGroup(name, kind, position = null) {
    const id = crypto.randomUUID();
    const { error } = await supabase.from("chat_groups").insert({ id, name, kind, position, created_by: user.id });
    if (!error) await supabase.from("chat_group_members").insert({ group_id: id, user_id: user.id, is_admin: false });
  }
  if (!(visibleGroups || []).some((group) => group.kind === "company")) await createStandingGroup("Tüm Şirket", "company");
  if (profile.role !== "viewer" && !(visibleGroups || []).some((group) => group.kind === "position" && group.position === profile.role)) {
    const roleName = profile.role === "sales" ? "Sales" : profile.role === "events" ? "Events" : profile.role === "admin" ? "Admin" : profile.role;
    await createStandingGroup(`${roleName} Ekibi`, "position", profile.role);
  }
  await supabase.rpc("join_default_chat_groups");

  const [groupsResult, messagesResult, membersResult, readsResult, profilesResult] = await Promise.all([
    supabase.from("chat_groups").select("id,name,kind,event_id,position,created_by,created_at,avatar_url").order("created_at"),
    supabase.from("chat_messages").select("id,group_id,sender_id,body,image_url,created_at,edited_at,delivered_at").order("created_at", { ascending: false }).limit(1500),
    supabase.from("chat_group_members").select("group_id,user_id,is_admin,joined_at"),
    supabase.from("chat_read_state").select("group_id,user_id,last_read_at"),
    supabase.from("profiles").select("id,full_name,email,role,is_active").eq("is_active", true).order("full_name"),
  ]);

  const error = groupsResult.error || messagesResult.error || membersResult.error || readsResult.error;
  return <ChatView
    currentUser={{ id: user.id, name: profile.full_name || profile.email, role: profile.role }}
    groups={groupsResult.data || []}
    messages={(messagesResult.data || []).reverse()}
    members={membersResult.data || []}
    readStates={readsResult.data || []}
    profiles={profilesResult.data || []}
    loadError={error?.message || null}
    initialGroupId={params?.group || null}
  />;
}
