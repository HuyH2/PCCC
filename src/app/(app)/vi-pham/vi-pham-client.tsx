"use client";

import * as React from "react";
import { toast } from "sonner";
import { FileWarning, Paperclip, Plus, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataPagination } from "@/components/shared/data-pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Violation = {
  id: string; facilityId: string; facilityName: string; facilityAddress: string; type: string;
  severity: string; detectedOn: string; description: string; facilityCondition: string;
  remediationDeadline: string | null; trackedOfficerId: string; status: string; suspended: boolean;
  decisionNumber: string | null; progress: number; evidenceCount: number;
};
type Detail = { violation: Violation; suspension: { decision_number: string; reason: string; issued_on: string; effective_until: string | null } | null;
  remediation: { id: string; note: string; progress: number; created_at: number }[];
  evidences: { id: string; file_name: string; file_size: number; downloadUrl: string }[];
  history: { from_status: string | null; to_status: string; reason: string | null; occurred_at: number; actor_name: string }[] };
type Facility = { id: string; name: string; address: string; officer_id: string };

const statusLabels: Record<string, string> = { recorded: "Mới ghi nhận", remediation: "Đang khắc phục", pending_approval: "Chờ duyệt", returned: "Trả lại", completed: "Đã hoàn thành" };
const typeOptions = ["Thiếu hồ sơ/phương án", "Hệ thống báo cháy không hoạt động", "Lối thoát nạn bị chặn", "Thiết bị chữa cháy không đảm bảo", "Hoạt động không phép", "Không huấn luyện nghiệp vụ", "Không đủ điều kiện"];

