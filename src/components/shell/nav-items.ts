import type { Role } from "@prisma/client";
import {
  LayoutDashboard,
  Inbox,
  Users,
  FileText,
  TrendingUp,
  BookOpen,
  CalendarDays,
  Hammer,
  Receipt,
  BarChart3,
  Users2,
  Settings,
  CreditCard,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads / CRM", icon: Inbox },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/estimates", label: "Estimates", icon: FileText },
  { href: "/estimates/recovery", label: "Recovery Center", icon: TrendingUp },
  { href: "/price-book", label: "Price Book", icon: BookOpen },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/jobs", label: "Jobs", icon: Hammer },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/team", label: "Team", icon: Users2, roles: ["OWNER", "ADMIN"] },
  { href: "/billing", label: "Billing", icon: CreditCard, roles: ["OWNER", "ADMIN"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["OWNER", "ADMIN"] },
];
