import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import EventForm from "@/components/EventForm";

export default async function EditEventPage({ params }) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "event") redirect(`/events/${id}`);
  const { data } = await supabase.from("events").select("*").eq("id", id).single();
  if (!data) notFound();
  return <EventForm event={data} />;
}
