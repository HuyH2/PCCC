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
import { canBoList, donViList } from "@/data/mock";
import { canBoSchema, type CanBoFormValues } from "@/data/schemas";
import type { CanBo } from "@/data/types";

const capBacOptions = ["Đại tá", "Thượng tá", "Trung tá", "Thiếu tá", "Đại úy", "Thượng úy", "Trung úy", "Thiếu úy"];
const trangThaiOptions = ["Đang công tác", "Nghỉ phép", "Chuyển công tác"];
const vaiTroOptions: { ma: string; ten: string }[] = [
  { ma: "A01", ten: "Chỉ huy/Đội trưởng" },
  { ma: "A02", ten: "Phó chỉ huy/Tổ trưởng" },
  { ma: "A03", ten: "Cán bộ kiểm tra/Quản lý địa bàn" },
  { ma: "A04", ten: "Cán bộ tổng hợp" },
  { ma: "A05", ten: "Quản trị hệ thống" },
  { ma: "A06", ten: "Lãnh đạo cấp phòng/Người xem" },
];

/** Biểu mẫu thêm/sửa hồ sơ cán bộ — bảng Master theo lưu ý nghiệp vụ của URD (UC-ORG-02). */
export function CanBoForm({ trigger, canBo }: { trigger: React.ReactNode; canBo?: CanBo }) {
  const { open, setOpen, dangLuu, luu } = useFormDialog();

  const form = useForm<CanBoFormValues>({
    resolver: zodResolver(canBoSchema),
    mode: "onBlur",
    defaultValues: {
      ma: canBo?.ma ?? `KV10-${String(canBoList.length + 1).padStart(3, "0")}`,
      hoTen: canBo?.hoTen ?? "",
      capBac: canBo?.capBac ?? "",
      chucVu: canBo?.chucVu ?? "",
      dienThoai: canBo?.dienThoai ?? "",
      email: canBo?.email ?? "",
      donViId: canBo?.donViId ?? "DV02",
      vaiTro: canBo?.vaiTro ?? "A03",
      trangThai: canBo?.trangThai ?? "Đang công tác",
      ghiChu: canBo?.ghiChu ?? "",
    },
  });

  function onSubmit(values: CanBoFormValues) {
    luu(() => {
      console.info("[demo] Lưu hồ sơ cán bộ:", values);
      toast.success(canBo ? "Đã cập nhật hồ sơ cán bộ" : "Đã thêm cán bộ mới", {
        description: `${values.hoTen} — ${values.chucVu}`,
      });
      form.reset(values);
    });
  }

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      title={canBo ? "Cập nhật hồ sơ cán bộ" : "Thêm cán bộ"}
      description="Bảng Master gồm mã số, họ tên, chức vụ, điện thoại, email và ghi chú. Bảng Detail sẽ bổ sung sau khảo sát chi tiết."
      dangLuu={dangLuu}
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <Form {...form}>
        <FormSection title="Thông tin cán bộ" cols={2}>
          <FormField
            control={form.control}
            name="ma"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Mã số</FormLabel>
                <FormControl>
                  <Input placeholder="KV10-011" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="hoTen"
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
            name="capBac"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Cấp bậc</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn cấp bậc" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {capBacOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
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
            name="chucVu"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Chức vụ</FormLabel>
                <FormControl>
                  <Input placeholder="Cán bộ quản lý địa bàn" {...field} />
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
                <FormLabel required>Điện thoại</FormLabel>
                <FormControl>
                  <Input placeholder="0903 112 007" inputMode="tel" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="an.nv@pc07.gov.vn" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <FormSection title="Đơn vị và phân quyền" cols={2} className="mt-6">
          <FormField
            control={form.control}
            name="donViId"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Đơn vị</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn đơn vị" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {donViList.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.ten}
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
            name="vaiTro"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Vai trò</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn vai trò" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {vaiTroOptions.map((v) => (
                      <SelectItem key={v.ma} value={v.ma}>
                        {v.ma} · {v.ten}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Phạm vi dữ liệu được gán riêng ở màn hình Phân công.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="trangThai"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Trạng thái</FormLabel>
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
                <FormDescription>Cán bộ nghỉ hoặc chuyển công tác chỉ đổi trạng thái, không xóa.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormSpan className="sm:col-span-2">
            <FormField
              control={form.control}
              name="ghiChu"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ghi chú</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Thông tin bổ sung…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSpan>
        </FormSection>
      </Form>
    </FormDialog>
  );
}
