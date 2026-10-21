import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { backendFetch, requirePage } from "@/lib/backend";
import type { FacilityRecord } from "@/lib/facility-contract";
import { FacilityHistoryPanel } from "./facility-history-panel";

export default async function TrangChiTietCoSo({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("M03.view");
  const { id } = await params;
  const response = await backendFetch(`/api/facilities/${encodeURIComponent(id)}`);
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("Không thể tải hồ sơ cơ sở.");
  const { facility } = (await response.json()) as { facility: FacilityRecord };
  return (
    <div className="space-y-5">
      <Link href="/co-so" className="text-primary text-sm hover:underline">
        ← Danh sách cơ sở
      </Link>
      <PageHeader
        title={facility.name}
        description={`${facility.id} · ${facility.address}`}
        module="M03"
        useCases={["UC-FAC-02", "UC-FAC-08"]}
      />
      <FacilityHistoryPanel
        facility={facility}
        canEdit={user.permissions.includes("M03.edit")}
        canSuspend={
          user.permissions.includes("M03.approve") ||
          (user.role === "A05" &&
            user.permissions.includes("M01.edit") &&
            user.scopes.some((scope) => scope.kind === "all"))
        }
        canApproveRestoration={
          user.role === "A05" &&
          user.permissions.includes("M01.edit") &&
          user.scopes.some((scope) => scope.kind === "all")
        }
      />
    </div>
  );
}
