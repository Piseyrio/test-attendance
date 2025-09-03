import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toLocalMidnight(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(y, (m as number) - 1, d); // local 00:00
}

/** POST { studentId, dateISO: 'yyyy-MM-dd', status, note? } */
export async function POST(req: Request) {
  const { studentId, dateISO, status, note } = await req.json();
  if (!studentId || !dateISO || !status) {
    return NextResponse.json({ error: "studentId, dateISO, status required" }, { status: 400 });
  }
  const date = toLocalMidnight(dateISO);

  const row = await prisma.attendance.upsert({
    where: { studentId_date: { studentId, date } },
    create: { studentId, date, status, note },
    update: { status, note, updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true, row });
}

/** DELETE /api/attendance/day?studentId=&dateISO=yyyy-MM-dd */
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const studentId = Number(searchParams.get("studentId"));
  const dateISO = searchParams.get("dateISO");
  if (!studentId || !dateISO) {
    return NextResponse.json({ error: "studentId & dateISO required" }, { status: 400 });
  }
  const date = toLocalMidnight(dateISO);

  await prisma.attendance.delete({ where: { studentId_date: { studentId, date } } });
  return NextResponse.json({ ok: true });
}
