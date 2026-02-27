const { Router } = require('express');
const { getDb } = require('../db/connection');
const { recalcKpiProgress } = require('./kpis');

const router = Router();

function recalcOkrProgress(db, okrId) {
  const krs = db.prepare('SELECT current_value, target_value, weight FROM key_results WHERE okr_id = ?').all(okrId);
  if (krs.length === 0) return;
  let totalWeight = 0;
  let weightedProgress = 0;
  for (const kr of krs) {
    const progress = kr.target_value !== 0 ? Math.min((kr.current_value / kr.target_value) * 100, 100) : 0;
    weightedProgress += progress * kr.weight;
    totalWeight += kr.weight;
  }
  const avgProgress = totalWeight > 0 ? Math.round(weightedProgress / totalWeight * 10) / 10 : 0;
  let status = 'on_track';
  if (avgProgress >= 100) status = 'completed';
  else if (avgProgress < 30) status = 'behind';
  else if (avgProgress < 60) status = 'at_risk';
  db.prepare('UPDATE okrs SET progress = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(avgProgress, status, okrId);
}

router.get('/', (req, res) => {
  const { period_id, team_id, organization_id, status } = req.query;
  let sql = `SELECT o.*, COALESCE(org.name, t.name) as team_name, u.name as owner_name
    FROM okrs o
    LEFT JOIN teams t ON o.team_id = t.id
    LEFT JOIN organizations org ON o.organization_id = org.id
    LEFT JOIN users u ON o.owner_id = u.id WHERE 1=1`;
  const params = [];
  if (period_id) { sql += ' AND o.period_id = ?'; params.push(period_id); }
  if (organization_id) { sql += ' AND o.organization_id = ?'; params.push(organization_id); }
  else if (team_id) { sql += ' AND o.team_id = ?'; params.push(team_id); }
  if (status) { sql += ' AND o.status = ?'; params.push(status); }
  sql += ' ORDER BY o.created_at DESC';
  const db = getDb();
  const okrs = db.prepare(sql).all(...params);
  for (const okr of okrs) {
    okr.key_results = db.prepare(`SELECT kr.*, k.name as kpi_name FROM key_results kr LEFT JOIN kpis k ON kr.kpi_id = k.id WHERE kr.okr_id = ? ORDER BY kr.id`).all(okr.id);
  }
  res.json(okrs);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const okr = db.prepare(`SELECT o.*, COALESCE(org.name, t.name) as team_name, u.name as owner_name
    FROM okrs o LEFT JOIN teams t ON o.team_id = t.id LEFT JOIN organizations org ON o.organization_id = org.id LEFT JOIN users u ON o.owner_id = u.id WHERE o.id = ?`).get(req.params.id);
  if (!okr) return res.status(404).json({ error: 'OKR을 찾을 수 없습니다' });
  okr.key_results = db.prepare(`SELECT kr.*, k.name as kpi_name FROM key_results kr LEFT JOIN kpis k ON kr.kpi_id = k.id WHERE kr.okr_id = ? ORDER BY kr.id`).all(okr.id);
  res.json(okr);
});

router.post('/', (req, res) => {
  const { period_id, team_id, organization_id, owner_id, title, description, key_results } = req.body;
  if (!period_id || !title) {
    return res.status(400).json({ error: '기간, 제목은 필수입니다' });
  }
  const db = getDb();
  const insert = db.transaction(() => {
    const result = db.prepare(`INSERT INTO okrs (period_id, team_id, organization_id, owner_id, title, description) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(period_id, team_id || null, organization_id || null, owner_id || null, title, description || null);
    const okrId = result.lastInsertRowid;
    if (key_results && key_results.length > 0) {
      const insertKr = db.prepare(`INSERT INTO key_results (okr_id, title, target_value, current_value, unit, weight, kpi_id) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      const kpiIds = new Set();
      for (const kr of key_results) {
        const kpiId = kr.kpi_id || null;
        insertKr.run(okrId, kr.title, kr.target_value || 100, kr.current_value || 0, kr.unit || '%', kr.weight || 1, kpiId);
        if (kpiId) kpiIds.add(kpiId);
      }
      recalcOkrProgress(db, okrId);
      for (const kpiId of kpiIds) {
        recalcKpiProgress(db, kpiId);
      }
    }
    return okrId;
  });
  const okrId = insert();
  const okr = db.prepare('SELECT * FROM okrs WHERE id = ?').get(okrId);
  okr.key_results = db.prepare(`SELECT kr.*, k.name as kpi_name FROM key_results kr LEFT JOIN kpis k ON kr.kpi_id = k.id WHERE kr.okr_id = ? ORDER BY kr.id`).all(okrId);
  res.status(201).json(okr);
});

router.put('/:id', (req, res) => {
  const { period_id, team_id, organization_id, owner_id, title, description, status } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM okrs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'OKR을 찾을 수 없습니다' });
  db.prepare(`UPDATE okrs SET period_id=COALESCE(?,period_id), team_id=COALESCE(?,team_id), organization_id=COALESCE(?,organization_id), owner_id=COALESCE(?,owner_id), title=COALESCE(?,title), description=COALESCE(?,description), status=COALESCE(?,status), updated_at=datetime('now') WHERE id=?`)
    .run(period_id, team_id, organization_id, owner_id, title, description, status, req.params.id);
  const okr = db.prepare('SELECT * FROM okrs WHERE id = ?').get(req.params.id);
  okr.key_results = db.prepare(`SELECT kr.*, k.name as kpi_name FROM key_results kr LEFT JOIN kpis k ON kr.kpi_id = k.id WHERE kr.okr_id = ? ORDER BY kr.id`).all(req.params.id);
  res.json(okr);
});

