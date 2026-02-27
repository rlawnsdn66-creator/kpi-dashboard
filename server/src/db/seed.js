const { getDb } = require('./connection');
const { migrate } = require('./migrate');

function seed() {
  const db = getDb();
  migrate();

  // 기존 데이터 삭제
  db.exec(`
    DELETE FROM review_items;
    DELETE FROM reviews;
    DELETE FROM review_cycles;
    DELETE FROM progress_records;
    DELETE FROM key_results;
    DELETE FROM kpis;
    DELETE FROM okrs;
    DELETE FROM users;
    DELETE FROM organizations;
    DELETE FROM org_levels;
    DELETE FROM teams;
    DELETE FROM departments;
    DELETE FROM periods;
  `);

  // 조직 레벨
  const insertLevel = db.prepare('INSERT INTO org_levels (name, depth, label) VALUES (?, ?, ?)');
  const levels = [
    ['division', 10, '본부'],
    ['department', 20, '부서'],
    ['team', 30, '팀'],
  ];
  const levelIds = levels.map(l => insertLevel.run(...l).lastInsertRowid);

  // 부서 (하위 호환)
  const insertDept = db.prepare('INSERT INTO departments (name, description) VALUES (?, ?)');
  const depts = [
    ['경영지원본부', '경영 기획 및 지원'],
    ['개발본부', '제품 개발 및 기술'],
    ['영업본부', '영업 및 마케팅'],
  ];
  const deptIds = depts.map(d => insertDept.run(...d).lastInsertRowid);

  // 팀 (하위 호환)
  const insertTeam = db.prepare('INSERT INTO teams (department_id, name, description) VALUES (?, ?, ?)');
  const teamsData = [
    [deptIds[0], '인사팀', '채용 및 인사 관리'],
    [deptIds[0], '재무팀', '재무 및 회계'],
    [deptIds[1], '백엔드팀', '서버 및 API 개발'],
    [deptIds[1], '프론트엔드팀', 'UI/UX 개발'],
    [deptIds[1], 'QA팀', '품질 보증'],
    [deptIds[2], '국내영업팀', '국내 영업'],
    [deptIds[2], '마케팅팀', '마케팅 전략 및 실행'],
  ];
  const teamIds = teamsData.map(t => insertTeam.run(...t).lastInsertRowid);

  // organizations (본부 → 팀)
  const insertOrg = db.prepare('INSERT INTO organizations (parent_id, level_id, name, description) VALUES (?, ?, ?, ?)');
  const orgDivIds = depts.map(d => insertOrg.run(null, levelIds[0], d[0], d[1]).lastInsertRowid);
  const orgTeamMap = [
    [orgDivIds[0], '인사팀', '채용 및 인사 관리'],
    [orgDivIds[0], '재무팀', '재무 및 회계'],
    [orgDivIds[1], '백엔드팀', '서버 및 API 개발'],
    [orgDivIds[1], '프론트엔드팀', 'UI/UX 개발'],
    [orgDivIds[1], 'QA팀', '품질 보증'],
    [orgDivIds[2], '국내영업팀', '국내 영업'],
    [orgDivIds[2], '마케팅팀', '마케팅 전략 및 실행'],
  ];
  const orgTeamIds = orgTeamMap.map(t => insertOrg.run(t[0], levelIds[2], t[1], t[2]).lastInsertRowid);

  // 사용자
  const insertUser = db.prepare('INSERT INTO users (team_id, organization_id, name, email, role) VALUES (?, ?, ?, ?, ?)');
  const users = [
    [teamIds[0], orgTeamIds[0], '김인사', 'hr.kim@example.com', 'manager'],
    [teamIds[0], orgTeamIds[0], '이채용', 'recruit.lee@example.com', 'member'],
    [teamIds[1], orgTeamIds[1], '박재무', 'finance.park@example.com', 'manager'],
    [teamIds[2], orgTeamIds[2], '정서버', 'backend.jung@example.com', 'manager'],
    [teamIds[2], orgTeamIds[2], '한개발', 'dev.han@example.com', 'member'],
    [teamIds[2], orgTeamIds[2], '오코딩', 'code.oh@example.com', 'member'],
    [teamIds[3], orgTeamIds[3], '최프론트', 'front.choi@example.com', 'manager'],
    [teamIds[3], orgTeamIds[3], '송디자인', 'design.song@example.com', 'member'],
    [teamIds[4], orgTeamIds[4], '윤품질', 'qa.yoon@example.com', 'manager'],
    [teamIds[5], orgTeamIds[5], '강영업', 'sales.kang@example.com', 'manager'],
    [teamIds[5], orgTeamIds[5], '임계약', 'deal.lim@example.com', 'member'],
    [teamIds[6], orgTeamIds[6], '조마케팅', 'mkt.cho@example.com', 'manager'],
    [teamIds[0], orgTeamIds[0], '관리자', 'admin@example.com', 'admin'],
  ];
  const userIds = users.map(u => insertUser.run(...u).lastInsertRowid);

  // 기간
  const insertPeriod = db.prepare('INSERT INTO periods (name, type, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?)');
  const periods = [
    ['2026 Q1', 'quarterly', '2026-01-01', '2026-03-31', 1],
    ['2026 Q2', 'quarterly', '2026-04-01', '2026-06-30', 0],
    ['2026년 1월', 'monthly', '2026-01-01', '2026-01-31', 0],
    ['2026년 2월', 'monthly', '2026-02-01', '2026-02-28', 1],
  ];
  const periodIds = periods.map(p => insertPeriod.run(...p).lastInsertRowid);

  // KPI
  const insertKpi = db.prepare(`INSERT INTO kpis (period_id, team_id, organization_id, owner_id, name, description, target_value, current_value, unit, direction, progress, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const kpisData = [
    [periodIds[0], teamIds[2], orgTeamIds[2], userIds[3], '서버 응답시간', 'API 평균 응답시간 200ms 이하', 200, 0, 'ms', 'lower_better', 0, 'on_track'],
    [periodIds[0], teamIds[2], orgTeamIds[2], userIds[3], '코드 커버리지', '단위 테스트 코드 커버리지', 80, 0, '%', 'higher_better', 0, 'on_track'],
    [periodIds[0], teamIds[3], orgTeamIds[3], userIds[6], '페이지 로딩 속도', 'FCP 2초 이내', 2, 0, '초', 'lower_better', 0, 'on_track'],
    [periodIds[0], teamIds[5], orgTeamIds[5], userIds[9], '월 매출', '월평균 매출 목표', 5000, 0, '만원', 'higher_better', 0, 'on_track'],
    [periodIds[0], teamIds[5], orgTeamIds[5], userIds[9], '신규 고객 수', '분기 신규 고객 확보', 30, 0, '명', 'higher_better', 0, 'on_track'],
    [periodIds[0], teamIds[6], orgTeamIds[6], userIds[11], 'MAU', '월간 활성 사용자 수', 10000, 0, '명', 'higher_better', 0, 'on_track'],
    [periodIds[0], teamIds[0], orgTeamIds[0], userIds[0], '채용 완료율', '분기 채용 계획 달성률', 100, 0, '%', 'higher_better', 0, 'on_track'],
    [periodIds[0], teamIds[4], orgTeamIds[4], userIds[8], '버그 탐지율', '출시 전 버그 탐지율', 95, 0, '%', 'higher_better', 0, 'on_track'],
  ];
  const kpiIds = kpisData.map(k => insertKpi.run(...k).lastInsertRowid);

  // OKR
  const insertOkr = db.prepare(`INSERT INTO okrs (period_id, team_id, organization_id, owner_id, title, description, progress, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const okrData = [
    [periodIds[0], teamIds[2], orgTeamIds[2], userIds[3], '백엔드 성능 최적화', 'API 성능 및 안정성 향상', 65, 'on_track'],
    [periodIds[0], teamIds[3], orgTeamIds[3], userIds[6], '사용자 경험 개선', 'UI/UX 전면 개선', 40, 'at_risk'],
    [periodIds[0], teamIds[5], orgTeamIds[5], userIds[9], '매출 성장 가속화', '영업 파이프라인 확대 및 매출 증대', 35, 'behind'],
    [periodIds[0], teamIds[6], orgTeamIds[6], userIds[11], '브랜드 인지도 확대', '온/오프라인 마케팅 강화', 55, 'on_track'],
    [periodIds[0], teamIds[0], orgTeamIds[0], userIds[0], '핵심 인재 확보', '주요 포지션 채용 완료', 50, 'on_track'],
  ];
  const okrIds = okrData.map(o => insertOkr.run(...o).lastInsertRowid);

  // Key Results (OKR)
  const insertKr = db.prepare(`INSERT INTO key_results (okr_id, kpi_id, title, target_value, current_value, unit, weight, direction) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const keyResults = [
    [okrIds[0], null, 'API 응답시간 200ms 이하 달성', 200, 180, 'ms', 2, 'higher_better'],
    [okrIds[0], null, '서버 가용성 99.9% 달성', 99.9, 99.5, '%', 2, 'higher_better'],
    [okrIds[0], null, '데이터베이스 쿼리 최적화 50건', 50, 35, '건', 1, 'higher_better'],
    [okrIds[1], null, '디자인 시스템 구축 완료', 100, 40, '%', 2, 'higher_better'],
    [okrIds[1], null, '페이지 로딩 속도 2초 이내', 2, 1.8, '초', 1, 'higher_better'],
    [okrIds[1], null, '사용자 만족도 4.5점 이상', 4.5, 3.8, '점', 1, 'higher_better'],
    [okrIds[2], null, '월 매출 5000만원 달성', 5000, 3200, '만원', 3, 'higher_better'],
    [okrIds[2], null, '신규 고객 30개사 확보', 30, 22, '개사', 2, 'higher_better'],
    [okrIds[2], null, '기존 고객 이탈률 5% 이하', 5, 7, '%', 1, 'lower_better'],
    [okrIds[3], null, 'SNS 팔로워 5만 달성', 50000, 32000, '명', 1, 'higher_better'],
    [okrIds[3], null, '웹사이트 방문자 월 10만', 100000, 65000, '명', 1, 'higher_better'],
    [okrIds[4], null, '개발자 5명 채용', 5, 3, '명', 2, 'higher_better'],
    [okrIds[4], null, '채용 프로세스 개선 (리드타임 30일)', 30, 35, '일', 1, 'lower_better'],
  ];
  keyResults.forEach(kr => insertKr.run(...kr));

  // Key Results (KPI)
  const kpiKeyResults = [
    // KPI 1: 서버 응답시간 (lower_better)
    [null, kpiIds[0], 'API P95 응답시간 단축', 200, 180, 'ms', 2, 'lower_better'],
    [null, kpiIds[0], '캐시 히트율 90% 달성', 90, 75, '%', 1, 'higher_better'],
    // KPI 2: 코드 커버리지
    [null, kpiIds[1], '단위 테스트 커버리지 80%', 80, 72, '%', 2, 'higher_better'],
    [null, kpiIds[1], '통합 테스트 커버리지 60%', 60, 45, '%', 1, 'higher_better'],
    // KPI 3: 페이지 로딩 속도 (lower_better)
    [null, kpiIds[2], 'FCP 2초 이내', 2, 1.8, '초', 2, 'lower_better'],
    [null, kpiIds[2], 'LCP 3초 이내', 3, 2.5, '초', 1, 'lower_better'],
    // KPI 4: 월 매출
    [null, kpiIds[3], '기존 고객 매출 3000만원', 3000, 2200, '만원', 2, 'higher_better'],
    [null, kpiIds[3], '신규 고객 매출 2000만원', 2000, 1000, '만원', 1, 'higher_better'],
    // KPI 5: 신규 고객 수
    [null, kpiIds[4], '인바운드 고객 15명', 15, 12, '명', 1, 'higher_better'],
    [null, kpiIds[4], '아웃바운드 고객 15명', 15, 10, '명', 1, 'higher_better'],
    // KPI 6: MAU
    [null, kpiIds[5], '신규 가입자 3000명/월', 3000, 2500, '명', 1, 'higher_better'],
    [null, kpiIds[5], '재방문율 60%', 60, 52, '%', 1, 'higher_better'],
    // KPI 7: 채용 완료율
    [null, kpiIds[6], '개발직군 채용 5명', 5, 3, '명', 2, 'higher_better'],
    [null, kpiIds[6], '비개발직군 채용 3명', 3, 2, '명', 1, 'higher_better'],
    // KPI 8: 버그 탐지율
    [null, kpiIds[7], '자동화 테스트 버그 탐지', 70, 60, '%', 2, 'higher_better'],
    [null, kpiIds[7], '코드 리뷰 버그 탐지', 25, 28, '%', 1, 'higher_better'],
  ];
  kpiKeyResults.forEach(kr => insertKr.run(...kr));

  // Progress Records
  const insertProgress = db.prepare(`INSERT INTO progress_records (record_type, record_id, value, note, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`);
  const progressRecords = [
    ['kpi', 1, 220, '초기 측정', userIds[3], '2026-01-15'],
    ['kpi', 1, 195, '캐시 적용 후 개선', userIds[3], '2026-02-01'],
    ['kpi', 1, 180, '쿼리 최적화 완료', userIds[3], '2026-02-15'],
    ['kpi', 4, 2800, '1월 매출', userIds[9], '2026-01-31'],
    ['kpi', 4, 3200, '2월 매출', userIds[9], '2026-02-28'],
    ['key_result', 1, 250, '초기 측정', userIds[3], '2026-01-10'],
    ['key_result', 1, 180, '최적화 적용', userIds[3], '2026-02-15'],
    ['key_result', 3, 20, '1월 진행', userIds[4], '2026-01-31'],
    ['key_result', 3, 35, '2월 진행', userIds[4], '2026-02-20'],
  ];
  progressRecords.forEach(pr => insertProgress.run(...pr));

  // Review Cycles
  const insertCycle = db.prepare('INSERT INTO review_cycles (period_id, name, status, start_date, end_date) VALUES (?, ?, ?, ?, ?)');
  const cycleId = insertCycle.run(periodIds[0], '2026 Q1 정기 평가', 'open', '2026-03-15', '2026-03-31').lastInsertRowid;

  // Reviews
  const insertReview = db.prepare('INSERT INTO reviews (cycle_id, reviewee_id, reviewer_id, overall_score, overall_comment, status) VALUES (?, ?, ?, ?, ?, ?)');
  const reviewData = [
    [cycleId, userIds[3], userIds[0], 4.2, '우수한 성과', 'submitted'],
    [cycleId, userIds[6], userIds[0], 3.5, null, 'in_progress'],
    [cycleId, userIds[9], userIds[0], null, null, 'draft'],
  ];
  const reviewIds = reviewData.map(r => insertReview.run(...r).lastInsertRowid);

  // Review Items
  const insertReviewItem = db.prepare('INSERT INTO review_items (review_id, item_type, item_id, score, weight, comment) VALUES (?, ?, ?, ?, ?, ?)');
  // 정서버의 리뷰 항목 (KPI 1,2 + OKR 1)
  insertReviewItem.run(reviewIds[0], 'kpi', 1, 4.5, 1, '목표 달성');
  insertReviewItem.run(reviewIds[0], 'kpi', 2, 3.8, 1, '개선 필요');
  insertReviewItem.run(reviewIds[0], 'okr', okrIds[0], 4.3, 1, '양호한 진행');

  // KPI progress 자동 계산
  for (const kpiId of kpiIds) {
    const krs = db.prepare('SELECT current_value, target_value, weight, direction FROM key_results WHERE kpi_id = ?').all(kpiId);
    if (krs.length === 0) continue;
    let totalWeight = 0;
    let weightedProgress = 0;
    for (const kr of krs) {
      let progress;
      if (kr.direction === 'lower_better') {
        progress = kr.current_value > 0 ? Math.min((kr.target_value / kr.current_value) * 100, 100) : (kr.target_value === 0 ? 100 : 0);
      } else {
        progress = kr.target_value !== 0 ? Math.min((kr.current_value / kr.target_value) * 100, 100) : 0;
      }
      weightedProgress += progress * kr.weight;
      totalWeight += kr.weight;
    }
    const avgProgress = totalWeight > 0 ? Math.round(weightedProgress / totalWeight * 10) / 10 : 0;
    let status = 'on_track';
    if (avgProgress >= 100) status = 'completed';
    else if (avgProgress < 30) status = 'behind';
    else if (avgProgress < 60) status = 'at_risk';
    db.prepare('UPDATE kpis SET progress = ?, current_value = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(avgProgress, avgProgress, status, kpiId);
  }

  console.log('시드 데이터 삽입 완료');
  console.log(`  본부: ${orgDivIds.length}개, 팀(org): ${orgTeamIds.length}개`);
  console.log(`  사용자: ${userIds.length}명, 기간: ${periodIds.length}개`);
  console.log(`  KPI: ${kpiIds.length}개, OKR: ${okrIds.length}개`);
  console.log(`  리뷰 사이클: 1개, 리뷰: ${reviewIds.length}개`);
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
