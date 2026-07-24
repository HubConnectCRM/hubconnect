import EventForm from "@/components/EventForm";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

export default async function NewEventPage() {
  const { profile } = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "events") redirect("/events");
  return <EventForm />;
}
