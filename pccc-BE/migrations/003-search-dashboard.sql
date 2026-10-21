-- UC-SYS-01/02: read-only projections over the shared catalog; no parallel statistics tables (BR-01).
-- The API always filters these views with the caller's data scope on alias f.
-- Officer names come from accounts until the shared officers table is integrated; then only
-- officer_directory needs to change.
CREATE VIEW officer_directory AS
  SELECT officer_id, min(full_name) AS full_name FROM accounts GROUP BY officer_id;
CREATE VIEW facility_overview AS
  SELECT f.id, f.name, f.address, f.status, f.region_id, r.name AS region_name,
    r.unit_id, u.name AS unit_name, f.officer_id, o.full_name AS officer_name
  FROM facilities f
  JOIN regions r ON r.id=f.region_id
  JOIN units u ON u.id=r.unit_id
  LEFT JOIN officer_directory o ON o.officer_id=f.officer_id;
