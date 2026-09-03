import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PartyPopper } from "lucide-react";

export default async function ThankYouPage() {
  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-green-600">
            <PartyPopper className="h-5 w-5" /> You&apos;re all set
          </div>
          <CardTitle>Thanks for choosing us!</CardTitle>
          <CardDescription>
            Your job has been scheduled. We&apos;ll reach out shortly to confirm the date and time.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
