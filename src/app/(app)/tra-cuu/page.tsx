"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2, ClipboardCheck, FileSpreadsheet, Scale, Search, ShieldAlert, Siren, Users,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  baoCaoList, canBoList, canBoTheoId, coSoList, coSoTheoId, cuocKiemTraList,
  khuVucTheoId, suCoList, vanBanList, viPhamList,
} from "@/data/mock";
import { deaccent, formatDate } from "@/lib/utils";

const GOI_Y = ["karaoke", "đình chỉ", "Hòa Hưng", "trạm xăng", "chung cư", "0903"];

export default function TrangTraCuu() {
  const [tuKhoa, setTuKhoa] = React.useState("");
  const q = deaccent(tuKhoa.trim());
  const coTuKhoa = q.length >= 2;

  const ketQua = React.useMemo(() => {
    if (!coTuKhoa) return null;
    return {
      coSo: coSoList.filter(
        (c) => deaccent(c.ten).includes(q) || deaccent(c.diaChi).includes(q) || c.ma.toLowerCase().includes(q) || deaccent(c.loaiHinh).includes(q),
      ).slice(0, 30),
      canBo: canBoList.filter(
        (c) => deaccent(c.hoTen).includes(q) || deaccent(c.chucVu).includes(q) || c.ma.toLowerCase().includes(q) || c.dienThoai.replace(/\s/g, "").includes(q),
      ),
      viPham: viPhamList.filter((v) => {
        const cs = coSoTheoId.get(v.coSoId);
        return v.ma.toLowerCase().includes(q) || deaccent(v.loai).includes(q) || (cs ? deaccent(cs.ten).includes(q) : false);
      }).slice(0, 20),
      kiemTra: cuocKiemTraList.filter((k) => {
        const cs = coSoTheoId.get(k.coSoId);
        return k.ma.toLowerCase().includes(q) || (cs ? deaccent(cs.ten).includes(q) : false);
      }).slice(0, 20),
      suCo: suCoList.filter((s) => s.ma.toLowerCase().includes(q) || deaccent(s.diaChi).includes(q) || deaccent(s.nguyenNhan).includes(q)).slice(0, 20),
      baoCao: baoCaoList.filter((b) => deaccent(b.ten).includes(q) || b.ma.toLowerCase().includes(q) || deaccent(b.noiNhan).includes(q)).slice(0, 20),
      vanBan: vanBanList.filter((v) => deaccent(v.trichYeu).includes(q) || v.soKyHieu.toLowerCase().includes(q)),
    };
  }, [q, coTuKhoa]);

  const tong = ketQua
    ? ketQua.coSo.length + ketQua.canBo.length + ketQua.viPham.length + ketQua.kiemTra.length + ketQua.suCo.length + ketQua.baoCao.length + ketQua.vanBan.length
    : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tra cứu toàn hệ thống"
        description="Tìm nhanh cơ sở, cán bộ, hồ sơ vi phạm, cuộc kiểm tra, sự cố, báo cáo và văn bản. Hỗ trợ tìm không dấu; kết quả được giới hạn theo phạm vi dữ liệu của người dùng."
        module="M10"
        useCases={["UC-SYS-01"]}
      />

      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2" />
            <Input
              autoFocus
              value={tuKhoa}
              onChange={(e) => setTuKhoa(e.target.value)}
              placeholder="Nhập tên cơ sở, địa chỉ, tên cán bộ, số điện thoại, mã hồ sơ…"
              className="h-12 pl-11 text-base"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs">Gợi ý:</span>
            {GOI_Y.map((g) => (
              <button
                key={g}
                onClick={() => setTuKhoa(g)}
                className="border-border hover:border-primary hover:text-primary cursor-pointer rounded-full border px-2.5 py-0.5 text-xs transition-colors"
              >
                {g}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {!coTuKhoa ? (
        <Card>
          <CardContent className="py-14">
            <EmptyState
              icon={Search}
              title="Nhập từ khóa để bắt đầu tra cứu"
              description="Cần ít nhất 2 ký tự. Hệ thống tìm đồng thời trên cơ sở, cán bộ, vi phạm, kiểm tra, sự cố, báo cáo và văn bản."
            />
          </CardContent>
        </Card>
      ) : tong === 0 ? (
        <Card>
          <CardContent className="py-14">
            <EmptyState
              title={`Không tìm thấy kết quả cho “${tuKhoa}”`}
              description="Thử rút ngắn từ khóa hoặc bỏ dấu tiếng Việt."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            Tìm thấy <strong className="text-foreground font-semibold">{tong}</strong> kết quả cho{" "}
            <strong className="text-foreground">“{tuKhoa}”</strong>
          </p>

          <Tabs defaultValue="co-so">
            <TabsList className="flex-wrap">
              <TabsTrigger value="co-so">
                <Building2 /> Cơ sở
                <Badge variant="secondary">{ketQua!.coSo.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="can-bo">
                <Users /> Cán bộ
                <Badge variant="secondary">{ketQua!.canBo.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="vi-pham">
                <ShieldAlert /> Vi phạm
                <Badge variant="secondary">{ketQua!.viPham.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="kiem-tra">
                <ClipboardCheck /> Kiểm tra
                <Badge variant="secondary">{ketQua!.kiemTra.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="su-co">
                <Siren /> Sự cố
                <Badge variant="secondary">{ketQua!.suCo.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="bao-cao">
                <FileSpreadsheet /> Báo cáo
                <Badge variant="secondary">{ketQua!.baoCao.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="van-ban">
                <Scale /> Văn bản
                <Badge variant="secondary">{ketQua!.vanBan.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="co-so" className="space-y-2">
              {ketQua!.coSo.map((cs) => (
                <Link key={cs.id} href={`/co-so/${cs.id}`}>
                  <Card className="hover:border-primary/50 gap-0 p-3 transition-colors">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold">{cs.ten}</span>
                      <StatusBadge value={cs.trangThai} />
                      <Badge variant="outline">{cs.loaiHinh}</Badge>
                      <span className="text-muted-foreground ml-auto font-mono text-xs">{cs.ma}</span>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-[13px]">
                      {cs.diaChi} · {khuVucTheoId.get(cs.khuVucId)?.ten} · CB:{" "}
                      {canBoTheoId.get(cs.canBoPhuTrachId)?.hoTen}
                    </p>
                  </Card>
                </Link>
              ))}
            </TabsContent>

            <TabsContent value="can-bo" className="space-y-2">
              {ketQua!.canBo.map((cb) => (
                <Card key={cb.id} className="gap-0 p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-semibold">{cb.hoTen}</span>
                    <Badge variant="secondary">{cb.vaiTro}</Badge>
                    <StatusBadge value={cb.trangThai} />
                    <span className="text-muted-foreground ml-auto font-mono text-xs">{cb.ma}</span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-[13px]">
                    {cb.capBac} · {cb.chucVu} ·{" "}
                    <a href={`tel:${cb.dienThoai.replace(/\s/g, "")}`} className="text-primary hover:underline">
                      {cb.dienThoai}
                    </a>
                  </p>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="vi-pham" className="space-y-2">
              {ketQua!.viPham.map((v) => {
                const cs = coSoTheoId.get(v.coSoId)!;
                return (
                  <Link key={v.id} href={`/co-so/${cs.id}`}>
                    <Card className="hover:border-primary/50 gap-0 p-3 transition-colors">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-mono text-xs">{v.ma}</span>
                        <span className="font-semibold">{cs.ten}</span>
                        <StatusBadge value={v.trangThai} />
                        <StatusBadge value={v.mucDo} />
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-[13px]">
                        {v.loai} · phát hiện {formatDate(v.ngayPhatHien)}
                        {v.soQuyetDinh && ` · QĐ ${v.soQuyetDinh}`}
                      </p>
                    </Card>
                  </Link>
                );
              })}
            </TabsContent>

            <TabsContent value="kiem-tra" className="space-y-2">
              {ketQua!.kiemTra.map((k) => {
                const cs = coSoTheoId.get(k.coSoId)!;
                return (
                  <Card key={k.id} className="gap-0 p-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono text-xs">{k.ma}</span>
                      <span className="font-semibold">{cs.ten}</span>
                      <StatusBadge value={k.loai} />
                      <StatusBadge value={k.trangThai} />
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-[13px]">
                      Ngày {formatDate(k.ngayKiemTra)} · trưởng đoàn{" "}
                      {canBoTheoId.get(k.truongDoanId)?.hoTen}
                      {k.soBienBan && ` · biên bản ${k.soBienBan}`}
                    </p>
                  </Card>
                );
              })}
            </TabsContent>

            <TabsContent value="su-co" className="space-y-2">
              {ketQua!.suCo.map((s) => (
                <Card key={s.id} className="gap-0 p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-xs">{s.ma}</span>
                    <span className="font-semibold">{s.loai}</span>
                    <StatusBadge value={s.trangThai} />
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-[13px]">
                    {s.diaChi} · {s.nguyenNhan}
                  </p>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="bao-cao" className="space-y-2">
              {ketQua!.baoCao.map((b) => (
                <Card key={b.id} className="gap-0 p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-xs">{b.ma}</span>
                    <span className="font-semibold">{b.ten}</span>
                    <StatusBadge value={b.trangThai} />
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-[13px]">
                    Nơi nhận: {b.noiNhan} · hạn {formatDate(b.hanNop)} · chu kỳ {b.chuKy.toLowerCase()}
                  </p>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="van-ban" className="space-y-2">
              {ketQua!.vanBan.map((v) => (
                <Card key={v.id} className="gap-0 p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-xs">{v.soKyHieu}</span>
                    <span className="font-semibold">{v.trichYeu}</span>
                    <Badge variant={v.conHieuLuc ? "success" : "muted"}>
                      {v.conHieuLuc ? "Còn hiệu lực" : "Hết hiệu lực"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-[13px]">
                    {v.loai} · {v.coQuanBanHanh} · hiệu lực từ {formatDate(v.ngayHieuLuc)}
                  </p>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
