"use client";

export class OrganizationApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "OrganizationApiError";
  }
}

export async function organizationApi<T>(
  path: string,
  { method = "GET", body, signal }: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
  });
  if (response.status === 401) {
    window.location.assign("/dang-nhap");
    throw new OrganizationApiError("Phiên đăng nhập đã hết hạn.", 401);
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new OrganizationApiError(
      result?.error?.message || "Không thể xử lý yêu cầu. Vui lòng thử lại.",
      response.status,
    );
  }
  return result as T;
}

export function organizationErrorMessage(error: unknown) {
  if (error instanceof Error && error.name === "TimeoutError") {
    return "Dịch vụ phản hồi quá chậm. Vui lòng thử lại.";
  }
  if (error instanceof TypeError) return "Không thể kết nối dịch vụ. Vui lòng thử lại.";
  return error instanceof Error ? error.message : "Không thể xử lý yêu cầu. Vui lòng thử lại.";
}
