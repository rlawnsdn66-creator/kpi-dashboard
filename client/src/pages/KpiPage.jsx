import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import Modal from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';
import CircleProgress from '../components/common/CircleProgress';
import ProgressBar from '../components/common/ProgressBar';
import { usePeriod } from '../context/PeriodContext';
import {
  getKpis, createKpi, updateKpi, deleteKpi,
  getOkrs, createOkr, updateOkr, deleteOkr,
  createKeyResult, updateKeyResult, deleteKeyResult,
  createKpiKeyResult, updateKpiKeyResult, deleteKpiKeyResult,
  getOrgTree, getUsers, getPeriods, updatePeriod,
  updateMilestone, bulkSetMilestones
} from '../api';

function flattenTree(nodes, depth = 0) {
  let result = [];
  for (const n of nodes) {
    result.push({ ...n, _depth: depth });
    if (n.children) result = result.concat(flattenTree(n.children, depth + 1));
  }
  return result;
}

export default function KpiPage() {
  const { selectedPeriod } = usePeriod();
  const [kpis, setKpis] = useState([]);
  const [okrs, setOkrs] = useState([]);
  const [flatOrgs, setFlatOrgs] = useState([]);
  const [users, setUsers] = useState([]);
  const [filterOrg, setFilterOrg] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedKpis, setExpandedKpis] = useState({});
  const [expandedOkrs, setExpandedOkrs] = useState({});

  // KPI modal
  const [kpiModalOpen, setKpiModalOpen] = useState(false);
  const [kpiEditId, setKpiEditId] = useState(null);
  const [kpiForm, setKpiForm] = useState({ name: '', description: '', organization_id: '', owner_id: '', unit: '%', direction: 'higher_better' });

  // OKR modal
  const [okrModalOpen, setOkrModalOpen] = useState(false);
  const [okrEditId, setOkrEditId] = useState(null);
  const [okrParentKpiId, setOkrParentKpiId] = useState(null);
  const [okrForm, setOkrForm] = useState({ title: '', description: '', organization_id: '', owner_id: '', key_results: [] });

  // OKR Progress modal
  const [okrProgressModal, setOkrProgressModal] = useState(null);
  const [okrProgressValue, setOkrProgressValue] = useState(0);
  const [okrStatusValue, setOkrStatusValue] = useState('on_track');

  const load = () => {
    if (!selectedPeriod) return;
    setLoading(true);
    const params = { period_id: selectedPeriod.id };
    if (filterOrg) { params.organization_id = filterOrg; params.include_children = 'true'; }
    if (filterStatus) params.status = filterStatus;
    const okrParams = { period_id: selectedPeriod.id };
    if (filterOrg) okrParams.organization_id = filterOrg;
    Promise.all([getKpis(params), getOkrs(okrParams)])
      .then(([k, o]) => { setKpis(k); setOkrs(o); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [selectedPeriod, filterOrg, filterStatus]);
  useEffect(() => {
    getOrgTree().then(t => setFlatOrgs(flattenTree(t)));
    getUsers().then(setUsers);
  }, []);

  const getChildOkrs = (kpiId) => okrs.filter(o => o.kpi_id === kpiId);
  const toggleKpi = (id) => setExpandedKpis(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleOkr = (id) => setExpandedOkrs(prev => ({ ...prev, [id]: !prev[id] }));

  // KPI CRUD
  const openCreateKpi = () => {
    setKpiForm({ name: '', description: '', organization_id: '', owner_id: '', unit: '%', direction: 'higher_better' });
    setKpiEditId(null);
    setKpiModalOpen(true);
  };
  const openEditKpi = (kpi) => {
    setKpiForm({ name: kpi.name, description: kpi.description || '', organization_id: kpi.organization_id || '', owner_id: kpi.owner_id || '', unit: kpi.unit, direction: kpi.direction });
    setKpiEditId(kpi.id);
    setKpiModalOpen(true);
  };
  const handleKpiSubmit = async (e) => {
    e.preventDefault();
    const data = { ...kpiForm, period_id: selectedPeriod.id, organization_id: kpiForm.organization_id ? Number(kpiForm.organization_id) : null, owner_id: kpiForm.owner_id ? Number(kpiForm.owner_id) : null };
    if (kpiEditId) await updateKpi(kpiEditId, data);
    else await createKpi(data);
    setKpiModalOpen(false);
    load();
  };
  const handleDeleteKpi = async (id) => {
    if (!confirm('KPI를 삭제하시겠습니까? 하위 OKR도 함께 삭제됩니다.')) return;
    await deleteKpi(id);
    load();
  };

  // OKR CRUD
  const openCreateOkr = (kpiId) => {
    setOkrForm({ title: '', description: '', organization_id: '', owner_id: '', key_results: [{ title: '', target_value: 100, unit: '%', weight: 1 }] });
    setOkrEditId(null);
    setOkrParentKpiId(kpiId);
    setOkrModalOpen(true);
  };
  const openEditOkr = (okr) => {
    setOkrForm({ title: okr.title, description: okr.description || '', organization_id: okr.organization_id || '', owner_id: okr.owner_id || '' });
    setOkrEditId(okr.id);
    setOkrParentKpiId(null);
    setOkrModalOpen(true);
  };
  const handleOkrSubmit = async (e) => {
    e.preventDefault();
    const data = { ...okrForm, period_id: selectedPeriod.id, organization_id: okrForm.organization_id ? Number(okrForm.organization_id) : null, owner_id: okrForm.owner_id ? Number(okrForm.owner_id) : null };
    if (okrEditId) {
      await updateOkr(okrEditId, data);
    } else {
      data.kpi_id = okrParentKpiId;
      data.key_results = okrForm.key_results?.filter(kr => kr.title.trim());
      await createOkr(data);
    }
    setOkrModalOpen(false);
    load();
  };
  const handleDeleteOkr = async (id) => {
    if (!confirm('OKR을 삭제하시겠습니까?')) return;
    await deleteOkr(id);
    load();
  };

  // OKR form KR helpers
  const addKrToOkrForm = () => setOkrForm({ ...okrForm, key_results: [...(okrForm.key_results || []), { title: '', target_value: 100, unit: '%', weight: 1 }] });
  const updateKrInOkrForm = (idx, field, val) => {
    const krs = [...okrForm.key_results];
    krs[idx] = { ...krs[idx], [field]: val };
    setOkrForm({ ...okrForm, key_results: krs });
  };
  const removeKrFromOkrForm = (idx) => setOkrForm({ ...okrForm, key_results: okrForm.key_results.filter((_, i) => i !== idx) });

  // OKR progress
  const openOkrProgress = (okr) => {
    setOkrProgressModal({ id: okr.id, title: okr.title });
    setOkrProgressValue(okr.progress);
    setOkrStatusValue(okr.status);
  };
  const handleOkrProgressSubmit = async (e) => {
    e.preventDefault();
    await updateOkr(okrProgressModal.id, { progress: Number(okrProgressValue), status: okrStatusValue });
    setOkrProgressModal(null);
    load();
  };

  const handleDeleteKr = async (okrId, krId) => {
    if (!confirm('핵심 결과를 삭제하시겠습니까?')) return;
    await deleteKeyResult(okrId, krId);
    load();
  };

  if (loading) return <div className="page"><Header title="KPI / OKR 관리" /><div className="loading">로딩 중...</div></div>;

  return (
    <div className="page">
      <Header title="KPI / OKR 관리" />
      <div className="page-toolbar">
        <div className="filters">
          <select value={filterOrg} onChange={e => setFilterOrg(e.target.value)}>
            <option value="">전체 조직</option>
            {flatOrgs.map(o => <option key={o.id} value={o.id}>{'  '.repeat(o._depth)}{o.level_label ? `[${o.level_label}] ` : ''}{o.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">전체 상태</option>
            <option value="on_track">정상</option>
            <option value="at_risk">주의</option>
            <option value="behind">지연</option>
            <option value="completed">완료</option>
          </select>
        </div>
        <button className="btn btn--primary" onClick={openCreateKpi}>+ KPI 등록</button>
      </div>

      {kpis.length === 0 ? (
        <div className="empty-state">등록된 KPI가 없습니다</div>
      ) : (
        <div className="kpi-cascade">
          {kpis.map(kpi => {
            const childOkrs = getChildOkrs(kpi.id);
            const kpiKrs = kpi.key_results || [];
            const isExpanded = expandedKpis[kpi.id] !== false; // default open
            return (
              <div key={kpi.id} className="cascade-kpi">
                {/* KPI Header Card */}
                <div className="cascade-kpi__header" onClick={() => toggleKpi(kpi.id)}>
                  <div className="cascade-kpi__left">
                    <CircleProgress value={kpi.progress} size={56} strokeWidth={5} />
                    <div className="cascade-kpi__info">
                      <div className="cascade-kpi__title-row">
                        <span className="cascade-kpi__expand">{isExpanded ? '▾' : '▸'}</span>
                        <h3 className="cascade-kpi__name">{kpi.name}</h3>
                        <StatusBadge status={kpi.status} />
                      </div>
                      <div className="cascade-kpi__meta">
                        <span>{kpi.team_name}</span>
                        {kpi.owner_name && <span> · {kpi.owner_name}</span>}
                        <span> · {kpi.current_value} / {kpi.target_value} {kpi.unit}</span>
                      </div>
                    </div>
                  </div>
                  <div className="cascade-kpi__actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn--xs btn--primary" onClick={() => openCreateOkr(kpi.id)}>+OKR</button>
                    <button className="btn btn--xs" onClick={() => openEditKpi(kpi)}>수정</button>
                    <button className="btn btn--xs btn--danger" onClick={() => handleDeleteKpi(kpi.id)}>삭제</button>
                  </div>
                </div>

                {/* Expanded: KPI direct KRs + child OKRs */}
                {isExpanded && (
                  <div className="cascade-kpi__body">
                    {/* KPI direct KRs */}
                    {kpiKrs.length > 0 && (
                      <div className="cascade-krs cascade-krs--direct">
                        <div className="cascade-krs__label">KPI 핵심 결과</div>
                        {kpiKrs.map(kr => (
                          <div key={kr.id} className="cascade-kr">
                            <div className="cascade-kr__info">
                              <span className="cascade-kr__title">{kr.title}</span>
                              <span className="cascade-kr__value">{kr.current_value} / {kr.target_value} {kr.unit}</span>
                            </div>
                            <ProgressBar value={kr.current_value} max={kr.target_value} size="sm" />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Child OKRs */}
                    {childOkrs.length > 0 ? childOkrs.map(okr => {
                      const okrKrs = okr.key_results || [];
                      const okrExpanded = expandedOkrs[okr.id] !== false;
                      return (
                        <div key={okr.id} className="cascade-okr">
                          <div className="cascade-okr__header" onClick={() => toggleOkr(okr.id)}>
                            <div className="cascade-okr__left">
                              <div className="cascade-okr__circle" onClick={e => { e.stopPropagation(); openOkrProgress(okr); }} title="진행률 수정">
                                <CircleProgress value={okr.progress} size={44} strokeWidth={4} />
                              </div>
                              <div className="cascade-okr__info">
                                <div className="cascade-okr__title-row">
                                  <span className="cascade-kpi__expand">{okrExpanded ? '▾' : '▸'}</span>
                                  <span className="cascade-okr__name">{okr.title}</span>
                                  <StatusBadge status={okr.status} />
                                </div>
                                <div className="cascade-okr__meta">
                                  {okr.owner_name && <span>{okr.owner_name}</span>}
                                  {okrKrs.length > 0 && <span> · KR {okrKrs.length}개</span>}
                                </div>
                              </div>
                            </div>
                            <div className="cascade-okr__actions" onClick={e => e.stopPropagation()}>
                              <button className="btn btn--xs btn--success" onClick={() => openOkrProgress(okr)}>진행률</button>
                              <button className="btn btn--xs" onClick={() => openEditOkr(okr)}>수정</button>
                              <button className="btn btn--xs btn--danger" onClick={() => handleDeleteOkr(okr.id)}>삭제</button>
                            </div>
                          </div>

                          {okrExpanded && okrKrs.length > 0 && (
                            <div className="cascade-krs">
                              {okrKrs.map(kr => (
                                <div key={kr.id} className="cascade-kr">
                                  <div className="cascade-kr__info">
                                    <span className="cascade-kr__title">{kr.title}</span>
                                    <span className="cascade-kr__value">{kr.current_value} / {kr.target_value} {kr.unit}</span>
                                  </div>
                                  <ProgressBar value={kr.current_value} max={kr.target_value} size="sm" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }) : (
                      <div className="cascade-empty">하위 OKR이 없습니다</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* KPI 모달 */}
      <Modal isOpen={kpiModalOpen} onClose={() => setKpiModalOpen(false)} title={kpiEditId ? 'KPI 수정' : 'KPI 등록'}>
        <form onSubmit={handleKpiSubmit} className="form">
          <label>KPI 이름 <input required value={kpiForm.name} onChange={e => setKpiForm({ ...kpiForm, name: e.target.value })} /></label>
          <label>설명 <textarea value={kpiForm.description} onChange={e => setKpiForm({ ...kpiForm, description: e.target.value })} /></label>
          <label>조직 <select required value={kpiForm.organization_id} onChange={e => setKpiForm({ ...kpiForm, organization_id: e.target.value })}>
            <option value="">선택</option>
            {flatOrgs.map(o => <option key={o.id} value={o.id}>{'  '.repeat(o._depth)}{o.level_label ? `[${o.level_label}] ` : ''}{o.name}</option>)}
          </select></label>
          <label>담당자 <select value={kpiForm.owner_id} onChange={e => setKpiForm({ ...kpiForm, owner_id: e.target.value })}>
            <option value="">선택</option>
            {users.filter(u => !kpiForm.organization_id || u.organization_id === Number(kpiForm.organization_id)).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select></label>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setKpiModalOpen(false)}>취소</button>
            <button type="submit" className="btn btn--primary">{kpiEditId ? '수정' : '등록'}</button>
          </div>
        </form>
      </Modal>

      {/* OKR 모달 */}
      <Modal isOpen={okrModalOpen} onClose={() => setOkrModalOpen(false)} title={okrEditId ? 'OKR 수정' : 'OKR 등록'}>
        <form onSubmit={handleOkrSubmit} className="form">
          <label>목표 제목 <input required value={okrForm.title} onChange={e => setOkrForm({ ...okrForm, title: e.target.value })} /></label>
          <label>설명 <textarea value={okrForm.description} onChange={e => setOkrForm({ ...okrForm, description: e.target.value })} /></label>
          <label>조직 <select required value={okrForm.organization_id} onChange={e => setOkrForm({ ...okrForm, organization_id: e.target.value })}>
            <option value="">선택</option>
            {flatOrgs.map(o => <option key={o.id} value={o.id}>{'  '.repeat(o._depth)}{o.level_label ? `[${o.level_label}] ` : ''}{o.name}</option>)}
          </select></label>
          <label>담당자 <select value={okrForm.owner_id} onChange={e => setOkrForm({ ...okrForm, owner_id: e.target.value })}>
            <option value="">선택</option>
            {users.filter(u => !okrForm.organization_id || u.organization_id === Number(okrForm.organization_id)).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select></label>
          {!okrEditId && (
            <div className="kr-form-section">
              <h4>핵심 결과 (Key Results)</h4>
              {okrForm.key_results?.map((kr, i) => (
                <div key={i} className="kr-form-row">
                  <input placeholder="제목" value={kr.title} onChange={e => updateKrInOkrForm(i, 'title', e.target.value)} />
                  <input type="number" placeholder="목표값" value={kr.target_value} onChange={e => updateKrInOkrForm(i, 'target_value', e.target.value)} style={{ width: 80 }} />
                  <input placeholder="단위" value={kr.unit} onChange={e => updateKrInOkrForm(i, 'unit', e.target.value)} style={{ width: 60 }} />
                  <button type="button" className="btn btn--sm btn--danger" onClick={() => removeKrFromOkrForm(i)}>X</button>
                </div>
              ))}
              <button type="button" className="btn btn--sm" onClick={addKrToOkrForm}>+ 핵심 결과 추가</button>
            </div>
          )}
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setOkrModalOpen(false)}>취소</button>
            <button type="submit" className="btn btn--primary">{okrEditId ? '수정' : '등록'}</button>
          </div>
        </form>
      </Modal>

      {/* OKR 진행률 모달 */}
      <Modal isOpen={!!okrProgressModal} onClose={() => setOkrProgressModal(null)} title="OKR 진행률 수정">
        {okrProgressModal && (
          <form onSubmit={handleOkrProgressSubmit} className="form">
            <p style={{ marginBottom: 12, fontWeight: 600 }}>{okrProgressModal.title}</p>
            <label>진행률 ({okrProgressValue}%)
              <input type="range" min="0" max="100" value={okrProgressValue} onChange={e => setOkrProgressValue(e.target.value)} />
              <input type="number" min="0" max="100" value={okrProgressValue} onChange={e => setOkrProgressValue(e.target.value)} style={{ width: 80, marginTop: 4 }} />
            </label>
            <label>상태
              <select value={okrStatusValue} onChange={e => setOkrStatusValue(e.target.value)}>
                <option value="on_track">정상</option>
                <option value="at_risk">주의</option>
                <option value="behind">지연</option>
                <option value="completed">완료</option>
              </select>
            </label>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setOkrProgressModal(null)}>취소</button>
              <button type="submit" className="btn btn--primary">저장</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
