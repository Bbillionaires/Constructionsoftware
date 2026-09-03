"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertRole, MANAGER_ROLES } from "@/lib/session";
import type { Role } from "@prisma/client";

const FIELD_ROLES: Role[] = ["TECHNICIAN", "CREW_LEAD"];

export async function inviteTeamMemberAction(formData: FormData) {
  const session = await requireSession();
  assertRole(session, MANAGER_ROLES);

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "TECHNICIAN") as Role;
  const tempPassword = String(formData.get("tempPassword") ?? "").trim();

  if (!name || !email || tempPassword.length < 8) {
    throw new Error("Name, email, and an 8+ character temporary password are required.");
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { name, email, passwordHash: await bcrypt.hash(tempPassword, 10) },
    });
  }

  const existingMembership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: session.companyId, userId: user.id } },
  });
  if (existingMembership) throw new Error("That person is already on your team.");

  await prisma.companyMember.create({
    data: { companyId: session.companyId, userId: user.id, role },
  });

  if (FIELD_ROLES.includes(role)) {
    await prisma.technician.upsert({
      where: { userId: user.id },
      create: { companyId: session.companyId, userId: user.id },
      update: {},
    });
  }

  revalidatePath("/team");
}

export async function removeTeamMemberAction(memberId: string) {
  const session = await requireSession();
  assertRole(session, MANAGER_ROLES);

  await prisma.companyMember.delete({ where: { id: memberId, companyId: session.companyId } });
  revalidatePath("/team");
}
