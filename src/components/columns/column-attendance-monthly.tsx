"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import type { AttendanceStatus } from "../../../generated/prisma/client";

// ---------- Row type ----------
export type Student = {
  id: number;
  firstname: string;
  lastname: string;
};

// ---------- Helpers ----------
function weekdayLetter(dateStr: string) {
  const d = parseISO(dateStr);
  const gd = d.getDay(); // 0=Sun..6=Sat
  return ["S", "M", "T", "W", "T", "F", "S"][gd];
}

// ---------- Cell ----------
type AttendanceCellProps = {
  studentId: number;
  date: string; // "yyyy-MM-dd"
  value?: AttendanceStatus | "";
  onChange: (studentId: number, date: string, value: AttendanceStatus | "") => void;
};

export function AttendanceCell({ studentId, date, value, onChange }: AttendanceCellProps) {
  const bg =
    value === "PRESENT"
      ? "bg-green-100 text-green-800"
      : value === "ABSENT"
      ? "bg-red-100 text-red-800"
      : value === "LATE"
      ? "bg-yellow-100 text-yellow-800"
      : value === "EXCUSED"
      ? "bg-blue-100 text-blue-800"
      : "";

  return (
    <select
      className={`w-14 rounded border px-1 py-1 text-sm ${bg}`}
      value={value ?? ""}
      onChange={(e) => {
        const raw = e.target.value;
        const next: AttendanceStatus | "" = raw === "" ? "" : (raw as AttendanceStatus);
        onChange(studentId, date, next);
      }}
    >
      <option value="">--</option>
      <option value="PRESENT">P</option>
      <option value="ABSENT">A</option>
      <option value="LATE">L</option>
      <option value="EXCUSED">E</option>
    </select>
  );
}

// ---------- Columns builder (flat month, no week groups) ----------
export function buildAttendanceColumns(
  days: string[], // ["2025-09-01", ...] (yyyy-MM-dd)
  editData: Record<string, AttendanceStatus | "">, // key = `${studentId}_${date}`
  onChange: AttendanceCellProps["onChange"],
  getAttendanceStatus: (studentId: number, date: string) => AttendanceStatus | ""
): ColumnDef<Student>[] {
  return [
    {
      id: "name",
      header: "Name",
      accessorFn: (row) => `${row.firstname} ${row.lastname}`,
      cell: ({ row }) => `${row.original.firstname} ${row.original.lastname}`,
      size: 220,
      meta: { className: "sticky left-0 bg-background z-10" as const },
    },
    ...days.map((date) => ({
      id: date,
      enableSorting: false,
      meta: { className: "text-center" as const },
      header: () => (
        <div className="flex flex-col items-center leading-tight">
          <div className="text-[10px] text-muted-foreground">{weekdayLetter(date)}</div>
          <div className="text-sm font-medium">{format(parseISO(date), "d")}</div>
        </div>
      ),
      cell: ({ row }) => {
        const sid = row.original.id;
        const key = `${sid}_${date}`;
        const value = editData[key] ?? getAttendanceStatus(sid, date);
        return (
          <div className="flex items-center justify-center">
            <AttendanceCell studentId={sid} date={date} value={value} onChange={onChange} />
          </div>
        );
      },
    })),
  ];
}
