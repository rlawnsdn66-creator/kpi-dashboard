export default function SummaryCard({ title, value, subtitle, color }) {
  return (
    <div className="summary-card" style={{ borderLeftColor: color || 'var(--color-primary)' }}>
      <div className="summary-card__title">{title}</div>
      <div className="summary-card__value">{value}</div>
      {subtitle && <div className="summary-card__subtitle">{subtitle}</div>}
    </div>
  );
}
