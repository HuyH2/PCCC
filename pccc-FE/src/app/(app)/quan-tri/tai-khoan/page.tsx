import { KeyRound, Lock, Plus, UserCheck, Users } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canBoTheoId, taiKhoanList } from "@/data/mock";

export const metadata = { title: "Quản lý tài khoản" };

function dinhDangGio(iso: string | null) {
  if (!iso) return "Chưa đăng nhập";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

export default function TrangTaiKhoan() {
  const hoatDong = taiKhoanList.filter((t) => t.trangThai === "Hoạt động").length;
  const chuaPhanCong = taiKhoanList.filter((t) => t.phamViDuLieu === "Chưa phân công").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quản lý tài khoản người dùng"
        description="Tạo, cập nhật và khóa tài khoản cho cán bộ. Không xóa vật lý tài khoản đã phát sinh lịch sử — chỉ chuyển sang trạng thái ngưng (UC-ADM-02)."
        module="M01"
        useCases={["UC-ADM-02", "UC-ADM-04"]}
        actions={
          <Button size="sm">
            <Plus />
            Tạo tài khoản
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng tài khoản" value={taiKhoanList.length} icon={Users} />
        <StatCard label="Đang hoạt động" value={hoatDong} icon={UserCheck} tone="success" />
        <StatCard label="Khóa / ngưng" value={taiKhoanList.length - hoatDong} icon={Lock} />
        <StatCard
          label="Chưa gán phạm vi"
          value={chuaPhanCong}
          icon={KeyRound}
          tone="warning"
          hint="Cần phân công địa bàn để giới hạn dữ liệu"
        />
      </div>

      <SectionCard
        title="Danh sách tài khoản"
        description="Phạm vi dữ liệu quyết định cán bộ nhìn thấy và cập nhật được cơ sở nào (UC-ADM-03)"
        contentClassName="px-0 pb-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên đăng nhập</TableHead>
              <TableHead>Cán bộ</TableHead>
              <TableHead>Vai trò</TableHead>
              <TableHead>Phạm vi dữ liệu</TableHead>
              <TableHead>Đăng nhập gần nhất</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {taiKhoanList.map((tk) => {
              const cb = canBoTheoId.get(tk.canBoId)!;
              return (
                <TableRow key={tk.id}>
                  <TableCell className="font-mono text-xs">{tk.tenDangNhap}</TableCell>
                  <TableCell>
                    <div className="font-medium">{cb.hoTen}</div>
                    <div className="text-muted-foreground text-xs">
                      {cb.capBac} · {cb.chucVu}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{tk.vaiTro}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[230px] text-[13px]">
                    {tk.phamViDuLieu === "Chưa phân công" ? (
                      <Badge variant="warning">Chưa phân công</Badge>
                    ) : (
                      tk.phamViDuLieu
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-[13px] whitespace-nowrap">
                    {dinhDangGio(tk.lanDangNhapCuoi)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={tk.trangThai} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      {tk.trangThai === "Hoạt động" ? "Khóa" : "Mở khóa"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <p className="text-muted-foreground border-t px-3 py-2 text-xs">
          Xác thực bằng tài khoản nội bộ và mật khẩu do Quản trị hệ thống cấp; bắt buộc đổi mật khẩu ở
          lần đăng nhập đầu tiên (UC-ADM-01).
        </p>
      </SectionCard>
    </div>
  );
}
