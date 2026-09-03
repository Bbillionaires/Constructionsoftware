"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth, signOut } from "@/lib/auth";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/session";

export async function switchCompanyAction(companyId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId, userId: session.user.id } },
  });
  if (!membership) throw new Error("You are not a member of that company.");

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/dashboard");
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
