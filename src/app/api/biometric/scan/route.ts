// ...imports unchanged...
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 0=Sun, 1=Mon, ... 6=Sat
const DAILY_SCHEDULE: Record<number, { startH: number; startM: number; endH: number; endM: number }[]> = {
  1: [{ startH: 18, startM: 0, endH: 19, endM: 0 }], // Mon 18:00–19:00
  2: [{ startH: 18, startM: 0, endH: 19, endM: 0 }], // Tue
  3: [{ startH: 13, startM: 0, endH: 14, endM: 0 }], // Wed
  4: [{ startH: 16, startM: 0, endH: 17, endM: 0 }], // Thu 16:00–17:00
  5: [{ startH: 18, startM: 0, endH: 19, endM: 0 }], // Fri
  6: [],                                             // Sat (rest) -> no class
  0: [{ startH: 9,  startM: 0, endH: 11, endM: 0 }], // Sun 9:00–11:00
};

// optional late grace (minutes) after start time
const GRACE_MINUTES = 5;

function startOfDayLocal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function windowFor(ts: Date) {
  const day = ts.getDay(); // 0..6 (Sun..Sat)
  const list = DAILY_SCHEDULE[day] ?? [];
  if (list.length === 0) return null;

  // If you ever have multiple windows per day, you can choose the one that 'fits' ts here.
  const w = list[0];
  const start = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate(), w.startH, w.startM, 0, 0);
  const end   = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate(), w.endH,   w.endM,   0, 0);
  return { start, end };
}

// Decide status based on the scheduled window
function statusFromTimestamp(ts: Date): "PRESENT" | "LATE" | null {
  const win = windowFor(ts);
  if (!win) return null; // no class today -> ignore scans

  // early or within grace => PRESENT
  const graceEnd = new Date(win.start.getTime() + GRACE_MINUTES * 60_000);
  if (ts <= graceEnd) return "PRESENT";

  // between grace and end => LATE
  if (ts <= win.end) return "LATE";

  // after class window -> treat as LATE (or return null if you want to ignore)
  return "LATE";
}

/** POST { biometricId: string; timestamp?: string } */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const biometricId = body?.biometricId as string | undefined;
  const ts = body?.timestamp ? new Date(body.timestamp) : new Date();

  if (!biometricId) return NextResponse.json({ error: "biometricId is required" }, { status: 400 });

  const student = await prisma.student.findUnique({ where: { biometricId } });
  if (!student) return NextResponse.json({ error: "Student not found for biometricId" }, { status: 404 });

  const status = statusFromTimestamp(ts);
  if (!status) {
    // No class window today -> ignore (but respond OK)
    return NextResponse.json({ ok: true, ignored: true, reason: "no_class_window_today" });
  }

  const date = startOfDayLocal(ts);

  const existing = await prisma.attendance.findUnique({
    where: { studentId_date: { studentId: student.id, date } },
    select: { status: true },
  });

  if (!existing) {
    await prisma.attendance.create({ data: { studentId: student.id, date, status } });
    return NextResponse.json({ ok: true, studentId: student.id, status });
  }

  // Don’t overwrite EXCUSED/ABSENT; escalate PRESENT -> LATE
  if (existing.status === "EXCUSED" || existing.status === "ABSENT") {
    return NextResponse.json({ ok: true, studentId: student.id, status: existing.status });
  }
  if (existing.status !== "LATE" && status === "LATE") {
    await prisma.attendance.update({
      where: { studentId_date: { studentId: student.id, date } },
      data: { status: "LATE" },
    });
    return NextResponse.json({ ok: true, studentId: student.id, status: "LATE" });
  }

  return NextResponse.json({ ok: true, studentId: student.id, status: existing.status });
}
