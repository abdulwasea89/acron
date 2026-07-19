export default function LoadingPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="h-8 w-8 rounded-full border-[3px] border-[var(--border)] border-t-[var(--foreground)] animate-spin" />
    </div>
  );
}
