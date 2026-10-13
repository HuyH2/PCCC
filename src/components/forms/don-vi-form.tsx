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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { organizationApi, organizationErrorMessage } from "@/lib/organization-client";
import {
  organizationLevelNames,
  organizationPath,
  organizationSelectClass,
  type OrganizationNode,
  type OrganizationOptions,
} from "@/lib/organization-contract";

const unitSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Mã đơn vị là bắt buộc.")
    .max(50, "Mã đơn vị tối đa 50 ký tự.")
    .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, "Mã đơn vị chỉ chứa chữ, số và các ký tự . _ / -."),
  name: z
    .string()
    .trim()
    .min(1, "Tên đơn vị là bắt buộc.")
    .max(200, "Tên đơn vị tối đa 200 ký tự."),
  level: z.enum(["AREA", "WARD", "NEIGHBORHOOD"]),
  parentId: z.string().min(1, "Chọn đơn vị cha."),
  leaderOfficerId: z.string(),
  notes: z.string().trim().max(2000, "Ghi chú tối đa 2.000 ký tự."),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
type UnitFormValues = z.infer<typeof unitSchema>;

function defaults(node?: OrganizationNode): UnitFormValues {
  return {
    code: node?.code ?? "",
    name: node?.name ?? "",
    level: node && node.level !== "ROOT" ? node.level : "AREA",
    parentId: node?.parentId ?? "",
    leaderOfficerId: node?.leaderHidden ? "__KEEP__" : (node?.leaderOfficerId ?? ""),
    notes: node?.notes ?? "",
    status: node?.status ?? "ACTIVE",
  };
}

export function DonViForm({
  trigger,
  donVi,
  options,
  onSaved,
}: {
  trigger: React.ReactNode;
  donVi?: OrganizationNode;
  options: OrganizationOptions;
  onSaved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    mode: "onBlur",
    defaultValues: defaults(donVi),
  });
  const level = form.watch("level");
  const expectedParentLevel = level === "AREA" ? "ROOT" : level === "WARD" ? "AREA" : "WARD";
  const parents = options.units.filter(
    (unit) =>
      unit.id !== donVi?.id && unit.level === expectedParentLevel && unit.status === "ACTIVE",
  );
  const existingParentPresent = parents.some((parent) => parent.id === donVi?.parentId);
  const activeOfficers = options.officers.filter(
    (officer) => officer.status === "ACTIVE" || officer.id === donVi?.leaderOfficerId,
  );
  const existingLeaderPresent = activeOfficers.some(
    (officer) => officer.id === donVi?.leaderOfficerId,
  );
  const editableLevels = donVi
    ? donVi.kind === "region"
      ? ["NEIGHBORHOOD"]
      : [donVi.level]
    : ["AREA", "WARD", "NEIGHBORHOOD"];

  function changeOpen(next: boolean) {
    if (saving) return;
    if (next) {
      form.reset(defaults(donVi));
      setError(null);
    }
    setOpen(next);
  }

  async function save(values: UnitFormValues) {
    if (saving) return;
    if (
      !parents.some((parent) => parent.id === values.parentId) &&
      values.parentId !== donVi?.parentId
    ) {
      form.setError("parentId", { message: "Chọn đơn vị cha đúng cấp trong phạm vi được phép." });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const path = donVi
        ? organizationPath(donVi)
        : values.level === "NEIGHBORHOOD"
          ? "/api/regions"
          : "/api/units";
      const original = defaults(donVi);
      const payload: Record<string, string | null> = donVi
        ? Object.fromEntries(
            Object.entries(values).filter(
              ([key, value]) => value !== original[key as keyof UnitFormValues],
            ),
          )
        : { ...values };
      if (Object.keys(payload).length === 0) {
        setError("Chưa có thông tin thay đổi để lưu.");
        return;
      }
      if (Object.hasOwn(payload, "leaderOfficerId"))
        payload.leaderOfficerId = values.leaderOfficerId || null;
      await organizationApi(path, {
        method: donVi ? "PATCH" : "POST",
        body: payload,
      });
      setOpen(false);
      toast.success(donVi ? "Đã cập nhật đơn vị" : "Đã thêm đơn vị");
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
      title={donVi ? "Cập nhật đơn vị" : "Thêm đơn vị"}
      description="Chọn cấp tổ chức, đơn vị cha và người phụ trách trong phạm vi được phép."
      dangLuu={saving}
      onSubmit={form.handleSubmit(save)}
      nhanLuu="Xác nhận lưu"
    >
      <Form {...form}>
        <fieldset disabled={saving} className="space-y-5">
          {error && (
            <p role="alert" className="text-destructive rounded-md border p-3 text-sm">
              {error}
            </p>
          )}
          <FormSection title="Thông tin đơn vị" cols={2}>
            <FormField
              control={form.control}
              name="level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Cấp đơn vị</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className={organizationSelectClass}
                      disabled={!!donVi}
                      onChange={(event) => {
                        field.onChange(event);
                        form.setValue("parentId", "");
                      }}
                    >
                      {editableLevels.map((value) => (
                        <option key={value} value={value}>
                          {organizationLevelNames[value as keyof typeof organizationLevelNames]}
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
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Đơn vị cha</FormLabel>
                  <FormControl>
                    <select {...field} className={organizationSelectClass}>
                      <option value="">Chọn {organizationLevelNames[expectedParentLevel]}</option>
                      {donVi?.parentId && !existingParentPresent && (
                        <option value={donVi.parentId}>
                          {donVi.parentName ?? donVi.parentId} (cha hiện tại)
                        </option>
                      )}
                      {parents.map((parent) => (
                        <option key={parent.id} value={parent.id}>
                          {parent.name}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {(
              [
                ["code", "Mã đơn vị", 50],
                ["name", "Tên đơn vị", 200],
              ] as const
            ).map(([name, label, maxLength]) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>{label}</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={maxLength} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <FormField
              control={form.control}
              name="leaderOfficerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Người phụ trách</FormLabel>
                  <FormControl>
                    <select {...field} className={organizationSelectClass}>
                      {donVi?.leaderHidden && (
                        <option value="__KEEP__">
                          Giữ người phụ trách hiện tại (ngoài phạm vi xem)
                        </option>
                      )}
                      <option value="">
                        {donVi?.leaderHidden
                          ? "Gỡ người phụ trách hiện tại"
                          : "Chưa gán người phụ trách"}
                      </option>
                      {donVi?.leaderOfficerId && !existingLeaderPresent && (
                        <option value={donVi.leaderOfficerId}>
                          {donVi.leaderName ?? donVi.leaderOfficerId} (hiện tại)
                        </option>
                      )}
                      {activeOfficers.map((officer) => (
                        <option key={officer.id} value={officer.id}>
                          {officer.rank} {officer.fullName} · {officer.officerCode}
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
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Trạng thái</FormLabel>
                  <FormControl>
                    <select {...field} className={organizationSelectClass}>
                      <option value="ACTIVE">Hoạt động</option>
                      <option value="INACTIVE">Ngưng hoạt động</option>
                    </select>
                  </FormControl>
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
                    <Textarea {...field} maxLength={2000} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSection>
          {donVi?.legacyParent && (
            <p className="text-muted-foreground text-xs">
              Khu phố hiện tại thuộc trực tiếp khu vực. Có thể giữ cha hiện tại hoặc chuyển đến một
              phường hợp lệ.
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            Thay đổi trạng thái phải đáp ứng các ràng buộc về đơn vị con, cán bộ, tài khoản và cơ sở
            liên quan.
          </p>
        </fieldset>
      </Form>
    </FormDialog>
  );
}
