const { Router } = require('express');
const { getDb } = require('../db/connection');

const router = Router();

// 목록 조회 (period_id 필터)
router.get('/', (req, res) => {
  const { period_id, organization_id } = req.query;
  let sql = `SELECT o.*, org.name as organization_name
    FROM objectives o
    LEFT JOIN organizations org ON o.organization_id = org.id
    WHERE 1=1`;
  const params = [];
  if (period_id) { sql += ' AND o.period_id = ?'; params.push(period_id); }
  if (organization_id) { sql += ' AND o.organization_id = ?'; params.push(organization_id); }
  sql += ' ORDER BY o.created_at DESC';
  const rows = getDb().prepare(sql).all(...params);
  res.json(rows);
});

// 단건 조회
router.get('/:id', (req, res) => {
  const row = getDb().prepare(`SELECT o.*, org.name as organization_name
    FROM objectives o
    LEFT JOIN organizations org ON o.organization_id = org.id
    WHERE o.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Objective를 찾을 수 없습니다' });
  res.json(row);
});

// 생성
router.post('/', (req, res) => {
  const { period_id, organization_id, title, description } = req.body;
  if (!period_id || !title) {
    return res.status(400).json({ error: '기간과 제목은 필수입니다' });
  }
  const result = getDb().prepare(
    'INSERT INTO objectives (period_id, organization_id, title, description) VALUES (?, ?, ?, ?)'
  ).run(period_id, organization_id || null, title, description || null);
  const row = getDb().prepare('SELECT * FROM objectives WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

// 수정
router.put('/:id', (req, res) => {
  const { period_id, organization_id, title, description } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM objectives WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Objective를 찾을 수 없습니다' });
  db.prepare(
    `UPDATE objectives SET period_id=COALESCE(?,period_id), organization_id=COALESCE(?,organization_id), title=COALESCE(?,title), description=COALESCE(?,description), updated_at=datetime('now') WHERE id=?`
  ).run(period_id, organization_id, title, description, req.params.id);
  const row = db.prepare('SELECT * FROM objectives WHERE id = ?').get(req.params.id);
  res.json(row);
});

// 삭제
router.delete('/:id', (req, res) => {
  const db = getDb();
  // 하위 KPI의 objective_id를 null로 설정
  db.prepare('UPDATE kpis SET objective_id = NULL WHERE objective_id = ?').run(req.params.id);
  const result = db.prepare('DELETE FROM objectives WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Objective를 찾을 수 없습니다' });
  res.json({ message: '삭제 완료' });
});

module.exports = router;
