"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Send } from "lucide-react";

import { FormDialog, useFormDialog } from "@/components/forms/form-dialog";
import { FormSection, FormSpan } from "@/components/shared/form-section";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { canBoDiaBan, coSoList, NGAY_HE_THONG } from "@/data/mock";
import { cuocKiemTraSchema, type CuocKiemTraFormValues } from "@/data/schemas";

function congNgay(n: number) {
  const d = new Date(NGAY_HE_THONG);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Biểu mẫu tạo hồ sơ cuộc kiểm tra định kỳ/đột xuất (UC-INS-03, UC-INS-09). */
export function CuocKiemTraForm({ trigger }: { trigger: React.ReactNode }) {
  const { open, setOpen, dangLuu, luu } = useFormDialog();

  const form = useForm<CuocKiemTraFormValues>({
    resolver: zodResolver(cuocKiemTraSchema),
    mode: "onBlur",
    defaultValues: {
      coSoId: "",
      loai: "Định kỳ",
      ngayKiemTra: congNgay(7),
      truongDoanId: "",
      noiDung: "",
      thongBaoTruoc: true,
    },
  });

  function onSubmit(values: CuocKiemTraFormValues) {
    luu(() => {
      console.info("[demo] Tạo cuộc kiểm tra:", values);
      toast.success("Đã tạo hồ sơ cuộc kiểm tra", {
        description: values.thongBaoTruoc
          ? "Trạng thái: Đã thông báo — thông báo kiểm tra đã được lập cho cơ sở."
          : "Trạng thái: Lên kế hoạch — chưa gửi thông báo cho cơ sở.",
      });
      form.reset();
    });
  }

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      title="Tạo cuộc kiểm tra"
      description="Hồ sơ cuộc kiểm tra gồm quyết định đoàn, thông báo, checklist, biên bản và kết quả hậu kiểm."
      dangLuu={dangLuu}
      nhanLuu="Tạo hồ sơ"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <Form {...form}>
        <FormSection title="Thông tin cuộc kiểm tra" cols={2}>
          <FormSpan className="sm:col-span-2">
            <FormField
              control={form.control}
              name="coSoId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Cơ sở được kiểm tra</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn cơ sở" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-72">
                      {coSoList.slice(0, 120).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.ten} — {c.diaChi}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <FormLabel required>Loại kiểm tra</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {["Định kỳ", "Đột xuất", "Chuyên đề"].map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Kiểm tra đột xuất tính ngoài chỉ tiêu tối thiểu (BR-04).</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ngayKiemTra"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Ngày kiểm tra</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormSpan className="sm:col-span-2">
            <FormField
              control={form.control}
              name="truongDoanId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Trưởng đoàn kiểm tra</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn trưởng đoàn" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {canBoDiaBan.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.capBac} {c.hoTen} — {c.chucVu}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSpan>

          <FormSpan className="sm:col-span-2">
            <FormField
              control={form.control}
              name="noiDung"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Nội dung kiểm tra</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Phạm vi, nội dung trọng tâm và căn cứ pháp lý của cuộc kiểm tra…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSpan>

          <FormSpan className="sm:col-span-2">
            <FormField
              control={form.control}
              name="thongBaoTruoc"
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
                        <Send className="size-3.5" />
                        Lập thông báo kiểm tra gửi cơ sở
                      </span>
                      <span className="text-muted-foreground">
                        Bỏ chọn với kiểm tra đột xuất không báo trước. Hồ sơ sẽ ở trạng thái Lên kế hoạch.
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
