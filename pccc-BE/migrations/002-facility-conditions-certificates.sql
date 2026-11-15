ALTER TABLE facilities ADD COLUMN fire_safety_conditions TEXT NOT NULL DEFAULT '';
ALTER TABLE facility_personnel ADD COLUMN certificate_issue_date TEXT;
ALTER TABLE facility_personnel ADD CONSTRAINT personnel_certificate_dates CHECK (certificate_issue_date IS NULL OR certificate_expiry IS NULL OR certificate_issue_date <= certificate_expiry);
