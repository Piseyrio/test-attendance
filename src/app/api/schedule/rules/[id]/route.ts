import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const UpdateSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  startMinutes: z.coerce.number().int().min(0).max(24 * 60 - 1).optional(),
  endMinutes: z.coerce.number().int().min(1).max(24 * 60).optional(),
  active: z.coerce.boolean().optional(),
  label: z.string().max(100).nullable().optional(),
}).refine(
  (v) =>
    !("startMinutes" in v) ||
    !("endMinutes" in v) ||
    (typeof v.startMinutes === "number" &&
      typeof v.endMinutes === "number" &&
      v.endMinutes > v.startMinutes),
  { message: "endMinutes must be greater than startMinutes", path: ["endMinutes"] }
);

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const body = await req.json();
    const data = UpdateSchema.parse(body);
    const rule = await prisma.scheduleRule.update({ where: { id }, data });
    return NextResponse.json({ rule });
  } catch (e: any) {
    console.error("PUT /api/schedule/rules/:id error:", e);
    return NextResponse.json({ error: e?.message ?? "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    await prisma.scheduleRule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("DELETE /api/schedule/rules/:id error:", e);
    return NextResponse.json({ error: e?.message ?? "Delete failed" }, { status: 400 });
  }
}
