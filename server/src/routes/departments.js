const { Router } = require('express');
const { getDb } = require('../db/connection');

const router = Router();

// 트리 조회 (재귀 CTE)
router.get('/tree', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    WITH RECURSIVE org_tree AS (
      SELECT o.*, ol.label as level_label, ol.depth as level_depth, 0 as tree_depth
      FROM organizations o
      JOIN org_levels ol ON o.level_id = ol.id
      WHERE o.parent_id IS NULL
      UNION ALL
      SELECT o.*, ol.label as level_label, ol.depth as level_depth, ot.tree_depth + 1
      FROM organizations o
      JOIN org_levels ol ON o.level_id = ol.id
      JOIN org_tree ot ON o.parent_id = ot.id
    )
    SELECT * FROM org_tree ORDER BY level_depth, name
  `).all();

  const map = {};
  const roots = [];
  for (const row of rows) {
    row.children = [];
    map[row.id] = row;
  }
  for (const row of rows) {
    if (row.parent_id && map[row.parent_id]) {
      map[row.parent_id].children.push(row);
    } else {
      roots.push(row);
    }
  }
  res.json(roots);
});

// 하위 조직 ID 목록
router.get('/:id/descendants', (req, res) => {
  const rows = getDb().prepare(`
    WITH RECURSIVE descendants AS (
      SELECT id FROM organizations WHERE id = ?
      UNION ALL
      SELECT o.id FROM organizations o JOIN descendants d ON o.parent_id = d.id
    )
    SELECT id FROM descendants
  `).all(req.params.id);
  res.json(rows.map(r => r.id));
});

// 평면 목록
router.get('/', (req, res) => {
  const { level_id, parent_id } = req.query;
  let sql = `SELECT o.*, ol.label as level_label, ol.depth as level_depth
    FROM organizations o JOIN org_levels ol ON o.level_id = ol.id WHERE 1=1`;
  const params = [];
  if (level_id) { sql += ' AND o.level_id = ?'; params.push(level_id); }
  if (parent_id === 'null') { sql += ' AND o.parent_id IS NULL'; }
  else if (parent_id) { sql += ' AND o.parent_id = ?'; params.push(parent_id); }
  sql += ' ORDER BY ol.depth, o.name';
  res.json(getDb().prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const row = getDb().prepare(`SELECT o.*, ol.label as level_label, ol.depth as level_depth
    FROM organizations o JOIN org_levels ol ON o.level_id = ol.id WHERE o.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: '조직을 찾을 수 없습니다' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { parent_id, level_id, name, description } = req.body;
  if (!level_id || !name) return res.status(400).json({ error: '레벨과 이름은 필수입니다' });
  const result = getDb().prepare('INSERT INTO organizations (parent_id, level_id, name, description) VALUES (?, ?, ?, ?)')
    .run(parent_id || null, level_id, name, description || null);
  const created = getDb().prepare(`SELECT o.*, ol.label as level_label FROM organizations o JOIN org_levels ol ON o.level_id = ol.id WHERE o.id = ?`).get(result.lastInsertRowid);
  res.status(201).json(created);
});

router.put('/:id', (req, res) => {
  const { parent_id, level_id, name, description } = req.body;
  const result = getDb().prepare('UPDATE organizations SET parent_id = COALESCE(?, parent_id), level_id = COALESCE(?, level_id), name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?')
    .run(parent_id, level_id, name, description, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '조직을 찾을 수 없습니다' });
  res.json(getDb().prepare(`SELECT o.*, ol.label as level_label FROM organizations o JOIN org_levels ol ON o.level_id = ol.id WHERE o.id = ?`).get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const result = getDb().prepare('DELETE FROM organizations WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '조직을 찾을 수 없습니다' });
  res.json({ message: '삭제 완료' });
});

module.exports = router;
