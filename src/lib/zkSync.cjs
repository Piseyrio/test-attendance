// src/lib/zkSync.cjs
const { PrismaClient } = require("../../generated/prisma/client");
const ZKLib = require("node-zklib");

const DEVICE_IP = process.env.ZK_IP || "192.168.102.102";
const PORT = Number(process.env.ZK_PORT || 4370);

// 0=Sun .. 6=Sat
const DAILY_SCHEDULE = {
  1: [{ startH: 1, startM: 0, endH: 19, endM: 0 }], // Mon
  2: [{ startH: 18, startM: 0, endH: 19, endM: 0 }], // Tue
  3: [{ startH: 13, startM: 0, endH: 14, endM: 0 }], // Wed
  4: [{ startH: 16, startM: 0, endH: 17, endM: 0 }], // Thu
  5: [{ startH: 18, startM: 0, endH: 19, endM: 0 }], // Fri
  6: [],                                             // Sat rest
  0: [{ startH: 9,  startM: 0, endH: 11, endM: 0 }], // Sun
};
const GRACE_MINUTES = 5;

const prisma = new PrismaClient();
const zk = new ZKLib(DEVICE_IP, PORT, 10000, 4000);

function startOfDayLocal(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0); }
function windowFor(ts) {
  const day = ts.getDay();
  const list = DAILY_SCHEDULE[day] || [];
  if (!list.length) return null;
  const w = list[0];
  const start = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate(), w.startH, w.startM, 0, 0);
  const end   = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate(), w.endH,   w.endM,   0, 0);
  return { start, end };
}
function statusFromTimestamp(ts) {
  const win = windowFor(ts);
  if (!win) return null;
  const graceEnd = new Date(win.start.getTime() + GRACE_MINUTES * 60_000);
  if (ts <= graceEnd) return "PRESENT";
  if (ts <= win.end)  return "LATE";
  return "LATE"; // after end
}

async function upsertFromScan(studentId, ts) {
  const day = startOfDayLocal(ts);
  const incoming = statusFromTimestamp(ts);
  if (!incoming) return null; // no class today

  const existing = await prisma.attendance.findUnique({
    where: { studentId_date: { studentId, date: day } },
    select: { status: true },
  });

  if (!existing) {
    await prisma.attendance.create({ data: { studentId, date: day, status: incoming } });
    return incoming;
  }
  if (existing.status === "EXCUSED" || existing.status === "ABSENT") return existing.status;
  if (existing.status !== "LATE" && incoming === "LATE") {
    await prisma.attendance.update({ where: { studentId_date: { studentId, date: day } }, data: { status: "LATE" } });
    return "LATE";
  }
  return existing.status;
}

async function syncAttendanceLogs() {
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

      const biometricId = String(deviceUserId);
      const ts = new Date(recordTime);

      const student = await prisma.student.findUnique({ where: { biometricId }, select: { id: true, firstname: true, lastname: true } });
      if (!student) { console.warn(`⛔ No student with biometricId ${biometricId}`); continue; }

      const final = await upsertFromScan(student.id, ts);
      if (!final) {
        console.log(`ℹ️  Ignored scan (no class window) for ${student.firstname} ${student.lastname}`);
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

if (require.main === module) syncAttendanceLogs();
module.exports = { syncAttendanceLogs };
