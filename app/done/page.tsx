import { Suspense } from "react";
import { DoneScreen } from "@/components/form/DoneScreen";

export default function DonePage() {
  return (
    <Suspense fallback={null}>
      <DoneScreen />
    </Suspense>
  );
}
