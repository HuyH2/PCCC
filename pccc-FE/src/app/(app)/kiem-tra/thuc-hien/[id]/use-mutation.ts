"use client";
import { useState } from "react";
import { toast } from "sonner";
import { apiData } from "@/lib/use-api-data";

/** Runs one API mutation, surfaces the server message and reloads the inspection on success. */
export function useMutation(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(url: string, init: RequestInit, success: string) {
    setBusy(true);
    setError("");
    try {
      await apiData(url, init);
      toast.success(success);
      onDone();
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không lưu được dữ liệu.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, setError, run };
}

export const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
