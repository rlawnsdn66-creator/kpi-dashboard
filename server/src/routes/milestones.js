const { Router } = require('express');
const { getDb } = require('../db/connection');
const { recalcOkrProgress } = require('./okrs');
const { recalcKpiProgress } = require('./kpis');

const router = Router();

function syncKrFromMilestones(db, keyResultId) {
  const milestones = db.prepare(
    'SELECT * FROM kr_milestones WHERE key_result_id = ? ORDER BY sort_order DESC'
  ).all(keyResultId);

  if (milestones.length === 0) return;

  // target_value = 마지막(최종) 마일스톤의 target_value
  const lastMilestone = milestones[0]; // sort_order DESC이므로 첫 번째가 최종
  // current_value = current_value가 입력된(>0) 마일스톤 중 가장 마지막 것
  const latestWithValue = milestones.find(m => m.current_value > 0);
  const currentValue = latestWithValue ? latestWithValue.current_value : 0;
  db.prepare(
    'UPDATE key_results SET current_value = ?, target_value = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).run(currentValue, lastMilestone.target_value, keyResultId);

  // Recalc OKR and KPI
  const kr = db.prepare('SELECT okr_id, kpi_id FROM key_results WHERE id = ?').get(keyResultId);
  if (kr) {
    if (kr.okr_id) {
      recalcOkrProgress(db, kr.okr_id);
    }
    if (kr.kpi_id) {
      recalcKpiProgress(db, kr.kpi_id);
    }
  }
}

// GET / - 조회 (key_result_id 필수)
router.get('/', (req, res) => {
  const { key_result_id } = req.query;
  if (!key_result_id) return res.status(400).json({ error: 'key_result_id는 필수입니다' });
  const db = getDb();
  const milestones = db.prepare(
    'SELECT * FROM kr_milestones WHERE key_result_id = ? ORDER BY sort_order'
  ).all(key_result_id);
  res.json(milestones);
});

// POST / - 마일스톤 생성
router.post('/', (req, res) => {
  const { key_result_id, period_label, sort_order, target_value, current_value } = req.body;
  if (!key_result_id || !period_label) {
    return res.status(400).json({ error: 'key_result_id, period_label은 필수입니다' });
  }
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO kr_milestones (key_result_id, period_label, sort_order, target_value, current_value) VALUES (?, ?, ?, ?, ?)'
  ).run(key_result_id, period_label, sort_order || 0, target_value || 0, current_value || 0);
  syncKrFromMilestones(db, key_result_id);
  res.status(201).json(db.prepare('SELECT * FROM kr_milestones WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /:id - 마일스톤 수정
router.put('/:id', (req, res) => {
  const { target_value, current_value, period_label, sort_order } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM kr_milestones WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '마일스톤을 찾을 수 없습니다' });

  db.prepare(
    'UPDATE kr_milestones SET target_value = COALESCE(?, target_value), current_value = COALESCE(?, current_value), period_label = COALESCE(?, period_label), sort_order = COALESCE(?, sort_order), updated_at = datetime(\'now\') WHERE id = ?'
  ).run(target_value, current_value, period_label, sort_order, req.params.id);

  syncKrFromMilestones(db, existing.key_result_id);
  res.json(db.prepare('SELECT * FROM kr_milestones WHERE id = ?').get(req.params.id));
});

// DELETE /:id - 마일스톤 삭제
router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM kr_milestones WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '마일스톤을 찾을 수 없습니다' });
  db.prepare('DELETE FROM kr_milestones WHERE id = ?').run(req.params.id);
  syncKrFromMilestones(db, existing.key_result_id);
  res.json({ message: '삭제 완료' });
});

// POST /bulk - KR의 마일스톤 일괄 설정
router.post('/bulk', (req, res) => {
  const { key_result_id, milestones } = req.body;
  if (!key_result_id || !milestones) {
    return res.status(400).json({ error: 'key_result_id, milestones는 필수입니다' });
  }
  const db = getDb();
  const doBulk = db.transaction(() => {
    // 기존 마일스톤 삭제
    db.prepare('DELETE FROM kr_milestones WHERE key_result_id = ?').run(key_result_id);
    // 새 마일스톤 삽입
    const insert = db.prepare(
      'INSERT INTO kr_milestones (key_result_id, period_label, sort_order, target_value, current_value) VALUES (?, ?, ?, ?, ?)'
    );
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      insert.run(key_result_id, m.period_label, m.sort_order != null ? m.sort_order : i, m.target_value || 0, m.current_value || 0);
    }
    syncKrFromMilestones(db, key_result_id);
  });
  doBulk();
  const result = db.prepare('SELECT * FROM kr_milestones WHERE key_result_id = ? ORDER BY sort_order').all(key_result_id);
  res.json(result);
});

module.exports = router;
