"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { FacilityOptions } from "@/lib/facility-contract";

export function CoSoForm({ regions, officers }: FacilityOptions) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          address: form.get("address"),
          regionId: form.get("regionId"),
          officerId: form.get("officerId"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Không thể tạo cơ sở.");
      router.push(`/co-so/${encodeURIComponent(result.facility.id)}`);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể tạo cơ sở.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="facility-name" className="mb-1 block text-sm font-medium">
            Tên cơ sở <span aria-hidden="true">*</span>
          </label>
          <input
            id="facility-name"
            name="name"
            required
            minLength={1}
            maxLength={200}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-base"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="facility-address" className="mb-1 block text-sm font-medium">
            Địa chỉ <span aria-hidden="true">*</span>
          </label>
          <input
            id="facility-address"
            name="address"
            required
            maxLength={500}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-base"
          />
        </div>
        <div>
          <label htmlFor="facility-region" className="mb-1 block text-sm font-medium">
            Khu vực <span aria-hidden="true">*</span>
          </label>
          <select
            id="facility-region"
            name="regionId"
            required
            defaultValue=""
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-base"
          >
            <option value="" disabled>
              Chọn khu vực
            </option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name} - {region.unit_name}
              </option>
            ))}
          </select>
          {regions.length === 0 && (
            <p className="text-muted-foreground mt-1 text-sm">
              Không có khu vực nào trong phạm vi được cấp.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="facility-officer" className="mb-1 block text-sm font-medium">
            Cán bộ phụ trách <span aria-hidden="true">*</span>
          </label>
          <select
            id="facility-officer"
            name="officerId"
            required
            defaultValue=""
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-base"
          >
            <option value="" disabled>
              Chọn cán bộ
            </option>
            {officers.map((officer) => (
              <option key={officer.id} value={officer.id}>
                {officer.full_name} - {officer.officer_code}
              </option>
            ))}
          </select>
          {officers.length === 0 && (
            <p className="text-muted-foreground mt-1 text-sm">
              Không có cán bộ đang công tác trong phạm vi được cấp.
            </p>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={saving || regions.length === 0 || officers.length === 0}
        className="bg-primary text-primary-foreground min-h-11 rounded-md px-4 py-2 text-sm disabled:opacity-50"
      >
        {saving ? "Đang lưu..." : "Tạo cơ sở"}
      </button>
    </form>
  );
}
