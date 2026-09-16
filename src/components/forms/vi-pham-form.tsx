"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

import { FormDialog, useFormDialog } from "@/components/forms/form-dialog";
import { FormSection, FormSpan } from "@/components/shared/form-section";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { canBoDiaBan, coSoList } from "@/data/mock";
import { viPhamSchema, type ViPhamFormValues } from "@/data/schemas";
import { NGAY_HE_THONG } from "@/data/mock";

const loaiViPhamOptions = [
  "Thiếu hồ sơ/phương án",
  "Hệ thống báo cháy không hoạt động",
  "Lối thoát nạn bị chặn",
  "Thiết bị chữa cháy không đảm bảo",
  "Hoạt động không phép",
  "Không huấn luyện nghiệp vụ",
];

const homNay = NGAY_HE_THONG.toISOString().slice(0, 10);

/** Biểu mẫu ghi nhận vi phạm / lập hồ sơ đình chỉ (UC-VIO-01, UC-VIO-02). */
export function ViPhamForm({ trigger, coSoId }: { trigger: React.ReactNode; coSoId?: string }) {
  const { open, setOpen, dangLuu, luu } = useFormDialog();

  const form = useForm<ViPhamFormValues>({
    resolver: zodResolver(viPhamSchema),
    mode: "onBlur",
    defaultValues: {
      coSoId: coSoId ?? "",
      loai: "",
      mucDo: "Trung bình",
      ngayPhatHien: homNay,
      soQuyetDinh: "",
      dinhChi: false,
      hanKhacPhuc: "",
      canBoTheoDoiId: "",
      noiDung: "",
    },
  });

  const dinhChi = form.watch("dinhChi");

  function onSubmit(values: ViPhamFormValues) {
    luu(() => {
      console.info("[demo] Lưu hồ sơ vi phạm:", values);
      toast.success("Đã ghi nhận hồ sơ vi phạm", {
        description: values.dinhChi
          ? "Cơ sở được chuyển sang trạng thái Đang đình chỉ và hiển thị trên dashboard."
          : "Cơ sở đã được đưa vào danh sách theo dõi khắc phục.",
      });
      form.reset();
    });
  }

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      title="Ghi nhận vi phạm"
      description="Hồ sơ vi phạm là căn cứ để theo dõi khắc phục và phê duyệt hoạt động trở lại (BR-09)."
      dangLuu={dangLuu}
      nhanLuu="Lưu hồ sơ"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <Form {...form}>
        <FormSection title="Thông tin vi phạm" cols={2}>
          <FormSpan className="sm:col-span-2">
            <FormField
              control={form.control}
              name="coSoId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Cơ sở vi phạm</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={Boolean(coSoId)}>
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
                <FormLabel required>Loại vi phạm</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn loại vi phạm" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {loaiViPhamOptions.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Danh mục chính thức cần đơn vị cung cấp (Q07).</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mucDo"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Mức độ</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {["Nhẹ", "Trung bình", "Nghiêm trọng"].map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
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
            name="ngayPhatHien"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Ngày phát hiện</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="canBoTheoDoiId"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Cán bộ theo dõi</FormLabel>
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
                <FormMessage />
              </FormItem>
            )}
          />

          <FormSpan className="sm:col-span-2">
            <FormField
              control={form.control}
              name="noiDung"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Nội dung vi phạm</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Mô tả cụ thể tồn tại, căn cứ pháp lý và yêu cầu khắc phục…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSpan>
        </FormSection>

        <FormSection title="Xử lý và khắc phục" cols={2} className="mt-6">
          <FormSpan className="sm:col-span-2">
            <FormField
              control={form.control}
              name="dinhChi"
              render={({ field }) => (
                <FormItem>
                  <label className="border-destructive/25 bg-destructive/5 flex cursor-pointer items-start gap-2.5 rounded-lg border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                        className="mt-0.5"
                      />
                    </FormControl>
                    <span className="text-[13px]">
                      <span className="text-destructive flex items-center gap-1.5 font-semibold">
                        <ShieldAlert className="size-3.5" />
                        Lập hồ sơ đình chỉ hoạt động
                      </span>
                      <span className="text-muted-foreground">
                        Cơ sở sẽ chuyển sang trạng thái Đang đình chỉ và chỉ hoạt động trở lại sau khi đủ
                        hồ sơ và được phê duyệt (BR-09).
                      </span>
                    </span>
                  </label>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSpan>

          <FormField
            control={form.control}
            name="soQuyetDinh"
            render={({ field }) => (
              <FormItem>
                <FormLabel required={dinhChi}>Số quyết định</FormLabel>
                <FormControl>
                  <Input placeholder="123/QĐ-PC07" {...field} />
                </FormControl>
                <FormDescription>
                  {dinhChi ? "Bắt buộc với hồ sơ đình chỉ." : "Để trống nếu chưa ban hành quyết định."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="hanKhacPhuc"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hạn khắc phục</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormDescription>Hệ thống sẽ cảnh báo trước 3 ngày theo BR-07.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <p className="text-muted-foreground mt-5 text-xs">
          BR-02: hồ sơ không có tài liệu chứng minh thì không được chuyển sang trạng thái hoàn thành.
          Tài liệu đính kèm được tải lên sau khi lưu hồ sơ.
        </p>
      </Form>
    </FormDialog>
  );
}
