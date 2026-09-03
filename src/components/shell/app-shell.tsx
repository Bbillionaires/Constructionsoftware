import type { AppSession } from "@/lib/session";
import { SidebarNav } from "./sidebar-nav";
import { Topbar } from "./topbar";

export function AppShell({ session, children }: { session: AppSession; children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col">
      <Topbar session={session} />
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-60 shrink-0 border-r bg-muted/20 md:flex md:flex-col">
          <SidebarNav role={session.role} />
        </aside>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
