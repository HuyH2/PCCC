"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { FacilityRecord } from "@/lib/facility-contract";

export function FacilityEditForm({ facility }: { facility: FacilityRecord }) {
  const router = useRouter();
  const [name, setName] = React.useState(facility.name);
  const [address, setAddress] = React.useState(facility.address);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/facilities/${encodeURIComponent(facility.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), address: address.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Không thể cập nhật cơ sở.");
      router.push(`/co-so/${encodeURIComponent(facility.id)}`);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể cập nhật cơ sở.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-4 rounded-xl border p-5">
      <div>
        <label htmlFor="facility-name" className="block text-sm font-medium">
          Tên cơ sở
        </label>
        <input
          id="facility-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={200}
          className="border-input bg-background mt-1 w-full rounded-md border p-2"
        />
      </div>
      <div>
        <label htmlFor="facility-address" className="block text-sm font-medium">
          Địa chỉ
        </label>
        <input
          id="facility-address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          required
          maxLength={500}
          className="border-input bg-background mt-1 w-full rounded-md border p-2"
        />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm disabled:opacity-50"
      >
        {saving ? "Đang lưu…" : "Lưu thay đổi"}
      </button>
    </form>
  );
}
