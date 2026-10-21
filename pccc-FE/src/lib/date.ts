export const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Ngày nghiệp vụ YYYY-MM-DD theo giờ Việt Nam.
 * Không dùng `toISOString().slice(0, 10)` vì đó là ngày UTC và sẽ lùi một ngày
 * trong khung 00:00–06:59 giờ Việt Nam.
 */
export function toBusinessDate(value: Date | number = new Date()) {
  const parts = formatter.formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
