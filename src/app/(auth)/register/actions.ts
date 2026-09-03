"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { seedDemoDataForCompany } from "@/lib/seed-demo";

export type RegisterState = { error?: string };

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "company"
  );
}

export async function registerAction(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const companyName = String(formData.get("companyName") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const loadDemoData = formData.get("loadDemoData") === "on";

  if (!companyName || !name || !email || password.length < 8) {
    return { error: "Please fill in every field. Password must be at least 8 characters." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const baseSlug = slugify(companyName);
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.company.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++suffix}`;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const companyId = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: companyName, slug },
    });
    const user = await tx.user.create({
      data: { name, email, passwordHash },
    });
    await tx.companyMember.create({
      data: { companyId: company.id, userId: user.id, role: "OWNER" },
    });
    return company.id;
  });

  if (loadDemoData) {
    await seedDemoDataForCompany(companyId);
  }

  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  return {};
}
