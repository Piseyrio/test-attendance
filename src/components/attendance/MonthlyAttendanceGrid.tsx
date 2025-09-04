"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableAttendanceMonthly } from "@/components/data-table/data-table-attendance-monthly";
import {
  buildAttendanceColumns,
  type Student,
} from "@/components/columns/column-attendance-monthly";
import type { AttendanceStatus } from "../../../generated/prisma/client";

type RecordRow = { studentId: number; date: string; status: AttendanceStatus; note?: string | null };

// simple month day list (no padding)
function daysInMonth(year: number, month1to12: number) {
  return new Date(year, month1to12, 0).getUTCDate();
}
function buildDayList(year: number, month: number) {
  return Array.from({ length: daysInMonth(year, month) }, (_, i) =>
    new Date(Date.UTC(year, month - 1, i + 1)).toISOString().slice(0, 10)
  );
}

export default function MonthlyAttendanceGrid({
  year,
  month,
  classId,
}: {
  year: number;
  month: number; // 1..12
  classId?: number;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [editData, setEditData] = useState<Record<string, AttendanceStatus | "">>({});
  const [, startTransition] = useTransition();

  const days = useMemo(() => buildDayList(year, month), [year, month]);

  // map "studentId_yyyy-mm-dd" -> status
  const recordsByKey = useMemo(() => {
    const m = new Map<string, AttendanceStatus>();
    for (const r of records) m.set(`${r.studentId}_${r.date.slice(0, 10)}`, r.status);
    return m;
  }, [records]);

  const getStatus = (sid: number, date: string) => recordsByKey.get(`${sid}_${date}`) ?? "";

  const onChange = (sid: number, date: string, value: AttendanceStatus | "") => {
    const key = `${sid}_${date}`;
    setEditData((prev) => ({ ...prev, [key]: value }));

    startTransition(async () => {
      if (value === "") {
        // delete
        const url = new URL("/api/attendance/day", window.location.origin);
        url.searchParams.set("studentId", String(sid));
        url.searchParams.set("dateISO", date);
        await fetch(url.toString(), { method: "DELETE" });
        setRecords((prev) => prev.filter((r) => !(r.studentId === sid && r.date.startsWith(date))));
      } else {
        // upsert
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

  // fetch month payload
  useEffect(() => {
    let alive = true;
    (async () => {
      const url = new URL("/api/attendance/month", window.location.origin);
      url.searchParams.set("year", String(year));
      url.searchParams.set("month", String(month));
      if (classId) url.searchParams.set("classId", String(classId));
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (!alive) return;
      setStudents(json.students ?? []);
      setRecords(json.records ?? []);
      setEditData({});
    })();
    return () => { alive = false; };
  }, [year, month, classId]);

  // flat columns (no week groups)
  const columns: ColumnDef<Student>[] = useMemo(
    () => buildAttendanceColumns(days, editData, onChange, getStatus),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [days, editData]
  );

  return <DataTableAttendanceMonthly columns={columns} data={students} />;
}
