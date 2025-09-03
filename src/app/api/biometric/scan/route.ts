import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Change to your rule (local time)
const LATE_CUTOFF = { hour: 8, minute: 0 };

function startOfDayLocal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function isLate(ts: Date) {
  const cut = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate(), LATE_CUTOFF.hour, LATE_CUTOFF.minute, 0, 0);
  return ts.getTime() > cut.getTime();
}

/**
 * POST /api/biometric/scan
 * Body: { biometricId: string; timestamp?: string } // ISO; default now
 * Will mark PRESENT or LATE for that calendar day. One row per student/day.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const biometricId = body?.biometricId as string | undefined;
  const ts = body?.timestamp ? new Date(body.timestamp) : new Date();

  if (!biometricId) {
    return NextResponse.json({ error: "biometricId is required" }, { status: 400 });
  }

  // find student by biometricId (your schema uses biometricId)
  const student = await prisma.student.findUnique({ where: { biometricId } });
  if (!student) {
    return NextResponse.json({ error: "Student not found for biometricId" }, { status: 404 });
  }

  const date = startOfDayLocal(ts);
  const status: "PRESENT" | "LATE" = isLate(ts) ? "LATE" : "PRESENT";

  // upsert (escalate to LATE if needed)
  const row = await prisma.attendance.upsert({
    where: { studentId_date: { studentId: student.id, date } },
    create: { studentId: student.id, date, status },
    update: { status: status === "LATE" ? "LATE" : undefined, updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true, studentId: student.id, status: row.status });
}
