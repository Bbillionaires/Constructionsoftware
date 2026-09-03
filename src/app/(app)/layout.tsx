import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  // Technicians and crew leads get the simplified mobile field experience —
  // they should never see office/back-office screens.
  if (session.role === "TECHNICIAN" || session.role === "CREW_LEAD") {
    redirect("/field/today");
  }

  return <AppShell session={session}>{children}</AppShell>;
}
