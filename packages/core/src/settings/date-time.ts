import type { DateFormat } from "./country-defaults";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

// An instant as the workspace shows it: the date in its date format (DATE_FORMATS; `mmm` is the English three-letter
// month whatever the locale, plan Q10), then the 24-hour time and the time zone, all in the workspace time zone. For
// example 08-Nov-2026 14:05 (Asia/Kuala_Lumpur).
export function formatDateTime(instant: Date, timeZone: string, dateFormat: DateFormat): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  ) as Record<"year" | "month" | "day" | "hour" | "minute", string>;
  const { year, month, day } = parts;
  const date =
    dateFormat === "dd-mmm-yyyy"
      ? `${day}-${MONTHS[Number(month) - 1]}-${year}`
      : dateFormat === "dd/mm/yyyy"
        ? `${day}/${month}/${year}`
        : `${year}-${month}-${day}`;
  return `${date} ${parts.hour}:${parts.minute} (${timeZone})`;
}
