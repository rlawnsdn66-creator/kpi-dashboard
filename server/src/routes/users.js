const { Router } = require('express');
const { getDb } = require('../db/connection');

const router = Router();

router.get('/', (req, res) => {
  const { team_id, organization_id } = req.query;
  let sql = `SELECT u.*, COALESCE(org.name, t.name) as team_name, org.name as org_name
    FROM users u
    LEFT JOIN teams t ON u.team_id = t.id
    LEFT JOIN organizations org ON u.organization_id = org.id`;
  const params = [];
  const conditions = [];
  if (team_id) { conditions.push('u.team_id = ?'); params.push(team_id); }
  if (organization_id) { conditions.push('u.organization_id = ?'); params.push(organization_id); }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY u.name';
  res.json(getDb().prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const row = getDb().prepare(`SELECT u.*, COALESCE(org.name, t.name) as team_name, org.name as org_name
    FROM users u LEFT JOIN teams t ON u.team_id = t.id LEFT JOIN organizations org ON u.organization_id = org.id
    WHERE u.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { team_id, organization_id, name, email, role } = req.body;
  if (!name) return res.status(400).json({ error: '이름은 필수입니다' });
  const result = getDb().prepare('INSERT INTO users (team_id, organization_id, name, email, role) VALUES (?, ?, ?, ?, ?)')
    .run(team_id || null, organization_id || null, name, email || null, role || 'member');
  res.status(201).json({ id: result.lastInsertRowid, team_id, organization_id, name, email, role: role || 'member' });
});

router.put('/:id', (req, res) => {
  const { team_id, organization_id, name, email, role } = req.body;
  const result = getDb().prepare('UPDATE users SET team_id = COALESCE(?, team_id), organization_id = COALESCE(?, organization_id), name = COALESCE(?, name), email = COALESCE(?, email), role = COALESCE(?, role) WHERE id = ?')
    .run(team_id, organization_id, name, email, role, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
  res.json(getDb().prepare('SELECT * FROM users WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const result = getDb().prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
  res.json({ message: '삭제 완료' });
});

module.exports = router;
