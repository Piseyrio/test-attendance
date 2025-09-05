import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const RuleSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startMinutes: z.coerce.number().int().min(0).max(24 * 60 - 1),
  endMinutes: z.coerce.number().int().min(1).max(24 * 60),
  active: z.coerce.boolean().optional().default(true),
  label: z.string().max(100).optional().nullable(),
}).refine((v) => v.endMinutes > v.startMinutes, {
  message: "endMinutes must be greater than startMinutes",
  path: ["endMinutes"],
});

export async function GET() {
  const rules = await prisma.scheduleRule.findMany({ orderBy: [{ dayOfWeek: "asc" }, { startMinutes: "asc" }] });
  return NextResponse.json({ rules });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = RuleSchema.parse(body);
    const rule = await prisma.scheduleRule.create({ data: input });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/schedule/rules error:", e);
    const msg = e?.issues?.[0]?.message ?? e?.message ?? "Invalid request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
