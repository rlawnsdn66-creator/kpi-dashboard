const { Router } = require('express');
const { getDb } = require('../db/connection');

const router = Router();

router.get('/', (req, res) => {
  const { type } = req.query;
  let sql = 'SELECT * FROM periods';
  const params = [];
  if (type) {
    sql += ' WHERE type = ?';
    params.push(type);
  }
  sql += ' ORDER BY start_date DESC';
  res.json(getDb().prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM periods WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '기간을 찾을 수 없습니다' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { name, type, start_date, end_date, is_active } = req.body;
  if (!name || !type || !start_date || !end_date) {
    return res.status(400).json({ error: '이름, 유형, 시작일, 종료일은 필수입니다' });
  }
  const db = getDb();
  if (is_active) {
    db.prepare('UPDATE periods SET is_active = 0').run();
  }
  const result = db.prepare('INSERT INTO periods (name, type, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?)')
    .run(name, type, start_date, end_date, is_active ? 1 : 0);
  res.status(201).json({ id: result.lastInsertRowid, name, type, start_date, end_date, is_active: is_active ? 1 : 0 });
});

router.put('/:id', (req, res) => {
  const { name, type, start_date, end_date, is_active } = req.body;
  const db = getDb();
  if (is_active) {
    db.prepare('UPDATE periods SET is_active = 0').run();
  }
  const result = db.prepare('UPDATE periods SET name = COALESCE(?, name), type = COALESCE(?, type), start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date), is_active = COALESCE(?, is_active) WHERE id = ?')
    .run(name, type, start_date, end_date, is_active != null ? (is_active ? 1 : 0) : null, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '기간을 찾을 수 없습니다' });
  res.json(getDb().prepare('SELECT * FROM periods WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const result = getDb().prepare('DELETE FROM periods WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '기간을 찾을 수 없습니다' });
  res.json({ message: '삭제 완료' });
});

module.exports = router;
