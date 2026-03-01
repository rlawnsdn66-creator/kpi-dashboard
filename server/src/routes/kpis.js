const { Router } = require('express');
const { getDb } = require('../db/connection');

const router = Router();

function getDescendantIds(db, orgId) {
  return db.prepare(`
    WITH RECURSIVE descendants AS (
      SELECT id FROM organizations WHERE id = ?
      UNION ALL
      SELECT o.id FROM organizations o JOIN descendants d ON o.parent_id = d.id
    )
    SELECT id FROM descendants
  `).all(orgId).map(r => r.id);
}

function recalcKpiProgress(db, kpiId) {
  const childOkrs = db.prepare('SELECT progress FROM okrs WHERE kpi_id = ?').all(kpiId);
  if (childOkrs.length === 0) {
    db.prepare("UPDATE kpis SET progress = 0, current_value = 0, status = 'on_track', updated_at = datetime('now') WHERE id = ?").run(kpiId);
    return;
  }
  const avg = childOkrs.reduce((sum, o) => sum + o.progress, 0) / childOkrs.length;
  const avgProgress = Math.round(avg * 10) / 10;
  let status = 'on_track';
  if (avgProgress >= 100) status = 'completed';
  else if (avgProgress < 30) status = 'behind';
  else if (avgProgress < 60) status = 'at_risk';
  db.prepare('UPDATE kpis SET progress = ?, current_value = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(avgProgress, avgProgress, status, kpiId);
}

router.get('/', (req, res) => {
  const { period_id, team_id, organization_id, include_children, status } = req.query;
  let sql = `SELECT k.*, COALESCE(org.name, t.name) as team_name, u.name as owner_name
    FROM kpis k
    LEFT JOIN teams t ON k.team_id = t.id
    LEFT JOIN organizations org ON k.organization_id = org.id
    LEFT JOIN users u ON k.owner_id = u.id
    WHERE 1=1`;
  const params = [];
  if (period_id) { sql += ' AND k.period_id = ?'; params.push(period_id); }
  if (organization_id) {
    if (include_children === 'true') {
      const ids = getDescendantIds(getDb(), organization_id);
      sql += ` AND k.organization_id IN (${ids.map(() => '?').join(',')})`;
      params.push(...ids);
    } else {
      sql += ' AND k.organization_id = ?';
      params.push(organization_id);
    }
  } else if (team_id) {
    sql += ' AND k.team_id = ?';
    params.push(team_id);
  }
  if (status) { sql += ' AND k.status = ?'; params.push(status); }
  sql += ' ORDER BY k.created_at DESC';
  const db = getDb();
  const kpis = db.prepare(sql).all(...params);
  for (const kpi of kpis) {
    kpi.key_results = db.prepare('SELECT * FROM key_results WHERE kpi_id = ? ORDER BY id').all(kpi.id);
    for (const kr of kpi.key_results) {
      kr.milestones = db.prepare('SELECT * FROM kr_milestones WHERE key_result_id = ? ORDER BY sort_order').all(kr.id);
    }
  }
  res.json(kpis);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare(`SELECT k.*, COALESCE(org.name, t.name) as team_name, u.name as owner_name
    FROM kpis k LEFT JOIN teams t ON k.team_id = t.id LEFT JOIN organizations org ON k.organization_id = org.id LEFT JOIN users u ON k.owner_id = u.id
    WHERE k.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'KPI를 찾을 수 없습니다' });
  row.key_results = db.prepare('SELECT * FROM key_results WHERE kpi_id = ? ORDER BY id').all(row.id);
  for (const kr of row.key_results) {
    kr.milestones = db.prepare('SELECT * FROM kr_milestones WHERE key_result_id = ? ORDER BY sort_order').all(kr.id);
  }
  res.json(row);
});

router.post('/', (req, res) => {
  const { period_id, team_id, organization_id, owner_id, name, description, target_value, current_value, unit, direction, status, key_results, objective_id } = req.body;
  if (!period_id || !name) {
    return res.status(400).json({ error: '기간, 이름은 필수입니다' });
  }
  const db = getDb();
  const insert = db.transaction(() => {
    const result = db.prepare(`INSERT INTO kpis (period_id, team_id, organization_id, owner_id, name, description, target_value, current_value, unit, direction, status, objective_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(period_id, team_id || null, organization_id || null, owner_id || null, name, description || null, target_value || 0, current_value || 0, unit || '%', direction || 'higher_better', status || 'on_track', objective_id || null);
    const kpiId = result.lastInsertRowid;
    if (key_results && key_results.length > 0) {
      const insertKr = db.prepare(`INSERT INTO key_results (kpi_id, title, target_value, current_value, unit, weight, direction) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      for (const kr of key_results) {
        insertKr.run(kpiId, kr.title, kr.target_value || 100, kr.current_value || 0, kr.unit || '%', kr.weight || 1, kr.direction || 'higher_better');
      }
      recalcKpiProgress(db, kpiId);
    }
    return kpiId;
  });
  const kpiId = insert();
  const kpi = db.prepare('SELECT * FROM kpis WHERE id = ?').get(kpiId);
  kpi.key_results = db.prepare('SELECT * FROM key_results WHERE kpi_id = ?').all(kpiId);
  res.status(201).json(kpi);
});

router.put('/:id', (req, res) => {
  const { period_id, team_id, organization_id, owner_id, name, description, target_value, current_value, unit, direction, status, progress, objective_id } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM kpis WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'KPI를 찾을 수 없습니다' });
  db.prepare(`UPDATE kpis SET period_id=COALESCE(?,period_id), team_id=COALESCE(?,team_id), organization_id=COALESCE(?,organization_id), owner_id=COALESCE(?,owner_id), name=COALESCE(?,name), description=COALESCE(?,description), target_value=COALESCE(?,target_value), current_value=COALESCE(?,current_value), unit=COALESCE(?,unit), direction=COALESCE(?,direction), status=COALESCE(?,status), progress=COALESCE(?,progress), objective_id=?, updated_at=datetime('now') WHERE id=?`)
    .run(period_id, team_id, organization_id, owner_id, name, description, target_value, current_value, unit, direction, status, progress != null ? progress : undefined, objective_id !== undefined ? (objective_id || null) : existing.objective_id, req.params.id);
  const kpi = db.prepare('SELECT * FROM kpis WHERE id = ?').get(req.params.id);
  kpi.key_results = db.prepare('SELECT * FROM key_results WHERE kpi_id = ?').all(req.params.id);
  res.json(kpi);
});

router.delete('/:id', (req, res) => {
  const result = getDb().prepare('DELETE FROM kpis WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'KPI를 찾을 수 없습니다' });
  res.json({ message: '삭제 완료' });
});

// KPI Key Results
router.post('/:id/key-results', (req, res) => {
  const db = getDb();
  const kpi = db.prepare('SELECT id FROM kpis WHERE id = ?').get(req.params.id);
  if (!kpi) return res.status(404).json({ error: 'KPI를 찾을 수 없습니다' });
  const { title, target_value, current_value, unit, weight, direction } = req.body;
  if (!title) return res.status(400).json({ error: '제목은 필수입니다' });
  const result = db.prepare('INSERT INTO key_results (kpi_id, title, target_value, current_value, unit, weight, direction) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(req.params.id, title, target_value || 100, current_value || 0, unit || '%', weight || 1, direction || 'higher_better');
  recalcKpiProgress(db, Number(req.params.id));
  res.status(201).json(db.prepare('SELECT * FROM key_results WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id/key-results/:krId', (req, res) => {
  const db = getDb();
  const { title, target_value, current_value, unit, weight, direction } = req.body;
  const result = db.prepare('UPDATE key_results SET title=COALESCE(?,title), target_value=COALESCE(?,target_value), current_value=COALESCE(?,current_value), unit=COALESCE(?,unit), weight=COALESCE(?,weight), direction=COALESCE(?,direction), updated_at=datetime(\'now\') WHERE id=? AND kpi_id=?')
    .run(title, target_value, current_value, unit, weight, direction, req.params.krId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '핵심 결과를 찾을 수 없습니다' });
  recalcKpiProgress(db, Number(req.params.id));
  res.json(db.prepare('SELECT * FROM key_results WHERE id = ?').get(req.params.krId));
});

router.delete('/:id/key-results/:krId', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM key_results WHERE id = ? AND kpi_id = ?').run(req.params.krId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '핵심 결과를 찾을 수 없습니다' });
  recalcKpiProgress(db, Number(req.params.id));
  res.json({ message: '삭제 완료' });
});

// 이전 기간 KPI/OKR 불러오기
router.post('/import-from-period', (req, res) => {
  const { source_period_id, target_period_id } = req.body;
  if (!source_period_id || !target_period_id) {
    return res.status(400).json({ error: 'source_period_id와 target_period_id는 필수입니다' });
  }
  const db = getDb();
  const result = db.transaction(() => {
    // Objective 복사
    const sourceObjectives = db.prepare('SELECT * FROM objectives WHERE period_id = ?').all(source_period_id);
    let objectiveCount = 0;
    const objectiveIdMap = {};

    for (const obj of sourceObjectives) {
      const ins = db.prepare('INSERT INTO objectives (period_id, organization_id, title, description) VALUES (?, ?, ?, ?)')
        .run(target_period_id, obj.organization_id, obj.title, obj.description);
      objectiveIdMap[obj.id] = ins.lastInsertRowid;
      objectiveCount++;
    }

    // KPI 복사
    const sourceKpis = db.prepare('SELECT * FROM kpis WHERE period_id = ?').all(source_period_id);
    let kpiCount = 0;
    let okrCount = 0;
    const kpiIdMap = {};

    for (const kpi of sourceKpis) {
      const newObjectiveId = kpi.objective_id ? (objectiveIdMap[kpi.objective_id] || null) : null;
      const ins = db.prepare(`INSERT INTO kpis (period_id, team_id, organization_id, owner_id, name, description, target_value, current_value, unit, direction, status, progress, objective_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'on_track', 0, ?)`)
        .run(target_period_id, kpi.team_id, kpi.organization_id, kpi.owner_id, kpi.name, kpi.description, kpi.target_value, 0, kpi.unit, kpi.direction, newObjectiveId);
      kpiIdMap[kpi.id] = ins.lastInsertRowid;
      kpiCount++;
    }

    // OKR 복사
    const sourceOkrs = db.prepare('SELECT * FROM okrs WHERE period_id = ?').all(source_period_id);
    for (const okr of sourceOkrs) {
      const newKpiId = okr.kpi_id ? (kpiIdMap[okr.kpi_id] || null) : null;
      db.prepare(`INSERT INTO okrs (period_id, kpi_id, organization_id, owner_id, title, description, status, progress) VALUES (?, ?, ?, ?, ?, ?, 'on_track', 0)`)
        .run(target_period_id, newKpiId, okr.organization_id, okr.owner_id, okr.title, okr.description);
      okrCount++;
    }

    return { objectiveCount, kpiCount, okrCount };
  })();

  res.json({ message: `Objective ${result.objectiveCount}개, KPI ${result.kpiCount}개, OKR ${result.okrCount}개를 불러왔습니다`, ...result });
});

module.exports = router;
module.exports.recalcKpiProgress = recalcKpiProgress;
