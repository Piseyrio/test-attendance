const cron = require("node-cron");
const { syncAttendanceLogs } = require("./zkSync.cjs");

let running = false;

cron.schedule(
  "*/1 * * * *",
  async () => {
    if (running) return console.log("⏭️  Skip: previous sync running");
    running = true;
    console.log("⏱️  Auto-sync...");
    try { await syncAttendanceLogs(); console.log("✅ Done"); }
    catch (e) { console.error("❌ Auto-sync error:", e?.message || e); }
    finally { running = false; }
  },
  { timezone: "Asia/Phnom_Penh" }
);

// Mark ABSENT a few minutes after each window ends
cron.schedule("5 19 * * 1,2,3,5", async () => { // Mon, Tue, Wed, Fri @ 19:05
  const res = await markAbsentForToday(); console.log(`ABSENT (Mon/Tue/Wed/Fri): ${res.created}`);
}, { timezone: "Asia/Phnom_Penh" });

cron.schedule("5 17 * * 4", async () => { // Thu @ 17:05
  const res = await markAbsentForToday(); console.log(`ABSENT (Thu): ${res.created}`);
}, { timezone: "Asia/Phnom_Penh" });

cron.schedule("5 11 * * 0", async () => { // Sun @ 11:05
  const res = await markAbsentForToday(); console.log(`ABSENT (Sun): ${res.created}`);
}, { timezone: "Asia/Phnom_Penh" });

// Optional immediate run
(async () => {
  try { console.log("🚀 Initial sync..."); await syncAttendanceLogs(); } catch {}
})();
