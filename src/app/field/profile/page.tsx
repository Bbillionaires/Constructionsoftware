import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions/company";

export default async function FieldProfilePage() {
  const session = await requireSession();

  const technician = await prisma.technician.findUnique({
    where: { userId: session.userId },
    include: { skills: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{session.userName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>{session.userEmail}</div>
          <div>{session.companyName}</div>
          <Badge variant="outline">{session.role.replace(/_/g, " ")}</Badge>
        </CardContent>
      </Card>

      {technician && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Skills</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {technician.skills.map((s) => (
              <Badge key={s.id} variant="secondary">
                {s.skillName} · {"★".repeat(s.rating)}
              </Badge>
            ))}
            {technician.skills.length === 0 && (
              <p className="text-sm text-muted-foreground">No skills on file yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      <form action={signOutAction}>
        <Button type="submit" variant="outline" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
