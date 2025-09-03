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

// Optional immediate run
(async () => {
  try { console.log("🚀 Initial sync..."); await syncAttendanceLogs(); } catch {}
})();
