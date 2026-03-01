import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// 조직
export const getOrganizations = (params) => api.get('/organizations', { params }).then(r => r.data);
export const getOrgTree = () => api.get('/organizations/tree').then(r => r.data);
export const getOrganization = (id) => api.get(`/organizations/${id}`).then(r => r.data);
export const getOrgDescendants = (id) => api.get(`/organizations/${id}/descendants`).then(r => r.data);
export const createOrganization = (data) => api.post('/organizations', data).then(r => r.data);
export const updateOrganization = (id, data) => api.put(`/organizations/${id}`, data).then(r => r.data);
export const deleteOrganization = (id) => api.delete(`/organizations/${id}`).then(r => r.data);

// 조직 레벨
export const getOrgLevels = () => api.get('/org-levels').then(r => r.data);
export const createOrgLevel = (data) => api.post('/org-levels', data).then(r => r.data);
export const updateOrgLevel = (id, data) => api.put(`/org-levels/${id}`, data).then(r => r.data);
export const deleteOrgLevel = (id) => api.delete(`/org-levels/${id}`).then(r => r.data);

// 하위 호환
export const getDepartments = () => api.get('/organizations', { params: { parent_id: 'null' } }).then(r => r.data);
export const getTeams = (params) => api.get('/organizations', { params }).then(r => r.data);

// 사용자
export const getUsers = (params) => api.get('/users', { params }).then(r => r.data);
export const createUser = (data) => api.post('/users', data).then(r => r.data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data).then(r => r.data);
export const deleteUser = (id) => api.delete(`/users/${id}`).then(r => r.data);

// 기간
export const getPeriods = (params) => api.get('/periods', { params }).then(r => r.data);
export const createPeriod = (data) => api.post('/periods', data).then(r => r.data);
export const updatePeriod = (id, data) => api.put(`/periods/${id}`, data).then(r => r.data);
export const deletePeriod = (id) => api.delete(`/periods/${id}`).then(r => r.data);

// Objective
export const getObjectives = (params) => api.get('/objectives', { params }).then(r => r.data);
export const createObjective = (data) => api.post('/objectives', data).then(r => r.data);
export const updateObjective = (id, data) => api.put(`/objectives/${id}`, data).then(r => r.data);
export const deleteObjective = (id) => api.delete(`/objectives/${id}`).then(r => r.data);

// KPI
export const getKpis = (params) => api.get('/kpis', { params }).then(r => r.data);
export const getKpi = (id) => api.get(`/kpis/${id}`).then(r => r.data);
export const createKpi = (data) => api.post('/kpis', data).then(r => r.data);
export const updateKpi = (id, data) => api.put(`/kpis/${id}`, data).then(r => r.data);
export const deleteKpi = (id) => api.delete(`/kpis/${id}`).then(r => r.data);
export const importFromPeriod = (data) => api.post('/kpis/import-from-period', data).then(r => r.data);

// OKR
export const getOkrs = (params) => api.get('/okrs', { params }).then(r => r.data);
export const getOkr = (id) => api.get(`/okrs/${id}`).then(r => r.data);
export const createOkr = (data) => api.post('/okrs', data).then(r => r.data);
export const updateOkr = (id, data) => api.put(`/okrs/${id}`, data).then(r => r.data);
export const deleteOkr = (id) => api.delete(`/okrs/${id}`).then(r => r.data);

// Key Results (OKR)
export const createKeyResult = (okrId, data) => api.post(`/okrs/${okrId}/key-results`, data).then(r => r.data);
export const updateKeyResult = (okrId, krId, data) => api.put(`/okrs/${okrId}/key-results/${krId}`, data).then(r => r.data);
export const deleteKeyResult = (okrId, krId) => api.delete(`/okrs/${okrId}/key-results/${krId}`).then(r => r.data);

// OKR Milestones
export const bulkSetOkrMilestones = (okrId, milestones) => api.post(`/okrs/${okrId}/milestones`, { milestones }).then(r => r.data);
export const updateOkrMilestone = (okrId, msId, data) => api.put(`/okrs/${okrId}/milestones/${msId}`, data).then(r => r.data);

// Key Results (KPI)
export const createKpiKeyResult = (kpiId, data) => api.post(`/kpis/${kpiId}/key-results`, data).then(r => r.data);
export const updateKpiKeyResult = (kpiId, krId, data) => api.put(`/kpis/${kpiId}/key-results/${krId}`, data).then(r => r.data);
export const deleteKpiKeyResult = (kpiId, krId) => api.delete(`/kpis/${kpiId}/key-results/${krId}`).then(r => r.data);

// 마일스톤
export const getMilestones = (params) => api.get('/milestones', { params }).then(r => r.data);
export const createMilestone = (data) => api.post('/milestones', data).then(r => r.data);
export const updateMilestone = (id, data) => api.put(`/milestones/${id}`, data).then(r => r.data);
export const deleteMilestone = (id) => api.delete(`/milestones/${id}`).then(r => r.data);
export const bulkSetMilestones = (data) => api.post('/milestones/bulk', data).then(r => r.data);

// 진행 기록
export const getProgress = (params) => api.get('/progress', { params }).then(r => r.data);
export const createProgress = (data) => api.post('/progress', data).then(r => r.data);

// 대시보드
export const getDashboardSummary = (params) => api.get('/dashboard/summary', { params }).then(r => r.data);
export const getKpiTrends = (params) => api.get('/dashboard/kpi-trends', { params }).then(r => r.data);
export const getOkrProgress = (params) => api.get('/dashboard/okr-progress', { params }).then(r => r.data);
export const getTeamSummary = (params) => api.get('/dashboard/team-summary', { params }).then(r => r.data);
export const getOrgSummary = (params) => api.get('/dashboard/org-summary', { params }).then(r => r.data);

// 리뷰 사이클
export const getReviewCycles = (params) => api.get('/reviews/cycles', { params }).then(r => r.data);
export const getReviewCycle = (id) => api.get(`/reviews/cycles/${id}`).then(r => r.data);
export const createReviewCycle = (data) => api.post('/reviews/cycles', data).then(r => r.data);
export const updateReviewCycle = (id, data) => api.put(`/reviews/cycles/${id}`, data).then(r => r.data);
export const deleteReviewCycle = (id) => api.delete(`/reviews/cycles/${id}`).then(r => r.data);

// 리뷰
export const getReviews = (params) => api.get('/reviews', { params }).then(r => r.data);
export const getReview = (id) => api.get(`/reviews/${id}`).then(r => r.data);
export const createReview = (data) => api.post('/reviews', data).then(r => r.data);
export const updateReview = (id, data) => api.put(`/reviews/${id}`, data).then(r => r.data);
export const deleteReview = (id) => api.delete(`/reviews/${id}`).then(r => r.data);
export const autoPopulateReview = (id) => api.post(`/reviews/${id}/auto-populate`).then(r => r.data);

// 리뷰 항목
export const updateReviewItem = (reviewId, itemId, data) => api.put(`/reviews/${reviewId}/items/${itemId}`, data).then(r => r.data);
export const createReviewItem = (reviewId, data) => api.post(`/reviews/${reviewId}/items`, data).then(r => r.data);
export const deleteReviewItem = (reviewId, itemId) => api.delete(`/reviews/${reviewId}/items/${itemId}`).then(r => r.data);
