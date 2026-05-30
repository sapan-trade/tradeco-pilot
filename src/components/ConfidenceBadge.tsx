export function ConfidenceBadge({ value }: { value: number }) {
  const cls = value >= 0.85 ? "conf conf-high" : value >= 0.7 ? "conf conf-med" : "conf conf-low";
  return <span className={cls}>{(value * 100).toFixed(1)}%</span>;
}
