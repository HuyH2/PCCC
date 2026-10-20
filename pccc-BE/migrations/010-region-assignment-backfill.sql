-- Backfill only regions with exactly one explicit region-scoped account.
-- Ambiguous or unassigned regions remain available for an administrator to assign later.
INSERT INTO region_assignments(region_id, account_id, assigned_at)
SELECT s.region_id, min(s.account_id), unixepoch() * 1000
FROM account_scopes s
WHERE s.kind = 'region'
GROUP BY s.region_id
HAVING count(DISTINCT s.account_id) = 1;
