import { assert } from "./errors.js";

export function object(value, allowed) {
  assert(
    value && typeof value === "object" && !Array.isArray(value),
    400,
    "INVALID_INPUT",
    "Dữ liệu phải là một đối tượng JSON.",
  );
  assert(
    Object.keys(value).every((key) => allowed.includes(key)),
    400,
    "INVALID_INPUT",
    "Dữ liệu có trường không hợp lệ.",
  );
  return value;
}
export function text(value, field, min = 1, max = 128) {
  assert(
    typeof value === "string" && value.length >= min && value.length <= max,
    400,
    "INVALID_INPUT",
    `${field} phải có từ ${min} đến ${max} ký tự.`,
  );
  return value;
}
export function pagination(url) {
  const parse = (name, fallback, max) => {
    const raw = url.searchParams.get(name);
    if (raw === null) return fallback;
    assert(
      /^[1-9]\d{0,6}$/.test(raw) && Number(raw) <= max,
      400,
      "INVALID_INPUT",
      `${name} không hợp lệ.`,
    );
    return Number(raw);
  };
  return { page: parse("page", 1, 1000000), pageSize: parse("pageSize", 20, 100) };
}
