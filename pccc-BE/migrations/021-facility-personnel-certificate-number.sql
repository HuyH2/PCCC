ALTER TABLE facility_personnel ADD COLUMN certificate_number TEXT CHECK(
  certificate_number IS NULL OR length(trim(certificate_number)) BETWEEN 1 AND 100
);
