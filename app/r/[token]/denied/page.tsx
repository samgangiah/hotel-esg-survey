import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export const metadata = { title: "Link rejected" };

export default function DeniedPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <Card className="space-y-3 p-8 text-center sm:p-10">
        <h1 className="font-display text-2xl text-ink">Thanks for letting us know</h1>
        <p className="text-muted">
          We've invalidated the link. The Site Admin who sent it will be notified
          and can re-send to the right person.
        </p>
        <div className="pt-2">
          <Link href="/">
            <Button variant="secondary">Close</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
