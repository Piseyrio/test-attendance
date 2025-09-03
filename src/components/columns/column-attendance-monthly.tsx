"use client";


 // ✅ type from Prisma
import { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { AttendanceStatus } from "../../../generated/prisma/client";

// ---------- Row type ----------
export type Student = {
  id: number;
  firstname: string;
  lastname: string;
};

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
        // Handle blank option safely
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

// ---------- Columns builder (full month) ----------
export function buildAttendanceColumns(
  days: string[], // ["2025-08-01", ...] (yyyy-MM-dd)
  editData: Record<string, AttendanceStatus | "">, // key = `${studentId}_${date}`
  onChange: AttendanceCellProps["onChange"],
  getAttendanceStatus: (studentId: number, date: string) => AttendanceStatus | ""
): ColumnDef<Student>[] {
  return [
    {
      id: "name",
      header: "Name",
      accessorFn: (row) => `${row.firstname} ${row.lastname}`, // helps filtering/sorting
      cell: ({ row }) => `${row.original.firstname} ${row.original.lastname}`,
      size: 220,
    },
    ...days.map((date) => ({
      id: date,
      header: () => format(parseISO(date), "d"), // ✅ timezone-safe label
      enableSorting: false,
      meta: { className: "text-center" as const },
      cell: ({ row }) => {
        const studentId = row.original.id;
        const key = `${studentId}_${date}`;
        const value = editData[key] ?? getAttendanceStatus(studentId, date);
        return (
          <div className="flex items-center justify-center">
            <AttendanceCell
              studentId={studentId}
              date={date}
              value={value}
              onChange={onChange}
            />
          </div>
        );
      },
    })),
  ];
}
