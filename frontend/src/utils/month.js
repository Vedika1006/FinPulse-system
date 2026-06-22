export function currentMonthParam() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function monthLabel(monthNumber) {
  const n = Number(monthNumber);
  if (!n || n < 1 || n > 12) return String(monthNumber);
  return MONTH_NAMES[n - 1];
}
