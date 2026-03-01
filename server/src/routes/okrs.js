const { Router } = require('express');
const { getDb } = require('../db/connection');
const { recalcKpiProgress } = require('./kpis');
const { determineStatus } = require('../utils/status');

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
  const status = determineStatus(avgProgress);
  db.prepare('UPDATE okrs SET progress = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(avgProgress, status, okrId);

  // Recalc parent KPI
  const okr = db.prepare('SELECT kpi_id FROM okrs WHERE id = ?').get(okrId);
  if (okr && okr.kpi_id) {
    recalcKpiProgress(db, okr.kpi_id);
  }
}

router.get('/', (req, res) => {
  const { period_id, team_id, organization_id, kpi_id, status } = req.query;
  let sql = `SELECT o.*, COALESCE(org.name, t.name) as team_name, u.name as owner_name, k.name as kpi_name
    FROM okrs o
    LEFT JOIN teams t ON o.team_id = t.id
    LEFT JOIN organizations org ON o.organization_id = org.id
    LEFT JOIN users u ON o.owner_id = u.id
    LEFT JOIN kpis k ON o.kpi_id = k.id WHERE 1=1`;
  const params = [];
  if (period_id) { sql += ' AND o.period_id = ?'; params.push(period_id); }
  if (kpi_id) { sql += ' AND o.kpi_id = ?'; params.push(kpi_id); }
  if (organization_id) { sql += ' AND o.organization_id = ?'; params.push(organization_id); }
  else if (team_id) { sql += ' AND o.team_id = ?'; params.push(team_id); }
  if (status) { sql += ' AND o.status = ?'; params.push(status); }
  sql += ' ORDER BY o.created_at DESC';
  const db = getDb();
  const okrs = db.prepare(sql).all(...params);
  for (const okr of okrs) {
    okr.key_results = db.prepare('SELECT * FROM key_results WHERE okr_id = ? ORDER BY id').all(okr.id);
    for (const kr of okr.key_results) {
      kr.milestones = db.prepare('SELECT * FROM kr_milestones WHERE key_result_id = ? ORDER BY sort_order').all(kr.id);
    }
    okr.milestones = db.prepare('SELECT * FROM okr_milestones WHERE okr_id = ? ORDER BY sort_order').all(okr.id);
  }
  res.json(okrs);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const okr = db.prepare(`SELECT o.*, COALESCE(org.name, t.name) as team_name, u.name as owner_name, k.name as kpi_name
    FROM okrs o LEFT JOIN teams t ON o.team_id = t.id LEFT JOIN organizations org ON o.organization_id = org.id LEFT JOIN users u ON o.owner_id = u.id LEFT JOIN kpis k ON o.kpi_id = k.id WHERE o.id = ?`).get(req.params.id);
  if (!okr) return res.status(404).json({ error: 'OKR을 찾을 수 없습니다' });
  okr.key_results = db.prepare('SELECT * FROM key_results WHERE okr_id = ? ORDER BY id').all(okr.id);
  for (const kr of okr.key_results) {
    kr.milestones = db.prepare('SELECT * FROM kr_milestones WHERE key_result_id = ? ORDER BY sort_order').all(kr.id);
  }
  okr.milestones = db.prepare('SELECT * FROM okr_milestones WHERE okr_id = ? ORDER BY sort_order').all(okr.id);
  res.json(okr);
});

