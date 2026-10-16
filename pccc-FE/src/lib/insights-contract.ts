/** Response shapes of /api/search and /api/dashboard* (UC-SYS-01, UC-SYS-02). */
export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardSummary {
  facilityCount: number;
  officerCount: number;
  regionCount: number;
}
export interface RegionFacilityCount {
  regionId: string;
  regionName: string;
  unitId: string;
  unitName: string;
  facilityCount: number;
}
export interface OfficerFacilityCount {
  officerId: string;
  officerName: string | null;
  facilityCount: number;
  regionCount: number;
}

export interface SearchGroup<T> {
  items: T[];
  total: number;
}
export interface FacilityHit {
  id: string;
  name: string;
  address: string;
  status: string;
  regionId: string;
  regionName: string;
  officerId: string;
  officerName: string | null;
}
export interface OfficerHit {
  officerId: string;
  officerName: string | null;
  facilityCount: number;
}
export interface RegionHit {
  id: string;
  name: string;
  unitId: string;
  unitName: string;
}
export interface UnitHit {
  id: string;
  name: string;
  parentId: string | null;
}
/** Groups are omitted when the caller lacks the owning module's view permission. */
export interface SearchResponse {
  query: string;
  groups: {
    facilities?: SearchGroup<FacilityHit>;
    officers?: SearchGroup<OfficerHit>;
    regions: SearchGroup<RegionHit>;
    units: SearchGroup<UnitHit>;
  };
}

export const facilityStatusLabels: Record<string, string> = { active: "Đang hoạt động" };
export const unlinkedOfficerLabel = "Chưa liên kết hồ sơ cán bộ";
