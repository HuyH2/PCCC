// ---------------------------------------------------------------------------
// Re-export barrel — kept for backward compatibility.
// All logic has been moved to focused sub-service files.
// New code should import directly from the relevant sub-service.
// ---------------------------------------------------------------------------

export {
  listPlans,
  planDetail,
  createPlan,
  updatePlan,
  planningOptions,
  listPlanFacilities,
} from "./plans.service.js";
export { createTarget } from "./targets.service.js";
export {
  createPeriodicInspection,
  planningInspectionDetail,
  assignLeadOfficer,
} from "./periodic-inspections.service.js";
export {
  listSchedules,
  updateSchedule,
  listReschedules,
  rescheduleInspection,
} from "./schedules.service.js";
export { upsertNotice } from "./notices.service.js";
export { planningFile } from "./planning-files.service.js";
