"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Facility {
  id: string;
  name: string;
  address: string;
  region_id: string;
  status: string;
}
interface Result {
  items: Facility[];
  total: number;
  page: number;
  pageSize: number;
}
export function CoSoTable() {
  const [search, setSearch] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [result, setResult] = React.useState<Result | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(true);
  React.useEffect(() => {
    const controller = new AbortController();
    setPending(true);
    setError(null);
    setResult(null);
    fetch(`/api/facilities?page=${page}&pageSize=20&search=${encodeURIComponent(query)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.assign("/dang-nhap");
          return;
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Không thể tải dữ liệu.");
        setResult(data);
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false);
      });
    return () => controller.abort();
  }, [query, page]);
  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <Input
          aria-label="Tìm cơ sở theo tên hoặc địa chỉ"
          placeholder="Tìm theo tên hoặc địa chỉ…"
          maxLength={100}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button disabled={pending}>Tìm kiếm</Button>
      </form>
      {pending && <p role="status">Đang tải cơ sở…</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {result && (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã</TableHead>
                  <TableHead>Tên cơ sở</TableHead>
                  <TableHead>Địa chỉ</TableHead>
                  <TableHead>Khu phố</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{f.id}</TableCell>
                    <TableCell>
                      <Link
                        className="text-primary hover:underline"
                        href={`/du-lieu/co-so/${encodeURIComponent(f.id)}`}
                      >
                        {f.name}
                      </Link>
                    </TableCell>
                    <TableCell>{f.address}</TableCell>
                    <TableCell>{f.region_id}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {result.items.length === 0 && (
              <p className="p-6 text-center text-sm">
                Không có cơ sở phù hợp trong phạm vi được cấp.
              </p>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span>
              {result.total} cơ sở · Trang {page}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page === 1 || pending}
                onClick={() => setPage((p) => p - 1)}
              >
                Trước
              </Button>
              <Button
                variant="outline"
                disabled={page * result.pageSize >= result.total || pending}
                onClick={() => setPage((p) => p + 1)}
              >
                Sau
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
