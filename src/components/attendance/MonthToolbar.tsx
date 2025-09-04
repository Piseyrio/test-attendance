"use client";

import { addMonths } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, Clock } from "lucide-react";
import * as React from "react";

export default function MonthToolbar({
  initialYear,
  initialMonth, // 1..12
  classId,
}: {
  initialYear: number;
  initialMonth: number;
  classId?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [y, setY] = React.useState(initialYear);
  const [m, setM] = React.useState(initialMonth);

  const pushYM = (yy: number, mm: number) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("y", String(yy));
    params.set("m", String(mm));
    if (classId != null) params.set("classId", String(classId));
    router.replace(`${pathname}?${params.toString()}`);
    setY(yy);
    setM(mm);
  };

  const onPrev = () => {
    const d = addMonths(new Date(y, m - 1, 1), -1);
    pushYM(d.getFullYear(), d.getMonth() + 1);
  };
  const onNext = () => {
    const d = addMonths(new Date(y, m - 1, 1), 1);
    pushYM(d.getFullYear(), d.getMonth() + 1);
  };
  const onNow = () => {
    const d = new Date();
    pushYM(d.getFullYear(), d.getMonth() + 1);
  };

  const valueMonth = `${y}-${String(m).padStart(2, "0")}`;
  const onPick: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const v = e.target.value; // "YYYY-MM"
    if (!v) return;
    const [yy, mm] = v.split("-").map(Number);
    if (!yy || !mm) return;
    pushYM(yy, mm);
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={onPrev}>
        <ChevronLeft className="mr-1 h-4 w-4" />
        Prev
      </Button>

      <div className="flex items-center gap-2 rounded border px-2 py-1">
        <Calendar className="h-4 w-4 opacity-70" />
        <input
          type="month"
          value={valueMonth}
          onChange={onPick}
          className="bg-transparent outline-none"
        />
      </div>

      {/* NEW: Now (jump to current month) */}
      <Button variant="outline" onClick={onNow}>
        <Clock className="mr-1 h-4 w-4" />
        Now
      </Button>

      <Button variant="outline" onClick={onNext}>
        Next
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
