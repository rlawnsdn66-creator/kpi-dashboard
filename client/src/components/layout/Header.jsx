import { usePeriod } from '../../context/PeriodContext';

export default function Header({ title }) {
  const { periods, selectedPeriod, setSelectedPeriod } = usePeriod();

  return (
    <header className="header">
      <h1 className="header-title">{title}</h1>
      <div className="header-actions">
        <select
          className="period-select"
          value={selectedPeriod?.id || ''}
          onChange={e => {
            const p = periods.find(p => p.id === Number(e.target.value));
            if (p) setSelectedPeriod(p);
          }}
        >
          {periods.map(p => (
            <option key={p.id} value={p.id}>{p.name}{p.is_active ? ' (활성)' : ''}</option>
          ))}
        </select>
      </div>
    </header>
  );
}
