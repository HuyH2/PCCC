"use client";

import * as React from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
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
import { incidentApi, incidentErrorMessage } from "@/lib/incident-client";
import { incidentTime, type IncidentDocument, type IncidentOptions } from "@/lib/incident-contract";

export function DocumentsPanel({
  incidentId,
  documents,
  options,
  canUpload,
  onSaved,
}: {
  incidentId: string;
  documents: IncidentDocument[];
  options: IncidentOptions | null;
  canUpload: boolean;
  onSaved: () => void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [permitted, setPermitted] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const id = React.useId();
  async function upload(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (!file || !options) throw new Error("Chọn tài liệu cần tải lên.");
      if (!permitted) throw new Error("Xác nhận tài liệu được phép dùng trong môi trường này.");
      if (file.size <= 0 || file.size > options.policy.maxUploadBytes)
        throw new Error("Tệp rỗng hoặc vượt quá dung lượng cho phép.");
      const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (
        !options.policy.allowedExtensions.some(
          (item) => (item.startsWith(".") ? item : `.${item}`).toLowerCase() === extension,
        )
      )
        throw new Error("Định dạng tệp không nằm trong cấu hình được phép tải lên.");
      const body = new FormData();
      body.set("file", file);
      body.set("permitted", "true");
      setSaving(true);
      await incidentApi(`/api/incidents/${encodeURIComponent(incidentId)}/documents`, {
        method: "POST",
        body,
      });
      toast.success("Đã lưu tài liệu");
      setFile(null);
      setPermitted(false);
      if (input.current) input.current.value = "";
      onSaved();
    } catch (cause) {
      setError(incidentErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      {canUpload && options && (
        <form onSubmit={upload} className="space-y-3 rounded-lg border p-4">
          <fieldset disabled={saving} className="space-y-3">
            <Label htmlFor={`${id}-file`}>Tài liệu / hình ảnh</Label>
            <Input
              ref={input}
              id={`${id}-file`}
              type="file"
              accept={options.policy.allowedExtensions
                .map((extension) => (extension.startsWith(".") ? extension : `.${extension}`))
                .join(",")}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-muted-foreground text-xs">
              Cho phép {options.policy.allowedExtensions.join(", ")} · tối đa{" "}
              {Math.round((options.policy.maxUploadBytes / 1024 / 1024) * 10) / 10} MB.
            </p>
            <label className="flex items-start gap-2 text-sm" htmlFor={`${id}-permitted`}>
              <input
                id={`${id}-permitted`}
                type="checkbox"
                className="mt-1"
                checked={permitted}
                onChange={(event) => setPermitted(event.target.checked)}
              />
              <span>
                Tôi xác nhận đây là tài liệu thử nghiệm được phép upload, không chứa tài liệu mật,
                bí mật nhà nước hoặc dữ liệu chưa được cho phép (Q12).
              </span>
            </label>
            <Button type="submit" size="sm" disabled={saving || !file || !permitted}>
              {saving ? <Loader2 className="animate-spin" /> : <Upload />}
              {saving ? "Đang tải lên…" : "Tải lên"}
            </Button>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
          </fieldset>
        </form>
      )}
      {documents.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tài liệu</TableHead>
              <TableHead>Dung lượng</TableHead>
              <TableHead>Thời gian upload</TableHead>
              <TableHead>Tải file</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((document) => (
              <TableRow key={document.id}>
                <TableCell className="max-w-64 break-words">
                  <p className="font-medium">{document.fileName}</p>
                  <p className="text-muted-foreground text-xs">{document.mimeType}</p>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {(document.size / 1024).toFixed(1)} KB
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {incidentTime(document.uploadedAt)}
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`/api/incidents/${encodeURIComponent(incidentId)}/documents/${encodeURIComponent(document.id)}/download`}
                      download
                    >
                      <Download />
                      Tải xuống
                    </a>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          title="Chưa có tài liệu"
          description="Tài liệu được lưu riêng và chỉ tải được khi có quyền truy cập hồ sơ."
        />
      )}
    </div>
  );
}
