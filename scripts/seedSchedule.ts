// scripts/seedSchedule.ts (run with: node -r dotenv/config scripts/seedSchedule.ts)
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const rows = [
  { dayOfWeek: 1, startMinutes: 18*60, endMinutes: 19*60 },
  { dayOfWeek: 2, startMinutes: 18*60, endMinutes: 19*60 },
  { dayOfWeek: 3, startMinutes: 18*60, endMinutes: 19*60 },
  { dayOfWeek: 4, startMinutes: 16*60, endMinutes: 17*60 },
  { dayOfWeek: 5, startMinutes: 18*60, endMinutes: 19*60 },
  { dayOfWeek: 0, startMinutes:  9*60, endMinutes: 11*60 },
];
await prisma.scheduleRule.createMany({ data: rows.map(r => ({ ...r, active: true })) });
console.log("Seeded schedule rules");
process.exit(0);
