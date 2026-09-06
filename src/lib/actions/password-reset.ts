"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEmailProvider } from "@/lib/adapters/email";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export type ForgotPasswordState = { submitted?: boolean };

export async function requestPasswordResetAction(
  _prev: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  // Always report success regardless of whether the account exists, so this
  // form can't be used to enumerate registered emails.
  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      await prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const resetUrl = `${appUrl}/reset-password/${token}`;
      await getEmailProvider().send(
        email,
        "Reset your Contractor OS password",
        `<p>Someone requested a password reset for this account.</p>
         <p><a href="${resetUrl}">Click here to set a new password</a>. This link expires in 1 hour.</p>
         <p>If you didn't request this, you can ignore this email.</p>`
      );
    }
  }

  return { submitted: true };
}

export type ResetPasswordState = { error?: string };

export async function resetPasswordAction(
  token: string,
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  ]);

  redirect("/login?reset=success");
}
