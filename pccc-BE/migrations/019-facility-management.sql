-- UC-FAC-01/02: support status/region filtering and accent-insensitive duplicate checks.
CREATE INDEX facilities_status_region_idx ON facilities(status, region_id);
