import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { currentUser } from "@/lib/backend";
import { RegionManager } from "../khu-vuc/region-manager";
import { TransferManager } from "./transfer-manager";

export const metadata = { title: "Phân công và chuyển giao phạm vi" };

export default async function TransferPage() {
  const user = await currentUser();
  if (user.mustChangePassword) redirect("/doi-mat-khau");
  const canAssign = user.permissions.includes("M02.edit") && user.scopes.length > 0;
  const canTransfer =
    user.role === "A05" &&
    user.permissions.includes("M01.view") &&
    user.scopes.some((scope) => scope.kind === "all");
  if (!canAssign && !canTransfer) redirect("/khong-co-quyen");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Phân công và chuyển giao địa bàn"
        description="Phân công cán bộ phụ trách khu phố; khi cán bộ thay đổi công tác, dùng chuyển giao để giữ nguyên lịch sử dữ liệu."
        module="M02"
        useCases={["UC-ORG-03", "UC-ADM-04"]}
      />
      <Tabs defaultValue={canAssign ? "phan-cong" : "chuyen-giao"}>
        <TabsList>
          {canAssign && <TabsTrigger value="phan-cong">Phân công</TabsTrigger>}
          {canTransfer && <TabsTrigger value="chuyen-giao">Chuyển giao</TabsTrigger>}
        </TabsList>
        {canAssign && (
          <TabsContent value="phan-cong">
            <RegionManager
              canEdit={user.permissions.includes("M02.edit")}
              canCreate={user.permissions.includes("M02.create")}
            />
          </TabsContent>
        )}
        {canTransfer && (
          <TabsContent value="chuyen-giao">
            <TransferManager canEdit={user.permissions.includes("M01.edit")} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
