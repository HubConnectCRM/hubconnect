import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import EventForm from "@/components/EventForm";

export default async function EditEventPage({ params }) {
  const { id } = await params;
  const { supabase } = await requireProfile();
  const { data } = await supabase.from("events").select("*").eq("id", id).single();
  if (!data) notFound();
  return <EventForm event={data} />;
}
