// Shared due-date helpers for recurring/subscription UI.
//
// Backend next_due_date values arrive as bare "YYYY-MM-DD" strings. JS parses
// date-only strings as UTC midnight (per spec), which shifts the calendar day
// backward for any positive UTC-offset timezone (e.g. IST) when compared
// against a local "today". Always parse/serialize these as LOCAL date
// components instead of going through toISOString()/new Date(str) directly.

export function parseLocalDate(value) {
  if (value instanceof Date) return value;
  const s = String(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(s);
}

export function toLocalISODate(value) {
  const d = parseLocalDate(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getDueLabel(nextDue) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = parseLocalDate(nextDue);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due - today) / 86_400_000);
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff <= 7) return `In ${diff} days`;
  return due.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
