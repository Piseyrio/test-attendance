"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

type Rule = { id:number; dayOfWeek:number; startMinutes:number; endMinutes:number; active:boolean; label?:string|null };

const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const pad2 = (n:number) => String(n).padStart(2,"0");
const toHHMM = (m:number) => `${pad2(Math.floor(m/60))}:${pad2(m%60)}`;
const fromHHMM = (s:string) => {
  const [h, m] = s.split(":");
  const hh = Number(h ?? 0), mm = Number(m ?? 0);
  return hh*60 + mm;
};

export default function SchedulePage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newRule, setNewRule] = useState({
    dayOfWeek: 1,
    start: "18:00",
    end: "19:00",
    active: true,
    label: "",
  });

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/schedule/rules", { cache: "no-store" });
    if (!res.ok) { setError("Failed to load rules"); setLoading(false); return; }
    const j = await res.json();
    setRules(j.rules || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create() {
    try {
      setCreating(true);
      setError(null);
      const payload = {
        dayOfWeek: Number(newRule.dayOfWeek),
        startMinutes: fromHHMM(newRule.start),
        endMinutes: fromHHMM(newRule.end),
        active: !!newRule.active,
        label: newRule.label?.trim() || null,
      };
      const res = await fetch("/api/schedule/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Create failed (${res.status})`);
      }
      // Option A: re-fetch list to stay in sync
      await load();

      // reset form
      setNewRule((s) => ({ ...s, label: "" }));
    } catch (e:any) {
      setError(e?.message || "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(rule: Rule) {
    const res = await fetch(`/api/schedule/rules/${rule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !rule.active }),
    });
    if (res.ok) {
      const j = await res.json();
      setRules((r) => r.map((x) => (x.id === rule.id ? j.rule : x)));
    }
  }

  async function updateTime(rule: Rule, which: "start" | "end", value: string) {
    const payload = which === "start" ? { startMinutes: fromHHMM(value) } : { endMinutes: fromHHMM(value) };
    const res = await fetch(`/api/schedule/rules/${rule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const j = await res.json();
      setRules((r) => r.map((x) => (x.id === rule.id ? j.rule : x)));
    }
  }

  async function remove(rule: Rule) {
    const res = await fetch(`/api/schedule/rules/${rule.id}`, { method: "DELETE" });
    if (res.ok) setRules((r) => r.filter((x) => x.id !== rule.id));
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">Attendance Schedule</h1>

      {error && <div className="rounded bg-red-50 text-red-700 px-3 py-2">{error}</div>}

      {/* Add new rule */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(newRule.dayOfWeek)} onValueChange={(v) => setNewRule((n) => ({ ...n, dayOfWeek: Number(v) }))}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="Day" /></SelectTrigger>
          <SelectContent>{DOW.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
        </Select>
        <Input className="w-[120px]" type="time" value={newRule.start} onChange={(e) => setNewRule((n) => ({ ...n, start: e.target.value }))} />
        <span>to</span>
        <Input className="w-[120px]" type="time" value={newRule.end} onChange={(e) => setNewRule((n) => ({ ...n, end: e.target.value }))} />
        <Input className="w-[220px]" placeholder="Label (optional)" value={newRule.label} onChange={(e) => setNewRule((n) => ({ ...n, label: e.target.value }))} />
        <div className="flex items-center gap-2">
          <span>Active</span>
          <Switch checked={newRule.active} onCheckedChange={(v) => setNewRule((n) => ({ ...n, active: v }))} />
        </div>
        <Button onClick={create} disabled={creating}>{creating ? "Adding…" : "Add"}</Button>
      </div>

      {/* List */}
      <div className="rounded border">
        <div className="grid grid-cols-7 px-3 py-2 font-medium bg-muted">
          <div>Day</div><div>Start</div><div>End</div><div>Active</div><div>Label</div><div>ID</div><div></div>
        </div>
        {loading ? (
          <div className="px-3 py-4">Loading…</div>
        ) : rules.length === 0 ? (
          <div className="px-3 py-4 text-muted-foreground">No rules yet.</div>
        ) : (
          rules.map((r) => (
            <div key={r.id} className="grid grid-cols-7 items-center px-3 py-2 border-t">
              <div>{DOW[r.dayOfWeek]}</div>
              <div><Input className="w-[120px]" type="time" value={toHHMM(r.startMinutes)} onChange={(e) => updateTime(r, "start", e.target.value)} /></div>
              <div><Input className="w-[120px]" type="time" value={toHHMM(r.endMinutes)} onChange={(e) => updateTime(r, "end", e.target.value)} /></div>
              <div><Switch checked={r.active} onCheckedChange={() => toggleActive(r)} /></div>
              <div className="truncate">{r.label || ""}</div>
              <div>{r.id}</div>
              <div className="text-right"><Button variant="destructive" onClick={() => remove(r)}>Delete</Button></div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
