function getDescendantIds(db, orgId) {
  return db.prepare(`
    WITH RECURSIVE descendants AS (
      SELECT id FROM organizations WHERE id = ?
      UNION ALL
      SELECT o.id FROM organizations o JOIN descendants d ON o.parent_id = d.id
    )
    SELECT id FROM descendants
  `).all(orgId).map(r => r.id);
}

module.exports = { getDescendantIds };
