import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import Modal from '../components/common/Modal';
import { usePeriod } from '../context/PeriodContext';
import { getPeriods, createPeriod, updatePeriod, deletePeriod, getOrgLevels, createOrgLevel, updateOrgLevel, deleteOrgLevel } from '../api';

export default function SettingsPage() {
  const { refresh } = usePeriod();
  const [periods, setPeriods] = useState([]);
  const [levels, setLevels] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [levelModal, setLevelModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'quarterly', start_date: '', end_date: '', is_active: false });
  const [levelForm, setLevelForm] = useState({ name: '', depth: '', label: '' });
  const [levelEditId, setLevelEditId] = useState(null);

  const loadPeriods = () => getPeriods().then(setPeriods);
  const loadLevels = () => getOrgLevels().then(setLevels);
  useEffect(() => { loadPeriods(); loadLevels(); }, []);

  const openCreate = () => { setForm({ name: '', type: 'quarterly', start_date: '', end_date: '', is_active: false }); setEditId(null); setModalOpen(true); };
  const openEdit = (p) => { setForm({ name: p.name, type: p.type, start_date: p.start_date, end_date: p.end_date, is_active: !!p.is_active }); setEditId(p.id); setModalOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editId) await updatePeriod(editId, form);
    else await createPeriod(form);
    setModalOpen(false);
    loadPeriods();
    refresh();
  };

  const handleDelete = async (id) => {
    if (!confirm('기간을 삭제하시겠습니까?')) return;
    await deletePeriod(id);
    loadPeriods();
    refresh();
  };

  const handleSetActive = async (id) => {
    await updatePeriod(id, { is_active: true });
    loadPeriods();
    refresh();
  };

  // 조직 레벨
  const openLevelCreate = () => { setLevelForm({ name: '', depth: '', label: '' }); setLevelEditId(null); setLevelModal(true); };
  const openLevelEdit = (l) => { setLevelForm({ name: l.name, depth: l.depth, label: l.label }); setLevelEditId(l.id); setLevelModal(true); };

  const handleLevelSubmit = async (e) => {
    e.preventDefault();
    const data = { ...levelForm, depth: Number(levelForm.depth) };
    if (levelEditId) await updateOrgLevel(levelEditId, data);
    else await createOrgLevel(data);
    setLevelModal(false);
    loadLevels();
  };

  const handleLevelDelete = async (id) => {
    if (!confirm('조직 레벨을 삭제하시겠습니까?')) return;
    await deleteOrgLevel(id);
    loadLevels();
  };

  return (
    <div className="page">
      <Header title="설정" />
      <div className="settings-section">
        <div className="section-header">
          <h2>기간 관리</h2>
          <button className="btn btn--primary" onClick={openCreate}>+ 기간 추가</button>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>이름</th><th>유형</th><th>시작일</th><th>종료일</th><th>상태</th><th></th></tr>
            </thead>
            <tbody>
              {periods.map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.type === 'quarterly' ? '분기' : '월'}</td>
                  <td>{p.start_date}</td>
                  <td>{p.end_date}</td>
                  <td>{p.is_active ? <span className="badge badge--success">활성</span> : '-'}</td>
                  <td>
                    <div className="action-buttons">
                      {!p.is_active && <button className="btn btn--xs btn--primary" onClick={() => handleSetActive(p.id)}>활성화</button>}
                      <button className="btn btn--xs" onClick={() => openEdit(p)}>수정</button>
                      <button className="btn btn--xs btn--danger" onClick={() => handleDelete(p.id)}>삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="settings-section" style={{ marginTop: 32 }}>
        <div className="section-header">
          <h2>조직 레벨 관리</h2>
          <button className="btn btn--primary" onClick={openLevelCreate}>+ 레벨 추가</button>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>코드명</th><th>표시명</th><th>깊이(정렬순서)</th><th></th></tr>
            </thead>
            <tbody>
              {levels.map(l => (
                <tr key={l.id}>
                  <td>{l.name}</td>
                  <td>{l.label}</td>
                  <td>{l.depth}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn btn--xs" onClick={() => openLevelEdit(l)}>수정</button>
                      <button className="btn btn--xs btn--danger" onClick={() => handleLevelDelete(l.id)}>삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? '기간 수정' : '기간 추가'}>
        <form onSubmit={handleSubmit} className="form">
          <label>이름 <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="예: 2026 Q1" /></label>
          <label>유형 <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
            <option value="quarterly">분기</option>
            <option value="monthly">월</option>
          </select></label>
          <div className="form-row">
            <label>시작일 <input type="date" required value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} /></label>
            <label>종료일 <input type="date" required value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} /></label>
          </div>
          <label className="checkbox-label">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} />
            활성 기간으로 설정
          </label>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setModalOpen(false)}>취소</button>
            <button type="submit" className="btn btn--primary">{editId ? '수정' : '추가'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={levelModal} onClose={() => setLevelModal(false)} title={levelEditId ? '레벨 수정' : '레벨 추가'}>
        <form onSubmit={handleLevelSubmit} className="form">
          <label>코드명 <input required value={levelForm.name} onChange={e => setLevelForm({...levelForm, name: e.target.value})} placeholder="예: section" /></label>
          <label>표시명 <input required value={levelForm.label} onChange={e => setLevelForm({...levelForm, label: e.target.value})} placeholder="예: 부문" /></label>
          <label>깊이 (정렬순서) <input type="number" required value={levelForm.depth} onChange={e => setLevelForm({...levelForm, depth: e.target.value})} placeholder="예: 5" /></label>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setLevelModal(false)}>취소</button>
            <button type="submit" className="btn btn--primary">{levelEditId ? '수정' : '추가'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
