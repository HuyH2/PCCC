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

/** KPI period (YYYY-MM) in Vietnam time. */
export function businessPeriod(value = Date.now()) {
  return businessDate(value).slice(0, 7);
}

export function validPeriod(value) {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2100;
}

export function previousPeriod(period) {
  const [year, month] = period.split("-").map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
}

/** Start/end epoch of a KPI month in Vietnam time; end is exclusive. */
export function periodRange(period) {
  const [year, month] = period.split("-").map(Number);
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  return {
    start: Date.parse(`${period}-01T00:00:00+07:00`),
    end: Date.parse(`${next}-01T00:00:00+07:00`),
  };
}
