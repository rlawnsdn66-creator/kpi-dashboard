const fs = require('fs');
const path = require('path');
const { getDb } = require('./connection');

function migrate() {
  const db = getDb();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  // org_levels 초기 데이터 (없으면 삽입)
  const levelCount = db.prepare('SELECT COUNT(*) as cnt FROM org_levels').get().cnt;
  if (levelCount === 0) {
    const insertLevel = db.prepare('INSERT INTO org_levels (name, depth, label) VALUES (?, ?, ?)');
    insertLevel.run('division', 10, '본부');
    insertLevel.run('department', 20, '부서');
    insertLevel.run('team', 30, '팀');
    console.log('조직 레벨 초기 데이터 삽입 완료');
  }

  // departments → organizations 마이그레이션
  const orgCount = db.prepare('SELECT COUNT(*) as cnt FROM organizations').get().cnt;
  if (orgCount === 0) {
    const depts = db.prepare('SELECT * FROM departments').all();
    const teams = db.prepare('SELECT * FROM teams').all();

    if (depts.length > 0) {
      const divLevel = db.prepare("SELECT id FROM org_levels WHERE name = 'division'").get();
      const teamLevel = db.prepare("SELECT id FROM org_levels WHERE name = 'team'").get();

      if (divLevel && teamLevel) {
        const migrateOrgs = db.transaction(() => {
          const insertOrg = db.prepare('INSERT INTO organizations (id, parent_id, level_id, name, description) VALUES (?, ?, ?, ?, ?)');
          for (const d of depts) {
            insertOrg.run(d.id, null, divLevel.id, d.name, d.description);
          }
          for (const t of teams) {
            insertOrg.run(t.id + 10000, t.department_id, teamLevel.id, t.name, t.description);
          }

          // users organization_id 매핑
          const updateUser = db.prepare('UPDATE users SET organization_id = ? WHERE team_id = ?');
          for (const t of teams) {
            updateUser.run(t.id + 10000, t.id);
          }

          // okrs organization_id 매핑
          const updateOkr = db.prepare('UPDATE okrs SET organization_id = ? WHERE team_id = ?');
          for (const t of teams) {
            updateOkr.run(t.id + 10000, t.id);
          }

          // kpis organization_id 매핑
          const updateKpi = db.prepare('UPDATE kpis SET organization_id = ? WHERE team_id = ?');
          for (const t of teams) {
            updateKpi.run(t.id + 10000, t.id);
          }
        });
        migrateOrgs();
        console.log(`조직 데이터 마이그레이션 완료: 본부 ${depts.length}개, 팀 ${teams.length}개`);
      }
    }
  }

  // key_results에 kpi_id 컬럼 추가 마이그레이션
  const krCols = db.prepare("PRAGMA table_info(key_results)").all().map(c => c.name);
  if (!krCols.includes('kpi_id')) {
    db.exec("ALTER TABLE key_results ADD COLUMN kpi_id INTEGER REFERENCES kpis(id) ON DELETE CASCADE");
    console.log('key_results에 kpi_id 컬럼 추가 완료');
  }
  if (!krCols.includes('direction')) {
    db.exec("ALTER TABLE key_results ADD COLUMN direction TEXT DEFAULT 'higher_better'");
    console.log('key_results에 direction 컬럼 추가 완료');
  }

  // kpis에 progress 컬럼 추가 마이그레이션
  const kpiCols = db.prepare("PRAGMA table_info(kpis)").all().map(c => c.name);
  if (!kpiCols.includes('progress')) {
    db.exec("ALTER TABLE kpis ADD COLUMN progress REAL DEFAULT 0");
    console.log('kpis에 progress 컬럼 추가 완료');
  }

  // objectives 테이블 생성
  db.exec(`CREATE TABLE IF NOT EXISTS objectives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id INTEGER NOT NULL,
    organization_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (period_id) REFERENCES periods(id),
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
  )`);

  // kpis에 objective_id 컬럼 추가 마이그레이션
  if (!kpiCols.includes('objective_id')) {
    db.exec("ALTER TABLE kpis ADD COLUMN objective_id INTEGER REFERENCES objectives(id)");
    console.log('kpis에 objective_id 컬럼 추가 완료');
  }

  // okrs에 kpi_id 컬럼 추가 마이그레이션
  const okrCols = db.prepare("PRAGMA table_info(okrs)").all().map(c => c.name);
  if (!okrCols.includes('kpi_id')) {
    db.exec("ALTER TABLE okrs ADD COLUMN kpi_id INTEGER REFERENCES kpis(id) ON DELETE CASCADE");
    console.log('okrs에 kpi_id 컬럼 추가 완료');
  }

  // periods에 milestone_labels 컬럼 추가
  const periodCols = db.prepare("PRAGMA table_info(periods)").all().map(c => c.name);
  if (!periodCols.includes('milestone_labels')) {
    db.exec("ALTER TABLE periods ADD COLUMN milestone_labels TEXT");
    console.log('periods에 milestone_labels 컬럼 추가 완료');
  }

  // kr_milestones 테이블 생성 (schema.sql에서 처리되지만 안전하게 확인)
  db.exec(`CREATE TABLE IF NOT EXISTS kr_milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_result_id INTEGER NOT NULL REFERENCES key_results(id) ON DELETE CASCADE,
    period_label TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    target_value REAL NOT NULL DEFAULT 0,
    current_value REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(key_result_id, period_label)
  )`);

  // okr_milestones 테이블 생성
  db.exec(`CREATE TABLE IF NOT EXISTS okr_milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    okr_id INTEGER NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
    period_label TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    target_value REAL NOT NULL DEFAULT 0,
    current_value REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(okr_id, period_label)
  )`);

  // okrs.kpi_id NOT NULL 마이그레이션
  const okrKpiCol = db.prepare("PRAGMA table_info(okrs)").all().find(c => c.name === 'kpi_id');
  if (okrKpiCol && okrKpiCol.notnull === 0) {
    db.exec("DELETE FROM okrs WHERE kpi_id IS NULL");
    db.exec("PRAGMA foreign_keys=OFF");
    db.exec(`CREATE TABLE okrs_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
      kpi_id INTEGER NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
      team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
      organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      progress REAL DEFAULT 0,
      status TEXT DEFAULT 'on_track' CHECK(status IN ('on_track','at_risk','behind','completed')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`);
    db.exec("INSERT INTO okrs_new SELECT * FROM okrs");
    db.exec("DROP TABLE okrs");
    db.exec("ALTER TABLE okrs_new RENAME TO okrs");
    db.exec("PRAGMA foreign_keys=ON");
    console.log('okrs.kpi_id NOT NULL 마이그레이션 완료');
  }

  console.log('마이그레이션 완료');
}

if (require.main === module) {
  migrate();
}

module.exports = { migrate };