router.delete('/:id', (req, res) => {
  const result = getDb().prepare('DELETE FROM okrs WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'OKR을 찾을 수 없습니다' });
  res.json({ message: '삭제 완료' });
});

// Key Results
router.post('/:id/key-results', (req, res) => {
  const db = getDb();
  const okr = db.prepare('SELECT id FROM okrs WHERE id = ?').get(req.params.id);
  if (!okr) return res.status(404).json({ error: 'OKR을 찾을 수 없습니다' });
  const { title, target_value, current_value, unit, weight, kpi_id } = req.body;
  if (!title) return res.status(400).json({ error: '제목은 필수입니다' });
  const result = db.prepare('INSERT INTO key_results (okr_id, title, target_value, current_value, unit, weight, kpi_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(req.params.id, title, target_value || 100, current_value || 0, unit || '%', weight || 1, kpi_id || null);
  recalcOkrProgress(db, Number(req.params.id));
  if (kpi_id) recalcKpiProgress(db, kpi_id);
  res.status(201).json(db.prepare('SELECT * FROM key_results WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id/key-results/:krId', (req, res) => {
  const db = getDb();
  const { title, target_value, current_value, unit, weight } = req.body;
  const result = db.prepare('UPDATE key_results SET title=COALESCE(?,title), target_value=COALESCE(?,target_value), current_value=COALESCE(?,current_value), unit=COALESCE(?,unit), weight=COALESCE(?,weight), updated_at=datetime(\'now\') WHERE id=? AND okr_id=?')
    .run(title, target_value, current_value, unit, weight, req.params.krId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '핵심 결과를 찾을 수 없습니다' });
  recalcOkrProgress(db, Number(req.params.id));
  res.json(db.prepare('SELECT * FROM key_results WHERE id = ?').get(req.params.krId));
});

router.delete('/:id/key-results/:krId', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM key_results WHERE id = ? AND okr_id = ?').run(req.params.krId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '핵심 결과를 찾을 수 없습니다' });
  recalcOkrProgress(db, Number(req.params.id));
  res.json({ message: '삭제 완료' });
});

module.exports = router;
