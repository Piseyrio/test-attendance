"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table"; // your project generates to /generated/prisma
import { DataTableAttendanceMonthly } from "@/components/data-table/data-table-attendance-monthly";
import { format, parseISO } from "date-fns";
import { AttendanceStatus } from "../../../generated/prisma/client";

type Student = { id: number; firstname: string; lastname: string };
type RecordRow = { studentId: number; date: string; status: AttendanceStatus; note?: string | null };

function daysInMonth(year: number, month1to12: number) {
  return new Date(year, month1to12, 0).getUTCDate();
}
function buildDayList(year: number, month: number) {
  return Array.from({ length: daysInMonth(year, month) }, (_, i) =>
    new Date(Date.UTC(year, month - 1, i + 1)).toISOString().slice(0, 10)
  );
}

function AttendanceCell({
  studentId, date, value, onChange,
}: {
  studentId: number;
  date: string; // yyyy-MM-dd
  value?: AttendanceStatus | "";
  onChange: (studentId: number, date: string, value: AttendanceStatus | "") => void;
}) {
  const bg =
    value === "PRESENT" ? "bg-green-100 text-green-800"
    : value === "ABSENT" ? "bg-red-100 text-red-800"
    : value === "LATE" ? "bg-yellow-100 text-yellow-800"
    : value === "EXCUSED" ? "bg-blue-100 text-blue-800"
    : "";

  return (
    <select
      className={`w-14 rounded border px-1 py-1 text-sm ${bg}`}
      value={value ?? ""}
      onChange={(e) => onChange(studentId, date, e.target.value === "" ? "" : (e.target.value as AttendanceStatus))}
    >
      <option value="">--</option>
      <option value="PRESENT">P</option>
      <option value="ABSENT">A</option>
      <option value="LATE">L</option>
      <option value="EXCUSED">E</option>
    </select>
  );
}

function buildColumns(
  days: string[],
  editData: Record<string, AttendanceStatus | "">,
  onChange: (sid: number, date: string, v: AttendanceStatus | "") => void,
  getStatus: (sid: number, date: string) => AttendanceStatus | "",
): ColumnDef<Student>[] {
  return [
    {
      id: "name",
      header: "Name",
      accessorFn: (r) => `${r.firstname} ${r.lastname}`,
      cell: ({ row }) => `${row.original.firstname} ${row.original.lastname}`,
      size: 220,
    },
    ...days.map((date) => ({
      id: date,
      header: () => format(parseISO(date), "d"),
      enableSorting: false,
      meta: { className: "text-center" as const },
      cell: ({ row }) => {
        const sid = row.original.id;
        const key = `${sid}_${date}`;
        const value = editData[key] ?? getStatus(sid, date);
        return (
          <div className="flex items-center justify-center">
            <AttendanceCell studentId={sid} date={date} value={value} onChange={onChange} />
          </div>
        );
      },
    })),
  ];
}

export default function MonthlyAttendanceGrid({
  year, month,
}: {
  year: number;
  month: number; // 1..12
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [editData, setEditData] = useState<Record<string, AttendanceStatus | "">>({});
  const [pending, startTransition] = useTransition();

  const days = useMemo(() => buildDayList(year, month), [year, month]);

  const recordsByKey = useMemo(() => {
    const m = new Map<string, AttendanceStatus>();
    for (const r of records) {
      const d = r.date.length > 10 ? r.date.slice(0, 10) : r.date;
      m.set(`${r.studentId}_${d}`, r.status);
    }
    return m;
  }, [records]);

  const getStatus = (sid: number, date: string) => recordsByKey.get(`${sid}_${date}`) ?? "";

  const onChange = (sid: number, date: string, value: AttendanceStatus | "") => {
    const key = `${sid}_${date}`;
    setEditData((prev) => ({ ...prev, [key]: value }));

    startTransition(async () => {
      if (value === "") {
        // Clear cell
        const url = new URL("/api/attendance/day", window.location.origin);
        url.searchParams.set("studentId", String(sid));
        url.searchParams.set("dateISO", date);
        await fetch(url.toString(), { method: "DELETE" });
        setRecords((prev) => prev.filter((r) => !(r.studentId === sid && r.date.startsWith(date))));
      } else {
        // Upsert cell
        await fetch("/api/attendance/day", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: sid, dateISO: date, status: value }),
        });
        setRecords((prev) => {
          const i = prev.findIndex((r) => r.studentId === sid && r.date.startsWith(date));
          if (i >= 0) {
            const next = [...prev];
            next[i] = { ...next[i], status: value as AttendanceStatus, date: `${date}T00:00:00.000Z` };
            return next;
          }
          return [...prev, { studentId: sid, date: `${date}T00:00:00.000Z`, status: value as AttendanceStatus }];
        });
      }
    });
  };

  // Load month
  useEffect(() => {
    let alive = true;
    (async () => {
      const url = new URL("/api/attendance/month", window.location.origin);
      url.searchParams.set("year", String(year));
      url.searchParams.set("month", String(month));
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) return;
      const payload: { students: Student[]; records: RecordRow[] } = await res.json();
      if (!alive) return;
      setStudents(payload.students ?? []);
      setRecords(payload.records ?? []);
      setEditData({});
    })();
    return () => { alive = false; };
  }, [year, month]);

  const columns = useMemo<ColumnDef<Student>[]>(() => {
    return buildColumns(days, editData, onChange, getStatus);
  }, [days, editData]); // keep onChange/getStatus stable

  return <DataTableAttendanceMonthly columns={columns} data={students} />;
}
