"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, ListChecks, Camera, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/field/today", label: "Today", icon: CalendarCheck },
  { href: "/field/jobs", label: "Jobs", icon: ListChecks },
  { href: "/field/photos", label: "Photos", icon: Camera },
  { href: "/field/time", label: "Time", icon: Clock },
  { href: "/field/profile", label: "Profile", icon: User },
];

export function FieldNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-background">
      {ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="h-6 w-6" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
