import { getProgressColor } from '../../utils/progress';

export default function ProgressBar({ value, max = 100, showLabel = true, size = 'md', color }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  const barColor = color || getProgressColor(pct);

  return (
    <div className={`progress-bar progress-bar--${size}`}>
      <div className="progress-bar__track">
        <div className="progress-bar__fill" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      {showLabel && <span className="progress-bar__label">{pct}%</span>}
    </div>
  );
}
