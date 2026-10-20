"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FormSection } from "@/components/shared/form-section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { incidentApi, incidentErrorMessage } from "@/lib/incident-client";
import {
  incidentSelectClass,
  vietnamDateTime,
  vietnamTimestamp,
  type Incident,
  type IncidentOptions,
  type RecordStatus,
} from "@/lib/incident-contract";

function initialValues(incident?: Incident) {
  return {
    title: incident?.title ?? "",
    incidentType: incident?.incidentType ?? "",
    incidentSubtype: incident?.incidentSubtype ?? "",
    occurredAt: vietnamDateTime(incident?.occurredAt),
    address: incident?.address ?? "",
    description: incident?.description ?? "",
    sceneDetails: incident?.sceneDetails ?? "",
    regionId: incident?.regionId ?? "",
    unitId: incident?.unitId ?? "",
    facilityId: incident?.facilityId ?? "",
    reason: "",
  };
}

export function SuCoForm({
  trigger,
  options,
  incident,
  onSaved,
}: {
  trigger: React.ReactNode;
  options: IncidentOptions;
  incident?: Incident;
  onSaved: (incident: Incident) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [values, setValues] = React.useState(() => initialValues(incident));
  const id = React.useId();
  const change = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  const selectedType = options.incidentTypes.find((type) => type.code === values.incidentType);
  const facilities = options.facilities.filter(
    (facility) => !values.regionId || facility.regionId === values.regionId,
  );
  async function save(recordStatus: RecordStatus) {
    setError(null);
    try {
      const occurredAt = vietnamTimestamp(values.occurredAt);
      if (
        recordStatus === "OFFICIAL" &&
        (!values.incidentType || occurredAt == null || !values.address.trim())
      )
        throw new Error("Hồ sơ chính thức phải có loại sự cố, ngày giờ xảy ra và địa điểm.");
      setSaving(true);
      const body = {
        ...values,
        occurredAt,
        incidentType: values.incidentType || null,
        incidentSubtype: values.incidentSubtype || null,
        regionId: values.regionId || null,
        unitId: values.unitId || null,
        facilityId: values.facilityId || null,
        recordStatus,
        ...(incident ? { version: incident.version } : {}),
      };
      const result = await incidentApi<{ incident: Incident }>(
        incident ? `/api/incidents/${encodeURIComponent(incident.id)}` : "/api/incidents",
        { method: incident ? "PATCH" : "POST", body },
      );
      toast.success(incident ? "Đã cập nhật hồ sơ sự cố" : "Đã ghi nhận sự cố");
      setOpen(false);
      onSaved(result.incident);
    } catch (cause) {
      setError(incidentErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        setOpen(next);
        if (next) {
          setValues(initialValues(incident));
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save("OFFICIAL");
          }}
          className="flex min-h-0 max-h-[90svh] flex-col overflow-hidden"
        >
          <DialogHeader className="bg-background shrink-0 border-b px-6 py-4">
            <DialogTitle>{incident ? "Cập nhật hồ sơ sự cố" : "Ghi nhận sự cố"}</DialogTitle>
            <DialogDescription>
              Lưu nháp để bổ sung thông tin sau. Ngày giờ sử dụng múi giờ Việt Nam (UTC+7).
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-5">
            <fieldset disabled={saving} className="min-w-0 space-y-5">
              <FormSection title="Thông tin vụ việc" cols={2}>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`${id}-title`}>Tiêu đề</Label>
                  <Input
                    id={`${id}-title`}
                    maxLength={250}
                    value={values.title}
                    onChange={(event) => change("title", event.target.value)}
                    placeholder="Tên vụ việc"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${id}-type`}>Loại sự cố *</Label>
                  <select
                    id={`${id}-type`}
                    value={values.incidentType}
                    className={incidentSelectClass}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        incidentType: event.target.value,
                        incidentSubtype: "",
                      }))
                    }
                  >
                    <option value="">Chưa phân loại</option>
                    {options.incidentTypes.map((type) => (
                      <option value={type.code} key={type.code}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${id}-subtype`}>Phân nhóm</Label>
                  <select
                    id={`${id}-subtype`}
                    value={values.incidentSubtype}
                    className={incidentSelectClass}
                    onChange={(event) => change("incidentSubtype", event.target.value)}
                    disabled={!selectedType?.subtypes?.length}
                  >
                    <option value="">Chưa chọn</option>
                    {selectedType?.subtypes?.map((subtype) => (
                      <option value={subtype.code} key={subtype.code}>
                        {subtype.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${id}-time`}>Ngày giờ xảy ra *</Label>
                  <Input
                    id={`${id}-time`}
                    type="datetime-local"
                    value={values.occurredAt}
                    onChange={(event) => change("occurredAt", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${id}-unit`}>Đơn vị</Label>
                  <select
                    id={`${id}-unit`}
                    value={values.unitId}
                    className={incidentSelectClass}
                    onChange={(event) => change("unitId", event.target.value)}
                  >
                    <option value="">Chọn nếu có</option>
                    {options.units.map((unit) => (
                      <option value={unit.id} key={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${id}-region`}>Khu vực</Label>
                  <select
                    id={`${id}-region`}
                    value={values.regionId}
                    className={incidentSelectClass}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        regionId: event.target.value,
                        facilityId: "",
                        unitId:
                          options.regions.find((region) => region.id === event.target.value)
                            ?.unitId ?? current.unitId,
                      }))
                    }
                  >
                    <option value="">Chọn nếu có</option>
                    {options.regions.map((region) => (
                      <option value={region.id} key={region.id}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${id}-facility`}>Cơ sở liên quan</Label>
                  <select
                    id={`${id}-facility`}
                    value={values.facilityId}
                    className={incidentSelectClass}
                    onChange={(event) => {
                      const facility = options.facilities.find(
                        (item) => item.id === event.target.value,
                      );
                      const region = options.regions.find((item) => item.id === facility?.regionId);
                      setValues((current) => ({
                        ...current,
                        facilityId: event.target.value,
                        regionId: facility?.regionId ?? current.regionId,
                        unitId: region?.unitId ?? current.unitId,
                      }));
                    }}
                  >
                    <option value="">Không liên quan cơ sở</option>
                    {facilities.map((facility) => (
                      <option value={facility.id} key={facility.id}>
                        {facility.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`${id}-address`}>Địa điểm / địa chỉ *</Label>
                  <Input
                    id={`${id}-address`}
                    maxLength={1000}
                    value={values.address}
                    onChange={(event) => change("address", event.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`${id}-description`}>Mô tả / diễn biến</Label>
                  <Textarea
                    id={`${id}-description`}
                    maxLength={6000}
                    value={values.description}
                    onChange={(event) => change("description", event.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`${id}-scene`}>Thông tin hiện trường</Label>
                  <Textarea
                    id={`${id}-scene`}
                    maxLength={6000}
                    value={values.sceneDetails}
                    onChange={(event) => change("sceneDetails", event.target.value)}
                  />
                </div>
                {incident && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={`${id}-reason`}>Lý do / ghi chú thay đổi</Label>
                    <Textarea
                      id={`${id}-reason`}
                      maxLength={2000}
                      value={values.reason}
                      onChange={(event) => change("reason", event.target.value)}
                    />
                  </div>
                )}
              </FormSection>
              <p className="text-muted-foreground text-xs">
                Cấu hình demo; danh mục, thời hạn theo loại và chính sách tài liệu chờ xác nhận
                Q11/Q12. Không đặt thời hạn mặc định. Thiệt hại, tài liệu và phân công được cập nhật
                trong chi tiết hồ sơ.
              </p>
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}
            </fieldset>
          </div>
          <DialogFooter className="bg-background shrink-0 border-t px-6 py-4">
            <Button type="button" variant="ghost" disabled={saving} onClick={() => setOpen(false)}>
              Hủy
            </Button>
            {incident?.recordStatus !== "OFFICIAL" && (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => void save("DRAFT")}
              >
                Lưu nháp
              </Button>
            )}
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {saving
                ? "Đang lưu…"
                : incident?.recordStatus === "OFFICIAL"
                  ? "Lưu thay đổi"
                  : "Lưu chính thức"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
