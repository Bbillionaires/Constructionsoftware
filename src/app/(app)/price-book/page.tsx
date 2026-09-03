import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/money";
import { NewServiceDialog } from "./new-service-dialog";

export default async function PriceBookPage() {
  const session = await requireSession();

  const [categories, items] = await Promise.all([
    prisma.serviceCategory.findMany({ where: { companyId: session.companyId }, orderBy: { sortOrder: "asc" } }),
    prisma.priceBookItem.findMany({
      where: { companyId: session.companyId },
      orderBy: { name: "asc" },
    }),
  ]);

  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.categoryId ?? "uncategorized";
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Service Price Book</h1>
          <p className="text-sm text-muted-foreground">
            Reusable services with built-in labor, material, and margin targets.
          </p>
        </div>
        <NewServiceDialog categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
      </div>

      {categories.map((cat) => {
        const catItems = grouped.get(cat.id) ?? [];
        if (catItems.length === 0) return null;
        return <CategorySection key={cat.id} name={cat.name} items={catItems} />;
      })}
      {(grouped.get("uncategorized") ?? []).length > 0 && (
        <CategorySection name="Uncategorized" items={grouped.get("uncategorized")!} />
      )}
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No services yet. Add your first one to start building estimates faster.
        </p>
      )}
    </div>
  );
}

function CategorySection({
  name,
  items,
}: {
  name: string;
  items: { id: string; name: string; description: string | null; standardPrice: unknown; expectedLaborHours: unknown; targetMarginPercent: unknown; isActive: boolean }[];
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{name}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Link key={item.id} href={`/price-book/${item.id}`}>
            <Card className={`h-full hover:bg-muted/40 ${!item.isActive ? "opacity-50" : ""}`}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between">
                  <span className="font-medium">{item.name}</span>
                  {!item.isActive && <Badge variant="outline">Inactive</Badge>}
                </div>
                {item.description && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                )}
                <div className="flex items-center justify-between pt-1 text-sm">
                  <span className="font-semibold">{formatCurrency(item.standardPrice)}</span>
                  <span className="text-muted-foreground">{String(item.expectedLaborHours)}h</span>
                  <Badge variant="secondary">{formatPercent(item.targetMarginPercent, 0)} target</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
