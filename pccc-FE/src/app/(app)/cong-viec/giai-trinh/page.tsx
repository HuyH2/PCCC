import { FileSearch, MessageSquareReply, Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { canBoTheoId, congViecList, giaiTrinhList } from "@/data/mock";
import { thongKeGiaiTrinh } from "@/data/thong-ke";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Yêu cầu giải trình" };

export default function TrangGiaiTrinh() {
  const daChapNhan = giaiTrinhList.filter((g) => g.trangThai === "Đã chấp nhận").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Yêu cầu và phản hồi giải trình"
        description="Chỉ huy có thể yêu cầu cán bộ giải trình khi công việc chậm tiến độ hoặc nợ chỉ tiêu; cán bộ phản hồi bằng nội dung và/hoặc văn bản đính kèm (BR-06)."
        module="M07"
        useCases={["UC-WRK-05"]}
        actions={
          <Button size="sm">
            <Plus />
            Yêu cầu giải trình
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng yêu cầu" value={thongKeGiaiTrinh.tong} icon={FileSearch} />
        <StatCard label="Chờ giải trình" value={thongKeGiaiTrinh.choPhanHoi} icon={FileSearch} tone="warning" />
        <StatCard label="Đã phản hồi" value={thongKeGiaiTrinh.daPhanHoi} icon={MessageSquareReply} tone="info" />
        <StatCard label="Đã chấp nhận" value={daChapNhan} icon={MessageSquareReply} tone="success" />
      </div>

      {giaiTrinhList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">Chưa có yêu cầu giải trình nào.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {giaiTrinhList.map((g) => {
            const cv = congViecList.find((c) => c.id === g.congViecId)!;
            return (
              <SectionCard
                key={g.id}
                title={cv.tieuDe}
                description={`${cv.ma} · hạn ${formatDate(cv.hanHoanThanh)} · ${cv.loai.toLowerCase()}`}
                action={<StatusBadge value={g.trangThai} />}
                contentClassName="space-y-3"
              >
                <div className="bg-destructive/5 border-destructive/20 rounded-lg border p-3">
                  <div className="text-destructive mb-1 flex items-center gap-1.5 text-xs font-semibold">
                    <FileSearch className="size-3.5" />
                    Yêu cầu từ {canBoTheoId.get(g.nguoiYeuCauId)?.hoTen} · {formatDate(g.ngayYeuCau)}
                  </div>
                  <p className="text-[13px]">{g.noiDungYeuCau}</p>
                </div>

                {g.noiDungPhanHoi ? (
                  <div className="bg-muted/60 rounded-lg border p-3">
                    <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-semibold">
                      <MessageSquareReply className="size-3.5" />
                      Phản hồi của {canBoTheoId.get(g.nguoiGiaiTrinhId)?.hoTen}
                    </div>
                    <p className="text-[13px]">{g.noiDungPhanHoi}</p>
                  </div>
                ) : (
                  <div className="border-warning/40 bg-warning/8 rounded-lg border border-dashed p-3 text-center">
                    <p className="text-muted-foreground text-[13px]">
                      Cán bộ <strong className="text-foreground">{canBoTheoId.get(g.nguoiGiaiTrinhId)?.hoTen}</strong>{" "}
                      chưa gửi nội dung giải trình.
                    </p>
                  </div>
                )}

                {g.trangThai === "Đã phản hồi" && (
                  <>
                    <Separator />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm">
                        Không chấp nhận
                      </Button>
                      <Button size="sm">Chấp nhận giải trình</Button>
                    </div>
                  </>
                )}
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
