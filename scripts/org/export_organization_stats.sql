-- Export high-level organization statistics to support single-organization migration
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/org/export_organization_stats.sql
--
-- Output:
--   1. Total organization count
--   2. Membership distribution (memberships per organization)
--   3. List of organizations with their member counts (sorted descending)

\echo '\n-- 1) Total organizations -------------------------------------------'
SELECT COUNT(*) AS total_organizations
FROM organizations;

\echo '\n-- 2) Membership distribution -------------------------------------'
SELECT
  member_count,
  COUNT(*) AS organization_total
FROM (
  SELECT organization_id, COUNT(*) AS member_count
  FROM memberships
  WHERE code IS NULL -- exclude pending invites
  GROUP BY organization_id
) AS counts
GROUP BY member_count
ORDER BY member_count;

\echo '\n-- 3) Top organizations by active members ------------------------'
SELECT
  o.uuid,
  o.name,
  COUNT(m.id) FILTER (WHERE m.code IS NULL) AS active_members,
  COUNT(m.id) FILTER (WHERE m.code IS NOT NULL) AS pending_invites
FROM organizations AS o
LEFT JOIN memberships AS m
  ON o.id = m.organization_id
GROUP BY o.id
ORDER BY active_members DESC, o.created_at DESC
LIMIT 50;
