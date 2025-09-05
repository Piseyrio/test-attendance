// CommonJS to keep it simple when run by node
require("dotenv").config(); // ← load .env
const { PrismaClient } = require("../../generated/prisma/client");
const ZKLib = require("node-zklib");

const DEVICE_IP = process.env.ZK_IP || "192.168.102.102";
const PORT = Number(process.env.ZK_PORT || 4370);
const GRACE_MINUTES = Number(process.env.ZK_GRACE_MIN || 5);

// Weekday windows in **local time** (0=Sun..6=Sat)
// Your spec: Mon/Tue/Wed/Fri 18:00–19:00, Thu 16:00–17:00, Sat OFF, Sun 09:00–11:00
const DAILY_SCHEDULE = {
  1: [{ startH: 18, startM: 0, endH: 19, endM: 0 }], // Mon
  2: [{ startH: 18, startM: 0, endH: 19, endM: 0 }], // Tue
  3: [{ startH: 18, startM: 0, endH: 19, endM: 0 }], // Wed
  4: [{ startH: 16, startM: 0, endH: 17, endM: 0 }], // Thu
  5: [{ startH: 18, startM: 0, endH: 19, endM: 0 }], // Fri
  6: [],                                             // Sat (rest)
  0: [{ startH: 9,  startM: 0, endH: 11, endM: 0 }], // Sun
};

const prisma = new PrismaClient();

// ---------- time helpers ----------

// Build a UTC-midnight Date for the **local** Y-M-D (avoids CSV shifting)
function localDayToUtcMidnight(d) {
  const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
  return new Date(Date.UTC(y, m, day, 0, 0, 0, 0));
}

// Returns the single class window (if any) for the timestamp's **local** day
function windowForLocal(ts) {
  const dow = ts.getDay();               // 0..6 (local)
  const list = DAILY_SCHEDULE[dow] || [];
  if (!list.length) return null;
  const w = list[0];
  const start = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate(), w.startH, w.startM, 0, 0);
  const end   = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate(), w.endH,   w.endM,   0, 0);
  return { start, end };
}

// Decide status from scan time (local) + grace
function statusFromTimestampLocal(ts) {
  const win = windowForLocal(ts);
  if (!win) return null; // no class today
  const graceEnd = new Date(win.start.getTime() + GRACE_MINUTES * 60_000);
  if (ts <= graceEnd) return "PRESENT";
  if (ts <= win.end)  return "LATE";
  return "LATE"; // after end we still keep LATE (you can change to ignore)
}

// ---------- core logic ----------

async function upsertFromScan(studentId, ts) {
  const dayUtc = localDayToUtcMidnight(ts);
  const incoming = statusFromTimestampLocal(ts);
  if (!incoming) return null; // no class window

  // Create first; upgrade PRESENT -> LATE if a later scan proves late.
  const existing = await prisma.attendance.findUnique({
    where: { studentId_date: { studentId, date: dayUtc } },
    select: { status: true },
  });

  if (!existing) {
    await prisma.attendance.create({ data: { studentId, date: dayUtc, status: incoming } });
    return incoming;
  }

  if (existing.status === "EXCUSED" || existing.status === "ABSENT") {
    return existing.status; // don't override
  }

  if (existing.status !== "LATE" && incoming === "LATE") {
    await prisma.attendance.update({
      where: { studentId_date: { studentId, date: dayUtc } },
      data: { status: "LATE" },
    });
    return "LATE";
  }

  return existing.status;
}

async function syncAttendanceLogs() {
  const zk = new ZKLib(DEVICE_IP, PORT, 10000, 4000);
  try {
    await zk.createSocket();
    console.log(`🟢 Connected ${DEVICE_IP}:${PORT}`);

    const res = await zk.getAttendances();
    const rows = res?.data || res || [];
    if (!rows.length) { console.log("⚠️ No logs found."); return; }

    for (const log of rows) {
      const deviceUserId = log?.deviceUserId ?? log?.uid ?? log?.userId ?? log?.id;
      const recordTime = log?.recordTime ?? log?.timestamp ?? log?.time;
      if (deviceUserId == null || !recordTime) { console.warn("⛔ Bad log:", log); continue; }

      const biometricId = String(deviceUserId).trim();
      const ts = new Date(recordTime); // local

      const student = await prisma.student.findUnique({
        where: { biometricId },
        select: { id: true, firstname: true, lastname: true },
      });
      if (!student) { console.warn(`⛔ No student with biometricId=${biometricId}`); continue; }

      const final = await upsertFromScan(student.id, ts);
      if (!final) {
        console.log(`ℹ️ Ignored scan (no class window) for ${student.firstname} ${student.lastname}`);
      } else {
        console.log(`✅ ${student.firstname} ${student.lastname} -> ${final} @ ${ts.toLocaleString()}`);
      }
    }
    await zk.disconnect();
    console.log("🔌 Disconnected");
  } catch (e) {
    console.error("❌ Sync error:", e?.message || e);
  } finally {
    await prisma.$disconnect();
  }
}

// Mark ABSENT for all students who have no record for **today's local class day**
async function markAbsentForToday() {
  const now = new Date();
  const win = windowForLocal(now);
  if (!win) return { created: 0, reason: "no-class-today" };

  const dayUtc = localDayToUtcMidnight(now);

  // Who already has a row today?
  const existing = await prisma.attendance.findMany({
    where: { date: dayUtc },
    select: { studentId: true },
  });
  const haveRow = new Set(existing.map(r => r.studentId));

  // All students (you can filter active if you add a status)
  const students = await prisma.student.findMany({ select: { id: true } });

  const toCreate = students
    .filter(s => !haveRow.has(s.id))
    .map(s => ({ studentId: s.id, date: dayUtc, status: "ABSENT" }));

  if (!toCreate.length) return { created: 0, reason: "all-marked" };

  const res = await prisma.attendance.createMany({
    data: toCreate,
    skipDuplicates: true, // safe with @@unique(studentId,date)
  });

  return { created: res.count };
}

module.exports = { syncAttendanceLogs, markAbsentForToday };

// Allow direct run: `node src/lib/zkSync.cjs`
if (require.main === module) {
  (async () => { await syncAttendanceLogs(); })();
}
