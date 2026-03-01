import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import Modal from '../components/common/Modal';
import ProgressBar from '../components/common/ProgressBar';
import StatusBadge from '../components/common/StatusBadge';
import CircleProgress from '../components/common/CircleProgress';
import { usePeriod } from '../context/PeriodContext';
import { getOkrs, createOkr, updateOkr, deleteOkr, createKeyResult, deleteKeyResult, getOrgTree, getUsers, createProgress, getKpis, bulkSetOkrMilestones, updateOkrMilestone } from '../api';

const MILESTONE_LABELS = ['6월', '10월', '12월'];

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
  const [form, setForm] = useState({ kpi_id: '', title: '', description: '', organization_id: '', owner_id: '', key_results: [] });
  const [progressModal, setProgressModal] = useState(null);
  const [progressValue, setProgressValue] = useState('');
  const [progressNote, setProgressNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [addKrForm, setAddKrForm] = useState(null);
  const [expandedOkrs, setExpandedOkrs] = useState({});

  // OKR progress update
  const [okrProgressModal, setOkrProgressModal] = useState(null); // { id, title, progress, status }
  const [okrProgressValue, setOkrProgressValue] = useState('');
  const [okrStatusValue, setOkrStatusValue] = useState('');

  // Milestone editing
  const [msModal, setMsModal] = useState(null); // { okrId, milestones: [{period_label, target_value, current_value}] }

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
  }, []);
  useEffect(() => {
    if (selectedPeriod) {
      getKpis({ period_id: selectedPeriod.id }).then(setKpis);
    }
  }, [selectedPeriod]);

  const toggleOkr = (id) => setExpandedOkrs(prev => ({ ...prev, [id]: !prev[id] }));

  const openCreate = () => {
    setForm({ kpi_id: '', title: '', description: '', organization_id: '', owner_id: '', key_results: [{ title: '', target_value: 100, unit: '%', weight: 1 }] });
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (okr) => {
    setForm({ kpi_id: okr.kpi_id || '', title: okr.title, description: okr.description || '', organization_id: okr.organization_id || '', owner_id: okr.owner_id || '' });
    setEditId(okr.id);
    setModalOpen(true);
  };

  const handleKpiChange = (kpiId) => {
    const kpi = kpis.find(k => k.id === Number(kpiId));
    if (kpi) {
      setForm(f => ({ ...f, kpi_id: kpiId, organization_id: kpi.organization_id || f.organization_id, owner_id: kpi.owner_id || f.owner_id }));
    } else {
      setForm(f => ({ ...f, kpi_id: kpiId }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      ...form,
      period_id: selectedPeriod.id,
      kpi_id: form.kpi_id ? Number(form.kpi_id) : null,
      organization_id: form.organization_id ? Number(form.organization_id) : null,
      owner_id: form.owner_id ? Number(form.owner_id) : null
    };
    if (editId) {
      await updateOkr(editId, data);
    } else {
      data.key_results = form.key_results?.filter(kr => kr.title.trim()).map(kr => ({
        title: kr.title, target_value: kr.target_value, unit: kr.unit, weight: kr.weight
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
    setAddKrForm({ okrId, title: '', target_value: 100, unit: '%', weight: 1 });
  };

  const handleAddKr = async (e) => {
    e.preventDefault();
    if (!addKrForm.title.trim()) return;
    await createKeyResult(addKrForm.okrId, {
      title: addKrForm.title,
      target_value: Number(addKrForm.target_value) || 100,
      unit: addKrForm.unit || '%',
      weight: Number(addKrForm.weight) || 1
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

  const addKrToForm = () => setForm({ ...form, key_results: [...(form.key_results || []), { title: '', target_value: 100, unit: '%', weight: 1 }] });
  const updateKrInForm = (idx, field, val) => {
    const krs = [...form.key_results];
    krs[idx] = { ...krs[idx], [field]: val };
    setForm({ ...form, key_results: krs });
  };
  const removeKrFromForm = (idx) => setForm({ ...form, key_results: form.key_results.filter((_, i) => i !== idx) });

  // OKR progress helpers
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

  // Milestone helpers
  const openMsModal = (okr) => {
    const existing = okr.milestones || [];
    const msData = MILESTONE_LABELS.map((label, i) => {
      const found = existing.find(m => m.period_label === label);
      return {
        period_label: label,
        sort_order: i,
        target_value: found ? found.target_value : 0,
        current_value: found ? found.current_value : 0
      };
    });
    setMsModal({ okrId: okr.id, okrTitle: okr.title, milestones: msData });
  };

  const updateMsRow = (idx, field, val) => {
    const ms = [...msModal.milestones];
    ms[idx] = { ...ms[idx], [field]: Number(val) || 0 };
    setMsModal({ ...msModal, milestones: ms });
  };

  const saveMilestones = async (e) => {
    e.preventDefault();
    await bulkSetOkrMilestones(msModal.okrId, msModal.milestones);
    setMsModal(null);
    load();
  };

  const getMilestone = (okr, label) => (okr.milestones || []).find(m => m.period_label === label);

  // Inline milestone cell edit
  const [editingMs, setEditingMs] = useState(null); // { okrId, msId, field, value }
  const startMsEdit = (okrId, ms, field) => {
    setEditingMs({ okrId, msId: ms.id, field, value: String(ms[field] || 0) });
  };
  const saveMsEdit = async () => {
    if (!editingMs) return;
    await updateOkrMilestone(editingMs.okrId, editingMs.msId, { [editingMs.field]: Number(editingMs.value) || 0 });
    setEditingMs(null);
    load();
  };
  const handleMsKeyDown = (e) => {
    if (e.key === 'Enter') saveMsEdit();
    if (e.key === 'Escape') setEditingMs(null);
  };

  // KPI별 그룹화
  const groupedByKpi = okrs.reduce((acc, okr) => {
    const key = okr.kpi_id || 0;
    if (!acc[key]) {
      const kpi = kpis.find(k => k.id === key);
      acc[key] = { kpi_name: okr.kpi_name || '미분류', kpi_id: key, kpi_progress: kpi ? kpi.progress : 0, okrs: [] };
    }
    acc[key].okrs.push(okr);
    return acc;
  }, {});
  const kpiGroups = Object.values(groupedByKpi);

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
        <div className="kpi-cascade">
          {kpiGroups.map(group => (
            <div key={group.kpi_id} className="cascade-kpi-group">
              <div className="cascade-kpi-group__header">
                <CircleProgress value={group.kpi_progress} size={40} strokeWidth={4} />
                <div className="cascade-kpi-group__info">
                  <h3 className="cascade-kpi-group__name">{group.kpi_name}</h3>
                  <span className="cascade-kpi-group__count">OKR {group.okrs.length}개</span>
                </div>
              </div>

              {group.okrs.map(okr => {
                const isExpanded = expandedOkrs[okr.id] !== false;
                const hasMilestones = (okr.milestones || []).length > 0;
                return (
                  <div key={okr.id} className="cascade-okr">
                    <div className="cascade-okr__header" onClick={() => toggleOkr(okr.id)}>
                      <div className="cascade-okr__left">
                        <div className="cascade-okr__circle" onClick={e => { e.stopPropagation(); openOkrProgress(okr); }} title="클릭하여 진행률 업데이트">
                          <CircleProgress value={okr.progress} size={44} strokeWidth={4} />
                        </div>
                        <div className="cascade-okr__info">
                          <div className="cascade-okr__title-row">
                            <span className="cascade-kpi__expand">{isExpanded ? '▾' : '▸'}</span>
                            <span className="cascade-okr__name">{okr.title}</span>
                            <StatusBadge status={okr.status} />
                          </div>
                          <div className="cascade-okr__meta">
                            <span>{okr.team_name}</span>
                            {okr.owner_name && <span> · {okr.owner_name}</span>}
                            {okr.key_results.length > 0 && <span> · KR {okr.key_results.length}개</span>}
                          </div>
                        </div>
                      </div>
                      <div className="cascade-okr__actions" onClick={e => e.stopPropagation()}>
                        <button className="btn btn--xs btn--primary" onClick={() => openOkrProgress(okr)}>진행률</button>
                        <button className="btn btn--xs" onClick={() => openMsModal(okr)}>목표설정</button>
                        <button className="btn btn--xs" onClick={() => openEdit(okr)}>수정</button>
                        <button className="btn btn--xs btn--danger" onClick={() => handleDelete(okr.id)}>삭제</button>
                      </div>
                    </div>

                    {/* Milestone bar (always visible if milestones exist) */}
                    {hasMilestones && (
                      <div className="ms-bar">
                        {MILESTONE_LABELS.map(label => {
                          const ms = getMilestone(okr, label);
                          if (!ms) return null;
                          const pct = ms.target_value > 0 ? Math.min(Math.round((ms.current_value / ms.target_value) * 100), 100) : 0;
                          const color = pct >= 80 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-danger)';
                          return (
                            <div key={label} className="ms-bar__item">
                              <div className="ms-bar__label">{label}</div>
                              <div className="ms-bar__track">
                                <div className="ms-bar__fill" style={{ width: `${pct}%`, backgroundColor: color }} />
                              </div>
                              <div className="ms-bar__values">
                                <span
                                  className="ms-bar__current"
                                  onClick={() => startMsEdit(okr.id, ms, 'current_value')}
                                  title="클릭하여 실적 입력"
                                >
                                  {editingMs && editingMs.msId === ms.id && editingMs.field === 'current_value' ? (
                                    <input
                                      type="number" step="any" className="ms-bar__input"
                                      value={editingMs.value}
                                      onChange={e => setEditingMs({ ...editingMs, value: e.target.value })}
                                      onBlur={saveMsEdit} onKeyDown={handleMsKeyDown}
                                      autoFocus onClick={e => e.stopPropagation()}
                                    />
                                  ) : (
                                    <>{ms.current_value}</>
                                  )}
                                </span>
                                <span className="ms-bar__sep">/</span>
                                <span className="ms-bar__target">{ms.target_value}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {isExpanded && (
                      <div className="cascade-krs">
                        {okr.key_results.map(kr => (
                          <div key={kr.id} className="cascade-kr">
                            <div className="cascade-kr__info">
                              <span className="cascade-kr__title">{kr.title}</span>
                              <span className="cascade-kr__value">{kr.current_value} / {kr.target_value} {kr.unit}</span>
                            </div>
                            <ProgressBar value={kr.current_value} max={kr.target_value} size="sm" />
                            <div className="cascade-kr__actions">
                              <button className="btn btn--xs btn--primary" onClick={() => { setProgressModal(kr); setProgressValue(kr.current_value); }}>업데이트</button>
                              <button className="btn btn--xs btn--danger" onClick={() => handleDeleteKr(okr.id, kr.id)}>삭제</button>
                            </div>
                          </div>
                        ))}
                        {addKrForm && addKrForm.okrId === okr.id ? (
                          <form onSubmit={handleAddKr} className="cascade-kr-add">
                            <input placeholder="제목" required value={addKrForm.title} onChange={e => setAddKrForm({...addKrForm, title: e.target.value})} />
                            <input type="number" placeholder="목표값" value={addKrForm.target_value} onChange={e => setAddKrForm({...addKrForm, target_value: e.target.value})} style={{width: 80}} />
                            <input placeholder="단위" value={addKrForm.unit} onChange={e => setAddKrForm({...addKrForm, unit: e.target.value})} style={{width: 60}} />
                            <button type="submit" className="btn btn--xs btn--primary">추가</button>
                            <button type="button" className="btn btn--xs" onClick={() => setAddKrForm(null)}>취소</button>
                          </form>
                        ) : (
                          <button className="btn btn--xs" onClick={() => openAddKrForm(okr.id)}>+ 핵심 결과 추가</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* OKR 등록/수정 모달 */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'OKR 수정' : 'OKR 등록'}>
        <form onSubmit={handleSubmit} className="form">
          <label>KPI <select required value={form.kpi_id} onChange={e => handleKpiChange(e.target.value)}>
            <option value="">KPI 선택 (필수)</option>
            {kpis.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select></label>
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

      {/* 마일스톤 설정 모달 */}
      <Modal isOpen={!!msModal} onClose={() => setMsModal(null)} title="기간별 목표 설정">
        {msModal && (
          <form onSubmit={saveMilestones} className="form">
            <p style={{ fontWeight: 600 }}>{msModal.okrTitle}</p>
            <table className="ms-setup-table">
              <thead>
                <tr><th>기간</th><th>목표</th><th>실적</th></tr>
              </thead>
              <tbody>
                {msModal.milestones.map((m, i) => (
                  <tr key={i}>
                    <td className="ms-setup-table__label">{m.period_label}</td>
                    <td><input type="number" step="any" value={m.target_value} onChange={e => updateMsRow(i, 'target_value', e.target.value)} /></td>
                    <td><input type="number" step="any" value={m.current_value} onChange={e => updateMsRow(i, 'current_value', e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setMsModal(null)}>취소</button>
              <button type="submit" className="btn btn--primary">저장</button>
            </div>
          </form>
        )}
      </Modal>

      {/* OKR 진행률 업데이트 모달 */}
      <Modal isOpen={!!okrProgressModal} onClose={() => setOkrProgressModal(null)} title="OKR 진행률 업데이트">
        {okrProgressModal && (
          <form onSubmit={handleOkrProgressSubmit} className="form">
            <p style={{ fontWeight: 600 }}>{okrProgressModal.title}</p>
            <label>진행률 (%)
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="range" min="0" max="100" step="1" value={okrProgressValue} onChange={e => setOkrProgressValue(e.target.value)} style={{ flex: 1 }} />
                <input type="number" min="0" max="100" step="1" value={okrProgressValue} onChange={e => setOkrProgressValue(e.target.value)} style={{ width: 70, textAlign: 'center' }} />
              </div>
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

      {/* KR 진행 업데이트 모달 */}
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
