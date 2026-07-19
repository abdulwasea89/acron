"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export default function NotFoundPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="text-center">
        <div className="mb-3">
          <div
            className="font-heading text-[100px] leading-none tracking-[-0.08em] text-[var(--foreground)] sm:text-[140px]"
            aria-hidden="true"
          >
            404
          </div>
        </div>
        <div className="mx-auto mb-8 h-px w-12 bg-gradient-to-r from-transparent via-[var(--foreground)] to-transparent opacity-15" />
        <h1 className="mb-2 text-base font-semibold text-[var(--foreground)] sm:text-lg">
          Page not found
        </h1>
        <p className="mx-auto mb-8 max-w-[260px] text-sm leading-relaxed text-[var(--foreground-muted)]">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Button size="md" onClick={() => router.push("/app")}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
