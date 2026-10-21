// Barrel — combines plan routes and inspection-level planning routes.
// app.js imports inspectionPlanningRoutes from this file unchanged.
import { planRoutes } from "./plans.routes.js";
import { inspectionsPlanningRoutes } from "./inspections-planning.routes.js";

export const inspectionPlanningRoutes = [...planRoutes, ...inspectionsPlanningRoutes];
