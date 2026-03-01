import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
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
    Promise.all([
      getDashboardSummary(params),
      getOkrProgress(params),
      getOrgSummary(params),
      getKpis({ ...params }),
    ]).then(([sum, okr, org, kpis]) => {
      setSummary(sum);
      const statusLabels = { on_track: '정상', at_risk: '주의', behind: '지연', completed: '완료' };
      setOkrStatus(okr.map(o => ({ name: statusLabels[o.status] || o.status, value: o.count })));
      setOrgData(org.map(t => ({ name: t.name, KPI달성: t.kpi_count > 0 ? Math.round(t.kpi_completed / t.kpi_count * 100) : 0, OKR진행률: Math.round(t.okr_avg_progress) })));
      setAtRiskKpis(kpis.filter(k => k.status === 'at_risk' || k.status === 'behind'));
      setLoading(false);
    }).catch(() => setLoading(false));
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
        <div className="chart-card">
          <h3>조직별 성과</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={orgData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="KPI달성" fill="#2196f3" />
              <Bar dataKey="OKR진행률" fill="#ff9800" />
            </BarChart>
          </ResponsiveContainer>
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
