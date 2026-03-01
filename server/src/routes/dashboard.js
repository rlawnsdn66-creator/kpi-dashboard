const { Router } = require('express');
const { getDb } = require('../db/connection');

const router = Router();

router.get('/summary', (req, res) => {
  const { period_id } = req.query;
  const db = getDb();
  let where = period_id ? 'WHERE period_id = ?' : '';
  const params = period_id ? [period_id] : [];

  const kpiCount = db.prepare(`SELECT COUNT(*) as count FROM kpis ${where}`).get(...params).count;
  const kpiAvgProgress = period_id
    ? db.prepare('SELECT COALESCE(AVG(progress), 0) as avg FROM kpis WHERE period_id = ?').get(period_id).avg
    : db.prepare('SELECT COALESCE(AVG(progress), 0) as avg FROM kpis').get().avg;
  const okrCount = db.prepare(`SELECT COUNT(*) as count FROM okrs ${where}`).get(...params).count;

  let okrAvgProgress;
  if (period_id) {
    okrAvgProgress = db.prepare('SELECT COALESCE(AVG(progress), 0) as avg FROM okrs WHERE period_id = ?').get(period_id).avg;
  } else {
    okrAvgProgress = db.prepare('SELECT COALESCE(AVG(progress), 0) as avg FROM okrs').get().avg;
  }

  // 리뷰 요약
  let reviewSummary = { total: 0, completed: 0, in_progress: 0 };
  if (period_id) {
    const cycles = db.prepare('SELECT id FROM review_cycles WHERE period_id = ?').all(period_id);
    if (cycles.length > 0) {
      const cycleIds = cycles.map(c => c.id);
      const placeholders = cycleIds.map(() => '?').join(',');
      reviewSummary.total = db.prepare(`SELECT COUNT(*) as cnt FROM reviews WHERE cycle_id IN (${placeholders})`).get(...cycleIds).cnt;
      reviewSummary.completed = db.prepare(`SELECT COUNT(*) as cnt FROM reviews WHERE cycle_id IN (${placeholders}) AND status IN ('submitted','approved')`).get(...cycleIds).cnt;
      reviewSummary.in_progress = db.prepare(`SELECT COUNT(*) as cnt FROM reviews WHERE cycle_id IN (${placeholders}) AND status = 'in_progress'`).get(...cycleIds).cnt;
    }
  }

  res.json({
    kpi_count: kpiCount,
    kpi_achievement_rate: Math.round(kpiAvgProgress * 10) / 10,
    okr_count: okrCount,
    okr_avg_progress: Math.round(okrAvgProgress * 10) / 10,
    review_total: reviewSummary.total,
    review_completed: reviewSummary.completed,
    review_in_progress: reviewSummary.in_progress,
  });
});

router.get('/kpi-trends', (req, res) => {
  const { period_id } = req.query;
  const db = getDb();
  let where = period_id ? 'AND k.period_id = ?' : '';
  const params = period_id ? [period_id] : [];
  const rows = db.prepare(`
    SELECT pr.record_id, k.name, pr.value, pr.created_at
    FROM progress_records pr
    JOIN kpis k ON pr.record_id = k.id AND pr.record_type = 'kpi'
    WHERE 1=1 ${where}
    ORDER BY pr.created_at
  `).all(...params);
  res.json(rows);
});

router.get('/okr-progress', (req, res) => {
  const { period_id } = req.query;
  const db = getDb();
  let where = period_id ? 'WHERE period_id = ?' : '';
  const params = period_id ? [period_id] : [];
  const statuses = db.prepare(`
    SELECT status, COUNT(*) as count FROM okrs ${where} GROUP BY status
  `).all(...params);
  res.json(statuses);
});

router.get('/org-summary', (req, res) => {
  const { period_id } = req.query;
  const db = getDb();
  const periodFilter = period_id ? 'AND period_id = ?' : '';
  const params = period_id ? [period_id] : [];

  const rows = db.prepare(`
    SELECT org.id, org.name, ol.label as level_label,
      (SELECT COUNT(*) FROM kpis WHERE organization_id = org.id ${periodFilter}) as kpi_count,
      (SELECT COALESCE(AVG(progress), 0) FROM kpis WHERE organization_id = org.id ${periodFilter}) as kpi_avg_progress,
      (SELECT COUNT(*) FROM okrs WHERE organization_id = org.id ${periodFilter}) as okr_count,
      (SELECT COALESCE(AVG(progress), 0) FROM okrs WHERE organization_id = org.id ${periodFilter}) as okr_avg_progress
    FROM organizations org
    JOIN org_levels ol ON org.level_id = ol.id
    ORDER BY ol.depth, org.name
  `).all(...params, ...params, ...params, ...params);

  res.json(rows);
});

// 하위 호환: team-summary
router.get('/team-summary', (req, res) => {
  const { period_id } = req.query;
  const db = getDb();
  const periodFilter = period_id ? 'AND period_id = ?' : '';
  const params = period_id ? [period_id] : [];

  const rows = db.prepare(`
    SELECT org.id, org.name,
      (SELECT COUNT(*) FROM kpis WHERE organization_id = org.id ${periodFilter}) as kpi_count,
      (SELECT COALESCE(AVG(progress), 0) FROM kpis WHERE organization_id = org.id ${periodFilter}) as kpi_avg_progress,
      (SELECT COUNT(*) FROM okrs WHERE organization_id = org.id ${periodFilter}) as okr_count,
      (SELECT COALESCE(AVG(progress), 0) FROM okrs WHERE organization_id = org.id ${periodFilter}) as okr_avg_progress
    FROM organizations org
    JOIN org_levels ol ON org.level_id = ol.id
    ORDER BY ol.depth, org.name
  `).all(...params, ...params, ...params, ...params);

  res.json(rows.filter(r => r.kpi_count > 0 || r.okr_count > 0));
});

module.exports = router;
