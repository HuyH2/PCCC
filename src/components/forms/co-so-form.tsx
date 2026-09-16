"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Save, SaveAll } from "lucide-react";

import { FormSection, FormSpan } from "@/components/shared/form-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { canBoDiaBan, coSoList, donViList, khuVucList } from "@/data/mock";
import { coSoSchema, type CoSoFormValues } from "@/data/schemas";
import type { CoSo } from "@/data/types";
import { deaccent } from "@/lib/utils";

const loaiHinhOptions = [
  "Chung cư/Nhà cao tầng", "Chợ/Trung tâm thương mại", "Cơ sở giáo dục", "Cơ sở y tế",
  "Khách sạn/Nhà nghỉ", "Karaoke/Vũ trường", "Nhà xưởng/Kho", "Trạm xăng dầu",
  "Văn phòng/Trụ sở", "Nhà ở kết hợp kinh doanh",
];

const trangThaiOptions = ["Đang hoạt động", "Đang đình chỉ", "Tạm ngừng", "Không phép"];

const phuongList = donViList.filter((d) => d.cap === "Phường");

/**
 * Biểu mẫu tạo mới / cập nhật hồ sơ cơ sở (UC-FAC-02).
 *
 * - Cho phép "Lưu nháp" bỏ qua ràng buộc, hoặc "Lưu chính thức" bắt buộc đủ trường (BR-02).
 * - Cảnh báo trùng theo tên + địa chỉ trước khi lưu.
 * - Khu phố được lọc lại theo phường đang chọn.
 */
