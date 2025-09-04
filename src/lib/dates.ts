// src/lib/dates.ts
export function toUtcMidnight(input: Date | string) {
  const d = new Date(input);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// accepts "YYYY-MM-DD" or "M/D/YYYY" or full ISO
export function parseDateAny(s: string | null | undefined) {
  if (!s) return null;
  const v = s.trim();
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/;         // 2025-09-01
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;   // 9/1/2025
  let m = v.match(ymd);
  if (m) return toUtcMidnight(new Date(Date.UTC(+m[1], +m[2]-1, +m[3])));
  m = v.match(mdy);
  if (m) return toUtcMidnight(new Date(Date.UTC(+m[3], +m[1]-1, +m[2])));
  const d = new Date(v);
  if (Number.isNaN(+d)) return null;
  return toUtcMidnight(d);
}
