// src/lib/zkCron.cjs
require("dotenv").config(); // ← load .env
const cron = require("node-cron");
const { syncAttendanceLogs, markAbsentForToday } = require("./zkSync.cjs");

const TZ = process.env.TZ || "Asia/Phnom_Penh";
process.env.TZ = TZ; // keep for libraries that read process.env.TZ

// Poll device every minute
let running = false;
cron.schedule(
  "*/1 * * * *",
  async () => {
    if (running) return console.log("⏭️  Skip: previous sync running");
    running = true;
    console.log(`[${new Date().toLocaleString()}] ⏱️  Auto-sync…`);
    try {
      await syncAttendanceLogs();
      console.log("✅ Done");
    } catch (e) {
      console.error("❌ Auto-sync error:", e?.message || e);
    } finally {
      running = false;
    }
  },
  { timezone: TZ }
);

// Mark ABSENT shortly after each window ends (local times)
cron.schedule(
  "5 19 * * 1,2,3,5",
  async () => {
    const res = await markAbsentForToday();
    console.log(`👤 ABSENT M/T/W/F: +${res.created}`);
  },
  { timezone: TZ }
);
cron.schedule(
  "5 17 * * 4",
  async () => {
    const res = await markAbsentForToday();
    console.log(`👤 ABSENT Thu: +${res.created}`);
  },
  { timezone: TZ }
);
cron.schedule(
  "5 11 * * 0",
  async () => {
    const res = await markAbsentForToday();
    console.log(`👤 ABSENT Sun: +${res.created}`);
  },
  { timezone: TZ }
);

// Optional immediate run when the process starts
(async () => {
  try {
    console.log("🚀 Initial sync…");
    await syncAttendanceLogs();
  } catch {}
})();

// (nice-to-have) catch unhandled errors so the process doesn't silently die
process.on("unhandledRejection", (err) => console.error("UnhandledRejection:", err));
process.on("uncaughtException", (err) => console.error("UncaughtException:", err));
