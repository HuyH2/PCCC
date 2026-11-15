"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiData } from "@/lib/use-api-data";
export function FacilityConditions({
  id,
  initial,
  canEdit,
}: {
  id: string;
  initial: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h2>Điều kiện PCCC</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            await apiData(`/api/facilities/${encodeURIComponent(id)}/conditions`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ conditions: value }),
            });
            setMessage("Đã lưu.");
            router.refresh();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Không thể lưu.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Label htmlFor="conditions">Điều kiện PCCC theo hồ sơ thực tế</Label>
        <Textarea
          id="conditions"
          maxLength={10000}
          readOnly={!canEdit || busy}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {canEdit && (
          <Button type="submit" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu điều kiện PCCC"}
          </Button>
        )}
        <p role="status">{message}</p>
      </form>
    </section>
  );
}
