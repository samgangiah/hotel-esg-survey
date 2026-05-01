"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formSpec } from "@/lib/form-data";
import { useFormStore } from "@/lib/store";

export function DoneScreen() {
  const router = useRouter();
  const reset = useFormStore((s) => s.reset);

  const startAgain = () => {
    reset();
    router.push("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <Card className="max-w-xl space-y-5 p-8 text-center sm:p-10">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-deep">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="font-display text-3xl text-ink">Thank you</h1>
        <p className="text-muted">{formSpec.meta.completionMessage}</p>
        <div className="pt-2">
          <Button variant="secondary" onClick={startAgain}>
            Start a new survey
          </Button>
        </div>
      </Card>
    </div>
  );
}
