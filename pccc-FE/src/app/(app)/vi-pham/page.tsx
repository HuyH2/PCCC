import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { backendFetch, requirePage } from "@/lib/backend";

interface ViolationCase {
  id: number;
  facility_id: string;
  facility_name: string;
  description: string;
  status: "suspended" | "restored";
  suspension_decision_reference: string;
  suspension_at: number;
  suspended_by_name: string;
  remediation_evidence: string | null;
  restoration_decision_reference: string | null;
  approved_by_name: string | null;
  approved_at: number | null;
}

export const metadata = { title: "Vi phạm và đình chỉ" };

export default async function TrangViPham({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requirePage("M03.view");
  const query = await searchParams;
  const status = ["suspended", "restored"].includes(query.status ?? "") ? query.status! : "all";
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const response = await backendFetch(`/api/violations?status=${status}&page=${page}&pageSize=20`);
  if (!response.ok) throw new Error("Không thể tải hồ sơ vi phạm/đình chỉ.");
  const result = (await response.json()) as {
    items: ViolationCase[];
    total: number;
    pageSize: number;
  };
  const pageUrl = (next: number) => `/vi-pham?status=${status}&page=${next}`;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Vi phạm - Đình chỉ - Khắc phục"
        description="Hồ sơ đình chỉ và phê duyệt hoạt động lại lấy trực tiếp từ database cơ sở (BR-09)."
        module="M04"
        useCases={["UC-VIO-02", "UC-VIO-05"]}
      />
      <p className="text-muted-foreground text-sm">
        Để đình chỉ cơ sở hoặc Admin phê duyệt hoạt động lại, mở chi tiết cơ sở và nhập lý do, số
        quyết định cùng hồ sơ khắc phục.
      </p>
      <nav aria-label="Lọc hồ sơ đình chỉ" className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/vi-pham"
          className={status === "all" ? "font-semibold underline" : "hover:underline"}
        >
          Tất cả
        </Link>
        <Link
          href="/vi-pham?status=suspended"
          className={status === "suspended" ? "font-semibold underline" : "hover:underline"}
        >
          Đang đình chỉ
        </Link>
        <Link
          href="/vi-pham?status=restored"
          className={status === "restored" ? "font-semibold underline" : "hover:underline"}
        >
          Đã hoạt động lại
        </Link>
      </nav>
      <div className="space-y-3">
        {result.items.map((item) => (
          <article key={item.id} className="rounded-xl border p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">
                <Link
                  href={`/co-so/${encodeURIComponent(item.facility_id)}`}
                  className="text-primary hover:underline"
                >
                  {item.facility_name}
                </Link>{" "}
                · {item.facility_id}
              </h2>
              <span>{item.status === "suspended" ? "Đang đình chỉ" : "Đã hoạt động lại"}</span>
            </div>
            <p className="mt-2">Lý do: {item.description}</p>
            <p className="text-muted-foreground">
              Đình chỉ: {new Date(item.suspension_at).toLocaleString("vi-VN")} ·{" "}
              {item.suspended_by_name} · Quyết định {item.suspension_decision_reference}
            </p>
            {item.status === "restored" && (
              <>
                <p className="mt-2">Hồ sơ khắc phục: {item.remediation_evidence}</p>
                <p className="text-muted-foreground">
                  Phê duyệt:{" "}
                  {item.approved_at && new Date(item.approved_at).toLocaleString("vi-VN")} ·{" "}
                  {item.approved_by_name} · Quyết định {item.restoration_decision_reference}
                </p>
              </>
            )}
          </article>
        ))}
      </div>
      {result.items.length === 0 && (
        <p className="text-muted-foreground rounded-xl border p-5 text-sm">
          Chưa có hồ sơ phù hợp.
        </p>
      )}
      <div className="flex items-center gap-4 text-sm">
        <span>
          {result.total} hồ sơ · Trang {page}
        </span>
        {page > 1 && <Link href={pageUrl(page - 1)}>Trước</Link>}
        {page * result.pageSize < result.total && <Link href={pageUrl(page + 1)}>Sau</Link>}
      </div>
    </div>
  );
}
