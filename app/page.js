import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import SetupScreen from "@/components/SetupScreen";

export default function Home() {
  if (!isSupabaseConfigured) {
    return <SetupScreen />;
  }
  redirect("/dashboard");
}
