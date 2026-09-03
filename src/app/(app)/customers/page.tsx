import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createCustomerAction } from "@/lib/actions/customers";
import { Plus } from "lucide-react";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  const { q } = await searchParams;

  const customers = await prisma.customer.findMany({
    where: {
      companyId: session.companyId,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { properties: true, _count: { select: { jobs: true, estimates: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-sm text-muted-foreground">Every customer, property, and job history in one place.</p>
        </div>
        <Dialog>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-1 h-4 w-4" /> New customer
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New customer</DialogTitle>
            </DialogHeader>
            <form action={createCustomerAction} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>First name</Label>
                  <Input name="firstName" required />
                </div>
                <div className="space-y-1">
                  <Label>Last name</Label>
                  <Input name="lastName" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input name="phone" />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input name="email" type="email" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Company (optional)</Label>
                <Input name="companyName" />
              </div>
              <p className="pt-2 text-xs font-medium text-muted-foreground">Service address (optional)</p>
              <div className="space-y-1">
                <Label>Address</Label>
                <Input name="addressLine1" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input name="city" placeholder="City" />
                <Input name="state" placeholder="State" />
                <Input name="postalCode" placeholder="ZIP" />
              </div>
              <Button type="submit" className="w-full">
                Create customer
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <form className="max-w-sm">
        <Input name="q" placeholder="Search customers…" defaultValue={q} />
      </form>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Properties</TableHead>
                <TableHead>Jobs</TableHead>
                <TableHead>Estimates</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/customers/${c.id}`} className="font-medium hover:underline">
                      {c.firstName} {c.lastName}
                    </Link>
                    {c.companyName && <div className="text-xs text-muted-foreground">{c.companyName}</div>}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{c.phone}</div>
                    <div className="text-muted-foreground">{c.email}</div>
                  </TableCell>
                  <TableCell>{c.properties.length}</TableCell>
                  <TableCell>{c._count.jobs}</TableCell>
                  <TableCell>{c._count.estimates}</TableCell>
                </TableRow>
              ))}
              {customers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No customers yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
