import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import ProgressBar from '../components/common/ProgressBar';
import { getReview, updateReview, updateReviewItem, autoPopulateReview } from '../api';
import { REVIEW_STATUS_LABELS } from '../constants/labels';

export default function ReviewDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [overallComment, setOverallComment] = useState('');

  const load = () => {
    getReview(id).then(r => {
      setReview(r);
      setOverallComment(r.overall_comment || '');
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [id]);

  const handleScoreChange = async (itemId, score) => {
    await updateReviewItem(id, itemId, { score: Number(score) });
    load();
  };

  const handleCommentChange = async (itemId, comment) => {
    await updateReviewItem(id, itemId, { comment });
  };

  const calculateOverallScore = () => {
    if (!review?.items?.length) return null;
    const scored = review.items.filter(i => i.score != null);
    if (scored.length === 0) return null;
    const totalWeight = scored.reduce((s, i) => s + (i.weight || 1), 0);
    const weightedSum = scored.reduce((s, i) => s + i.score * (i.weight || 1), 0);
    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null;
  };

  const handleSubmit = async () => {
    const score = calculateOverallScore();
    await updateReview(id, {
      overall_score: score,
      overall_comment: overallComment || null,
      status: 'submitted',
    });
    load();
  };

  const handleApprove = async () => {
    await updateReview(id, { status: 'approved' });
    load();
  };

  const handleSave = async () => {
    const score = calculateOverallScore();
    await updateReview(id, {
      overall_score: score,
      overall_comment: overallComment || null,
      status: 'in_progress',
    });
    load();
  };

  const handleAutoPopulate = async () => {
    await autoPopulateReview(id);
    load();
  };

  if (loading) return <div className="page"><Header title="리뷰 상세" /><div className="loading">로딩 중...</div></div>;
  if (!review) return <div className="page"><Header title="리뷰 상세" /><div className="empty-state">리뷰를 찾을 수 없습니다</div></div>;

  const kpiItems = review.items?.filter(i => i.item_type === 'kpi') || [];
  const okrItems = review.items?.filter(i => i.item_type === 'okr') || [];
  const isEditable = review.status === 'draft' || review.status === 'in_progress';

  return (
    <div className="page">
      <Header title="리뷰 상세" />
      <div style={{ marginBottom: 16 }}>
        <button className="btn btn--sm" onClick={() => navigate('/review')}>← 목록으로</button>
      </div>

      <div className="chart-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>피평가자: {review.reviewee_name}</h3>
            <p style={{ color: '#666' }}>
              평가자: {review.reviewer_name || '미지정'} | 상태: {REVIEW_STATUS_LABELS[review.status] || review.status}
              {review.overall_score != null && ` | 종합점수: ${review.overall_score.toFixed(1)}`}
            </p>
          </div>
          <div className="action-buttons">
            {isEditable && <button className="btn btn--sm" onClick={handleAutoPopulate}>항목 새로고침</button>}
            {isEditable && <button className="btn btn--sm btn--primary" onClick={handleSave}>저장</button>}
            {isEditable && <button className="btn btn--sm btn--primary" onClick={handleSubmit}>제출</button>}
            {review.status === 'submitted' && <button className="btn btn--sm btn--primary" onClick={handleApprove}>승인</button>}
          </div>
        </div>
      </div>

      {kpiItems.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <h3>KPI 항목</h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>KPI</th><th>달성률</th><th>점수 (1-5)</th><th>코멘트</th></tr>
              </thead>
              <tbody>
                {kpiItems.map(item => (
                  <tr key={item.id}>
                    <td>{item.item_name || `KPI #${item.item_id}`}</td>
                    <td>
                      <ProgressBar value={Math.min(Math.round(item.achievement || 0), 100)} size="sm" />
                    </td>
                    <td>
                      {isEditable ? (
                        <input type="number" min="1" max="5" step="0.1" value={item.score || ''} onChange={e => handleScoreChange(item.id, e.target.value)} style={{ width: 70 }} />
                      ) : (item.score != null ? item.score.toFixed(1) : '-')}
                    </td>
                    <td>
                      {isEditable ? (
                        <input value={item.comment || ''} onChange={e => handleCommentChange(item.id, e.target.value)} placeholder="코멘트" style={{ width: '100%' }} />
                      ) : (item.comment || '-')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {okrItems.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <h3>OKR 항목</h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>OKR</th><th>진행률</th><th>점수 (1-5)</th><th>코멘트</th></tr>
              </thead>
              <tbody>
                {okrItems.map(item => (
                  <tr key={item.id}>
                    <td>{item.item_name || `OKR #${item.item_id}`}</td>
                    <td>
                      <ProgressBar value={Math.min(Math.round(item.achievement || 0), 100)} size="sm" />
                    </td>
                    <td>
                      {isEditable ? (
                        <input type="number" min="1" max="5" step="0.1" value={item.score || ''} onChange={e => handleScoreChange(item.id, e.target.value)} style={{ width: 70 }} />
                      ) : (item.score != null ? item.score.toFixed(1) : '-')}
                    </td>
                    <td>
                      {isEditable ? (
                        <input value={item.comment || ''} onChange={e => handleCommentChange(item.id, e.target.value)} placeholder="코멘트" style={{ width: '100%' }} />
                      ) : (item.comment || '-')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(kpiItems.length === 0 && okrItems.length === 0) && (
        <div className="chart-card">
          <div className="empty-state">
            평가 항목이 없습니다.
            {isEditable && <button className="btn btn--sm btn--primary" style={{ marginLeft: 8 }} onClick={handleAutoPopulate}>자동 로드</button>}
          </div>
        </div>
      )}

      <div className="chart-card">
        <h3>종합 평가</h3>
        <label style={{ display: 'block', marginTop: 8 }}>
          종합 코멘트
          {isEditable ? (
            <textarea value={overallComment} onChange={e => setOverallComment(e.target.value)} style={{ width: '100%', minHeight: 80, marginTop: 4 }} />
          ) : (
            <p style={{ whiteSpace: 'pre-wrap', color: '#333' }}>{overallComment || '없음'}</p>
          )}
        </label>
        {review.overall_score != null && (
          <p style={{ marginTop: 8, fontSize: '1.2em' }}>
            종합 점수: <strong>{review.overall_score.toFixed(1)}</strong> / 5.0
          </p>
        )}
      </div>
    </div>
  );
}
