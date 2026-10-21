import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { backendFetch, requirePage } from "@/lib/backend";
import {
  facilityStatusNames,
  type FacilityOptions,
  type FacilityRecord,
} from "@/lib/facility-contract";

export const metadata = { title: "Danh sách cơ sở" };

export default async function TrangCoSo({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    page?: string;
    regionId?: string;
    officerId?: string;
    status?: string;
  }>;
}) {
  const user = await requirePage("M03.view");
  const query = await searchParams;
  const search = (query.search ?? "").slice(0, 100);
  const regionId = query.regionId ?? "";
  const officerId = query.officerId ?? "";
  const status = query.status ?? "";
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const params = new URLSearchParams({ page: String(page), pageSize: "20", search });
  if (regionId) params.set("regionId", regionId);
  if (officerId) params.set("officerId", officerId);
  if (status) params.set("status", status);
  const [response, optionsResponse] = await Promise.all([
    backendFetch(`/api/facilities?${params}`),
    backendFetch("/api/facilities/options"),
  ]);
  if (!response.ok) throw new Error("Không thể tải danh sách cơ sở.");
  if (!optionsResponse.ok) throw new Error("Không thể tải bộ lọc cơ sở.");
  const data = (await response.json()) as {
    items: FacilityRecord[];
    total: number;
    pageSize: number;
  };
  const options = (await optionsResponse.json()) as FacilityOptions;
  const pageUrl = (next: number) => {
    const nextParams = new URLSearchParams(params);
    nextParams.set("page", String(next));
    return `/co-so?${nextParams}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cơ sở & hồ sơ quản lý"
        description="Danh sách cơ sở trong phạm vi được cấp, lấy từ dữ liệu hệ thống."
        module="M03"
        useCases={["UC-FAC-01"]}
      />
      <form className="flex flex-wrap items-end gap-2" action="/co-so">
        <div className="min-w-56 flex-1">
          <label htmlFor="facility-search" className="mb-1 block text-sm font-medium">
            Tìm tên hoặc địa chỉ
          </label>
          <input
            id="facility-search"
            name="search"
            defaultValue={search}
            maxLength={100}
            className="border-input bg-background min-h-10 w-full rounded-md border px-3 text-base"
          />
        </div>
        <div className="min-w-48">
          <label htmlFor="facility-region-filter" className="mb-1 block text-sm font-medium">
            Khu vực
          </label>
          <select
            id="facility-region-filter"
            name="regionId"
            defaultValue={regionId}
            className="border-input bg-background min-h-10 w-full rounded-md border px-3 text-base"
          >
            <option value="">Tất cả khu vực</option>
            {options.regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-44">
          <label htmlFor="facility-status-filter" className="mb-1 block text-sm font-medium">
            Trạng thái
          </label>
          <select
            id="facility-status-filter"
            name="status"
            defaultValue={status}
            className="border-input bg-background min-h-10 w-full rounded-md border px-3 text-base"
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(facilityStatusNames).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-52">
          <label htmlFor="facility-officer-filter" className="mb-1 block text-sm font-medium">
            Cán bộ phụ trách
          </label>
          <select
            id="facility-officer-filter"
            name="officerId"
            defaultValue={officerId}
            className="border-input bg-background min-h-10 w-full rounded-md border px-3 text-base"
          >
            <option value="">Tất cả cán bộ</option>
            {options.officers.map((officer) => (
              <option key={officer.id} value={officer.id}>
                {officer.full_name}
              </option>
            ))}
          </select>
        </div>
        <button
          className="bg-primary text-primary-foreground min-h-10 rounded-md px-4 text-sm"
          type="submit"
        >
          Tìm kiếm
        </button>
        {user.permissions.includes("M03.create") && (
          <Link
            href="/co-so/them"
            className="border-input min-h-10 rounded-md border px-4 py-2 text-sm font-medium"
          >
            Thêm cơ sở
          </Link>
        )}
      </form>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-3">Cơ sở</th>
              <th className="p-3">Địa chỉ</th>
              <th className="p-3">Khu vực</th>
              <th className="p-3">Cán bộ phụ trách</th>
              <th className="p-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="p-3">
                  <Link
                    className="text-primary font-medium underline-offset-2 hover:underline"
                    href={`/co-so/${encodeURIComponent(item.id)}`}
                  >
                    {item.name}
                  </Link>
                  <div className="text-muted-foreground text-xs">{item.id}</div>
                </td>
                <td className="p-3">{item.address}</td>
                <td className="p-3">{item.region_name}</td>
                <td className="p-3">{item.officer_name ?? item.officer_id}</td>
                <td className="p-3">{facilityStatusNames[item.status] ?? item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.items.length === 0 && (
          <p className="text-muted-foreground p-5 text-sm">
            Không tìm thấy cơ sở trong phạm vi của bạn.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span>
          {data.total} cơ sở - Trang {page}
        </span>
        <div className="flex gap-3">
          {page > 1 && <Link href={pageUrl(page - 1)}>Trang trước</Link>}
          {page * data.pageSize < data.total && <Link href={pageUrl(page + 1)}>Trang sau</Link>}
        </div>
      </div>
    </div>
  );
}
