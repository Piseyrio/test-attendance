// src/app/api/attendance/export/detail/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function csv(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year"));
    const month = Number(searchParams.get("month"));
    if (!year || !month) return new NextResponse("Missing year/month", { status: 400 });

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end   = new Date(Date.UTC(year, month, 1));

    const rows = await prisma.attendance.findMany({
      where: { date: { gte: start, lt: end } },
      select: {
        studentId: true, date: true, status: true, note: true,
        student: { select: { biometricId: true } },
      },
      orderBy: [{ studentId: "asc" }, { date: "asc" }],
    });

    const header = "studentId,biometricId,date,status,note";
    const body = rows.map(r => [
      csv(r.studentId),
      csv(r.student?.biometricId ?? ""),
      r.date.toISOString().slice(0, 10),
      csv(r.status),
      csv(r.note ?? ""),
    ].join(","));

    const csvText = [header, ...body].join("\n");
    return new NextResponse(csvText, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance_detail_${year}-${String(month).padStart(2,"0")}.csv"`,
      },
    });
  } catch (e) {
    console.error(e);
    return new NextResponse("Failed to export", { status: 500 });
  }
}
