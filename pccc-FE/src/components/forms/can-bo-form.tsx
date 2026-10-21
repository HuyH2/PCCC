"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FormDialog } from "@/components/forms/form-dialog";
import { FormSection } from "@/components/shared/form-section";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { organizationApi, organizationErrorMessage } from "@/lib/organization-client";
import {
  organizationSelectClass,
  type Officer,
  type OrganizationOptions,
} from "@/lib/organization-contract";

const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} là bắt buộc.`).max(max, `${label} tối đa ${max} ký tự.`);
const officerSchema = z.object({
  officerCode: requiredText("Mã số", 50).regex(
    /^[A-Za-z0-9][A-Za-z0-9._/-]*$/,
    "Mã số chỉ chứa chữ, số và các ký tự . _ / -.",
  ),
  fullName: requiredText("Họ tên", 150),
  rank: requiredText("Cấp bậc", 100),
  position: requiredText("Chức vụ", 150),
  phone: requiredText("Điện thoại", 25).refine(
    (value) =>
      /^\+?[0-9\s()-]+$/.test(value) &&
      value.replace(/\D/g, "").length >= 8 &&
      value.replace(/\D/g, "").length <= 15,
    "Điện thoại cần có 8–15 chữ số, có thể có dấu +, khoảng trắng hoặc dấu phân cách.",
  ),
  email: z
    .string()
    .trim()
    .min(1, "Email là bắt buộc.")
    .email("Email không hợp lệ.")
    .max(254, "Email tối đa 254 ký tự."),
  unitId: requiredText("Đơn vị", 128),
  businessRole: requiredText("Vai trò nghiệp vụ", 128),
  notes: z.string().trim().max(2000, "Ghi chú tối đa 2.000 ký tự."),
});
type OfficerFormValues = z.infer<typeof officerSchema>;

function officerDefaults(officer?: Officer): OfficerFormValues {
  return {
    officerCode: officer?.officerCode ?? "",
    fullName: officer?.fullName ?? "",
    rank: officer?.rank ?? "",
    position: officer?.position ?? "",
    phone: officer?.phone ?? "",
    email: officer?.email ?? "",
    unitId: officer?.unitId ?? "",
    businessRole: officer?.businessRole ?? "",
    notes: officer?.notes ?? "",
  };
}

/** Hồ sơ Master; các trường Detail chưa được URD xác định sẽ bổ sung sau khảo sát. */
export function CanBoForm({
  trigger,
  canBo,
  options,
  onSaved,
}: {
  trigger: React.ReactNode;
  canBo?: Officer;
  options: OrganizationOptions;
  onSaved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<OfficerFormValues>({
    resolver: zodResolver(officerSchema),
    mode: "onBlur",
    defaultValues: officerDefaults(canBo),
  });
  const units = options.units.filter(
    (unit) => unit.status === "ACTIVE" || unit.id === canBo?.unitId,
  );
  const selectedUnitPresent = units.some((unit) => unit.id === canBo?.unitId);
  const selectedRolePresent = options.roles.some((role) => role.code === canBo?.businessRole);

  function changeOpen(next: boolean) {
    if (saving) return;
    if (next) {
      form.reset(officerDefaults(canBo));
      setError(null);
    }
    setOpen(next);
  }

  async function save(values: OfficerFormValues) {
    if (saving) return;
    if (!units.some((unit) => unit.id === values.unitId) && values.unitId !== canBo?.unitId) {
      form.setError("unitId", { message: "Chọn đơn vị trong phạm vi được phép." });
      return;
    }
    if (
      !options.roles.some((role) => role.code === values.businessRole) &&
      values.businessRole !== canBo?.businessRole
    ) {
      form.setError("businessRole", { message: "Chọn vai trò nghiệp vụ hợp lệ." });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const original = officerDefaults(canBo);
      const payload = canBo
        ? Object.fromEntries(
            Object.entries(values).filter(
              ([key, value]) => value !== original[key as keyof OfficerFormValues],
            ),
          )
        : values;
      if (Object.keys(payload).length === 0) {
        setError("Chưa có thông tin thay đổi để lưu.");
        return;
      }
      await organizationApi<{ officer: Officer }>(
        canBo ? `/api/officers/${encodeURIComponent(canBo.id)}` : "/api/officers",
        {
          method: canBo ? "PATCH" : "POST",
          body: payload,
        },
      );
      setOpen(false);
      toast.success(canBo ? "Đã cập nhật hồ sơ cán bộ" : "Đã thêm cán bộ mới");
      onSaved();
    } catch (cause) {
      setError(organizationErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={changeOpen}
      title={canBo ? "Cập nhật hồ sơ cán bộ" : "Thêm cán bộ"}
      description="Nhập thông tin danh bạ, đơn vị và vai trò nghiệp vụ của cán bộ."
      dangLuu={saving}
      onSubmit={form.handleSubmit(save)}
      nhanLuu="Lưu hồ sơ"
    >
      <Form {...form}>
        <fieldset disabled={saving} className="space-y-6">
          {error && (
            <p role="alert" className="text-destructive rounded-md border p-3 text-sm">
              {error}
            </p>
          )}
          <FormSection title="Thông tin cán bộ" cols={2}>
            {(
              [
                ["officerCode", "Mã số", "VD: KV10-011", 50],
                ["fullName", "Họ và tên", "Họ và tên cán bộ", 150],
                ["rank", "Cấp bậc", "VD: Đại úy", 100],
                ["position", "Chức vụ", "VD: Cán bộ quản lý địa bàn", 150],
                ["phone", "Điện thoại", "Số điện thoại liên hệ", 25],
                ["email", "Email", "Địa chỉ email", 254],
              ] as const
            ).map(([name, label, placeholder, maxLength]) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>{label}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={placeholder}
                        maxLength={maxLength}
                        type={name === "email" ? "email" : name === "phone" ? "tel" : "text"}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </FormSection>
          <FormSection title="Đơn vị và vai trò nghiệp vụ" cols={2}>
            <FormField
              control={form.control}
              name="unitId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Đơn vị</FormLabel>
                  <FormControl>
                    <select {...field} className={organizationSelectClass}>
                      <option value="">Chọn đơn vị</option>
                      {canBo && !selectedUnitPresent && (
                        <option value={canBo.unitId}>{canBo.unitName} (đơn vị hiện tại)</option>
                      )}
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                          {unit.status === "INACTIVE" ? " (ngưng hoạt động)" : ""}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="businessRole"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Vai trò nghiệp vụ</FormLabel>
                  <FormControl>
                    <select {...field} className={organizationSelectClass}>
                      <option value="">Chọn vai trò</option>
                      {canBo && !selectedRolePresent && (
                        <option value={canBo.businessRole}>
                          {canBo.businessRole} (vai trò hiện tại)
                        </option>
                      )}
                      {options.roles.map((role) => (
                        <option key={role.code} value={role.code}>
                          {role.code} · {role.name}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormDescription>
                    Vai trò trong hồ sơ cán bộ được lưu riêng với quyền đăng nhập của tài khoản.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Ghi chú</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Thông tin bổ sung (không bắt buộc)"
                      maxLength={2000}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSection>
          <p className="text-muted-foreground text-xs">
            {canBo
              ? "Thay đổi trạng thái công tác bằng chức năng Cập nhật trạng thái trong danh bạ."
              : "Hồ sơ mới được tạo với trạng thái Đang công tác."}
          </p>
        </fieldset>
      </Form>
    </FormDialog>
  );
}
