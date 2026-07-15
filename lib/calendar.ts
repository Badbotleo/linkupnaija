// Helpers to add an event to Google Calendar or download an .ics file.
// Events store `date` (YYYY-MM-DD) + `time` (HH:MM[:SS]) with no end time,
// so we assume a default 2-hour duration. Times are treated as West Africa
// Time (Africa/Lagos, UTC+1) since that's where events happen.

const DEFAULT_DURATION_MIN = 120;
const TZID = "Africa/Lagos";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM or HH:MM:SS
}

// Returns floating local timestamps "YYYYMMDDTHHMMSS" for start and end.
function stamps(date: string, time: string): { start: string; end: string } {
  const [h, m] = time.split(":").map((n) => parseInt(n, 10));
  const [y, mo, d] = date.split("-").map((n) => parseInt(n, 10));
  const startD = new Date(y, (mo || 1) - 1, d || 1, h || 0, m || 0, 0);
  const endD = new Date(startD.getTime() + DEFAULT_DURATION_MIN * 60000);
  const fmt = (dt: Date) =>
    [
      dt.getFullYear(),
      String(dt.getMonth() + 1).padStart(2, "0"),
      String(dt.getDate()).padStart(2, "0"),
      "T",
      String(dt.getHours()).padStart(2, "0"),
      String(dt.getMinutes()).padStart(2, "0"),
      "00",
    ].join("");
  return { start: fmt(startD), end: fmt(endD) };
}

export function googleCalendarUrl(e: CalendarEvent): string {
  const { start, end } = stamps(e.date, e.time);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${start}/${end}`,
    ctz: TZID,
  });
  if (e.description) params.set("details", e.description);
  if (e.location) params.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function icsContent(e: CalendarEvent): string {
  const { start, end } = stamps(e.date, e.time);
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const dtStamp =
    new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LinkUpNaija//Events//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${e.id}@linkupnaija.com`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=${TZID}:${start}`,
    `DTEND;TZID=${TZID}:${end}`,
    `SUMMARY:${esc(e.title)}`,
    e.description ? `DESCRIPTION:${esc(e.description)}` : "",
    e.location ? `LOCATION:${esc(e.location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

// Data-URI for a downloadable .ics (works on iOS/Apple Calendar + Outlook).
export function icsDataUri(e: CalendarEvent): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent(e))}`;
}
