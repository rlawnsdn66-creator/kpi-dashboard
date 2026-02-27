export default function ProgressBar({ value, max = 100, showLabel = true, size = 'md' }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  const color = pct >= 80 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-danger)';

  return (
    <div className={`progress-bar progress-bar--${size}`}>
      <div className="progress-bar__track">
        <div className="progress-bar__fill" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      {showLabel && <span className="progress-bar__label">{pct}%</span>}
    </div>
  );
}
