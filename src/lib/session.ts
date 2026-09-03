import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export const ACTIVE_COMPANY_COOKIE = "active_company_id";

export type AppSession = {
  userId: string;
  userEmail: string;
  userName: string;
  companyId: string;
  companyName: string;
  role: Role;
  memberships: { companyId: string; role: Role; company: { id: string; name: string } }[];
};

/**
 * Every server component / server action that touches tenant data must call
 * this first. It resolves the signed-in user's active company and role, and
 * every downstream Prisma query must filter by the returned companyId — this
 * is the single tenant-isolation boundary for the whole app.
 */
export async function requireSession(): Promise<AppSession> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const memberships = await prisma.companyMember.findMany({
    where: { userId: session.user.id },
    include: { company: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const cookieStore = await cookies();
  const cookieCompanyId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;

  const active =
    memberships.find((m) => m.companyId === cookieCompanyId) ?? memberships[0];

  return {
    userId: session.user.id,
    userEmail: session.user.email ?? "",
    userName: session.user.name ?? "",
    companyId: active.companyId,
    companyName: active.company.name,
    role: active.role,
    memberships,
  };
}

export function assertRole(session: AppSession, allowed: Role[]) {
  if (!allowed.includes(session.role)) {
    throw new Error("You don't have permission to perform this action.");
  }
}

export const OFFICE_ROLES: Role[] = ["OWNER", "ADMIN", "OFFICE", "DISPATCHER", "BOOKKEEPER"];
export const ESTIMATOR_ROLES: Role[] = ["OWNER", "ADMIN", "OFFICE", "ESTIMATOR"];
export const MANAGER_ROLES: Role[] = ["OWNER", "ADMIN"];
