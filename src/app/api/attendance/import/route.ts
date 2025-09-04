// src/app/api/attendance/import/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parse } from "csv-parse/sync";
import { parseDateAny } from "@/lib/dates";

const STATUS_MAP: Record<string, "PRESENT"|"ABSENT"|"LATE"|"EXCUSED"> = {
  p:"PRESENT", present:"PRESENT",
  a:"ABSENT",  absent:"ABSENT",
  l:"LATE",    late:"LATE",
  e:"EXCUSED", excused:"EXCUSED",
};

// normalize "Student_ID" -> "studentid"
function normKeys(row: Record<string,string>) {
  const out: Record<string,string> = {};
  for (const [k,v] of Object.entries(row)) out[k.toLowerCase().replace(/[^a-z0-9]/g,"")] = v;
  return out;
}
const pick = (r:Record<string,string>, keys:string[]) => {
  for (const k of keys) if (r[k] != null && String(r[k]).trim() !== "") return String(r[k]).trim();
  return "";
};

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dryRun = /^(1|true)$/i.test(searchParams.get("dryRun") ?? "");

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });

    const text = await file.text();
    const rawRows = parse(text, { columns: true, skip_empty_lines: true, trim: true }) as Array<Record<string,string>>;
    const rows = rawRows.map(normKeys);

    type Parsed = { line:number; sidRaw?:string; bioRaw?:string; date?:Date; status?:"PRESENT"|"ABSENT"|"LATE"|"EXCUSED"; note?:string };
    const parsed: Parsed[] = [];

    // carry-down identifiers like spreadsheets
    let carrySid = "", carryBio = "";
    rows.forEach((r, idx) => {
      const line = idx + 2;
      const sidIn = pick(r, ["studentid"]);
      const bioIn = pick(r, ["biometricid","biometric","deviceuserid"]);
      const sidRaw = sidIn || carrySid;
      const bioRaw = bioIn || carryBio;
      if (sidIn) carrySid = sidIn;
      if (bioIn) carryBio = bioIn;

      const d  = parseDateAny(pick(r, ["date"]));
      const st = STATUS_MAP[pick(r, ["status"]).toLowerCase()];
      const nt = pick(r, ["note"]);
      parsed.push({ line, sidRaw, bioRaw, date: d ?? undefined, status: st, note: nt || undefined });
    });

    // resolve students in bulk
    const ids  = [...new Set(parsed.map(p => Number(p.sidRaw)).filter(n => Number.isFinite(n) && n>0))];
    const bios = [...new Set(parsed.map(p => p.bioRaw).filter(Boolean))] as string[];

    const found = (ids.length || bios.length)
      ? await prisma.student.findMany({
          where: { OR: [
            ids.length  ? { id: { in: ids } } : undefined,
            bios.length ? { biometricId: { in: bios } } : undefined,
          ].filter(Boolean) as any[] },
          select: { id: true, biometricId: true },
        })
      : [];

    const byId  = new Map(found.map(s => [s.id, s]));
    const byBio = new Map(found.filter(s => s.biometricId != null).map(s => [s.biometricId!, s]));

    const errors: Array<{ line:number; msg:string }> = [];
    type Op = { studentId:number; date:Date; status:"PRESENT"|"ABSENT"|"LATE"|"EXCUSED"; note?:string };
    const ops: Op[] = [];

    for (const p of parsed) {
      if (!p.sidRaw && !p.bioRaw && !p.date && !p.status) continue; // skip blank line

      let sid: number | undefined;
      if (p.sidRaw) {
        const n = Number(p.sidRaw);
        if (Number.isFinite(n) && byId.has(n)) sid = n;
      }
      if (!sid && p.bioRaw && byBio.has(p.bioRaw)) sid = byBio.get(p.bioRaw)!.id;

      if (!sid)      { errors.push({ line: p.line, msg: `Student not found (studentId=${p.sidRaw || "-"}, biometricId=${p.bioRaw || "-"})` }); continue; }
      if (!p.date)   { errors.push({ line: p.line, msg: "Invalid/missing date" }); continue; }
      if (!p.status) { errors.push({ line: p.line, msg: "Invalid/missing status (P/A/L/E or words)" }); continue; }

      ops.push({ studentId: sid, date: p.date, status: p.status, note: p.note });
    }

    const summary = { totalRows: rawRows.length, validRows: ops.length, errorRows: errors.length, errors };
    if (dryRun) return NextResponse.json({ ok: true, dryRun: true, ...summary });

    // commit (idempotent via unique constraint)
    const CHUNK = 200;
    let inserted = 0, updated = 0;
    for (let i = 0; i < ops.length; i += CHUNK) {
      const slice = ops.slice(i, i + CHUNK);
      const tx = slice.map((r) =>
        prisma.attendance.upsert({
          where: { studentId_date: { studentId: r.studentId, date: r.date } },
          update: { status: r.status, note: r.note ?? null },
          create: { studentId: r.studentId, date: r.date, status: r.status, note: r.note ?? null },
        })
      );
      // detect updates by pre-check (cheap)
      const existing = await prisma.attendance.findMany({
        where: { OR: slice.map(r => ({ studentId: r.studentId, date: r.date })) },
        select: { studentId: true, date: true },
      });
      const set = new Set(existing.map(e => `${e.studentId}_${e.date.toISOString()}`));
      await prisma.$transaction(tx);
      for (const r of slice) {
        const k = `${r.studentId}_${r.date.toISOString()}`;
        if (set.has(k)) updated++; else inserted++;
      }
    }

    return NextResponse.json({ ok: true, dryRun: false, ...summary, inserted, updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
