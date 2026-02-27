CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(department_id, name)
);

CREATE TABLE IF NOT EXISTS org_levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  depth INTEGER NOT NULL UNIQUE,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  level_id INTEGER NOT NULL REFERENCES org_levels(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin','manager','member')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('quarterly','monthly')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_active INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS okrs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_id INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  progress REAL DEFAULT 0,
  status TEXT DEFAULT 'on_track' CHECK(status IN ('on_track','at_risk','behind','completed')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS key_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  okr_id INTEGER REFERENCES okrs(id) ON DELETE CASCADE,
  kpi_id INTEGER REFERENCES kpis(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_value REAL NOT NULL DEFAULT 100,
  current_value REAL DEFAULT 0,
  unit TEXT DEFAULT '%',
  weight REAL DEFAULT 1,
  direction TEXT DEFAULT 'higher_better' CHECK(direction IN ('higher_better','lower_better')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kpis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_id INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  target_value REAL NOT NULL,
  current_value REAL DEFAULT 0,
  unit TEXT DEFAULT '%',
  direction TEXT DEFAULT 'higher_better' CHECK(direction IN ('higher_better','lower_better')),
  progress REAL DEFAULT 0,
  status TEXT DEFAULT 'on_track' CHECK(status IN ('on_track','at_risk','behind','completed')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS progress_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_type TEXT NOT NULL CHECK(record_type IN ('kpi','key_result')),
  record_id INTEGER NOT NULL,
  value REAL NOT NULL,
  note TEXT,
  recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS review_cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_id INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','open','in_review','closed')),
  start_date TEXT,
  end_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  reviewee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  overall_score REAL,
  overall_comment TEXT,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','in_progress','submitted','approved')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS review_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK(item_type IN ('kpi','okr')),
  item_id INTEGER NOT NULL,
  score REAL,
  weight REAL DEFAULT 1,
  comment TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
