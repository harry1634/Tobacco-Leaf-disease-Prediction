import { Card } from "./Card";

// `value` is null when no real data has been imported yet. We show "No data",
// never 0, so a missing value cannot be mistaken for a real zero.
export function StatCard({ label, value }: { label: string; value: string | null }) {
  return (
    <Card title={label}>
      {value === null ? (
        <p className="text-lg text-muted">No data yet</p>
      ) : (
        <p className="text-2xl font-semibold">{value}</p>
      )}
    </Card>
  );
}
