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

  // okr_id NOT NULL 제약은 SQLite에서 ALTER로 변경 불가하므로 재생성(seed) 필요

  console.log('마이그레이션 완료');
}

if (require.main === module) {
  migrate();
}

module.exports = { migrate };
