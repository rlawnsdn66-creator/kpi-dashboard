const { Router } = require('express');
const { getDb } = require('../db/connection');

const router = Router();

// === Review Cycles ===
router.get('/cycles', (req, res) => {
  const { period_id, status } = req.query;
  let sql = `SELECT rc.*, p.name as period_name FROM review_cycles rc JOIN periods p ON rc.period_id = p.id WHERE 1=1`;
  const params = [];
  if (period_id) { sql += ' AND rc.period_id = ?'; params.push(period_id); }
  if (status) { sql += ' AND rc.status = ?'; params.push(status); }
  sql += ' ORDER BY rc.created_at DESC';
  res.json(getDb().prepare(sql).all(...params));
});

router.get('/cycles/:id', (req, res) => {
  const row = getDb().prepare(`SELECT rc.*, p.name as period_name FROM review_cycles rc JOIN periods p ON rc.period_id = p.id WHERE rc.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: '리뷰 사이클을 찾을 수 없습니다' });
  res.json(row);
});

router.post('/cycles', (req, res) => {
  const { period_id, name, status, start_date, end_date } = req.body;
  if (!period_id || !name) return res.status(400).json({ error: '기간과 이름은 필수입니다' });
  const result = getDb().prepare('INSERT INTO review_cycles (period_id, name, status, start_date, end_date) VALUES (?, ?, ?, ?, ?)')
    .run(period_id, name, status || 'draft', start_date || null, end_date || null);
  res.status(201).json(getDb().prepare('SELECT * FROM review_cycles WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/cycles/:id', (req, res) => {
  const { period_id, name, status, start_date, end_date } = req.body;
  const result = getDb().prepare('UPDATE review_cycles SET period_id=COALESCE(?,period_id), name=COALESCE(?,name), status=COALESCE(?,status), start_date=COALESCE(?,start_date), end_date=COALESCE(?,end_date), updated_at=datetime(\'now\') WHERE id=?')
    .run(period_id, name, status, start_date, end_date, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '리뷰 사이클을 찾을 수 없습니다' });
  res.json(getDb().prepare('SELECT * FROM review_cycles WHERE id = ?').get(req.params.id));
});

router.delete('/cycles/:id', (req, res) => {
  const result = getDb().prepare('DELETE FROM review_cycles WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '리뷰 사이클을 찾을 수 없습니다' });
  res.json({ message: '삭제 완료' });
});

// === Reviews ===
router.get('/', (req, res) => {
  const { cycle_id, reviewee_id, status } = req.query;
  let sql = `SELECT r.*, ree.name as reviewee_name, rer.name as reviewer_name
    FROM reviews r
    JOIN users ree ON r.reviewee_id = ree.id
    LEFT JOIN users rer ON r.reviewer_id = rer.id
    WHERE 1=1`;
  const params = [];
  if (cycle_id) { sql += ' AND r.cycle_id = ?'; params.push(cycle_id); }
  if (reviewee_id) { sql += ' AND r.reviewee_id = ?'; params.push(reviewee_id); }
  if (status) { sql += ' AND r.status = ?'; params.push(status); }
  sql += ' ORDER BY r.created_at DESC';
  res.json(getDb().prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const review = db.prepare(`SELECT r.*, ree.name as reviewee_name, rer.name as reviewer_name
    FROM reviews r JOIN users ree ON r.reviewee_id = ree.id LEFT JOIN users rer ON r.reviewer_id = rer.id
    WHERE r.id = ?`).get(req.params.id);
  if (!review) return res.status(404).json({ error: '리뷰를 찾을 수 없습니다' });

  // 리뷰 항목 로드
  const items = db.prepare(`SELECT ri.*,
    CASE ri.item_type
      WHEN 'kpi' THEN (SELECT name FROM kpis WHERE id = ri.item_id)
      WHEN 'okr' THEN (SELECT title FROM okrs WHERE id = ri.item_id)
    END as item_name,
    CASE ri.item_type
      WHEN 'kpi' THEN (SELECT CASE WHEN direction='lower_better' THEN CASE WHEN current_value<=target_value THEN 100.0 ELSE (target_value/current_value)*100 END ELSE (current_value/target_value)*100 END FROM kpis WHERE id = ri.item_id)
      WHEN 'okr' THEN (SELECT progress FROM okrs WHERE id = ri.item_id)
    END as achievement
    FROM review_items ri WHERE ri.review_id = ? ORDER BY ri.item_type, ri.id`).all(req.params.id);
  review.items = items;
  res.json(review);
});

router.post('/', (req, res) => {
  const { cycle_id, reviewee_id, reviewer_id } = req.body;
  if (!cycle_id || !reviewee_id) return res.status(400).json({ error: '사이클과 피평가자는 필수입니다' });
  const result = getDb().prepare('INSERT INTO reviews (cycle_id, reviewee_id, reviewer_id) VALUES (?, ?, ?)')
    .run(cycle_id, reviewee_id, reviewer_id || null);
  res.status(201).json(getDb().prepare('SELECT * FROM reviews WHERE id = ?').get(result.lastInsertRowid));
});

// auto-populate: 피평가자의 KPI/OKR을 리뷰 항목으로 자동 로드
router.post('/:id/auto-populate', (req, res) => {
  const db = getDb();
  const review = db.prepare('SELECT r.*, rc.period_id FROM reviews r JOIN review_cycles rc ON r.cycle_id = rc.id WHERE r.id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: '리뷰를 찾을 수 없습니다' });

  const populate = db.transaction(() => {
    // 기존 항목 삭제
    db.prepare('DELETE FROM review_items WHERE review_id = ?').run(req.params.id);

    // 해당 사용자의 KPI
    const kpis = db.prepare('SELECT id FROM kpis WHERE owner_id = ? AND period_id = ?').all(review.reviewee_id, review.period_id);
    const insertItem = db.prepare('INSERT INTO review_items (review_id, item_type, item_id, weight) VALUES (?, ?, ?, ?)');
    for (const k of kpis) {
      insertItem.run(req.params.id, 'kpi', k.id, 1);
    }

    // 해당 사용자의 OKR
    const okrs = db.prepare('SELECT id FROM okrs WHERE owner_id = ? AND period_id = ?').all(review.reviewee_id, review.period_id);
    for (const o of okrs) {
      insertItem.run(req.params.id, 'okr', o.id, 1);
    }

    return kpis.length + okrs.length;
  });

  const count = populate();
  res.json({ message: `${count}개 항목이 로드되었습니다` });
});

router.put('/:id', (req, res) => {
  const { reviewer_id, overall_score, overall_comment, status } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '리뷰를 찾을 수 없습니다' });
  db.prepare('UPDATE reviews SET reviewer_id=COALESCE(?,reviewer_id), overall_score=COALESCE(?,overall_score), overall_comment=COALESCE(?,overall_comment), status=COALESCE(?,status), updated_at=datetime(\'now\') WHERE id=?')
    .run(reviewer_id, overall_score, overall_comment, status, req.params.id);
  res.json(db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const result = getDb().prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '리뷰를 찾을 수 없습니다' });
  res.json({ message: '삭제 완료' });
});

// === Review Items ===
router.put('/:reviewId/items/:itemId', (req, res) => {
  const { score, weight, comment } = req.body;
  const result = getDb().prepare('UPDATE review_items SET score=COALESCE(?,score), weight=COALESCE(?,weight), comment=COALESCE(?,comment) WHERE id=? AND review_id=?')
    .run(score, weight, comment, req.params.itemId, req.params.reviewId);
  if (result.changes === 0) return res.status(404).json({ error: '리뷰 항목을 찾을 수 없습니다' });
  res.json(getDb().prepare('SELECT * FROM review_items WHERE id = ?').get(req.params.itemId));
});

router.post('/:reviewId/items', (req, res) => {
  const { item_type, item_id, score, weight, comment } = req.body;
  if (!item_type || !item_id) return res.status(400).json({ error: '항목 유형과 ID는 필수입니다' });
  const result = getDb().prepare('INSERT INTO review_items (review_id, item_type, item_id, score, weight, comment) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.params.reviewId, item_type, item_id, score || null, weight || 1, comment || null);
  res.status(201).json(getDb().prepare('SELECT * FROM review_items WHERE id = ?').get(result.lastInsertRowid));
});

router.delete('/:reviewId/items/:itemId', (req, res) => {
  const result = getDb().prepare('DELETE FROM review_items WHERE id = ? AND review_id = ?').run(req.params.itemId, req.params.reviewId);
  if (result.changes === 0) return res.status(404).json({ error: '리뷰 항목을 찾을 수 없습니다' });
  res.json({ message: '삭제 완료' });
});

module.exports = router;
