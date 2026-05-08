import Link from "next/link";
import { Suspense } from "react";
import { CircleCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SavedActions } from "./SavedActions";

export const metadata = { title: "Saved" };

export default function SavedPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <Card className="space-y-5 p-8 text-center sm:p-10">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-deep">
          <CircleCheck className="h-6 w-6" />
        </div>
        <h1 className="font-display text-3xl text-ink">Saved for later</h1>
        <p className="text-muted">
          Your progress is saved on this device. Come back through your invite
          link any time to pick up where you left off — your answers will be
          waiting.
        </p>
        <p className="text-xs text-muted">
          If a colleague needs to take it from here, they can use their own
          invitation link.
        </p>
        <div className="flex justify-center pt-2">
          <Suspense fallback={null}>
            <SavedActions />
          </Suspense>
        </div>
      </Card>

      <div className="mt-6 text-center">
        <Link
          href="/"
          className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          Back to the cover page
        </Link>
      </div>
    </div>
  );
}
