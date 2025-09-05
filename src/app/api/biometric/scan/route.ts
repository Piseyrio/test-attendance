// src/app/api/biometric/scan/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const GRACE_MINUTES = Number(process.env.ZK_GRACE_MIN ?? 5);

// Build a UTC-midnight Date for the local Y-M-D (prevents CSV/date shifting)
function localDayToUtcMidnight(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0));
}

function buildWindowFromRule(dateLocal: Date, rule: { startMinutes: number; endMinutes: number }) {
  const start = new Date(dateLocal.getFullYear(), dateLocal.getMonth(), dateLocal.getDate(), 0, 0, 0, 0);
  start.setMinutes(rule.startMinutes);
  const end = new Date(dateLocal.getFullYear(), dateLocal.getMonth(), dateLocal.getDate(), 0, 0, 0, 0);
  end.setMinutes(rule.endMinutes);
  return { start, end };
}

async function getWindowForDate(dateLocal: Date) {
  const dow = dateLocal.getDay(); // 0..6
  const rule = await prisma.scheduleRule.findFirst({
    where: { dayOfWeek: dow, active: true },
    orderBy: [{ startMinutes: "asc" }],
  });
  if (!rule) return null;
  return buildWindowFromRule(dateLocal, rule);
}

async function statusFromTimestampLocal(ts: Date): Promise<"PRESENT" | "LATE" | null> {
  const win = await getWindowForDate(ts);
  if (!win) return null;
  const graceEnd = new Date(win.start.getTime() + GRACE_MINUTES * 60_000);
  if (ts <= graceEnd) return "PRESENT";
  if (ts <= win.end) return "LATE";
  return "LATE"; // after end; change to `null` if you prefer to ignore
}

/** POST { biometricId: string; timestamp?: string } */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const biometricId = typeof body?.biometricId === "string" ? body.biometricId.trim() : undefined;
    const ts = body?.timestamp ? new Date(body.timestamp) : new Date();

    if (!biometricId) {
      return NextResponse.json({ error: "biometricId is required" }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { biometricId },
      select: { id: true },
    });
    if (!student) {
      return NextResponse.json({ error: "Student not found for biometricId" }, { status: 404 });
    }

    const status = await statusFromTimestampLocal(ts);
    if (!status) {
      // No class window today → ignore scan but respond OK
      return NextResponse.json({ ok: true, ignored: true, reason: "no_class_window_today" });
    }

    const date = localDayToUtcMidnight(ts);

    const existing = await prisma.attendance.findUnique({
      where: { studentId_date: { studentId: student.id, date } },
      select: { status: true },
    });

    if (!existing) {
      await prisma.attendance.create({ data: { studentId: student.id, date, status } });
      return NextResponse.json({ ok: true, studentId: student.id, status });
    }

    // Don't override EXCUSED/ABSENT
    if (existing.status === "EXCUSED" || existing.status === "ABSENT") {
      return NextResponse.json({ ok: true, studentId: student.id, status: existing.status });
    }

    // Escalate PRESENT → LATE if the later scan proves late
    if (existing.status !== "LATE" && status === "LATE") {
      await prisma.attendance.update({
        where: { studentId_date: { studentId: student.id, date } },
        data: { status: "LATE" },
      });
      return NextResponse.json({ ok: true, studentId: student.id, status: "LATE" });
    }

    return NextResponse.json({ ok: true, studentId: student.id, status: existing.status });
  } catch (e: any) {
    console.error("biometric/scan error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
