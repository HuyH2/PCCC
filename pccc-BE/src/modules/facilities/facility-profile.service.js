/**
 * Facility Profile Services Facade (M03 — UC-FAC-03 & UC-FAC-06)
 *
 * Unifies the facility profile domain operations into a clean, easy-to-navigate interface.
 * The underlying implementations are divided into two dedicated, focused services:
 *
 * 1. Facility Personnel Service (./facility-personnel.service.js):
 *    - UC-FAC-03: Personnel directory, designations, and head of facility rules.
 *    - Validates contact details, certificates, and optimistic concurrency versioning.
 *    - Automatically steps down previous active head with audit log when a new head is appointed.
 *
 * 2. Facility Attachments & Storage Service (./facility-attachments.service.js):
 *    - UC-FAC-06: Document upload, file inspection, and secure storage outside public directory.
 *    - Multipart stream parsing, file size limits, format verification, and private storage.
 *    - Atomic file storage with rollback on failure, inline viewing, and download handlers.
 */

// Personnel Management (UC-FAC-03)
export {
  personnelRow,
  listFacilityPersonnel,
  getFacilityPersonnel,
  saveFacilityPersonnel,
  deactivateFacilityPersonnel,
} from "./facility-personnel.service.js";

// Document Attachments & Storage (UC-FAC-06)
export {
  MAX_FACILITY_ATTACHMENT_BYTES,
  listFacilityAttachments,
  uploadFacilityAttachment,
  facilityAttachmentFile,
  softDeleteFacilityAttachment,
} from "./facility-attachments.service.js";
