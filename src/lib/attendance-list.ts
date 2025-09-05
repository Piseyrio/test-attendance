import { prisma } from "@/lib/prisma";

export type StudentAttendanceRow = {
  student: {
    biometricId: unknown; id: number; firstname: string; lastname: string; img?: string | null 
};
  totalAttendance: number; // PRESENT
  totalAbsent: number;     // ABSENT
  totalLate: number;       // LATE
  totalExcused: number;    // EXCUSED
};

export async function getStudentAttendanceRows(params?: { start?: Date; end?: Date }) {
  const now = new Date();
  const start = params?.start ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const end = params?.end ?? new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const endExclusive = new Date(end); endExclusive.setDate(endExclusive.getDate() + 1);

  const students = await prisma.student.findMany({
    select: { id: true, firstname: true, lastname: true },
    orderBy: [{ firstname: "asc" }, { lastname: "asc" }],
  });
  if (!students.length) return [];

  const grouped = await prisma.attendance.groupBy({
    by: ["studentId", "status"],
    where: { date: { gte: start, lt: endExclusive } },
    _count: { _all: true },
  });

  const counts = new Map<number, { P: number; A: number; L: number; E: number }>();
  for (const s of students) counts.set(s.id, { P: 0, A: 0, L: 0, E: 0 });
  for (const g of grouped) {
    const b = counts.get(g.studentId);
    if (!b) continue;
    if (g.status === "PRESENT") b.P += g._count._all;
    else if (g.status === "ABSENT") b.A += g._count._all;
    else if (g.status === "LATE") b.L += g._count._all;
    else if (g.status === "EXCUSED") b.E += g._count._all;
  }

  return students.map((s) => {
    const c = counts.get(s.id)!;
    return {
      student: {
        ...s, img: null,
        biometricId: undefined
      },
      totalAttendance: c.P,
      totalAbsent: c.A,
      totalLate: c.L,
      totalExcused: c.E,
    } satisfies StudentAttendanceRow;
  });
}
