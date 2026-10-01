import { Suspense } from "react";
import { AssistantPage } from "@/components/assistant/AssistantPage";

export default function AssistantRoute() {
  // `useSearchParams` (the open thread's id lives in `?c=`) requires a Suspense
  // boundary. The page renders nothing until it resolves, so the fallback is
  // empty rather than a spinner that flashes.
  return (
    <Suspense fallback={null}>
      <AssistantPage />
    </Suspense>
  );
}
