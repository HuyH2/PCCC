"use client";

import * as React from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { incidentApi, incidentErrorMessage } from "@/lib/incident-client";
import { damageTypeNames, incidentSelectClass, type IncidentDamage } from "@/lib/incident-contract";

export function DamageForm({
  incidentId,
  damage,
  onSaved,
}: {
  incidentId: string;
  damage?: IncidentDamage;
  onSaved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [group, setGroup] = React.useState(damage?.damageGroup ?? "HUMAN");
  const [type, setType] = React.useState(damage?.damageType ?? "INJURED");
  const [quantity, setQuantity] = React.useState(String(damage?.quantity ?? 0));
  const [value, setValue] = React.useState(String(damage?.propertyValue ?? 0));
  const [description, setDescription] = React.useState(damage?.description ?? "");
  const [notes, setNotes] = React.useState(damage?.notes ?? "");
  const id = React.useId();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const count = Number(quantity),
      money = Number(value);
    if (
      !quantity.trim() ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      !value.trim() ||
      !Number.isSafeInteger(money) ||
      money < 0
    ) {
      setError("Số lượng và giá trị tài sản phải là số nguyên không âm hợp lệ.");
      return;
    }
    setSaving(true);
    try {
      await incidentApi(
        `/api/incidents/${encodeURIComponent(incidentId)}/damages${damage ? `/${encodeURIComponent(damage.id)}` : ""}`,
        {
          method: damage ? "PATCH" : "POST",
          body: {
            damageGroup: group,
            damageType: type,
            quantity: count,
            propertyValue: group === "PROPERTY" ? money : 0,
            description,
            notes,
          },
        },
      );
      toast.success("Đã lưu thiệt hại");
      setOpen(false);
      onSaved();
    } catch (cause) {
      setError(incidentErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }
  return (
    <FormDialog
      trigger={
        <Button variant={damage ? "ghost" : "outline"} size="sm">
          {damage ? "Sửa" : "Thêm thiệt hại"}
        </Button>
      }
      title={damage ? "Cập nhật thiệt hại" : "Ghi nhận thiệt hại"}
      description="Giá trị tài sản nhập bằng đồng Việt Nam; không cần lưu danh tính người gặp nạn."
      open={open}
      onOpenChange={(next) => {
        if (!saving) {
          setOpen(next);
          setError(null);
        }
      }}
      dangLuu={saving}
      onSubmit={submit}
    >
      <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${id}-group`}>Nhóm thiệt hại</Label>
          <select
            id={`${id}-group`}
            value={group}
            className={incidentSelectClass}
            onChange={(event) => {
              const next = event.target.value as "HUMAN" | "PROPERTY";
              setGroup(next);
              setType(next === "HUMAN" ? "INJURED" : "LOSS");
            }}
          >
            <option value="HUMAN">Người</option>
            <option value="PROPERTY">Tài sản</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-type`}>Loại</Label>
          <select
            id={`${id}-type`}
            value={type}
            onChange={(event) => setType(event.target.value)}
            className={incidentSelectClass}
          >
            {(group === "HUMAN" ? ["DEATH", "INJURED", "RESCUED", "OTHER"] : ["LOSS", "OTHER"]).map(
              (key) => (
                <option key={key} value={key}>
                  {damageTypeNames[key]}
                </option>
              ),
            )}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-quantity`}>Số lượng</Label>
          <Input
            id={`${id}-quantity`}
            type="number"
            min={0}
            step={1}
            required
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </div>
        {group === "PROPERTY" && (
          <div className="space-y-2">
            <Label htmlFor={`${id}-value`}>Giá trị (VNĐ)</Label>
            <Input
              id={`${id}-value`}
              type="number"
              min={0}
              step={1}
              required
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
        )}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${id}-description`}>Mô tả</Label>
          <Textarea
            id={`${id}-description`}
            maxLength={2000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${id}-notes`}>Ghi chú</Label>
          <Textarea
            id={`${id}-notes`}
            maxLength={2000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm sm:col-span-2">
            {error}
          </p>
        )}
      </fieldset>
    </FormDialog>
  );
}
