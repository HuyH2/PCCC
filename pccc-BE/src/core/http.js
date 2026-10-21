import { ApiError, assert } from "./errors.js";

export function cookieValue(request, name) {
  return (request.headers.cookie || "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export async function readJson(request, limit = 16384) {
  assert(
    request.headers["content-type"]?.split(";")[0].trim() === "application/json",
    415,
    "UNSUPPORTED_MEDIA_TYPE",
    "Yêu cầu Content-Type application/json.",
  );
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    assert(size <= limit, 413, "BODY_TOO_LARGE", "Dữ liệu gửi lên quá lớn.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "INVALID_JSON", "JSON không hợp lệ.");
  }
}

/**
 * Route: { method, path: string | RegExp, public?: true, handle(ctx, match) → response body }.
 * The body is sent as JSON with ctx.status (default 200); a handler that streams its own
 * response (e.g. a file download) ends ctx.response itself and nothing more is sent.
 * Returns the first route whose method and path match, plus the RegExp match (if any).
 */
export function findRoute(routes, method, path) {
  for (const route of routes) {
    if (route.method !== method) continue;
    if (typeof route.path === "string") {
      if (route.path === path) return { route, match: [path] };
    } else {
      const match = path.match(route.path);
      if (match) return { route, match };
    }
  }
  return null;
}

/**
 * Stream a binary file row (file_name, content_type, file_data) to the HTTP response.
 * Handlers that call this must NOT return a JSON body — they end the response themselves.
 */
export function sendFile(response, file) {
  response.statusCode = 200;
  response.setHeader("Content-Type", file.content_type);
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
  );
  response.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
  response.end(Buffer.from(file.file_data));
}
