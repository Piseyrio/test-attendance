const cron = require("node-cron");
const { syncAttendanceLogs, markAbsentForToday } = require("./zkSync.cjs");

// Optional: set TZ for the whole process (also set in your pm2/ENV if you like)
process.env.TZ = process.env.TZ || "Asia/Phnom_Penh";

// Poll device every minute
let running = false;
cron.schedule("*/1 * * * *", async () => {
  if (running) return console.log("⏭️  Skip: previous sync running");
  running = true;
  console.log("⏱️  Auto-sync…");
  try { await syncAttendanceLogs(); console.log("✅ Done"); }
  catch (e) { console.error("❌ Auto-sync error:", e?.message || e); }
  finally { running = false; }
});

// Mark ABSENT shortly after each window ends (local times)
cron.schedule("5 19 * * 1,2,3,5", async () => { // Mon/Tue/Wed/Fri @ 19:05
  const res = await markAbsentForToday();
  console.log(`👤 ABSENT M/T/W/F: +${res.created}`);
});
cron.schedule("5 17 * * 4", async () => {       // Thu @ 17:05
  const res = await markAbsentForToday();
  console.log(`👤 ABSENT Thu: +${res.created}`);
});
cron.schedule("5 11 * * 0", async () => {       // Sun @ 11:05
  const res = await markAbsentForToday();
  console.log(`👤 ABSENT Sun: +${res.created}`);
});

// Optional immediate run when the process starts
(async () => {
  try { console.log("🚀 Initial sync…"); await syncAttendanceLogs(); } catch {}
})();
