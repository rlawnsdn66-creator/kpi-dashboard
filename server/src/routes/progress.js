const { Router } = require('express');
const { getDb } = require('../db/connection');
const { recalcOkrProgress } = require('./okrs');

const router = Router();

router.get('/', (req, res) => {
  const { record_type, record_id } = req.query;
  let sql = 'SELECT pr.*, u.name as recorded_by_name FROM progress_records pr LEFT JOIN users u ON pr.recorded_by = u.id WHERE 1=1';
  const params = [];
  if (record_type) { sql += ' AND pr.record_type = ?'; params.push(record_type); }
  if (record_id) { sql += ' AND pr.record_id = ?'; params.push(record_id); }
  sql += ' ORDER BY pr.created_at DESC';
  res.json(getDb().prepare(sql).all(...params));
});

router.post('/', (req, res) => {
  const { record_type, record_id, value, note, recorded_by } = req.body;
  if (!record_type || !record_id || value == null) {
    return res.status(400).json({ error: '유형, 대상 ID, 값은 필수입니다' });
  }
  const db = getDb();
  const doUpdate = db.transaction(() => {
    const result = db.prepare('INSERT INTO progress_records (record_type, record_id, value, note, recorded_by) VALUES (?, ?, ?, ?, ?)')
      .run(record_type, record_id, value, note || null, recorded_by || null);

    if (record_type === 'kpi') {
      db.prepare('UPDATE kpis SET current_value = ?, updated_at = datetime(\'now\') WHERE id = ?').run(value, record_id);
      const kpi = db.prepare('SELECT * FROM kpis WHERE id = ?').get(record_id);
      if (kpi) {
        let progress;
        if (kpi.direction === 'lower_better') {
          progress = kpi.target_value !== 0 ? (kpi.target_value / value) * 100 : 0;
        } else {
          progress = kpi.target_value !== 0 ? (value / kpi.target_value) * 100 : 0;
        }
        let status = 'on_track';
        if (progress >= 100) status = 'completed';
        else if (progress < 40) status = 'behind';
        else if (progress < 70) status = 'at_risk';
        db.prepare('UPDATE kpis SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, record_id);
      }
    } else if (record_type === 'key_result') {
      db.prepare('UPDATE key_results SET current_value = ?, updated_at = datetime(\'now\') WHERE id = ?').run(value, record_id);
      const kr = db.prepare('SELECT okr_id FROM key_results WHERE id = ?').get(record_id);
      if (kr && kr.okr_id) {
        recalcOkrProgress(db, kr.okr_id);
      }
    }
    return result.lastInsertRowid;
  });
  const id = doUpdate();
  res.status(201).json(db.prepare('SELECT * FROM progress_records WHERE id = ?').get(id));
});

module.exports = router;
