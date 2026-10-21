import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { backendFetch, requirePage } from "@/lib/backend";
import { facilityStatusNames, type FacilityRecord } from "@/lib/facility-contract";

export const metadata = { title: "Danh sách cơ sở" };

export default async function TrangCoSo({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await requirePage("M03.view");
  const query = await searchParams;
  const search = (query.search ?? "").slice(0, 100);
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const response = await backendFetch(
    `/api/facilities?page=${page}&pageSize=20&search=${encodeURIComponent(search)}`,
  );
  if (!response.ok) throw new Error("Không thể tải danh sách cơ sở.");
  const data = (await response.json()) as {
    items: FacilityRecord[];
    total: number;
    pageSize: number;
  };
  const pageUrl = (next: number) => `/co-so?search=${encodeURIComponent(search)}&page=${next}`;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Cơ sở & hồ sơ quản lý"
        description="Danh sách cơ sở trong phạm vi được cấp, lấy từ dữ liệu hệ thống."
        module="M03"
        useCases={["UC-FAC-01", "UC-FAC-08"]}
      />
      <form className="flex flex-wrap gap-2" action="/co-so">
        <label htmlFor="facility-search" className="sr-only">
          Tìm cơ sở
        </label>
        <input
          id="facility-search"
          name="search"
          defaultValue={search}
          maxLength={100}
          placeholder="Tên hoặc địa chỉ cơ sở"
          className="border-input bg-background min-w-60 rounded-md border px-3 py-2 text-sm"
        />
        <button
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm"
          type="submit"
        >
          Tìm kiếm
        </button>
      </form>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[650px] text-left text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-3">Cơ sở</th>
              <th className="p-3">Địa chỉ</th>
              <th className="p-3">Trạng thái</th>
              <th className="p-3">Cán bộ phụ trách</th>
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
                <td className="p-3">{facilityStatusNames[item.status] ?? item.status}</td>
                <td className="p-3">{item.officer_id}</td>
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
      <div className="flex items-center justify-between text-sm">
        <span>
          {data.total} cơ sở · Trang {page}
        </span>
        <div className="flex gap-3">
          {page > 1 && <Link href={pageUrl(page - 1)}>Trang trước</Link>}
          {page * data.pageSize < data.total && <Link href={pageUrl(page + 1)}>Trang sau</Link>}
        </div>
      </div>
    </div>
  );
}
