import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import Modal from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';
import { usePeriod } from '../context/PeriodContext';
import { getReviewCycles, createReviewCycle, updateReviewCycle, deleteReviewCycle, getReviews, createReview, deleteReview, getUsers, autoPopulateReview } from '../api';
import { REVIEW_STATUS_LABELS, CYCLE_STATUS_LABELS } from '../constants/labels';

export default function ReviewPage() {
  const { selectedPeriod } = usePeriod();
  const navigate = useNavigate();
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [users, setUsers] = useState([]);
  const [cycleModal, setCycleModal] = useState(false);
  const [reviewModal, setReviewModal] = useState(false);
  const [cycleForm, setCycleForm] = useState({ name: '', status: 'draft', start_date: '', end_date: '' });
  const [reviewForm, setReviewForm] = useState({ reviewee_id: '', reviewer_id: '' });
  const [editCycleId, setEditCycleId] = useState(null);

  const loadCycles = () => {
    if (!selectedPeriod) return;
    getReviewCycles({ period_id: selectedPeriod.id }).then(setCycles);
  };

  const loadReviews = (cycleId) => {
    getReviews({ cycle_id: cycleId }).then(setReviews);
  };

  useEffect(() => { loadCycles(); }, [selectedPeriod]);
  useEffect(() => { getUsers().then(setUsers); }, []);
  useEffect(() => { if (selectedCycle) loadReviews(selectedCycle.id); }, [selectedCycle]);

  // 사이클 CRUD
  const openCycleCreate = () => {
    setCycleForm({ name: '', status: 'draft', start_date: '', end_date: '' });
    setEditCycleId(null);
    setCycleModal(true);
  };
  const openCycleEdit = (c) => {
    setCycleForm({ name: c.name, status: c.status, start_date: c.start_date || '', end_date: c.end_date || '' });
    setEditCycleId(c.id);
    setCycleModal(true);
  };
  const handleCycleSubmit = async (e) => {
    e.preventDefault();
    if (editCycleId) await updateReviewCycle(editCycleId, cycleForm);
    else await createReviewCycle({ ...cycleForm, period_id: selectedPeriod.id });
    setCycleModal(false);
    loadCycles();
  };
  const handleCycleDelete = async (id) => {
    if (!confirm('리뷰 사이클을 삭제하시겠습니까?')) return;
    await deleteReviewCycle(id);
    if (selectedCycle?.id === id) { setSelectedCycle(null); setReviews([]); }
    loadCycles();
  };

  // 리뷰 생성
  const openReviewCreate = () => {
    setReviewForm({ reviewee_id: '', reviewer_id: '' });
    setReviewModal(true);
  };
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    const review = await createReview({
      cycle_id: selectedCycle.id,
      reviewee_id: Number(reviewForm.reviewee_id),
      reviewer_id: reviewForm.reviewer_id ? Number(reviewForm.reviewer_id) : null,
    });
    // 자동 항목 로드
    await autoPopulateReview(review.id);
    setReviewModal(false);
    loadReviews(selectedCycle.id);
  };
  const handleReviewDelete = async (id) => {
    if (!confirm('리뷰를 삭제하시겠습니까?')) return;
    await deleteReview(id);
    loadReviews(selectedCycle.id);
  };

  return (
    <div className="page">
      <Header title="평가 관리" />
      <div className="team-layout">
        <div className="team-panel">
          <div className="panel-header">
            <h3>리뷰 사이클</h3>
            <button className="btn btn--sm btn--primary" onClick={openCycleCreate}>+ 추가</button>
          </div>
          <div className="panel-list">
            {cycles.map(c => (
              <div key={c.id} className={`panel-item ${selectedCycle?.id === c.id ? 'active' : ''}`} onClick={() => setSelectedCycle(c)}>
                <div>
                  <div>{c.name}</div>
                  <small style={{ color: '#888' }}>{CYCLE_STATUS_LABELS[c.status] || c.status}</small>
                </div>
                <div className="panel-item__actions">
                  <button className="btn btn--xs" onClick={e => { e.stopPropagation(); openCycleEdit(c); }}>수정</button>
                  <button className="btn btn--xs btn--danger" onClick={e => { e.stopPropagation(); handleCycleDelete(c.id); }}>삭제</button>
                </div>
              </div>
            ))}
            {cycles.length === 0 && <div className="empty-state">리뷰 사이클이 없습니다</div>}
          </div>
        </div>

        <div className="team-panel team-panel--wide">
          {selectedCycle ? (
            <>
              <div className="panel-header">
                <h3>{selectedCycle.name} - 리뷰 목록</h3>
                <button className="btn btn--sm btn--primary" onClick={openReviewCreate}>+ 리뷰 추가</button>
              </div>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr><th>피평가자</th><th>평가자</th><th>종합점수</th><th>상태</th><th></th></tr>
                  </thead>
                  <tbody>
                    {reviews.map(r => (
                      <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/review/${r.id}`)}>
                        <td>{r.reviewee_name}</td>
                        <td>{r.reviewer_name || '-'}</td>
                        <td>{r.overall_score != null ? r.overall_score.toFixed(1) : '-'}</td>
                        <td><StatusBadge status={r.status} labels={REVIEW_STATUS_LABELS} /></td>
                        <td>
                          <div className="action-buttons">
                            <button className="btn btn--xs btn--primary" onClick={e => { e.stopPropagation(); navigate(`/review/${r.id}`); }}>상세</button>
                            <button className="btn btn--xs btn--danger" onClick={e => { e.stopPropagation(); handleReviewDelete(r.id); }}>삭제</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {reviews.length === 0 && <tr><td colSpan={5} className="empty-state">리뷰가 없습니다</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          ) : <div className="empty-state">리뷰 사이클을 선택하세요</div>}
        </div>
      </div>

      <Modal isOpen={cycleModal} onClose={() => setCycleModal(false)} title={editCycleId ? '사이클 수정' : '사이클 추가'}>
        <form onSubmit={handleCycleSubmit} className="form">
          <label>이름 <input required value={cycleForm.name} onChange={e => setCycleForm({...cycleForm, name: e.target.value})} /></label>
          <label>상태 <select value={cycleForm.status} onChange={e => setCycleForm({...cycleForm, status: e.target.value})}>
            <option value="draft">초안</option>
            <option value="open">진행중</option>
            <option value="in_review">검토중</option>
            <option value="closed">마감</option>
          </select></label>
          <div className="form-row">
            <label>시작일 <input type="date" value={cycleForm.start_date} onChange={e => setCycleForm({...cycleForm, start_date: e.target.value})} /></label>
            <label>종료일 <input type="date" value={cycleForm.end_date} onChange={e => setCycleForm({...cycleForm, end_date: e.target.value})} /></label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setCycleModal(false)}>취소</button>
            <button type="submit" className="btn btn--primary">{editCycleId ? '수정' : '추가'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={reviewModal} onClose={() => setReviewModal(false)} title="리뷰 추가">
        <form onSubmit={handleReviewSubmit} className="form">
          <label>피평가자 <select required value={reviewForm.reviewee_id} onChange={e => setReviewForm({...reviewForm, reviewee_id: e.target.value})}>
            <option value="">선택</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.team_name || '-'})</option>)}
          </select></label>
          <label>평가자 <select value={reviewForm.reviewer_id} onChange={e => setReviewForm({...reviewForm, reviewer_id: e.target.value})}>
            <option value="">선택</option>
            {users.filter(u => u.role === 'manager' || u.role === 'admin').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select></label>
          <p style={{ fontSize: '0.85em', color: '#666' }}>리뷰 생성 시 피평가자의 KPI/OKR이 자동으로 항목에 추가됩니다.</p>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setReviewModal(false)}>취소</button>
            <button type="submit" className="btn btn--primary">추가</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
