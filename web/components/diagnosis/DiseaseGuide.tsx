import { DISEASES } from "@/lib/diseases";

export function DiseaseGuide() {
  return (
    <section className="mt-8" aria-labelledby="guide">
      <h2 id="guide" className="text-lg font-semibold">Guide to the 16 classes</h2>
      <p className="mt-1 text-sm text-muted">
        The model can only answer with one of these. It does not say &ldquo;not a tobacco leaf&rdquo;, so use a clear photo of a single tobacco leaf.
        All 16 are conditions seen on tobacco leaves. A few have another crop in their official name (for example tomato spotted wilt virus) only because it was first found there.
        This is general background, not treatment advice. For a real crop problem, ask a local agronomist.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(DISEASES).map(([key, d]) => (
          <li key={key} className="rounded-lg border border-border bg-surface p-4 text-sm">
            <p className="font-medium">{d.name}</p>
            <p className="text-xs text-muted">
              {d.cause}{d.agent ? ` · ${d.agent}` : ""} · model label: {key}
            </p>
            <p className="mt-2">{d.summary}</p>
            <p className="mt-1 text-muted">{d.signs}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