export function CoSoForm({ coSo }: { coSo?: CoSo }) {
  const router = useRouter();
  const laSua = Boolean(coSo);
  const [dangLuu, setDangLuu] = React.useState(false);

  const form = useForm<CoSoFormValues>({
    resolver: zodResolver(coSoSchema),
    mode: "onBlur",
    defaultValues: {
      ten: coSo?.ten ?? "",
      diaChi: coSo?.diaChi ?? "",
      loaiHinh: coSo?.loaiHinh ?? "",
      phuongId: coSo?.phuongId ?? "",
      khuVucId: coSo?.khuVucId ?? "",
      canBoPhuTrachId: coSo?.canBoPhuTrachId ?? "",
      trangThai: coSo?.trangThai ?? "Đang hoạt động",
      nguoiDungDau: coSo?.nguoiDungDau ?? "",
      dienThoai: coSo?.dienThoai ?? "",
      soTang: coSo?.soTang ?? 1,
      dienTich: coSo?.dienTich ?? 0,
      ngayKiemTraGanNhat: coSo?.ngayKiemTraGanNhat ?? "",
      ngayKiemTraKeTiep: coSo?.ngayKiemTraKeTiep ?? "",
      ghiChu: "",
    },
  });

  const phuongDangChon = form.watch("phuongId");
  const tenDangNhap = form.watch("ten");
  const diaChiDangNhap = form.watch("diaChi");

  const khuPhoHopLe = React.useMemo(
    () => khuVucList.filter((k) => !phuongDangChon || k.phuongId === phuongDangChon),
    [phuongDangChon],
  );

  // Khi đổi phường, bỏ khu phố cũ nếu không còn thuộc phường mới
  React.useEffect(() => {
    const kvHienTai = form.getValues("khuVucId");
    if (kvHienTai && !khuPhoHopLe.some((k) => k.id === kvHienTai)) {
      form.setValue("khuVucId", "");
    }
  }, [khuPhoHopLe, form]);

  // Cảnh báo trùng theo tên + địa chỉ (UC-FAC-02, luồng ngoại lệ)
  const coSoTrung = React.useMemo(() => {
    const ten = deaccent(tenDangNhap ?? "").trim();
    const diaChi = deaccent(diaChiDangNhap ?? "").trim();
    if (ten.length < 3 || diaChi.length < 5) return null;
    return (
      coSoList.find(
        (c) => c.id !== coSo?.id && deaccent(c.ten).trim() === ten && deaccent(c.diaChi).trim() === diaChi,
      ) ?? null
    );
  }, [tenDangNhap, diaChiDangNhap, coSo?.id]);

  function luuChinhThuc(values: CoSoFormValues) {
    setDangLuu(true);
    // Bản demo chưa có API — ghi log và điều hướng như khi lưu thành công.
    console.info("[demo] Lưu chính thức hồ sơ cơ sở:", values);
    setTimeout(() => {
      setDangLuu(false);
      toast.success(laSua ? "Đã cập nhật hồ sơ cơ sở" : "Đã tạo hồ sơ cơ sở", {
        description: `${values.ten} — đã ghi lịch sử thay đổi theo BR-03.`,
      });
      router.push(coSo ? `/co-so/${coSo.id}` : "/co-so");
    }, 500);
  }

  function luuNhap() {
    const values = form.getValues();
    console.info("[demo] Lưu nháp hồ sơ cơ sở:", values);
    toast.info("Đã lưu nháp", {
      description: "Hồ sơ nháp chưa tính vào thống kê cho đến khi lưu chính thức.",
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(luuChinhThuc)} className="space-y-5">
        {coSoTrung && (
          <div className="border-warning/40 bg-warning/8 flex items-start gap-2.5 rounded-xl border p-3 text-[13px]">
            <AlertTriangle className="text-warning-foreground mt-0.5 size-4 shrink-0" />
            <p className="text-muted-foreground">
              <strong className="text-foreground font-semibold">Cảnh báo trùng dữ liệu:</strong> đã có cơ
              sở <strong className="text-foreground">{coSoTrung.ten}</strong> ({coSoTrung.ma}) cùng tên và
              địa chỉ. Kiểm tra lại trước khi lưu để tránh dữ liệu kép (BR-01).
            </p>
          </div>
        )}

        <Card>
          <CardContent className="space-y-7 pt-5">
            <FormSection
              title="Thông tin chung"
              description="Các trường có dấu * là bắt buộc khi lưu chính thức"
              cols={3}
            >
              <FormSpan>
                <FormField
                  control={form.control}
                  name="ten"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Tên cơ sở</FormLabel>
                      <FormControl>
                        <Input placeholder="Ví dụ: Chung cư Hoa Sen 3" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSpan>

              <FormSpan>
                <FormField
                  control={form.control}
                  name="diaChi"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Địa chỉ</FormLabel>
                      <FormControl>
                        <Input placeholder="Số nhà, tên đường, phường" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSpan>

              <FormField
                control={form.control}
                name="loaiHinh"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Loại hình cơ sở</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Chọn loại hình" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {loaiHinhOptions.map((l) => (
                          <SelectItem key={l} value={l}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Danh mục loại hình chính thức cần đơn vị cung cấp (Q04).</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="trangThai"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Trạng thái hoạt động</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Chọn trạng thái" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {trangThaiOptions.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="soTang"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Số tầng</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dienTich"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Diện tích (m²)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormSection>

            <FormSection title="Địa bàn và phân công" cols={3}>
              <FormField
                control={form.control}
                name="phuongId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Phường</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Chọn phường" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {phuongList.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.ten}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="khuVucId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Khu phố</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={!phuongDangChon}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={phuongDangChon ? "Chọn khu phố" : "Chọn phường trước"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {khuPhoHopLe.map((k) => (
                          <SelectItem key={k.id} value={k.id}>
                            {k.ten}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="canBoPhuTrachId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Cán bộ phụ trách</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Chọn cán bộ" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {canBoDiaBan.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.hoTen} — {c.capBac}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Mỗi cơ sở có đúng một cán bộ phụ trách.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormSection>

            <FormSection title="Người đứng đầu cơ sở" cols={3}>
              <FormField
                control={form.control}
                name="nguoiDungDau"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Họ và tên</FormLabel>
                    <FormControl>
                      <Input placeholder="Nguyễn Văn An" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dienThoai"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Điện thoại liên hệ</FormLabel>
                    <FormControl>
                      <Input placeholder="0903 112 007" inputMode="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormSection>

            <FormSection title="Kiểm tra định kỳ" cols={3}>
              <FormField
                control={form.control}
                name="ngayKiemTraGanNhat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ngày kiểm tra gần nhất</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ngayKiemTraKeTiep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ngày kiểm tra kế tiếp (dự kiến)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>Chu kỳ kiểm tra theo loại hình cần chốt ở Q08.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormSpan>
                <FormField
                  control={form.control}
                  name="ghiChu"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ghi chú</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Thông tin bổ sung về cơ sở…" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSpan>
            </FormSection>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            <ArrowLeft />
            Hủy
          </Button>
          <Button type="button" variant="outline" onClick={luuNhap}>
            <Save />
            Lưu nháp
          </Button>
          <Button type="submit" disabled={dangLuu}>
            <SaveAll />
            {dangLuu ? "Đang lưu…" : "Lưu chính thức"}
          </Button>
        </div>

        <p className="text-muted-foreground text-xs">
          Theo BR-02, hồ sơ thiếu trường bắt buộc chỉ được lưu nháp, không được lưu chính thức. Mọi thay
          đổi đều ghi lại người thực hiện và thời gian (BR-03).
        </p>
      </form>
    </Form>
  );
}
