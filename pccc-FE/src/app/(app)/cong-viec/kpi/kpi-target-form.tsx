"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type TaskAssignee } from "@/lib/kpi-contract";

export function KpiTargetForm({
  accounts,
  period,
  targets,
}: {
  accounts: TaskAssignee[];
  period: string;
  targets: Record<string, number>;
}) {
  const router = useRouter();
  const [accountId, setAccountId] = React.useState(accounts[0]?.id ?? "");
  const [target, setTarget] = React.useState(String(targets[accounts[0]?.id] ?? 0));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    setTarget(String(targets[accountId] ?? 0));
  }, [targets, accountId]);

  function changeAccount(value: string) {
    setAccountId(value);
    setTarget(String(targets[value] ?? 0));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/kpi/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, period, targetTasks: Number(target), note: "" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Không thể lưu chỉ tiêu.");
      setMessage("Đã lưu chỉ tiêu KPI.");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể lưu chỉ tiêu.");
    } finally {
      setSaving(false);
    }
  }

  if (accounts.length === 0) return null;
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
      <div className="space-y-1">
        <Label htmlFor="kpi-account">Cán bộ</Label>
        <select
          id="kpi-account"
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          value={accountId}
          onChange={(event) => changeAccount(event.target.value)}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.full_name} ({account.username})
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="kpi-target">Chỉ tiêu việc/tháng</Label>
        <Input
          id="kpi-target"
          type="number"
          min={0}
          max={10000}
          required
          value={target}
          onChange={(event) => setTarget(event.target.value)}
        />
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "Đang lưu..." : "Lưu chỉ tiêu"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-sm sm:col-span-3">
          {error}
        </p>
      )}
      {message && <p className="text-sm text-green-700 sm:col-span-3">{message}</p>}
    </form>
  );
}
