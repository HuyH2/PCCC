export type OrganizationLevel = "ROOT" | "AREA" | "WARD" | "NEIGHBORHOOD";
export type UnitStatus = "ACTIVE" | "INACTIVE";
export type OfficerStatus = UnitStatus | "TRANSFERRED";

export interface OrganizationNode {
  id: string;
  kind: "unit" | "region";
  code: string;
  name: string;
  level: OrganizationLevel;
  parentId: string | null;
  parentName: string | null;
  leaderOfficerId: string | null;
  leaderName: string | null;
  leaderHidden?: boolean;
  status: UnitStatus;
  notes: string;
  officerCount: number;
  facilityCount: number;
  readOnly: boolean;
  legacyParent: boolean;
}

export interface Officer {
  id: string;
  officerCode: string;
  fullName: string;
  rank: string;
  position: string;
  phone: string;
  email: string;
  notes: string;
  unitId: string;
  unitName: string;
  businessRole: string;
  status: OfficerStatus;
  statusReason: string | null;
  statusEffectiveDate: string | null;
  createdAt: number;
  updatedAt: number;
  linkedAccountCount: number;
  linkedActiveAccountCount: number;
}

export interface OrganizationOptions {
  units: OrganizationNode[];
  officers: Pick<Officer, "id" | "officerCode" | "fullName" | "rank" | "unitId" | "status">[];
  roles: { code: string; name: string }[];
}

export interface OrganizationTree {
  items: OrganizationNode[];
  stats: { unitCount: number; regionCount: number; activeCount: number; officerCount: number };
  permissions: { view: boolean; create: boolean; edit: boolean };
}

export interface OfficerList {
  items: Officer[];
  total: number;
  page: number;
  pageSize: number;
}

export const organizationLevelNames: Record<OrganizationLevel, string> = {
  ROOT: "Tỉnh/Thành phố · PC07",
  AREA: "Khu vực",
  WARD: "Phường",
  NEIGHBORHOOD: "Khu phố",
};

export const officerStatusNames: Record<OfficerStatus, string> = {
  ACTIVE: "Đang công tác",
  INACTIVE: "Ngưng công tác",
  TRANSFERRED: "Chuyển công tác",
};

export const organizationSelectClass =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full min-w-0 rounded-md border px-3 text-sm focus-visible:ring-[3px] disabled:opacity-50";

export function organizationPath(node: Pick<OrganizationNode, "kind" | "id">) {
  return node.kind === "unit"
    ? `/api/units/${encodeURIComponent(node.id)}`
    : `/api/organization/regions/${encodeURIComponent(node.id)}`;
}
