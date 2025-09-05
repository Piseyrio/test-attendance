// src/lib/zkSync.cjs
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const ZKLib = require("node-zklib");

const prisma = new PrismaClient();
const GRACE_MINUTES = Number(process.env.ZK_GRACE_MIN || 5);
const TZ = process.env.TZ || "Asia/Phnom_Penh";

// helpers
function localDayToUtcMidnight(d) { return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)); }
function buildWindowFromRule(dateLocal, rule) {
  const start = new Date(dateLocal.getFullYear(), dateLocal.getMonth(), dateLocal.getDate(), 0, 0, 0, 0);
  start.setMinutes(rule.startMinutes);
  const end = new Date(dateLocal.getFullYear(), dateLocal.getMonth(), dateLocal.getDate(), 0, 0, 0, 0);
  end.setMinutes(rule.endMinutes);
  return { start, end };
}
async function getTodayWindow(dateLocal = new Date()) {
  const dow = dateLocal.getDay(); // 0..6
  const rule = await prisma.scheduleRule.findFirst({
    where: { dayOfWeek: dow, active: true },
    orderBy: [{ startMinutes: "asc" }],
  });
  if (!rule) return null;
  return buildWindowFromRule(dateLocal, rule);
}

async function statusFromTimestampLocal(ts) {
  const win = await getTodayWindow(ts);
  if (!win) return null;
  const graceEnd = new Date(win.start.getTime() + GRACE_MINUTES * 60000);
  if (ts <= graceEnd) return "PRESENT";
  if (ts <= win.end)  return "LATE";
  return "LATE";
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
    await prisma.attendance.update({ where: { studentId_date: { studentId, date: dayUtc } }, data: { status: "LATE" } });
    return "LATE";
  }
  return existing.status;
}

async function syncAttendanceLogs() {
  const ip = process.env.ZK_IP || "192.168.102.102";
  const port = Number(process.env.ZK_PORT || 4370);

  const zk = new ZKLib(ip, port, 10000, 4000);
  try {
    await zk.createSocket();
    console.log(`🟢 Connected ${ip}:${port}`);
    const res = await zk.getAttendances();
    const rows = res?.data || res || [];
    for (const log of rows) {
      const deviceUserId = log?.deviceUserId ?? log?.uid ?? log?.userId ?? log?.id;
      const recordTime = log?.recordTime ?? log?.timestamp ?? log?.time;
      if (deviceUserId == null || !recordTime) continue;

      const biometricId = String(deviceUserId).trim();
      const ts = new Date(recordTime);

      const student = await prisma.student.findUnique({ where: { biometricId }, select: { id: true, firstname: true, lastname: true } });
      if (!student) { console.warn(`No student with biometricId=${biometricId}`); continue; }

      const final = await upsertFromScan(student.id, ts);
      if (final) console.log(`✅ ${student.firstname} ${student.lastname} -> ${final} @ ${ts.toLocaleString()}`);
    }
    await zk.disconnect();
  } catch (e) {
    console.error("ZK sync error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

// Only mark ABSENT **after** the window ended (+grace)
async function markAbsentForToday() {
  const now = new Date();
  const win = await getTodayWindow(now);
  if (!win) return { created: 0, reason: "no-class-today" };
  const cutoff = new Date(win.end.getTime() + GRACE_MINUTES * 60000);
  if (now < cutoff) return { created: 0, reason: "too-early" };

  const dayUtc = localDayToUtcMidnight(now);
  const existing = await prisma.attendance.findMany({ where: { date: dayUtc }, select: { studentId: true } });
  const have = new Set(existing.map(x => x.studentId));
  const students = await prisma.student.findMany({ select: { id: true } });

  const toCreate = students.filter(s => !have.has(s.id))
    .map(s => ({ studentId: s.id, date: dayUtc, status: "ABSENT" }));

  if (!toCreate.length) return { created: 0, reason: "all-marked" };
  const res = await prisma.attendance.createMany({ data: toCreate, skipDuplicates: true });
  return { created: res.count };
}

module.exports = { syncAttendanceLogs, markAbsentForToday };
