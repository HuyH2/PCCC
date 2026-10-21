"use client";

export class IncidentApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "IncidentApiError";
  }
}
export async function incidentApi<T>(
  path: string,
  { method = "GET", body, signal }: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const form = body instanceof FormData;
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: body === undefined || form ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
  });
  if (response.status === 401) {
    window.location.assign("/dang-nhap");
    throw new IncidentApiError("Phiên đăng nhập đã hết hạn.", 401);
  }
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new IncidentApiError(
      result?.error?.message || "Không thể xử lý yêu cầu. Vui lòng thử lại.",
      response.status,
      result?.error?.code,
    );
  return result as T;
}
export function incidentErrorMessage(error: unknown) {
  if (error instanceof Error && error.name === "TimeoutError")
    return "Dịch vụ phản hồi quá chậm. Vui lòng thử lại.";
  if (error instanceof TypeError) return "Không thể kết nối dịch vụ. Vui lòng thử lại.";
  return error instanceof Error ? error.message : "Không thể xử lý yêu cầu. Vui lòng thử lại.";
}
