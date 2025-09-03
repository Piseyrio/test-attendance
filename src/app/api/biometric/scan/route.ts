import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const LATE_CUTOFF = { hour: 16, minute: 0 }; // set your cutoff

function startOfDayLocal(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0); }
function isLate(ts: Date) {
  const c = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate(), LATE_CUTOFF.hour, LATE_CUTOFF.minute);
  return ts.getTime() > c.getTime();
}

/** POST { biometricId: string; timestamp?: string } */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const biometricId = body?.biometricId as string | undefined;
  const ts = body?.timestamp ? new Date(body.timestamp) : new Date();
  if (!biometricId) return NextResponse.json({ error: "biometricId is required" }, { status: 400 });

  const student = await prisma.student.findUnique({ where: { biometricId } });
  if (!student) return NextResponse.json({ error: "Student not found for biometricId" }, { status: 404 });

  const date = startOfDayLocal(ts);
  const incoming = isLate(ts) ? "LATE" : "PRESENT" as const;

  const existing = await prisma.attendance.findUnique({
    where: { studentId_date: { studentId: student.id, date } },
    select: { status: true },
  });

  if (!existing) {
    await prisma.attendance.create({ data: { studentId: student.id, date, status: incoming } });
    return NextResponse.json({ ok: true, studentId: student.id, status: incoming });
  }

  // Don’t overwrite EXCUSED/ABSENT; escalate PRESENT -> LATE
  if (existing.status === "EXCUSED" || existing.status === "ABSENT") {
    return NextResponse.json({ ok: true, studentId: student.id, status: existing.status });
  }
  if (existing.status !== "LATE" && incoming === "LATE") {
    await prisma.attendance.update({
      where: { studentId_date: { studentId: student.id, date } },
      data: { status: "LATE" },
    });
    return NextResponse.json({ ok: true, studentId: student.id, status: "LATE" });
  }

  return NextResponse.json({ ok: true, studentId: student.id, status: existing.status });
}
