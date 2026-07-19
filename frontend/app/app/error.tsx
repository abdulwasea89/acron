"use client";

import { useEffect } from "react";
import { Button, Card } from "@/components/ui";

export default function AppErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-dvh items-center justify-center p-6">
      <Card className="w-full max-w-sm p-8 text-center">
        <div className="mb-4 text-5xl">⚠</div>
        <h1 className="mb-2 text-lg font-semibold text-[var(--foreground)]">Something went wrong</h1>
        <p className="mb-6 text-sm text-[var(--foreground-muted)]">
          An unexpected error occurred in this page.
        </p>
        {error.digest && (
          <p className="mb-4 text-[11px] break-all text-[var(--muted)]">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={reset}>Try again</Button>
          <Button variant="secondary" onClick={() => (window.location.href = "/app")}>
            Back to dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}