async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch(path, { method, cache: "no-store", headers: body === undefined ? {} : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (response.status === 401) { window.location.assign("/dang-nhap"); throw new Error("Phiên đăng nhập đã hết hạn."); }
  const data = response.headers.get("content-type")?.includes("application/json") ? await response.json() : null;
  if (!response.ok) throw new Error(data?.error?.message || "Không thể xử lý yêu cầu.");
  return data;
}

export function ViPhamClient({ canCreate, canEdit, canApprove }: { canCreate: boolean; canEdit: boolean; canApprove: boolean }) {
  const [items, setItems] = React.useState<Violation[]>([]);
  const [total, setTotal] = React.useState(0);
  const [stats, setStats] = React.useState({ total: 0, suspended: 0, overdue: 0, pending: 0 });
  const [facilities, setFacilities] = React.useState<Facility[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [selected, setSelected] = React.useState<Detail | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [facilityFilter, setFacilityFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [form, setForm] = React.useState({ facilityId: "", type: typeOptions[0], severity: "Trung bình", detectedOn: new Date().toISOString().slice(0, 10), description: "", facilityCondition: "violation", remediationDeadline: "", trackedOfficerId: "" });
  const refresh = React.useCallback(async () => {
    try { setLoading(true); setError(""); const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) }); if (statusFilter !== "all") params.set("status", statusFilter); if (facilityFilter !== "all") params.set("facilityId", facilityFilter); if (typeFilter !== "all") params.set("type", typeFilter); if (query.trim()) params.set("search", query.trim()); const data = await api(`/api/violations?${params}`); setItems(data.items); setTotal(data.total); setStats(data.stats); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể tải danh sách vi phạm."); }
    finally { setLoading(false); }
  }, [page, pageSize, query, statusFilter, facilityFilter, typeFilter]);
  React.useEffect(() => { void refresh(); }, [refresh]);
  React.useEffect(() => {
    if (!canCreate) return;
    void (async () => {
      try {
        const first = await api("/api/violations/facilities?page=1&pageSize=100");
        const pages = Array.from({ length: Math.max(0, Math.ceil(first.total / 100) - 1) }, (_, i) => i + 2);
        const rest = await Promise.all(pages.map(async (p) => (await api(`/api/violations/facilities?page=${p}&pageSize=100`)).items as Facility[]));
        setFacilities([...first.items, ...rest.flat()]);
      } catch { setFacilities([]); }
    })();
  }, [canCreate]);

  async function openDetail(id: string) {
    try { const d = await api(`/api/violations/${encodeURIComponent(id)}`); setSelected(d); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Không tải được chi tiết."); }
  }
  async function reloadDetail() { if (!selected) return; await refresh(); await openDetail(selected.violation.id); }
  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, remediationDeadline: form.remediationDeadline || null };
      const d = await api("/api/violations", "POST", payload);
      toast.success("Đã ghi nhận hồ sơ vi phạm."); setCreateOpen(false); setForm((v) => ({ ...v, description: "" })); await refresh(); await openDetail(d.violation.id);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Không lưu được hồ sơ."); }
    finally { setSaving(false); }
  }
  async function perform(path: string, body?: unknown, method = "POST") {
    if (!selected) return;
    try { await api(`/api/violations/${encodeURIComponent(selected.violation.id)}/${path}`, method, body); toast.success("Đã cập nhật hồ sơ."); await reloadDetail(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Không thể cập nhật hồ sơ."); }
  }
  async function upload(file?: File) {
    if (!selected || !file) return;
    const reader = new FileReader(); reader.onload = async () => {
      const base64 = String(reader.result).split(",")[1] || "";
      await perform("evidences", { fileName: file.name, mediaType: file.type, contentBase64: base64 });
    }; reader.readAsDataURL(file);
  }
  const filtered = items;

  return <div className="space-y-5">
    <PageHeader title="Vi phạm - Đình chỉ - Khắc phục" description="Theo dõi vi phạm, hồ sơ đình chỉ, bằng chứng khắc phục và phê duyệt hoạt động trở lại." module="M04" useCases={["UC-VIO-01", "UC-VIO-02", "UC-VIO-03", "UC-VIO-04", "UC-VIO-05"]} actions={canCreate ? <Button size="sm" onClick={() => setCreateOpen(true)}><Plus />Ghi nhận vi phạm</Button> : undefined} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Tổng hồ sơ vi phạm" value={stats.total} icon={FileWarning} /><StatCard label="Đang đình chỉ" value={stats.suspended} icon={ShieldAlert} tone="danger" /><StatCard label="Quá hạn khắc phục" value={stats.overdue} icon={ShieldAlert} tone="danger" /><StatCard label="Chờ phê duyệt" value={stats.pending} icon={FileWarning} tone="info" /></div>
    <Card className="gap-0 py-0">
      <div className="grid gap-2 border-b p-3 sm:grid-cols-2 xl:grid-cols-4"><Input aria-label="Tìm hồ sơ" placeholder="Tìm mã, cơ sở, loại vi phạm, số quyết định..." value={query} onChange={(e) => {setPage(1);setQuery(e.target.value);}} /><select aria-label="Lọc trạng thái" className="border-input bg-background h-9 rounded-md border px-3 text-sm" value={statusFilter} onChange={(e) => {setPage(1);setStatusFilter(e.target.value);}}><option value="all">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select><select aria-label="Lọc cơ sở" className="border-input bg-background h-9 rounded-md border px-3 text-sm" value={facilityFilter} onChange={(e)=>{setPage(1);setFacilityFilter(e.target.value);}}><option value="all">Tất cả cơ sở</option>{facilities.map((f)=><option key={f.id} value={f.id}>{f.name}</option>)}</select><select aria-label="Lọc loại vi phạm" className="border-input bg-background h-9 rounded-md border px-3 text-sm" value={typeFilter} onChange={(e)=>{setPage(1);setTypeFilter(e.target.value);}}><option value="all">Tất cả loại vi phạm</option>{typeOptions.map((x)=><option key={x}>{x}</option>)}</select></div>
      {loading ? <p className="text-muted-foreground p-8 text-center">Đang tải hồ sơ...</p> : error ? <div className="p-6 text-center"><p className="text-destructive mb-3">{error}</p><Button variant="outline" onClick={() => void refresh()}>Thử lại</Button></div> : filtered.length === 0 ? <EmptyState icon={ShieldAlert} title="Chưa có hồ sơ vi phạm" description="Hồ sơ sẽ hiển thị theo phạm vi dữ liệu được cấp." /> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-muted/40 text-muted-foreground"><tr>{["Mã hồ sơ","Cơ sở","Loại vi phạm","Mức độ","Hạn khắc phục","Tiến độ","Trạng thái","Bằng chứng"].map((x)=><th key={x} className="px-3 py-2 font-medium">{x}</th>)}</tr></thead><tbody>{filtered.map((v)=><tr key={v.id} className="hover:bg-muted/30 cursor-pointer border-t" onClick={()=>void openDetail(v.id)}><td className="px-3 py-3 font-mono text-xs">{v.id}{v.suspended&&<Badge variant="danger" className="ml-2">Đình chỉ</Badge>}</td><td className="px-3 py-3"><div className="font-medium">{v.facilityName}</div><div className="text-muted-foreground text-xs">{v.facilityAddress}</div></td><td className="max-w-52 px-3 py-3">{v.type}</td><td className="px-3 py-3"><StatusBadge value={v.severity}/></td><td className="px-3 py-3">{v.remediationDeadline||"—"}</td><td className="px-3 py-3">{v.progress}%</td><td className="px-3 py-3"><StatusBadge value={statusLabels[v.status]||v.status}/></td><td className="px-3 py-3"><Badge variant="secondary"><Paperclip className="mr-1 size-3"/>{v.evidenceCount}</Badge></td></tr>)}</tbody></table></div>}
      {!loading&&!error&&<DataPagination tong={total} trang={page} soDong={pageSize} onDoiTrang={setPage} onDoiSoDong={setPageSize}/>}
      <p className="text-muted-foreground border-t px-3 py-2 text-xs">Hồ sơ chờ duyệt cần có nội dung khắc phục và ít nhất một tệp bằng chứng. Việc phê duyệt được ghi lịch sử.</p>
    </Card>

    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Ghi nhận vi phạm</DialogTitle><DialogDescription>Thông tin vi phạm được lưu trong phạm vi cơ sở người dùng được phép quản lý.</DialogDescription></DialogHeader><form className="grid gap-3 sm:grid-cols-2" onSubmit={submitCreate}>
      <label className="grid gap-1 text-sm sm:col-span-2">Cơ sở<select required className="border-input bg-background h-9 rounded-md border px-3" value={form.facilityId} onChange={(e)=>{const facility=facilities.find((x)=>x.id===e.target.value);setForm({...form,facilityId:e.target.value,trackedOfficerId:facility?.officer_id||""});}}><option value="">Chọn cơ sở</option>{facilities.map((f)=><option key={f.id} value={f.id}>{f.name} — {f.address}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Loại vi phạm<select className="border-input bg-background h-9 rounded-md border px-3" value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})}>{typeOptions.map((x)=><option key={x}>{x}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Mức độ<select className="border-input bg-background h-9 rounded-md border px-3" value={form.severity} onChange={(e)=>setForm({...form,severity:e.target.value})}>{["Nhẹ","Trung bình","Nghiêm trọng"].map((x)=><option key={x}>{x}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Ngày phát hiện<Input required type="date" value={form.detectedOn} onChange={(e)=>setForm({...form,detectedOn:e.target.value})}/></label>
      <label className="grid gap-1 text-sm">Hạn khắc phục<Input type="date" value={form.remediationDeadline} onChange={(e)=>setForm({...form,remediationDeadline:e.target.value})}/></label>
      <label className="grid gap-1 text-sm">Tình trạng cơ sở<select className="border-input bg-background h-9 rounded-md border px-3" value={form.facilityCondition} onChange={(e)=>setForm({...form,facilityCondition:e.target.value})}><option value="violation">Vi phạm</option><option value="unlicensed">Không phép</option><option value="insufficient">Không đủ điều kiện</option></select></label>
      <label className="grid gap-1 text-sm">Cán bộ theo dõi<Input required value={form.trackedOfficerId} onChange={(e)=>setForm({...form,trackedOfficerId:e.target.value})}/></label>
      <label className="grid gap-1 text-sm sm:col-span-2">Nội dung vi phạm<Textarea required minLength={10} maxLength={2000} value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></label>
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={()=>setCreateOpen(false)}>Hủy</Button><Button disabled={saving||facilities.length===0}>{saving?"Đang lưu...":"Lưu hồ sơ"}</Button></div>
    </form></DialogContent></Dialog>

    <Dialog open={Boolean(selected)} onOpenChange={(open)=>{if(!open)setSelected(null);}}><DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{selected?.violation.id} · {selected?.violation.facilityName}</DialogTitle><DialogDescription>{selected?.violation.facilityAddress} · {selected&&statusLabels[selected.violation.status]}</DialogDescription></DialogHeader>{selected&&<div className="space-y-5 text-sm">
      <section className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2"><p><b>Loại:</b> {selected.violation.type}</p><p><b>Mức độ:</b> {selected.violation.severity}</p><p><b>Tình trạng cơ sở:</b> {{violation:"Vi phạm",unlicensed:"Không phép",insufficient:"Không đủ điều kiện"}[selected.violation.facilityCondition]||selected.violation.facilityCondition}</p><p><b>Ngày phát hiện:</b> {selected.violation.detectedOn}</p><p><b>Hạn khắc phục:</b> {selected.violation.remediationDeadline||"Chưa đặt"}</p><p className="sm:col-span-2"><b>Nội dung:</b> {selected.violation.description}</p></section>
      {selected.suspension&&<section className="rounded-lg border border-destructive/30 bg-destructive/5 p-3"><b>Đình chỉ · {selected.suspension.decision_number}</b><p>{selected.suspension.reason}</p><p>Ngày quyết định: {selected.suspension.issued_on}{selected.suspension.effective_until?` · Hết hiệu lực: ${selected.suspension.effective_until}`:""}</p></section>}
      {canEdit&&selected.violation.status!=="completed"&&<div className="flex flex-wrap gap-2 border-b pb-4">
        {["recorded","remediation","returned"].includes(selected.violation.status)&&<Button size="sm" variant="outline" onClick={()=>{const description=window.prompt("Nội dung vi phạm",selected.violation.description);if(description===null)return;void api(`/api/violations/${encodeURIComponent(selected.violation.id)}`,"PUT",{description}).then(()=>{toast.success("Đã cập nhật hồ sơ.");void reloadDetail();}).catch((e)=>toast.error(e instanceof Error?e.message:"Không cập nhật được hồ sơ."));}}>Sửa thông tin vi phạm</Button>}
        {!selected.suspension&&<Button size="sm" variant="outline" onClick={()=>{const decisionNumber=window.prompt("Số quyết định đình chỉ");if(!decisionNumber)return;const reason=window.prompt("Lý do đình chỉ (tối thiểu 10 ký tự)");if(!reason)return;void perform("suspension",{decisionNumber,reason,issuedOn:new Date().toISOString().slice(0,10)});}}>Lập hồ sơ đình chỉ</Button>}
        {selected.suspension&&<Button size="sm" variant="outline" onClick={()=>{const decisionNumber=window.prompt("Số quyết định đình chỉ",selected.suspension?.decision_number);if(!decisionNumber)return;const reason=window.prompt("Lý do đình chỉ",selected.suspension?.reason);if(!reason)return;void perform("suspension",{decisionNumber,reason,issuedOn:selected.suspension?.issued_on,effectiveUntil:selected.suspension?.effective_until},"PUT");}}>Sửa hồ sơ đình chỉ</Button>}
        <Button size="sm" variant="outline" onClick={()=>{const note=window.prompt("Nội dung khắc phục (tối thiểu 3 ký tự)");if(!note)return;const raw=window.prompt("Tiến độ 0–100",String(selected.violation.progress));if(raw===null)return;void perform("remediation",{note,progress:Number(raw)});}}>Ghi nhận khắc phục</Button>
        <label className="inline-flex cursor-pointer items-center"><span className="sr-only">Tải bằng chứng</span><input className="max-w-48 text-xs" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(e)=>void upload(e.target.files?.[0])}/></label>
        <Button size="sm" disabled={!selected.violation.evidenceCount||!selected.remediation.length} onClick={()=>void perform("submit-approval")}>Gửi duyệt</Button>
      </div>}
      {canApprove&&selected.violation.status==="pending_approval"&&<div className="flex gap-2 border-b pb-4"><Button size="sm" onClick={()=>void perform("approve",{})}>Duyệt hoạt động trở lại</Button><Button size="sm" variant="destructive" onClick={()=>{const reason=window.prompt("Lý do từ chối (tối thiểu 5 ký tự)");if(reason)void perform("reject",{reason});}}>Từ chối</Button></div>}
      <section><h3 className="mb-2 font-semibold">Tiến độ khắc phục</h3>{selected.remediation.length?selected.remediation.map((r)=><div key={r.id} className="mb-2 rounded-md border p-3"><p>{r.note}</p><p className="text-muted-foreground mt-1">Tiến độ {r.progress}% · {new Date(r.created_at).toLocaleString("vi-VN")}</p></div>):<p className="text-muted-foreground">Chưa có cập nhật khắc phục.</p>}</section>
      <section><h3 className="mb-2 font-semibold">Bằng chứng ({selected.evidences.length})</h3>{selected.evidences.length?selected.evidences.map((e)=><p key={e.id}><a className="text-primary underline" href={e.downloadUrl}>{e.file_name}</a> · {(e.file_size/1024).toFixed(0)} KB</p>):<p className="text-muted-foreground">Chưa có tài liệu chứng minh.</p>}</section>
      <section><h3 className="mb-2 font-semibold">Lịch sử trạng thái</h3>{selected.history.map((h,i)=><div key={`${h.occurred_at}-${i}`} className="border-l-2 pl-3 pb-3"><b>{h.to_status in statusLabels?statusLabels[h.to_status]:h.to_status}</b><p className="text-muted-foreground">{h.reason||"—"} · {h.actor_name} · {new Date(h.occurred_at).toLocaleString("vi-VN")}</p></div>)}</section>
    </div>}</DialogContent></Dialog>
  </div>;
}
