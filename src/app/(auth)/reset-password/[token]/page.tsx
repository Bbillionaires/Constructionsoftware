import { prisma } from "@/lib/prisma";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
  const valid = !!resetToken && !resetToken.usedAt && resetToken.expiresAt > new Date();

  return <ResetPasswordForm token={token} valid={valid} />;
}
