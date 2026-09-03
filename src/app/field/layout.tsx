import { requireSession } from "@/lib/session";
import { FieldNav } from "@/components/shell/field-nav";

export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background pb-16">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <span className="font-semibold">{session.companyName}</span>
        <span className="text-sm text-muted-foreground">{session.userName}</span>
      </header>
      <main className="flex-1 p-4">{children}</main>
      <FieldNav />
    </div>
  );
}
