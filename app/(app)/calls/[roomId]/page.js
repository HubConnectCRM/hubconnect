import { requireProfile } from "@/lib/auth";
import CallRoomView from "@/components/calls/CallRoomView";

export default async function CallRoomPage({ params }) {
  const { roomId } = await params;
  const { supabase, profile } = await requireProfile();
  const { data: room } = await supabase.from("call_rooms").select("id, kind").eq("id", roomId).single();

  return <CallRoomView profile={profile} roomId={roomId} kind={room?.kind || "video"} />;
}
