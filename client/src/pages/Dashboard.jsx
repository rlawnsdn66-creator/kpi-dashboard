import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import Header from '../components/layout/Header';
import SummaryCard from '../components/common/SummaryCard';
import StatusBadge from '../components/common/StatusBadge';
import { usePeriod } from '../context/PeriodContext';
import { getDashboardSummary, getOkrProgress, getOrgSummary, getKpis } from '../api';

const PIE_COLORS = ['#4caf50', '#ff9800', '#f44336', '#2196f3'];

export default function Dashboard() {
  const { selectedPeriod } = usePeriod();
  const [summary, setSummary] = useState(null);
  const [okrStatus, setOkrStatus] = useState([]);
  const [orgData, setOrgData] = useState([]);
  const [atRiskKpis, setAtRiskKpis] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedPeriod) return;
    setLoading(true);
    const params = { period_id: selectedPeriod.id };
    Promise.allSettled([
      getDashboardSummary(params),
      getOkrProgress(params),
      getOrgSummary(params),
      getKpis({ ...params }),
    ]).then(([sumRes, okrRes, orgRes, kpisRes]) => {
      const sum = sumRes.status === 'fulfilled' ? sumRes.value : null;
      const okr = okrRes.status === 'fulfilled' ? okrRes.value : [];
      const org = orgRes.status === 'fulfilled' ? orgRes.value : [];
      const kpis = kpisRes.status === 'fulfilled' ? kpisRes.value : [];
      setSummary(sum);
      const statusLabels = { on_track: '정상', at_risk: '주의', behind: '지연', completed: '완료' };
      setOkrStatus(okr.map(o => ({ name: statusLabels[o.status] || o.status, value: o.count })));
      setOrgData(org.map(t => ({ name: t.name, level: t.level_label, kpiCount: t.kpi_count, kpiProgress: Math.round(t.kpi_avg_progress), okrCount: t.okr_count, okrProgress: Math.round(t.okr_avg_progress) })));
      setAtRiskKpis(kpis.filter(k => k.status === 'at_risk' || k.status === 'behind'));
      setLoading(false);
    });
  }, [selectedPeriod]);

  if (loading) return <div className="page"><Header title="대시보드" /><div className="loading">로딩 중...</div></div>;

  const reviewRate = summary?.review_total > 0 ? Math.round((summary.review_completed / summary.review_total) * 100) : 0;

  return (
    <div className="page">
      <Header title="대시보드" />
      <div className="summary-cards">
        <SummaryCard title="KPI 수" value={summary?.kpi_count || 0} color="#2196f3" />
        <SummaryCard title="KPI 달성률" value={`${summary?.kpi_achievement_rate || 0}%`} color="#4caf50" />
        <SummaryCard title="OKR 수" value={summary?.okr_count || 0} color="#9c27b0" />
        <SummaryCard title="OKR 평균 진행률" value={`${summary?.okr_avg_progress || 0}%`} color="#ff9800" />
        {summary?.review_total > 0 && (
          <SummaryCard title="평가 완료율" value={`${reviewRate}%`} color="#e91e63" />
        )}
      </div>

      <div className="chart-grid">
        <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <h3>조직별 KPI / OKR 달성률</h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>조직</th>
                  <th>구분</th>
                  <th>KPI 수</th>
                  <th>KPI 달성률</th>
                  <th>OKR 수</th>
                  <th>OKR 진행률</th>
                </tr>
              </thead>
              <tbody>
                {orgData.map((org, i) => (
                  <tr key={i} style={org.level === '본부' ? { fontWeight: 'bold', backgroundColor: '#f0f4ff' } : {}}>
                    <td>{org.level === '팀' ? '　' : ''}{org.name}</td>
                    <td>{org.level}</td>
                    <td>{org.kpiCount}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 8, backgroundColor: '#e0e0e0', borderRadius: 4 }}>
                          <div style={{ width: `${Math.min(org.kpiProgress, 100)}%`, height: '100%', backgroundColor: '#2196f3', borderRadius: 4 }} />
                        </div>
                        <span style={{ minWidth: 40, textAlign: 'right' }}>{org.kpiProgress}%</span>
                      </div>
                    </td>
                    <td>{org.okrCount}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 8, backgroundColor: '#e0e0e0', borderRadius: 4 }}>
                          <div style={{ width: `${Math.min(org.okrProgress, 100)}%`, height: '100%', backgroundColor: '#ff9800', borderRadius: 4 }} />
                        </div>
                        <span style={{ minWidth: 40, textAlign: 'right' }}>{org.okrProgress}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="chart-card">
          <h3>OKR 상태 분포</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={okrStatus} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name} ${value}`}>
                {okrStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {atRiskKpis.length > 0 && (
        <div className="chart-card">
          <h3>주의 필요 KPI</h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>KPI</th><th>조직</th><th>진행률</th><th>상태</th></tr>
              </thead>
              <tbody>
                {atRiskKpis.map(kpi => (
                  <tr key={kpi.id}>
                    <td>{kpi.name}</td>
                    <td>{kpi.team_name}</td>
                    <td>{Math.round(kpi.progress)}%</td>
                    <td><StatusBadge status={kpi.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
