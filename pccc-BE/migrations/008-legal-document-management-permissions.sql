-- UC-DOC-02: grant document management to the existing Commander and Admin roles.
-- This data migration leaves accounts, scopes and unrelated role grants untouched.
INSERT INTO audit_logs(actor_id, action, object_id, before_json, after_json, occurred_at, ip, feature, object_type)
SELECT NULL, 'authorization.legal_document_management_enabled', r.code,
  (SELECT json_group_array(permission_code) FROM role_permissions WHERE role_code = r.code AND permission_code LIKE 'M05.%'),
  json_array('M05.view', 'M05.create', 'M05.edit'),
  unixepoch() * 1000, 'migration', 'M05', 'role'
FROM roles r
WHERE r.code IN ('A01', 'A05')
  AND EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.code IN ('M05.view', 'M05.create', 'M05.edit')
      AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_code = r.code AND rp.permission_code = p.code)
  );

INSERT OR IGNORE INTO role_permissions(role_code, permission_code)
SELECT r.code, p.code
FROM roles r JOIN permissions p ON p.code IN ('M05.view', 'M05.create', 'M05.edit')
WHERE r.code IN ('A01', 'A05');
