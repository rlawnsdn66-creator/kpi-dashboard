const { Router } = require('express');
const { getDb } = require('../db/connection');

const router = Router();

// org-levels CRUD
router.get('/', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM org_levels ORDER BY depth').all());
});

router.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM org_levels WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '조직 레벨을 찾을 수 없습니다' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { name, depth, label } = req.body;
  if (!name || depth == null || !label) return res.status(400).json({ error: '이름, 깊이, 표시명은 필수입니다' });
  const result = getDb().prepare('INSERT INTO org_levels (name, depth, label) VALUES (?, ?, ?)')
    .run(name, depth, label);
  res.status(201).json(getDb().prepare('SELECT * FROM org_levels WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const { name, depth, label } = req.body;
  const result = getDb().prepare('UPDATE org_levels SET name = COALESCE(?, name), depth = COALESCE(?, depth), label = COALESCE(?, label) WHERE id = ?')
    .run(name, depth, label, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '조직 레벨을 찾을 수 없습니다' });
  res.json(getDb().prepare('SELECT * FROM org_levels WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const result = getDb().prepare('DELETE FROM org_levels WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '조직 레벨을 찾을 수 없습니다' });
  res.json({ message: '삭제 완료' });
});

module.exports = router;
