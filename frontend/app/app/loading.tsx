export default function AppLoadingPage() {
  return (
    <div className="container-app">
      <div className="page-content">
        <div className="flex h-dvh items-start justify-center pt-24">
          <div className="h-8 w-8 rounded-full border-[3px] border-[var(--border)] border-t-[var(--foreground)] animate-spin" />
        </div>
      </div>
    </div>
  );
}
