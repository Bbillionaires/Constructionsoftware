import { Building2, ChevronDown, LogOut, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { switchCompanyAction, signOutAction } from "@/lib/actions/company";
import type { AppSession } from "@/lib/session";
import { SidebarNav } from "./sidebar-nav";
import Link from "next/link";

export function Topbar({ session }: { session: AppSession }) {
  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4">
      <Sheet>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 items-center border-b px-4 font-semibold">Contractor OS</div>
          <SidebarNav role={session.role} />
        </SheetContent>
      </Sheet>

      <Link href="/dashboard" className="hidden font-semibold md:block">
        Contractor OS
      </Link>

      <div className="flex-1" />

      {session.memberships.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
            <Building2 className="h-4 w-4" />
            {session.companyName}
            <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Switch company</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {session.memberships.map((m) => (
              <DropdownMenuItem
                key={m.companyId}
                onClick={() => switchCompanyAction(m.companyId)}
                disabled={m.companyId === session.companyId}
              >
                {m.company.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
          <Building2 className="h-4 w-4" />
          {session.companyName}
        </span>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="gap-2" />}>
          {session.userName || session.userEmail}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{session.userEmail}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<form action={signOutAction} className="w-full" />}>
            <button type="submit" className="flex w-full items-center gap-2">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
