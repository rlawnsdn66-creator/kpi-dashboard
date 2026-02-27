import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import Modal from '../components/common/Modal';
import ProgressBar from '../components/common/ProgressBar';
import StatusBadge from '../components/common/StatusBadge';
import { usePeriod } from '../context/PeriodContext';
import { getOkrs, createOkr, updateOkr, deleteOkr, createKeyResult, deleteKeyResult, getOrgTree, getUsers, createProgress, getKpis } from '../api';

function flattenTree(nodes, depth = 0) {
  let result = [];
  for (const n of nodes) {
    result.push({ ...n, _depth: depth });
    if (n.children) result = result.concat(flattenTree(n.children, depth + 1));
  }
  return result;
}

export default function OkrPage() {
  const { selectedPeriod } = usePeriod();
  const [okrs, setOkrs] = useState([]);
  const [flatOrgs, setFlatOrgs] = useState([]);
  const [users, setUsers] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [filterOrg, setFilterOrg] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', organization_id: '', owner_id: '', key_results: [] });
  const [progressModal, setProgressModal] = useState(null);
  const [progressValue, setProgressValue] = useState('');
  const [progressNote, setProgressNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [addKrForm, setAddKrForm] = useState(null);

  const load = () => {
    if (!selectedPeriod) return;
    const params = { period_id: selectedPeriod.id };
    if (filterOrg) params.organization_id = filterOrg;
    getOkrs(params).then(setOkrs).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [selectedPeriod, filterOrg]);
  useEffect(() => {
    getOrgTree().then(t => setFlatOrgs(flattenTree(t)));
    getUsers().then(setUsers);
    getKpis().then(setKpis);
  }, []);

  const openCreate = () => {
    setForm({ title: '', description: '', organization_id: '', owner_id: '', key_results: [{ title: '', target_value: 100, unit: '%', weight: 1, kpi_id: '' }] });
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (okr) => {
    setForm({ title: okr.title, description: okr.description || '', organization_id: okr.organization_id || '', owner_id: okr.owner_id || '' });
    setEditId(okr.id);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { ...form, period_id: selectedPeriod.id, organization_id: form.organization_id ? Number(form.organization_id) : null, owner_id: form.owner_id ? Number(form.owner_id) : null };
    if (editId) {
      await updateOkr(editId, data);
    } else {
      data.key_results = form.key_results?.filter(kr => kr.title.trim()).map(kr => ({
        ...kr, kpi_id: kr.kpi_id ? Number(kr.kpi_id) : null
      }));
      await createOkr(data);
    }
    setModalOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await deleteOkr(id);
    load();
  };

  const handleDeleteKr = async (okrId, krId) => {
    if (!confirm('핵심 결과를 삭제하시겠습니까?')) return;
    await deleteKeyResult(okrId, krId);
    load();
  };

  const openAddKrForm = (okrId) => {
    setAddKrForm({ okrId, title: '', target_value: 100, unit: '%', weight: 1, kpi_id: '' });
  };

  const handleAddKr = async (e) => {
    e.preventDefault();
    if (!addKrForm.title.trim()) return;
    await createKeyResult(addKrForm.okrId, {
      title: addKrForm.title,
      target_value: Number(addKrForm.target_value) || 100,
      unit: addKrForm.unit || '%',
      weight: Number(addKrForm.weight) || 1,
      kpi_id: addKrForm.kpi_id ? Number(addKrForm.kpi_id) : null
    });
    setAddKrForm(null);
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

  const addKrToForm = () => setForm({ ...form, key_results: [...(form.key_results || []), { title: '', target_value: 100, unit: '%', weight: 1, kpi_id: '' }] });
  const updateKrInForm = (idx, field, val) => {
    const krs = [...form.key_results];
    krs[idx] = { ...krs[idx], [field]: val };
    setForm({ ...form, key_results: krs });
  };
  const removeKrFromForm = (idx) => setForm({ ...form, key_results: form.key_results.filter((_, i) => i !== idx) });

  if (loading) return <div className="page"><Header title="OKR 관리" /><div className="loading">로딩 중...</div></div>;

  return (
    <div className="page">
      <Header title="OKR 관리" />
      <div className="page-toolbar">
        <div className="filters">
          <select value={filterOrg} onChange={e => setFilterOrg(e.target.value)}>
            <option value="">전체 조직</option>
            {flatOrgs.map(o => <option key={o.id} value={o.id}>{'  '.repeat(o._depth)}{o.level_label ? `[${o.level_label}] ` : ''}{o.name}</option>)}
          </select>
        </div>
        <button className="btn btn--primary" onClick={openCreate}>+ OKR 등록</button>
      </div>

      {okrs.length === 0 ? (
        <div className="empty-state">등록된 OKR이 없습니다</div>
      ) : (
        <div className="okr-list">
          {okrs.map(okr => (
            <div key={okr.id} className="okr-card">
              <div className="okr-card__header">
                <div>
                  <h3 className="okr-card__title">{okr.title}</h3>
                  <div className="okr-card__meta">
                    <span>{okr.team_name}</span>
                    {okr.owner_name && <span> &middot; {okr.owner_name}</span>}
                  </div>
                </div>
                <div className="okr-card__header-right">
                  <StatusBadge status={okr.status} />
                  <div className="okr-card__progress-label">{Math.round(okr.progress)}%</div>
                </div>
              </div>
              <ProgressBar value={okr.progress} />
              {okr.description && <p className="okr-card__desc">{okr.description}</p>}

              <div className="kr-list">
                <h4>핵심 결과</h4>
                {okr.key_results.map(kr => (
                  <div key={kr.id} className="kr-item">
                    <div className="kr-item__info">
                      <span className="kr-item__title">
                        {kr.title}
                        {kr.kpi_name && <span className="kr-item__kpi-badge">KPI: {kr.kpi_name}</span>}
                      </span>
                      <span className="kr-item__value">{kr.current_value} / {kr.target_value} {kr.unit}</span>
                    </div>
                    <ProgressBar value={kr.current_value} max={kr.target_value} size="sm" />
                    <div className="kr-item__actions">
                      <button className="btn btn--sm btn--primary" onClick={() => { setProgressModal(kr); setProgressValue(kr.current_value); }}>업데이트</button>
                      <button className="btn btn--sm btn--danger" onClick={() => handleDeleteKr(okr.id, kr.id)}>삭제</button>
                    </div>
                  </div>
                ))}
                {addKrForm && addKrForm.okrId === okr.id ? (
                  <form onSubmit={handleAddKr} className="kr-add-form">
                    <input placeholder="제목" required value={addKrForm.title} onChange={e => setAddKrForm({...addKrForm, title: e.target.value})} />
                    <input type="number" placeholder="목표값" value={addKrForm.target_value} onChange={e => setAddKrForm({...addKrForm, target_value: e.target.value})} style={{width: 80}} />
                    <input placeholder="단위" value={addKrForm.unit} onChange={e => setAddKrForm({...addKrForm, unit: e.target.value})} style={{width: 60}} />
                    <select value={addKrForm.kpi_id} onChange={e => setAddKrForm({...addKrForm, kpi_id: e.target.value})}>
                      <option value="">KPI 연결 (선택)</option>
                      {kpis.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                    </select>
                    <button type="submit" className="btn btn--sm btn--primary">추가</button>
                    <button type="button" className="btn btn--sm" onClick={() => setAddKrForm(null)}>취소</button>
                  </form>
                ) : (
                  <button className="btn btn--sm" onClick={() => openAddKrForm(okr.id)}>+ 핵심 결과 추가</button>
                )}
              </div>

              <div className="okr-card__actions">
                <button className="btn btn--sm" onClick={() => openEdit(okr)}>수정</button>
                <button className="btn btn--sm btn--danger" onClick={() => handleDelete(okr.id)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'OKR 수정' : 'OKR 등록'}>
        <form onSubmit={handleSubmit} className="form">
          <label>목표 제목 <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></label>
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
                  <select value={kr.kpi_id || ''} onChange={e => updateKrInForm(i, 'kpi_id', e.target.value)}>
                    <option value="">KPI 연결 (선택)</option>
                    {kpis.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
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
