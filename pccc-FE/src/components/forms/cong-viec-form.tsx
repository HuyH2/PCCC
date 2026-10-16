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
import { canBoDiaBan, NGAY_HE_THONG } from "@/data/mock";
import { congViecSchema, type CongViecFormValues } from "@/data/schemas";

const homNay = NGAY_HE_THONG.toISOString().slice(0, 10);
function congNgay(n: number) {
  const d = new Date(NGAY_HE_THONG);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Biểu mẫu giao việc cho cán bộ (UC-WRK-02). */
export function CongViecForm({ trigger }: { trigger: React.ReactNode }) {
  const { open, setOpen, dangLuu, luu } = useFormDialog();

  const form = useForm<CongViecFormValues>({
    resolver: zodResolver(congViecSchema),
    mode: "onBlur",
    defaultValues: {
      tieuDe: "",
      loai: "Được giao",
      nguoiThucHienId: "",
      ngayGiao: homNay,
      hanHoanThanh: congNgay(7),
      moTa: "",
    },
  });

  function onSubmit(values: CongViecFormValues) {
    luu(() => {
      console.info("[demo] Giao việc:", values);
      toast.success("Đã giao việc", {
        description: "Cán bộ sẽ nhận thông báo trên chuông nhắc việc.",
      });
      form.reset({ ...form.getValues(), tieuDe: "", moTa: "" });
    });
  }

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      title="Giao việc mới"
      description="Công việc được giao sẽ tính vào KPI của cán bộ và cảnh báo khi sắp đến hạn."
      dangLuu={dangLuu}
      nhanLuu="Giao việc"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <Form {...form}>
        <FormSection title="Nội dung công việc" cols={2}>
          <FormSpan className="sm:col-span-2">
            <FormField
              control={form.control}
              name="tieuDe"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Tiêu đề công việc</FormLabel>
                  <FormControl>
                    <Input placeholder="Ví dụ: Rà soát hồ sơ phương án chữa cháy Khu phố 3" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSpan>

          <FormField
            control={form.control}
            name="loai"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Loại công việc</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {["Thường xuyên", "Đột xuất", "Được giao"].map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
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
            name="nguoiThucHienId"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Người thực hiện</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn cán bộ" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {canBoDiaBan.map((c) => (
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
            name="ngayGiao"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Ngày giao</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="hanHoanThanh"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Hạn hoàn thành</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormDescription>Cảnh báo trước 2 ngày, nhắc đến khi hoàn thành (BR-07).</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormSpan className="sm:col-span-2">
            <FormField
              control={form.control}
              name="moTa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mô tả chi tiết</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Yêu cầu cụ thể, sản phẩm bàn giao, tài liệu kèm theo…" {...field} />
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
