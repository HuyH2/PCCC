"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, History, Pencil, RefreshCw } from "lucide-react";
import { SuCoForm } from "@/components/forms/su-co-form";
import { AssignmentForm } from "@/components/incidents/assignment-form";
import { DamageForm } from "@/components/incidents/damage-form";
import { DocumentsPanel } from "@/components/incidents/documents-panel";
import { IncidentProgressForm } from "@/components/incidents/progress-form";
import {
  DeadlineBadge,
  IncidentError,
  IncidentLoading,
  IncidentState,
  useIncidentOptions,
} from "@/components/incidents/incident-ui";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { incidentApi, incidentErrorMessage } from "@/lib/incident-client";
import {
  assignmentStatusNames,
  damageTypeNames,
  incidentTime,
  incidentTypeNames,
  processingStatusNames,
  type IncidentAudit,
  type IncidentDetail,
  type IncidentHistory,
  type IncidentPermissions,
  type ProcessingStatus,
} from "@/lib/incident-contract";

function Information({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="break-words text-sm">{children || "—"}</dd>
    </div>
  );
}
const historyActionNames: Record<string, string> = {
  "M09.incident.create": "Ghi nhận sự cố",
  "M09.incident.update": "Cập nhật hồ sơ",
  "M09.incident.complete": "Hoàn thành hồ sơ",
  "M09.classification.update": "Cập nhật phân loại sự cố",
  "M09.scene.update": "Cập nhật thông tin hiện trường",
  "M09.damage.create": "Ghi nhận thiệt hại",
  "M09.damage.update": "Cập nhật thiệt hại",
  "M09.assignment.create": "Phân công cán bộ",
  "M09.assignment.update": "Điều chỉnh phân công",
  "M09.deadline.update": "Cập nhật deadline",
  "M09.status.update": "Chuyển trạng thái",
  "M09.document.upload": "Upload tài liệu",
};
export function IncidentDetails({
  id,
  permissions,
  officerId,
}: {
  id: string;
  permissions: IncidentPermissions;
  officerId: string;
}) {
  const [revision, setRevision] = React.useState(0);
  const reload = React.useCallback(() => setRevision((current) => current + 1), []);
  const { options, error: optionsError } = useIncidentOptions(revision);
  const [data, setData] = React.useState<IncidentDetail | null>(null);
  const [history, setHistory] = React.useState<IncidentHistory[]>([]);
  const [audit, setAudit] = React.useState<IncidentAudit[]>([]);
  const [historyError, setHistoryError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setHistoryError(null);
    incidentApi<IncidentDetail>(`/api/incidents/${encodeURIComponent(id)}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(incidentErrorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    incidentApi<{ history: IncidentHistory[]; auditLogs: IncidentAudit[] }>(
      `/api/incidents/${encodeURIComponent(id)}/history`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setHistory(result.history);
          setAudit(result.auditLogs);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setHistoryError(incidentErrorMessage(cause));
      });
    return () => controller.abort();
  }, [id, revision]);
  if (loading && !data) return <IncidentLoading>Đang tải hồ sơ sự cố…</IncidentLoading>;
  if (error)
    return (
      <div className="space-y-4">
        <Button asChild variant="outline">
          <Link href="/su-co">
            <ArrowLeft />
            Danh sách sự cố
          </Link>
        </Button>
        <IncidentError message={error} retry={reload} />
      </div>
    );
  if (!data) return null;
  const { incident, damages, documents, assignments } = data;
  const terminal =
    incident.processingStatus === "COMPLETED" || incident.processingStatus === "CLOSED";
  const human = damages.filter((damage) => damage.damageGroup === "HUMAN");
  const humanCount = (type: string) =>
    human
      .filter((damage) => damage.damageType === type)
      .reduce((sum, damage) => sum + damage.quantity, 0);
  const propertyValue = damages
    .filter((damage) => damage.damageGroup === "PROPERTY")
    .reduce((sum, damage) => sum + damage.propertyValue, 0);
  return (
    <div className="space-y-5">
      <PageHeader
        title={incident.title || incident.incidentCode}
        description={`Hồ sơ ${incident.incidentCode} · Cập nhật ${incidentTime(incident.updatedAt)}`}
        module="M09"
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/su-co">
                <ArrowLeft />
                Danh sách
              </Link>
            </Button>
            <Button variant="outline" size="sm" disabled={loading} onClick={reload}>
              <RefreshCw />
              Tải lại
            </Button>
            {permissions.edit && !terminal && options && !optionsError && (
              <SuCoForm
                key={`edit-${incident.version}`}
                incident={incident}
                options={options}
                onSaved={reload}
                trigger={
                  <Button size="sm">
                    <Pencil />
                    Sửa hồ sơ
                  </Button>
                }
              />
            )}
          </>
        }
      />
      {optionsError && (
        <IncidentError message={`Không tải được danh mục: ${optionsError}`} retry={reload} />
      )}
      {loading && (
        <p role="status" className="text-muted-foreground text-xs">
          Đang cập nhật dữ liệu…
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <IncidentState incident={incident} />
        <DeadlineBadge incident={incident} />
      </div>
      <Tabs defaultValue="overview">
        <div className="overflow-x-auto pb-1">
          <TabsList className="min-w-max">
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="scene">Hiện trường</TabsTrigger>
            <TabsTrigger value="damages">Thiệt hại</TabsTrigger>
            <TabsTrigger value="documents">Tài liệu</TabsTrigger>
            <TabsTrigger value="assignments">Phân công</TabsTrigger>
            <TabsTrigger value="history">Lịch sử</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview">
          <div className="space-y-4">
            <SectionCard title="Thông tin hồ sơ">
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Information label="Mã sự cố">{incident.incidentCode}</Information>
                <Information label="Loại">
                  {incident.incidentType
                    ? options?.incidentTypes.find((type) => type.code === incident.incidentType)
                        ?.name ||
                      incidentTypeNames[incident.incidentType] ||
                      incident.incidentType
                    : "Chưa phân loại"}
                </Information>
                <Information label="Thời điểm xảy ra (UTC+7)">
                  {incidentTime(incident.occurredAt)}
                </Information>
                <Information label="Thời điểm ghi nhận">
                  {incidentTime(incident.reportedAt)}
                </Information>
                <Information label="Địa điểm">{incident.address}</Information>
                <Information label="Khu vực">{incident.regionName}</Information>
                <Information label="Đơn vị">{incident.unitName}</Information>
                <Information label="Cơ sở liên quan">{incident.facilityName}</Information>
                <Information label="Deadline">{incidentTime(incident.deadlineAt)}</Information>
                <Information label="Thời gian hoàn thành">
                  {incidentTime(incident.completedAt)}
                </Information>
                <Information label="Cán bộ tham gia">
                  {assignments
                    .filter((assignment) => assignment.status !== "CANCELLED")
                    .map((assignment) => assignment.officerName)
                    .join(", ") || "Chưa phân công"}
                </Information>
              </dl>
            </SectionCard>
            {options && (
              <SectionCard
                title="Deadline và tiến độ"
                description={`Cảnh báo sắp hạn trước ${options.policy.warningHours} giờ; dừng khi hoàn thành hoặc đóng hồ sơ.`}
              >
                <IncidentProgressForm
                  key={`progress-${incident.version}`}
                  incident={incident}
                  permissions={permissions}
                  options={options}
                  onSaved={reload}
                />
                <p className="text-muted-foreground mt-3 text-xs">
                  Cảnh báo được tính khi truy vấn hồ sơ; thông báo chủ động theo lịch phụ thuộc
                  M07/M10.
                </p>
              </SectionCard>
            )}
          </div>
        </TabsContent>
        <TabsContent value="scene">
          <SectionCard title="Phân loại và thông tin hiện trường">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Information label="Loại sự cố">
                {incident.incidentType
                  ? options?.incidentTypes.find((type) => type.code === incident.incidentType)
                      ?.name ||
                    incidentTypeNames[incident.incidentType] ||
                    incident.incidentType
                  : "Chưa phân loại"}
              </Information>
              <Information label="Phân nhóm">
                {options?.incidentTypes
                  .find((type) => type.code === incident.incidentType)
                  ?.subtypes.find((subtype) => subtype.code === incident.incidentSubtype)?.name ||
                  incident.incidentSubtype ||
                  "Chưa phân nhóm"}
              </Information>
              <Information label="Địa điểm">{incident.address}</Information>
              <Information label="Diễn biến / mô tả">
                <span className="whitespace-pre-wrap">{incident.description}</span>
              </Information>
              <div className="sm:col-span-2">
                <Information label="Chi tiết hiện trường">
                  <span className="whitespace-pre-wrap">{incident.sceneDetails}</span>
                </Information>
              </div>
            </dl>
            <p className="text-muted-foreground mt-4 text-xs">
              Chọn “Sửa hồ sơ” để cập nhật phân loại và hiện trường khi có quyền sửa.
            </p>
          </SectionCard>
        </TabsContent>
        <TabsContent value="damages">
          <SectionCard
            title="Thiệt hại về người và tài sản"
            description={`Người chết: ${humanCount("DEATH")} · Bị thương: ${humanCount("INJURED")} · Được cứu: ${humanCount("RESCUED")} · Tài sản: ${propertyValue.toLocaleString("vi-VN")} VNĐ`}
            action={
              permissions.edit && !terminal ? (
                <DamageForm incidentId={id} onSaved={reload} />
              ) : undefined
            }
            contentClassName="px-0 pb-0"
          >
            {damages.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nhóm / loại</TableHead>
                    <TableHead className="text-right">Số lượng</TableHead>
                    <TableHead className="text-right">Giá trị (VNĐ)</TableHead>
                    <TableHead>Mô tả / ghi chú</TableHead>
                    <TableHead>Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {damages.map((damage) => (
                    <TableRow key={damage.id}>
                      <TableCell>
                        {damage.damageGroup === "HUMAN" ? "Người" : "Tài sản"}
                        <p className="text-muted-foreground text-xs">
                          {damageTypeNames[damage.damageType] || damage.damageType}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{damage.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {damage.propertyValue.toLocaleString("vi-VN")}
                      </TableCell>
                      <TableCell className="max-w-72 whitespace-pre-wrap text-xs">
                        {damage.description}
                        <p className="text-muted-foreground">{damage.notes}</p>
                      </TableCell>
                      <TableCell>
                        {permissions.edit && !terminal && (
                          <DamageForm
                            key={`${damage.id}-${damage.updatedAt}`}
                            incidentId={id}
                            damage={damage}
                            onSaved={reload}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                title="Chưa ghi nhận thiệt hại"
                description="Các giá trị được tổng hợp trực tiếp từ bản ghi thiệt hại của hồ sơ."
              />
            )}
          </SectionCard>
        </TabsContent>
        <TabsContent value="documents">
          <SectionCard title="Tài liệu và hình ảnh">
            <DocumentsPanel
              incidentId={id}
              documents={documents}
              options={options}
              canUpload={permissions.edit && !terminal}
              onSaved={reload}
            />
          </SectionCard>
        </TabsContent>
        <TabsContent value="assignments">
          <SectionCard
            title="Phân công xử lý"
            description="Mỗi cán bộ có thể nhận nhiệm vụ và deadline riêng. Phân công được lưu bền vững cùng hồ sơ sự cố."
            action={
              permissions.approve &&
              !terminal &&
              incident.recordStatus === "OFFICIAL" &&
              options ? (
                <AssignmentForm incidentId={id} options={options} onSaved={reload} />
              ) : undefined
            }
            contentClassName="px-0 pb-0"
          >
            {assignments.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cán bộ</TableHead>
                    <TableHead>Nhiệm vụ</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Tiến độ</TableHead>
                    <TableHead>Ghi chú</TableHead>
                    <TableHead>Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="whitespace-nowrap">{assignment.officerName}</TableCell>
                      <TableCell className="max-w-72 whitespace-pre-wrap text-xs">
                        {assignment.taskDescription}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {incidentTime(assignment.deadlineAt)}
                        <p className="text-muted-foreground">
                          Giao {incidentTime(assignment.assignedAt)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            assignment.status === "COMPLETED"
                              ? "success"
                              : assignment.status === "CANCELLED"
                                ? "muted"
                                : "info"
                          }
                        >
                          {assignmentStatusNames[assignment.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-48 whitespace-pre-wrap text-xs">
                        {assignment.notes}
                      </TableCell>
                      <TableCell>
                        {!terminal &&
                          options &&
                          (permissions.approve ||
                            (permissions.edit &&
                              officerId === assignment.officerId &&
                              !["COMPLETED", "CANCELLED"].includes(assignment.status))) && (
                            <AssignmentForm
                              key={`${assignment.id}-${assignment.updatedAt}`}
                              incidentId={id}
                              options={options}
                              assignment={assignment}
                              progressOnly={!permissions.approve}
                              onSaved={reload}
                            />
                          )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                title="Chưa có phân công"
                description={
                  incident.recordStatus === "DRAFT"
                    ? "Lưu chính thức trước khi phân công cán bộ."
                    : "Người có quyền phân công có thể giao nhiều nhiệm vụ cho cán bộ trong phạm vi."
                }
              />
            )}
          </SectionCard>
        </TabsContent>
        <TabsContent value="history">
          <div className="space-y-4">
            {historyError ? (
              <IncidentError message={historyError} retry={reload} />
            ) : (
              <SectionCard title="Lịch sử trạng thái và deadline">
                {history.length ? (
                  <ol className="space-y-4">
                    {history.map((entry) => (
                      <li key={entry.id} className="border-primary/30 border-l-2 pl-4">
                        <p className="text-sm font-medium">
                          {entry.fromStatus
                            ? processingStatusNames[entry.fromStatus as ProcessingStatus] ||
                              entry.fromStatus
                            : "Tạo hồ sơ"}{" "}
                          →{" "}
                          {entry.toStatus
                            ? processingStatusNames[entry.toStatus as ProcessingStatus] ||
                              entry.toStatus
                            : "—"}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {incidentTime(entry.changedAt)} · Người thực hiện: {entry.changedBy}
                        </p>
                        {entry.oldDeadlineAt !== entry.newDeadlineAt && (
                          <p className="mt-1 text-xs">
                            Deadline: {incidentTime(entry.oldDeadlineAt)} →{" "}
                            {incidentTime(entry.newDeadlineAt)}
                          </p>
                        )}
                        {(entry.reason || entry.notes) && (
                          <p className="mt-1 whitespace-pre-wrap text-sm">
                            {entry.reason}
                            {entry.notes ? ` · ${entry.notes}` : ""}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <EmptyState icon={History} title="Chưa có lịch sử" />
                )}
              </SectionCard>
            )}
            {!historyError && (
              <SectionCard
                title="Nhật ký thao tác"
                description="Dữ liệu trước và sau của các thay đổi nghiệp vụ trong hồ sơ."
              >
                {audit.length ? (
                  <ol className="space-y-3">
                    {audit.map((entry) => (
                      <li key={entry.id} className="rounded-lg border p-3">
                        <p className="text-sm font-medium">
                          {historyActionNames[entry.action] || entry.action}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {incidentTime(entry.occurredAt)} · {entry.actorId}
                        </p>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs">
                            Xem dữ liệu trước / sau
                          </summary>
                          <div className="mt-2 grid min-w-0 gap-3 sm:grid-cols-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium">Trước</p>
                              <pre className="bg-muted max-h-64 overflow-auto rounded p-2 text-xs">
                                {JSON.stringify(entry.before, null, 2)}
                              </pre>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium">Sau</p>
                              <pre className="bg-muted max-h-64 overflow-auto rounded p-2 text-xs">
                                {JSON.stringify(entry.after, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </details>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <EmptyState title="Chưa có nhật ký" />
                )}
              </SectionCard>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
