"use client";

import * as React from "react";
import { incidentApi, incidentErrorMessage } from "@/lib/incident-client";
import type { Incident, IncidentList } from "@/lib/incident-contract";

export function useIncidentSearch(search: string) {
  const [items, setItems] = React.useState<Incident[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    const controller = new AbortController();
    setItems([]);
    setError(null);
    if (search.trim().length < 2) {
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ search: search.trim(), pageSize: "20" });
      incidentApi<IncidentList>(`/api/incidents?${params}`, { signal: controller.signal })
        .then((result) => {
          if (!controller.signal.aborted) setItems(result.items);
        })
        .catch((cause) => {
          if (!controller.signal.aborted) setError(incidentErrorMessage(cause));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search]);
  return { items, loading, error };
}
