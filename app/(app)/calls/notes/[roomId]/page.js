import { requireProfile } from "@/lib/auth";
import CallConversationView from "@/components/calls/CallConversationView";

export default async function CallConversationPage({ params }) {
  const { roomId } = await params;
  const { supabase } = await requireProfile();

  const [{ data: segments }, { data: insights }, { data: notes }] = await Promise.all([
    supabase
      .from("call_transcript_segments")
      .select("id, speaker_id, text, spoken_at, speaker:profiles(full_name, email)")
      .eq("room_id", roomId)
      .order("spoken_at", { ascending: true }),
    supabase
      .from("call_conversation_insights")
      .select("summary, key_points, action_items, generated_platform")
      .eq("room_id", roomId)
      .maybeSingle(),
    supabase.from("call_notes").select("with_names").eq("room_id", roomId).limit(1),
  ]);

  return (
    <CallConversationView
      roomId={roomId}
      segments={segments || []}
      insights={insights || null}
      withNames={notes?.[0]?.with_names || ""}
    />
  );
}
