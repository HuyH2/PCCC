"use client";
import { useEffect, useState } from "react";

export async function apiData<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "Không thể tải dữ liệu.");
  return body;
}

export function useApiData<T>(url: string) {
  const [state, setState] = useState<{ data: T | null; error: string; loading: boolean }>({
    data: null,
    error: "",
    loading: true,
  });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, error: "", loading: true });
    apiData<T>(url, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: "", loading: false });
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted)
          setState({ data: null, error: error.message, loading: false });
      });
    return () => controller.abort();
  }, [url, revision]);
  return { ...state, reload: () => setRevision((v) => v + 1) };
}
