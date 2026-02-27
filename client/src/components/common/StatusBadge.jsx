const statusMap = {
  on_track: { label: '정상', className: 'badge--success' },
  at_risk: { label: '주의', className: 'badge--warning' },
  behind: { label: '지연', className: 'badge--danger' },
  completed: { label: '완료', className: 'badge--info' },
  draft: { label: '초안', className: '' },
  in_progress: { label: '작성중', className: 'badge--warning' },
  submitted: { label: '제출됨', className: 'badge--info' },
  approved: { label: '승인됨', className: 'badge--success' },
  open: { label: '진행중', className: 'badge--success' },
  in_review: { label: '검토중', className: 'badge--warning' },
  closed: { label: '마감', className: '' },
};

export default function StatusBadge({ status, labels }) {
  const info = statusMap[status] || { label: status, className: '' };
  const label = labels?.[status] || info.label;
  return <span className={`badge ${info.className}`}>{label}</span>;
}