router.post('/', (req, res) => {
  const { period_id, kpi_id, team_id, organization_id, owner_id, title, description, key_results } = req.body;
  if (!period_id || !kpi_id || !title) {
    return res.status(400).json({ error: '기간, KPI, 제목은 필수입니다' });
  }
  const db = getDb();
  const insert = db.transaction(() => {
    const result = db.prepare(`INSERT INTO okrs (period_id, kpi_id, team_id, organization_id, owner_id, title, description) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(period_id, kpi_id, team_id || null, organization_id || null, owner_id || null, title, description || null);
    const okrId = result.lastInsertRowid;
    if (key_results && key_results.length > 0) {
      const insertKr = db.prepare(`INSERT INTO key_results (okr_id, title, target_value, current_value, unit, weight) VALUES (?, ?, ?, ?, ?, ?)`);
      for (const kr of key_results) {
        insertKr.run(okrId, kr.title, kr.target_value || 100, kr.current_value || 0, kr.unit || '%', kr.weight || 1);
      }
      recalcOkrProgress(db, okrId);
    }
    // Recalc parent KPI
    if (kpi_id) recalcKpiProgress(db, kpi_id);
    return okrId;
  });
  const okrId = insert();
  const okr = db.prepare('SELECT * FROM okrs WHERE id = ?').get(okrId);
  okr.key_results = db.prepare('SELECT * FROM key_results WHERE okr_id = ? ORDER BY id').all(okrId);
  res.status(201).json(okr);
});

router.put('/:id', (req, res) => {
  const { period_id, kpi_id, team_id, organization_id, owner_id, title, description, status, progress } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM okrs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'OKR을 찾을 수 없습니다' });
  if (kpi_id === null) return res.status(400).json({ error: 'KPI는 필수입니다' });
  db.prepare(`UPDATE okrs SET period_id=COALESCE(?,period_id), kpi_id=COALESCE(?,kpi_id), team_id=COALESCE(?,team_id), organization_id=COALESCE(?,organization_id), owner_id=COALESCE(?,owner_id), title=COALESCE(?,title), description=COALESCE(?,description), status=COALESCE(?,status), progress=COALESCE(?,progress), updated_at=datetime('now') WHERE id=?`)
    .run(period_id, kpi_id, team_id, organization_id, owner_id, title, description, status, progress != null ? progress : undefined, req.params.id);
  // Recalc parent KPI if changed
  const updated = db.prepare('SELECT * FROM okrs WHERE id = ?').get(req.params.id);
  if (existing.kpi_id && existing.kpi_id !== updated.kpi_id) recalcKpiProgress(db, existing.kpi_id);
  if (updated.kpi_id) recalcKpiProgress(db, updated.kpi_id);
  updated.key_results = db.prepare('SELECT * FROM key_results WHERE okr_id = ? ORDER BY id').all(req.params.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT kpi_id FROM okrs WHERE id = ?').get(req.params.id);
  const result = db.prepare('DELETE FROM okrs WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'OKR을 찾을 수 없습니다' });
  if (existing && existing.kpi_id) recalcKpiProgress(db, existing.kpi_id);
  res.json({ message: '삭제 완료' });
});

// Key Results
router.post('/:id/key-results', (req, res) => {
  const db = getDb();
  const okr = db.prepare('SELECT id FROM okrs WHERE id = ?').get(req.params.id);
  if (!okr) return res.status(404).json({ error: 'OKR을 찾을 수 없습니다' });
  const { title, target_value, current_value, unit, weight } = req.body;
  if (!title) return res.status(400).json({ error: '제목은 필수입니다' });
  const result = db.prepare('INSERT INTO key_results (okr_id, title, target_value, current_value, unit, weight) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.params.id, title, target_value || 100, current_value || 0, unit || '%', weight || 1);
  recalcOkrProgress(db, Number(req.params.id));
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

// OKR Milestones - bulk set
router.post('/:id/milestones', (req, res) => {
  const { milestones } = req.body;
  if (!milestones) return res.status(400).json({ error: 'milestones는 필수입니다' });
  const db = getDb();
  const okr = db.prepare('SELECT id FROM okrs WHERE id = ?').get(req.params.id);
  if (!okr) return res.status(404).json({ error: 'OKR을 찾을 수 없습니다' });
  const doBulk = db.transaction(() => {
    db.prepare('DELETE FROM okr_milestones WHERE okr_id = ?').run(req.params.id);
    const insert = db.prepare('INSERT INTO okr_milestones (okr_id, period_label, sort_order, target_value, current_value) VALUES (?, ?, ?, ?, ?)');
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      insert.run(req.params.id, m.period_label, m.sort_order != null ? m.sort_order : i, m.target_value || 0, m.current_value || 0);
    }
  });
  doBulk();
  const result = db.prepare('SELECT * FROM okr_milestones WHERE okr_id = ? ORDER BY sort_order').all(req.params.id);
  res.json(result);
});

// OKR Milestone - update single
router.put('/:id/milestones/:msId', (req, res) => {
  const { target_value, current_value } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM okr_milestones WHERE id = ? AND okr_id = ?').get(req.params.msId, req.params.id);
  if (!existing) return res.status(404).json({ error: '마일스톤을 찾을 수 없습니다' });
  db.prepare('UPDATE okr_milestones SET target_value = COALESCE(?, target_value), current_value = COALESCE(?, current_value), updated_at = datetime(\'now\') WHERE id = ?')
    .run(target_value, current_value, req.params.msId);
  res.json(db.prepare('SELECT * FROM okr_milestones WHERE id = ?').get(req.params.msId));
});

module.exports = router;
module.exports.recalcOkrProgress = recalcOkrProgress;
