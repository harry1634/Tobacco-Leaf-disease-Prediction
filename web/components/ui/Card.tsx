export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-border bg-surface p-5 ${className}`}>
      {title && <h2 className="mb-3 text-sm font-medium text-muted">{title}</h2>}
      {children}
    </section>
  );
}
