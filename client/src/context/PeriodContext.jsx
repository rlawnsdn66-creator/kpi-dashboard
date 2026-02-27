import { createContext, useContext, useState, useEffect } from 'react';
import { getPeriods } from '../api';

const PeriodContext = createContext();

export function PeriodProvider({ children }) {
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPeriods().then(data => {
      setPeriods(data);
      const active = data.find(p => p.is_active);
      setSelectedPeriod(active || data[0] || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const refresh = () => getPeriods().then(setPeriods);

  return (
    <PeriodContext.Provider value={{ periods, selectedPeriod, setSelectedPeriod, loading, refresh }}>
      {children}
    </PeriodContext.Provider>
  );
}

export const usePeriod = () => useContext(PeriodContext);
