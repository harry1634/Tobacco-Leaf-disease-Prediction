// A short, collapsible "what is this page for?" explanation shown under a page title.
export function PurposeNote({ children }: { children: React.ReactNode }) {
  return (
    <details className="mb-6 -mt-3 max-w-3xl rounded-lg border border-border bg-surface p-4 text-sm" open>
      <summary className="cursor-pointer font-medium">What is this page for?</summary>
      <div className="mt-2 space-y-2 leading-6 text-muted">{children}</div>
    </details>
  );
}
