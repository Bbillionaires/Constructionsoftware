"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PriceBookItemForm, type PriceBookCategory } from "./price-book-item-form";
import { Plus } from "lucide-react";

export function NewServiceDialog({ categories }: { categories: PriceBookCategory[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-1 h-4 w-4" /> New service
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New service</DialogTitle>
        </DialogHeader>
        <PriceBookItemForm categories={categories} />
      </DialogContent>
    </Dialog>
  );
}
