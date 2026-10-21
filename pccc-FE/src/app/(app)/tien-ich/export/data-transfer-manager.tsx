"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TransferHistory } from "../transfer-history";

type Option = { value: string; label: string };
type Dataset = { id: string; label: string; formats: string[]; filters: { regions?: Option[]; units?: Option[]; statuses?: Option[] } };

async function responseBody(response: Response): Promise<{ message?: string; items?: unknown }> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && !Array.isArray(body))
      return body as { message?: string; items?: unknown };
  } catch {
    // Non-JSON responses use the existing generic error message.
  }
  return {};
}

export function DataTransferManager() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetId, setDatasetId] = useState("");
  const [format, setFormat] = useState("csv");
  const [search, setSearch] = useState("");
  const [regionId, setRegionId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const dataset = useMemo(() => datasets.find((item) => item.id === datasetId), [datasets, datasetId]);

  useEffect(() => {
    let active = true;
    fetch("/api/data-transfers/datasets", { cache: "no-store" })
      .then(async (response) => {
        const body = await responseBody(response);
        if (!response.ok) throw new Error(body.message ?? "Không tải được danh mục dữ liệu.");
        const items = Array.isArray(body.items) ? (body.items as Dataset[]) : [];
        if (active) {
          setDatasets(items);
          setDatasetId((current) => current || items[0]?.id || "");
        }
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được danh mục dữ liệu."); });
    return () => { active = false; };
  }, []);

  async function exportData() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/data-transfers/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset: datasetId, format, filters: { search, regionId, unitId, status } }),
      });
      if (!response.ok) {
        const body = await responseBody(response);
        throw new Error(body.message ?? "Không thể xuất dữ liệu.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const plain = disposition.match(/filename="([^"]+)"/i)?.[1];
      const filename = encoded ? decodeURIComponent(encoded) : plain ?? `${datasetId}.csv`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setReload((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xuất dữ liệu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="space-y-4 border-b pb-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2"><Label htmlFor="export-dataset">Dữ liệu cần xuất</Label>
            <Select value={datasetId} onValueChange={(value) => { setDatasetId(value); setRegionId(""); setUnitId(""); setStatus(""); }}>
              <SelectTrigger id="export-dataset" className="w-full"><SelectValue placeholder="Chọn dữ liệu" /></SelectTrigger>
              <SelectContent>{datasets.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="export-format">Định dạng</Label>
            <Select value={format} onValueChange={setFormat}><SelectTrigger id="export-format" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{(dataset?.formats ?? ["csv"]).map((item) => <SelectItem key={item} value={item}>{item.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="export-search">Tìm kiếm</Label><Input id="export-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên, mã hoặc địa chỉ" /></div>
          {dataset?.filters.regions?.length ? <div className="space-y-2"><Label htmlFor="export-region">Khu vực</Label>
            <Select value={regionId || "all"} onValueChange={(value) => setRegionId(value === "all" ? "" : value)}><SelectTrigger id="export-region" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tất cả khu vực trong phạm vi</SelectItem>{dataset.filters.regions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
          </div> : null}
          {dataset?.filters.units?.length ? <div className="space-y-2"><Label htmlFor="export-unit">Đơn vị</Label>
            <Select value={unitId || "all"} onValueChange={(value) => setUnitId(value === "all" ? "" : value)}><SelectTrigger id="export-unit" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tất cả đơn vị trong phạm vi</SelectItem>{dataset.filters.units.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
          </div> : null}
          {dataset?.filters.statuses?.length ? <div className="space-y-2"><Label htmlFor="export-status">Trạng thái</Label>
            <Select value={status || "all"} onValueChange={(value) => setStatus(value === "all" ? "" : value)}><SelectTrigger id="export-status" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tất cả trạng thái</SelectItem>{dataset.filters.statuses.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
          </div> : null}
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button onClick={exportData} disabled={busy || !datasetId}><Download />{busy ? "Đang xuất..." : "Xuất và tải file"}</Button>
      </section>
      <TransferHistory key={reload} direction="export" />
    </div>
  );
}
