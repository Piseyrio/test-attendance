"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function ExportCsvButton({
  year,
  month,
  classId,
}: {
  year: number;   // 1..12
  month: number;  // 1..12
  classId?: number;
}) {
  const [loading, setLoading] = React.useState(false);

  const onClick = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("year", String(year));
      params.set("month", String(month));
      if (classId != null) params.set("classId", String(classId));

      const url = `/api/attendance/export?${params.toString()}`;
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();

      const fname = `attendance_${year}-${String(month).padStart(2, "0")}${
        classId ? `_class_${classId}` : ""
      }.csv`;

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error(e);
      alert("Failed to export CSV.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={onClick} disabled={loading}>
      <Download className="mr-2 h-4 w-4" />
      {loading ? "Exporting..." : "Export CSV"}
    </Button>
  );
}
