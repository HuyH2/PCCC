const businessDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Business date (YYYY-MM-DD) in Vietnam time, independent of the server timezone.
 * Use this instead of `toISOString().slice(0, 10)`, which is UTC and can be one day
 * behind between 00:00 and 07:00 Vietnam time.
 */
export function businessDate(value = Date.now()) {
  const parts = businessDateFormatter.formatToParts(new Date(value));
  const part = (type) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
