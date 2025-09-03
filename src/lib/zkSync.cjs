const { PrismaClient } = require("../../generated/prisma/client"); // match your output path
const ZKLib = require("node-zklib");

const DEVICE_IP = process.env.ZK_IP || "192.168.102.102";
const PORT = Number(process.env.ZK_PORT || 4370);
const LATE_CUTOFF = { hour: 16, minute: 0 };

const prisma = new PrismaClient();
const zk = new ZKLib(DEVICE_IP, PORT, 10000, 4000);

function startOfDayLocal(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0); }
function statusFromTimestamp(ts) {
  const cut = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate(), LATE_CUTOFF.hour, LATE_CUTOFF.minute);
  return ts.getTime() > cut.getTime() ? "LATE" : "PRESENT";
}

async function upsertFromScan(studentId, ts) {
  const day = startOfDayLocal(ts);
  const incoming = statusFromTimestamp(ts);
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

      const biometricId = String(deviceUserId); // Student.biometricId is STRING
      const ts = new Date(recordTime);

      const student = await prisma.student.findUnique({ where: { biometricId }, select: { id: true, firstname: true, lastname: true } });
      if (!student) { console.warn(`⛔ No student with biometricId ${biometricId}`); continue; }

      const final = await upsertFromScan(student.id, ts);
      console.log(`✅ ${student.firstname} ${student.lastname} -> ${final} @ ${ts.toLocaleString()}`);
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
