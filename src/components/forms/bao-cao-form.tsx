"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FileText } from "lucide-react";

import { FormDialog, useFormDialog } from "@/components/forms/form-dialog";
import { FormSection, FormSpan } from "@/components/shared/form-section";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { canBoList, NGAY_HE_THONG } from "@/data/mock";
import { baoCaoSchema, type BaoCaoFormValues } from "@/data/schemas";

const noiNhanOptions = [
  "PC07 - Phòng tham mưu",
  "PC07 - Đội Hướng dẫn kiểm tra",
  "PC07 - Đội tuyên truyền",
  "PC07 - Ban chỉ huy",
  "Ban Giám đốc Công an TP",
  "UBND Quận",
  "UBND Phường",
  "Đội Kv10",
];

function congNgay(n: number) {
  const d = new Date(NGAY_HE_THONG);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Biểu mẫu thêm đầu việc báo cáo và thiết lập cảnh báo hạn (UC-RPT-01, UC-RPT-03). */
export function BaoCaoForm({ trigger }: { trigger: React.ReactNode }) {
  const { open, setOpen, dangLuu, luu } = useFormDialog();

  const form = useForm<BaoCaoFormValues>({
    resolver: zodResolver(baoCaoSchema),
    mode: "onBlur",
    defaultValues: {
      ten: "",
      chuKy: "Tháng",
      noiNhan: "",
      soVanBanYeuCau: "",
      hanNop: congNgay(14),
      nguoiPhuTrachId: "",
      soNgayCanhBao: 5,
      coBieuMau: true,
    },
  });

  const chuKy = form.watch("chuKy");

  function onSubmit(values: BaoCaoFormValues) {
    luu(() => {
      console.info("[demo] Thêm báo cáo:", values);
      toast.success("Đã thêm đầu việc báo cáo", {
        description: `Cảnh báo sẽ bật trước hạn ${values.soNgayCanhBao} ngày và nhắc đến khi nộp xong.`,
      });
      form.reset();
    });
  }

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      title="Thêm báo cáo"
      description="Khai báo đầu việc báo cáo định kỳ hoặc đột xuất kèm nơi nhận, hạn nộp và ngưỡng cảnh báo."
      dangLuu={dangLuu}
      nhanLuu="Thêm báo cáo"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <Form {...form}>
        <FormSection title="Thông tin báo cáo" cols={2}>
          <FormSpan className="sm:col-span-2">
            <FormField
              control={form.control}
              name="ten"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Tên báo cáo</FormLabel>
                  <FormControl>
                    <Input placeholder="Báo cáo kết quả kiểm tra an toàn PCCC tháng" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSpan>

          <FormField
            control={form.control}
            name="chuKy"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Chu kỳ</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {["Tuần", "Tháng", "Quý", "Năm", "Đột xuất"].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  {chuKy === "Đột xuất"
                    ? "Báo cáo đột xuất thường phát sinh từ văn bản đến."
                    : "Báo cáo định kỳ sẽ tự lặp lại ở kỳ kế tiếp."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="noiNhan"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Nơi nhận</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn nơi nhận" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {noiNhanOptions.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Danh mục nơi nhận chính thức cần đơn vị cung cấp (Q10).</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="soVanBanYeuCau"
            render={({ field }) => (
              <FormItem>
                <FormLabel required={chuKy === "Đột xuất"}>Số văn bản yêu cầu</FormLabel>
                <FormControl>
                  <Input placeholder="1123/PC07-P1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="nguoiPhuTrachId"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Người phụ trách</FormLabel>
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
        </FormSection>

        <FormSection title="Hạn nộp và cảnh báo" cols={2} className="mt-6">
          <FormField
            control={form.control}
            name="hanNop"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Hạn nộp</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="soNgayCanhBao"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Số ngày cảnh báo trước</FormLabel>
                <FormControl>
                  <Input type="number" min={1} max={30} {...field} />
                </FormControl>
                <FormDescription>BR-07 — nhắc đến khi báo cáo được nộp hoặc đóng.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormSpan className="sm:col-span-2">
            <FormField
              control={form.control}
              name="coBieuMau"
              render={({ field }) => (
                <FormItem>
                  <label className="hover:bg-accent/40 flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                        className="mt-0.5"
                      />
                    </FormControl>
                    <span className="text-[13px]">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <FileText className="size-3.5" />
                        Báo cáo có biểu mẫu kèm theo
                      </span>
                      <span className="text-muted-foreground">
                        Cán bộ tải biểu mẫu từ hệ thống, điền và nộp lại file kết quả.
                      </span>
                    </span>
                  </label>
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
