import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/attendance/month?year=YYYY&month=1..12
 * Response: { students: {id, firstname, lastname}[], records: {studentId, date, status, note}[] }
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month")); // 1..12

  if (!year || !month) {
    return NextResponse.json({ error: "year & month are required" }, { status: 400 });
  }

  // local month range: [start, endExclusive)
  const start = new Date(year, month - 1, 1);
  const endExclusive = new Date(year, month, 1);

  const students = await prisma.student.findMany({
    select: { id: true, firstname: true, lastname: true },
    orderBy: [{ firstname: "asc" }, { lastname: "asc" }],
  });

  const studentIds = students.map(s => s.id);
  const records = await prisma.attendance.findMany({
    where: { date: { gte: start, lt: endExclusive }, studentId: { in: studentIds } },
    select: { studentId: true, date: true, status: true, note: true },
    orderBy: [{ studentId: "asc" }, { date: "asc" }],
  });

  return NextResponse.json({ students, records });
}
