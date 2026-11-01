"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center" role="alert">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-muted">An unexpected error occurred. You can try again.</p>
      <button type="button" onClick={reset} className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-background hover:bg-primary-hover">Try again</button>
    </main>
  );
}
