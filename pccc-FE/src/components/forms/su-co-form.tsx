"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormDialog, useFormDialog } from "@/components/forms/form-dialog";
import { FormSection, FormSpan } from "@/components/shared/form-section";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { canBoList, coSoList, donViList, NGAY_HE_THONG } from "@/data/mock";
import { suCoSchema, type SuCoFormValues } from "@/data/schemas";

const phuongList = donViList.filter((d) => d.cap === "Phường");
const homNay = NGAY_HE_THONG.toISOString().slice(0, 10);
function congNgay(n: number) {
  const d = new Date(NGAY_HE_THONG);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const nguyenNhanGoiY = [
  "Sự cố hệ thống điện",
  "Sơ suất trong sử dụng lửa, nhiệt",
  "Rò rỉ khí gas",
  "Chập cháy thiết bị điện tử",
  "Đang điều tra làm rõ",
];

/** Biểu mẫu ghi nhận sự cố cháy/nổ/CNCH/hỗ trợ y tế (UC-INC-01..03). */
export function SuCoForm({ trigger }: { trigger: React.ReactNode }) {
  const { open, setOpen, dangLuu, luu } = useFormDialog();

  const form = useForm<SuCoFormValues>({
    resolver: zodResolver(suCoSchema),
    mode: "onBlur",
    defaultValues: {
      loai: "Cháy",
      ngay: homNay,
      gio: "08:00",
      diaChi: "",
      phuongId: "",
      coSoId: "",
      nguyenNhan: "",
      soNguoiChet: 0,
      soNguoiBiThuong: 0,
      thietHaiTaiSan: 0,
      dienTichChay: 0,
      canBoXuLyId: "",
      hanXuLy: congNgay(15),
    },
  });

  const loai = form.watch("loai");
  const phuongDangChon = form.watch("phuongId");

  const coSoHopLe = React.useMemo(
    () => coSoList.filter((c) => !phuongDangChon || c.phuongId === phuongDangChon).slice(0, 100),
    [phuongDangChon],
  );

  function onSubmit(values: SuCoFormValues) {
    luu(() => {
      console.info("[demo] Ghi nhận sự cố:", values);
      toast.success("Đã ghi nhận sự cố", {
        description: `${values.loai} — hạn xử lý hồ sơ ${values.hanXuLy}.`,
      });
      form.reset();
    });
  }

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      title="Ghi nhận sự cố"
      description="Mỗi sự cố có loại, thời điểm, địa điểm và hạn xử lý hồ sơ (BR-11)."
      dangLuu={dangLuu}
      nhanLuu="Ghi nhận"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <Form {...form}>
        <FormSection title="Thông tin vụ việc" cols={2}>
          <FormField
            control={form.control}
            name="loai"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Loại sự cố</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {["Cháy", "Nổ", "Cứu nạn cứu hộ", "Hỗ trợ y tế", "Sự cố khác"].map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Danh mục sự cố và thời hạn xử lý từng loại cần chốt ở Q11.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="ngay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Ngày xảy ra</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="gio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Giờ</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

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
            name="coSoId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cơ sở liên quan</FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={!phuongDangChon}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={phuongDangChon ? "Chọn nếu có" : "Chọn phường trước"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-72">
                    {coSoHopLe.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.ten}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Để trống nếu sự cố không thuộc cơ sở đang quản lý.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormSpan className="sm:col-span-2">
            <FormField
              control={form.control}
              name="diaChi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Địa chỉ xảy ra</FormLabel>
                  <FormControl>
                    <Input placeholder="Số nhà, tên đường, phường" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSpan>

          <FormSpan className="sm:col-span-2">
            <FormField
              control={form.control}
              name="nguyenNhan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Nguyên nhân</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Nguyên nhân ban đầu hoặc kết luận điều tra…" {...field} />
                  </FormControl>
                  <FormDescription>Gợi ý: {nguyenNhanGoiY.join(" · ")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSpan>
        </FormSection>

        <FormSection title="Thiệt hại" description="Ghi 0 nếu không có thiệt hại" cols={2} className="mt-6">
          <FormField
            control={form.control}
            name="soNguoiChet"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Số người chết</FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="soNguoiBiThuong"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Số người bị thương</FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="thietHaiTaiSan"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Thiệt hại tài sản (triệu đồng)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step="0.1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dienTichChay"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Diện tích cháy (m²)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} disabled={loai !== "Cháy"} {...field} />
                </FormControl>
                <FormDescription>
                  {loai === "Cháy" ? "Diện tích bị cháy ước tính." : "Chỉ áp dụng với sự cố cháy."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <FormSection title="Phân công xử lý hồ sơ" cols={2} className="mt-6">
          <FormField
            control={form.control}
            name="canBoXuLyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Cán bộ xử lý</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn cán bộ" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {canBoList.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.hoTen} — {c.chucVu}
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
            name="hanXuLy"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Hạn xử lý hồ sơ</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>
      </Form>
    </FormDialog>
  );
}
