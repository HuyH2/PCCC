import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { backendFetch, requirePage } from "@/lib/backend";
import type { FacilityRecord } from "@/lib/facility-contract";
import { FacilityEditForm } from "./facility-edit-form";

export default async function TrangSuaCoSo({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("M03.edit");
  const { id } = await params;
  const response = await backendFetch(`/api/facilities/${encodeURIComponent(id)}`);
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("Không thể tải cơ sở.");
  const { facility } = (await response.json()) as { facility: FacilityRecord };
  return (
    <div className="space-y-5">
      <Link
        href={`/co-so/${encodeURIComponent(id)}`}
        className="text-primary text-sm hover:underline"
      >
        ← Chi tiết cơ sở
      </Link>
      <PageHeader
        title="Cập nhật thông tin cơ sở"
        description={`${facility.id} · ${facility.name}`}
        module="M03"
        useCases={["UC-FAC-02", "UC-FAC-08"]}
      />
      <FacilityEditForm facility={facility} />
    </div>
  );
}
