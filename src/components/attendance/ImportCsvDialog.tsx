"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, CheckCircle2, AlertTriangle } from "lucide-react";

export default function ImportCsvDialog({ year, month, classId }: { year: number; month: number; classId?: number }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState<any | null>(null);

  const doDryRun = async () => {
    if (!file) return;
    setLoading(true); setDone(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      if (classId != null) fd.set("classId", String(classId));
      const res = await fetch(`/api/attendance/import?dryRun=1`, { method: "POST", body: fd });
      const json = await res.json();
      setPreview(json);
    } finally { setLoading(false); }
  };

  const doImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      if (classId != null) fd.set("classId", String(classId));
      const res = await fetch(`/api/attendance/import`, { method: "POST", body: fd });
      const json = await res.json();
      setDone(json); setPreview(null);
    } finally { setLoading(false); }
  };

  const downloadTemplate = () => {
    const sample =
`studentId,biometric,date,status,note
1,1001,${year}-${String(month).padStart(2,"0")}-01,P,On time
,,${year}-${String(month).padStart(2,"0")}-01,A, // if using biometric-only row, fill biometric
2,1002,${year}-${String(month).padStart(2,"0")}-02,L,Late 10m
`;
    const blob = new Blob([sample], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "attendance_template.csv";
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Import Monthly Attendance (CSV)</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Button variant="ghost" onClick={downloadTemplate}>Download template</Button>
          </div>

          <div className="text-sm text-muted-foreground">
            Columns: <code>studentId</code> <b>or</b> <code>biometric</code>, <code>date</code> (YYYY-MM-DD),
            <code>status</code> (P/A/L/E or words), optional <code>note</code>.
          </div>

          <div className="flex gap-2">
            <Button onClick={doDryRun} disabled={!file || loading}>Validate</Button>
            <Button onClick={doImport} disabled={!file || loading || (preview && preview.errorRows > 0)}>
              Import
            </Button>
          </div>

          {loading && <div className="text-sm">Processing…</div>}

          {preview && (
            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium mb-1">Validation</div>
              <div>Total rows: {preview.totalRows}</div>
              <div>Valid rows: {preview.validRows}</div>
              <div className={preview.errorRows ? "text-red-600" : "text-green-600"}>
                Errors: {preview.errorRows}
              </div>
              {preview.errors?.length ? (
                <ul className="mt-2 max-h-40 overflow-auto list-disc pl-5">
                  {preview.errors.slice(0, 50).map((e: any, i: number) => (
                    <li key={i}>line {e.line}: {e.msg}</li>
                  ))}
                  {preview.errors.length > 50 && <li>…and more</li>}
                </ul>
              ) : (
                <div className="mt-2 flex items-center text-green-700">
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Looks good — ready to import.
                </div>
              )}
            </div>
          )}

          {done && (
            <div className="rounded-md border p-3 text-sm">
              {done.ok ? (
                <>
                  <div className="font-medium mb-1">Import complete</div>
                  <div>Inserted: {done.inserted ?? 0}</div>
                  <div>Updated: {done.updated ?? 0}</div>
                </>
              ) : (
                <div className="text-red-600 flex items-center">
                  <AlertTriangle className="mr-1 h-4 w-4" /> {done.error || "Import failed"}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
