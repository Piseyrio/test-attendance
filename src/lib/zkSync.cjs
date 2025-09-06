// src/lib/zkSync.cjs
require("dotenv").config();
const { PrismaClient } = require("../../generated/prisma/client");
const ZKLib = require("node-zklib");

// keep server-local timezone predictable
process.env.TZ = process.env.TZ || "Asia/Phnom_Penh";

const prisma = new PrismaClient();

const GRACE_MINUTES = Number(process.env.ZK_GRACE_MIN || 5);         // late grace after start
const END_DELAY_MIN = Number(process.env.ZK_ABSENT_DELAY_MIN || 5);   // wait this after end before ABSENT

// ---------- helpers ----------
function localDayToUtcMidnight(d) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0));
}

function buildWindowFromRule(dateLocal, rule) {
  const start = new Date(dateLocal.getFullYear(), dateLocal.getMonth(), dateLocal.getDate(), 0, 0, 0, 0);
  start.setMinutes(rule.startMinutes);
  const end = new Date(dateLocal.getFullYear(), dateLocal.getMonth(), dateLocal.getDate(), 0, 0, 0, 0);
  end.setMinutes(rule.endMinutes);
  return { start, end };
}

async function getTodayWindow(dateLocal = new Date()) {
  const dow = dateLocal.getDay(); // 0..6
  // pick the earliest active window (simple case). You can expand to multiple later.
  const rule = await prisma.scheduleRule.findFirst({
    where: { dayOfWeek: dow, active: true },
    orderBy: [{ startMinutes: "asc" }],
  });
  if (!rule) return null;
  return buildWindowFromRule(dateLocal, rule);
}

async function statusFromTimestampLocal(ts) {
  const win = await getTodayWindow(ts);
  if (!win) return null; // no class today
  const graceEnd = new Date(win.start.getTime() + GRACE_MINUTES * 60_000);
  if (ts <= graceEnd) return "PRESENT";
  if (ts <= win.end) return "LATE";
  return "LATE"; // after end, still treat as late (change to null to ignore)
}

async function upsertFromScan(studentId, ts) {
  const dayUtc = localDayToUtcMidnight(ts);
  const incoming = await statusFromTimestampLocal(ts);
  if (!incoming) return null;

  const existing = await prisma.attendance.findUnique({
    where: { studentId_date: { studentId, date: dayUtc } },
    select: { status: true },
  });

  if (!existing) {
    await prisma.attendance.create({ data: { studentId, date: dayUtc, status: incoming } });
    return incoming;
  }
  if (existing.status === "EXCUSED" || existing.status === "ABSENT") return existing.status;

  if (existing.status !== "LATE" && incoming === "LATE") {
    await prisma.attendance.update({
      where: { studentId_date: { studentId, date: dayUtc } },
      data: { status: "LATE" },
    });
    return "LATE";
  }
  return existing.status;
}

// ---------- main sync ----------
async function syncAttendanceLogs() {
  const ip = process.env.ZK_IP || "192.168.102.102";
  const port = Number(process.env.ZK_PORT || 4370);

  const zk = new ZKLib(ip, port, 10000, 4000);
  try {
    await zk.createSocket();
    console.log(`🟢 Connected ${ip}:${port}`);

    const res = await zk.getAttendances();
    const rows = res?.data || res || [];
    if (!rows.length) {
      console.log("⚠️ No logs found on device.");
      return;
    }

    for (const log of rows) {
      const deviceUserId = log?.deviceUserId ?? log?.uid ?? log?.userId ?? log?.id;
      const recordTime = log?.recordTime ?? log?.timestamp ?? log?.time;
      if (deviceUserId == null || !recordTime) continue;

      const biometricId = String(deviceUserId).trim();
      const ts = new Date(recordTime);

      const student = await prisma.student.findUnique({
        where: { biometricId },
        select: { id: true, firstname: true, lastname: true },
      });
      if (!student) {
        console.warn(`⛔ No student with biometricId=${biometricId}`);
        continue;
      }

      const final = await upsertFromScan(student.id, ts);
      if (final) {
        console.log(`✅ ${student.firstname} ${student.lastname} -> ${final} @ ${ts.toLocaleString()}`);
      } else {
        console.log(`ℹ️ Ignored scan (no class window) for ${student.firstname} ${student.lastname}`);
      }
    }
  } catch (e) {
    console.error("❌ ZK sync error:", e?.message || e);
  } finally {
    try { await zk.disconnect(); } catch {}
    await prisma.$disconnect();
  }
}

// ---------- ABSENT filler ----------
async function markAbsentForToday() {
  const now = new Date();
  const win = await getTodayWindow(now);
  if (!win) return { created: 0, reason: "no-class-today" };

  const cutoff = new Date(win.end.getTime() + END_DELAY_MIN * 60_000);
  if (now < cutoff) return { created: 0, reason: "too-early" };

  const dayUtc = localDayToUtcMidnight(now);

  const existing = await prisma.attendance.findMany({
    where: { date: dayUtc },
    select: { studentId: true },
  });
  const haveRow = new Set(existing.map((x) => x.studentId));

  const students = await prisma.student.findMany({ select: { id: true } });
  const toCreate = students
    .filter((s) => !haveRow.has(s.id))
    .map((s) => ({ studentId: s.id, date: dayUtc, status: "ABSENT" }));

  if (!toCreate.length) return { created: 0, reason: "all-marked" };

  const res = await prisma.attendance.createMany({ data: toCreate, skipDuplicates: true });
  return { created: res.count };
}

module.exports = { syncAttendanceLogs, markAbsentForToday };

// run once if called directly: `node src/lib/zkSync.cjs`
if (require.main === module) {
  (async () => {
    try { await syncAttendanceLogs(); }
    finally { await prisma.$disconnect().catch(() => {}); }
  })();
}
