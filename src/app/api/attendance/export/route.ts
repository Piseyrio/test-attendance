// src/app/api/attendance/export/route.ts
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

    const students = await prisma.student.findMany({
      select: { id: true, firstname: true, lastname: true },
      orderBy: [{ firstname: "asc" }, { lastname: "asc" }],
    });

    const grouped = await prisma.attendance.groupBy({
      by: ["studentId", "status"],
      where: { date: { gte: start, lt: end } },
      _count: { _all: true },
    });

    const map = new Map<number, { P: number; A: number; L: number; E: number }>();
    for (const s of students) map.set(s.id, { P: 0, A: 0, L: 0, E: 0 });
    for (const g of grouped) {
      const m = map.get(g.studentId)!;
      if (g.status === "PRESENT") m.P += g._count._all;
      else if (g.status === "ABSENT") m.A += g._count._all;
      else if (g.status === "LATE") m.L += g._count._all;
      else if (g.status === "EXCUSED") m.E += g._count._all;
    }

    const lines = [
      "StudentId,Firstname,Lastname,Present,Absent,Late,Excused,Total,Attendance %",
      ...students.map(s => {
        const c = map.get(s.id)!;
        const total = c.P + c.A + c.L + c.E;
        const pct = total ? Math.round((c.P / total) * 100) : 0;
        return [s.id, s.firstname, s.lastname, c.P, c.A, c.L, c.E, total, `${pct}%`]
          .map(csv).join(",");
      }),
    ];

    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance_${year}-${String(month).padStart(2,"0")}.csv"`,
      },
    });
  } catch (e) {
    console.error(e);
    return new NextResponse("Failed to export", { status: 500 });
  }
}
