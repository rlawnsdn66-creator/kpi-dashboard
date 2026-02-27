import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import Modal from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';
import ProgressBar from '../components/common/ProgressBar';
import { usePeriod } from '../context/PeriodContext';
import { getKpis, createKpi, updateKpi, deleteKpi, createKpiKeyResult, deleteKpiKeyResult, getOrgTree, getUsers, createProgress } from '../api';

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
  const [flatOrgs, setFlatOrgs] = useState([]);
  const [users, setUsers] = useState([]);
  const [filterOrg, setFilterOrg] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', organization_id: '', owner_id: '', unit: '%', direction: 'higher_better', key_results: [] });
  const [progressModal, setProgressModal] = useState(null);
  const [progressValue, setProgressValue] = useState('');
  const [progressNote, setProgressNote] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!selectedPeriod) return;
    const params = { period_id: selectedPeriod.id };
    if (filterOrg) { params.organization_id = filterOrg; params.include_children = 'true'; }
    if (filterStatus) params.status = filterStatus;
    getKpis(params).then(setKpis).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [selectedPeriod, filterOrg, filterStatus]);
  useEffect(() => {
    getOrgTree().then(t => setFlatOrgs(flattenTree(t)));
    getUsers().then(setUsers);
  }, []);

  const openCreate = () => {
    setForm({ name: '', description: '', organization_id: '', owner_id: '', unit: '%', direction: 'higher_better', key_results: [{ title: '', target_value: 100, unit: '%', weight: 1, direction: 'higher_better' }] });
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (kpi) => {
    setForm({ name: kpi.name, description: kpi.description || '', organization_id: kpi.organization_id || '', owner_id: kpi.owner_id || '', unit: kpi.unit, direction: kpi.direction });
    setEditId(kpi.id);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { ...form, period_id: selectedPeriod.id, organization_id: form.organization_id ? Number(form.organization_id) : null, owner_id: form.owner_id ? Number(form.owner_id) : null };
    if (editId) {
      await updateKpi(editId, data);
    } else {
      data.key_results = form.key_results?.filter(kr => kr.title.trim());
      await createKpi(data);
    }
    setModalOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await deleteKpi(id);
    load();
  };

  const handleDeleteKr = async (kpiId, krId) => {
    if (!confirm('핵심 결과를 삭제하시겠습니까?')) return;
    await deleteKpiKeyResult(kpiId, krId);
    load();
  };

  const handleAddKr = async (kpiId) => {
    const title = prompt('핵심 결과 제목:');
    if (!title) return;
    const target = prompt('목표값:', '100');
    const unit = prompt('단위:', '%');
    await createKpiKeyResult(kpiId, { title, target_value: Number(target) || 100, unit: unit || '%', weight: 1, direction: 'higher_better' });
    load();
  };

  const handleProgress = async (e) => {
    e.preventDefault();
    await createProgress({ record_type: 'key_result', record_id: progressModal.id, value: Number(progressValue), note: progressNote || null });
    setProgressModal(null);
    setProgressValue('');
    setProgressNote('');
    load();
  };

  const addKrToForm = () => setForm({ ...form, key_results: [...(form.key_results || []), { title: '', target_value: 100, unit: '%', weight: 1, direction: 'higher_better' }] });
  const updateKrInForm = (idx, field, val) => {
    const krs = [...form.key_results];
    krs[idx] = { ...krs[idx], [field]: val };
    setForm({ ...form, key_results: krs });
  };
  const removeKrFromForm = (idx) => setForm({ ...form, key_results: form.key_results.filter((_, i) => i !== idx) });

  if (loading) return <div className="page"><Header title="KPI 관리" /><div className="loading">로딩 중...</div></div>;

  return (
    <div className="page">
      <Header title="KPI 관리" />
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
        <button className="btn btn--primary" onClick={openCreate}>+ KPI 등록</button>
      </div>

      {kpis.length === 0 ? (
        <div className="empty-state">등록된 KPI가 없습니다</div>
      ) : (
        <div className="okr-list">
          {kpis.map(kpi => (
            <div key={kpi.id} className="okr-card">
              <div className="okr-card__header">
                <div>
                  <h3 className="okr-card__title">{kpi.name}</h3>
                  <div className="okr-card__meta">
                    <span>{kpi.team_name}</span>
                    {kpi.owner_name && <span> &middot; {kpi.owner_name}</span>}
                  </div>
                </div>
                <div className="okr-card__header-right">
                  <StatusBadge status={kpi.status} />
                  <div className="okr-card__progress-label">{Math.round(kpi.progress)}%</div>
                </div>
              </div>
              <ProgressBar value={kpi.progress} />
              {kpi.description && <p className="okr-card__desc">{kpi.description}</p>}

              <div className="kr-list">
                <h4>핵심 결과</h4>
                {kpi.key_results && kpi.key_results.map(kr => (
                  <div key={kr.id} className="kr-item">
                    <div className="kr-item__info">
                      <span className="kr-item__title">{kr.title}</span>
                      <span className="kr-item__value">{kr.current_value} / {kr.target_value} {kr.unit}</span>
                    </div>
                    <ProgressBar value={kr.direction === 'lower_better' ? (kr.current_value > 0 ? Math.min((kr.target_value / kr.current_value) * 100, 100) : 0) : kr.current_value} max={kr.direction === 'lower_better' ? 100 : kr.target_value} size="sm" />
                    <div className="kr-item__actions">
                      <button className="btn btn--sm btn--primary" onClick={() => { setProgressModal(kr); setProgressValue(kr.current_value); }}>업데이트</button>
                      <button className="btn btn--sm btn--danger" onClick={() => handleDeleteKr(kpi.id, kr.id)}>삭제</button>
                    </div>
                  </div>
                ))}
                <button className="btn btn--sm" onClick={() => handleAddKr(kpi.id)}>+ 핵심 결과 추가</button>
              </div>

              <div className="okr-card__actions">
                <button className="btn btn--sm" onClick={() => openEdit(kpi)}>수정</button>
                <button className="btn btn--sm btn--danger" onClick={() => handleDelete(kpi.id)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'KPI 수정' : 'KPI 등록'}>
        <form onSubmit={handleSubmit} className="form">
          <label>KPI 이름 <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></label>
          <label>설명 <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></label>
          <label>조직 <select required value={form.organization_id} onChange={e => setForm({...form, organization_id: e.target.value})}>
            <option value="">선택</option>
            {flatOrgs.map(o => <option key={o.id} value={o.id}>{'  '.repeat(o._depth)}{o.level_label ? `[${o.level_label}] ` : ''}{o.name}</option>)}
          </select></label>
          <label>담당자 <select value={form.owner_id} onChange={e => setForm({...form, owner_id: e.target.value})}>
            <option value="">선택</option>
            {users.filter(u => !form.organization_id || u.organization_id === Number(form.organization_id)).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select></label>

          {!editId && (
            <div className="kr-form-section">
              <h4>핵심 결과</h4>
              {form.key_results?.map((kr, i) => (
                <div key={i} className="kr-form-row">
                  <input placeholder="제목" value={kr.title} onChange={e => updateKrInForm(i, 'title', e.target.value)} />
                  <input type="number" placeholder="목표값" value={kr.target_value} onChange={e => updateKrInForm(i, 'target_value', e.target.value)} style={{width: 80}} />
                  <input placeholder="단위" value={kr.unit} onChange={e => updateKrInForm(i, 'unit', e.target.value)} style={{width: 60}} />
                  <select value={kr.direction} onChange={e => updateKrInForm(i, 'direction', e.target.value)} style={{width: 110}}>
                    <option value="higher_better">높을수록</option>
                    <option value="lower_better">낮을수록</option>
                  </select>
                  <button type="button" className="btn btn--sm btn--danger" onClick={() => removeKrFromForm(i)}>X</button>
                </div>
              ))}
              <button type="button" className="btn btn--sm" onClick={addKrToForm}>+ 핵심 결과 추가</button>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setModalOpen(false)}>취소</button>
            <button type="submit" className="btn btn--primary">{editId ? '수정' : '등록'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!progressModal} onClose={() => setProgressModal(null)} title="진행 업데이트">
        {progressModal && (
          <form onSubmit={handleProgress} className="form">
            <p><strong>{progressModal.title}</strong> (목표: {progressModal.target_value} {progressModal.unit})</p>
            <label>현재값 <input type="number" step="any" required value={progressValue} onChange={e => setProgressValue(e.target.value)} /></label>
            <label>메모 <textarea value={progressNote} onChange={e => setProgressNote(e.target.value)} /></label>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setProgressModal(null)}>취소</button>
              <button type="submit" className="btn btn--primary">저장</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
