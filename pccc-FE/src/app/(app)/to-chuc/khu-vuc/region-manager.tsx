"use client";

import * as React from "react";
import { Plus, Search, UserCog } from "lucide-react";

import { SectionCard } from "@/components/shared/section-card";
import { DataPagination } from "@/components/shared/data-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import {
  regionApi,
  type AssignableOfficer,
  type Region,
  type RegionDetail,
  type RegionUnit,
} from "@/lib/region-contract";

const selectClass = "border-input bg-background h-9 w-full rounded-md border px-3 text-sm";

export function RegionManager({ canEdit, canCreate }: { canEdit: boolean; canCreate: boolean }) {
  const [regions, setRegions] = React.useState<Region[]>([]);
  const [units, setUnits] = React.useState<RegionUnit[]>([]);
  const [officers, setOfficers] = React.useState<AssignableOfficer[]>([]);
  const [detail, setDetail] = React.useState<RegionDetail | null>(null);
  const [search, setSearch] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [draft, setDraft] = React.useState({ id: "", name: "", unitId: "" });
  const [edit, setEdit] = React.useState({ name: "", unitId: "" });
  const [assignment, setAssignment] = React.useState({
    accountId: "",
    effectiveDate: "",
    note: "",
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await regionApi<{ items: Region[]; total: number }>(
        `/api/regions?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(query)}`,
      );
      setRegions(data.items);
      setTotal(data.total);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể tải khu vực.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, query]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    regionApi<{ items: RegionUnit[] }>("/api/units")
      .then((data) => setUnits(data.items))
      .catch(() => setUnits([]));
  }, []);

  React.useEffect(() => {
    if (!canEdit) return;
    regionApi<{ items: AssignableOfficer[] }>("/api/regions/officers")
      .then((data) => setOfficers(data.items))
      .catch(() => setOfficers([]));
  }, [canEdit]);

  const openDetail = React.useCallback(async (id: string) => {
    setError(null);
    setMessage(null);
    try {
      const data = await regionApi<RegionDetail>(`/api/regions/${encodeURIComponent(id)}`);
      setDetail(data);
      setEdit({ name: data.region.name, unitId: data.region.unit_id });
      setAssignment({ accountId: "", effectiveDate: "", note: "" });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể tải chi tiết khu vực.");
    }
  }, []);

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await regionApi("/api/regions", "POST", {
        id: draft.id.trim(),
        name: draft.name.trim(),
        unitId: draft.unitId,
      });
      setMessage(`Đã tạo khu vực ${draft.name.trim()}.`);
      setDraft({ id: "", name: "", unitId: "" });
      setShowCreate(false);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể tạo khu vực.");
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await regionApi(`/api/regions/${encodeURIComponent(detail.region.id)}`, "PUT", {
        name: edit.name.trim(),
        unitId: edit.unitId,
      });
      setMessage("Đã cập nhật khu vực.");
      await Promise.all([load(), openDetail(detail.region.id)]);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể cập nhật khu vực.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAssignment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    const target = officers.find((item) => item.id === assignment.accountId);
    const label = target ? target.full_name : "bỏ phân công";
    if (
      !window.confirm(
        `${target ? `Giao ${detail.region.name} cho ${label}?` : `Bỏ phân công ${detail.region.name}?`} Khu vực đang có ${detail.region.facility_count} cơ sở.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const data = await regionApi<RegionDetail>(
        `/api/regions/${encodeURIComponent(detail.region.id)}/assignment`,
        "POST",
        {
          accountId: assignment.accountId || null,
          effectiveDate: assignment.effectiveDate || null,
          note: assignment.note.trim() || null,
        },
      );
      setDetail(data);
      setAssignment({ accountId: "", effectiveDate: "", note: "" });
      setMessage("Đã cập nhật phân công và lưu lịch sử.");
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể phân công.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}

      <SectionCard
        title="Danh mục khu vực - khu phố"
        description="Mỗi khu vực có một cán bộ phụ trách; thay đổi phân công được lưu lịch sử."
        contentClassName="px-0 pb-0"
        action={
          canCreate ? (
            <Button size="sm" onClick={() => setShowCreate((value) => !value)}>
              <Plus />
              Thêm khu phố
            </Button>
          ) : null
        }
      >
        {showCreate && (
          <form
            onSubmit={(event) => void submitCreate(event)}
            className="grid gap-3 border-b px-4 pb-4 md:grid-cols-4"
          >
            <div className="space-y-1">
              <Label htmlFor="region-id">Mã khu phố</Label>
              <Input
                id="region-id"
                required
                maxLength={32}
                placeholder="KP04"
                value={draft.id}
                onChange={(event) => setDraft({ ...draft, id: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="region-name">Tên khu phố</Label>
              <Input
                id="region-name"
                required
                maxLength={200}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="region-unit">Đơn vị</Label>
              <select
                id="region-unit"
                className={selectClass}
                required
                value={draft.unitId}
                onChange={(event) => setDraft({ ...draft, unitId: event.target.value })}
              >
                <option value="">Chọn đơn vị</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" size="sm" disabled={busy}>
                Lưu
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowCreate(false)}
              >
                Hủy
              </Button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <Input
            className="max-w-xs"
            placeholder="Tìm mã hoặc tên khu phố"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setPage(1);
                setQuery(search);
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setPage(1);
              setQuery(search);
            }}
          >
            <Search />
            Tìm
          </Button>
        </div>

        {loading ? (
          <p role="status" className="px-4 pb-4 text-sm">
            Đang tải khu vực…
          </p>
        ) : regions.length === 0 ? (
          <p className="px-4 pb-4 text-sm">Không có khu vực trong phạm vi được cấp.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Mã</TableHead>
                  <TableHead>Tên khu phố</TableHead>
                  <TableHead>Đơn vị</TableHead>
                  <TableHead>Cán bộ phụ trách</TableHead>
                  <TableHead className="text-right">Số cơ sở</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regions.map((region) => (
                  <TableRow key={region.id}>
                    <TableCell className="font-mono text-xs">{region.id}</TableCell>
                    <TableCell className="font-medium">{region.name}</TableCell>
                    <TableCell className="text-[13px]">{region.unit_name}</TableCell>
                    <TableCell className="text-[13px]">
                      {region.officer_name ? (
                        <>
                          {region.officer_name}
                          <span className="text-muted-foreground block text-xs">
                            {region.officer_code}
                            {region.effective_date ? ` · hiệu lực ${region.effective_date}` : ""}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Chưa phân công</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {region.facility_count}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => void openDetail(region.id)}>
                        <UserCog />
                        {canEdit ? "Phân công" : "Chi tiết"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <DataPagination
          tong={total}
          trang={page}
          soDong={pageSize}
          onDoiTrang={setPage}
          onDoiSoDong={setPageSize}
        />
      </SectionCard>

      {detail && (
        <SectionCard
          title={`Khu vực ${detail.region.id} · ${detail.region.name}`}
          description={`${detail.region.unit_name} · ${detail.region.facility_count} cơ sở · ${detail.officers.length} cán bộ liên quan`}
          action={
            <Button size="sm" variant="outline" onClick={() => setDetail(null)}>
              Đóng
            </Button>
          }
        >
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-lg border p-3">
                <h3 className="font-medium">Cán bộ phụ trách hiện tại</h3>
                {detail.region.officer_name ? (
                  <p className="text-sm">
                    {detail.region.officer_name}
                    <span className="text-muted-foreground block text-xs">
                      {detail.region.officer_code}
                      {detail.region.effective_date
                        ? ` · hiệu lực ${detail.region.effective_date}`
                        : ""}
                      {detail.region.assignment_note ? ` · ${detail.region.assignment_note}` : ""}
                    </span>
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">Chưa phân công cán bộ.</p>
                )}
                {canEdit && (
                  <form
                    onSubmit={(event) => void submitAssignment(event)}
                    className="space-y-3 border-t pt-3"
                  >
                    <div className="space-y-1">
                      <Label htmlFor="assign-account">Cán bộ phụ trách</Label>
                      <select
                        id="assign-account"
                        className={selectClass}
                        value={assignment.accountId}
                        onChange={(event) =>
                          setAssignment({ ...assignment, accountId: event.target.value })
                        }
                      >
                        <option value="">— Bỏ phân công —</option>
                        {officers
                          .filter((item) => item.id !== detail.region.officer_account_id)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.full_name} · {item.officer_id} · {item.role_code}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="assign-date">Ngày hiệu lực</Label>
                        <Input
                          id="assign-date"
                          type="date"
                          value={assignment.effectiveDate}
                          onChange={(event) =>
                            setAssignment({ ...assignment, effectiveDate: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="assign-note">Ghi chú</Label>
                        <Input
                          id="assign-note"
                          maxLength={500}
                          value={assignment.note}
                          onChange={(event) =>
                            setAssignment({ ...assignment, note: event.target.value })
                          }
                        />
                      </div>
                    </div>
                    <Button type="submit" size="sm" disabled={busy}>
                      Xác nhận phân công
                    </Button>
                  </form>
                )}
              </div>

              <div className="space-y-3 rounded-lg border p-3">
                <h3 className="font-medium">Thông tin khu vực</h3>
                <form onSubmit={(event) => void submitEdit(event)} className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="edit-name">Tên khu phố</Label>
                    <Input
                      id="edit-name"
                      required
                      maxLength={200}
                      disabled={!canEdit}
                      value={edit.name}
                      onChange={(event) => setEdit({ ...edit, name: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-unit">Đơn vị</Label>
                    <select
                      id="edit-unit"
                      className={selectClass}
                      disabled={!canEdit}
                      value={edit.unitId}
                      onChange={(event) => setEdit({ ...edit, unitId: event.target.value })}
                    >
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {canEdit && (
                    <Button type="submit" size="sm" variant="outline" disabled={busy}>
                      Lưu thông tin
                    </Button>
                  )}
                </form>
                <div className="border-t pt-3">
                  <h4 className="mb-2 font-medium">Cơ sở trong khu vực</h4>
                  {detail.facilities.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Chưa có cơ sở.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {detail.facilities.map((facility) => (
                        <li key={facility.id} className="flex justify-between gap-2">
                          <span>{facility.name}</span>
                          <span className="text-muted-foreground text-xs">
                            {facility.officer_name ?? facility.officer_id}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 font-medium">Lịch sử phân công</h3>
              {detail.history.length === 0 ? (
                <p className="text-muted-foreground text-sm">Chưa có lịch sử phân công.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Thời điểm</TableHead>
                        <TableHead>Thao tác</TableHead>
                        <TableHead>Cán bộ cũ</TableHead>
                        <TableHead>Cán bộ mới</TableHead>
                        <TableHead>Hiệu lực</TableHead>
                        <TableHead>Người thực hiện</TableHead>
                        <TableHead>Ghi chú</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.history.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="text-xs">
                            {formatDate(new Date(event.occurred_at).toISOString())}
                          </TableCell>
                          <TableCell>
                            {event.action === "assign" ? "Phân công" : "Bỏ phân công"}
                          </TableCell>
                          <TableCell>{event.from_name ?? "—"}</TableCell>
                          <TableCell>{event.to_name ?? "—"}</TableCell>
                          <TableCell>{event.effective_date ?? "—"}</TableCell>
                          <TableCell>{event.performed_by_name ?? "—"}</TableCell>
                          <TableCell className="max-w-[240px] truncate text-xs">
                            {event.reason ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
