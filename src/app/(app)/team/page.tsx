import { prisma } from "@/lib/prisma";
import { requireSession, assertRole, MANAGER_ROLES } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { inviteTeamMemberAction, removeTeamMemberAction } from "@/lib/actions/team";
import { Plus, Trash2 } from "lucide-react";

const ROLES = ["OWNER", "ADMIN", "OFFICE", "ESTIMATOR", "DISPATCHER", "TECHNICIAN", "CREW_LEAD", "BOOKKEEPER"];

export default async function TeamPage() {
  const session = await requireSession();
  assertRole(session, MANAGER_ROLES);

  const members = await prisma.companyMember.findMany({
    where: { companyId: session.companyId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Team</h1>
          <p className="text-sm text-muted-foreground">Everyone with access to your company, and their role.</p>
        </div>
        <Dialog>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-1 h-4 w-4" /> Add team member
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add team member</DialogTitle>
            </DialogHeader>
            <form action={inviteTeamMemberAction} className="space-y-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input name="name" required />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input name="email" type="email" required />
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <select name="role" className="w-full rounded-md border px-3 py-2 text-sm" defaultValue="TECHNICIAN">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Temporary password</Label>
                <Input name="tempPassword" type="text" minLength={8} required />
                <p className="text-xs text-muted-foreground">Share this with them — they can sign in immediately.</p>
              </div>
              <Button type="submit" className="w-full">
                Add to team
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.user.name}</TableCell>
                  <TableCell>{m.user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{m.role.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell>
                    {m.userId !== session.userId && (
                      <form action={removeTeamMemberAction.bind(null, m.id)}>
                        <button type="submit" className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
