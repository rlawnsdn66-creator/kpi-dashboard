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
  updateMilestone, bulkSetMilestones,
  importFromPeriod,
  getObjectives, createObjective, updateObjective, deleteObjective
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
  const [objectives, setObjectives] = useState([]);
  const [flatOrgs, setFlatOrgs] = useState([]);
  const [users, setUsers] = useState([]);
  const [filterOrg, setFilterOrg] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedObjectives, setExpandedObjectives] = useState({});
  const [expandedKpis, setExpandedKpis] = useState({});
  const [expandedOkrs, setExpandedOkrs] = useState({});

  // Objective modal
  const [objModalOpen, setObjModalOpen] = useState(false);
  const [objEditId, setObjEditId] = useState(null);
  const [objForm, setObjForm] = useState({ title: '', description: '', organization_id: '' });

  // KPI modal
  const [kpiModalOpen, setKpiModalOpen] = useState(false);
  const [kpiEditId, setKpiEditId] = useState(null);
  const [kpiForm, setKpiForm] = useState({ name: '', description: '', organization_id: '', owner_id: '', unit: '%', direction: 'higher_better', objective_id: '' });

  // OKR modal
  const [okrModalOpen, setOkrModalOpen] = useState(false);
  const [okrEditId, setOkrEditId] = useState(null);
  const [okrParentKpiId, setOkrParentKpiId] = useState(null);
  const [okrForm, setOkrForm] = useState({ title: '', description: '', organization_id: '', owner_id: '' });

  // 이전분기 불러오기
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [periods, setPeriods] = useState([]);
  const [importSourceId, setImportSourceId] = useState('');
  const [importResult, setImportResult] = useState(null);


  const load = () => {
    if (!selectedPeriod) return;
    setLoading(true);
    const params = { period_id: selectedPeriod.id };
    if (filterOrg) { params.organization_id = filterOrg; params.include_children = 'true'; }
    if (filterStatus) params.status = filterStatus;
    const okrParams = { period_id: selectedPeriod.id };
    if (filterOrg) okrParams.organization_id = filterOrg;
    const objParams = { period_id: selectedPeriod.id };
    Promise.all([getKpis(params), getOkrs(okrParams), getObjectives(objParams)])
      .then(([k, o, obj]) => { setKpis(k); setOkrs(o); setObjectives(obj); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [selectedPeriod, filterOrg, filterStatus]);
  useEffect(() => {
    getOrgTree().then(t => setFlatOrgs(flattenTree(t)));
    getUsers().then(setUsers);
    getPeriods().then(setPeriods);
  }, []);

  const getChildOkrs = (kpiId) => okrs.filter(o => o.kpi_id === kpiId);
  const getChildKpis = (objectiveId) => kpis.filter(k => k.objective_id === objectiveId);
  const getUnassignedKpis = () => kpis.filter(k => !k.objective_id);
  const toggleObjective = (id) => setExpandedObjectives(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleKpi = (id) => setExpandedKpis(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleOkr = (id) => setExpandedOkrs(prev => ({ ...prev, [id]: !prev[id] }));

  // Objective CRUD
  const openCreateObj = () => {
    setObjForm({ title: '', description: '', organization_id: '' });
    setObjEditId(null);
    setObjModalOpen(true);
  };
  const openEditObj = (obj) => {
    setObjForm({ title: obj.title, description: obj.description || '', organization_id: obj.organization_id || '' });
    setObjEditId(obj.id);
    setObjModalOpen(true);
  };
  const handleObjSubmit = async (e) => {
    e.preventDefault();
    const data = { ...objForm, period_id: selectedPeriod.id, organization_id: objForm.organization_id ? Number(objForm.organization_id) : null };
    if (objEditId) await updateObjective(objEditId, data);
    else await createObjective(data);
    setObjModalOpen(false);
    load();
  };
  const handleDeleteObj = async (id) => {
    if (!confirm('Objective를 삭제하시겠습니까? 하위 KPI의 Objective 연결이 해제됩니다.')) return;
    await deleteObjective(id);
    load();
  };

  // KPI CRUD
  const openCreateKpi = (objectiveId) => {
    setKpiForm({ name: '', description: '', organization_id: '', owner_id: '', unit: '%', direction: 'higher_better', objective_id: objectiveId || '' });
    setKpiEditId(null);
    setKpiModalOpen(true);
  };
  const openEditKpi = (kpi) => {
    setKpiForm({ name: kpi.name, description: kpi.description || '', organization_id: kpi.organization_id || '', owner_id: kpi.owner_id || '', unit: kpi.unit, direction: kpi.direction, objective_id: kpi.objective_id || '' });
    setKpiEditId(kpi.id);
    setKpiModalOpen(true);
  };
  const handleKpiSubmit = async (e) => {
    e.preventDefault();
    const data = { ...kpiForm, period_id: selectedPeriod.id, organization_id: kpiForm.organization_id ? Number(kpiForm.organization_id) : null, owner_id: kpiForm.owner_id ? Number(kpiForm.owner_id) : null, objective_id: kpiForm.objective_id ? Number(kpiForm.objective_id) : null };
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
    setOkrForm({ title: '', description: '', organization_id: '', owner_id: '' });
    setOkrEditId(null);
    setOkrParentKpiId(kpiId);
    setOkrModalOpen(true);
  };
  const openEditOkr = (okr) => {
    setOkrForm({ title: okr.title, description: okr.description || '', organization_id: okr.organization_id || '', owner_id: okr.owner_id || '', progress: okr.progress ?? 0, status: okr.status || 'on_track' });
    setOkrEditId(okr.id);
    setOkrParentKpiId(null);
    setOkrModalOpen(true);
  };
  const handleOkrSubmit = async (e) => {
    e.preventDefault();
    const data = { ...okrForm, period_id: selectedPeriod.id, organization_id: okrForm.organization_id ? Number(okrForm.organization_id) : null, owner_id: okrForm.owner_id ? Number(okrForm.owner_id) : null };
    if (okrEditId) {
      data.progress = Number(okrForm.progress) || 0;
      data.status = okrForm.status || 'on_track';
      await updateOkr(okrEditId, data);
    } else {
      data.kpi_id = okrParentKpiId;
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

  // 이전분기 불러오기
  const openImportModal = () => {
    setImportSourceId('');
    setImportResult(null);
    setImportModalOpen(true);
  };
  const handleImport = async () => {
    if (!importSourceId) return;
    const result = await importFromPeriod({ source_period_id: Number(importSourceId), target_period_id: selectedPeriod.id });
    setImportResult(result.message);
    load();
  };

  const handleDeleteKr = async (okrId, krId) => {
    if (!confirm('핵심 결과를 삭제하시겠습니까?')) return;
    await deleteKeyResult(okrId, krId);
    load();
  };

  // 미분류 KPI에 Objective 빠른 할당
  const handleQuickAssignObjective = async (kpiId, objectiveId) => {
    await updateKpi(kpiId, { objective_id: objectiveId ? Number(objectiveId) : null });
    load();
  };

  // KPI 렌더 함수 (Objective 내부와 미분류 모두에서 사용)
  const renderKpi = (kpi) => {
    const childOkrs = getChildOkrs(kpi.id);
    const kpiKrs = kpi.key_results || [];
    const isExpanded = expandedKpis[kpi.id] === true;
    return (
      <div key={kpi.id} className="cascade-kpi">
        <div className="cascade-kpi__header" onClick={() => toggleKpi(kpi.id)}>
          <div className="cascade-kpi__left">
            <CircleProgress value={kpi.progress} size={56} strokeWidth={5} />
            <div className="cascade-kpi__info">
              <div className="cascade-kpi__title-row">
                <span className="cascade-kpi__expand">{isExpanded ? '▾' : '▸'}</span>
                <span className="cascade-kpi__tag">KPI</span>
                <h3 className="cascade-kpi__name">{kpi.name}</h3>
                <StatusBadge status={kpi.status} />
              </div>
              <div className="cascade-kpi__meta">
                {kpi.team_name && <span>{kpi.team_name}</span>}
              </div>
            </div>
          </div>
          <div className="cascade-kpi__actions" onClick={e => e.stopPropagation()}>
            {!kpi.objective_id && objectives.length > 0 && (
              <select
                className="cascade-kpi__obj-select"
                value=""
                onChange={e => handleQuickAssignObjective(kpi.id, e.target.value)}
                onClick={e => e.stopPropagation()}
              >
                <option value="">Objective 지정</option>
                {objectives.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
              </select>
            )}
            <button className="btn btn--xs btn--primary" onClick={() => openCreateOkr(kpi.id)}>+OKR</button>
            <button className="btn btn--xs" onClick={() => openEditKpi(kpi)}>수정</button>
            <button className="btn btn--xs btn--danger" onClick={() => handleDeleteKpi(kpi.id)}>삭제</button>
          </div>
        </div>

        {isExpanded && (
          <div className="cascade-kpi__body">
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

            {childOkrs.length > 0 ? childOkrs.map(okr => {
              const okrKrs = okr.key_results || [];
              const okrExpanded = expandedOkrs[okr.id] === true;
              return (
                <div key={okr.id} className="cascade-okr">
                  <div className="cascade-okr__header" onClick={() => toggleOkr(okr.id)}>
                    <div className="cascade-okr__left">
                      <div className="cascade-okr__circle" onClick={e => { e.stopPropagation(); openEditOkr(okr); }} title="클릭하여 수정">
                        <CircleProgress value={okr.progress} size={44} strokeWidth={4} />
                      </div>
                      <div className="cascade-okr__info">
                        <div className="cascade-okr__title-row">
                          <span className="cascade-kpi__expand">{okrExpanded ? '▾' : '▸'}</span>
                          <span className="cascade-okr__name">{okr.title}</span>
                          <StatusBadge status={okr.status} />
                        </div>
                        <div className="cascade-okr__meta">
                          {okr.team_name && <span>{okr.team_name}</span>}
                          {okrKrs.length > 0 && <span> · KR {okrKrs.length}개</span>}
                        </div>
                      </div>
                    </div>
                    <div className="cascade-okr__actions" onClick={e => e.stopPropagation()}>
                      <button className="btn btn--xs" onClick={() => openEditOkr(okr)}>수정</button>
                      <button className="btn btn--xs btn--danger" onClick={() => handleDeleteOkr(okr.id)}>삭제</button>
                    </div>
                  </div>

                  {okrExpanded && (
                    <div className="cascade-krs">
                      {okr.description && (
                        <div className="cascade-okr__desc">{okr.description}</div>
                      )}
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
  };

  if (loading) return <div className="page"><Header title="KPI / OKR 관리" /><div className="loading">로딩 중...</div></div>;

  const unassignedKpis = getUnassignedKpis();

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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={openImportModal}>이전분기 불러오기</button>
          <button className="btn btn--primary" onClick={openCreateObj}>+ Objective 등록</button>
          <button className="btn btn--primary" onClick={() => openCreateKpi()}>+ KPI 등록</button>
        </div>
      </div>

      {objectives.length === 0 && kpis.length === 0 ? (
        <div className="empty-state">등록된 Objective 또는 KPI가 없습니다</div>
      ) : (
        <div className="kpi-cascade">
          {/* Objective 계층 */}
          {objectives.map(obj => {
            const childKpis = getChildKpis(obj.id);
            const isExpanded = expandedObjectives[obj.id] !== false; // 기본 펼침
            return (
              <div key={obj.id} className="cascade-objective">
                <div className="cascade-objective__header" onClick={() => toggleObjective(obj.id)}>
                  <div className="cascade-objective__left">
                    <div className="cascade-objective__icon">OBJ</div>
                    <div className="cascade-objective__info">
                      <div className="cascade-objective__title-row">
                        <span className="cascade-kpi__expand">{isExpanded ? '▾' : '▸'}</span>
                        <h2 className="cascade-objective__name">{obj.title}</h2>
                      </div>
                      <div className="cascade-objective__meta">
                        {obj.organization_name && <span>{obj.organization_name}</span>}
                        {obj.description && <span> · {obj.description}</span>}
                        <span> · KPI {childKpis.length}개</span>
                      </div>
                    </div>
                  </div>
                  <div className="cascade-objective__actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn--xs btn--primary" onClick={() => openCreateKpi(obj.id)}>+KPI</button>
                    <button className="btn btn--xs" onClick={() => openEditObj(obj)}>수정</button>
                    <button className="btn btn--xs btn--danger" onClick={() => handleDeleteObj(obj.id)}>삭제</button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="cascade-objective__body">
                    {childKpis.length > 0 ? childKpis.map(renderKpi) : (
                      <div className="cascade-empty">하위 KPI가 없습니다</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Objective에 속하지 않은 KPI */}
          {unassignedKpis.length > 0 && (
            <>
              {objectives.length > 0 && (
                <div className="cascade-objective cascade-objective--unassigned">
                  <div className="cascade-objective__header">
                    <div className="cascade-objective__left">
                      <div className="cascade-objective__icon" style={{ background: 'var(--color-gray-400, #999)' }}>-</div>
                      <div className="cascade-objective__info">
                        <div className="cascade-objective__title-row">
                          <h2 className="cascade-objective__name" style={{ color: 'var(--color-gray-600, #666)' }}>미분류 KPI</h2>
                        </div>
                        <div className="cascade-objective__meta">
                          <span>KPI {unassignedKpis.length}개</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="cascade-objective__body">
                    {unassignedKpis.map(renderKpi)}
                  </div>
                </div>
              )}
              {objectives.length === 0 && unassignedKpis.map(renderKpi)}
            </>
          )}
        </div>
      )}

      {/* Objective 모달 */}
      <Modal isOpen={objModalOpen} onClose={() => setObjModalOpen(false)} title={objEditId ? 'Objective 수정' : 'Objective 등록'}>
        <form onSubmit={handleObjSubmit} className="form">
          <label>Objective 제목 <input required value={objForm.title} onChange={e => setObjForm({ ...objForm, title: e.target.value })} /></label>
          <label>설명 <textarea value={objForm.description} onChange={e => setObjForm({ ...objForm, description: e.target.value })} /></label>
          <label>조직 <select value={objForm.organization_id} onChange={e => setObjForm({ ...objForm, organization_id: e.target.value })}>
            <option value="">선택</option>
            {flatOrgs.map(o => <option key={o.id} value={o.id}>{'  '.repeat(o._depth)}{o.level_label ? `[${o.level_label}] ` : ''}{o.name}</option>)}
          </select></label>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setObjModalOpen(false)}>취소</button>
            <button type="submit" className="btn btn--primary">{objEditId ? '수정' : '등록'}</button>
          </div>
        </form>
      </Modal>

      {/* KPI 모달 */}
      <Modal isOpen={kpiModalOpen} onClose={() => setKpiModalOpen(false)} title={kpiEditId ? 'KPI 수정' : 'KPI 등록'}>
        <form onSubmit={handleKpiSubmit} className="form">
          <label>KPI 이름 <input required value={kpiForm.name} onChange={e => setKpiForm({ ...kpiForm, name: e.target.value })} /></label>
          <label>설명 <textarea value={kpiForm.description} onChange={e => setKpiForm({ ...kpiForm, description: e.target.value })} /></label>
          <label>Objective <select value={kpiForm.objective_id} onChange={e => setKpiForm({ ...kpiForm, objective_id: e.target.value })}>
            <option value="">선택 안함</option>
            {objectives.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select></label>
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
          {okrEditId && (
            <>
              <label>진행률 ({okrForm.progress}%)
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="range" min="0" max="100" step="1" value={okrForm.progress} onChange={e => setOkrForm({ ...okrForm, progress: e.target.value })} style={{ flex: 1 }} />
                  <input type="number" min="0" max="100" step="1" value={okrForm.progress} onChange={e => setOkrForm({ ...okrForm, progress: e.target.value })} style={{ width: 70, textAlign: 'center' }} />
                </div>
              </label>
              <label>상태
                <select value={okrForm.status} onChange={e => setOkrForm({ ...okrForm, status: e.target.value })}>
                  <option value="on_track">정상</option>
                  <option value="at_risk">주의</option>
                  <option value="behind">지연</option>
                  <option value="completed">완료</option>
                </select>
              </label>
            </>
          )}
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setOkrModalOpen(false)}>취소</button>
            <button type="submit" className="btn btn--primary">{okrEditId ? '수정' : '등록'}</button>
          </div>
        </form>
      </Modal>

      {/* 이전분기 불러오기 모달 */}
      <Modal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} title="이전분기 KPI/OKR 불러오기">
        <div className="form">
          {importResult ? (
            <div>
              <p style={{ color: 'var(--color-success)', fontWeight: 600 }}>{importResult}</p>
              <div className="form-actions">
                <button className="btn btn--primary" onClick={() => setImportModalOpen(false)}>확인</button>
              </div>
            </div>
          ) : (
            <>
              <label>불러올 기간 선택
                <select value={importSourceId} onChange={e => setImportSourceId(e.target.value)}>
                  <option value="">기간을 선택하세요</option>
                  {periods.filter(p => p.id !== selectedPeriod?.id).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
              <p style={{ fontSize: '0.85em', color: '#666' }}>선택한 기간의 Objective, KPI, OKR을 현재 기간으로 복사합니다. 진행률은 0으로 초기화됩니다.</p>
              <div className="form-actions">
                <button className="btn" onClick={() => setImportModalOpen(false)}>취소</button>
                <button className="btn btn--primary" onClick={handleImport} disabled={!importSourceId}>불러오기</button>
              </div>
            </>
          )}
        </div>
      </Modal>

    </div>
  );
}
